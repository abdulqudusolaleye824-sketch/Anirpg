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

const botSockets = {};
const pairingSessions = {};
const reconnectAttempts = {};

// ── Background WebSocket Heartbeat & Auto-Healing Monitor ──────
setInterval(() => {
  for (const [key, sock] of Object.entries(botSockets)) {
    if (!sock || !sock.ws) continue;
    const isClosed = sock.ws.readyState === 2 || sock.ws.readyState === 3; // CLOSING or CLOSED
    if (isClosed) {
      console.warn(`⚠️ AstraLink [${key}] detected silent dead WebSocket. Initiating auto-healing reconnect…`);
      delete botSockets[key];
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

function getAllSockets() {
  return { ...botSockets };
}

function _bootstrapDispatcher(personalityKey, chatId) {
  const active = PersonalityManager.getActiveBot(chatId);
  if (active && botSockets[active]?.user?.id) return active === personalityKey;

  const sockets = getAllSockets();
  const keys = Object.keys(sockets).filter(k => !!sockets[k]?.user?.id).sort();
  if (keys.length === 0) return false;
  const chosenKey = keys[0];
  try {
    PersonalityManager.activateBot(chatId, chosenKey);
  } catch (e) {}
  return chosenKey === personalityKey;
}

function _isOwnBotNumber(bareNumber, getDatabase) {
  for (const key of Object.keys(botSockets)) {
    const sock = botSockets[key];
    const jid = sock?.user?.id;
    if (!jid) continue;
    if (String(jid).split(':')[0].split('@')[0] === bareNumber) return true;
  }
  try {
    const db = getDatabase?.();
    if (db && db.linkedBots) {
      for (const entry of Object.values(db.linkedBots)) {
        if (entry?.jid && String(entry.jid).split(':')[0].split('@')[0] === bareNumber) return true;
      }
    }
  } catch (e) { /* best effort */ }
  return false;
}

function getAnySocket() {
  const keys = Object.keys(botSockets);
  if (keys.length === 0) return null;
  return botSockets[keys[0]];
}

async function connectBot(personalityKey, authDir, getDatabase, saveDatabase, options = {}) {
  const botAuthDir = path.join(authDir, personalityKey);
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
      const loggedOut = code === DisconnectReason.loggedOut || code === 401;
      const restartRequired = code === DisconnectReason.restartRequired || code === 515;
      delete botSockets[personalityKey];

      let credsRegistered = false;
      try {
        const creds = JSON.parse(fs.readFileSync(path.join(botAuthDir, 'creds.json'), 'utf8'));
        credsRegistered = !!(creds.registered && creds.me);
      } catch (_) {}

      if (!loggedOut && (credsRegistered || restartRequired || options.pairingPhone)) {
        const attempt = (reconnectAttempts[personalityKey] || 0) + 1;
        reconnectAttempts[personalityKey] = attempt;
        const backoffMs = restartRequired ? 1200 : Math.min(30000, attempt * 2000 + 1000);

        console.log(`📡 AstraLink [${displayName}] connection closed (code ${code || 'unknown'}). Reconnecting in ${Math.round(backoffMs / 1000)}s (attempt #${attempt})…`);

        const nextOpts = credsRegistered
          ? { ...options, pairingMode: null, pairingPhone: null }
          : options;

        setTimeout(() => {
          connectBot(personalityKey, authDir, getDatabase, saveDatabase, nextOpts);
        }, backoffMs);
      } else {
        console.log(`❌ AstraLink [${displayName}] connection permanently closed / logged out (code ${code}). Session cleared.`);
        reconnectAttempts[personalityKey] = 0;
      }
    } else if (connection === 'open') {
      reconnectAttempts[personalityKey] = 0; // Reset reconnect count on successful connection!
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

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('group-participants.update', async ({ id: chatId, participants, action }) => {
    if (action !== 'add' && action !== 'remove') return;
    if (options.onGroupJoin) {
      try { await options.onGroupJoin(sock, personalityKey, chatId, participants, action); }
      catch (e) { console.error('❌ onGroupJoin error:', e.message); }
    }
  });

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
    const bareSender = String(sender).split(':')[0].split('@')[0];
    if (db.bannedUsers?.[bareSender] || db.banlist?.[sender] || db.bannedUsers?.[sender]) return;

    if (_isOwnBotNumber(bareSender, getDatabase)) return;

    const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf-8'));
    const isCommand = messageText.startsWith(config.prefix);

    const commandName = isCommand
      ? messageText.slice(config.prefix.length).trim().split(/\s+/)[0].toLowerCase()
      : '';

    // Active bot check with automatic offline fallback
    const rawActiveKey = isGroup ? PersonalityManager.getActiveBot(chatId) : null;
    const isOnlineActive = rawActiveKey && !!botSockets[rawActiveKey]?.user?.id;
    const activeKey = isOnlineActive ? rawActiveKey : null;

    // Check if command is targeting a specific bot personality (e.g. /switch gojo or /start gojo)
    let isTargetMentionedBot = false;
    let hasOnlineTargetBot = false;
    if (isGroup && isCommand && (commandName === 'switch' || commandName === 'start')) {
      const parts = messageText.slice(config.prefix.length).trim().split(/\s+/);
      const targetArg = parts[1];
      if (targetArg) {
        const resolvedTarget = PersonalityManager.resolvePersonality(targetArg);
        if (resolvedTarget && botSockets[resolvedTarget]?.user?.id) {
          hasOnlineTargetBot = true;
          isTargetMentionedBot = (personalityKey === resolvedTarget);
        }
      }
    }

    const isActive = isGroup
      ? (isTargetMentionedBot || (!hasOnlineTargetBot && (activeKey ? activeKey === personalityKey : _bootstrapDispatcher(personalityKey, chatId))))
      : true;

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

    const BOOTSTRAP_COMMANDS = new Set([
      'start', 'switch', 'stopbot', 'bots', 'setainame', 'hi',
      'link', 'unlink', 'help', 'menu', 'restart', 'groupstatus', 'gstatus', 'set', 'setgroup'
    ]);
    const isBootstrap = BOOTSTRAP_COMMANDS.has(commandName);

    // ── AFK MENTION OR REPLY CHECK (Active bot only) ───────────────────
    if (isGroup && isActive && db.afkUsers) {
      const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
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

    // ── RPG Command handling (Active bot only) ─────────────────────────
    if (isCommand && options.rpgCommandHandler) {
      let shouldHandle = false;
      if (isGroup) {
        shouldHandle = isActive || (isBootstrap && _bootstrapDispatcher(personalityKey, chatId));
      } else {
        shouldHandle = Perms.canAccessDM(db, sender);
      }
      if (shouldHandle) {
        try {
          await options.rpgCommandHandler(sock, msg, messageText, config, getDatabase, saveDatabase);
        } catch (e) {
          console.error(`❌ [${displayName}] command handler error:`, e.message);
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
  sendAs,
  sendHiChorus,
  sendAttachment,
  canSendDM,
  safeSendDM,
  getActiveSocket,
};
