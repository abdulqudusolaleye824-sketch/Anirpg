// ═══════════════════════════════════════════════════════════════
// /gear — View, Equip, Unequip, Give gear
// ═══════════════════════════════════════════════════════════════

const { GEAR_SLOTS, SLOT_INFO, RARITY_CONFIG, equipGear, unequipGear, formatEquipped, getEquippedBonuses } = require('../../rpg/utils/GearSystem');

module.exports = {
  name: 'gear',
  description: 'Manage your equipped gear',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];

    if (!player) return sock.sendMessage(chatId, { text: '❌ Not registered! Use /register [name]' }, { quoted: msg });
    const UI = require('../../rpg/utils/UI');
    const pro = UI.isPro(player);
    const FRAME = pro ? UI.PRO_BAR : UI.FREE_BAR;
    if (!player.inventory) player.inventory = {};
    if (!player.inventory.items) player.inventory.items = [];
    if (!player.equippedGear) player.equippedGear = {};

    const sub = (args[0] || '').toLowerCase();

    // ── /gear (no args) — show equipped + gear inventory ──────
    if (!sub || sub === 'show') {
      const gearItems = player.inventory.items.filter(i => i.isGear);
      const bonuses = getEquippedBonuses(player);

      const rarityOrder = { mythic:0, legendary:1, epic:2, rare:3, uncommon:4, common:5 };
      gearItems.sort((a,b) => (rarityOrder[a.rarity]||6) - (rarityOrder[b.rarity]||6));

      let msg2 = pro ? `${UI.PRO_BAR}\n⚔️ *GEAR* 💎\n${UI.PRO_BAR}\n\n` : `⚔️ *GEAR*\n${UI.FREE_BAR}\n\n`;

      msg2 += '🛡️ *EQUIPPED*\n';
      msg2 += formatEquipped(player);
      msg2 += '\n';

      if (Object.values(player.equippedGear).length > 0) {
        const b = bonuses;
        msg2 += '📊 *TOTAL GEAR BONUSES*\n';
        if (b.hp > 0)           msg2 += `   ❤️ +${b.hp} HP\n`;
        if (b.atk > 0)          msg2 += `   ⚔️ +${b.atk} ATK\n`;
        if (b.def > 0)          msg2 += `   🛡️ +${b.def} DEF\n`;
        if (b.speed > 0)        msg2 += `   💨 +${b.speed} SPD\n`;
        if (b.crit > 0)         msg2 += `   💥 +${b.crit}% CRIT\n`;
        if (b.critDmg > 0)      msg2 += `   🔥 +${b.critDmg}% CRIT DMG\n`;
        if (b.evasion > 0)      msg2 += `   👻 +${b.evasion}% EVASION\n`;
        if (b.statusResist > 0) msg2 += `   🛡️ +${b.statusResist}% STATUS RESIST\n`;
        for (const sp of b.specials) msg2 += `   ✨ ${sp.desc}\n`;
        msg2 += '\n';
      }

      msg2 += `${FRAME}\n`;
      msg2 += '📦 *GEAR INVENTORY*\n\n';

      if (gearItems.length === 0) {
        msg2 += '❌ No gear in inventory.\nClear dungeons to find gear drops!\n';
      } else {
        gearItems.forEach((g, i) => {
          const rc = RARITY_CONFIG[g.rarity] || RARITY_CONFIG.common;
          const si = SLOT_INFO[g.slot] || { emoji: '🎒', name: g.slot };
          const dur = `${g.durability}/${g.maxDurability}`;
          msg2 += `${i+1}. ${rc.emoji}${si.emoji} *${g.name}* [${si.name}]\n`;
          msg2 += `   🔧 ${dur} durability\n`;
          const statStr = Object.entries(g.stats||{}).filter(([k])=>k!=='special').map(([k,v])=>`+${v} ${k.toUpperCase()}`).join(', ');
          if (statStr) msg2 += `   📊 ${statStr}\n`;
          if (g.special) msg2 += `   ✨ ${g.special.desc}\n`;
          msg2 += '\n';
        });
      }

      msg2 += `${FRAME}\n`;
      msg2 += '/gear equip <#> — equip from list\n';
      msg2 += '/gear unequip <slot> — e.g. /gear unequip helmet\n';
      msg2 += '/gear give <#> @user — transfer gear\n';
      msg2 += `${FRAME}` + (pro ? `\n${UI.PRO_MINI}\n💎 *PRO GEAR* — ${Object.values(player.equippedGear).length} equipped · ${gearItems.length} banked` : `\n${UI.upsell()}`);

      return sock.sendMessage(chatId, { text: msg2 }, { quoted: msg });
    }

    // ── /gear equip <number> ───────────────────────────────────
    if (sub === 'equip') {
      const num = parseInt(args[1]);
      if (!num || isNaN(num)) return sock.sendMessage(chatId, { text: '❌ Usage: /gear equip <number>\nUse /gear to see your list.' }, { quoted: msg });

      const gearItems = player.inventory.items.filter(i => i.isGear);
      const rarityOrder = { mythic:0, legendary:1, epic:2, rare:3, uncommon:4, common:5 };
      gearItems.sort((a,b) => (rarityOrder[a.rarity]||6) - (rarityOrder[b.rarity]||6));

      if (num < 1 || num > gearItems.length) {
        return sock.sendMessage(chatId, { text: `❌ Invalid number. You have ${gearItems.length} gear item(s).` }, { quoted: msg });
      }

      const piece = gearItems[num - 1];
      // Heal bad-slot gear from earlier builds, then resolve defensively.
      try { require('../../rpg/utils/RewardInventory').repairGearSlots(player); } catch (e) {}
      const si = SLOT_INFO[piece.slot] || { emoji: '🎒', name: piece.slot || 'Gear' };
      const hadOld = player.equippedGear[piece.slot];

      equipGear(player, piece);
      saveDatabase();

      let reply = pro ? `${UI.PRO_BAR}\n✅ *GEAR EQUIPPED!* 💎\n${UI.PRO_BAR}\n\n✅ Equipped *${piece.name}*!\n` : `✅ Equipped *${piece.name}*!\n`;
      if (hadOld) reply += `⚠️ Previous ${si.name} (${hadOld.name}) was destroyed.\n`;
      reply += `\n${si.emoji} ${si.name} slot now active.\n${FRAME}` + (pro ? `\n${UI.PRO_MINI}\n💎 *PRO GEAR* — ${si.name} active` : `\n${UI.upsell()}`);

      return sock.sendMessage(chatId, { text: reply }, { quoted: msg });
    }

    // ── /gear unequip <slot> ───────────────────────────────────
    if (sub === 'unequip') {
      const slotName = (args[1] || '').toLowerCase();
      if (!GEAR_SLOTS.includes(slotName)) {
        return sock.sendMessage(chatId, {
          text: '❌ Invalid slot!\n\nSlots: ' + GEAR_SLOTS.join(', ')
        }, { quoted: msg });
      }

      const piece = unequipGear(player, slotName);
      if (!piece) {
        return sock.sendMessage(chatId, { text: `❌ Nothing equipped in ${slotName} slot.` }, { quoted: msg });
      }

      // Return to inventory at CURRENT durability (never destroyed).
      if (!player.inventory) player.inventory = {};
      if (!Array.isArray(player.inventory.items)) player.inventory.items = [];
      if (!piece.id) piece.id = 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      player.inventory.items.push(piece);
      saveDatabase();
      return sock.sendMessage(chatId, {
        text: `📦 *${piece.name}* removed from ${SLOT_INFO[slotName].emoji} ${slotName} slot and returned to your inventory.\n🔧 Durability: *${piece.durability ?? '?'}/${piece.maxDurability ?? '?'}*`
      }, { quoted: msg });
    }

    // ── /gear give <number> @user ──────────────────────────────
    if (sub === 'give') {
      const num = parseInt(args[1]);
      if (!num || isNaN(num)) return sock.sendMessage(chatId, { text: '❌ Usage: /gear give <#> @user' }, { quoted: msg });

      const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
                     || msg.message?.extendedTextMessage?.contextInfo?.participant;
      if (!mentioned) return sock.sendMessage(chatId, { text: '❌ Tag a player! /gear give <#> @user' }, { quoted: msg });
      if (mentioned === sender) return sock.sendMessage(chatId, { text: '❌ You cannot give gear to yourself.' }, { quoted: msg });

      const target = db.users[mentioned];
      if (!target) return sock.sendMessage(chatId, { text: '❌ That player is not registered.' }, { quoted: msg });

      const gearItems = player.inventory.items.filter(i => i.isGear);
      const rarityOrder = { mythic:0, legendary:1, epic:2, rare:3, uncommon:4, common:5 };
      gearItems.sort((a,b) => (rarityOrder[a.rarity]||6) - (rarityOrder[b.rarity]||6));

      if (num < 1 || num > gearItems.length) return sock.sendMessage(chatId, { text: `❌ Invalid number. You have ${gearItems.length} gear item(s).` }, { quoted: msg });

      const piece = gearItems[num - 1];

      // Remove from sender
      const idx = player.inventory.items.findIndex(i => i.id === piece.id);
      if (idx !== -1) player.inventory.items.splice(idx, 1);

      // Add to target
      if (!target.inventory) target.inventory = {};
      if (!target.inventory.items) target.inventory.items = [];
      target.inventory.items.push(piece);

      saveDatabase();

      const rc = RARITY_CONFIG[piece.rarity] || RARITY_CONFIG.common;
      return sock.sendMessage(chatId, {
        text: (pro ? `${UI.PRO_BAR}\n📦 *GEAR SENT!* 💎\n${UI.PRO_BAR}\n\nSent *${rc.emoji} ${piece.name}* to *${target.name}*!\n\nThey'll find it in their /gear inventory.\n${UI.PRO_BAR}\n${UI.PRO_MINI}\n💎 *PRO GEAR* — sent ${piece.name}` : `📦 Sent *${rc.emoji} ${piece.name}* to *${target.name}*!\n\nThey'll find it in their /gear inventory.\n${UI.FREE_BAR}\n${UI.upsell()}`)
      }, { quoted: msg });
    }

    return sock.sendMessage(chatId, {
      text: (pro ? `${UI.PRO_BAR}\n⚔️ *GEAR COMMANDS* 💎\n${UI.PRO_BAR}\n\n/gear — view gear\n/gear equip <#>\n/gear unequip <slot>\n/gear give <#> @user\n${UI.PRO_BAR}\n${UI.PRO_MINI}\n💎 *PRO GEAR* — manage your kit` : `⚔️ *GEAR COMMANDS*\n${UI.FREE_BAR}\n\n/gear — view gear\n/gear equip <#>\n/gear unequip <slot>\n/gear give <#> @user\n${UI.FREE_BAR}\n${UI.upsell()}`)
    }, { quoted: msg });
  }
};
