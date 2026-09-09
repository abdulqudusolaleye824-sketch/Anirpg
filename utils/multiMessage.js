// ═══════════════════════════════════════════════════════════════
// Astra — Multi-Message System
//
// sendMulti(sock, jid, sections, opts) → fans out an array of
// message sections into N individual WhatsApp messages, with
// a random human-like stagger between them.
//
// Section shape:
//   { text: '...' }                              // text-only
//   { text: '...', image: { url } }              // image + caption
//   { video: { url }, caption: '...' }           // video
//   { document: { url }, mimetype, fileName, caption }
//   { text: '...', quoted: msg }                 // reply-quote
//   { audio: {...}, ptt: true }                  // voice note
//
// opts:
//   stagger:      [minMs, maxMs]  (default [350, 900])
//   chunkText:    true|false      (default true)  — split any
//                  text section > 3500 chars
//   quoted:       msg              (reply-quote first section)
//   firstDelay:   ms              (default 0)
//   stopOnError:  true|false      (default false)
//
// Backwards-compatible: if you pass a STRING instead of an array,
// it's treated as a single section. If you pass an object with
// { sections: [...] }, it's also accepted (proxy-friendly).
//
// The exported `sendMessage` proxy in rpgCommandHandler.js will
// also auto-detect `content.sections` so existing command code
// can opt-in by passing { sections: [...] } to sock.sendMessage.
// ═══════════════════════════════════════════════════════════════

'use strict';

const CHUNK_SIZE = 3500;

// ── Stagger helper ──────────────────────────────────────────
function randStagger([lo, hi]) {
  return Math.floor(lo + Math.random() * (hi - lo));
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Split long text on double-newline, then single ──────────
function chunkText(text) {
  const parts = [];
  let remaining = text;
  while (remaining.length > CHUNK_SIZE) {
    let splitAt = remaining.lastIndexOf('\n\n', CHUNK_SIZE);
    if (splitAt < CHUNK_SIZE * 0.5) splitAt = remaining.lastIndexOf('\n', CHUNK_SIZE);
    if (splitAt <= 0) splitAt = CHUNK_SIZE;
    parts.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }
  if (remaining.length) parts.push(remaining);
  return parts;
}

// ── Build a single WhatsApp message payload from a section ──
function sectionToPayload(section, quotedOverride) {
  if (!section || typeof section !== 'object') {
    return { text: String(section || '') };
  }

  const payload = {};

  // text + optional image/video/document/audio
  if (section.text)  payload.text  = section.text;
  if (section.image)    payload.image    = section.image;
  if (section.video)    payload.video    = section.video;
  if (section.document) payload.document = section.document;
  if (section.audio)    payload.audio    = section.audio;
  if (section.sticker)  payload.sticker  = section.sticker;
  if (section.gif)      payload.gif      = section.gif;

  // Backwards-compat: { caption } for media
  if (!payload.text && section.caption) payload.text = section.caption;

  // If we ended up with nothing, fall back to a JSON dump so the
  // user still sees something instead of getting a silent failure
  if (Object.keys(payload).length === 0) {
    payload.text = JSON.stringify(section, null, 2).slice(0, CHUNK_SIZE);
  }

  return payload;
}

// ── Core: send one section, with optional send opts ──────────
async function sendOneSection(sock, jid, section, sendOpts) {
  if (section == null) return null;
  // Allow shorthand strings
  const sec = typeof section === 'string' ? { text: section } : section;
  const payload = sectionToPayload(sec);
  const opts = sendOpts || sec.sendOpts || {};
  try {
    return await sock.sendMessage(jid, payload, opts);
  } catch (e) {
    // Try to send a text-only fallback so the user is never left hanging
    if (payload.text) {
      try { return await sock.sendMessage(jid, { text: payload.text }, {}); }
      catch (_) {}
    }
    throw e;
  }
}

// ── Main: sendMulti(sock, jid, sections, opts) ───────────────
/**
 * @param {object} sock — Baileys socket (or proxy)
 * @param {string} jid  — destination JID
 * @param {Array|string|object} input — array of sections, or
 *                                       a single string/object
 * @param {object} opts — { stagger, chunkText, quoted, firstDelay, stopOnError }
 */
async function sendMulti(sock, jid, input, opts = {}) {
  if (!sock || !jid) return null;
  if (input == null) return null;

  // Normalize input
  let sections;
  if (Array.isArray(input)) {
    sections = input;
  } else if (typeof input === 'string') {
    sections = [{ text: input }];
  } else if (input && Array.isArray(input.sections)) {
    sections = input.sections;
    // Allow { sections, quoted, stagger, ... } style
    opts = { ...input, ...opts };
  } else if (input && typeof input === 'object') {
    sections = [input];
  } else {
    sections = [{ text: String(input) }];
  }

  // Drop empty/null sections
  sections = sections.filter((s) => s != null && s !== '');
  if (sections.length === 0) return null;

  const stagger     = Array.isArray(opts.stagger) && opts.stagger.length === 2
    ? opts.stagger
    : [2000, 3000];
  const chunkTextOn = opts.chunkText !== false;
  const quoted      = opts.quoted || (opts.firstSection ? null : null);
  const firstDelay  = opts.firstDelay || 0;
  const stopOnError = !!opts.stopOnError;

  // Expand any text-only section that exceeds CHUNK_SIZE into
  // multiple sub-sections (when chunkText is on)
  const expanded = [];
  for (const sec of sections) {
    const s = typeof sec === 'string' ? { text: sec } : sec;
    if (chunkTextOn && s.text && s.text.length > CHUNK_SIZE &&
        !s.image && !s.video && !s.document && !s.audio) {
      const chunks = chunkText(s.text);
      for (const c of chunks) expanded.push({ text: c });
    } else {
      expanded.push(s);
    }
  }
  sections = expanded;

  if (firstDelay > 0) await sleep(firstDelay);

  const results = [];
  for (let i = 0; i < sections.length; i++) {
    const sec = sections[i];
    const isFirst = i === 0;

    // Reply-quote: attach the original message only to the first section,
    // unless the section explicitly asks for it.
    const sendOpts = sec.quoted
      ? { quoted: sec.quoted }
      : (isFirst && quoted ? { quoted } : {});

    try {
      const r = await sendOneSection(sock, jid, sec, sendOpts);
      results.push(r);
    } catch (e) {
      console.error(`[sendMulti] section ${i} failed:`, e.message);
      if (stopOnError) throw e;
    }

    // Stagger between sections (not after the last)
    if (i < sections.length - 1) {
      const wait = randStagger(stagger);
      await sleep(wait);
    }
  }

  return results;
}

module.exports = {
  sendMulti,
  chunkText,
  sectionToPayload,
  CHUNK_SIZE,
};
