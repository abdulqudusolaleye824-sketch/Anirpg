// /aimode — Batch-42 REVIVED. AI chat is back (scripts → AI → fallback),
// so per-bot AI on/off matters again. Mods+ only. /aimode shows the
// roster; /aimode <bot|all> <on|off> flips AI chat for that bot.
// AI-off bots answer from personality scripts only (instant, offline).

'use strict';

const PersonalityManager = require('../../bots/PersonalityManager');
const Perms = require('../../utils/permissions');

module.exports = {
  name: 'aimode',
  aliases: ['botai'],
  description: '🤖 Per-bot AI chat on/off (mods)',
  usage: '/aimode | /aimode <bot|all> <on|off>',
  category: 'system',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key?.remoteJid;
    const db = getDatabase ? getDatabase() : {};
    const say = (text) => sock.sendMessage(chatId, { text }, { quoted: msg });

    let mod = false;
    try { mod = Perms.isBotMod(db, sender); } catch (_) {}
    if (!mod) return say(`❌ Mods only.`);

    const keys = PersonalityManager.getAllPersonalities();
    const matchKey = (s) => {
      const t = String(s || '').toLowerCase();
      return keys.find((k) => k.toLowerCase() === t
        || (PersonalityManager.getDisplayName(k) || '').toLowerCase() === t);
    };

    // ── /aimode — status roster ──
    if (!args.length) {
      const lines = [
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `🤖 *AI Chat Modes*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `✅ AI on = scripts + AI chat`,
        `💤 AI-off = scripts only`,
        ``,
      ];
      for (const k of keys) {
        let off = false;
        try { off = PersonalityManager.isAIOff(db, k); } catch (_) {}
        lines.push(`${off ? '💤' : '✅'} *${PersonalityManager.getDisplayName(k)}*`);
      }
      lines.push(``, `📌 /aimode <bot|all> <on|off>`, `━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      return say(lines.join('\n'));
    }

    // ── /aimode <bot|all> <on|off> ──
    const who = String(args[0] || '').toLowerCase();
    const what = String(args[1] || '').toLowerCase();
    if (!['on', 'off'].includes(what)) {
      return say(`❌ Usage: /aimode <bot|all> <on|off>\n\n📌 /aimode — show all modes`);
    }
    const off = what === 'off';

    if (who === 'all') {
      for (const k of keys) {
        try { PersonalityManager.setAIMode(db, k, off); } catch (_) {}
      }
      try { if (saveDatabase) saveDatabase(); } catch (_) {}
      return say(off
        ? `💤 AI chat OFF for all bots — scripts only.`
        : `✅ AI chat ON for all bots.`);
    }

    const key = matchKey(who);
    if (!key) return say(`❌ Unknown bot "${args[0]}".\n\n📌 /aimode — list bots`);
    try { PersonalityManager.setAIMode(db, key, off); } catch (_) {}
    try { if (saveDatabase) saveDatabase(); } catch (_) {}
    return say(off
      ? `💤 *${PersonalityManager.getDisplayName(key)}*: AI chat OFF — scripts only.`
      : `✅ *${PersonalityManager.getDisplayName(key)}*: AI chat ON.`);
  },
};
