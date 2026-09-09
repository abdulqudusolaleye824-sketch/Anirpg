/**
 * ╔══════════════════════════════════════════════════════╗
 * ║           Astra — Bot Personality Commands          ║
 * ║  /start /switch /hi /setainame /bots                 ║
 * ╚══════════════════════════════════════════════════════╝
 */

'use strict';

const PersonalityManager = require('../../bots/PersonalityManager');
const AIHandler = require('../../bots/AIHandler');

function normaliseJid(jid) {
  if (!jid) return '';
  return jid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
}

function isPrivileged(sender, db) {
  const sNum = normaliseJid(sender);
  let ok = false;
  try {
    const Perms = require('../../utils/permissions');
    ok = Perms.isBotOwner(db, sender) || (db.botMods || []).some(a => normaliseJid(a) === sNum);
  } catch (e) {
    ok = (db.botMods || []).some(a => normaliseJid(a) === sNum);
  }
  return ok;
}

// ── /start <botname> ─────────────────────────────────────────────────────────
const start = {
  name: 'start',
  description: 'Activate a bot personality in this group',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

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
    const text = [
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `✨ *${result.displayName}* is now active`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ``,
      `🎭 Theme: ${info.theme}`,
      `💬 Mention me or reply to chat with me!`,
      `🔄 Use /switch <name> to change bots`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ].join('\n');

    try {
      const MSM = require('../../bots/MultiSocketManager');
      const botSock = MSM.getSocket(result.personalityKey);
      if (botSock && botSock.user?.id && botSock.ws?.readyState === 1) {
        return botSock.sendMessage(chatId, { text }, { quoted: msg });
      }
    } catch (e) { /* fall through to healthy socket fallback */ }

    return sock.sendMessage(chatId, { text }, { quoted: msg });
  },
};

// ── /switch <botname> ────────────────────────────────────────────────────────
const switchBot = {
  name: 'switch',
  description: 'Switch the active bot in this group',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    const target = args[0];
    if (!target) {
      return sock.sendMessage(chatId, {
        text: '❌ Usage: /switch <botname>\nExample: /switch gojo',
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
    const newKey = result.personalityKey;

    // Send greeting from target bot if online
    try {
      const MSM = require('../../bots/MultiSocketManager');
      const newBotSock = MSM.getSocket(newKey);
      if (newBotSock && newBotSock.user?.id && newBotSock.ws?.readyState === 1) {
        const greeting =
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `✨ I am active now!\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `🎭 *${result.displayName}* — ${info.theme}\n` +
          `💬 Mention me or reply to chat with me!\n` +
          `🔄 Use /switch <name> to change bots\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
        await newBotSock.sendMessage(chatId, { text: greeting }, { quoted: msg });
        return;
      }
    } catch (e) { /* fall through to active socket response */ }

    // Fallback: If target bot is offline/banned, the current healthy socket sends confirmation
    const prevName = current ? PersonalityManager.getDisplayName(current) : null;
    return sock.sendMessage(chatId, {
      text: [
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `🔄 *Bot Switched*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        prevName ? `📤 Previous: ${prevName}` : null,
        `📥 Active: *${result.displayName}*`,
        `🎭 Theme: ${info.theme}`,
        `⚠️ _Note: ${result.displayName}'s socket is currently offline or unlinked._`,
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
    const greeting = args.length > 0 ? `Hi ${senderName}! ${args.join(' ')}` : `Hi ${senderName}!`;

    let responses = [];
    try {
      const MSM = require('../../bots/MultiSocketManager');
      for (const key of bots) {
        const sock = MSM.getSocket(key);
        if (!sock) continue;
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

    try {
      const MultiSocketManager = require('../../bots/MultiSocketManager');
      await MultiSocketManager.sendHiChorus(chatId, responses, msg);
    } catch(e) {
      for (let i = 0; i < responses.length; i++) {
        const { displayName, text } = responses[i];
        if (text) await sock.sendMessage(chatId, { text: `*${displayName}:* ${text}` }, { quoted: msg });
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
