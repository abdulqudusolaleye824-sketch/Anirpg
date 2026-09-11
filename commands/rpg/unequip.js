// ═══════════════════════════════════════════════════════════════
// /unequip <name> [slot] — Unequip gear by item name
// Same-name conflicts (one name equipped in two slots) are resolved by
// listing every match and asking for the slot: /unequip <name> <slot>.
// NOTE: like /gear unequip, removed pieces RETURN to inventory at current durability (never destroyed).
// ═══════════════════════════════════════════════════════════════

'use strict';

const { GEAR_SLOTS, SLOT_INFO, unequipGear } = require('../../rpg/utils/GearSystem');
const UI = require('../../rpg/utils/UI');

module.exports = {
  name: 'unequip',
  description: 'Remove equipped gear by name | /unequip <name> [slot]',
  usage: '/unequip <name> [slot]',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];

    if (!player) {
      return sock.sendMessage(chatId, { text: '❌ You are not registered!\nUse /register [name] to start.' }, { quoted: msg });
    }
    const pro = UI.isPro(player);
    const FRAME = pro ? UI.PRO_BAR : UI.FREE_BAR;
    if (!player.equippedGear) player.equippedGear = {};

    const equipped = GEAR_SLOTS
      .map(slot => ({ slot, piece: player.equippedGear[slot] }))
      .filter(e => e.piece);

    const query = args.join(' ').trim();
    if (!query) {
      let txt = pro ? `${UI.PRO_BAR}\n🗑️ *UNEQUIP* 💎\n${UI.PRO_BAR}\n` : `🗑️ *UNEQUIP*\n${UI.FREE_BAR}\n`;
      txt += equipped.length ? `\n*EQUIPPED*\n` : `\n_Nothing equipped._\n`;
      for (const { slot, piece } of equipped) {
        const si = SLOT_INFO[slot] || { emoji: '🎒', name: slot };
        txt += `  ${si.emoji} ${piece.name} _(${slot})_\n`;
      }
      txt += `\n${FRAME}\n📌 Usage: /unequip <name>\n📌 Conflict? add the slot: /unequip <name> <slot>\n📦 Removed gear returns to your inventory.`;
      txt += pro ? `\n${FRAME}` : `\n${FRAME}\n${UI.upsell()}`;
      return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
    }

    // Optional trailing slot qualifier: /unequip <name> <slot>
    let slotFilter = null;
    let nameQuery = query;
    const parts = query.split(/\s+/);
    if (parts.length > 1 && GEAR_SLOTS.includes(parts[parts.length - 1].toLowerCase())) {
      slotFilter = parts.pop().toLowerCase();
      nameQuery = parts.join(' ');
    }
    const q = nameQuery.toLowerCase();

    let matches = equipped.filter(({ piece }) => (piece.name || '').toLowerCase().includes(q));
    if (slotFilter) matches = matches.filter(({ slot }) => slot === slotFilter);

    if (matches.length === 0) {
      return sock.sendMessage(chatId, {
        text: `❌ Nothing equipped matches *${nameQuery}*${slotFilter ? ` in slot ${slotFilter}` : ''}.\n\nUse /unequip to see what's equipped.`
      }, { quoted: msg });
    }

    if (matches.length > 1) {
      let txt = `⚠️ *${matches.length} equipped items match "${nameQuery}":*\n${FRAME}\n`;
      for (const { slot, piece } of matches) {
        const si = SLOT_INFO[slot] || { emoji: '🎒', name: slot };
        txt += `  ${si.emoji} *${piece.name}* — slot: \`${slot}\`\n`;
      }
      txt += `${FRAME}\n📌 Be specific: /unequip ${nameQuery} <slot>\n⚠️ Nothing was removed.`;
      return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
    }

    const { slot, piece } = matches[0];
    const si = SLOT_INFO[slot] || { emoji: '🎒', name: slot };
    unequipGear(player, slot);
    // Return to inventory at CURRENT durability (never destroyed).
    if (!player.inventory) player.inventory = {};
    if (!Array.isArray(player.inventory.items)) player.inventory.items = [];
    if (!piece.id) piece.id = 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    player.inventory.items.push(piece);
    saveDatabase();

    const txt = pro
      ? `${UI.PRO_BAR}\n📦 *UNEQUIPPED!* 💎\n${UI.PRO_BAR}\n\n${si.emoji} *${piece.name}* removed from ${si.name} slot and returned to your inventory.\n🔧 Durability: *${piece.durability ?? '?'}/${piece.maxDurability ?? '?'}*\n${UI.PRO_BAR}\n${UI.PRO_MINI}\n💎 *PRO KIT* — ${si.name} slot open`
      : `📦 *${piece.name}* removed from ${si.emoji} ${slot} slot and returned to your inventory.\n🔧 Durability: *${piece.durability ?? '?'}/${piece.maxDurability ?? '?'}*\n${UI.FREE_BAR}\n${UI.upsell()}`;
    return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
  }
};
