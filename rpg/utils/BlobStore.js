/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║        Astra — BlobStore (keep big binaries out of the DB)  ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * Push #47 — the single biggest reason the bot goes slow.
 *
 * Player avatars used to be stored *inside* the game document:
 *     player.profileImage = buf.toString('base64')
 * A 300×300 JPEG is ~30–60 KB on disk, so base64 adds ~80 KB **per player**.
 * The persistence layer serialises the WHOLE document on every save — and there
 * are hundreds of `saveDatabase()` call sites (one or more per command) — so a
 * couple of hundred players with avatars meant every save was stringifying
 * multiple megabytes, on the main thread, on a throttled Oracle free-tier VM.
 * That is what makes commands crawl and the WhatsApp sockets miss their keepalive
 * windows (the bot looks "disconnected" / stops replying). It also pushes the
 * Mongo document toward its 16 MB limit, which then skips mirroring entirely.
 *
 * Blobs now live on disk under DATA_DIR/blobs/ and the player document keeps a
 * tiny reference string. Inline blobs already stored are migrated lazily on
 * first read (so nobody loses their avatar and no manual step is needed), and
 * reads fall back to the inline value if the file is missing.
 */

'use strict';

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');

function root() {
  const base = process.env.DATA_DIR ? path.join(process.env.DATA_DIR, 'blobs')
                                    : path.join(__dirname, '..', '..', 'data', 'blobs');
  try { fs.mkdirSync(base, { recursive: true }); } catch (e) {}
  return base;
}

function safeKey(kind, id) {
  const k = String(kind || 'misc').replace(/[^a-z0-9_-]/gi, '').slice(0, 24) || 'misc';
  const i = String(id || 'anon').split('@')[0].split(':')[0].replace(/[^0-9a-zA-Z]/g, '').slice(0, 32) || 'anon';
  return { dir: path.join(root(), k), file: path.join(root(), k, `${i}.bin`) };
}

/** true when the value looks like a stored blob (vs a small ref string). */
function isInlineBlob(v) {
  return typeof v === 'string' && v.length > 512 && !v.startsWith('blob:');
}

async function put(kind, id, data) {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(String(data || ''), 'base64');
  if (!buf.length) return null;
  const { dir, file } = safeKey(kind, id);
  const hash = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 12);
  const target = path.join(dir, `${path.basename(file, '.bin')}-${hash}.bin`);
  try {
    await fsp.mkdir(dir, { recursive: true });
    // prune any older blob for this key, then write
    for (const f of await fsp.readdir(dir).catch(() => [])) {
      if (f.startsWith(path.basename(file, '.bin') + '-') && f !== path.basename(target)) {
        try { await fsp.unlink(path.join(dir, f)); } catch (e) {}
      }
    }
    const tmp = target + '.tmp';
    await fsp.writeFile(tmp, buf);
    await fsp.rename(tmp, target);
    return `blob:${path.relative(root(), target)}`;
  } catch (e) {
    console.error('[BlobStore] put failed:', e.message);
    return null;
  }
}

function putSync(kind, id, data) {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(String(data || ''), 'base64');
  if (!buf.length) return null;
  const { dir, file } = safeKey(kind, id);
  const hash = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 12);
  const target = path.join(dir, `${path.basename(file, '.bin')}-${hash}.bin`);
  try {
    fs.mkdirSync(dir, { recursive: true });
    for (const f of fs.readdirSync(dir)) {
      if (f.startsWith(path.basename(file, '.bin') + '-') && f !== path.basename(target)) {
        try { fs.unlinkSync(path.join(dir, f)); } catch (e) {}
      }
    }
    fs.writeFileSync(target, buf);
    return `blob:${path.relative(root(), target)}`;
  } catch (e) {
    console.error('[BlobStore] putSync failed:', e.message);
    return null;
  }
}

function resolvePath(ref) {
  if (typeof ref !== 'string' || !ref.startsWith('blob:')) return null;
  const rel = ref.slice(5);
  if (rel.includes('..') || path.isAbsolute(rel)) return null;
  return path.join(root(), rel);
}

/** Read a stored blob. Returns a Buffer or null. */
async function get(ref) {
  const p = resolvePath(ref);
  if (!p) return null;
  try { return await fsp.readFile(p); } catch (e) { return null; }
}

function getSync(ref) {
  const p = resolvePath(ref);
  if (!p) return null;
  try { return fs.readFileSync(p); } catch (e) { return null; }
}

async function drop(ref) {
  const p = resolvePath(ref);
  if (!p) return false;
  try { await fsp.unlink(p); return true; } catch (e) { return false; }
}

/**
 * Player-facing helper: the image as a Buffer, migrating an inline base64 blob
 * out of the document the first time it is read.
 * Returns { buffer, ref, migrated } — `migrated` means the caller should save.
 */
async function readPlayerImage(player) {
  if (!player) return { buffer: null, ref: null, migrated: false };
  if (player.profileImageRef) {
    const buf = await get(player.profileImageRef);
    if (buf) return { buffer: buf, ref: player.profileImageRef, migrated: false };
  }
  if (isInlineBlob(player.profileImage)) {
    const ref = await put('pp', player.id || player.jid || 'anon', player.profileImage);
    if (ref) {
      return { buffer: await get(ref), ref, migrated: true };
    }
    try { return { buffer: Buffer.from(player.profileImage, 'base64'), ref: null, migrated: false }; } catch (e) {}
  } else if (player.profileImage) {
    try { return { buffer: Buffer.from(player.profileImage, 'base64'), ref: null, migrated: false }; } catch (e) {}
  }
  return { buffer: null, ref: player.profileImageRef || null, migrated: false };
}

/** Approximate bytes still hiding inside the player doc (for /dbstatus). */
function inlineBlobBytes(db) {
  let bytes = 0;
  try {
    for (const u of Object.values(db?.users || {})) {
      if (isInlineBlob(u && u.profileImage)) bytes += u.profileImage.length;
    }
  } catch (e) {}
  return bytes;
}

module.exports = { put, putSync, get, getSync, drop, readPlayerImage, isInlineBlob, inlineBlobBytes, root, AUTO_DIR: 'pp' };
