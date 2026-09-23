/**
 * ╔══════════════════════════════════════════════════════╗
 * ║         AniRPG — MultiSocketManager                  ║
 * ║  One Baileys socket per linked bot number.          ║
 * ║  Every bot handles RPG commands AND has a          ║
 * ║  personality. No "primary" or "secondary" — all     ║
 * ║  bots are equal.                                   ║
 * ╚══════════════════════════════════════════════════════╝
 */

'use strict';

const path = require('path');
const fs   = require('fs');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers,
  makeCacheableSignalKeyStore,
} = require('@whiskeysockets/baileys');
const pino    = require('pino');

const PersonalityManager = require('./PersonalityManager');
const AIHandler          = require('./AIHandler');
const SerfManager        = require('../rpg/utils/SerfManager');
const Perms              = require('../utils/permissions');
const QRCode             = require('qrcode');

// ── Push #55: config.json was read from disk and JSON.parsed for EVERY
// inbound message on EVERY bot — 5 sockets meant 5 synchronous fs reads in the
// hot path, which stalls the event loop (and therefore reply latency) under
// group load. Memoised with an mtime check so config edits still apply
// within a second.
let _cfgCache = null, _cfgMtime = 0, _cfgAt = 0;
function readConfigCached() {
  const file = path.join(__dirname, '..', 'config.json');
  const now = Date.now();
  try {
    if (!_cfgCache || now - _cfgAt > 1000) {
      const mt = fs.statSync(file).mtimeMs;
      if (!_cfgCache || mt !== _cfgMtime) {
        _cfgCache = JSON.parse(fs.readFileSync(file, 'utf-8'));
        _cfgMtime = mt;
      }
      _cfgAt = now;
    }
  } catch (e) {
    if (!_cfgCache) _cfgCache = { prefix: '/', ownerId: 'admin' };
  }
  return _cfgCache;
}
const QRTerminal = (()=>{ try { return require('qrcode-terminal'); } catch(e){ return null; } })();
// NOTE: native interactive buttons are back (utils/buttons) — relayed with the
// stanza nodes WhatsApp requires (biz/interactive + the DM bot node), so they
// render; numbered text menus (utils/textMenu) remain as automatic fallback.
// Tap-backs arrive as their button id (= a /command) and flow through the
// normal pipeline below — no separate dispatch needed.

const botSockets = {};
const pairingSessions = {};
// Push #64 — /link <bot> (owner DM). Throttle: one deliberate pairing start per
// personality per 30s, so a double-tap can't burn QR refs back-to-back.
const _linkKickAt = {};
const MAX_MSG_AGE_MS = Number(process.env.MAX_MSG_AGE_MS || 5 * 60 * 1000);

// ── Push #75: OUTBOUND PACING ────────────────────────────────────────────────
// WhatsApp rate-limits a number that bursts; a rate-limited send used to be
// retried then DROPPED, which is the "bot is silent to commands while spawns
// still arrive" symptom (and the empty bubbles). Sends are now serialised per
// chat with a minimum gap, plus a global per-socket cap, so a burst becomes a
// queue instead of a limit hit.
const SEND_GAP_PER_CHAT_MS = Number(process.env.SEND_GAP_PER_CHAT_MS || 650);
const SEND_GLOBAL_PER_SEC  = Number(process.env.SEND_GLOBAL_PER_SEC || 8);
const _chatSendChain = new Map();   // `${key}|${jid}` -> Promise chain tail
const _chatLastSend  = new Map();   // `${key}|${jid}` -> ts
const _sockSendStamps = {};         // key -> [ts...] last second
async function _pace(key, jid) {
  const ck = `${key}|${jid}`;
  const prev = _chatSendChain.get(ck) || Promise.resolve();
  let release;
  const mine = new Promise(r => { release = r; });
  _chatSendChain.set(ck, prev.then(() => mine));
  await prev;
  try {
    const gap = SEND_GAP_PER_CHAT_MS - (Date.now() - (_chatLastSend.get(ck) || 0));
    if (gap > 0) await new Promise(r => setTimeout(r, gap));
    for (;;) {
      const now = Date.now();
      const arr = (_sockSendStamps[key] = (_sockSendStamps[key] || []).filter(t => now - t < 1000));
      if (arr.length < SEND_GLOBAL_PER_SEC) { arr.push(now); break; }
      await new Promise(r => setTimeout(r, 1000 - (now - arr[0]) + 5));
    }
    _chatLastSend.set(ck, Date.now());
  } finally {
    setTimeout(() => { release(); if (_chatSendChain.get(ck) === mine) _chatSendChain.delete(ck); }, 0);
  }
}

// ── Push #75: INBOUND SPAM LIMITER ───────────────────────────────────────────
// One user hammering commands (or several in a GC) is what pushes the number
// into the rate limit in the first place. Per sender: 1 command / 1.2s and the
// SAME command not more than once / 4s. Per group: 10 commands / 5s. Excess is
// ignored quietly (one notice per sender per 30s).
const _spamSender = new Map(); // sender -> { last, lastText, lastSame, warnedAt }
const _spamChat   = new Map(); // chatId -> [ts...]
const _inboundTrace = {}; // Push #80: per-socket inbound trace
const _spamSeen = new Map(); // msgId -> result (all sockets see the same GC message once each)
function _spamCheck(chatId, sender, text, isGroup, msgId) {
  const now = Date.now();
  if (msgId && _spamSeen.has(msgId)) return _spamSeen.get(msgId);
  const res = _spamCheckInner(chatId, sender, text, isGroup, now);
  if (msgId) { _spamSeen.set(msgId, res); if (_spamSeen.size > 4000) { const k = _spamSeen.keys().next().value; _spamSeen.delete(k); } }
  return res;
}
function _spamCheckInner(chatId, sender, text, isGroup, now) {
  const st = _spamSender.get(sender) || { last: 0, lastText: '', lastSame: 0, warnedAt: 0, strikes: 0, mutedUntil: 0 };
  const t = String(text || '').trim().toLowerCase();
  let block = false;
  // Push #78: escalating penalty. A spammer who keeps hammering gets muted for
  // 15s after 5 blocked commands, 60s after 12 — blocked messages COUNT, so
  // "one free command every 1.2s forever" is no longer possible.
  if (st.mutedUntil > now) { block = true; }
  const rapid = now - st.last < 1200;
  if (rapid) block = true;
  // Push #79: same command again within 2s only (4s was blocking normal
  // repeat use like /inv → /inv 3s later, and every block became a strike).
  if (t && t === st.lastText && now - st.lastSame < 2000) block = true;
  if (isGroup) {
    const arr = (_spamChat.get(chatId) || []).filter(x => now - x < 5000);
    if (arr.length >= 10) block = true; else arr.push(now);
    _spamChat.set(chatId, arr);
  }
  if (!block) { st.last = now; if (t !== st.lastText) { st.lastText = t; } st.lastSame = now; if (now - st.lastBlockAt > 30000) st.strikes = 0; }
  else if (rapid) {
    // Only true rapid-fire counts as a strike (never a same-command repeat).
    st.strikes = (st.strikes || 0) + 1; st.lastBlockAt = now;
    if (st.strikes >= 8) st.mutedUntil = now + 15000;
  }
  const warn = block && (now - st.warnedAt > 30000);
  if (warn) st.warnedAt = now;
  _spamSender.set(sender, st);
  if (_spamSender.size > 5000) { for (const [k, v] of _spamSender) { if (now - v.last > 600000) _spamSender.delete(k); } }
  return { block, warn };
}
let _staleDropped = 0;
// Push #74: /link from a DM — password gate + QR delivered INTO the DM.
// _linkPending[senderJid] = { targetKey, sockKey, at } while we wait for the password.
// _qrSubscribers[targetKey] = [{ sockKey, jid, seq, until }] receive each new QR as an image.
const _linkPending = {};
const _qrSubscribers = {};
const LINK_PASSWORD = String(process.env.LINK_PASSWORD || process.env.BOT_LINK_PASSWORD || 'astra2026');
const LINK_SUB_MS = 5 * 60 * 1000;
function subscribeQr(targetKey, sockKey, jid) {
  const list = _qrSubscribers[targetKey] || (_qrSubscribers[targetKey] = []);
  const ex = list.find(x => x.jid === jid);
  if (ex) { ex.sockKey = sockKey; ex.until = Date.now() + LINK_SUB_MS; return; }
  list.push({ sockKey, jid, seq: 0, until: Date.now() + LINK_SUB_MS });
}
async function _pushQrToSubscribers(targetKey, qr, seq) {
  const list = _qrSubscribers[targetKey];
  if (!list || !list.length) return;
  let png = null;
  try { png = await QRCode.toBuffer(qr, { width: 480, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff' } }); } catch (e) { return; }
  const name = PersonalityManager.getDisplayName(targetKey);
  for (const sub of list.slice()) {
    if (Date.now() > sub.until) { list.splice(list.indexOf(sub), 1); continue; }
    if (sub.seq === seq) continue;
    sub.seq = seq;
    const sk = (botSockets[sub.sockKey]?.user?.id ? botSockets[sub.sockKey] : null) || botSockets[getFirstUsableSocketKey()];
    if (!sk) continue;
    try {
      await sk.sendMessage(sub.jid, { image: png, caption:
        `🔗 *${name} — PAIRING QR #${seq}*\n\nWhatsApp → Linked devices → Link a device → scan THIS.\n⏱ Valid ~${Math.round(QR_VALID_MS / 1000)}s — a fresh one arrives automatically; ALWAYS scan the newest.\n🛑 /stoplink to stop.` }, { asSelf: true });
    } catch (e) {}
  }
}
// Push #74b: /stoplink — stop QR spam. Unsubscribes the caller's DM from every
// target and, if nobody is still watching a pairing socket, ends that
// pairing socket so the terminal stops printing QRs too.
function stopLink(jid) {
  const stopped = [];
  for (const targetKey of Object.keys(_qrSubscribers)) {
    const list = _qrSubscribers[targetKey];
    const before = list.length;
    _qrSubscribers[targetKey] = list.filter(x => x.jid !== jid);
    if (_qrSubscribers[targetKey].length !== before) stopped.push(targetKey);
    if (_qrSubscribers[targetKey].length === 0) {
      delete _qrSubscribers[targetKey];
      const s = botSockets[targetKey];
      const ps = pairingSessions[targetKey];
      if (s && !s.user?.id && ps && ['starting', 'awaiting_qr', 'code_ready'].includes(ps.status)) {
        try { s.ev?.removeAllListeners?.(); } catch (e) {}
        try { s.end(undefined); } catch (e) {}
        delete botSockets[targetKey];
        pairingSessions[targetKey] = { ...ps, status: 'stopped', qr: null, qrDataUrl: null };
        _linkKickAt[targetKey] = 0;
      }
    }
  }
  for (const k of Object.keys(_linkPending)) if (k === jid) delete _linkPending[k];
  return stopped;
}
function _notifyLinkSubscribers(targetKey, text) {
  const list = _qrSubscribers[targetKey];
  if (!list) return;
  for (const sub of list) {
    const sk = botSockets[sub.sockKey] || botSockets[getFirstUsableSocketKey()];
    if (sk) { try { sk.sendMessage(sub.jid, { text }).catch(() => {}); } catch (e) {} }
  }
  delete _qrSubscribers[targetKey];
}

// Push #57 — a Baileys QR is a short-lived *pairing ref*, not a picture. Once
// its ref expires on WhatsApp's servers the phone answers any scan with
// "Couldn't log in. Check your phone's internet connection and scan the QR code
// again." — identical on every device, because the code, not the phone, is
// dead. AstraLink used to hand out `the last QR it ever saw` forever, so a page
// left open for a minute guaranteed that dialog. Codes now carry an issue time
// and a sequence number, and a dead one is refused rather than displayed.
// Push #62: this must match Baileys' REAL QR lifetime. With no qrTimeout, Baileys
// lets the FIRST pairing QR live 60s but every QR after that only 20s — presenting
// a 20s code as valid for 60s is what sends users to scan a dead ref, which is
// exactly WhatsApp's "Couldn't log in… scan the QR code again". Default 20s, clamped.
const QR_VALID_MS = Math.min(60000, Math.max(15000, Number(process.env.ASTRALINK_QR_TTL_MS) || 20000));
let _qrSeq = 0;
const _qrKickAt = {};   // personality -> last time we restarted a pairing for a dead code

// A real pairing ref looks like: 2@<field>,<field>,... — the field count
// varies by protocol version (3 parts pre-2026, 5 parts observed 2026-09-18).
// Sep 2026 change: WhatsApp hands the ref inside a URL —
// https://wa.me/settings/linked_devices#2@... — ref in the #fragment.
// Validate prefix/charset only; ALWAYS render the ORIGINAL full payload so
// the phone scanner sees exactly what WhatsApp's servers issued.
function isPlausibleQr(qr) {
  if (typeof qr !== 'string') return false;
  let ref = qr;
  if (qr.startsWith('https://wa.me/')) {
    const hash = qr.indexOf('#');
    if (hash === -1) return false;
    ref = qr.slice(hash + 1);
  }
  return /^2@[A-Za-z0-9+/=,]+$/.test(ref) && ref.length > 40;
}


// ── Push #63: WhatsApp version lookup that CANNOT stall pairing ────────────
// connectBot used to do `await fetchLatestBaileysVersion()` with no timeout,
// no cache and no fallback. Baileys implements that as a bare fetch to
// raw.githubusercontent.com — when GitHub stalls from this box, connectBot
// hung FOREVER before the socket was even created: session stuck at
// "starting", page stuck on "opening a pairing session…", no QR, no 403,
// no error — and every retry re-hit the same hang. Pairing could silently
// never even try. Now: 6h cache, hard 8s timeout, then the version bundled
// with the installed Baileys build. Pairing always proceeds.
let _waVersion = null, _waVersionAt = 0;
const WA_VERSION_TTL_MS = 6 * 3600000;
function _bundledWaVersion() {
  // The Baileys build ships the exact WA version it was tested against in
  // lib/Defaults/index.js (`const version = [2, 3000, ...]`). Prefer it over
  // any hard-coded guess.
  try {
    const f = require.resolve('@whiskeysockets/baileys/lib/Defaults/index.js');
    const m = fs.readFileSync(f, 'utf8').match(/const version = \[(\d+),\s*(\d+),\s*(\d+)\]/);
    if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
  } catch (e) {}
  return [2, 3000, 1023601545];
}
function _waVersionTestReset() { _waVersion = null; _waVersionAt = 0; }
async function getWaVersion() {
  if (_waVersion && Date.now() - _waVersionAt < WA_VERSION_TTL_MS) return _waVersion;
  try {
    const { version } = await Promise.race([
      fetchLatestBaileysVersion(),
      new Promise((_, rej) => {
        const t = setTimeout(() => rej(new Error('WA version fetch timed out (8s)')), 8000);
        if (t.unref) t.unref();
      }),
    ]);
    _waVersion = version; _waVersionAt = Date.now();
    return version;
  } catch (e) {
    if (_waVersion) {
      console.warn(`⚠️ AstraLink: ${e.message} — using cached WA version ${_waVersion.join('.')}`);
      return _waVersion;
    }
    const v = _bundledWaVersion();
    console.warn(`⚠️ AstraLink: ${e.message} — no cache, using the version bundled with this Baileys build: ${v.join('.')}`);
    return v;
  }
}

// IDs of messages OUR OWN sockets sent (all personalities, this process).
// WhatsApp echoes sibling-bot messages back to us with fromMe=false, so this
// registry is the bulletproof sibling-recognition layer: no JID matching,
// no LID/PN ambiguity — if we sent it, we ignore it.
const _sentIds = new Map(); // id -> timestamp
function _recordSentId(id) {
  if (!id) return;
  try {
    _sentIds.set(String(id), Date.now());
    if (_sentIds.size > 3000) {
      const cutoff = Date.now() - 10 * 60 * 1000;
      for (const [k, t] of _sentIds) {
        if (t < cutoff) _sentIds.delete(k);
        if (_sentIds.size <= 2000) break;
      }
    }
  } catch (e) {}
}
function _wasSentByUs(id) {
  if (!id) return false;
  try {
    const t = _sentIds.get(String(id));
    if (!t) return false;
    if (Date.now() - t > 10 * 60 * 1000) { _sentIds.delete(String(id)); return false; }
    return true;
  } catch (e) { return false; }
}
const reconnectAttempts = {};
const _bootParams = {};   // personalityKey -> { authDir, getDatabase, saveDatabase, options }
const _connecting = new Set(); // keys with a connect already in flight
const _loggedOut = new Set();  // keys WhatsApp logged out (need manual relink — never auto-reconnect)
const _startInflight = new Set(); // keys mid-startAstraLink (single-flight guard)
// Push #55: every socket gets a generation number for its personality. A
// superseded socket's `close` event used to fall into the shared handler and
// `delete botSockets[personalityKey]` — i.e. the zombie unregistered the LIVE
// socket, leaving a connected-but-unroutable bot (silent groups, /switch
// dead, reconnect churn). Superseded sockets now ignore their own events.
const _socketGen = Object.create(null);

// ═══════════════════════════════════════════════════════════════
// Push #55 — is a bot ACTUALLY usable, or just "connected"?
//
// This is what made whole groups go silent. Routing decisions (which bot
// answers a group, who owns /switch) trusted `socket.user.id`, which Baileys
// keeps populated after the account is blocked, rate-limited, or the websocket
// has quietly died. So one zombie bot owned every group in the process and
// nobody answered — and /switch, the escape hatch, was also owned by that
// zombie (only the mentioned bot handles it), so the group could not even
// recover itself.
//
// Usability now means: a live socket, an open websocket, and sends that
// actually land. Failures are counted per bot and a bot with a run of failed
// sends is skipped until it proves itself again.
// ═══════════════════════════════════════════════════════════════
const _sendHealth = Object.create(null); // key -> { fail, lastFailAt, lastOkAt, lastErr }
const SEND_FAIL_THRESHOLD = Number(process.env.BOT_SEND_FAIL_THRESHOLD || 3);
const SEND_COOLDOWN_MS    = Number(process.env.BOT_SEND_COOLDOWN_MS || 90 * 1000);
const STALL_SCAN_MS       = Number(process.env.BOT_STALL_SCAN_MS || 45 * 1000);
const STALL_KILL_MS       = Number(process.env.BOT_STALL_KILL_MS || 4 * 60 * 1000);

function markSendResult(key, ok, err) {
  if (!key) return;
  const h = _sendHealth[key] || (_sendHealth[key] = { fail: 0, lastFailAt: 0, lastOkAt: 0, lastErr: null });
  if (ok) { h.fail = 0; h.lastOkAt = Date.now(); h.lastErr = null; return; }
  const m = String(err?.message || err || '');
  // Push #74: rate-overlimit / timeouts are TRANSIENT — they must never mark a
  // healthy bot "unusable" (that is what handed groups to the wrong bot).
  if (/rate|overlimit|timed? ?out|429/i.test(m)) return;
  h.fail = (h.fail || 0) + 1;
  h.lastFailAt = Date.now();
  h.lastErr = m.slice(0, 160);
}

function _wsReady(key) {
  const s = botSockets[key];
  if (!s) return false;
  try {
    const rs = s.ws?.readyState;
    if (rs != null) return rs === 1; // WebSocket.OPEN
    const st = s.connectionState?.connection;
    if (st) return st === 'open';
    return true; // no introspection available — trust user.id as before
  } catch (e) { return true; }
}

function isBotUsable(key) {
  const s = botSockets[key];
  if (!s || !s.user?.id) return false;
  if (_loggedOut.has(key)) return false;
  if (!_wsReady(key)) return false;
  const h = _sendHealth[key];
  if (h && h.fail >= SEND_FAIL_THRESHOLD && (Date.now() - (h.lastFailAt || 0)) < SEND_COOLDOWN_MS) return false;
  return true;
}

/**
 * How long to wait before retrying a closed socket — and when to admit a retry
 * cannot help. (Push #59, written from production: three bot numbers were
 * reconnecting every 30 seconds for hours against `403 forbidden`, which is
 * WhatsApp saying the ACCOUNT is blocked. No QR code, no re-pair and no number of
 * retries fixes that, and the hammering only digs the block deeper.)
 */
const RECONNECT_MAX_MS = Math.min(6 * 3600000, Number(process.env.BOT_RECONNECT_MAX_MS || 300000) || 300000);
function reconnectPolicy({ code, attempt, restartRequired }) {
  const n = Math.max(1, Number(attempt) || 1);
  const label = (ms) => (ms < 60000 ? `${Math.max(1, Math.round(ms / 1000))}s` : `${Math.round(ms / 60000)} min`);
  // Push #74: the 403 "account blocked" back-off system is SCRAPPED. A 403 is
  // now a normal close: same short backoff as any other code, re-pairs normally.
  if (restartRequired) return { blocked: false, backoffMs: 1200, backoffLabel: label(1200) };
  const backoffMs = Math.min(RECONNECT_MAX_MS, n * 2000 + 1000);
  return { blocked: false, backoffMs, backoffLabel: label(backoffMs) };
}

function botHealthReport() {
  return Object.keys(botSockets).sort().map(k => ({
    key: k,
    online: !!botSockets[k]?.user?.id,
    usable: isBotUsable(k),
    wsOpen: _wsReady(k),
    lastInboundAgoSec: _lastInboundAt[k] ? Math.round((Date.now() - _lastInboundAt[k]) / 1000) : null,
    deafRecycles: _deafRecycles[k] || 0,
    sendFails: _sendHealth[k]?.fail || 0,
    lastErr: _sendHealth[k]?.lastErr || null,
    lastOkAt: _sendHealth[k]?.lastOkAt || 0,
  }));
}

// A half-dead socket is worse than a dead one: it holds the groups and answers
// nothing. If a bot has had no successful send and no inbound traffic for
// STALL_KILL_MS while its websocket looks open, end() it so Baileys reconnects.
let _stallSweeper = null;
function startStallSweeper(ctx) {
  if (_stallSweeper) return;
  _stallSweeper = setInterval(() => {
    try {
      for (const key of Object.keys(botSockets)) {
        const s = botSockets[key];
        if (!s || !s.user?.id || _loggedOut.has(key)) continue;
        const h = _sendHealth[key] || {};
        const lastOk = Math.max(h.lastOkAt || 0, key === '_lastRecv' ? 0 : 0);
        const idle = Date.now() - (lastOk || (h.firstSeenAt || 0));
        if (lastOk && idle > STALL_KILL_MS && _wsReady(key)) {
          console.log(`🩺 AstraLink [${key}] no successful send for ${Math.round(idle / 1000)}s — forcing a reconnect of the stalled socket`);
          try { s.ev?.removeAllListeners?.(); } catch (e) {}
          try { s.end(new Error('stalled')); } catch (e) {}
          try { delete botSockets[key]; } catch (e) {}
          _scheduleReconnect(key, 2500, 'stalled socket recycled');
          _sendHealth[key] = { fail: 0, lastFailAt: 0, lastOkAt: 0, lastErr: null };
        } else if (!lastOk && !h.firstSeenAt) {
          (_sendHealth[key] = h).firstSeenAt = Date.now();
        }
      }
    } catch (e) { console.error('stall sweeper error:', e.message); }
  }, STALL_SCAN_MS);
  try { _stallSweeper.unref?.(); } catch (e) {}
}

// ═══════════════════════════════════════════════════════════════
// Push #86 — DEAF-SOCKET DETECTOR (replaces the Push #85 storm watchdog)
// Three distinct silent-bot modes were observed live on 09-21:
//   A) received:0 forever  — every inbound fails "Bad MAC"; sends still work.
//   B) received:659, handled:0 — inbound arrives but 20–35 min LATE and the
//      stale guard drops it all (socket alive, replay queue never catches up).
//   C) socket "open" but the server stopped delivering (no inbound at all,
//      no decrypt errors either).
// One rule covers all three: a connected bot that has produced NO fresh
// (< MAX_MSG_AGE_MS old) inbound for DEAF_AFTER_MS, while some OTHER bot has,
// is deaf. Recycle ONLY that socket (creds kept — never a re-scan). Signal
// sessions are NOT bulk-purged: Baileys rebuilds a bad per-contact session
// itself via retry receipts once retryRequestDelayMs stops starving it.
// After 3 recycles in a row with no recovery, purge session files as a last
// resort (still no re-scan).
// ═══════════════════════════════════════════════════════════════
const DEAF_AFTER_MS = Number(process.env.BOT_DEAF_AFTER_MS || 4 * 60 * 1000);
const DEAF_SCAN_MS = 30 * 1000;
let _badMacHits = [];
const _lastInboundAt = {};      // key -> ts of last FRESH inbound (decrypted, not stale)
const _lastOpenAt = {};         // key -> ts the current socket opened
const _lastStaleAt = {};        // key -> ts of last stale-dropped inbound (lagging socket)
const _deafRecycles = {};       // key -> consecutive recycles without recovery
const _deafHealAt = {};         // key -> ts of last recycle
function noteFreshInbound(key) { _lastInboundAt[key] = Date.now(); _deafRecycles[key] = 0; }
(function _hookLibsignalNoise() {
  try {
    const origErr = console.error.bind(console);
    console.error = (...args) => {
      try {
        const first = String(args[0] || '') + ' ' + String(args[1] || '');
        if (/Bad MAC|Failed to decrypt message with any known session|No matching sessions found|No session record/i.test(first)) {
          const now = Date.now();
          _badMacHits.push(now);
          if (_badMacHits.length > 500) _badMacHits = _badMacHits.slice(-300);
          if (_badMacHits.length % 100 !== 1) return;
          return origErr(`🔐 libsignal decrypt failures ×${_badMacHits.length} (Bad MAC) — per-contact sessions rebuilding via retry receipts`);
        }
      } catch (e) {}
      return origErr(...args);
    };
    const origLog = console.log.bind(console);
    console.log = (...args) => {
      try {
        const first = String(args[0] || '');
        if (/^(Closing session|Removing old closed session|Session error|SessionEntry)/.test(first)) return;
      } catch (e) {}
      return origLog(...args);
    };
    const origWarn = console.warn.bind(console);
    console.warn = (...args) => {
      try {
        const first = String(args[0] || '');
        if (/^(Closing open session in favor of incoming prekey bundle|Decrypted message with closed session)/.test(first)) return;
      } catch (e) {}
      return origWarn(...args);
    };
  } catch (e) {}
})();
function _purgeSignalSessions(authDir, key) {
  const dir = path.join(authDir, key);
  let n = 0;
  try {
    for (const f of fs.readdirSync(dir)) {
      if (/^(session|sender-key|sender-key-memory)-.*\.json$/.test(f)) { try { fs.rmSync(path.join(dir, f), { force: true }); n++; } catch (e) {} }
    }
  } catch (e) {}
  return n;
}
function recycleDeafSocket(key, why) {
  const bp = _bootParams[key];
  if (!bp) return false;
  const now = Date.now();
  if (now - (_deafHealAt[key] || 0) < DEAF_AFTER_MS) return false;
  _deafHealAt[key] = now;
  _deafRecycles[key] = (_deafRecycles[key] || 0) + 1;
  const n = _deafRecycles[key];
  const s = botSockets[key];
  console.warn(`🩹 AstraLink [${key}] deaf socket #${n} (${why}) — recycling connection (creds kept, no re-scan)`);
  try { s?.ev?.removeAllListeners?.(); } catch (e) {}
  try { s?.end?.(new Error('deaf-socket recycle')); } catch (e) {}
  try { delete botSockets[key]; } catch (e) {}
  if (n >= 3) {
    const purged = _purgeSignalSessions(bp.authDir, key);
    console.warn(`🧹 AstraLink [${key}] still deaf after ${n - 1} recycles — purged ${purged} Signal session file(s) as last resort (creds intact)`);
    _deafRecycles[key] = 0;
  }
  try { backupAuthToDisk(key, bp.authDir, { force: true }); } catch (e) {}
  _scheduleReconnect(key, 1500, 'deaf socket recycled');
  return true;
}
// Back-compat name used by index.js / restart.js exports.
function healBadMac(key, why) { return recycleDeafSocket(key, why || 'manual'); }
setInterval(() => {
  try {
    const now = Date.now();
    _badMacHits = _badMacHits.filter(t => now - t < 60 * 1000);
    const live = Object.keys(botSockets).filter(k => botSockets[k]?.user?.id && !_loggedOut.has(k));
    if (live.length < 2) return; // nothing to compare against — a quiet night is not deafness
    const anyoneHearing = live.some(k => now - (_lastInboundAt[k] || 0) < DEAF_AFTER_MS);
    if (!anyoneHearing) return; // whole fleet quiet → probably just no traffic
    for (const k of live) {
      const since = Math.max(_lastInboundAt[k] || 0, _lastOpenAt[k] || 0);
      if (now - since < DEAF_AFTER_MS) continue;
      const mins = Math.round((now - since) / 60000);
      const lagging = now - (_lastStaleAt[k] || 0) < DEAF_AFTER_MS;
      recycleDeafSocket(k, `${lagging ? 'only stale/late inbound' : 'no fresh inbound'} for ${mins} min while others hear (${_badMacHits.length} decrypt failures/min)`);
      break; // one per scan — never recycle the whole fleet at once
    }
  } catch (e) { console.error('deaf-socket detector error:', e.message); }
}, DEAF_SCAN_MS).unref?.();

// Push #74: /restart hooks — drop everything queued before the restart and
// reset per-group takeover state so groups answer through their own bot.
let _ignoreBeforeTs = 0;
function markRestart() {
  _ignoreBeforeTs = Date.now();
  try { for (const k of Object.keys(_deafRecycles)) _deafRecycles[k] = 0; for (const k of Object.keys(_deafHealAt)) _deafHealAt[k] = 0; } catch (e) {}
  try { _takeoverAt.clear(); } catch (e) {}
  for (const k of Object.keys(_sendHealth)) delete _sendHealth[k];
  return _ignoreBeforeTs;
}
function clearSendHealth(key) {
  if (key) { delete _sendHealth[key]; return; }
  for (const k of Object.keys(_sendHealth)) delete _sendHealth[k];
}

// ═══════════════════════════════════════════════════════════════
// Push #50 — stop a *losing* process from destroying a good session
//
// The old close handler treated every 401 as a real logout and then (a) deleted
// auth/<key>/ and (b) deleted db.authBackups[key] — i.e. it destroyed the live
// session AND the only recovery copy. On a redeploy (Oracle: old container still
// connected while the new one starts) WhatsApp hands the 401 to whichever socket
// it is evicting, so the *stale* process could wipe the session the *healthy*
// process was still using. Next restart → "not linked", re-scan QR. Repeated
// restarts, "last active hours/days ago", and bots that stop responding all fit
// this: two processes fighting over one session.
//
// Fixes:
//   • a per-key lock file with a 90s heartbeat — only the lock HOLDER may take
//     destructive action on that session;
//   • a single 401 is no longer fatal: it needs creds to actually say
//     "not registered", or two consecutive 401s on fresh connections;
//   • the session is never *deleted* — it is quarantined (timestamped copy in
//     auth-quarantine/ + the db/disk backup kept), so a wrong call is reversible.
// ═══════════════════════════════════════════════════════════════
const _authLocks = new Map();          // key -> { pid, at }
const _logout401s = {};                // key -> consecutive unverified 401 count

/** Is a recoverable session copy still on hand (disk backup or db backup)? */
function _restoreAuthAvailable(authDir, key) {
  try {
    const f = path.join(_authBackupDir(authDir), key + '.json');
    if (fs.existsSync(f)) {
      const raw = JSON.parse(fs.readFileSync(f, 'utf8'));
      if (raw && raw.files && Object.keys(raw.files).length) return true;
    }
  } catch (e) {}
  return false;
}
const AUTH_LOCK_STALE_MS = 90_000;
const PRESENCE_INTERVAL_MS = 45_000;      // "I'm online" beat, per bot
const _presenceTimers = {};               // key -> interval

function _authLockFile(authDir, key) {
  return path.join(authDir, key, '.astra-owner.lock');
}

function _authLockAcquire(authDir, key) {
  const f = _authLockFile(authDir, key);
  const now = Date.now();
  try {
    fs.mkdirSync(path.dirname(f), { recursive: true });
    if (fs.existsSync(f)) {
      const st = fs.statSync(f);
      let holder = null;
      try { holder = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) {}
      const fresh = (now - st.mtimeMs) < AUTH_LOCK_STALE_MS;
      const mine = holder && holder.pid === process.pid;
      if (fresh && !mine) {
        // Another live process owns this session. We keep running (so AstraLink
        // still works) but we must not touch its credentials/backups.
        _authLocks.set(key, { pid: holder?.pid ?? 'other', at: now, owned: false });
        return false;
      }
    }
    fs.writeFileSync(f, JSON.stringify({ pid: process.pid, at: now }));
    _authLocks.set(key, { pid: process.pid, at: now, owned: true });
    return true;
  } catch (e) {
    // Locking is best-effort; a filesystem hiccup must not block a connect.
    _authLocks.set(key, { pid: process.pid, at: now, owned: true });
    return true;
  }
}

function _authLockTouch(authDir, key) {
  const st = _authLocks.get(key);
  if (!st || st.owned === false) return;
  try { fs.writeFileSync(_authLockFile(authDir, key), JSON.stringify({ pid: process.pid, at: Date.now() })); st.at = Date.now(); } catch (e) {}
}

function _authLockOwned(key) {
  const st = _authLocks.get(key);
  return !st || st.owned !== false;   // unknown → treat as ours (legacy path)
}

function _authQuarantine(authDir, key, reason) {
  // Preserve instead of delete: copy the session into auth-quarantine/, then
  // clear the live dir so Baileys can pair again if the logout is genuine.
  try {
    const botAuthDir = path.join(authDir, key);
    if (!fs.existsSync(botAuthDir)) return null;
    const qdir = path.join(authDir, '..', 'auth-quarantine');
    fs.mkdirSync(qdir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const files = {};
    (function walk(dir, base) {
      let entries; try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
      for (const e of entries) {
        const full = path.join(dir, e.name), rel = path.join(base, e.name);
        if (e.isDirectory()) walk(full, rel);
        else { try { files[rel] = fs.readFileSync(full).toString('base64'); } catch (e2) {} }
      }
    })(botAuthDir, '.');
    if (!Object.keys(files).length) return null;
    const out = path.join(qdir, `${key}-${stamp}.json`);
    fs.writeFileSync(out, JSON.stringify({ key, reason, at: Date.now(), files }));
    return out;
  } catch (e) {
    console.error(`⚠️ AstraLink [${key}] quarantine failed:`, e.message);
    return null;
  }
}
let hostBotKey = null;

// Single guarded reconnect path used by BOTH the close handler and the
// heartbeat monitor. Guards: logged-out keys, already-online keys, and
// in-flight connects (double-connecting one session causes 401 flaps).
function _scheduleReconnect(personalityKey, backoffMs, reason) {
  setTimeout(() => {
    try {
      if (_loggedOut.has(personalityKey)) return;
      if (botSockets[personalityKey]?.user?.id) return;
      if (_connecting.has(personalityKey)) return;
      const bp = _bootParams[personalityKey];
      if (!bp) return;
      _connecting.add(personalityKey);
      console.log(`📡 AstraLink [${personalityKey}] auto-reconnecting (${reason || 'dead socket'})…`);
      connectBot(personalityKey, bp.authDir, bp.getDatabase, bp.saveDatabase, bp.options)
        .catch(e => console.error(`❌ AstraLink [${personalityKey}] reconnect failed:`, e.message))
        .finally(() => _connecting.delete(personalityKey));
    } catch (e) {}
  }, Math.max(0, backoffMs || 2000));
}

function _credsRegistered(authDir, personalityKey) {
  try {
    const creds = JSON.parse(require('fs').readFileSync(require('path').join(authDir, personalityKey, 'creds.json'), 'utf8'));
    return !!(creds.registered || creds.me);
  } catch (_) { return false; }
}

function getFirstOnlineSocketKey() {
  // Push #55: prefer a bot whose sends actually land. A zombie that still
  // reports user.id must never be the default responder for every group.
  const online = Object.keys(botSockets).filter(k => !!botSockets[k]?.user?.id).sort();
  const usable = online.filter(isBotUsable);
  return usable[0] || online[0] || null;
}

function getFirstUsableSocketKey() {
  const usable = Object.keys(botSockets).filter(k => isBotUsable(k)).sort();
  return usable[0] || getFirstOnlineSocketKey();
}

/**
 * Which bot owns this chat right now. Falls over to another live bot when the
 * configured active bot is logged out, half-dead or failing to send — and
 * persists the takeover so all five sockets agree immediately instead of every
 * bot waiting for a bot that will never answer.
 */
const _takeoverAt = new Map(); // chatId -> when we last re-assigned it (no per-message writes)
const TAKEOVER_COOLDOWN_MS = 60 * 1000;

function resolveResponderKey(chatId, isGroup) {
  const raw = isGroup ? PersonalityManager.getActiveBot(chatId) : null;
  if (raw && isBotUsable(raw)) return raw;

  // Prefer a bot that is actually IN this group — a live bot that is not a
  // member cannot reply here, so promoting it would just move the silence.
  let present = [];
  try { present = (PersonalityManager.getPresentBots(chatId) || []).filter(isBotUsable); } catch (e) {}
  const alt = present.sort()[0] || getFirstUsableSocketKey();

  // Push #74: a stand-in answers TEMPORARILY only. The group's chosen bot is
  // never overwritten — the moment it is usable again it takes back over.
  // (Persisting the takeover is what left Mikasa "stuck" in other bots' GCs.)
  if (raw && present.length && !present.includes(raw) && (Date.now() - (_takeoverAt.get(chatId) || 0)) > TAKEOVER_COOLDOWN_MS) {
    _takeoverAt.set(chatId, Date.now());
    console.log(`🔀 [${chatId.split('@')[0]}] active bot ${raw} is not answering → answering via *${alt}* (temporary, not persisted)`);
  }
  if (!raw) return alt;              // group never picked a bot → first usable answers
  return present.length ? alt : null; // stand-in only if a usable bot is actually IN the group
  return alt;
}

function getHostSocket() {
  if (hostBotKey && botSockets[hostBotKey]?.user?.id) {
    return botSockets[hostBotKey];
  }
  const keys = Object.keys(botSockets).filter(k => !!botSockets[k]?.user?.id);
  if (keys.length > 0) {
    hostBotKey = keys[0];
    return botSockets[keys[0]];
  }
  hostBotKey = null;
  return null;
}

function getHostKey() {
  getHostSocket();
  return hostBotKey;
}

// ── DM routing (batch-33) ───────────────────────────────────────────
// Every bot answers its own DMs: a WhatsApp session only receives the
// messages sent to its own number, so the receiving socket always
// handles DM commands (previously only the first-connected "host" bot
// did — every other bot's DMs fell silent).
function shouldHandleDMCommand() {
  return true;
}
// Group chat still needs explicit address (mention/quote/name); a DM is
// inherently addressed to the receiving bot.
function isChatAddressed({ isGroup, isMentioned, isQuoted, nameInText }) {
  if (!isGroup) return true;
  return !!(isMentioned || isQuoted || nameInText);
}

// ── Batch-46: conversation window + /chatbot mute ────────────────────
// Bots used to reply ONLY when tagged every message, so follow-ups
// ("why?", "yes") met silence — conversations couldn't flow. Now, after
// the bot replies to someone, their follow-ups within 3 minutes are
// answered without tagging. Each bot reply extends the window.
const CHAT_WINDOW_MS = 3 * 60 * 1000;
const _chatWindows = new Map(); // chatId -> Map(sender -> lastBotReplyTs)
function _inChatWindow(chatId, sender) {
  try {
    const ts = _chatWindows.get(chatId)?.get(sender) || 0;
    return Date.now() - ts < CHAT_WINDOW_MS;
  } catch (_) { return false; }
}
function _touchChatWindow(chatId, sender) {
  try {
    if (!_chatWindows.get(chatId)) _chatWindows.set(chatId, new Map());
    _chatWindows.get(chatId).set(sender, Date.now());
  } catch (_) {}
}
// /chatbot off mutes chatter in a group (slash commands still work).
function isChatbotMuted(db, chatId) {
  // Push #27: chatbot defaults OFF — a group chats only after /chatbot on.
  try {
    if (chatId && !String(chatId).endsWith('@g.us')) return false; // DMs always chat
    return !(db && db.groupSettings && db.groupSettings[chatId]
      && db.groupSettings[chatId].chatbot === true);
  } catch (_) { return true; }
}
// ── Batch-37: LID-aware address checks ──────────────────────────────
// In LID-mode groups, mentions/quotes arrive as the bot's @lid while
// sock.user.id is the PN — full-JID compare never matched, so bots
// ignored tags AND replies. Compare bare numbers against BOTH ids.
function sameBareUser(a, b) {
  if (!a || !b) return false;
  const ba = String(a).split(':')[0].split('@')[0];
  const bb = String(b).split(':')[0].split('@')[0];
  return !!ba && ba === bb;
}
function isBotMentioned(mentionedJids, botJid, botLid) {
  return (mentionedJids || []).some((j) => sameBareUser(j, botJid) || sameBareUser(j, botLid));
}
function isBotQuoted(quotedParticipant, botJid, botLid) {
  if (!quotedParticipant) return false;
  return sameBareUser(quotedParticipant, botJid) || sameBareUser(quotedParticipant, botLid);
}

// ── Background WebSocket Heartbeat & Auto-Healing Monitor ──────
// NOTE: this used to just DELETE dead sockets and log "auto-healing" while
// reconnecting nothing — every silently-dropped socket stayed dead until a
// process restart, which is the "ALL commands ignored, bot looks up" outage.
// Now a reaped socket is genuinely resurrected via _scheduleReconnect.
setInterval(() => {
  for (const [key, sock] of Object.entries(botSockets)) {
    if (!sock || !sock.ws) continue;
    const isClosed = sock.ws.readyState === 2 || sock.ws.readyState === 3; // CLOSING or CLOSED
    if (isClosed) {
      console.warn(`⚠️ AstraLink [${key}] detected silent dead WebSocket. Reaping + resurrecting…`);
      try { sock.end?.(undefined); } catch (e) {}
      delete botSockets[key];
      if (_loggedOut.has(key)) continue; // needs manual relink, not a loop
      const bp = _bootParams[key];
      if (!bp) continue; // never booted through connectBot — nothing to restore
      if (!_credsRegistered(bp.authDir, key)) continue; // pairing flow owns it
      const attempt = (reconnectAttempts[key] || 0) + 1;
      reconnectAttempts[key] = attempt;
      _scheduleReconnect(key, Math.min(30000, attempt * 2000 + 1000), 'heartbeat reap');
    }
  }
}, 25000);

function getPairingSession(personalityKey) {
  return pairingSessions[personalityKey] || null;
}

function listPairingSessions() {
  return { ...pairingSessions };
}

function formatPairingCode(code) {
  if (!code) return null;
  const raw = String(code).replace(/[^A-Za-z0-9]/g, '');
  if (raw.length === 8) return `${raw.slice(0, 4)}-${raw.slice(4)}`;
  return String(code);
}

function persistLinkedBot(getDatabase, saveDatabase, personalityKey, sock, phoneNumber) {
  try {
    const db = getDatabase?.();
    if (!db) return;
    if (!db.linkedBots) db.linkedBots = {};
    const jid = sock?.user?.id || null;
    db.linkedBots[personalityKey] = {
      jid,
      phone: phoneNumber || null,
      linkedAt: Date.now(),
    };
    if (jid) {
      try { PersonalityManager.registerLinkedNumber(jid, personalityKey); } catch (e) {}
      const bare = jid.split(':')[0];
      if (bare && bare !== jid) {
        try { PersonalityManager.registerLinkedNumber(bare, personalityKey); } catch (e) {}
      }
    }
    saveDatabase?.();
  } catch (e) {
    console.error('persistLinkedBot error:', e.message);
  }
}

// ── PERSISTENT AUTH BACKUP (disk-based; Push #23) ─────────────────────
// History: backups used to be base64-embedded into database.authBackups
// (Mongo mirror). Baileys auth folders accumulate thousands of pre-key /
// session files, so the game DB ballooned past MongoDB's 16MB single-doc
// limit and EVERY save failed — the exact wipe vector. /data is a
// persistent volume now, so backups live on DISK next to the auth dir and
// never touch the game database.
const _authBackupAt = {}; // personalityKey -> last disk-backup timestamp
const AUTH_BACKUP_MIN_MS = 60 * 1000; // creds.update is hot — 1 backup/min max
function _authBackupDir(authDir) {
  return path.join(authDir, '..', 'auth-backups');
}
function _authBackupFile(authDir, personalityKey) {
  return path.join(_authBackupDir(authDir), personalityKey + '.json');
}
function backupAuthToDisk(personalityKey, authDir, opts = {}) {
  try {
    const now = Date.now();
    if (!opts.force && _authBackupAt[personalityKey] && (now - _authBackupAt[personalityKey]) < AUTH_BACKUP_MIN_MS) return;
    const botAuthDir = path.join(authDir, personalityKey);
    if (!fs.existsSync(botAuthDir)) return;
    const files = {};
    (function walk(dir, base) {
      let entries;
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
      for (const e of entries) {
        const full = path.join(dir, e.name);
        const rel = path.join(base, e.name);
        if (e.isDirectory()) walk(full, rel);
        else {
          try { files[rel] = fs.readFileSync(full).toString('base64'); } catch {}
        }
      }
    })(botAuthDir, '.');
    if (Object.keys(files).length === 0) return;
    fs.mkdirSync(_authBackupDir(authDir), { recursive: true });
    fs.writeFileSync(_authBackupFile(authDir, personalityKey), JSON.stringify({ files, updatedAt: now }));
    _authBackupAt[personalityKey] = now;
  } catch (e) {
    console.error('backupAuth error:', e.message);
  }
}
// Backwards-compatible alias (old 4-arg signature still accepted).
function backupAuthToDB(personalityKey, authDir) {
  return backupAuthToDisk(personalityKey, authDir);
}

function _restoreAuthFiles(botAuthDir, files) {
  let n = 0;
  fs.mkdirSync(botAuthDir, { recursive: true });
  for (const [rel, b64] of Object.entries(files || {})) {
    const full = path.join(botAuthDir, rel);
    try {
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, Buffer.from(b64, 'base64'));
      n++;
    } catch {}
  }
  return n;
}
function restoreAuth(personalityKey, authDir, getDatabase) {
  try {
    const botAuthDir = path.join(authDir, personalityKey);
    if (fs.existsSync(path.join(botAuthDir, 'creds.json'))) return false;
    // 1) Disk backup (current scheme).
    try {
      const f = _authBackupFile(authDir, personalityKey);
      if (fs.existsSync(f)) {
        const b = JSON.parse(fs.readFileSync(f, 'utf8'));
        if (b?.files && Object.keys(b.files).length > 0) {
          const n = _restoreAuthFiles(botAuthDir, b.files);
          console.log(`♻️  Restored auth for [${personalityKey}] from disk backup (${n} files)`);
          return true;
        }
      }
    } catch {}
    // 2) Legacy DB backup (one-time migration path for upgraders).
    try {
      const db = getDatabase?.();
      const backup = db?.authBackups?.[personalityKey];
      if (backup?.files && Object.keys(backup.files).length > 0) {
        const n = _restoreAuthFiles(botAuthDir, backup.files);
        console.log(`♻️  Restored auth for [${personalityKey}] from legacy DB backup (${n} files)`);
        return true;
      }
    } catch {}
    return false;
  } catch (e) {
    console.error('restoreAuth error:', e.message);
    return false;
  }
}
// Backwards-compatible alias.
const restoreAuthFromDB = restoreAuth;

async function startAstraLink(personalityKey, authDir, getDatabase, saveDatabase, options = {}) {
  const method = options.pairingMode === 'qr' ? 'qr' : 'code';
  const phoneNumber = (options.pairingPhone || '').replace(/[^0-9]/g, '');

  if (!PersonalityManager.getAllPersonalities().includes(personalityKey)) {
    return { success: false, error: `Unknown personality: ${personalityKey}` };
  }
  if (method === 'code' && (phoneNumber.length < 7 || phoneNumber.length > 15)) {
    return { success: false, error: 'Enter a valid WhatsApp number with country code' };
  }
  if (botSockets[personalityKey]?.user?.id && !options.pairingPhone && !options.forceRelink) {
    return { success: false, error: `${PersonalityManager.getDisplayName(personalityKey)} is already online.` };
  }

  // Push #55 — two bugs that made AstraLink QR codes "not work":
  //  (a) Every /api/qr poll that found no QR yet called startAstraLink again
  //      with forceRelink, which ENDED the socket that was mid-pairing and
  //      deleted its keys. The QR on screen belonged to a dead socket, so the
  //      scan never completed. A pairing already in flight is now reused.
  //  (b) end() left the old socket's listeners attached, so its close handler
  //      scheduled ANOTHER connectBot for the same personality. Two sockets on
  //      one number → WhatsApp kills the loser with 401 → the bot "unlinks
  //      itself", and the reconnect churn stalls every reply (this is the
  //      slowness). A superseded socket must ignore its own close event.
  const _ps = pairingSessions[personalityKey];
  const _inflight = _ps && ['starting', 'awaiting_qr', 'code_ready', 'connecting'].includes(_ps.status)
    && (Date.now() - (_ps.startedAt || 0)) < 5 * 60 * 1000;
  if (_inflight && !options.abandonSession) {
    return {
      success: true, reused: true, personality: personalityKey,
      method: _ps.method || method, hasQr: !!_ps.qr, hasCode: !!_ps.code, status: _ps.status,
    };
  }
  if (_startInflight.has(personalityKey)) {
    return { success: true, reused: true, personality: personalityKey, status: 'starting' };
  }
  _startInflight.add(personalityKey);
  try { setTimeout(() => _startInflight.delete(personalityKey), 10000).unref(); } catch (e) { _startInflight.delete(personalityKey); }
  // Push #74c: a fresh pairing CLEARS the logged-out flag. It was left set from
  // the unlink, so when the phone accepted the scan and WhatsApp sent 515
  // (restart required) the reconnect was refused ("never auto-reconnect a
  // logged-out key") — the phone waited, gave up, "Couldn't log in".
  _loggedOut.delete(personalityKey);
  _logout401s[personalityKey] = 0;
  reconnectAttempts[personalityKey] = 0;

  const botAuthDir = path.join(authDir, personalityKey);
  try {
    if (botSockets[personalityKey]) {
      // Push #55: drop the listeners FIRST so the dying socket cannot delete
      // or reconnect the replacement we are about to create.
      try { botSockets[personalityKey].ev?.removeAllListeners?.(); } catch (_) {}
      try { botSockets[personalityKey].end(undefined); } catch (_) {}
      delete botSockets[personalityKey];
    }
    // Push #57: release the outgoing session's device slot BEFORE its keys are
    // destroyed, otherwise the number accumulates orphaned linked devices (max 4)
    // and every future QR fails with "Couldn't log in".
    // Push #62: run it SEQUENTIALLY, capped, before the new pairing socket is
    // created. The old fire-and-forget version connected the old session in
    // PARALLEL with the new pairing — two live sessions for one number, and
    // WhatsApp kills the loser with 401. When the loser was the pairing socket,
    // the code being scanned died mid-scan ("Couldn't log in… scan again").
    // A number that is 403-blocked cannot complete a logout either, so skip
    // the wait for it and go straight to the (reported) blocked retry.
    try { await _releaseOldSlotBeforePairing(authDir, personalityKey); } catch (e) {}
    // Clear old un-registered session state so pre-keys match fresh pairing code
    if (fs.existsSync(botAuthDir)) fs.rmSync(botAuthDir, { recursive: true, force: true });
    // Also clear persisted backups (disk + legacy DB) so fresh pairing starts clean
    try {
      const db = getDatabase?.();
      if (db?.authBackups?.[personalityKey]) {
        delete db.authBackups[personalityKey];
        saveDatabase?.();
      }
      const bf = _authBackupFile(authDir, personalityKey);
      if (fs.existsSync(bf)) fs.rmSync(bf, { force: true });
      delete _authBackupAt[personalityKey];
      console.log(`🧹 Cleared persisted backup for [${personalityKey}] (fresh AstraLink)`);
    } catch {}
  } catch (_) {}

  pairingSessions[personalityKey] = {
    status: 'starting',
    method,
    phoneNumber: phoneNumber || null,
    code: null,
    qr: null,
    qrDataUrl: null,
    error: null,
    jid: null,
    startedAt: Date.now(),
  };

  connectBot(personalityKey, authDir, getDatabase, saveDatabase, {
    ...options,
    pairingMode: method,
    pairingPhone: phoneNumber || null,
  }).catch((err) => {
    pairingSessions[personalityKey] = {
      ...(pairingSessions[personalityKey] || {}),
      status: 'error',
      error: err.message,
    };
  });

  return { success: true, method, personality: personalityKey };
}

function getSocket(personalityKey) {
  return botSockets[personalityKey] || null;
}

function getPendingSocket(personalityKey) {
  return botSockets[personalityKey] || null;
}

/**
 * The QR the AstraLink page should show, with its remaining life.
 * `valid` is the part that matters: a code that exists but has expired, or that
 * belongs to a socket which is no longer alive, must NOT be rendered as if it
 * were scannable — that is precisely what produces WhatsApp's "Couldn't log in"
 * dialog on every device at once.
 */
function getLatestQr(personalityKey) {
  const session = pairingSessions[personalityKey];
  const sock = botSockets[personalityKey];
  const connected = !!sock?.user?.id;
  if (!session) {
    return { qr: null, dataUri: null, seq: 0, ageMs: null, expiresIn: 0, valid: false, status: 'idle', connected, waiting: false, ttlMs: QR_VALID_MS };
  }
  const ageMs = session.qrAt ? Date.now() - session.qrAt : null;
  const expiresIn = ageMs === null ? 0 : Math.max(0, QR_VALID_MS - ageMs);
  const waiting = !connected && !!sock;
  return {
    qr: session.qr || null,
    dataUri: session.qrDataUrl || null,
    seq: session.qrSeq || 0,
    ageMs,
    expiresIn,
    valid: !!session.qr && isPlausibleQr(session.qr) && expiresIn > 0 && waiting,
    expired: !!session.qr && expiresIn <= 0,
    status: session.status || (connected ? 'connected' : 'idle'),
    connected,
    waiting,
    socketAlive: !!sock,
    error: session.error || null,
    blocked: session.blocked || null,
    ttlMs: QR_VALID_MS,
  };
}

/**
 * Push #57: free a WhatsApp device slot.
 *
 * WhatsApp allows a number only four linked devices. AstraLink's relink deleted
 * the local keys without telling WhatsApp, so every "Link" click left an orphan
 * session holding a slot; once they pile up, *no* QR can complete on *any*
 * phone and the error is the "Couldn't log in" dialog. Best-effort logout with
 * the saved creds, which is the only thing that releases them.
 */
async function revokeSessionDir(authDir, key, opts = {}) {
  const timeoutMs = Math.max(6000, Number(opts.timeoutMs) || 25000);
  const dir = path.join(authDir || '', String(key || ''));
  let registered = false;
  try {
    const creds = JSON.parse(fs.readFileSync(path.join(dir, 'creds.json'), 'utf8'));
    registered = !!(creds.registered || creds.me);
  } catch (e) {
    return { ok: false, reason: 'no registered session on disk — nothing to release' };
  }
  if (!registered) return { ok: false, reason: 'the saved session was never registered — it holds no device slot' };

  let sock = null;
  try {
    const logger = pino({ level: 'silent' });
    const { state } = await useMultiFileAuthState(dir);
    const ver = { version: await getWaVersion() };
    sock = makeWASocket({
      logger,
      version: ver.version,
      browser: Browsers.macOS('Chrome'),
      auth: makeCacheableSignalKeyStore(state.creds, state.keys),
      printQRInTerminal: false,
    });
    let opened = false;
    sock.ev.on('connection.update', (u) => { if (u.connection === 'open') opened = true; });
    const waitUntil = Date.now() + Math.min(12000, timeoutMs);
    while (Date.now() < waitUntil && !opened) await new Promise(r => setTimeout(r, 250));
    if (!opened) {
      return { ok: false, reason: 'WhatsApp would not accept the saved session — unlink by hand: WhatsApp → Settings → Linked devices → log out everything' };
    }
    await Promise.race([
      sock.logout(),
      new Promise((_, rej) => { const t = setTimeout(() => rej(new Error('logout timed out')), timeoutMs); t.unref?.(); }),
    ]);
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
    return { ok: true, reason: 'logged the old session out on WhatsApp and cleared its local keys' };
  } catch (e) {
    return { ok: false, reason: `could not log the old session out: ${e.message}` };
  } finally {
    try { sock?.end?.(); } catch (e) {}
  }
}

async function _releaseOldSlotBeforePairing(authDir, personalityKey) {
  // Push #62: sequential, capped replacement of the old fire-and-forget
  // _revokeSnapshotAsync. Snapshot the creds, logout on the copy, and wait at
  // most CAP_MS — pairing must proceed whether the release succeeds or not.
  const CAP_MS = 12000;
  try {
    const dir = path.join(authDir, personalityKey);
    if (!fs.existsSync(path.join(dir, 'creds.json'))) return false;
    let registered = false;
    try {
      const c = JSON.parse(fs.readFileSync(path.join(dir, 'creds.json'), 'utf8'));
      registered = !!(c.registered || c.me?.id);
    } catch (e) {}
    if (!registered) return false;
    const snapRoot = path.join(authDir, '.revoke');
    const snap = path.join(snapRoot, `${personalityKey}-${Date.now()}`);
    fs.mkdirSync(snapRoot, { recursive: true });
    fs.cpSync(dir, snap, { recursive: true });
    const work = revokeSessionDir(snapRoot, path.basename(snap), { timeoutMs: CAP_MS })
      .then((r) => console.log(r.ok ? `🔌 AstraLink [${personalityKey}] released the old device slot (${r.reason})` : `ℹ️  AstraLink [${personalityKey}] old device slot not released: ${r.reason}`))
      .catch((e) => console.error(`AstraLink [${personalityKey}] slot release error:`, e.message));
    const cap = new Promise((res) => { const t = setTimeout(res, CAP_MS); if (t.unref) t.unref(); });
    await Promise.race([work, cap]);
    try { fs.rmSync(snap, { recursive: true, force: true }); } catch (e) {}
    return true;
  } catch (e) {
    console.error(`⚠️ AstraLink [${personalityKey}] could not stage the old session for logout:`, e.message);
    return false;
  }
}

function cleanJid(jid) {
  if (!jid || typeof jid !== 'string') return jid;
  const parts = jid.split('@');
  if (parts.length < 2) return jid;
  const bareUser = parts[0].split(':')[0];
  return `${bareUser}@${parts[1]}`;
}

function unwrapMessage(msg) {
  if (!msg || !msg.message) return null;
  let m = msg.message;
  while (m) {
    if (m.ephemeralMessage?.message) { m = m.ephemeralMessage.message; continue; }
    if (m.viewOnceMessage?.message) { m = m.viewOnceMessage.message; continue; }
    if (m.viewOnceMessageV2?.message) { m = m.viewOnceMessageV2.message; continue; }
    if (m.viewOnceMessageV2Extension?.message) { m = m.viewOnceMessageV2Extension.message; continue; }
    if (m.documentWithCaptionMessage?.message) { m = m.documentWithCaptionMessage.message; continue; }
    if (m.editedMessage?.message?.protocolMessage?.editedMessage) { m = m.editedMessage.message.protocolMessage.editedMessage; continue; }
    break;
  }
  return m;
}

function getAllSockets() {
  return { ...botSockets };
}

function _bootstrapDispatcher(personalityKey, chatId) {
  const active = PersonalityManager.getActiveBot(chatId);
  if (active && botSockets[active]?.user?.id) {
    return active === personalityKey;
  }

  const sockets = getAllSockets();
  const keys = Object.keys(sockets).filter(k => !!sockets[k]?.user?.id).sort();
  if (keys.length === 0) return false;

  // Deterministic SINGLE handler: first-online ONLY. (The old self-pick —
  // keys.includes(personalityKey) ? personalityKey : keys[0] — returned true
  // on EVERY socket, so every bot ran /switch, /bots, join notices, ...).
  if (keys[0] !== personalityKey) return false;
  try {
    PersonalityManager.activateBot(chatId, keys[0]);
  } catch (e) {}
  return true;
}

// Every known bot identity (PN id + LID + linked numbers), as bare numbers.
// Incoming senders arrive in EITHER form, so the sibling-bot guard must know both.
function _botBares() {
  const set = new Set();
  const add = (jid) => { if (jid) set.add(String(jid).split(':')[0].split('@')[0]); };
  for (const key of Object.keys(botSockets)) {
    const u = botSockets[key]?.user || {};
    add(u.id);
    add(u.lid);
  }
  try {
    for (const j of Object.keys(PersonalityManager.linkedNumbers || {})) add(j);
  } catch (e) {}
  return set;
}
function _isOwnBotNumber(bareNumber) {
  if (!bareNumber) return false;
  return _botBares().has(String(bareNumber).split(':')[0].split('@')[0]);
}

function getAnySocket() {
  const keys = Object.keys(botSockets);
  if (keys.length === 0) return null;
  return botSockets[keys[0]];
}

// Push #82: the full boot options (rpgCommandHandler, config, …) as index.js
// passes them. Bots started later via /link or the heartbeat used to get ONLY
// { pairingMode, forceRelink } → `options.rpgCommandHandler` was undefined →
// every command was silently skipped while AI chat still answered. That was
// the "mikasa/seraph chat but ignore /commands" bug.
let _bootOptionsFactory = null;
function setBootOptionsFactory(fn) { _bootOptionsFactory = typeof fn === 'function' ? fn : null; }
async function connectBot(personalityKey, authDir, getDatabase, saveDatabase, options = {}) {
  if (!(options && options.rpgCommandHandler) && _bootOptionsFactory) {
    try { options = { ...(_bootOptionsFactory(personalityKey) || {}), ...(options || {}) }; } catch (e) { console.error('bootOptionsFactory error:', e.message); }
  }
  // Remember how this key boots so the heartbeat can resurrect it.
  // Pairing intent is stripped: resurrection must never re-trigger pairing.
  try {
    const { pairingMode, pairingPhone, ...rest } = options || {};
    _bootParams[personalityKey] = { authDir, getDatabase, saveDatabase, options: rest };
  } catch (e) {}
  const botAuthDir = path.join(authDir, personalityKey);
  // Restore from backup if the volume/persistent FS lost auth files.
  // Push #50: take (or refuse) ownership of this session before touching it.
  const _weOwnAuth = _authLockAcquire(authDir, personalityKey);
  if (!_weOwnAuth) {
    console.warn(`⚠️ AstraLink [${personalityKey}] another live process already owns ${path.join(authDir, personalityKey)} — connecting in read-mostly mode: it will NOT clear or rewrite that session/backup. Finish the old process (deploy overlap) to take over cleanly.`);
  }
  try { restoreAuth(personalityKey, authDir, getDatabase); } catch {}
  fs.mkdirSync(botAuthDir, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(botAuthDir);
  // Push #63: version lookup that cannot hang pairing (cached / 8s timeout /
  // bundled-version fallback) — see getWaVersion() above.
  const version = await getWaVersion();

  const displayName = PersonalityManager.getDisplayName(personalityKey);

  const pairingMode  = options.pairingMode || null;
  const pairingPhone = (options.pairingPhone || '').replace(/[^0-9]/g, '') || null;

  const keyStore = typeof makeCacheableSignalKeyStore === 'function'
    ? makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
    : state.keys;

  startStallSweeper();
  _socketGen[personalityKey] = (_socketGen[personalityKey] || 0) + 1;
  const _myGen = _socketGen[personalityKey];
  const sock = makeWASocket({
    version,
    // Push #62: rotate the pairing QR exactly at the TTL we present to the page.
    // Without this the first code lives 60s, the rest 20s, and the countdown
    // advertised dead codes as scannable.
    qrTimeout: QR_VALID_MS,
    logger: pino({ level: 'silent' }),
    auth: {
      creds: state.creds,
      keys: keyStore,
    },
    browser: Browsers.ubuntu('Chrome'), // Standard official signature required for WhatsApp pairing code verification
    syncFullHistory: false,
    markOnlineOnConnect: false,        // Avoid presence stanzas during pairing
    generateHighQualityLinkPreview: false,
    keepAliveIntervalMs: 15_000,      // 15s WebSocket keep-alive ping for stability
    connectTimeoutMs: 60_000,         // 60s handshake timeout
    defaultQueryTimeoutMs: 60_000,    // 60s query timeout for stanzas
    // Push #86: retryRequestDelayMs is awaited INSIDE Baileys' retry mutex, so
    // 3000ms meant one failed decrypt blocked all other retry receipts for 3s.
    // In a busy group under a Bad-MAC storm the queue never drained and the
    // automatic Signal-session recreation (which needs retry #2+) never ran →
    // hinata/mikasa stayed deaf with received:0 while sends still worked.
    retryRequestDelayMs: 250,         // Baileys default
    maxMsgRetryCount: 5,              // Retry stanzas up to 5 times
    enableAutoSessionRecreation: true, // rebuild the per-contact session on retry #2 (explicit)
    enableRecentMessageCache: true,    // required for the retry manager above
    getMessage: async () => ({ conversation: '' }),
    // Identity patch — plain text/media sends need no wrapping; interactive
    // sends are built + MD-patched explicitly inside utils/buttons.
    patchMessageBeforeSending: (msg) => msg,
  });

  // ── Send wrapper: empty-guard + own-send registry ────────────────
  // Any text/caption payload that is empty (and carries no media or other
  // functional keys like delete/react/poll) is dropped + logged instead of
  // being sent as a blank message. Every successful send is ALSO recorded
  // so sibling sockets never process our own messages as user chat.
  try {
    const _rawSend = sock.sendMessage.bind(sock);
    sock.sendMessage = async (jid, content = {}, options = {}) => {
      try {
        const c = content || {};
        const keys = Object.keys(c);
        const _bufLen = (v) => {
          if (!v) return -1;
          if (typeof Buffer !== 'undefined' && Buffer.isBuffer(v)) return v.length;
          if (typeof Uint8Array !== 'undefined' && v instanceof Uint8Array) return v.length;
          return -1;
        };
        const _mediaVals = [c.image, c.video, c.audio, c.document, c.sticker, c.ptv];
        const hasMedia = _mediaVals.some((v) => !!v && _bufLen(v) !== 0);
        const hasEmptyMedia = _mediaVals.some((v) => !!v && _bufLen(v) === 0);
        // Envelope-only keys: content carrying ONLY these + blank text can
        // only render as an empty bubble. NOTE 'edit' is deliberately here —
        // an edit with empty text blanks the target message instead of being
        // caught. True functional keys (delete/react/poll/...) still pass.
        const functional = keys.some((k) => !['text', 'caption', 'conversation', 'mentions', 'footer', 'mimetype', 'edit', 'viewOnce', 'contextInfo', 'forwardingScore', 'isForwarded', 'ephemeralExpiration', 'disappearingMessagesInChat'].includes(k));
        // Hollow rich payloads (empty vcard / poll / location) also render blank.
        let hollow = false;
        if (c.contacts) {
          const _cl = (c.contacts && c.contacts.contacts) || [];
          hollow = !_cl.length || _cl.every((x) => !String((x && x.vcard) || '').trim());
        } else if (c.poll) {
          hollow = !String(c.poll.name || '').trim() || !((c.poll.values || []).filter((v) => String(v).trim()).length);
        } else if (c.location) {
          hollow = c.location.degreesLatitude == null || c.location.degreesLongitude == null;
        }
        // Zero-width/format chars are invisible — strip before the blank check.
        const _vis = (s) => String(s ?? '').replace(/[\u200b-\u200f\u2060-\u206f\ufeff\u061c]/g, '').trim();
        // Push #87: a text-only message must contain at least ONE letter or digit
        // (any script). Punctuation/emoji/frame-only bubbles are blocked too.
        const _hasLetter = (s) => /[\p{L}\p{N}]/u.test(_vis(s));
        if (hasEmptyMedia || hollow || (!hasMedia && !functional && !_hasLetter(c.text ?? c.caption ?? c.conversation ?? ''))) {
          console.error(`🚫 [${personalityKey}] blocked EMPTY send to ${jid} (empty text/caption, no media)`);
          return null;
        }
      } catch (e) {}
      // Push #74: a NON-ACTIVE bot must never post in a group that has its
      // own bot. Redirect to the group's bot (or a usable bot that is present)
      // — the message still lands, just from the right personality.
      try {
        if (String(jid || '').endsWith('@g.us') && !(options && options.asSelf) && !(content && (content.delete || content.react))) {
          const act = PersonalityManager.getActiveBot(jid);
          if (act && act !== personalityKey && isBotUsable(act) && botSockets[act]) {
            return await botSockets[act].sendMessage(jid, content, options);
          }
          if (!act) {
            let present = [];
            try { present = (PersonalityManager.getPresentBots(jid) || []); } catch (e) {}
            if (present.length && !present.includes(personalityKey)) {
              const alt = present.filter(isBotUsable).sort()[0];
              if (alt && botSockets[alt]) return await botSockets[alt].sendMessage(jid, content, options);
            }
          }
        }
      } catch (e) {}
      if (options && options.asSelf) { options = { ...options }; delete options.asSelf; }
      let _res;
      // Push #74: WhatsApp rate-overlimit is handled HERE, once, for every
      // send in the bot: back off and retry (1.5s → 3s → 6s → 12s); if it still
      // will not go, resolve SILENTLY — nothing about it ever reaches a chat.
      const _isRate = (e) => /rate-overlimit|overlimit|429/i.test(String(e && e.message || e || ''));
      const _delays = [2000, 4000, 8000, 16000, 30000];
      for (let _i = 0; ; _i++) {
        try {
          try { await _pace(personalityKey, jid); } catch (e) {}
          _res = await _rawSend(jid, content, options);
          try { markSendResult(personalityKey, true); } catch (e) {}
          break;
        } catch (e) {
          if (_isRate(e)) {
            if (_i < _delays.length) { await new Promise(r => setTimeout(r, _delays[_i])); continue; }
            console.warn(`⏳ [${personalityKey}] rate-overlimit persisted → dropped one send to ${jid} silently`);
            return { key: { remoteJid: jid, id: null, fromMe: true }, rateDropped: true };
          }
          // A failing send is the only reliable proof a "connected" bot is mute.
          try { markSendResult(personalityKey, false, e); } catch (__) {}
          throw e;
        }
      }
      try { _recordSentId(_res?.key?.id); } catch (e) {}
      return _res;
    };
  } catch (e) {}

  let pairingCodeRequested = false;

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      // Push #57: stamp the code so the page can refuse to show a dead one, and
      // keep the pairing socket alive. Push #62: Baileys now rotates a fresh ref
      // every QR_VALID_MS (default 20s, via the qrTimeout option), which is what
      // keeps the picture scannable — and matches the page's countdown.
      if (!isPlausibleQr(qr)) {
        console.error(`⚠️ AstraLink [${displayName}] received a malformed QR (len ${String(qr).length}) — ignoring it instead of rendering an unscannable box`);
      } else {
      pairingSessions[personalityKey] = {
        ...(pairingSessions[personalityKey] || {}),
        status: pairingMode === 'code' ? 'awaiting_code' : 'awaiting_qr',
        method: pairingMode || 'qr',
        qr,
        qrAt: Date.now(),
        qrSeq: ++_qrSeq,
        startedAt: pairingSessions[personalityKey]?.startedAt || Date.now(),
      };

      try {
        // Pure black on pure white: a tinted background (it used to be #7CFFD0)
        // costs contrast, and low-contrast QRs are a classic cause of a phone
        // "reading" the code and then rejecting it.
        pairingSessions[personalityKey].qrDataUrl = await QRCode.toDataURL(qr, {
          width: 420,
          margin: 2,
          errorCorrectionLevel: 'M',
          color: { dark: '#000000', light: '#ffffff' },
        });
      } catch (e) {
        console.error('QR encode error:', e.message);
      }

      // Push #64: the AstraLink web page is RETIRED — pairing QRs print in the
      // CONSOLE now (pm2 logs / Oracle terminal). The code rotates every
      // QR_VALID_MS, so make it unmistakable which one to scan.
      try {
        const termQr = await QRCode.toString(qr, { type: 'terminal', small: true, margin: 2 });
        console.log(`\n🔗 AstraLink [${displayName}] — PAIRING QR (screenshot this, then scan it with the bot's phone):\n   ⏱ a fresh one prints every ${Math.round(QR_VALID_MS / 1000)}s — ALWAYS scan the NEWEST one:\n${termQr}\n`);
      } catch (e) { console.error('Terminal QR render error:', e.message); }
      try { _pushQrToSubscribers(personalityKey, qr, pairingSessions[personalityKey].qrSeq).catch(() => {}); } catch (e) {}
      }

      if (pairingMode === 'code' && pairingPhone && !pairingCodeRequested && !sock.authState.creds.registered) {
        pairingCodeRequested = true;
        try {
          // Allow 3s for WebSocket key exchange to complete before issuing pairing code request
          await new Promise(r => setTimeout(r, 3000));
          console.log(`\n🛰️  AstraLink [${displayName}] requesting pairing code for +${pairingPhone}…`);
          const code = await sock.requestPairingCode(pairingPhone);
          const formatted = formatPairingCode(code);
          console.log(`✅ AstraLink [${displayName}] Pairing Code Generated: ${formatted}`);
          pairingSessions[personalityKey] = {
            ...pairingSessions[personalityKey],
            status: 'code_ready',
            method: 'code',
            phoneNumber: pairingPhone,
            code: formatted,
            error: null,
          };
        } catch (err) {
          pairingCodeRequested = false;
          console.error(`❌ AstraLink [${displayName}] Pairing code error:`, err.message);
          pairingSessions[personalityKey] = {
            ...(pairingSessions[personalityKey] || {}),
            status: 'error',
            error: err.message || 'Failed to issue pairing code',
          };
        }
      }
    }

    if (connection === 'close') {
      // Push #55: this event may belong to a socket we already replaced
      // (startAstraLink / a relink / /restart). Reacting to it used to delete
      // the CURRENT socket and schedule a second connect for the same number.
      if (_socketGen[personalityKey] !== _myGen) {
        console.log(`🧟 AstraLink [${displayName}] ignored a close event from a superseded socket (gen ${_myGen} vs live ${_socketGen[personalityKey]})`);
        try { sock.ev.removeAllListeners(); } catch (e) {}
        return;
      }
      const code = lastDisconnect?.error?.output?.statusCode;
      const isLoggedOut = code === DisconnectReason.loggedOut || code === 401;
      const restartRequired = code === DisconnectReason.restartRequired || code === 515;
      if (botSockets[personalityKey] === sock) delete botSockets[personalityKey];

      let credsRegistered = false;
      try {
        const creds = JSON.parse(fs.readFileSync(path.join(botAuthDir, 'creds.json'), 'utf8'));
        credsRegistered = !!(creds.registered || creds.me);
      } catch (_) {}

      if (!isLoggedOut) {
        const attempt = (reconnectAttempts[personalityKey] || 0) + 1;
        reconnectAttempts[personalityKey] = attempt;
        const policy = reconnectPolicy({ code, attempt, restartRequired });
        const backoffMs = policy.backoffMs;

        if ((pairingSessions[personalityKey] || {}).status === 'blocked') {
          delete pairingSessions[personalityKey].blocked;
          pairingSessions[personalityKey].status = 'connecting';
        }
        console.log(`📡 AstraLink [${displayName}] connection closed (code ${code || 'unknown'}). Reconnecting in ${policy.backoffLabel} (attempt #${attempt})…`);
        // Push #74b: people watching the QR in a DM must know the scanned code
        // just died (this is WhatsApp's "connection error" moment) and that a
        // fresh one follows — otherwise they keep scanning a dead image.
        try {
          const ps = pairingSessions[personalityKey];
          if (ps && ['awaiting_qr', 'starting'].includes(ps.status) && _qrSubscribers[personalityKey]?.length) {
            const why = restartRequired ? 'scan accepted — finishing the handshake' : `pairing socket dropped (code ${code || 'unknown'})`;
            for (const sub of _qrSubscribers[personalityKey]) {
              const sk = botSockets[sub.sockKey]?.user?.id ? botSockets[sub.sockKey] : botSockets[getFirstUsableSocketKey()];
              if (sk) sk.sendMessage(sub.jid, { text: restartRequired ? `⏳ ${displayName}: ${why}…` : `⚠️ ${displayName}: ${why}. Ignore the last QR — a new one arrives in a moment (or /stoplink).` }, { asSelf: true }).catch(() => {});
            }
          }
        } catch (e) {}

        const nextOpts = (credsRegistered || fs.existsSync(path.join(botAuthDir, 'creds.json')))
          ? { ...options, pairingMode: null, pairingPhone: null }
          : options;

        if (restartRequired) { _loggedOut.delete(personalityKey); _logout401s[personalityKey] = 0; }
        _scheduleReconnect(personalityKey, backoffMs, `close code ${code || 'unknown'}`);
      } else {
        // Push #50: a 401 alone is NOT proof of a real unlink. It is also what
        // WhatsApp sends to the *losing* socket when two processes hold the same
        // session (a redeploy overlap), and acting on it used to delete both the
        // session and its backup. So: need creds to actually say "not
        // registered", or a repeated 401 on a fresh connect — and only the lock
        // holder may touch credentials at all.
        _logout401s[personalityKey] = (_logout401s[personalityKey] || 0) + 1;
        const seen = _logout401s[personalityKey];
        const credsSayRegistered = credsRegistered;
        const weOwn = _authLockOwned(personalityKey);
        const proven = !credsSayRegistered && !_restoreAuthAvailable(authDir, personalityKey);
        const giveUp = weOwn && (proven || seen >= 2);

        if (!giveUp) {
          console.log(`🩹 AstraLink [${displayName}] got code ${code} (401/loggedOut) but creds still say registered (401 #${seen})${weOwn ? '' : ' and another process owns this session'} — NOT clearing the session. Reconnecting with the existing creds instead of forcing a re-pair.`);
          try {
            const db = getDatabase?.();
            if (db && !db.linkedBots?.[personalityKey] && credsSayRegistered) { /* keep the link record */ }
          } catch (e) {}
          _scheduleReconnect(personalityKey, Math.min(15000, seen * 3000 + 2000), `401 #${seen} (unverified logout)`);
          return;
        }

        console.log(`❌ AstraLink [${displayName}] logged out (code ${code}, creds not registered). Session quarantined for recovery — relink from AstraLink when ready.`);
        _loggedOut.add(personalityKey);
        reconnectAttempts[personalityKey] = 0;
        _logout401s[personalityKey] = 0;
        delete botSockets[personalityKey];
        if (hostBotKey === personalityKey) {
          hostBotKey = null;
        }

        // Preserve first, clear second — and the backups are kept, not deleted.
        const q = _authQuarantine(authDir, personalityKey, `close code ${code}`);
        if (q) console.log(`🗄️ AstraLink [${displayName}] session archived: ${q}`);
        try {
          if (fs.existsSync(botAuthDir)) {
            fs.rmSync(botAuthDir, { recursive: true, force: true });
            console.log(`🧹 Cleared logged-out session directory for [${displayName}] (${botAuthDir})`);
          }
        } catch (e) {
          console.error(`⚠️ Could not purge auth dir for [${displayName}]:`, e.message);
        }

        try {
          const db = getDatabase?.();
          if (db) {
            if (db.linkedBots?.[personalityKey]) delete db.linkedBots[personalityKey];
            // Push #50: db.authBackups[key] is DELIBERATELY KEPT. Deleting it was
            // what made an accidental/contested 401 unrecoverable.
            if (db.botActive) {
              for (const [cid, pKey] of Object.entries(db.botActive)) {
                if (pKey === personalityKey) delete db.botActive[cid];
              }
            }
            saveDatabase?.();
          }
        } catch (_) {}
      }
    } else if (connection === 'open') {
      try { _notifyLinkSubscribers(personalityKey, `✅ *${displayName}* is linked and online!`); } catch (e) {}
      // Push #77/#79: auto-sweep of untracked groups is OPT-IN (db.groupGuardAuto).
      // Owner runs /gcsweep to preview + leave strays.
      setTimeout(() => {
        try {
          if (botSockets[personalityKey] !== sock) return;
          if (!getDatabase().groupGuardAuto) return;
          require('../rpg/utils/GroupGuard').sweep(sock, getDatabase(), personalityKey)
            .then((r) => { if (r && r.left && r.left.length) console.log(`[GroupGuard] ${personalityKey} left ${r.left.length} untracked group(s)`); })
            .catch(() => {});
        } catch (e) {}
      }, 20000);
      reconnectAttempts[personalityKey] = 0; // Reset reconnect count on successful connection!
      _loggedOut.delete(personalityKey);
      _logout401s[personalityKey] = 0;        // a clean connect clears the 401 streak
      _authLockTouch(authDir, personalityKey);
      // Push #50: presence keepalive. Without an explicit "available" the number
      // drifts to "last active a few hours ago" in every client's contact view,
      // which is the visible half of the "bot went dead" report. Cheap, and it
      // also refreshes the auth lock so a healthy bot is never mistaken for idle.
      try {
        if (sock && typeof sock.sendPresenceAvailable === 'function') {
          sock.sendPresenceAvailable().catch(() => {});
          if (!_presenceTimers[personalityKey]) {
            const t = setInterval(() => {
              try {
                if (botSockets[personalityKey] !== sock) { clearInterval(t); delete _presenceTimers[personalityKey]; return; }
                sock.sendPresenceAvailable().catch(() => {});
                _authLockTouch(authDir, personalityKey);
              } catch (e) { clearInterval(t); delete _presenceTimers[personalityKey]; }
            }, PRESENCE_INTERVAL_MS);
            if (t.unref) t.unref();
            _presenceTimers[personalityKey] = t;
          }
        }
      } catch (e) {}
      botSockets[personalityKey] = sock;
      const jid = sock.user?.id || null;

      if (!hostBotKey || !botSockets[hostBotKey] || !botSockets[hostBotKey]?.user?.id) {
        hostBotKey = personalityKey;
        console.log(`🌟 AstraLink Host assigned to live bot: [${displayName}]`);
      }

      pairingSessions[personalityKey] = {
        ...(pairingSessions[personalityKey] || {}),
        status: 'connected',
        jid,
        error: null,
        code: pairingSessions[personalityKey]?.code || null,
      };
      persistLinkedBot(getDatabase, saveDatabase, personalityKey, sock, pairingPhone);
      _lastOpenAt[personalityKey] = Date.now(); // Push #86: deaf detector grace period starts now
      try { backupAuthToDisk(personalityKey, authDir, { force: true }); } catch {}
      console.log(`✅ AstraLink [${displayName}] connection VERIFIED & ACTIVE! (JID: ${jid})`);

      // Deliver pending restart completion notice if present in DB
      try {
        const db = getDatabase?.();
        if (db && db.pendingRestartNotice) {
          const { chatId, text } = db.pendingRestartNotice;
          delete db.pendingRestartNotice;
          if (saveDatabase) saveDatabase();
          setTimeout(() => {
            if (text && String(text).trim()) sock.sendMessage(chatId, { text }).catch(() => {}); // Push #28
          }, 1200);
        }
      } catch (e) {}
    }
  });

  sock.ev.on('creds.update', async (...args) => {
    try { await saveCreds(...args); } catch {}
    try { backupAuthToDisk(personalityKey, authDir); } catch {}
  });

  sock.ev.on('group-participants.update', async ({ id: chatId, participants, action }) => {
    if (action !== 'add' && action !== 'remove') return;
    // Push #77: if THIS bot was just added to an untracked group, leave.
    if (action === 'add') {
      try {
        const me = String(sock?.user?.id || '').split(':')[0].split('@')[0];
        const meLid = String(sock?.user?.lid || '').split(':')[0].split('@')[0];
        const addedMe = (participants || []).some((p) => { const b = String(typeof p === 'string' ? p : (p && (p.id || p.jid)) || '').split(':')[0].split('@')[0]; return b && (b === me || (meLid && b === meLid)); });
        if (addedMe) {
          const GG = require('../rpg/utils/GroupGuard');
          if (!GG.isAllowed(getDatabase(), chatId)) { setTimeout(() => GG.leaveIfUntracked(sock, getDatabase(), chatId, 'added').catch(() => {}), 3000); return; }
        }
      } catch (e) {}
    }

    // Push #87: Pro GC — remove non-eligible joiners (dispatcher bot only).
    if (action === 'add' && _bootstrapDispatcher(personalityKey, chatId)) {
      try { await require('../rpg/utils/ProGC').onParticipantsAdded(sock, getDatabase(), chatId, participants); } catch (e) {}
    }

    if (_bootstrapDispatcher(personalityKey, chatId)) {
      try {
        const { handleParticipantUpdate } = require('../rpg/utils/GroupNoticeManager');
        const db = getDatabase();
        await handleParticipantUpdate(sock, chatId, participants, action, db);
      } catch (e) {
        console.error('❌ GroupNotice error:', e.message);
      }
    }

    if (options.onGroupJoin) {
      try { await options.onGroupJoin(sock, personalityKey, chatId, participants, action); }
      catch (e) { console.error('❌ onGroupJoin error:', e.message); }
    }
  });

  // Push #78: INBOUND DISPATCH — the real "bot is silent" fix.
  // (1) Only messages[0] of each upsert was processed; WhatsApp batches several
  //     messages per upsert under load / after reconnect → the rest were lost.
  // (2) The command ran INSIDE the event callback; Baileys delivers upserts
  //     one after another, so one slow command (multi-part combat, paced
  //     sends) blocked every other chat's messages behind it. Under spam the
  //     backlog grew past MAX_MSG_AGE and got dropped → "silent to commands
  //     while spawns still arrive".
  // Now: every message is handled; each chat has its own serial queue (order
  // kept per chat), chats run in parallel, and a command is cut off after
  // CMD_TIMEOUT_MS so a hung one can never wedge the queue.
  const CMD_TIMEOUT_MS = Number(process.env.CMD_TIMEOUT_MS || 90 * 1000);
  const _chatQueues = new Map(); // chatId -> Promise tail
  let _inflightCmds = 0;
  // Push #80: inbound trace — /botstats shows where the last messages went.
  const _trace = (_inboundTrace[personalityKey] = _inboundTrace[personalityKey] || { received: 0, commands: 0, handled: 0, drops: {}, last: [] });
  const _dropped = (why, msg) => { _trace.drops[why] = (_trace.drops[why] || 0) + 1; _trace.last.push(`${new Date().toISOString().slice(11, 19)} ${String(msg?.key?.remoteJid || '').split('@')[0].slice(-6)} ✗ ${why}`); if (_trace.last.length > 12) _trace.last.shift(); };
  const _enqueueInbound = (msg) => {
    _trace.received++;
    const cid = String(msg?.key?.remoteJid || 'x');
    const prev = _chatQueues.get(cid) || Promise.resolve();
    const run = prev.then(async () => {
      _inflightCmds++;
      let timer;
      try {
        await Promise.race([
          _handleInbound(msg),
          new Promise((_, rej) => { timer = setTimeout(() => rej(new Error(`inbound handler timed out after ${CMD_TIMEOUT_MS / 1000}s`)), CMD_TIMEOUT_MS); }),
        ]);
      } catch (e) {
        console.error(`❌ [${displayName}] inbound error (${cid.split('@')[0]}):`, e && e.message);
      } finally { clearTimeout(timer); _inflightCmds--; }
    });
    _chatQueues.set(cid, run);
    run.finally(() => { if (_chatQueues.get(cid) === run) _chatQueues.delete(cid); }).catch(() => {});
  };
  sock.ev.on('messages.upsert', ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const m of (messages || [])) { if (m) _enqueueInbound(m); }
  });
  const _handleInbound = async (msg) => {
    // ── Group membership stubs (welcome/goodbye fallback) ──
    // Joins/leaves arrive here as stub messages even when the
    // group-participants.update event doesn't fire. Single-sender: the
    // dispatcher bot only; GroupNoticeManager dedups against the event path.
    if (msg.messageStubType && msg.key?.remoteJid?.endsWith('@g.us')) {
      try {
        const GNM = require('../rpg/utils/GroupNoticeManager');
        const stubAct = GNM.stubAction ? GNM.stubAction(msg.messageStubType) : null;
        if (stubAct) {
          const stubChat = msg.key.remoteJid;
          // Batch-36: v7 stub params are JSON strings (or objects) — pass
          // everything non-empty through; GroupNoticeManager normalizes.
          const params = (msg.messageStubParameters || []).filter((p) => p !== null && p !== undefined && String(p).length > 0);
          if (params.length && _bootstrapDispatcher(personalityKey, stubChat)) {
            await GNM.announceMembership(sock, stubChat, params, stubAct, getDatabase());
          }
          return; // membership stubs never flow to commands/AI
        }
      } catch (e) {}
    }
    if (!msg.message || msg.key.fromMe) { if (msg.message) _dropped('fromMe', msg); return; }
    // Own-send echo (a SIBLING bot's message arriving back): never process.
    if (msg.key?.id && _wasSentByUs(msg.key.id)) { _dropped('ownEcho', msg); return; }
    // Push #74: STALE BACKLOG GUARD. After a reconnect WhatsApp replays the
    // offline queue as fresh 'notify' upserts — the bot then re-answered
    // commands sent HOURS ago, slowly, while ignoring new ones. Anything older
    // than MAX_MSG_AGE_MS is dropped on the floor (never a command, never AI).
    try {
      const tsRaw = msg.messageTimestamp;
      let tsNum = 0;
      if (tsRaw && typeof tsRaw === 'object') tsNum = typeof tsRaw.toNumber === 'function' ? tsRaw.toNumber() : Number(tsRaw.low || 0);
      else tsNum = Number(tsRaw) || 0;
      const ts = tsNum > 1e12 ? tsNum : tsNum * 1000;
      // Only trust plausible stamps (after 2024) — never drop on a bad clock.
      if (ts > 1.7e12 && (Date.now() - ts > MAX_MSG_AGE_MS || ts < _ignoreBeforeTs)) {
        _staleDropped++; _dropped(`stale(${Math.round((Date.now() - ts) / 60000)}m)`, msg);
        if (_staleDropped % 25 === 1) console.log(`🕰️ [${personalityKey}] dropped stale message(s) from backlog (${Math.round((Date.now() - ts) / 60000)} min old, total ${_staleDropped})`);
        // Push #86: a socket that only ever delivers stale traffic is LAGGING
        // (server replay queue never catches up) — the deaf detector treats
        // it exactly like silence, because to players it is silence.
        _lastStaleAt[personalityKey] = Date.now();
        return;
      }
    } catch (e) {}

    noteFreshInbound(personalityKey); // Push #86: a decrypted, non-stale message = this socket hears

    // Unwrap Baileys message containers (ephemeralMessage, viewOnceMessage, documentWithCaptionMessage, editedMessage, etc.)
    const realMessage = unwrapMessage(msg);
    if (!realMessage) return;
    msg.message = realMessage;

    const rawRemoteJid = msg.key.remoteJid || '';
    const chatId   = cleanJid(rawRemoteJid);
    const isGroup  = chatId.endsWith('@g.us');

    const msgCtxInfo =
      msg.message?.extendedTextMessage?.contextInfo ||
      msg.message?.imageMessage?.contextInfo ||
      msg.message?.videoMessage?.contextInfo ||
      msg.message?.documentMessage?.contextInfo ||
      msg.message?.stickerMessage?.contextInfo ||
      msg.message?.buttonsResponseMessage?.contextInfo ||
      msg.message?.listResponseMessage?.contextInfo;

    const rawSender = isGroup
      ? (msg.key.participant || msg.participant || msgCtxInfo?.participant || chatId)
      : chatId;
    const sender = cleanJid(rawSender);

    if (isGroup) {
      if (!sender) return;
    } else {
      if (!sender?.endsWith('@s.whatsapp.net') && !sender?.endsWith('@lid')) return;
    }

    const messageText =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      msg.message.imageMessage?.caption ||
      msg.message.videoMessage?.caption ||
      msg.message.documentMessage?.caption ||
      msg.message.buttonsResponseMessage?.selectedButtonId ||
      msg.message.listResponseMessage?.singleSelectReply?.selectedRowId ||
      msg.message.templateButtonReplyMessage?.selectedId ||
      msg.message.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson && (()=>{ try { const p=JSON.parse(msg.message.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson); return p.id || p.display_text || ''; } catch{ return ''; } })() ||
      msg.message.buttonsResponseMessage?.selectedDisplayText ||
      '';

    const db = getDatabase();
    const bareSender = String(sender).split('@')[0];

    const config = readConfigCached();
    const isCommand = messageText.startsWith(config.prefix);

    // Sibling-bot loop prevention for non-command messages (e.g. AI chat).
    // Every sender form is checked — a sibling bot's message must NEVER be
    // treated as user chat (the "Seraph poems at Kira's messages" bug).
    // NOTE: contextInfo.participant is NOT checked (that's the quoted author —
    // quoting a bot must not silence the user).
    if (!isCommand) {
      const _forms = [bareSender];
      try {
        if (msg.key?.participant) _forms.push(String(msg.key.participant).split(':')[0].split('@')[0]);
        if (msg.participant) _forms.push(String(msg.participant).split(':')[0].split('@')[0]);
      } catch (e) {}
      if (_forms.some(f => f && _isOwnBotNumber(f))) return;
    }

    const commandName = isCommand
      ? messageText.slice(config.prefix.length).trim().split(/\s+/)[0].toLowerCase()
      : '';

    // Mark this socket as present in the group
    if (isGroup) {
      try { PersonalityManager.markPresent(chatId, personalityKey); } catch (_) {}
    }

    const BOOTSTRAP_COMMANDS = new Set([
      'start', 'switch', 'stopbot', 'bots', 'setainame', 'hi',
      'link', 'unlink', 'help', 'menu', 'restart', 'groupstatus', 'gstatus', 'set', 'setgroup'
    ]);
    const isBootstrap = BOOTSTRAP_COMMANDS.has(commandName);

    // Active bot determination with strict /start and /switch handling
    // Push #55: the "active bot" is now whoever can ACTUALLY reply, not
    // whoever the mapping happens to name. See resolveResponderKey.
    const rawActiveKey = isGroup ? PersonalityManager.getActiveBot(chatId) : null;
    let responderKey = isGroup ? resolveResponderKey(chatId, true) : personalityKey;
    // Push #78: a socket that RECEIVED a group message is, by definition, in
    // that group and online. If the resolver picked a bot that is not present
    // here (fresh boot before markPresent filled in, or nobody present at all),
    // the lowest-key PRESENT usable socket answers instead — never silence.
    if (isGroup && isCommand) {
      try {
        let present = (PersonalityManager.getPresentBots(chatId) || []).filter(isBotUsable);
        if (!present.includes(personalityKey) && isBotUsable(personalityKey)) present.push(personalityKey);
        if (!responderKey || !present.includes(responderKey)) {
          const pick = (rawActiveKey && present.includes(rawActiveKey)) ? rawActiveKey : present.sort()[0];
          if (pick) responderKey = pick;
        }
      } catch (e) {}
    }
    const isOnlineActive = !!responderKey;
    const activeKey = responderKey;
    // Push #24: /stop means SILENCE (bootstrap commands still handled below so the group can be reactivated).
    const isStopped = isGroup && PersonalityManager.isStopped && PersonalityManager.isStopped(chatId);

    let isTargetMentionedBot = false;
    let resolvedTarget = null;
    let hasSwitchTarget = false;

    if (isGroup && isCommand && (commandName === 'switch' || commandName === 'start')) {
      const parts = messageText.slice(config.prefix.length).trim().split(/\s+/);
      const targetArg = parts[1];
      if (targetArg) {
        hasSwitchTarget = true;
        resolvedTarget = PersonalityManager.resolvePersonality(targetArg);
        const _onlineList = () => Object.keys(botSockets).filter(k=>botSockets[k]?.user?.id).sort().join(', ') || 'none';
        // EVERY socket runs this block, so every live bot sends the chorus.
        const _offlineChorus = async (why) => {
          // Push #55: one voice answers, not five (the chorus was 5 identical
          // messages per bad command AND 5 blocks of duplicated work per group
          // message — a real share of the "bot is slow" symptom).
          if (personalityKey !== getFirstUsableSocketKey()) return;
          try {
            await sock.sendMessage(chatId, {
              text: `🚫 *THAT BOT IS OFFLINE*\n\n${why}\nThe /${commandName} command couldn't be processed.\n\n📋 *Online bots:* ${_onlineList()}\n\nTry */bots* to see all personalities.`,
            }, { quoted: msg });
          } catch (e) { console.error('offline chorus fail:', e.message); }
        };
        if (!resolvedTarget) {
          // Invalid name → ALL live bots respond, command dies here.
          await _offlineChorus(`"${targetArg}" doesn't match any bot.`);
          return;
        }
        const targetSock = botSockets[resolvedTarget];
        // FIX: Use same online check as Online list (user?.id) to avoid false offline when ws.readyState flaps
        const isTargetOnline = !!targetSock?.user?.id;

        if (!isTargetOnline) {
          // Valid name but not linked/online → ALL live bots respond.
          await _offlineChorus(`*${resolvedTarget}* is offline / not linked.`);
          return;
        }

        // Mentioned target bot IS online -> ONLY mentioned bot handles this /start or /switch!
        // Push #55: normally the mentioned bot acknowledges its own /switch.
        // If that bot is half-dead (user.id set, sends never land) the switch
        // used to die with it — which is how a banned bot muted every group and
        // /switch could not rescue it. Now the responding bot performs the
        // switch instead, so the escape hatch never depends on the broken bot.
        isTargetMentionedBot = isBotUsable(resolvedTarget)
          ? (personalityKey === resolvedTarget)
          : (personalityKey === (responderKey || getFirstUsableSocketKey()));
      }
    }

    let isActive = false;
    if (!isGroup) {
      isActive = true;
    } else if (commandName === 'hi') {
      if (isStopped) {
        isActive = false;
      } else {
        // Push #74: /hi is answered by EVERY bot individually (each socket
        // handles its own greeting; botpersonality /hi is per-bot now).
        isActive = !!sock?.user?.id;
      }
    } else if (isCommand && (commandName === 'start' || commandName === 'switch')) {
      if (resolvedTarget) {
        isActive = isTargetMentionedBot;
      } else {
        const firstKey = getFirstOnlineSocketKey();
        isActive = isOnlineActive ? (personalityKey === activeKey) : (personalityKey === firstKey);
      }
    } else if (isCommand) {
      if (isStopped && !isBootstrap) {
        isActive = false;
      } else {
        // Failover is baked into activeKey now: a dead "active" bot can no
        // longer mute a group, and no second bot duplicates the reply.
        isActive = (personalityKey === (activeKey || getFirstUsableSocketKey()));
      }
    } else {
      // AI chat stays stricter than commands: only the group's OWN bot chats,
      // and only while it can actually send. A group that was never activated
      // must not start receiving replies from some other online bot — and a
      // group whose bot went quiet goes back to chat-only silence instead of
      // being adopted by a bot nobody asked for.
      isActive = !!(rawActiveKey && isBotUsable(rawActiveKey)) && (personalityKey === rawActiveKey);
    }

    if (isGroup) {
      try {
        const Mod = require('../rpg/utils/ModerationUtils');
        if (Mod.isGroupMuted(db, chatId, sender)) {
          if (isActive) {
            try { await sock.sendMessage(chatId, { delete: msg.key }); } catch (e) { /* best effort */ }
          }
          return;
        }
      } catch (e) { /* best effort */ }
    }

    // ── AFK MENTION OR REPLY CHECK (Active bot only) ───────────────────
    if (isGroup && isActive && db.afkUsers) {
      const contextInfo =
        msg.message?.extendedTextMessage?.contextInfo ||
        msg.message?.imageMessage?.contextInfo ||
        msg.message?.videoMessage?.contextInfo ||
        msg.message?.documentMessage?.contextInfo ||
        msg.message?.stickerMessage?.contextInfo;
      const mentionedAlso = [
        ...(contextInfo?.mentionedJid || []),
        ...(contextInfo?.participant ? [contextInfo.participant] : [])
      ];

      for (const mj of mentionedAlso) {
        const bareNumber = String(mj).split(':')[0].split('@')[0];
        const afkEntry = Object.entries(db.afkUsers).find(
          ([k, v]) => String(k).split(':')[0].split('@')[0] === bareNumber
        );
        if (!afkEntry) continue;
        const [, afk] = afkEntry;
        const totalSecs = Math.floor((Date.now() - (afk.since || Date.now())) / 1000);
        const hrs  = Math.floor(totalSecs / 3600);
        const mins = Math.floor((totalSecs % 3600) / 60);
        const secs = totalSecs % 60;
        let awayStr = '';
        if (hrs > 0)  awayStr += `${hrs}h `;
        awayStr += `${mins}m ${secs}s`;
        const afkMention = `@${bareNumber}`;
        try {
          await sock.sendMessage(chatId, {
            text:
              `⏳ ${afkMention} is AFK.` + String.fromCharCode(10) +
              `📝 Reason: ${afk.reason || 'AFK'}` + String.fromCharCode(10) +
              `🕒 Away:  ${awayStr}`,
            mentions: [String(mj)],
          }, { quoted: msg });
        } catch (e) { /* best effort */ }
      }
    }

    // ── AFK SELF WELCOME-BACK ──────────────────────────────────────────
    if (isGroup && isActive && db.afkUsers && db.afkUsers[sender]) {
      const afk = db.afkUsers[sender];
      const duration = Math.floor((Date.now() - (afk.since || Date.now())) / 60000);
      const mentionText = `@${sender.split('@')[0]}`;
      delete db.afkUsers[sender];
      try { saveDatabase(); } catch (e) {}
      try {
        await sock.sendMessage(chatId, {
          text:
            `👋 *Welcome back!* ${mentionText}` + String.fromCharCode(10) +
            `💤 You were AFK for ${duration} min(s).` + String.fromCharCode(10) +
            `📝 Reason: ${afk.reason || 'AFK'}`,
          mentions: [sender],
        }, { quoted: msg });
      } catch (e) { /* best effort */ }
    }

    // ── Push #74: /link <bot> from a DM — anyone with the LINK PASSWORD.
    // Flow: /link <bot> → bot asks for the password → user replies with it →
    // pairing starts and every fresh QR is sent INTO this DM as an image
    // (same QR that prints in the terminal).
    const _runLinkFlow = async (targetKey) => {
      const tName = PersonalityManager.getDisplayName(targetKey);
      if (botSockets[targetKey]?.user?.id) {
        try { await sock.sendMessage(chatId, { text: `✅ ${tName} is already linked and online — no QR needed.` }, { quoted: msg }); } catch (e) {}
        return;
      }
      subscribeQr(targetKey, personalityKey, chatId);
      const sess = pairingSessions[targetKey];
      const sinceLink = Date.now() - (_linkKickAt[targetKey] || 0);
      if (sinceLink < 30000 && sess && sess.qr && isPlausibleQr(sess.qr)) {
        try { await sock.sendMessage(chatId, { text: `🔗 Pairing for *${tName}* is already running — sending you its QR now.` }, { quoted: msg }); } catch (e) {}
        try { await _pushQrToSubscribers(targetKey, sess.qr, sess.qrSeq); } catch (e) {}
        return;
      }
      _linkKickAt[targetKey] = Date.now();
      try { await sock.sendMessage(chatId, { text: `🔗 Starting pairing for *${tName}*… the QR image arrives here in a few seconds (fresh one every ${Math.round(QR_VALID_MS / 1000)}s for 5 min).` }, { quoted: msg }); } catch (e) {}
      try {
        await startAstraLink(targetKey, authDir, getDatabase, saveDatabase, { pairingMode: 'qr', forceRelink: true });
      } catch (e) {
        console.error(`❌ /link [${targetKey}] failed:`, e.message);
        try { await sock.sendMessage(chatId, { text: `❌ Could not start pairing for ${tName}: ${e.message}` }, { quoted: msg }); } catch (_) {}
      }
    };
    if (!isGroup && _linkPending[sender] && !isCommand && messageText.trim()) {
      const pend = _linkPending[sender];
      delete _linkPending[sender];
      if (Date.now() - pend.at > 2 * 60 * 1000) {
        try { await sock.sendMessage(chatId, { text: '⏳ That /link request expired. Send /link <bot> again.' }, { quoted: msg }); } catch (e) {}
        return;
      }
      if (messageText.trim() !== LINK_PASSWORD) {
        try { await sock.sendMessage(chatId, { text: '❌ Wrong password.' }, { quoted: msg }); } catch (e) {}
        return;
      }
      await _runLinkFlow(pend.targetKey);
      return;
    }
    if (!isGroup && isCommand && (commandName === 'stoplink' || commandName === 'linkstop' || commandName === 'stopqr')) {
      const stopped = stopLink(chatId);
      try { await sock.sendMessage(chatId, { text: stopped.length
        ? `🛑 Stopped QR delivery for *${stopped.map(k => PersonalityManager.getDisplayName(k)).join(', ')}*. Send /link <bot> to start again.`
        : `ℹ️ No QR delivery was running for you.` }, { quoted: msg }); } catch (e) {}
      return;
    }
    if (!isGroup && isCommand && commandName === 'link') {
      const parts = messageText.slice(config.prefix.length).trim().split(/\s+/);
      const targetArg = (parts[1] || '').toLowerCase();
      if (!targetArg) {
        const list = PersonalityManager.getAllPersonalities().map(k => `/link ${k}`).join('  ');
        try { await sock.sendMessage(chatId, { text:
          `🔗 *Link a bot's number*\n\n${list}\n\nYou'll be asked for the link password, then the QR is sent to you here.`
        }, { quoted: msg }); } catch (e) {}
        return;
      }
      const targetKey = PersonalityManager.resolvePersonality(targetArg);
      if (!targetKey) {
        try { await sock.sendMessage(chatId, { text:
          `❓ "${targetArg}" doesn't match any bot. Available: ${PersonalityManager.getAllPersonalities().join(', ')}`
        }, { quoted: msg }); } catch (e) {}
        return;
      }
      // Password may be supplied inline: /link lunar <password>
      if (parts[2]) {
        if (parts.slice(2).join(' ') === LINK_PASSWORD) { await _runLinkFlow(targetKey); return; }
        try { await sock.sendMessage(chatId, { text: '❌ Wrong password.' }, { quoted: msg }); } catch (e) {}
        return;
      }
      _linkPending[sender] = { targetKey, at: Date.now() };
      try { await sock.sendMessage(chatId, { text: `🔐 Send the *link password* to receive the QR for *${PersonalityManager.getDisplayName(targetKey)}*.` }, { quoted: msg }); } catch (e) {}
      return;
    }

    // ── RPG Command handling ──────────────────────────────────────────
    if (isCommand && options.rpgCommandHandler) {
      _trace.commands++;
      // Push #75: spam limiter — only the socket that would answer evaluates it.
      try {
        const sc = _spamCheck(chatId, sender, messageText, isGroup, msg.key?.id);
        if (sc.block) {
          _dropped('spam', msg);
          if (sc.warn && (!isGroup || isActive)) {
            try { await sock.sendMessage(chatId, { text: '🐢 Slow down — one command at a time.' }, { quoted: msg }); } catch (e) {}
          }
          return;
        }
      } catch (e) {}
      let shouldHandle = false;
      if (isGroup) {
        // Targeted /switch + /start are handled by the mentioned bot ONLY —
        // the dispatcher must not hand them to the active/first bot as well.
        shouldHandle = isActive || (isBootstrap && !hasSwitchTarget && _bootstrapDispatcher(personalityKey, chatId));
      } else {
        // DM Handling: the receiving socket answers its own DMs.
        shouldHandle = shouldHandleDMCommand();
      }
      if (!shouldHandle) _dropped(isGroup ? `notActive(active=${activeKey || 'none'},present=${(() => { try { return (PersonalityManager.getPresentBots(chatId) || []).join('+') || 'none'; } catch (e) { return '?'; } })()})` : 'dmNotHandled', msg);
      if (shouldHandle) {
        _trace.handled++; _trace.last.push(`${new Date().toISOString().slice(11, 19)} ${String(chatId).split('@')[0].slice(-6)} ✓ ${commandName}`); if (_trace.last.length > 12) _trace.last.shift();
        try {
          await options.rpgCommandHandler(sock, msg, messageText, config, getDatabase, saveDatabase);
        } catch (e) {
          console.error(`❌ [${displayName}] command handler error:`, e.message);
          try {
            // Push #24: if our own socket is dead, a LIVE sibling reports the error (no silent failures).
            const _fbKey = getFirstOnlineSocketKey();
            const _fbSock = (_fbKey && botSockets[_fbKey]) || sock;
            await _fbSock.sendMessage(chatId, { text: `❌ Error: ${e.message}` }, { quoted: msg });
          } catch {}
        }
      }
      return;
    }

    if (messageText.trim().toLowerCase() === '!mp3') {
      if (isActive) {
        try {
          const { handleMp3Reply } = require('../commands/rpg/utility');
          await handleMp3Reply(sock, msg, chatId);
        } catch (e) { console.error('❌ !mp3 handler error:', e.message); }
      }
      return;
    }

    // ── AI Personality Chat (groups AND DMs — every bot answers its own DMs) ──
    if (isCommand) return;
    if (!messageText.trim()) return;

    if (isGroup && !isActive) return;

    if (isGroup) {
      try {
        const AstralGroups = require('../rpg/utils/AstralGroups');
        const g = AstralGroups.gate(getDatabase(), chatId);
        if (!g.allow) return;
      } catch (e) { /* best effort */ }
    }

    // ── Multi-message registration replies (DOB / referral code) ───
    // Active bot only, so exactly one bot consumes the reply.
    try {
      const RegCmd = require('../commands/rpg/register');
      if (RegCmd?.handlePlainReply) {
        const consumed = await RegCmd.handlePlainReply(sock, msg, chatId, sender, messageText, getDatabase, saveDatabase);
        if (consumed) return;
      }
    } catch (e) { console.error('registration reply error:', e.message); }

    // ── Numbered-menu replies (button replacement) ────────────────
    // Quote-reply with the number, or just send the number (2-min window).
    try {
      const TextMenu = require('../utils/textMenu');
      if (TextMenu?.resolve && /^\d{1,2}$/.test(messageText.trim()) && options.rpgCommandHandler) {
        const _ci = msg.message?.extendedTextMessage?.contextInfo || null;
        const sel = TextMenu.resolve(chatId, messageText.trim(), _ci?.stanzaId || null);
        if (sel && sel.command) {
          await options.rpgCommandHandler(sock, msg, sel.command, config, getDatabase, saveDatabase);
          return;
        }
      }
    } catch (e) { console.error('menu reply error:', e.message); }

    // ── Batch-47: Typing Race answers are plain chat from ANY player —
    // they must be checked BEFORE the addressed/mute gates below (a race
    // answer never tags the bot, so the old hook behind the chat gate
    // could never fire — races were unwinnable).
    try {
      const TR = require('../rpg/games/TypingRace');
      if (TR?.checkAnswer && TR.getSession(chatId)) {
        const win = TR.checkAnswer(getDatabase(), chatId, sender, messageText, saveDatabase);
        if (win && win.text) {
          await sock.sendMessage(chatId, { text: win.text, mentions: win.mention ? [win.mention] : [] }, { quoted: msg });
          return;
        }
      }
    } catch (e) { console.error('typerace hook error:', e.message); }

    const botDisplayName = PersonalityManager.getDisplayName(personalityKey);
    const botJid = sock.user?.id;

    const contextInfo =
      msg.message?.extendedTextMessage?.contextInfo ||
      msg.message?.imageMessage?.contextInfo ||
      msg.message?.videoMessage?.contextInfo ||
      msg.message?.documentMessage?.contextInfo ||
      msg.message?.stickerMessage?.contextInfo;
    const mentionedJids = contextInfo?.mentionedJid || [];
    const quotedParticipant = contextInfo?.participant;
    const botLid = sock.user?.lid || '';
    const isMentioned = isBotMentioned(mentionedJids, botJid, botLid);
    const isQuoted    = isBotQuoted(quotedParticipant, botJid, botLid);
    const nameInText  = messageText.toLowerCase().includes(botDisplayName.toLowerCase());

    // Batch-46: /chatbot off mutes chatter here (commands already returned above).
    try { if (typeof getDatabase === 'function' && isChatbotMuted(getDatabase(), chatId)) return; } catch (e) {}

    const inWindow = _inChatWindow(chatId, sender);
    if (!isChatAddressed({ isGroup, isMentioned, isQuoted, nameInText }) && !inWindow) return;

    try { await sock.sendPresenceUpdate('composing', chatId); } catch(e) {}

    const senderName = msg.pushName || sender.split('@')[0];
    try {
      const { text, attachment } = await AIHandler.generateResponse(
        chatId, personalityKey, messageText, senderName,
        sender, msg, getDatabase, saveDatabase
      );

      if (text && String(text).trim()) { // Push #28: silence blank chatter
        await sock.sendMessage(chatId, { text }, { quoted: msg });
      }

      if (attachment) {
        await sendAttachment(sock, chatId, attachment);
      }

      if ((text && String(text).trim()) || attachment) _touchChatWindow(chatId, sender); // Push #28

    } catch (err) {
      console.error(`❌ [${displayName}] AI error:`, err.message);
    }
    try { await sock.sendPresenceUpdate('paused', chatId); } catch(e) {}
  };

  return sock;
}

async function sendAttachment(sock, chatId, attachment, opts = {}) {
  if (!attachment) return;
  const isGroup = chatId?.endsWith?.('@g.us');

  const send = async (content) => {
    // Push #28: never emit blank text bubbles.
    if (content && typeof content.text === 'string' && !content.text.trim()) return;
    if (isGroup) return sock.sendMessage(chatId, content);
    return safeSendDM(sock, chatId, content, opts);
  };

  if (attachment.type === 'image' && attachment.buffer) {
    await send({ image: attachment.buffer, mimetype: 'image/jpeg' });
  } else if (attachment.type === 'audio' && attachment.buffer) {
    await send({
      audio: attachment.buffer,
      mimetype: 'audio/mpeg',
      fileName: attachment.fileName || 'audio.mp3',
      ptt: false,
    });
  } else if (attachment.type === 'lyrics') {
    await send({
      text: [
        `🎵 *${attachment.title}*`,
        attachment.artist ? `🎤 ${attachment.artist}` : null,
        ``,
        `🔗 ${attachment.url}`,
      ].filter(Boolean).join('\n'),
    });
  }
}

async function sendAs(personalityKey, chatId, content, opts = {}) {
  const isGroup = chatId?.endsWith?.('@g.us');
  if (isGroup) {
    const activeKey = PersonalityManager.getActiveBot(chatId);
    const targetKey = activeKey || personalityKey;
    const sock = (targetKey && isBotUsable(targetKey) ? botSockets[targetKey] : null) || getActiveSocket(chatId);
    if (sock) return sock.sendMessage(chatId, content);
    return { dropped: true, reason: 'no-socket' };
  }

  const db = opts.db || (typeof opts.getDatabase === 'function' ? opts.getDatabase() : null);
  let targetSock = botSockets[personalityKey];

  if (db && chatId) {
    const serfKey = SerfManager.getSerfBotKey(db, chatId);
    if (serfKey && botSockets[serfKey]) {
      targetSock = botSockets[serfKey];
    }
  }

  if (!targetSock) targetSock = getAnySocket();
  if (!targetSock) return { dropped: true, reason: 'no-socket' };

  return safeSendDM(targetSock, chatId, content, opts);
}

function canSendDM(db, playerJid, botJid, botKey) {
  if (!db || !playerJid) return { allowed: false, reason: 'no-db' };

  if (Perms.isBotMod(db, playerJid) || Perms.isBotOwner(db, playerJid)) {
    return { allowed: true, reason: 'privileged' };
  }

  const serfKey = SerfManager.getSerfBotKey(db, playerJid);
  if (!serfKey) {
    return { allowed: false, reason: 'no-serf' };
  }

  if (botKey && serfKey === botKey) {
    return { allowed: true, reason: 'serf-key' };
  }
  if (botJid && SerfManager.isJidPlayerSerf(db, playerJid, botJid)) {
    return { allowed: true, reason: 'serf-jid' };
  }

  return { allowed: false, reason: 'not-assigned-serf' };
}

async function safeSendDM(sock, playerJid, content, opts = {}) {
  // Push #28: never emit blank text bubbles.
  if (content && typeof content.text === 'string' && !content.text.trim()) {
    return { dropped: true, reason: 'empty-text' };
  }
  if (opts.welcome) {
    return sock.sendMessage(playerJid, content);
  }
  const db = opts.db || (typeof opts.getDatabase === 'function' ? opts.getDatabase() : null);

  if (!db || !playerJid) {
    return { dropped: true, reason: 'no-db' };
  }

  // Privileged check (Owners & Mods can receive DM alerts from active socket if needed)
  if (Perms.isBotMod(db, playerJid) || Perms.isBotOwner(db, playerJid)) {
    const serfKey = SerfManager.getSerfBotKey(db, playerJid);
    const targetSock = (serfKey && botSockets[serfKey]) ? botSockets[serfKey] : sock;
    return targetSock.sendMessage(playerJid, content);
  }

  const serfKey = SerfManager.getSerfBotKey(db, playerJid);
  if (!serfKey) {
    return {
      dropped: true,
      reason: 'no-serf',
      message: '⚠️ Set up a Serf using /setserf @bot to receive DM notifications!'
    };
  }

  // IRON WALL: If player HAS a Serf, ONLY that specific Serf socket can send the DM!
  const serfSock = botSockets[serfKey];
  if (!serfSock || !serfSock.user?.id) {
    // Serf bot is offline / banned — ABSOLUTELY NO OTHER BOT CAN DM!
    return {
      dropped: true,
      reason: 'serf-offline',
      message: `⚠️ Your assigned Serf (${serfKey}) is currently offline or unavailable.`
    };
  }

  return serfSock.sendMessage(playerJid, content);
}

async function sendHiChorus(chatId, responses, quotedMsg) {
  // Per-response isolation: one dead socket must NEVER abort the chorus or
  // cause duplicates — failures are collected and reported so the caller
  // can gap-fill ONLY the missing greetings. Never throws for send faults.
  const delivered = [];
  const failed = [];
  for (let i = 0; i < responses.length; i++) {
    const { personalityKey, displayName, text, attachment } = responses[i];
    try {
      const sock = botSockets[personalityKey];
      if (!sock || !sock.user?.id) { failed.push(personalityKey); continue; }

      const replyOpts = quotedMsg ? { quoted: quotedMsg, asSelf: true } : { asSelf: true };
      if (text && String(text).trim()) { // Push #28: silence blank chorus lines
        await sock.sendMessage(chatId, { text }, replyOpts);
      }

      if (attachment) {
        await sendAttachment(sock, chatId, attachment);
      }
      delivered.push(personalityKey);
    } catch (e) {
      console.error(`❌ sendHiChorus [${personalityKey}] failed:`, e.message);
      failed.push(personalityKey);
    }

    if (i < responses.length - 1) {
      await new Promise(r => setTimeout(r, 800));
    }
  }
  return { delivered, failed };
}

function getActiveSocket(chatId) {
  const PersonalityManager = require('./PersonalityManager');
  // Push #55: send through the active bot only when it can actually send.
  const activeKey = PersonalityManager.getActiveBot(chatId);
  if (activeKey && isBotUsable(activeKey)) return botSockets[activeKey];
  // Push #74: in a GROUP only a bot that is actually a member of that group
  // may stand in — never "any socket" (that is how a non-active bot ended up
  // posting in other bots' GCs).
  if (String(chatId || '').endsWith('@g.us')) {
    let present = [];
    try { present = (PersonalityManager.getPresentBots(chatId) || []).filter(isBotUsable).sort(); } catch (e) {}
    if (present.length) return botSockets[present[0]];
    if (activeKey && botSockets[activeKey]?.user?.id) return botSockets[activeKey];
    return null;
  }
  return getAnySocket();
}

module.exports = {
  _pace,
  getInboundTrace: () => _inboundTrace,
  connectBot,
  reconnectPolicy,
  RECONNECT_MAX_MS,
  startAstraLink,
  // Push #55: bot liveness / health
  isBotUsable,
  getFirstUsableSocketKey,
  botHealthReport,
  clearSendHealth, markRestart, stopLink,
  markSendResult,
  startStallSweeper,
  readConfigCached,
  getPairingSession,
  listPairingSessions,
  QR_VALID_MS,
  isPlausibleQr,
  // Push #63: WhatsApp version lookup (cached / 8s timeout / bundled fallback)
  getWaVersion,
  _bundledWaVersion,
  _waVersionTestReset,
  revokeSessionDir,
  getSocket,
  getPendingSocket,
  getLatestQr,
  getAllSockets,
  getAnySocket,
  getHostSocket,
  getHostKey,
  shouldHandleDMCommand,
  setBootOptionsFactory,
  healBadMac,
  isChatAddressed,
  isChatbotMuted,
  _inChatWindow,
  _touchChatWindow,
  isBotMentioned,
  isBotQuoted,
  sameBareUser,
  sendAs,
  sendHiChorus,
  sendAttachment,
  canSendDM,
  safeSendDM,
  getActiveSocket,
  // Push #47: defined internally (line ~99) but never exported, so the
  // offline-active-bot failover in handlers/rpgCommandHandler.js called
  // undefined → TypeError → swallowed by its empty catch. Groups stayed silent
  // when their active bot dropped instead of failing over.
  getFirstOnlineSocketKey,
  backupAuthToDisk, backupAuthToDB,
  restoreAuth, restoreAuthFromDB,
  _bootstrapDispatcher,
  _isOwnBotNumber,
  _recordSentId,
  _wasSentByUs,
  _sockets: () => botSockets,
  _pairing: () => pairingSessions,   // introspection/test hook
};
