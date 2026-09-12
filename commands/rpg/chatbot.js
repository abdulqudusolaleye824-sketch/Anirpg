/**
 * /chatbot — mute/unmute personality chatter in this group (Group Admins + Mods + Owners).
 *
 * Batch-46: /chatbot off stops the bots replying to CHAT in this group
 * (slash commands keep working). /chatbot shows status incl. AI backend.
 */

'use strict';

const Mod = require('../../rpg/utils/ModerationUtils');

function aiBackend() {
  try {
    const AI = require('../../bots/AIHandler');
    if (AI && typeof AI._pickProvider === 'function') {
      const p = AI._pickProvider();
      return p ? `✅ ${p}` : '❌ no key';
    }
  } catch (_) {}
  const hasGroq = !!process.env.GROQ_API_KEY;
  const hasOAI = !!process.env.OPENAI_API_KEY;
  if (hasGroq) return '✅ groq';
  if (hasOAI) return '✅ openai';
  return '❌ no key';
}

module.exports = {
  name: 'chatbot',
  description: '🤖 Mute/unmute bot chatter in this group (Group Admins / Mods / Owners)',
  aliases: ['botchat'],

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const say = (text) => sock.sendMessage(chatId, { text }, { quoted: msg });
    const db = getDatabase();

    if (!chatId.endsWith('@g.us')) {
      return say('❌ This command only works in group chats!');
    }

    // Check if sender is Bot Mod/Owner OR a Group Admin in this group
    let isAuthorized = Mod.canModerate(db, sender);
    if (!isAuthorized) {
      try {
        const meta = await sock.groupMetadata(chatId);
        const senderBare = Mod.bare(sender);
        const participant = meta.participants.find(p => p.id === sender || Mod.bare(p.id) === senderBare);
        if (participant && (participant.admin === 'admin' || participant.admin === 'superadmin')) {
          isAuthorized = true;
        }
      } catch (e) { /* ignore metadata errors */ }
    }

    if (!isAuthorized) {
      return say('❌ *Group Admins / Mods / Owners only.*\n\nYou need to be a group admin or bot mod to use /chatbot.');
    }

    if (!db.groupSettings) db.groupSettings = {};
    if (!db.groupSettings[chatId]) {
      db.groupSettings[chatId] = { antiLink: false, slowmode: 0, chatbot: true };
    }
    const settings = db.groupSettings[chatId];
    const isOn = settings.chatbot !== false;

    const sub = String((args || [])[0] || '').toLowerCase();
    if (!sub) {
      return say([
        `🤖 *Chatbot:* ${isOn ? '✅ ON' : '⛔ OFF'}`,
        ...(isOn ? [] : ['Chatter muted — commands still work.']),
        `🧠 AI backend: ${aiBackend()}`,
        ``,
        `📌 /chatbot on|off`,
      ].join('\n'));
    }
    if (sub !== 'on' && sub !== 'off') {
      return say('❌ Usage: /chatbot on|off\n\n📌 /chatbot — show status');
    }
    settings.chatbot = sub === 'on';
    try { if (saveDatabase) saveDatabase(); } catch (_) {}
    return say(sub === 'on'
      ? '✅ Chatbot ON — bots will chat in this group.'
      : '⛔ Chatbot OFF — chatter muted (commands still work).');
  },
};
