// /aimode — Per-bot AI toggle (batch-32).
// AI ON (default): intent → scripts → AI-last. AI OFF: scripts only,
// zero Groq calls — the bot still chats from its personality banks.
// Owner/mod only.

'use strict';

const PersonalityManager = require('../../bots/PersonalityManager');
const Perms = require('../../utils/permissions');

module.exports = {
  name: 'aimode',
  aliases: ['botai'],
  description: '🤖 Toggle per-bot AI on/off (mods)',
  usage: '/aimode [<bot|all> <on|off>]',
  category: 'system',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key?.remoteJid;
    const db = getDatabase();

    let mod = false;
    try { mod = Perms.isBotMod(db, sender); } catch (e) {}
    if (!mod) {
      return sock.sendMessage(chatId, { text: '❌ Only bot mods can change AI mode.' }, { quoted: msg });
    }

    const keys = PersonalityManager.getAllPersonalities();
    const sub = (args[0] || '').toLowerCase();

    // ── /aimode — status card ──
    if (!sub || sub === 'status' || sub === 'list') {
      const lines = keys.map((k) => {
        const off = PersonalityManager.isAIOff(db, k);
        const nm = PersonalityManager.getDisplayName(k);
        return `  ${off ? '🚫' : '✅'} *${nm}* — AI ${off ? 'OFF (scripts only)' : 'ON'}`;
      });
      const offCount = keys.filter((k) => PersonalityManager.isAIOff(db, k)).length;
      return sock.sendMessage(chatId, {
        text: [
          `🤖 *BOT AI MODES*`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          ...lines,
          ``,
          offCount
            ? `🚫 ${offCount} bot${offCount === 1 ? '' : 's'} on scripts only`
            : `✅ All bots AI-powered (scripts first)`,
          ``,
          `Usage: /aimode <bot|all> <on|off>`,
        ].join('\n'),
      }, { quoted: msg });
    }

    // ── /aimode <bot|all> <on|off> ──
    const mode = (args[1] || '').toLowerCase();
    if (!['on', 'off'].includes(mode)) {
      return sock.sendMessage(chatId, { text: '❌ Usage: /aimode <bot|all> <on|off>' }, { quoted: msg });
    }
    const off = mode === 'off';

    if (sub === 'all') {
      for (const k of keys) PersonalityManager.setAIMode(db, k, off);
      try { saveDatabase(db); } catch (e) {}
      return sock.sendMessage(chatId, {
        text: off
          ? `🚫 AI turned *OFF* for all ${keys.length} bots — scripts only, zero API calls.`
          : `✅ AI turned *ON* for all ${keys.length} bots (scripts still answer first).`,
      }, { quoted: msg });
    }

    const key = PersonalityManager.resolvePersonality(sub);
    if (!key) {
      return sock.sendMessage(chatId, { text: `❌ Unknown bot "${args[0]}". Use /aimode to list bots.` }, { quoted: msg });
    }
    PersonalityManager.setAIMode(db, key, off);
    try { saveDatabase(db); } catch (e) {}
    const nm = PersonalityManager.getDisplayName(key);
    return sock.sendMessage(chatId, {
      text: off
        ? `🚫 *${nm}*'s AI is now *OFF* — chatting from personality scripts only.`
        : `✅ *${nm}*'s AI is now *ON* (scripts still answer small talk first).`,
    }, { quoted: msg });
  },
};
