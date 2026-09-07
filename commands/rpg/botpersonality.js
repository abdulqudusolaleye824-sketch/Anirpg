/**
 * ╔══════════════════════════════════════════════════════╗
 * ║           Astra — Bot Personality Commands          ║
 * ║  /start /switch /hi /setainame /bots                 ║
 * ╚══════════════════════════════════════════════════════╝
 */

'use strict';

const PersonalityManager = require('../../bots/PersonalityManager');
const AIHandler = require('../../bots/AIHandler');

// ── Helper: is sender owner or co-owner? ─────────────────────────────────────
function normaliseJid(jid) {
  if (!jid) return '';
  return jid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
}

// Reliable privilege check. Delegates to the bot's central Perms.isBotOwner,
// which always treats the built-in OWNER_JID + COOWNER_JID as owners and
// compares on bare numbers (so "@lid" owners match "@s.whatsapp.net" senders).
function isPrivileged(sender, db) {
  const sNum = normaliseJid(sender);
  let ok = false;
  try {
    const Perms = require('../../utils/permissions');
    ok = Perms.isBotOwner(db, sender) || (db.botMods || []).some(a => normaliseJid(a) === sNum);
  } catch (e) {
    ok = (db.botMods || []).some(a => normaliseJid(a) === sNum);
  }
  if (!ok) {
    console.log('🛑 isPrivileged REFUSED. Diagnose below:');
    console.log('   sender number      =', sNum, '(the number that sent the command)');
    console.log('   OWNER_JID(env)     =', normaliseJid(process.env.OWNER_JID || ''));
    console.log('   COOWNER_JID(env)   =', normaliseJid(process.env.COOWNER_JID || ''));
    console.log('   db.botMods         =', JSON.stringify((db.botMods || []).map(a => normaliseJid(a))));
  }
  return ok;
}

// ── /start <botname> ─────────────────────────────────────────────────────────
const start = {
  name: 'start',
  description: 'Activate a bot personality in this group',
  ownerOnly: true,

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    if (!isPrivileged(sender, db)) {
      return sock.sendMessage(chatId, {
        text: '❌ Only the owner or co-owner can activate bots.',
      }, { quoted: msg });
    }

    const target = args[0];
    if (!target) {
      const all = PersonalityManager.getAllPersonalities()
        .map((k) => `• ${PersonalityManager.getDisplayName(k)} (${k})`)
        .join('\n');
      return sock.sendMessage(chatId, {
        text: `❌ Usage: /start <botname>\n\n📋 Available bots:\n${all}`,
      }, { quoted: msg });
    }

    const result = PersonalityManager.activateBot(chatId, target);
    if (!result.success) {
      return sock.sendMessage(chatId, {
        text: `❌ ${result.error}\n\nUse /bots to see available personalities.`,
      }, { quoted: msg });
    }

    const info = PersonalityManager.getPersonalityInfo(result.personalityKey);
    return sock.sendMessage(chatId, {
      text: [
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `✨ *${result.displayName}* is now active`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ``,
        `🎭 Theme: ${info.theme}`,
        `💬 Mention me or reply to chat with me!`,
        `🔄 Use /switch <name> to change bots`,
        ``,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ].join('\n'),
    }, { quoted: msg });
  },
};

// ── /switch <botname> ────────────────────────────────────────────────────────
const switchBot = {
  name: 'switch',
  description: 'Switch the active bot in this group',
  ownerOnly: true,

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    if (!isPrivileged(sender, db)) {
      return sock.sendMessage(chatId, {
        text: '❌ Only the owner or co-owner can switch bots.',
      }, { quoted: msg });
    }

    const target = args[0];
    if (!target) {
      return sock.sendMessage(chatId, {
        text: '❌ Usage: /switch <botname>',
      }, { quoted: msg });
    }

    const current = PersonalityManager.getActiveBot(chatId);
    const result = PersonalityManager.switchBot(chatId, target);

    if (!result.success) {
      return sock.sendMessage(chatId, {
        text: `❌ ${result.error}\n\nUse /bots to see available personalities.`,
      }, { quoted: msg });
    }

    const info = PersonalityManager.getPersonalityInfo(result.personalityKey);
    const prevName = current ? PersonalityManager.getDisplayName(current) : null;

    return sock.sendMessage(chatId, {
      text: [
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `🔄 *Bot Switched*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        prevName ? `📤 Previous: ${prevName}` : null,
        `📥 Active: *${result.displayName}*`,
        `🎭 Theme: ${info.theme}`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ].filter(Boolean).join('\n'),
    }, { quoted: msg });
  },
};

// ── /hi — all present bots respond ───────────────────────────────────────────
const hi = {
  name: 'hi',
  description: 'All present bots greet the group',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;

    // Determine which bots to summon: ALL connected bots in the group (active
    // or dormant). Fall back to 'present' bots for backwards compatibility.
    let connectedKeys = [];
    try {
      const MSM = require('../../bots/MultiSocketManager');
      connectedKeys = Object.keys(MSM.getAllSockets() || {});
    } catch (_) {}
    const present = PersonalityManager.getPresentBots(chatId);
    const bots = [...new Set([...connectedKeys, ...present])];

    if (bots.length === 0) {
      return sock.sendMessage(chatId, {
        text: '💤 No bots are currently connected/present in this group.\nUse /start <botname> to activate one!',
      }, { quoted: msg });
    }

    const senderName = msg.pushName || sender.split('@')[0];
    const greeting = args.length > 0 ? args.join(' ') : `Hi everyone! ${senderName} says hi!`;

    const responses = await AIHandler.generateAllResponses(chatId, greeting, senderName);

    if (responses.length === 0) {
      return sock.sendMessage(chatId, {
        text: '⚠️ Bots are present but could not respond right now.',
      }, { quoted: msg });
    }

    // Use MultiSocketManager to send each reply from its own bot socket
    try {
      const MultiSocketManager = require('../../bots/MultiSocketManager');
      await MultiSocketManager.sendHiChorus(chatId, responses, msg);
    } catch(e) {
      // Fallback: send all from primary socket (quoted so it looks like a normal reply)
      for (let i = 0; i < responses.length; i++) {
        const { displayName, text, attachment } = responses[i];
        if (text) await sock.sendMessage(chatId, { text: `*${displayName}:* ${text}` }, { quoted: msg });
        if (attachment) {
          try {
            const MSM = require('../../bots/MultiSocketManager');
            await MSM.sendAttachment(sock, chatId, attachment);
          } catch(e2) {}
        }
        if (i < responses.length - 1) await new Promise(r => setTimeout(r, 800));
      }
    }
  },
};

// ── /setainame <personality> <newname> ───────────────────────────────────────
const setainame = {
  name: 'setainame',
  description: 'Set a custom name for a bot personality',
  ownerOnly: true,

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    if (!isPrivileged(sender, db)) {
      return sock.sendMessage(chatId, {
        text: '❌ Only the owner or co-owner can rename bots.',
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
    const activeKey = PersonalityManager.getActiveBot(chatId);
    const presentKeys = new Set(PersonalityManager.getPresentBots(chatId));

    const lines = [
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `🤖 *Astra Bot Roster*`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      '',
    ];

    for (const key of PersonalityManager.getAllPersonalities()) {
      const info = PersonalityManager.getPersonalityInfo(key);
      const isActive = key === activeKey;
      const isPresent = presentKeys.has(key);

      const status = isActive ? '🟢 Active' : isPresent ? '🟡 Present' : '⚫ Dormant';
      lines.push(`${status} *${info.displayName}* (${info.theme})`);
    }

    lines.push('');
    lines.push(`📌 /start <name> — activate a bot`);
    lines.push(`🔄 /switch <name> — switch active bot`);
    lines.push(`👋 /hi — all present bots respond`);
    lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    return sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: msg });
  },
};

// ── /stopbot — deactivate all bots in this GC ────────────────────────────────
const stopbot = {
  name: 'stopbot',
  description: 'Deactivate all bots in this group',
  ownerOnly: true,

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    if (!isPrivileged(sender, db)) {
      return sock.sendMessage(chatId, {
        text: '❌ Only the owner or co-owner can stop bots.',
      }, { quoted: msg });
    }

    PersonalityManager.deactivateAll(chatId);

    return sock.sendMessage(chatId, {
      text: '💤 All bots deactivated in this group. Use /start <name> to reactivate.',
    }, { quoted: msg });
  },
};

module.exports = { start, switchBot, hi, setainame, bots, stopbot };
