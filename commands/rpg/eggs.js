// ═══════════════════════════════════════════════════════════════
// /eggs — egg bag · /egg <#> — one egg's info · /eggs give <#> @player
// (Push #74; companion to /pet mate)
// ═══════════════════════════════════════════════════════════════
'use strict';

const PetManager = require('../../rpg/utils/PetManager');
const PB = require('../../rpg/utils/PetBreeding');
const UI = require('../../rpg/utils/UI');

module.exports = {
  name: 'eggs',
  aliases: ['egg'],
  description: 'View your pet eggs, inspect one, or give one away',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users?.[sender];
    if (!player) return sock.sendMessage(chatId, { text: '❌ Register first with /register' }, { quoted: msg });
    const pro = UI.isPro(player);
    const FRAME = pro ? UI.PRO_BAR : UI.FREE_BAR;
    const eggs = PetManager.getPlayerData(sender).eggs || [];
    const a0 = (args[0] || '').toLowerCase();

    if (a0 === 'give' || a0 === 'gift') {
      const ctx = msg.message?.extendedTextMessage?.contextInfo || {};
      const to = ctx.mentionedJid?.[0] || ctx.participant || null;
      const idx = parseInt(args[1], 10) - 1;
      if (!to || isNaN(idx)) return sock.sendMessage(chatId, { text: '❌ Usage: /eggs give <#> @player' }, { quoted: msg });
      const r = PB.giveEgg(sender, idx, to);
      return sock.sendMessage(chatId, { text: r.message + (r.success ? `\n→ @${String(to).split('@')[0]}` : ''), mentions: r.success ? [to] : [] }, { quoted: msg });
    }

    if (/^\d+$/.test(a0) || a0 === 'info') {
      const idx = parseInt(/^\d+$/.test(a0) ? a0 : args[1], 10) - 1;
      if (isNaN(idx) || !eggs[idx]) return sock.sendMessage(chatId, { text: `❌ No egg #${idx + 1}. You have ${eggs.length} egg(s) — /eggs` }, { quoted: msg });
      return sock.sendMessage(chatId, { text: `🥚 *EGG INFO*\n${FRAME}\n${PB.eggInfo(eggs[idx], idx)}\n${FRAME}` }, { quoted: msg });
    }

    if (!eggs.length) {
      return sock.sendMessage(chatId, { text: `🥚 *No eggs yet!*\n\nFind eggs on dungeon floors, or breed two pets: */pet mate <#> <#>* (♂️ + ♀️).\n\n⚪ Common 65% · 🔥 Fire 25% · 🌑 Shadow 8% · ✨ Ancient 2%` }, { quoted: msg });
    }
    let txt = pro ? `${UI.PRO_BAR}\n🥚 *YOUR EGGS* 💎 (${eggs.length}/5)\n${UI.PRO_BAR}\n` : `🥚 *YOUR EGGS* (${eggs.length}/5)\n${UI.FREE_BAR}\n`;
    eggs.forEach((egg, i) => {
      txt += `*${i + 1}.* ${egg.emoji} *${egg.name}* [${String(egg.rarity || 'common').toUpperCase()}]${egg.mixed ? ' 🌈' : ''}${egg.bred ? ' 🧬' : ''}\n   ${egg.desc}\n\n`;
    });
    txt += `${FRAME}\n/egg <#> — details · /pet hatch <#> — hatch · /eggs give <#> @player`;
    return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
  },
};
