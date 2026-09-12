/**
 * ╔══════════════════════════════════════════════════════╗
 * ║           Astra — Bot Personality Commands          ║
 * ║  /start /switch /hi /setainame /bots /stop           ║
 * ╚══════════════════════════════════════════════════════╝
 */

'use strict';

const PersonalityManager = require('../../bots/PersonalityManager');

function normaliseJid(jid) {
  if (!jid) return '';
  return jid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
}

async function isModLevel(sock, sender, chatId, db) {
  const sNum = normaliseJid(sender);

  try {
    const Perms = require('../../utils/permissions');
    if (Perms.isBotOwner(db, sender) || Perms.isBotMod(db, sender)) return true;
  } catch (e) {
    if ((db.botMods || []).some(a => normaliseJid(a) === sNum)) return true;
  }

  const player = db.users?.[sender] || db.users?.[sNum];
  if (player && (player.isPro || player.proStatus) && player.proExpiresAt && player.proExpiresAt > Date.now()) {
    return true;
  }

  if (chatId && chatId.endsWith('@g.us') && sock && typeof sock.groupMetadata === 'function') {
    try {
      const meta = await sock.groupMetadata(chatId);
      const p = meta.participants?.find(m => m.id === sender || normaliseJid(m.id) === sNum);
      if (p && (p.admin === 'admin' || p.admin === 'superadmin')) return true;
    } catch (e) {}
  }

  return false;
}

// ── /start <botname> ─────────────────────────────────────────────────────────
const start = {
  name: 'start',
  description: 'Start/activate a bot personality in this group (Mods / Admins / Pro only)',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    if (!(await isModLevel(sock, sender, chatId, db))) {
      return sock.sendMessage(chatId, {
        text: '❌ Only bot owners, bot mods, Pro players, or group admins can use /start.',
      }, { quoted: msg });
    }

    const current = PersonalityManager.getActiveBot(chatId);
    const target = args[0];

    if (!target) {
      if (current) {
        // Check if current is actually online; if offline, allow new activation
        let currentOnline = false;
        try { const MSM = require('../../bots/MultiSocketManager'); const s = MSM.getSocket(current); currentOnline = !!(s?.user?.id); } catch {}
        if (currentOnline) {
          const curName = PersonalityManager.getDisplayName(current);
          return sock.sendMessage(chatId, {
            text: `✨ Bot *${curName}* is already active in this group!\n\n• Use */switch <botname>* to change bots\n• Use */stop* to deactivate`,
          }, { quoted: msg });
        }
        // current is offline — fall through to allow new activation
      } else {
        // no current and no target arg → show usage
      }
      if (!target) {
        const all = PersonalityManager.getAllPersonalities()
          .map((k) => `• ${PersonalityManager.getDisplayName(k)} (${k})`)
          .join('\n');
        return sock.sendMessage(chatId, {
          text: `❌ Usage: /start <botname>\n\n📋 Available bots:\n${all}`,
        }, { quoted: msg });
      }
    }

    const resolvedTarget = PersonalityManager.resolvePersonality(target);
    if (!resolvedTarget) {
      return sock.sendMessage(chatId, {
        text: `❌ Unknown bot: "${target}".\n\nUse /bots to see available personalities.`,
      }, { quoted: msg });
    }

    // If another bot is active, check if it's online. If offline, auto-switch; if online, also auto-switch for UX (user expects /start to work)
    if (current && current !== resolvedTarget) {
      let currentOnline = false;
      try { const MSM = require('../../bots/MultiSocketManager'); const s = MSM.getSocket(current); currentOnline = !!(s?.user?.id); } catch {}
      if (currentOnline) {
        // Instead of blocking, auto-switch for better UX — /start should just work
        // Fall through to activate
      } else {
        // current offline — auto-switch silently
      }
    }

    const result = PersonalityManager.activateBot(chatId, target);
    if (!result.success) {
      return sock.sendMessage(chatId, {
        text: `❌ ${result.error}\n\nUse /bots to see available personalities.`,
      }, { quoted: msg });
    }

    if (!db.registeredGCs) db.registeredGCs = {};
    db.registeredGCs[chatId] = {
      registeredAt: Date.now(),
      activeBot: result.personalityKey,
      registeredBy: sender
    };
    saveDatabase();

    const info = PersonalityManager.getPersonalityInfo(result.personalityKey);
    const text = [
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `✨ *${result.displayName}* is now active`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ``,
      `🎭 Theme: ${info.theme}`,
      `💬 Mention me or reply to chat with me!`,
      `🔄 Use /switch <name> to change bots`,
      `🛑 Use /stop to deactivate`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ].join('\n');

    return sock.sendMessage(chatId, { text }, { quoted: msg });
  },
};

// ── /switch <botname> ────────────────────────────────────────────────────────
const switchBot = {
  name: 'switch',
  description: 'Switch the active bot in this group (Mods / Admins / Pro only)',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    if (!(await isModLevel(sock, sender, chatId, db))) {
      return sock.sendMessage(chatId, {
        text: '❌ Only bot owners, bot mods, Pro players, or group admins can use /switch.',
      }, { quoted: msg });
    }

    const target = args[0];
    if (!target) {
      return sock.sendMessage(chatId, {
        text: '❌ Usage: /switch <botname>\nExample: /switch kira',
      }, { quoted: msg });
    }

    const resolvedTarget = PersonalityManager.resolvePersonality(target);
    if (!resolvedTarget) {
      return sock.sendMessage(chatId, {
        text: `❌ Unknown bot: "${target}".\n\nUse /bots to see available personalities.`,
      }, { quoted: msg });
    }

    const result = PersonalityManager.switchBot(chatId, target);
    if (!result.success) {
      return sock.sendMessage(chatId, {
        text: `❌ ${result.error}\n\nUse /bots to see available personalities.`,
      }, { quoted: msg });
    }

    if (!db.registeredGCs) db.registeredGCs = {};
    db.registeredGCs[chatId] = {
      registeredAt: Date.now(),
      activeBot: result.personalityKey,
      registeredBy: sender
    };
    saveDatabase();

    const info = PersonalityManager.getPersonalityInfo(result.personalityKey);
    const greeting =
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `✨ I am active now!\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `🎭 *${result.displayName}* — ${info.theme}\n` +
      `💬 Mention me or reply to chat with me!\n` +
      `🔄 Use /switch <name> to change bots\n` +
      `🛑 Use /stop to deactivate\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

    return sock.sendMessage(chatId, { text: greeting }, { quoted: msg });
  },
};

// ── /hi — all present bots respond ───────────────────────────────────────────
const hi = {
  name: 'hi',
  description: 'All present bots greet the group independently',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;

    let connectedKeys = [];
    let present = [];
    try {
      const MSM = require('../../bots/MultiSocketManager');
      const all = MSM.getAllSockets() || {};
      // Only count actually online bots (user.id present) for hi
      connectedKeys = Object.keys(all).filter(k => all[k]?.user?.id);
      present = PersonalityManager.getPresentBots(chatId) || [];
      // Filter present to only those that are actually online
      present = present.filter(k => all[k]?.user?.id);
    } catch (_) {
      try { present = PersonalityManager.getPresentBots(chatId) || []; } catch {}
    }
    // STRICT: only bots that are BOTH online (user.id) AND present in this
    // group respond. No union, no any-online fallback — a bot that isn't
    // here must stay silent, and no bot may answer on another's behalf.
    const presentSet = new Set(present);
    const bots = connectedKeys.filter(k => presentSet.has(k));

    if (bots.length === 0) {
      return sock.sendMessage(chatId, {
        text: '💤 No bots are currently connected/present in this group.\nUse /start <botname> to activate one!',
      }, { quoted: msg });
    }

    const senderName = msg.pushName || sender.split('@')[0];
    const greeting = args.length > 0 ? `Hi ${senderName}! ${args.join(' ')}` : `Hi ${senderName}!`;

    let responses = [];
    try {
      const MSM = require('../../bots/MultiSocketManager');
      for (const key of bots) {
        const bsock = MSM.getSocket(key);
        if (!bsock?.user?.id) continue;
        const info = PersonalityManager.getPersonalityInfo(key);
        const displayName = PersonalityManager.getDisplayName(key);
        const emoji = info?.emoji || '🤖';
        responses.push({
          personalityKey: key,
          displayName,
          text: `${greeting} — ${emoji} I'm ${displayName}!`,
          attachment: null,
        });
      }
    } catch (e) { /* best effort */ }

    if (responses.length === 0) {
      return sock.sendMessage(chatId, {
        text: '⚠️ Bots are present but their sockets aren\'t ready right now.',
      }, { quoted: msg });
    }

    // The chorus reports exactly which greetings landed; retry ONLY the
    // missing ones — each via its OWN socket. A bot whose socket can't
    // deliver stays silent: no bot may ever speak for another bot.
    let delivered = [];
    try {
      const MultiSocketManager = require('../../bots/MultiSocketManager');
      const report = await MultiSocketManager.sendHiChorus(chatId, responses, msg);
      delivered = (report && report.delivered) || [];
    } catch (e) { delivered = []; }
    const missing = responses.filter((r) => !delivered.includes(r.personalityKey));
    for (let i = 0; i < missing.length; i++) {
      const r = missing[i];
      try {
        const MultiSocketManager = require('../../bots/MultiSocketManager');
        const own = MultiSocketManager.getSocket(r.personalityKey);
        if (own && own.user?.id && r.text) {
          await own.sendMessage(chatId, { text: r.text }, { quoted: msg });
        }
      } catch (e) { /* stays silent — never impersonate */ }
      if (i < missing.length - 1) await new Promise((rr) => setTimeout(rr, 800));
    }
  },
};

// ── /setainame <personality> <newname> ───────────────────────────────────────
const setainame = {
  name: 'setainame',
  description: 'Set a custom name for a bot personality (Owners / Mods only)',
  ownerOnly: true,

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    const Perms = require('../../utils/permissions');
    const isOwnerOrMod = Perms.isBotOwner(db, sender) || Perms.isBotMod(db, sender);
    if (!isOwnerOrMod) {
      return sock.sendMessage(chatId, {
        text: '❌ Only the bot owner, co-owner, or bot mods can rename bots.',
      }, { quoted: msg });
    }

    if (args.length < 2) {
      return sock.sendMessage(chatId, {
        text: [
          '❌ Usage: /setainame <personality> <newname>',
          '',
          'Example: /setainame hinata Yuki',
          '',
          '📋 Personalities: ' + PersonalityManager.getAllPersonalities().join(', '),
        ].join('\n'),
      }, { quoted: msg });
    }

    const [personalityArg, ...nameParts] = args;
    const newName = nameParts.join(' ').trim();

    if (!newName || newName.length < 1 || newName.length > 20) {
      return sock.sendMessage(chatId, {
        text: '❌ Name must be 1–20 characters.',
      }, { quoted: msg });
    }

    const result = PersonalityManager.setCustomName(personalityArg, newName);
    if (!result.success) {
      return sock.sendMessage(chatId, {
        text: `❌ ${result.error}`,
      }, { quoted: msg });
    }

    return sock.sendMessage(chatId, {
      text: [
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `✅ *Bot Renamed*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ``,
        `🎭 Personality: ${result.key}`,
        `📛 New Name: *${result.displayName}*`,
        ``,
        `The bot will now respond as ${result.displayName}.`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ].join('\n'),
    }, { quoted: msg });
  },
};

// ── /bots — list all personalities ───────────────────────────────────────────
const bots = {
  name: 'bots',
  description: 'List all available bot personalities',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const activeKey = PersonalityManager.getActiveBot(chatId);

    let presentKeys = new Set();
    let linkedKeys = new Set();
    let MSM = null;
    try {
      MSM = require('../../bots/MultiSocketManager');
      linkedKeys = new Set(Object.keys(MSM.getAllSockets?.() || {}));
      presentKeys = new Set(PersonalityManager.getPresentBots(chatId));
    } catch (_) {}

    const lines = [
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `🤖 *Astra Bot Roster*`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `🟢 Active = active in this group`,
      `🟡 Present = linked & connected`,
      `⚫ Dormant = no number linked`,
      `💤AI-off = scripts only (/aimode)`,
      '',
    ];

    for (const key of PersonalityManager.getAllPersonalities()) {
      const info = PersonalityManager.getPersonalityInfo(key);
      const isActive = key === activeKey;
      const isLinked = linkedKeys.has(key) || (MSM && !!MSM.getSocket?.(key));

      let status;
      if (isActive) status = '🟢 Active';
      else if (isLinked || presentKeys.has(key)) status = '🟡 Present';
      else status = '⚫ Dormant';
      // Batch-42: AI chat is back — mark AI-off (scripts-only) bots.
      let aiMark = '';
      try { aiMark = PersonalityManager.isAIOff(db, key) ? ' 💤AI-off' : ''; } catch (_) {}
      lines.push(`${status} *${info.displayName}* (${info.theme})${aiMark}`);
    }

    lines.push('');
    lines.push(`📌 /start <name> — activate a bot`);
    lines.push(`🔄 /switch <name> — switch active bot`);
    lines.push(`👋 /hi — all present bots respond`);
    lines.push(`🛑 /stop — deactivate bot in group`);
    lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    return sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: msg });
  },
};

// ── /stop /stopbot — deactivate all bots in this GC ──────────────────────────
const stopbot = {
  name: 'stop',
  aliases: ['stopbot'],
  description: 'Deactivate active bot in this group (Mods / Admins / Pro only)',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    if (!(await isModLevel(sock, sender, chatId, db))) {
      return sock.sendMessage(chatId, {
        text: '❌ Only bot owners, bot mods, Pro players, or group admins can use /stop.',
      }, { quoted: msg });
    }

    PersonalityManager.deactivateAll(chatId);

    return sock.sendMessage(chatId, {
      text: '💤 Bot deactivated in this group. Use /start <name> to activate a bot again.',
    }, { quoted: msg });
  },
};

module.exports = { start, switchBot, hi, setainame, bots, stopbot, stop: stopbot };
