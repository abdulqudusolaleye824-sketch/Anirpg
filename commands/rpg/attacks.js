// ═══════════════════════════════════════════════════════════════
// /attacks — Attack Pattern Management & Universal Combat Attack
//
// /attacks                   — show equipped attack patterns
// /attack                    — execute combat attack (in battle) or show patterns
// /attack <pattern_id>       — execute pattern attack in active battle
// /attacks shop              — browse today's shop
// /attacks buy <number>      — buy from shop
// /attacks equip <number>    — equip a pattern (max 10 slots)
// ═══════════════════════════════════════════════════════════════

'use strict';

const DB   = require('../../rpg/utils/AttackPatternDB');
const Shop = require('../../rpg/utils/AttackShop');
const GKM  = require('../../rpg/dungeons/GateKeyManager');
const { GateManager } = require('../../rpg/dungeons/GateManager');

const MAX_EQUIPPED = 10;

function initAP(player) {
  if (!player.attackPatterns) player.attackPatterns = { owned: [], equipped: [] };
  if (!Array.isArray(player.attackPatterns.owned))    player.attackPatterns.owned = [];
  if (!Array.isArray(player.attackPatterns.equipped)) player.attackPatterns.equipped = [];
  return player.attackPatterns;
}

function normaliseJid(jid) {
  return jid?.split('@')[0]?.split(':')[0]?.replace(/[^0-9]/g, '') || '';
}

function detectActiveCombat(player, chatId, db, sender) {
  const sNum = normaliseJid(sender || player.id || player.jid || player._id);

  // 1. PvP Battle
  if (player.pvpBattle) {
    return { type: 'pvp', battle: player.pvpBattle };
  }

  // 2. Solo Dungeon
  if (player.dungeon && (player.dungeon.currentBattle || player.dungeon.inDungeon)) {
    return { type: 'dungeon', dungeon: player.dungeon };
  }

  // 3. Gate Raid in current chat
  const gc = GKM.getDungeonGC(chatId);
  if (gc?.activeKeyId) {
    const keyData = GKM.getKey(gc.activeKeyId) || db.gateKeys?.[gc.activeKeyId];
    if (keyData) {
      const gate = GateManager.getGate(keyData.gateId);
      if (gate && gate.raid && gate.raid.status === 'active') {
        const isMember = gate.raid.members?.some(m => normaliseJid(m.id) === sNum);
        if (isMember) {
          return { type: 'gateraid', gate, key: gc.activeKeyId, keyData };
        }
      }
    }
  }

  // Check all active gates
  for (const gate of Object.values(GateManager.gates || {})) {
    if (gate.raid && gate.raid.status === 'active') {
      const isMember = gate.raid.members?.some(m => normaliseJid(m.id) === sNum);
      if (isMember) {
        return { type: 'gateraid', gate, key: gate.raid.key, keyData: GKM.getKey(gate.raid.key) };
      }
    }
  }

  return null;
}

module.exports = {
  name: 'attacks',
  aliases: ['attack', 'ap', 'patterns'],
  description: 'Manage attack patterns or execute attack in active combat',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key?.remoteJid;
    const db     = getDatabase();
    const player = db.users?.[sender];
    if (!player) return sock.sendMessage(chatId, { text: '❌ Register first!' }, { quoted: msg });
    const UI = require('../../rpg/utils/UI');
    const pro = UI.isPro(player);
    const FRAME = pro ? UI.PRO_BAR : UI.FREE_BAR;

    const ap  = initAP(player);
    const sub = (args[0] || '').toLowerCase();

    const managementCmds = ['shop', 'buy', 'equip', 'unequip', 'all', 'info', 'rank', 'purchase'];
    const isManagement = managementCmds.includes(sub);

    // ── Combat Check (if not explicit management subcommand) ──
    if (!isManagement) {
      const combat = detectActiveCombat(player, chatId, db, sender);
      if (combat) {
        if (combat.type === 'pvp') {
          const PvpCmd = require('./pvp');
          return PvpCmd.execute(sock, msg, ['attack', ...args], getDatabase, saveDatabase, sender);
        }
        if (combat.type === 'dungeon') {
          const DungeonCmd = require('./dungeon');
          return DungeonCmd.execute(sock, msg, ['attack', ...args], getDatabase, saveDatabase, sender);
        }
        if (combat.type === 'gateraid') {
          const GateRaidCmd = require('./gateraid');
          return GateRaidCmd.execute(sock, msg, [combat.key, 'attack', ...args], getDatabase, saveDatabase, sender);
        }
      }
    }

    // ── /attacks (show equipped) ───────────────────────────────────────────────
    if (!sub || sub === 'equipped') {
      if (ap.equipped.length === 0) {
        return sock.sendMessage(chatId, {
          text: [
            ...(pro ? [UI.PRO_BAR, `🥋 *ATTACK PATTERNS* 💎`, UI.PRO_BAR] : [`🥋 *ATTACK PATTERNS*`, UI.FREE_BAR]),
            ``,
            `No patterns equipped.`,
            `Owned: ${ap.owned.length} | Slots: 0/${MAX_EQUIPPED}`,
            ``,
            `📌 /attacks shop — browse today's shop`,
            `📌 /attacks buy <#> — purchase a pattern`,
            FRAME,
            ...(pro ? [UI.PRO_MINI, `💎 *PRO ARSENAL* — ${ap.owned.length} owned`] : [UI.upsell()]),
          ].join('\n'),
        }, { quoted: msg });
      }

      const lines = ap.equipped.map((id, i) => {
        const atk = DB.generateAttack(id);
        if (!atk) return `  ${i+1}. #${id} *(invalid)*`;
        const re  = DB.RANK_EMOJI[atk.rank] || '⬜';
        const eff = atk.effect ? ` ${atk.effect.emoji}` : '';
        return `  ${i+1}. ${re} *#${id}* ${atk.name}${eff} Dmg×${atk.dmgMult} Atk×${atk.atkMult} Def×${atk.defMult} Spd×${atk.speedMult} Crit×${atk.critMult} ${atk.accuracy}% ${atk.cooldownSec}s`;
      });

      return sock.sendMessage(chatId, {
        text: [
          ...(pro ? [UI.PRO_BAR, `🥋 *${player.name}'s ATTACK PATTERNS* 💎`, UI.PRO_BAR] : [`🥋 *${player.name}'s ATTACK PATTERNS*`, UI.FREE_BAR]),
          `Slots: ${ap.equipped.length}/${MAX_EQUIPPED} | Owned: ${ap.owned.length}`,
          ``,
          ...lines,
          ``,
          `📌 /attack <#> — execute in active combat`,
          `📌 /attacks all — see all owned`,
          `📌 /attacks equip <#> — equip a pattern`,
          FRAME,
          ...(pro ? [UI.PRO_MINI, `💎 *PRO ARSENAL* — ${ap.equipped.length}/${MAX_EQUIPPED} slots`] : [UI.upsell()]),
        ].join('\n'),
      }, { quoted: msg });
    }

    // ── /attacks all ──────────────────────────────────────────────────────────
    if (sub === 'all') {
      if (ap.owned.length === 0) {
        return sock.sendMessage(chatId, {
          text: `🥋 You don't own any attack patterns yet.\nBrowse: */attacks shop*`,
        }, { quoted: msg });
      }

      const lines = ap.owned.map(id => {
        const atk = DB.generateAttack(id);
        if (!atk) return null;
        const isEquipped = ap.equipped.includes(id);
        return DB.formatAttack(atk, true) + (isEquipped ? ' ✅' : '');
      }).filter(Boolean);

      const chunk = lines.slice(0, 20);
      const more  = lines.length > 20 ? `\n...and ${lines.length - 20} more` : '';

      return sock.sendMessage(chatId, {
        text: [
          ...(pro ? [UI.PRO_BAR, `🥋 *ALL OWNED PATTERNS (${ap.owned.length})* 💎`, UI.PRO_BAR] : [`🥋 *ALL OWNED PATTERNS (${ap.owned.length})*`, UI.FREE_BAR]),
          `✅ = equipped`,
          ``,
          ...chunk,
          more,
          FRAME,
          ...(pro ? [UI.PRO_MINI, `💎 *PRO ARSENAL* — ${ap.owned.length} owned`] : [UI.upsell()]),
        ].join('\n'),
      }, { quoted: msg });
    }

    // ── /attacks info <number> ────────────────────────────────────────────────
    if (sub === 'info') {
      const num = parseInt(args[1]);
      if (isNaN(num) || num < 1 || num > 750) {
        return sock.sendMessage(chatId, { text: '❌ Usage: /attacks info <1–750>' }, { quoted: msg });
      }
      const atk = DB.generateAttack(num);
      if (!atk) return sock.sendMessage(chatId, { text: '❌ Invalid attack number.' }, { quoted: msg });

      const owned    = ap.owned.includes(num);
      const equipped = ap.equipped.includes(num);

      return sock.sendMessage(chatId, {
        text: [
          ...(pro ? [UI.PRO_BAR] : [UI.FREE_BAR]),
          DB.formatAttack(atk),
          ``,
          owned    ? `✅ *Owned*${equipped ? ' | ⚔️ Equipped' : ''}` : `❌ Not owned`,
          FRAME,
          ...(pro ? [UI.PRO_MINI, equipped ? `💎 *PRO ARSENAL* — equipped` : owned ? `💎 *PRO ARSENAL* — owned` : `💎 *PRO ARSENAL* — not owned`] : [UI.upsell()]),
        ].join('\n'),
      }, { quoted: msg });
    }

    // ── /attacks equip <number> ───────────────────────────────────────────────
    if (sub === 'equip') {
      const num = parseInt(args[1]);
      if (isNaN(num)) return sock.sendMessage(chatId, { text: '❌ Usage: /attacks equip <number>' }, { quoted: msg });

      if (!ap.owned.includes(num)) {
        return sock.sendMessage(chatId, { text: `❌ You don't own Attack #${num}.\nBuy it first: */attacks shop*` }, { quoted: msg });
      }
      if (ap.equipped.includes(num)) {
        return sock.sendMessage(chatId, { text: `⚠️ Attack #${num} is already equipped.` }, { quoted: msg });
      }
      if (ap.equipped.length >= MAX_EQUIPPED) {
        return sock.sendMessage(chatId, {
          text: `❌ All ${MAX_EQUIPPED} slots are full.\nUse */attacks unequip <#>* to free a slot.`,
        }, { quoted: msg });
      }

      ap.equipped.push(num);
      saveDatabase();

      const atk = DB.generateAttack(num);
      return sock.sendMessage(chatId, {
        text: [
          ...(pro ? [UI.PRO_BAR, `✅ *Attack #${num} Equipped* 💎`, UI.PRO_BAR] : [`✅ *Attack #${num} Equipped*`, UI.FREE_BAR]),
          `${DB.RANK_EMOJI[atk.rank]} ${atk.name}`,
          `Slot ${ap.equipped.length}/${MAX_EQUIPPED}`,
          ``,
          `Use in combat: */attack ${num}*`,
          FRAME,
          ...(pro ? [UI.PRO_MINI, `💎 *PRO ARSENAL* — ${ap.equipped.length}/${MAX_EQUIPPED} slots`] : [UI.upsell()]),
        ].join('\n'),
      }, { quoted: msg });
    }

    // ── /attacks unequip <number> ─────────────────────────────────────────────
    if (sub === 'unequip') {
      const num = parseInt(args[1]);
      if (isNaN(num)) return sock.sendMessage(chatId, { text: '❌ Usage: /attacks unequip <number>' }, { quoted: msg });

      const idx = ap.equipped.indexOf(num);
      if (idx === -1) {
        return sock.sendMessage(chatId, { text: `❌ Attack #${num} is not equipped.` }, { quoted: msg });
      }

      ap.equipped.splice(idx, 1);
      saveDatabase();

      return sock.sendMessage(chatId, {
        text: `✅ Attack #${num} unequipped. Slots: ${ap.equipped.length}/${MAX_EQUIPPED}`,
      }, { quoted: msg });
    }

    // ── /attacks rank <E|D|C|B|A|S> ──────────────────────────────────────────
    if (sub === 'rank') {
      const rankArg = (args[1] || '').toUpperCase();
      const cfg     = DB.RANK_CONFIG[rankArg];
      if (!cfg) {
        return sock.sendMessage(chatId, {
          text: `❌ Usage: /attacks rank <E|D|C|B|A|S>`,
        }, { quoted: msg });
      }

      const sample = DB.getAttacksInRange(cfg.range[0], Math.min(cfg.range[0] + 9, cfg.range[1]));
      const costInfo = rankArg === 'S'
        ? `Nexus + Mana Stones`
        : cfg.nexus > 0 && cfg.stones > 0 ? `Nexus or Mana Stones`
        : cfg.nexus > 0 ? `Nexus only`
        : `Mana Stones only`;

      return sock.sendMessage(chatId, {
        text: [
          ...(pro ? [UI.PRO_BAR, `${DB.RANK_EMOJI[rankArg]} *${rankArg}-Rank Attack Patterns* 💎`, UI.PRO_BAR] : [`${DB.RANK_EMOJI[rankArg]} *${rankArg}-Rank Attack Patterns*`, UI.FREE_BAR]),
          `Range: #${cfg.range[0]}–#${cfg.range[1]}`,
          `Currency: ${costInfo}`,
          cfg.hasEffect ? `⚡ Has special effects` : ``,
          ``,
          `*Sample (first 10):*`,
          ...sample.map(a => DB.formatAttack(a, true)),
          ``,
          `📌 /attacks info <#> for full details`,
          `📌 /attacks shop for today's available patterns`,
          FRAME,
          ...(pro ? [UI.PRO_MINI, `💎 *PRO ARSENAL* — ${rankArg}-Rank range`] : [UI.upsell()]),
        ].filter(l => l !== '').join('\n'),
      }, { quoted: msg });
    }

    // ── /attacks shop ─────────────────────────────────────────────────────────
    if (sub === 'shop') {
      const items = Shop.getShopDisplay(db);

      const lines = items.map((atk, i) => {
        const re  = DB.RANK_EMOJI[atk.rank] || '⬜';
        const eff = atk.effect ? ` ${atk.effect.emoji} ${atk.effect.label} ${atk.effect.chance}%` : 'No effect';
        const owned = ap.owned.includes(atk.id);
        const stock = atk.inStock ? '' : ' *(Sold Out)*';
        const ownedMark = owned ? ' ✅' : '';
        const costStr = atk.rank === 'S'
          ? `${atk.cost.shopNexus.toLocaleString()}N + ${atk.cost.shopStones.toLocaleString()}MS`
          : atk.cost.shopNexus > 0 && atk.cost.shopStones > 0
          ? `${atk.cost.shopNexus.toLocaleString()}N or ${atk.cost.shopStones.toLocaleString()}MS`
          : atk.cost.shopNexus > 0
          ? `${atk.cost.shopNexus.toLocaleString()} Nexus`
          : `${atk.cost.shopStones.toLocaleString()} MS`;
        return `${i+1}. ${re} *#${atk.id}* ${atk.name} Dmg×${atk.dmgMult} Atk×${atk.atkMult} Def×${atk.defMult} Spd×${atk.speedMult} Crit×${atk.critMult} ${atk.accuracy}% ${atk.cooldownSec}s cd | ${eff} — ${costStr}${stock}${ownedMark}`;
      });

      return sock.sendMessage(chatId, {
        text: [
          ...(pro ? [UI.PRO_BAR, `🥋 *ATTACK PATTERN SHOP* 💎`, UI.PRO_BAR] : [`🥋 *ATTACK PATTERN SHOP*`, UI.FREE_BAR]),
          `Resets daily at WAT midnight`,
          `N = Nexus | MS = Mana Stones`,
          `✅ = already owned`,
          ``,
          ...lines,
          ``,
          `📌 /attacks buy <#> — purchase`,
          `📌 /attacks info <#> — view details`,
          FRAME,
          ...(pro ? [UI.PRO_MINI, `💎 *PRO ARSENAL* — ${items.length} in stock`] : [UI.upsell()]),
        ].join('\n'),
      }, { quoted: msg });
    }

    // ── /attacks buy <number> ─────────────────────────────────────────────────
    if (sub === 'buy' || sub === 'purchase') {
      const num = parseInt(args[1]);
      if (isNaN(num) || num < 1 || num > 750) {
        return sock.sendMessage(chatId, { text: '❌ Usage: /attacks buy <1–750>' }, { quoted: msg });
      }

      const result = Shop.purchaseFromShop(num, sender, db, saveDatabase);
      if (!result.success) {
        return sock.sendMessage(chatId, { text: `❌ ${result.error}` }, { quoted: msg });
      }

      const atk = result.attack;
      const re  = DB.RANK_EMOJI[atk.rank];

      return sock.sendMessage(chatId, {
        text: [
          ...(pro ? [UI.PRO_BAR, `🥋 *ATTACK PATTERN ACQUIRED* 💎`, UI.PRO_BAR] : [`🥋 *ATTACK PATTERN ACQUIRED*`, UI.FREE_BAR]),
          ``,
          `${re} *#${atk.id} — ${atk.name}*`,
          `Rank: ${atk.rank}-Rank | ×${atk.dmgMult} ATK`,
          atk.effect ? `${atk.effect.emoji} ${atk.effect.label} (${atk.effect.chance}% | ${atk.effect.duration}t)` : `No special effect`,
          ``,
          `_${atk.flavour}_`,
          ``,
          `📌 /attacks equip ${num} — equip it now`,
          `📌 /attack ${num} — use in active combat`,
          FRAME,
          ...(pro ? [UI.PRO_MINI, `💎 *PRO ARSENAL* — #${atk.id} · ${ap.owned.length} owned`] : [UI.upsell()]),
        ].join('\n'),
      }, { quoted: msg });
    }

    // ── Fallback ──────────────────────────────────────────────────────────────
    return sock.sendMessage(chatId, {
      text: [
        ...(pro ? [UI.PRO_BAR, `🥋 *ATTACK PATTERN COMMANDS* 💎`, UI.PRO_BAR] : [`🥋 *ATTACK PATTERN COMMANDS*`, UI.FREE_BAR]),
        `/attacks              — equipped patterns`,
        `/attacks all          — all owned patterns`,
        `/attacks info <#>     — view any pattern`,
        `/attacks equip <#>    — equip (max 10)`,
        `/attacks unequip <#>  — free a slot`,
        `/attacks rank <rank>  — browse by rank`,
        `/attacks shop         — today's shop`,
        `/attacks buy <#>      — purchase`,
        FRAME,
        ...(pro ? [UI.PRO_MINI, `💎 *PRO ARSENAL* — ${ap.equipped.length}/${MAX_EQUIPPED} equipped`] : [UI.upsell()]),
      ].join('\n'),
    }, { quoted: msg });
  },
};
