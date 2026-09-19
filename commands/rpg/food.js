// /food — pet food pantry (Push #71: one id-keyed bucket, feeds /pet feed)
// /food                         — numbered list of what you own
// /food give [#] [qty] @player  — transfer food to another player
'use strict';

const UI = require('../../rpg/utils/UI');
const PDB = require('../../rpg/utils/PetDatabase');

function pantry(player) {
  PDB.normalisePetFood(player);
  const bag = player.inventory?.petFood || {};
  return Object.entries(bag)
    .filter(([, n]) => (n | 0) > 0)
    .map(([id, n]) => ({ id, count: n | 0, ...(PDB.PET_FOOD[id] || { name: id, emoji: '🍖', hungerRestore: 0, bondingBonus: 0, xpBonus: 0, cost: 0 }) }))
    .sort((a, b) => (b.cost || 0) - (a.cost || 0) || a.name.localeCompare(b.name));
}

module.exports = {
  name: 'food',
  aliases: ['pantry', 'petfood'],
  description: 'View and transfer your pet food',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];
    if (!player) return sock.sendMessage(chatId, { text: '❌ You are not registered!' }, { quoted: msg });

    const pro = UI.isPro(player);
    const FRAME = pro ? UI.PRO_BAR : UI.FREE_BAR;
    const sub = (args[0] || '').toLowerCase();
    const list = pantry(player);

    // ── /food give [#] [qty] @player ─────────────────────────────
    if (sub === 'give') {
      const itemNum = parseInt(args[1]);
      const qty = Math.max(1, parseInt(args[2]) || 1);
      if (!itemNum || itemNum < 1 || itemNum > list.length) {
        return sock.sendMessage(chatId, { text: `❌ Invalid food number!\n\nUse /food to see your numbered list.\nExample: /food give 1 5 @player` }, { quoted: msg });
      }
      const ctx = msg.message?.extendedTextMessage?.contextInfo;
      const recipientId = ctx?.mentionedJid?.[0] || ctx?.participant;
      if (!recipientId) return sock.sendMessage(chatId, { text: `❌ Tag or reply to a player!\nExample: /food give ${itemNum} ${qty} @player` }, { quoted: msg });
      if (recipientId === sender) return sock.sendMessage(chatId, { text: `❌ Can't give to yourself!` }, { quoted: msg });
      let recipient = db.users[recipientId];
      if (!recipient) {
        try { recipient = require('../../rpg/utils/GuildContractManager').findUserInDb(db, require('../../rpg/utils/GuildContractManager').normaliseJid(recipientId)); } catch (e) {}
      }
      if (!recipient) return sock.sendMessage(chatId, { text: `❌ That player is not registered!` }, { quoted: msg });

      const sel = list[itemNum - 1];
      if (qty > sel.count) return sock.sendMessage(chatId, { text: `❌ You only have ${sel.count}× *${sel.name}*!` }, { quoted: msg });

      PDB.consumePetFood(player, sel.id, qty);
      PDB.addPetFood(recipient, sel.id, qty);
      saveDatabase();

      return sock.sendMessage(chatId, {
        text: [
          ...(pro ? [UI.PRO_BAR, `🍖 *FOOD TRANSFERRED!* 💎`, UI.PRO_BAR] : [`🍖 *FOOD TRANSFERRED!*`, UI.FREE_BAR]),
          ``,
          `${sel.emoji} *${sel.name}* ×${qty}`,
          ``,
          `📤 From: *${player.name}*`,
          `📥 To: *${recipient.name}*`,
          FRAME,
          ...(pro ? [UI.PRO_MINI, `💎 *PRO PANTRY* — sent ${sel.name} ×${qty}`] : [UI.upsell()]),
        ].join('\n'),
        mentions: [recipientId],
      }, { quoted: msg });
    }

    // ── Default: numbered pantry ─────────────────────────────────
    if (!list.length) {
      return sock.sendMessage(chatId, {
        text: [
          ...(pro ? [UI.PRO_BAR, `🍖 *PET FOOD* 💎`, UI.PRO_BAR] : [`🍖 *PET FOOD*`, UI.FREE_BAR]),
          ``,
          `❌ Your pantry is empty.`,
          ``,
          `🛍️ Buy: */pet foods* → \`/pet buy <food> [qty]\` (💠 Nexus)`,
          `⚔️ Or clear gates — monsters drop food.`,
          FRAME,
          ...(pro ? [UI.PRO_MINI, `💎 *PRO PANTRY* — pantry empty`] : [UI.upsell()]),
        ].join('\n'),
      }, { quoted: msg });
    }

    const lines = [
      ...(pro ? [UI.PRO_BAR, `🍖 *PET FOOD PANTRY* 💎`, UI.PRO_BAR] : [`🍖 *PET FOOD PANTRY*`, UI.FREE_BAR]),
      ``,
      ...list.map((f, i) => `*${i + 1}.* ${f.emoji} ${f.name} ×${f.count}  _(hunger -${f.hungerRestore} · bond +${f.bondingBonus} · xp +${f.xpBonus})_\n     🍖 \`/pet feed [#] ${f.id}\``),
      ``,
      FRAME,
      `📤 /food give [#] [qty] @player   ·   🛍️ /pet foods`,
      ...(pro ? [UI.PRO_MINI, `💎 *PRO PANTRY* — ${list.reduce((a, f) => a + f.count, 0)} portions across ${list.length} kinds`] : [UI.upsell()]),
    ];
    return sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: msg });
  },
};
