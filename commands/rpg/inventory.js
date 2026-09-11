// ═══════════════════════════════════════════════════════════════
// /inventory (/inv alias) — Sectioned display + slot detail view
// /inv <number> — shows full item detail with lore (mythic support)
// ═══════════════════════════════════════════════════════════════

const UI = require('../../rpg/utils/UI');

const RARITY_ORDER = { mythic: 0, legendary: 1, epic: 2, rare: 3, uncommon: 4, common: 5 };
// Shared gear ordering — /inv, /inv <#>, /gear AND /equip <# serials> all
// resolve through this so a serial number means the same thing everywhere.
function sortGear(arr) {
  return [...arr].sort((a, b) => (RARITY_ORDER[a.rarity] || 6) - (RARITY_ORDER[b.rarity] || 6));
}
function collectBuckets(player) {
  const inv = player.inventory || {};
  const items = inv.items || [];
  const legacyGear = [...(inv.weapons || []), ...(inv.armor || []), ...(inv.accessories || [])]
    .map(g => ({ ...g, isGear: true, type: 'gear', slot: g.slot || (g.type === 'armor' ? 'chestplate' : 'vambrace'), rarity: g.rarity || 'rare' }));
  const gearItems    = [...items.filter(i => i.isGear || i.type === 'gear'), ...legacyGear];
  const legacyMats   = (inv.materials || []).map(m => (typeof m === 'string' ? { name: m, type: 'material', rarity: 'common' } : { ...m, type: 'material', rarity: m.rarity || 'common' }));
  const consumables  = [...items.filter(i => !i.isGear && i.type !== 'gear' && !i.isPetFood && i.type !== 'PetFood'), ...legacyMats];
  const petFoodItems = items.filter(i => i.isPetFood || i.type === 'PetFood');
  return { gearItems, consumables, petFoodItems };
}

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
    const pro = UI.isPro(player);
    const FRAME = pro ? UI.PRO_BAR : UI.FREE_BAR;

    const inv   = player.inventory || {};
    const items = inv.items || [];

    const rarityEmoji = { mythic:'🌌', legendary:'🟠', epic:'🟣', rare:'🔵', uncommon:'🟢', common:'⚪' };
    const rarityOrder = { mythic:0, legendary:1, epic:2, rare:3, uncommon:4, common:5 };

    const { gearItems, consumables, petFoodItems } = collectBuckets(player);

    // ── /inv <number> — detail view for a gear item ─────────────
    const slotArg = parseInt(args[0]);
    if (!isNaN(slotArg) && slotArg > 0) {
      const sorted = sortGear(gearItems);
      const item   = sorted[slotArg - 1];
      if (!item) {
        return sock.sendMessage(chatId, { text: `❌ No gear item in slot ${slotArg}.\nYou have ${sorted.length} gear items.\nUse /inv to see your full inventory.` }, { quoted: msg });
      }
      const re      = rarityEmoji[item.rarity] || '📦';
      const rarName = (item.rarity||'common').charAt(0).toUpperCase() + (item.rarity||'common').slice(1);

      let detail = pro ? `${UI.PRO_BAR}\n${re} *${item.name}* 💎\n${UI.PRO_BAR}\n` : `${re} *${item.name}*\n${UI.FREE_BAR}\n`;
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
      if (!isEquipped) detail += `💡 /equip ${slotArg} to equip this item\n`;
      detail += pro ? UI.PRO_BAR : `${UI.FREE_BAR}\n${UI.upsell()}`;

      return sock.sendMessage(chatId, { text: detail }, { quoted: msg });
    }

    const sub = String(args[0] || '').toLowerCase();

    // ── /inv (default) — simple list of OWNED ITEMS only ───────
    // No currencies, no passes, no extras — those live on /inv info.
    if (sub !== 'info' && sub !== 'dashboard') {
      const sg = sortGear(gearItems);
      let simple = pro
        ? `${UI.PRO_BAR}\n🎒 *INVENTORY* — ${player.name} 💎\n${UI.PRO_BAR}\n`
        : `🎒 *INVENTORY* — ${player.name}\n${UI.FREE_BAR}\n`;
      simple += `\n⚔️ *GEAR* (${sg.length})\n`;
      if (sg.length === 0) {
        simple += `  _None — clear dungeons to find gear!_\n`;
      } else {
        sg.forEach((g, i) => {
          const eq = player.equippedGear?.[g.slot]?.name === g.name ? ' ✅' : '';
          simple += `  *${i + 1}.* ${rarityEmoji[g.rarity] || '📦'} ${g.name} [${g.slot || '?'}]${eq}\n`;
        });
      }
      const _stack = (arr) => {
        const m = {};
        for (const it of arr) {
          if (!m[it.name]) m[it.name] = { name: it.name, rarity: it.rarity || 'common', count: 0 };
          m[it.name].count++;
        }
        return Object.values(m).sort((x, y) => (rarityOrder[x.rarity] || 6) - (rarityOrder[y.rarity] || 6));
      };
      simple += `\n💊 *CONSUMABLES*\n`;
      const _cons = _stack(consumables);
      if ((inv.healthPotions || 0) > 0) simple += `  💚 Health Potion ×${inv.healthPotions}\n`;
      if ((inv.energyPotions || inv.manaPotions || 0) > 0) simple += `  ⚡ Energy Potion ×${inv.energyPotions || inv.manaPotions}\n`;
      if ((inv.reviveTokens || 0) > 0) simple += `  💿 Revive Token ×${inv.reviveTokens}\n`;
      if (_cons.length === 0 && !(inv.healthPotions || inv.energyPotions || inv.manaPotions || inv.reviveTokens)) simple += `  _None_\n`;
      for (const c of _cons) simple += `  ${rarityEmoji[c.rarity] || '📦'} ${c.name}${c.count > 1 ? ` ×${c.count}` : ''}\n`;
      simple += `\n🐾 *PET FOOD*\n`;
      const _food = _stack(petFoodItems);
      if (_food.length === 0) simple += `  _None_\n`;
      for (const f of _food) simple += `  ${rarityEmoji[f.rarity] || '🐾'} ${f.name} ×${f.count}\n`;
      simple += `\n${FRAME}\n`;
      simple += `📌 /inv <#> — item detail + lore\n`;
      simple += `📌 /inv info — currencies, passes & full dashboard\n`;
      simple += `📌 /equip <#> — equip gear by serial\n`;
      simple += pro ? FRAME : `${FRAME}\n${UI.upsell()}`;
      return sock.sendMessage(chatId, { text: simple }, { quoted: msg });
    }

    // ── /inv info — full dashboard ───────────────────────────
    let message = pro
      ? `${UI.PRO_BAR}\n🎒 *INVENTORY* — ${player.name} 💎\n${UI.PRO_BAR}\n`
      : `🎒 *INVENTORY* — ${player.name}\n${UI.FREE_BAR}\n`;
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
    const _buffNames = { xpBooster:['✨','XP Booster'], goldMult:['💠','Nexus Multiplier'], shieldScroll:['🛡️','Shield Scroll'], mightElixir:['💪','Elixir of Might'], luckPotion:['🍀','Luck Potion'], gvcGold:['🥇','Gold EXP Buff (2×)'], gvcSilver:['🥈','Silver EXP Buff (1.5×)'], gvcBronze:['🥉','Bronze EXP Buff (1.25×)'] };
    for (const [bk, [be, bn]] of Object.entries(_buffNames)) {
      if ((inv[bk] || 0) > 0) message += `  ${be} ${bn} ×${inv[bk]} — /buff ${bk}\n`;
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

    // ── Guild Victory Cards ──────────────────────────────────────
    const cards = inv.cards || {};
    const gvcTotal = (cards.gvc_gold || 0) + (cards.gvc_silver || 0) + (cards.gvc_bronze || 0);
    if (gvcTotal > 0) {
      message += `🃏 *GUILD VICTORY CARDS* (${gvcTotal})\n`;
      if (cards.gvc_gold)   message += `  🥇 Gold ×${cards.gvc_gold} — /use GVC --gold (15k 💠 + 3k 💎 + 2× EXP buff)\n`;
      if (cards.gvc_silver) message += `  🥈 Silver ×${cards.gvc_silver} — /use GVC --silver (10k 💠 + 2k 💎 + 1.5× EXP buff)\n`;
      if (cards.gvc_bronze) message += `  🥉 Bronze ×${cards.gvc_bronze} — /use GVC --bronze (5k 💠 + 2k 💎 + 1.25× EXP buff)\n`;
      message += `\n`;
    }

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

    // ── Pass & BP Rewards ────────────────────────────────────────
    message += `\n🎖️ *PASS & BATTLE REWARDS*\n`;
    const apXp = player.astraPass?.xp ?? player.astraPassXp ?? player.passXp ?? 0;
    const apLvl = player.astraPass?.level ?? player.astraPassLevel ?? player.passLevel ?? 1;
    const bpXp = player.battlePass?.xp ?? player.battlePassXp ?? 0;
    const bpLvl = player.battlePass?.level ?? player.battlePassLevel ?? 1;
    const apTier = player.astraPassTier || (player.isPro ? 'Pro' : 'Free');
    const auraVal = player.aura || 0;
    message += `  🌀 Aura: ${auraVal.toLocaleString()} | 🌟 Astra Pass: Lv.${apLvl} — ${apXp.toLocaleString()} XP [${apTier}]\n`;
    message += `  🎖️ Battle Pass: Lv.${bpLvl} — ${bpXp.toLocaleString()} XP\n`;
    if (player._lastBpAdded) message += `  📈 Last BP Gain: +${player._lastBpAdded} XP\n`;
    if (player._lastAuraAdded) message += `  🌀 Last Aura Gain: +${player._lastAuraAdded}\n`;
    // Show unclaimed pass items if any
    const passItems = player.passRewards || player.astraPassRewards || [];
    if (Array.isArray(passItems) && passItems.length>0) {
      const cnt = passItems.length;
      message += `  📦 Unclaimed Pass Items: ${cnt} — use /pass claim\n`;
    }
    // Show inventory items that came from passes/dungeons/pvp (already in gear/consumables, but highlight recent)
    const recentPassGear = gearItems.filter(g=> g.source==='pass' || g.source==='battlepass' || g.source==='pvp' || g.source==='dungeon' || g.source==='gate' || g.source==='worldboss').slice(0,2);
    if (recentPassGear.length>0) {
      message += `  ✨ Recent Battle Gear: ${recentPassGear.map(g=>g.name).join(', ')}\n`;
    }
    // Materials & Mending Stone
    const mats = player.materials || {};
    const matKeys = Object.keys(mats);
    if (matKeys.length>0) {
      const matStr = matKeys.slice(0,5).map(k=> `${k} x${mats[k]}`).join(', ');
      message += `  🧱 Materials: ${matStr}${matKeys.length>5? ' ...':''}\n`;
    }
    const mending = player.inventory?.mendingStones || 0;
    if (mending>0) message += `  🛠️ Mending Stones: ${mending} — use /use mending stone to restore durability\n`;
    // Daily spawn info
    const lastSpawn = (getArgDb => { try { const db2=require('../../database'); return db2?.globalSpawn?.lastSpawnAt; } catch(e){return null;} })();
    message += `  🎁 Item Spawns: common→epic 1/day globally (requires /set spawn --true) — claim with /claim\n`;

    if (pro) {
      const byRar = {};
      for (const g of sortedGear) byRar[g.rarity || 'common'] = (byRar[g.rarity || 'common'] || 0) + 1;
      const rarStr = Object.entries(byRar).map(([r, n]) => `${rarityEmoji[r] || '📦'}×${n}`).join(' ');
      message += `\n${UI.PRO_MINI}\n💎 *PRO HOARD* — ${sortedGear.length} gear · ${consSorted.length} stacks\n  ${rarStr || '_No gear yet_'}\n`;
    }
    message += `\n${FRAME}\n`;
    message += `📌 /inv — owned items (simple)\n`;
    message += `📌 /gear · /summon · /attacks\n`;
    message += pro ? FRAME : `${FRAME}\n${UI.upsell()}`;

    return sock.sendMessage(chatId, { text: message }, { quoted: msg });
  }
};

module.exports._collectBuckets = collectBuckets;
module.exports._sortGear = sortGear;
module.exports._rarityOrder = RARITY_ORDER;
