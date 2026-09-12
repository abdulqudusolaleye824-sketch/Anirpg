// ═══════════════════════════════════════════════════════════════
// /inventory (/inv alias) — UNIFIED numbered list, most-recent first
// /inv        — every holding (gear + consumables + materials +
//               potions + pet food) numbered by most-recently-obtained
// /inv <#>    — full detail for that serial
// /inv info   — currencies, passes & full dashboard
// /items and /gear are subcategory views; /equip <#> reads these serials.
// ═══════════════════════════════════════════════════════════════

const UI = require('../../rpg/utils/UI');

const RARITY_ORDER = { mythic: 0, legendary: 1, epic: 2, rare: 3, uncommon: 4, common: 5 };
// Shared gear ordering — /inv, /inv <#>, /gear AND /equip <# serials> all
// resolve through this so a serial number means the same thing everywhere.
function sortGear(arr) {
  return [...arr].sort((a, b) => (RARITY_ORDER[a.rarity] || 6) - (RARITY_ORDER[b.rarity] || 6));
}
// Newest-first ordering shared by /inv and /gear. Items stamped with
// acquiredAt (all modern grants) sort by it; legacy unstamped items keep
// reverse-array order (pushes append, so later index = newer).
function byRecency(arr) {
  return [...arr].reverse().sort((a, b) => ((b.acquiredAt || 0) - (a.acquiredAt || 0)));
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

// ── Unified serial list: EVERYTHING, numbered, newest first ───────
// Entry: { kind, name, rarity, slot, count, acquiredAt, ref }
// kind: gear (individual) | stack (consumables/materials/petfood) | potion
function serialList(player) {
  const inv = player.inventory || {};
  const { gearItems, consumables, petFoodItems } = collectBuckets(player);
  const entries = [];

  for (const g of gearItems) {
    entries.push({
      kind: 'gear', name: g.name, rarity: g.rarity || 'common', slot: g.slot || '?',
      count: 1, acquiredAt: g.acquiredAt || g.droppedAt || 0, ref: g,
    });
  }

  const stackInto = (arr, kind) => {
    const m = {};
    const order = [];
    for (const it of arr) {
      if (!m[it.name]) { m[it.name] = { kind, name: it.name, rarity: it.rarity || 'common', count: 0, acquiredAt: 0, ref: it }; order.push(it.name); }
      const e = m[it.name];
      e.count++;
      e.acquiredAt = Math.max(e.acquiredAt, it.acquiredAt || 0);
      if ((it.acquiredAt || 0) >= e.acquiredAt) e.ref = it;
    }
    for (const k of order) entries.push(m[k]);
  };
  stackInto(consumables, 'stack');
  stackInto(petFoodItems, 'petfood');

  // Legacy potion counters (no per-unit date — listed after dated items)
  if ((inv.healthPotions || 0) > 0) entries.push({ kind: 'potion', name: 'Health Potion', rarity: 'common', count: inv.healthPotions, acquiredAt: 0, ref: null });
  if ((inv.energyPotions || inv.manaPotions || 0) > 0) entries.push({ kind: 'potion', name: 'Energy Potion', rarity: 'common', count: inv.energyPotions || inv.manaPotions, acquiredAt: 0, ref: null });
  if ((inv.reviveTokens || 0) > 0) entries.push({ kind: 'potion', name: 'Revive Token', rarity: 'uncommon', count: inv.reviveTokens, acquiredAt: 0, ref: null });
  // Materials stored as counters
  const mats = player.materials || {};
  for (const k of Object.keys(mats)) {
    if ((mats[k] || 0) > 0) entries.push({ kind: 'stack', name: k, rarity: 'common', count: mats[k], acquiredAt: 0, ref: null });
  }

  // Cards (registration grants + pro rewards) — appended LAST so every
  // existing serial keeps its number (batch-22: cards visible in /inv).
  const cards = player.cards || {};
  const cardDefs = [
    ['namechange', 'Name-Change Card', 'uncommon', '💡 Rename yourself with /setname <new name>'],
    ['seticon', 'Seticon Token', 'uncommon', '💡 Personalize with /seticon (reply to an image)'],
    ['pro_weekly', 'Weekly Pro Card', 'rare', '💡 Redeem with /prostore use weekly'],
  ];
  for (const [ckey, clabel, crarity, chint] of cardDefs) {
    if ((cards[ckey] || 0) > 0) entries.push({ kind: 'card', name: clabel, rarity: crarity, count: cards[ckey], acquiredAt: 0, ref: { cardKey: ckey, useHint: chint } });
  }

  // Stable newest-first: dated by stamp desc, undated keep insertion order at the end
  const dated = entries.filter(e => e.acquiredAt > 0).sort((a, b) => b.acquiredAt - a.acquiredAt);
  const undated = entries.filter(e => !e.acquiredAt);
  return [...dated, ...undated];
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

    const rarityEmoji = { mythic:'🌌', legendary:'🟠', epic:'🟣', rare:'🔵', uncommon:'🟢', common:'⚪' };
    const rarityOrder = { mythic:0, legendary:1, epic:2, rare:3, uncommon:4, common:5 };

    const serials = serialList(player);

    // ── /inv <number> — detail view for a serial ────────────────
    const slotArg = parseInt(args[0]);
    if (!isNaN(slotArg) && slotArg > 0) {
      const entry = serials[slotArg - 1];
      if (!entry) {
        return sock.sendMessage(chatId, { text: `❌ No item at serial ${slotArg}.\nYou have ${serials.length} entries.\nUse /inv to see your full inventory.` }, { quoted: msg });
      }
      const item = entry.ref || {};
      const re      = rarityEmoji[entry.rarity] || '📦';
      const rarName = (entry.rarity||'common').charAt(0).toUpperCase() + (entry.rarity||'common').slice(1);

      let detail = pro ? `${UI.PRO_BAR}\n${re} *${entry.name}* 💎\n${UI.PRO_BAR}\n` : `${re} *${entry.name}*\n${UI.FREE_BAR}\n`;
      detail += `🏷️ Rarity: *${rarName}*\n`;
      if (entry.count > 1) detail += `📦 Owned: *×${entry.count}*\n`;
      if (entry.kind === 'gear') {
        if (entry.slot) detail += `🔹 Slot: *${entry.slot}*\n`;
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
        const equippedSlot = entry.slot ? player.equippedGear?.[entry.slot] : null;
        const isEquipped   = equippedSlot && equippedSlot.name === entry.name;
        detail += `\n${isEquipped ? '✅ *EQUIPPED*' : '⭕ Not equipped'}\n`;
        if (!isEquipped) detail += `💡 /equip ${slotArg} to equip this item\n`;
      } else if (entry.kind === 'card') {
        // Registration / pro cards (batch-22) — point at the command that spends them.
        detail += `\n🃏 *CARD*\n`;
        if (item.useHint) detail += `${item.useHint}\n`;
        detail += `📌 Also listed under CARDS in /inv info\n`;
      } else {
        // Consumable / potion / material stack detail
        const desc = item.desc || item.description || null;
        if (desc) detail += `\n_${desc}_\n`;
        if (entry.kind === 'potion') {
          if (entry.name === 'Health Potion') detail += `\n💚 Restores 50% HP. Use: /equip use (see /items)\n`;
          else if (entry.name === 'Energy Potion') detail += `\n⚡ Restores 50% Energy. Use: /equip use (see /items)\n`;
          else if (entry.name === 'Revive Token') detail += `\n💿 Auto-used on death in dungeons.\n`;
        } else {
          // Cross-reference the /items serial for use/gift
          let useHint = '';
          try {
            const itemsMod = require('./items');
            if (itemsMod._buildList) {
              const il = itemsMod._buildList(player);
              const ix = il.findIndex(e => e.name === entry.name);
              if (ix >= 0) useHint = `/equip use ${ix + 1}`;
            }
          } catch (e) {}
          detail += `\n💡 ${useHint ? `Use: ${useHint} · ` : ''}See /items for all Usables\n`;
        }
      }
      detail += pro ? UI.PRO_BAR : `${UI.FREE_BAR}\n${UI.upsell()}`;

      return sock.sendMessage(chatId, { text: detail }, { quoted: msg });
    }

    const sub = String(args[0] || '').toLowerCase();

    // ── /inv (default) — unified numbered list, newest first ────
    if (sub !== 'info' && sub !== 'dashboard') {
      const MAX_SHOW = 40;
      let simple = pro
        ? `${UI.PRO_BAR}\n🎒 *INVENTORY* — ${player.name} 💎\n${UI.PRO_BAR}\n`
        : `🎒 *INVENTORY* — ${player.name}\n${UI.FREE_BAR}\n`;
      simple += `\n🆕 *ALL ITEMS — newest first* (${serials.length})\n`;
      if (serials.length === 0) {
        simple += `  _Empty — clear dungeons to find loot!_\n`;
      } else {
        serials.slice(0, MAX_SHOW).forEach((e, i) => {
          const eq = e.kind === 'gear' && player.equippedGear?.[e.slot]?.name === e.name ? ' ✅' : '';
          const cnt = e.count > 1 ? ` ×${e.count}` : '';
          const slot = e.kind === 'gear' ? ` [${e.slot || '?'}]` : '';
          const dur = e.kind === 'gear' && e.ref ? ` 🔧${e.ref.durability ?? '?'}/${e.ref.maxDurability ?? e.ref.durability ?? '?'}` : '';
          const emo = e.kind === 'card' ? '🃏' : (rarityEmoji[e.rarity] || '📦');
          simple += `  *${i + 1}.* ${emo} ${e.name}${slot}${cnt}${dur}${eq}\n`;
        });
        if (serials.length > MAX_SHOW) simple += `  _...and ${serials.length - MAX_SHOW} more_\n`;
      }
      simple += `\n${FRAME}\n`;
      simple += `📌 /inv <#> — item detail\n`;
      simple += `📌 /inv info — currencies, passes & full dashboard\n`;
      simple += `📌 /equip <#> — equip gear by serial\n`;
      simple += `📌 /items · /gear — subcategory views\n`;
      simple += pro ? FRAME : `${FRAME}\n${UI.upsell()}`;
      return sock.sendMessage(chatId, { text: simple }, { quoted: msg });
    }

    // ── /inv info — full dashboard ───────────────────────────
    const { gearItems, consumables, petFoodItems } = collectBuckets(player);
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

    // ── Cards (name-change / seticon / pro cards) ───────────────
    const cards = player.cards || {};
    const cardTotal = (cards.namechange || 0) + (cards.seticon || 0) + (cards.pro_weekly || 0);
    if (cardTotal > 0) {
      message += `🃏 *CARDS* (${cardTotal})\n`;
      if (cards.namechange) message += `  ✏️ Name-Change Card ×${cards.namechange} — /setname <new name>\n`;
      if (cards.seticon)    message += `  🖼️ Seticon Token ×${cards.seticon} — /seticon (reply to image)\n`;
      if (cards.pro_weekly) message += `  🎫 Weekly Pro Card ×${cards.pro_weekly} — /prostore use weekly\n`;
      message += `\n`;
    }

    // ── Guild Victory Cards ──────────────────────────────────────
    const gcards = inv.cards || {};
    const gvcTotal = (gcards.gvc_gold || 0) + (gcards.gvc_silver || 0) + (gcards.gvc_bronze || 0);
    if (gvcTotal > 0) {
      message += `🃏 *GUILD VICTORY CARDS* (${gvcTotal})\n`;
      if (gcards.gvc_gold)   message += `  🥇 Gold ×${gcards.gvc_gold} — /use GVC --gold (15k 💠 + 3k 💎 + 2× EXP buff)\n`;
      if (gcards.gvc_silver) message += `  🥈 Silver ×${gcards.gvc_silver} — /use GVC --silver (10k 💠 + 2k 💎 + 1.5× EXP buff)\n`;
      if (gcards.gvc_bronze) message += `  🥉 Bronze ×${gcards.gvc_bronze} — /use GVC --bronze (5k 💠 + 2k 💎 + 1.25× EXP buff)\n`;
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
    const recentPassGear = gearItems.filter(g=> g.source==='pass' || g.source==='battlepass' || g.source==='pvp' || g.source==='dungeon' || g.source==='gate').slice(0,2);
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
    message += `  🎁 Item Spawns: common→epic 1/day globally (requires /set spawn --true) — claim with /claim\n`;

    if (pro) {
      const byRar = {};
      for (const g of sortedGear) byRar[g.rarity || 'common'] = (byRar[g.rarity || 'common'] || 0) + 1;
      const rarStr = Object.entries(byRar).map(([r, n]) => `${rarityEmoji[r] || '📦'}×${n}`).join(' ');
      message += `\n${UI.PRO_MINI}\n💎 *PRO HOARD* — ${sortedGear.length} gear · ${consSorted.length} stacks\n  ${rarStr || '_No gear yet_'}\n`;
    }
    message += `\n${FRAME}\n`;
    message += `📌 /inv — all items (newest first)\n`;
    message += `📌 /gear · /summon · /attacks\n`;
    message += pro ? FRAME : `${FRAME}\n${UI.upsell()}`;

    return sock.sendMessage(chatId, { text: message }, { quoted: msg });
  }
};

module.exports._collectBuckets = collectBuckets;
module.exports._sortGear = sortGear;
module.exports._byRecency = byRecency;
module.exports._serialList = serialList;
module.exports._rarityOrder = RARITY_ORDER;
