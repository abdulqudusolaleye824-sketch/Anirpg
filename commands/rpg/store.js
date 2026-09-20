// ═══════════════════════════════════════════════════════════════
// /store — THE ARMORY (Push #76). Daily-rotating pre-crafted weapons + gear.
//   /store            today's stock (all ranks)
//   /store S          one rank
//   /store info 17    lore + full stats
//   /store buy 17     purchase → goes to /inv (equip with /equip <inv #>)
// ═══════════════════════════════════════════════════════════════
'use strict';

const Armory = require('../../rpg/utils/ArmoryStore');

module.exports = {
  name: 'store',
  aliases: ['armory', 'armoury', 'weaponshop', 'gearshop'],
  description: 'Daily armory — buy weapons & gear',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];
    if (!player) return sock.sendMessage(chatId, { text: '❌ Register first! Use /register' }, { quoted: msg });
    const UI = require('../../rpg/utils/UI');
    const pro = UI.isPro(player);
    const FRAME = pro ? UI.PRO_BAR : UI.FREE_BAR;
    let Buttons = null; try { Buttons = require('../../utils/buttons'); } catch (e) {}

    const sub = (args[0] || '').toLowerCase();

    if (sub === 'info' || sub === 'view' || sub === 'i') {
      const it = Armory.findStock(args[1]);
      if (!it) return sock.sendMessage(chatId, { text: '❌ No such item in today\'s stock. See /store.' }, { quoted: msg });
      return sock.sendMessage(chatId, { text: `${FRAME}\n${Armory.renderDetail(it)}\n${FRAME}` }, { quoted: msg });
    }

    if (sub === 'buy' || sub === 'b') {
      const r = Armory.buy(player, args[1]);
      if (!r.ok) return sock.sendMessage(chatId, { text: `❌ ${r.error}` }, { quoted: msg });
      saveDatabase();
      let invNo = null;
      try { const L = require('./inventory')._serialList(player); const ix = L.findIndex(e => e.ref && e.ref.id === r.inst.id); if (ix >= 0) invNo = ix + 1; } catch (e) {}
      const text = [
        `${FRAME}`, `✅ *PURCHASED* ${r.inst.emoji} *${r.inst.name}*`, `${FRAME}`,
        Armory.statLine(r.item), `🔧 Durability: *${r.inst.durability}/${r.inst.maxDurability}* (scaled to Lv.${player.level})`,
        `📖 _${r.inst.lore}_`, ``,
        `💰 Paid ${Armory.priceLine(r.item.price)}`, `💠 Nexus left: ${Number(player.gold || 0).toLocaleString()}${r.item.price.stones ? ` · 💎 Stones left: ${Number(player.manaCrystals || 0).toLocaleString()}` : ''}`,
        ``, invNo ? `🎒 It's *#${invNo}* in /inv — equip with */equip ${invNo}*` : `🎒 Find it in /inv and equip with /equip <#>`,
        `🎁 Transferable: /equip gift <#> @player`,
      ].join('\n');
      if (Buttons?.sendButtons && invNo) {
        try {
          return await Buttons.sendButtons(sock, chatId, { text, footer: 'Armory', buttons: Buttons.quickReplies([[`⚔️ Equip now`, `/equip ${invNo}`], [`🎒 Inventory`, `/inv`], [`🏪 Back to store`, `/store`]]) }, msg);
        } catch (e) {}
      }
      return sock.sendMessage(chatId, { text }, { quoted: msg });
    }

    const rank = Armory.RANKS.includes(sub.toUpperCase()) ? sub.toUpperCase() : null;
    const { lines, rotatesIn } = Armory.renderStock(rank);
    const head = [
      pro ? `${UI.PRO_BAR}\n🏪 *THE ARMORY* 💎\n${UI.PRO_BAR}` : `🏪 *THE ARMORY*\n${UI.FREE_BAR}`,
      `🔄 Stock rotates in *${rotatesIn}* (daily, 00:00 WAT)`,
      `💠 ${Number(player.gold || 0).toLocaleString()} · 💎 ${Number(player.manaCrystals || 0).toLocaleString()}`,
      rank ? `Showing *${rank}-rank* only — /store for all` : `Filter: /store E · D · C · B · A · S`,
    ];
    const foot = [``, FRAME, `🔎 */store info <#>* lore + stats  ·  🛒 */store buy <#>*`, `⚠️ Weapons & gear come ONLY from here. Durability drops per fight — items *break at 0*. 🛠️ Mending Stone = full repair.`];
    const text = [...head, ...lines, ...foot].join('\n');
    if (Buttons?.sendButtons) {
      try {
        const btns = rank ? [[`🏪 All ranks`, `/store`], [`🎒 Inventory`, `/inv`]] : [[`🟣 B-rank`, `/store B`], [`🟠 A-rank`, `/store A`], [`🌌 S-rank`, `/store S`]];
        return await Buttons.sendButtons(sock, chatId, { text, footer: `Armory · ${Armory.dayKey()}`, buttons: Buttons.quickReplies(btns) }, msg);
      } catch (e) {}
    }
    return sock.sendMessage(chatId, { text }, { quoted: msg });
  },
};
