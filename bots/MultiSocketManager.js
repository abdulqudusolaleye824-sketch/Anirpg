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
const QRTerminal = (()=>{ try { return require('qrcode-terminal'); } catch(e){ return null; } })();
// NOTE: native interactive buttons are back (utils/buttons) — relayed with the
// stanza nodes WhatsApp requires (biz/interactive + the DM bot node), so they
// render; numbered text menus (utils/textMenu) remain as automatic fallback.
// Tap-backs arrive as their button id (= a /command) and flow through the
// normal pipeline below — no separate dispatch needed.

const botSockets = {};
const pairingSessions = {};
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
  const keys = Object.keys(botSockets).filter(k => !!botSockets[k]?.user?.id).sort();
  return keys[0] || null;
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

// ── PERSISTENT AUTH BACKUP (fixes Railway redeploy wipe) ─────────────────
// Auth files live on ephemeral FS (auth/<bot>/). On Railway each redeploy
// wipes the container. We mirror every bot's auth folder into database
// (which is persisted via MongoDB) so a fresh container can restore it.
function backupAuthToDB(personalityKey, authDir, getDatabase, saveDatabase) {
  try {
    const db = getDatabase?.();
    if (!db) return;
    const botAuthDir = path.join(authDir, personalityKey);
    if (!fs.existsSync(botAuthDir)) return;
    if (!db.authBackups) db.authBackups = {};
    const files = {};
    function walk(dir, base) {
      let entries;
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
      for (const e of entries) {
        const full = path.join(dir, e.name);
        const rel = path.join(base, e.name);
        if (e.isDirectory()) walk(full, rel);
        else {
          try {
            const data = fs.readFileSync(full);
            files[rel] = data.toString('base64');
          } catch {}
        }
      }
    }
    walk(botAuthDir, '.');
    if (Object.keys(files).length === 0) return;
    db.authBackups[personalityKey] = { files, updatedAt: Date.now() };
    saveDatabase?.();
  } catch (e) {
    console.error('backupAuth error:', e.message);
  }
}

function restoreAuthFromDB(personalityKey, authDir, getDatabase) {
  try {
    const db = getDatabase?.();
    if (!db?.authBackups?.[personalityKey]) return false;
    const botAuthDir = path.join(authDir, personalityKey);
    if (fs.existsSync(path.join(botAuthDir, 'creds.json'))) return false;
    const backup = db.authBackups[personalityKey];
    if (!backup?.files || Object.keys(backup.files).length === 0) return false;
    fs.mkdirSync(botAuthDir, { recursive: true });
    for (const [rel, b64] of Object.entries(backup.files)) {
      const full = path.join(botAuthDir, rel);
      try {
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, Buffer.from(b64, 'base64'));
      } catch {}
    }
    console.log(`♻️  Restored auth for [${personalityKey}] from DB backup (${Object.keys(backup.files).length} files)`);
    return true;
  } catch (e) {
    console.error('restoreAuth error:', e.message);
    return false;
  }
}

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

  const botAuthDir = path.join(authDir, personalityKey);
  try {
    if (botSockets[personalityKey]) {
      try { botSockets[personalityKey].end(undefined); } catch (_) {}
      delete botSockets[personalityKey];
    }
    // Clear old un-registered session state so pre-keys match fresh pairing code
    if (fs.existsSync(botAuthDir)) fs.rmSync(botAuthDir, { recursive: true, force: true });
    // Also clear persisted backup so fresh pairing starts clean
    try {
      const db = getDatabase?.();
      if (db?.authBackups?.[personalityKey]) {
        delete db.authBackups[personalityKey];
        saveDatabase?.();
        console.log(`🧹 Cleared persisted backup for [${personalityKey}] (fresh AstraLink)`);
      }
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

function getLatestQr(personalityKey) {
  const session = pairingSessions[personalityKey];
  if (!session) return { qr: null, dataUri: null };
  return { qr: session.qr || null, dataUri: session.qrDataUrl || null };
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

async function connectBot(personalityKey, authDir, getDatabase, saveDatabase, options = {}) {
  // Remember how this key boots so the heartbeat can resurrect it.
  // Pairing intent is stripped: resurrection must never re-trigger pairing.
  try {
    const { pairingMode, pairingPhone, ...rest } = options || {};
    _bootParams[personalityKey] = { authDir, getDatabase, saveDatabase, options: rest };
  } catch (e) {}
  const botAuthDir = path.join(authDir, personalityKey);
  // Restore from DB backup if ephemeral FS was wiped (Railway redeploy fix)
  try { restoreAuthFromDB(personalityKey, authDir, getDatabase); } catch {}
  fs.mkdirSync(botAuthDir, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(botAuthDir);
  const { version } = await fetchLatestBaileysVersion();

  const displayName = PersonalityManager.getDisplayName(personalityKey);

  const pairingMode  = options.pairingMode || null;
  const pairingPhone = (options.pairingPhone || '').replace(/[^0-9]/g, '') || null;

  const keyStore = typeof makeCacheableSignalKeyStore === 'function'
    ? makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
    : state.keys;

  const sock = makeWASocket({
    version,
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
    retryRequestDelayMs: 3_000,       // Auto retry failed stanzas after 3s
    maxMsgRetryCount: 5,              // Retry stanzas up to 5 times
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
        if (hasEmptyMedia || hollow || (!hasMedia && !functional && !_vis(c.text ?? c.caption ?? c.conversation ?? ''))) {
          console.error(`🚫 [${personalityKey}] blocked EMPTY send to ${jid} (empty text/caption, no media)`);
          return null;
        }
      } catch (e) {}
      const _res = await _rawSend(jid, content, options);
      try { _recordSentId(_res?.key?.id); } catch (e) {}
      return _res;
    };
  } catch (e) {}

  let pairingCodeRequested = false;

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      pairingSessions[personalityKey] = {
        ...(pairingSessions[personalityKey] || {}),
        status: pairingMode === 'code' ? 'awaiting_code' : 'awaiting_qr',
        method: pairingMode || 'qr',
        qr,
        startedAt: pairingSessions[personalityKey]?.startedAt || Date.now(),
      };

      try {
        pairingSessions[personalityKey].qrDataUrl = await QRCode.toDataURL(qr, {
          width: 360,
          margin: 2,
          color: { dark: '#061018', light: '#7CFFD0' },
        });
      } catch (e) {
        console.error('QR encode error:', e.message);
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
      const code = lastDisconnect?.error?.output?.statusCode;
      const isLoggedOut = code === DisconnectReason.loggedOut || code === 401;
      const restartRequired = code === DisconnectReason.restartRequired || code === 515;
      delete botSockets[personalityKey];

      let credsRegistered = false;
      try {
        const creds = JSON.parse(fs.readFileSync(path.join(botAuthDir, 'creds.json'), 'utf8'));
        credsRegistered = !!(creds.registered || creds.me);
      } catch (_) {}

      if (!isLoggedOut) {
        const attempt = (reconnectAttempts[personalityKey] || 0) + 1;
        reconnectAttempts[personalityKey] = attempt;
        const backoffMs = restartRequired ? 1200 : Math.min(30000, attempt * 2000 + 1000);

        console.log(`📡 AstraLink [${displayName}] connection closed (code ${code || 'unknown'}). Reconnecting in ${Math.round(backoffMs / 1000)}s (attempt #${attempt})…`);

        const nextOpts = (credsRegistered || fs.existsSync(path.join(botAuthDir, 'creds.json')))
          ? { ...options, pairingMode: null, pairingPhone: null }
          : options;

        _scheduleReconnect(personalityKey, backoffMs, `close code ${code || 'unknown'}`);
      } else {
        console.log(`❌ AstraLink [${displayName}] connection permanently logged out (code ${code}). Session cleared — manual relink required.`);
        _loggedOut.add(personalityKey);
        reconnectAttempts[personalityKey] = 0;
        delete botSockets[personalityKey];
        if (hostBotKey === personalityKey) {
          hostBotKey = null;
        }

        try {
          if (fs.existsSync(botAuthDir)) {
            fs.rmSync(botAuthDir, { recursive: true, force: true });
            console.log(`🧹 Purged logged-out session directory for [${displayName}] (${botAuthDir})`);
          }
        } catch (e) {
          console.error(`⚠️ Could not purge auth dir for [${displayName}]:`, e.message);
        }

        try {
          const db = getDatabase?.();
          if (db) {
            if (db.linkedBots?.[personalityKey]) delete db.linkedBots[personalityKey];
            if (db.authBackups?.[personalityKey]) delete db.authBackups[personalityKey];
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
      reconnectAttempts[personalityKey] = 0; // Reset reconnect count on successful connection!
      _loggedOut.delete(personalityKey);
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
      try { backupAuthToDB(personalityKey, authDir, getDatabase, saveDatabase); } catch {}
      console.log(`✅ AstraLink [${displayName}] connection VERIFIED & ACTIVE! (JID: ${jid})`);

      // Deliver pending restart completion notice if present in DB
      try {
        const db = getDatabase?.();
        if (db && db.pendingRestartNotice) {
          const { chatId, text } = db.pendingRestartNotice;
          delete db.pendingRestartNotice;
          if (saveDatabase) saveDatabase();
          setTimeout(() => {
            sock.sendMessage(chatId, { text }).catch(() => {});
          }, 1200);
        }
      } catch (e) {}
    }
  });

  sock.ev.on('creds.update', async (...args) => {
    try { await saveCreds(...args); } catch {}
    try { backupAuthToDB(personalityKey, authDir, getDatabase, saveDatabase); } catch {}
  });

  sock.ev.on('group-participants.update', async ({ id: chatId, participants, action }) => {
    if (action !== 'add' && action !== 'remove') return;

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

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    const msg = messages[0];
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
          const params = (msg.messageStubParameters || []).filter((p) => typeof p === 'string' && p.includes('@'));
          if (params.length && _bootstrapDispatcher(personalityKey, stubChat)) {
            await GNM.announceMembership(sock, stubChat, params, stubAct, getDatabase());
          }
          return; // membership stubs never flow to commands/AI
        }
      } catch (e) {}
    }
    if (!msg.message || msg.key.fromMe) return;
    // Own-send echo (a SIBLING bot's message arriving back): never process.
    if (msg.key?.id && _wasSentByUs(msg.key.id)) return;

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

    const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf-8'));
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
    const rawActiveKey = isGroup ? PersonalityManager.getActiveBot(chatId) : null;
    const isOnlineActive = rawActiveKey && !!(botSockets[rawActiveKey]?.user?.id);
    const activeKey = isOnlineActive ? rawActiveKey : null;

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
        isTargetMentionedBot = (personalityKey === resolvedTarget);
      }
    }

    let isActive = false;
    if (!isGroup) {
      isActive = true;
    } else if (commandName === 'hi') {
      // /hi — single handler orchestrates chorus for all present bots (fixes double-reply)
      // Only the active bot (or first online if no active) handles /hi and then broadcasts via sendHiChorus
      const firstKey = getFirstOnlineSocketKey();
      const hiHandler = isOnlineActive ? rawActiveKey : firstKey;
      isActive = (personalityKey === hiHandler);
    } else if (isCommand && (commandName === 'start' || commandName === 'switch')) {
      if (resolvedTarget) {
        isActive = isTargetMentionedBot;
      } else {
        const firstKey = getFirstOnlineSocketKey();
        isActive = isOnlineActive ? (personalityKey === activeKey) : (personalityKey === firstKey);
      }
    } else if (isCommand) {
      if (isOnlineActive) {
        isActive = (personalityKey === activeKey);
      } else {
        const firstKey = getFirstOnlineSocketKey();
        isActive = (personalityKey === firstKey);
      }
    } else {
      // AI chat messages
      if (isOnlineActive) {
        isActive = (personalityKey === activeKey);
      } else {
        isActive = false;
      }
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

    // ── RPG Command handling ──────────────────────────────────────────
    if (isCommand && options.rpgCommandHandler) {
      let shouldHandle = false;
      if (isGroup) {
        // Targeted /switch + /start are handled by the mentioned bot ONLY —
        // the dispatcher must not hand them to the active/first bot as well.
        shouldHandle = isActive || (isBootstrap && !hasSwitchTarget && _bootstrapDispatcher(personalityKey, chatId));
      } else {
        // DM Handling: Route DM command to the host socket so it always responds cleanly
        const hostKey = getHostKey() || getFirstOnlineSocketKey();
        shouldHandle = (personalityKey === hostKey);
      }
      if (shouldHandle) {
        try {
          await options.rpgCommandHandler(sock, msg, messageText, config, getDatabase, saveDatabase);
        } catch (e) {
          console.error(`❌ [${displayName}] command handler error:`, e.message);
          try {
            await sock.sendMessage(chatId, { text: `❌ Error: ${e.message}` }, { quoted: msg });
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

    // ── AI Personality Chat ──────────────────────────────────────────
    if (isCommand) return;
    if (!isGroup || !messageText.trim()) return;

    if (!isActive) return;

    try {
      const AstralGroups = require('../rpg/utils/AstralGroups');
      const g = AstralGroups.gate(getDatabase(), chatId);
      if (!g.allow) return;
    } catch (e) { /* best effort */ }

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
    const isMentioned = botJid && mentionedJids.some(j => j.split(':')[0] === botJid.split(':')[0]);
    const isQuoted    = botJid && quotedParticipant?.split(':')[0] === botJid?.split(':')[0];
    const nameInText  = messageText.toLowerCase().includes(botDisplayName.toLowerCase());

    if (!isMentioned && !isQuoted && !nameInText) return;

    try { await sock.sendPresenceUpdate('composing', chatId); } catch(e) {}

    const senderName = msg.pushName || sender.split('@')[0];
    try {
      const { text, attachment } = await AIHandler.generateResponse(
        chatId, personalityKey, messageText, senderName,
        sender, msg, getDatabase, saveDatabase
      );

      if (text) {
        await sock.sendMessage(chatId, { text }, { quoted: msg });
      }

      if (attachment) {
        await sendAttachment(sock, chatId, attachment);
      }

    } catch (err) {
      console.error(`❌ [${displayName}] AI error:`, err.message);
    }
    try { await sock.sendPresenceUpdate('paused', chatId); } catch(e) {}
  });

  return sock;
}

async function sendAttachment(sock, chatId, attachment, opts = {}) {
  if (!attachment) return;
  const isGroup = chatId?.endsWith?.('@g.us');

  const send = async (content) => {
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
    const sock = botSockets[targetKey] || getActiveSocket(chatId);
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

      const replyOpts = quotedMsg ? { quoted: quotedMsg } : {};
      if (text) {
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
  const activeKey = PersonalityManager.getActiveBot(chatId);
  if (activeKey && botSockets[activeKey]?.user?.id) return botSockets[activeKey];
  return getAnySocket();
}

module.exports = {
  connectBot,
  startAstraLink,
  getPairingSession,
  listPairingSessions,
  getSocket,
  getPendingSocket,
  getLatestQr,
  getAllSockets,
  getAnySocket,
  getHostSocket,
  getHostKey,
  sendAs,
  sendHiChorus,
  sendAttachment,
  canSendDM,
  safeSendDM,
  getActiveSocket,
  backupAuthToDB,
  restoreAuthFromDB,
  _bootstrapDispatcher,
  _isOwnBotNumber,
  _recordSentId,
  _wasSentByUs,
  _sockets: () => botSockets,
};
