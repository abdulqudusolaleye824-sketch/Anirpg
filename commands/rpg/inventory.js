// ═══════════════════════════════════════════════════════════════
// /inventory (/inv alias) — Sectioned display + slot detail view
// /inv <number> — shows full item detail with lore (mythic support)
// ═══════════════════════════════════════════════════════════════

module.exports = {
  name: 'inventory',
  aliases: ['inv'],
  description: 'View your full inventory | /inv <#> for item detail',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db     = getDatabase();
    const player = db.users[sender];

    if (!player) {
      return sock.sendMessage(chatId, { text: '❌ You are not registered!\nUse /register [name] to start.' }, { quoted: msg });
    }

    const inv   = player.inventory || {};
    const items = inv.items || [];

    const rarityEmoji = { mythic:'🌌', legendary:'🟠', epic:'🟣', rare:'🔵', uncommon:'🟢', common:'⚪' };
    const rarityOrder = { mythic:0, legendary:1, epic:2, rare:3, uncommon:4, common:5 };

    const gearItems    = items.filter(i => i.isGear || i.type === 'gear');
    const consumables  = items.filter(i => !i.isGear && i.type !== 'gear' && !i.isPetFood && i.type !== 'PetFood');
    const petFoodItems = items.filter(i => i.isPetFood || i.type === 'PetFood');

    // ── /inv <number> — detail view for a gear item ─────────────
    const slotArg = parseInt(args[0]);
    if (!isNaN(slotArg) && slotArg > 0) {
      const sorted = [...gearItems].sort((a,b)=>(rarityOrder[a.rarity]||6)-(rarityOrder[b.rarity]||6));
      const item   = sorted[slotArg - 1];
      if (!item) {
        return sock.sendMessage(chatId, { text: `❌ No gear item in slot ${slotArg}.\nYou have ${sorted.length} gear items.\nUse /inv to see your full inventory.` }, { quoted: msg });
      }
      const re      = rarityEmoji[item.rarity] || '📦';
      const rarName = (item.rarity||'common').charAt(0).toUpperCase() + (item.rarity||'common').slice(1);

      let detail = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      detail += `${re} *${item.name}*\n`;
      detail += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      detail += `🏷️ Rarity: *${rarName}*\n`;
      if (item.slot) detail += `🔹 Slot: *${item.slot}*\n`;
      detail += `🔧 Durability: *${item.durability || '?'}/${item.maxDurability || item.durability || '?'}*\n`;

      // Stats
      const statKeys = Object.entries(item.stats || {}).filter(([k]) => k !== 'special' && k !== 'bonus');
      if (statKeys.length > 0 || item.stats?.bonus) {
        detail += `\n📊 *STATS*\n`;
        if (item.stats?.bonus || item.stats?.atk) {
          const atk = item.stats.atk || item.stats.bonus || 0;
          if (atk > 0) detail += `  ⚔️ ATK: +${atk}\n`;
        }
        for (const [k, v] of statKeys.filter(([k]) => k !== 'atk')) {
          if (v === 0) continue;
          const labels = { def:'🛡️ DEF', hp:'❤️ HP', speed:'💨 SPD', magicPower:'✨ MAGIC', critChance:'💥 CRIT', lifesteal:'💚 LIFESTEAL', def2:'🛡️ DEF+' };
          const label = labels[k] || k.toUpperCase();
          const sign  = v > 0 ? '+' : '';
          detail += `  ${label}: ${sign}${v}\n`;
        }
      }

      // Lore (mythic items have it)
      if (item.lore || item.rarity === 'mythic') {
        detail += `\n📖 *LORE*\n`;
        detail += `_${item.lore || 'No lore recorded for this item.'}_\n`;
      }

      // Special effects
      if (item.stats?.special) {
        detail += `\n⚡ *SPECIAL EFFECT*\n  ${item.stats.special}\n`;
      }

      // Equipped check
      const equippedSlot = item.slot ? player.equippedGear?.[item.slot] : null;
      const isEquipped   = equippedSlot && equippedSlot.name === item.name;
      detail += `\n${isEquipped ? '✅ *EQUIPPED*' : '⭕ Not equipped'}\n`;
      if (!isEquipped && item.slot) detail += `💡 /gear equip ${item.slot} to equip\n`;
      detail += `━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

      return sock.sendMessage(chatId, { text: detail }, { quoted: msg });
    }

    // ── Full inventory view ──────────────────────────────────────
    let message = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🎒 *INVENTORY* — ${player.name}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `💠 Nexus: ${(player.gold||0).toLocaleString()}\n`;
    message += `💎 Mana Stones: ${(player.manaCrystals||0).toLocaleString()}\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    // ── Gear ────────────────────────────────────────────────────
    const sortedGear = [...gearItems].sort((a,b)=>(rarityOrder[a.rarity]||6)-(rarityOrder[b.rarity]||6));
    message += `⚔️ *GEAR* (${sortedGear.length})\n`;
    if (sortedGear.length === 0) {
      message += `  _None — clear dungeons to find gear!_\n`;
    } else {
      sortedGear.forEach((g, i) => {
        const re  = rarityEmoji[g.rarity] || '📦';
        const dur = `🔧${g.durability||'?'}/${g.maxDurability||g.durability||'?'}`;
        const eq  = player.equippedGear?.[g.slot]?.name === g.name ? ' ✅' : '';
        const mythicFlag = g.rarity === 'mythic' ? ' 📖' : '';
        message += `  *${i+1}.* ${re} ${g.name} [${g.slot||'?'}] ${dur}${eq}${mythicFlag}\n`;
      });
      if (sortedGear.some(g => g.rarity === 'mythic')) {
        message += `  📖 = has lore — use /inv <#> to read\n`;
      }
    }
    message += `\n`;

    // ── Potions & Consumables ────────────────────────────────────
    const oldPotions = [];
    if ((inv.healthPotions||0)  > 0) oldPotions.push({ name:'Health Potion',  count:inv.healthPotions,  rarity:'common' });
    if ((inv.energyPotions||inv.manaPotions||0) > 0) oldPotions.push({ name:'Energy Potion', count:inv.energyPotions||inv.manaPotions, rarity:'common' });
    if ((inv.reviveTokens||0)   > 0) oldPotions.push({ name:'Revive Token',   count:inv.reviveTokens,   rarity:'uncommon' });

    message += `💊 *POTIONS & CONSUMABLES*\n`;
    for (const p of oldPotions) {
      message += `  ${rarityEmoji[p.rarity]||'📦'} ${p.name} ×${p.count}\n`;
    }
    const consStacked = {};
    for (const item of consumables) {
      if (!consStacked[item.name]) consStacked[item.name] = { ...item, count: 0 };
      consStacked[item.name].count++;
    }
    const consSorted = Object.values(consStacked).sort((a,b)=>(rarityOrder[a.rarity]||6)-(rarityOrder[b.rarity]||6));
    if (consSorted.length === 0 && oldPotions.length === 0) message += `  _None_\n`;
    for (const item of consSorted) {
      const cnt = item.count > 1 ? ` ×${item.count}` : '';
      message += `  ${rarityEmoji[item.rarity]||'📦'} ${item.name}${cnt}\n`;
    }
    message += `\n`;

    // ── Pet Food ─────────────────────────────────────────────────
    message += `🐾 *PET FOOD*\n`;
    if (petFoodItems.length === 0) {
      message += `  _None_\n`;
    } else {
      const foodStacked = {};
      for (const item of petFoodItems) {
        if (!foodStacked[item.name]) foodStacked[item.name] = { ...item, count: 0 };
        foodStacked[item.name].count++;
      }
      Object.values(foodStacked).sort((a,b)=>(rarityOrder[a.rarity]||6)-(rarityOrder[b.rarity]||6))
        .forEach(item => { message += `  ${rarityEmoji[item.rarity]||'🐾'} ${item.name} ×${item.count}\n`; });
    }
    message += `\n`;

    // ── Attack Patterns ──────────────────────────────────────────
    const ownedAtks    = player.attackPatterns?.owned || [];
    const equippedAtks = player.attackPatterns?.equipped || [];
    if (ownedAtks.length > 0) {
      message += `🥋 *ATTACK PATTERNS* (${ownedAtks.length} owned)\n`;
      if (equippedAtks.length > 0) {
        const { generateAttack, RANK_EMOJI } = require('../../rpg/utils/AttackPatternDB');
        equippedAtks.slice(0, 3).forEach(id => {
          const atk = generateAttack(id);
          if (atk) {
            const re = RANK_EMOJI[atk.rank] || '⬜';
            message += `  ${re} *#${atk.id}* ${atk.name} [${atk.rank}] ×${atk.dmgMult}`;
            if (atk.effect) message += ` ${atk.effect.emoji}`;
            message += ` ✅\n`;
          }
        });
      }
      message += `  💡 /attacks — manage patterns\n\n`;
    }

    // ── Summon Artifacts ─────────────────────────────────────────
    const summonArts = player.summonArtifacts || [];
    message += `🌟 *SUMMON ARTIFACTS* (${summonArts.length})\n`;
    if (summonArts.length === 0) {
      message += `  _None — use /summon to pull!_\n`;
    } else {
      summonArts.slice(0, 5).forEach((a, i) => {
        const re   = rarityEmoji[a.rarity] || '📦';
        const cons = a.constellation > 1 ? ` C${a.constellation}` : '';
        message += `  ${i+1}. ${re} ${a.name} [${(a.rarity||'').toUpperCase()}]${cons}\n`;
      });
      if (summonArts.length > 5) message += `  ...and ${summonArts.length - 5} more\n`;
    }

    message += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `📌 /inv <#>  — item detail + lore\n`;
    message += `📌 /gear     — manage gear\n`;
    message += `📌 /summon   — pull for artifacts\n`;
    message += `📌 /attacks  — attack patterns\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

    return sock.sendMessage(chatId, { text: message }, { quoted: msg });
  }
};
