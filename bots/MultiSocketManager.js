/**
 * ╔══════════════════════════════════════════════════════╗
 * ║         AniRPG — MultiSocketManager                  ║
 * ║  One Baileys socket per linked bot number.          ║
 * ║  Every bot handles RPG commands AND has a          ║
 * ║  personality. No "primary" or "secondary" — all     ║
 * ║  bots are equal.                                   ║
 * ╚══════════════════════════════════════════════════════╝
 *
 * Each bot number:
 *  - Has its own auth folder (auth/hinata/, auth/lunar/, …)
 *  - Runs its own Baileys socket
 *  - Handles RPG commands in groups (like /dungeon, /pvp, /profile)
 *  - Reacts to AI chat in groups when its personality is active
 *  - Can DM players — but DMs are GATED by the serf system.
 *    The ONLY exception is the welcome DM (first-join only).
 *
 * AstraLink pairing codes are issued through whichever bot is
 * currently connected (the API endpoint picks any live socket).
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
} = require('@whiskeysockets/baileys');
const pino    = require('pino');

const PersonalityManager = require('./PersonalityManager');
const AIHandler          = require('./AIHandler');
const SerfManager        = require('../rpg/utils/SerfManager');
const Perms              = require('../utils/permissions');
const QRCode             = require('qrcode');
const QRTerminal = (()=>{ try { return require('qrcode-terminal'); } catch(e){ return null; } })();

// ── Connected sockets registry ────────────────────────────────────────────────
// { personalityKey: socket }
const botSockets = {};

// ── AstraLink pairing sessions (in-memory) ───────────────────────────────────
// { personalityKey: { status, method, phoneNumber, code, qr, qrDataUrl, error, jid, startedAt } }
const pairingSessions = {};

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

/**
 * AstraLink is the ONLY way to link a number.
 * Starts a fresh Baileys socket for this personality and either:
 *   - requests a pairing code for `phoneNumber` (method: 'code')
 *   - exposes a QR payload (method: 'qr')
 * No BOT_* env vars are required.
 */
async function startAstraLink(personalityKey, authDir, getDatabase, saveDatabase, options = {}) {
  const method = options.pairingMode === 'qr' ? 'qr' : 'code';
  const phoneNumber = (options.pairingPhone || '').replace(/[^0-9]/g, '');

  if (!PersonalityManager.getAllPersonalities().includes(personalityKey)) {
    return { success: false, error: `Unknown personality: ${personalityKey}` };
  }
  if (method === 'code' && (phoneNumber.length < 7 || phoneNumber.length > 15)) {
    return { success: false, error: 'Enter a valid WhatsApp number with country code' };
  }
  if (botSockets[personalityKey]?.user?.id) {
    return { success: false, error: `${PersonalityManager.getDisplayName(personalityKey)} is already online.` };
  }

  const botAuthDir = path.join(authDir, personalityKey);
  // Explicit AstraLink = always a fresh WhatsApp session
  try {
    if (botSockets[personalityKey]) {
      try { botSockets[personalityKey].end(undefined); } catch (_) {}
      delete botSockets[personalityKey];
    }
    if (fs.existsSync(botAuthDir)) fs.rmSync(botAuthDir, { recursive: true, force: true });
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

/**
 * Get the socket for a given personality key.
 * Returns null if not connected.
 */
function getSocket(personalityKey) {
  return botSockets[personalityKey] || null;
}

/**
 * Get the socket that is (or will be) pairing for a personality.
 * Used by AstraLink to request a pairing code on the CORRECT socket.
 * Falls back to the socket already connected for that personality.
 */
function getPendingSocket(personalityKey) {
  const s = botSockets[personalityKey];
  return s || null;
}

/**
 * Get the most recent QR for a personality from its pairing session,
 * plus a base64 data-URL so the UI can render it without a terminal.
 */
function getLatestQr(personalityKey) {
  const session = pairingSessions[personalityKey];
  if (!session) return { qr: null, dataUri: null };
  return { qr: session.qr || null, dataUri: session.qrDataUrl || null };
}

/**
 * Get all connected sockets keyed by personality.
 */
function getAllSockets() {
  return { ...botSockets };
}

/**
 * Return any one connected socket (for AstraLink pairing code requests).
 */
function getAnySocket() {
  const keys = Object.keys(botSockets);
  if (keys.length === 0) return null;
  return botSockets[keys[0]];
}

/**
 * Connect one bot. Every bot has equal status — all of them handle
 * RPG commands and can host a personality in their active group.
 *
 * @param {string} personalityKey  e.g. 'hinata'
 * @param {string} authDir         base auth directory
 * @param {Function} getDatabase
 * @param {Function} saveDatabase
 * @param {object} options
 *   - personalityKey:  which personality to attach to this socket
 *   - isWelcomeBot:    if true, this bot also sends the welcome DM
 *                      (only one bot should do this; we pick the first
 *                      that connects)
 *   - handlers:        { rpgCommandHandler, onGroupJoin }
 */
async function connectBot(personalityKey, authDir, getDatabase, saveDatabase, options = {}) {
  const botAuthDir = path.join(authDir, personalityKey);
  fs.mkdirSync(botAuthDir, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(botAuthDir);
  const { version } = await fetchLatestBaileysVersion();

  const displayName = PersonalityManager.getDisplayName(personalityKey);

  const pairingMode  = options.pairingMode || null;
  const pairingPhone = (options.pairingPhone || '').replace(/[^0-9]/g, '') || null;
  const isPairing    = pairingMode === 'code' || pairingMode === 'qr';

  const sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    auth: state,
    browser: Browsers.ubuntu('Chrome'),
    syncFullHistory: false,
    markOnlineOnConnect: false,
    generateHighQualityLinkPreview: false,
    getMessage: async () => ({ conversation: '' }),
  });

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
          await new Promise(r => setTimeout(r, 1500));
          console.log(`\n🛰️  AstraLink [${displayName}] requesting pairing code for +${pairingPhone}…`);
          const code = await sock.requestPairingCode(pairingPhone);
          const formatted = formatPairingCode(code);
          pairingSessions[personalityKey] = {
            ...pairingSessions[personalityKey],
            status: 'code_ready',
            method: 'code',
            phoneNumber: pairingPhone,
            code: formatted,
            error: null,
          };
          console.log('━'.repeat(60));
          console.log(`🔗 AstraLink [${displayName}] PAIRING CODE:  ${formatted}`);
          console.log('━'.repeat(60));
        } catch (err) {
          pairingCodeRequested = false;
          pairingSessions[personalityKey] = {
            ...pairingSessions[personalityKey],
            status: 'error',
            error: err.message || 'Failed to issue pairing code',
          };
          console.error(`❌ AstraLink pairing code failed [${displayName}]:`, err.message);
        }
      } else if (pairingMode === 'qr') {
        pairingSessions[personalityKey].status = 'qr_ready';
        console.log(`📷 AstraLink [${displayName}] QR ready`);
      } else if (!isPairing) {
        console.log(`🛰️  [${displayName}] needs linking. Open AstraLink — no .env bot numbers required.`);
      }
    }

    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = code === DisconnectReason.loggedOut || code === 401;
      const restartRequired = code === DisconnectReason.restartRequired || code === 515;
      delete botSockets[personalityKey];

      let credsRegistered = false;
      try {
        const creds = JSON.parse(fs.readFileSync(path.join(botAuthDir, 'creds.json'), 'utf8'));
        credsRegistered = !!(creds.registered && creds.me);
      } catch (_) {}

      const shouldReconnect = restartRequired || (!loggedOut && credsRegistered);
      console.log(`❌ [${displayName}] Disconnected (code: ${code}). Reconnect: ${shouldReconnect}`);

      if (loggedOut) {
        try { fs.rmSync(botAuthDir, { recursive: true, force: true }); } catch (_) {}
        if (pairingSessions[personalityKey] && pairingSessions[personalityKey].status !== 'connected') {
          pairingSessions[personalityKey] = {
            ...(pairingSessions[personalityKey] || {}),
            status: 'logged_out',
            error: 'WhatsApp rejected the session. Tap Refresh on AstraLink.',
          };
        }
      }

      if (shouldReconnect) {
        const nextOpts = credsRegistered
          ? { ...options, pairingMode: null, pairingPhone: null }
          : options;
        setTimeout(() => connectBot(personalityKey, authDir, getDatabase, saveDatabase, nextOpts), restartRequired ? 1200 : 4000);
      }
    } else if (connection === 'open') {
      console.log(`✅ [${displayName}] Connected via AstraLink!`);
      botSockets[personalityKey] = sock;
      const jid = sock.user?.id || null;
      pairingSessions[personalityKey] = {
        ...(pairingSessions[personalityKey] || {}),
        status: 'connected',
        jid,
        error: null,
        code: pairingSessions[personalityKey]?.code || null,
      };
      persistLinkedBot(getDatabase, saveDatabase, personalityKey, sock, pairingPhone);
    }
  });

  sock.ev.on('creds.update', saveCreds);

  // ── Group join/leave announcements ─────────────────────────────────────
  // `onGroupJoin(sock, personalityKey, chatId, participants, action)` is
  // called for every bot in the group. The handler decides whether
  // the bot should respond (based on whether it's the active bot in
  // the group, plus dedupe for the welcome DM).
  sock.ev.on('group-participants.update', async ({ id: chatId, participants, action }) => {
    if (action !== 'add' && action !== 'remove') return;
    if (options.onGroupJoin) {
      try { await options.onGroupJoin(sock, personalityKey, chatId, participants, action); }
      catch (e) { console.error('❌ onGroupJoin error:', e.message); }
    }
  });

  // ── Message handler (RPG commands + AI chat) ─────────────────────────────
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const isGroup  = msg.key.remoteJid?.endsWith('@g.us');
    const sender   = isGroup ? msg.key.participant : msg.key.remoteJid;
    const chatId   = msg.key.remoteJid;

    if (!sender?.endsWith('@s.whatsapp.net') && !sender?.endsWith('@lid')) return;

    const messageText =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      msg.message.imageMessage?.caption ||
      msg.message.videoMessage?.caption || '';

    const db = getDatabase();
    // bare-number normalization so bans always match (device/@lid-independent)
    const bareSender = String(sender).split(':')[0].split('@')[0];
    if (db.bannedUsers?.[bareSender] || db.banlist?.[sender] || db.bannedUsers?.[sender]) return;

    const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf-8'));
    const isCommand = messageText.startsWith(config.prefix);

    // ── Active-bot gate (resolved EARLY so AFK notices don't spam) ────────
    // In any group, only the active bot (set via /start or /switch) is
    // allowed to respond. Every bot in the group receives the same message,
    // so non-active bots must stay silent — otherwise THREE copies of every
    // AFK/notice are posted. For DMs, ANY connected bot can respond.
    let activeKey = isGroup ? PersonalityManager.getActiveBot(chatId) : null;
    // Self-healing: if a group has NO active bot, auto-activate this bot on
    // its first command so it always responds — no manual /start needed.
    if (isGroup && !activeKey && isCommand) {
      try {
        const res = PersonalityManager.activateBot(chatId, personalityKey);
        if (res.success) activeKey = res.personalityKey;
      } catch (e) { /* best effort */ }
    }
    const isActive = isGroup ? (activeKey === personalityKey) : true;

    // ── AFK MENTION CHECK (only the ACTIVE bot posts an AFK notice — otherwise
    //    /tagall and any @mention of an AFK user makes EVERY bot echo it) ────
    if (isGroup && isActive && db.afkUsers) {
      const mentionedAlso = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
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

    // ── AFK SELF WELCOME-BACK (only the ACTIVE bot welcomes back) ─────────
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

    // ── RPG command handling ───────────────────────────────────────────────
    // Only the active bot in a group handles commands. In DMs, the
    // receiving bot handles the command (mod-only via the handler's gate).
    if (isCommand && options.rpgCommandHandler) {
      if (isActive && (isGroup || Perms.canAccessDM(db, sender))) {
        try {
          await options.rpgCommandHandler(sock, msg, messageText, config, getDatabase, saveDatabase);
        } catch (e) {
          console.error(`❌ [${displayName}] command handler error:`, e.message);
        }
      }
      return;
    }

    // ── !mp3 reply trigger (works in any chat) ───────────────────────────
    if (messageText.trim().toLowerCase() === '!mp3') {
      // Only the active bot replies (no point sending three identical
      // /mp3 confirmations from every bot in the group)
      if (isActive) {
        try {
          const { handleMp3Reply } = require('../commands/rpg/utility');
          await handleMp3Reply(sock, msg, chatId);
        } catch (e) { console.error('❌ !mp3 handler error:', e.message); }
      }
      return;
    }

    // ── AI personality chat (only when this bot is the active personality) ─
    // Never let AI hijack a command: if the message is a bot command (starts
    // with the prefix), the command handler owns it — AI must stay silent.
    // This is a hard guard even if the command wasn't dispatched (e.g. the
    // handler returned for a non-active bot). Without it, /start <name>,
    // /switch, etc. get answered by the personality as if they were chat.
    if (isCommand) return;
    if (!isGroup || !messageText.trim()) return;
    if (activeKey !== personalityKey) return;

    const botDisplayName = PersonalityManager.getDisplayName(personalityKey);
    const botJid = sock.user?.id;

    const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
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
        await sock.sendMessage(chatId, {
          text: `*${botDisplayName}:* ${text}`,
        }, { quoted: msg });
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

/**
 * Send an attachment from AIHandler. Group sends are unfiltered; 1:1 DMs
 * go through the serf gate. The only bypass is the welcome DM (caller
 * passes opts.welcome = true and the welcome-bypass is applied via
 * `safeSendDM` directly).
 */
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

/**
 * sendAs — send from a specific personality's socket. 1:1 DMs are
 * gated through the serf system (unless `welcome: true`).
 */
async function sendAs(personalityKey, chatId, content, opts = {}) {
  const sock = botSockets[personalityKey];
  if (!sock) return { dropped: true, reason: 'no-socket' };
  if (!chatId?.endsWith?.('@g.us') && !opts.welcome) {
    return safeSendDM(sock, chatId, content, opts);
  }
  return sock.sendMessage(chatId, content);
}

/**
 * Serf-gate: should this bot be allowed to DM this player?
 *
 * Rules:
 *   - Welcome DMs are always allowed (caller sets opts.welcome = true)
 *   - Otherwise the bot must be the player's approved serf
 *   - Players without an approved serf receive a one-time reminder
 *   - Mods / owners can always be DMed by any bot
 */
function canSendDM(db, playerJid, botJid, botKey) {
  if (!db || !playerJid) return { allowed: true, reason: 'no-db' };

  // Mods / owners are exempt from the serf gate (admin override)
  if (Perms.isBotMod(db, playerJid) || Perms.isBotOwner(db, playerJid)) {
    return { allowed: true, reason: 'privileged' };
  }

  if (botJid && SerfManager.isJidPlayerSerf(db, playerJid, botJid)) {
    return { allowed: true, reason: 'serf-jid' };
  }
  if (botKey && SerfManager.isPlayerSerf(db, playerJid, botKey)) {
    return { allowed: true, reason: 'serf-key' };
  }

  return { allowed: false, reason: 'not-serf' };
}

/**
 * Send a DM from a bot, gated by the serf system.
 * If the player has not set a serf, the DM is dropped and a one-time
 * reminder is sent telling them to /setserf.
 */
const _serfReminderSent = new Set();
async function safeSendDM(sock, playerJid, content, opts = {}) {
  // The "welcome" flag bypasses serf checks — only used for the new-member DM.
  if (opts.welcome) {
    return sock.sendMessage(playerJid, content);
  }
  if (!opts.db) {
    // Without DB we can't gate — fail open and let the caller decide.
    return sock.sendMessage(playerJid, content);
  }
  const botJid = sock.user?.id || null;
  const botKey = opts.botKey || null;
  const verdict = canSendDM(opts.db, playerJid, botJid, botKey);
  if (verdict.allowed) {
    return sock.sendMessage(playerJid, content);
  }
  // Dropped. Queue a one-time reminder.
  if (!_serfReminderSent.has(playerJid)) {
    _serfReminderSent.add(playerJid);
    const reminder =
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
      '⚓ *DM BLOCKED — PICK YOUR SERF*\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
      'A bot tried to DM you, but you haven\'t set it as your serf.\n\n' +
      'To allow DMs from one personality bot:\n' +
      '1. Go to any group where the bot is active.\n' +
      '2. Run: `/setserf @botname`\n' +
      '3. A mod will confirm in the Mod GC.\n\n' +
      'After that, only your chosen bot can DM you.\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    try {
      await sock.sendMessage(playerJid, { text: reminder });
    } catch (e) { /* best effort */ }
  }
  return { dropped: true, reason: verdict.reason };
}

/**
 * Send /hi chorus — each bot replies from its own number.
 * All sends go to the group chat (not a DM), so no serf gate needed.
 */
async function sendHiChorus(chatId, responses, quotedMsg) {
  for (let i = 0; i < responses.length; i++) {
    const { personalityKey, displayName, text, attachment } = responses[i];
    const sock = botSockets[personalityKey];
    if (!sock) continue;

    const replyOpts = quotedMsg ? { quoted: quotedMsg } : {};
    if (text) {
      await sock.sendMessage(chatId, {
        text: `*${displayName}:* ${text}`,
      }, replyOpts);
    }

    if (attachment) {
      await sendAttachment(sock, chatId, attachment);
    }

    if (i < responses.length - 1) {
      await new Promise(r => setTimeout(r, 800));
    }
  }
}

/**
 * Pick a socket for a group chat:
 *   - The active personality in that group, if connected
 *   - Otherwise any connected socket (round-robin is overkill — we just
 *     pick the first one)
 */
function getActiveSocket(chatId) {
  const PersonalityManager = require('./PersonalityManager');
  const activeKey = PersonalityManager.getActiveBot(chatId);
  if (activeKey && botSockets[activeKey]) return botSockets[activeKey];
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
  sendAs,
  sendHiChorus,
  sendAttachment,
  canSendDM,
  safeSendDM,
  getActiveSocket,
};
