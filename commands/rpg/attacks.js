// ═══════════════════════════════════════════════════════════════
// /attacks — Attack Pattern Management
//
// /attacks                   — show equipped attack patterns
// /attacks all               — all owned patterns
// /attacks equip <number>    — equip a pattern (max 10 slots)
// /attacks unequip <number>  — unequip a pattern
// /attacks info <number>     — view details of any pattern
// /attacks shop              — browse today's shop
// /attacks buy <number>      — buy from shop
// /attacks rank <E|D|C|B|A|S>  — browse all patterns in a rank
// ═══════════════════════════════════════════════════════════════

'use strict';

const DB   = require('../../rpg/utils/AttackPatternDB');
const Shop = require('../../rpg/utils/AttackShop');

const MAX_EQUIPPED = 10;

// ── Ensure player has attackPatterns structure ────────────────────────────────
function initAP(player) {
  if (!player.attackPatterns) player.attackPatterns = { owned: [], equipped: [] };
  if (!Array.isArray(player.attackPatterns.owned))    player.attackPatterns.owned = [];
  if (!Array.isArray(player.attackPatterns.equipped)) player.attackPatterns.equipped = [];
  return player.attackPatterns;
}

// ── Normalise JID ─────────────────────────────────────────────────────────────
function normaliseJid(jid) {
  return jid?.split('@')[0]?.split(':')[0]?.replace(/[^0-9]/g, '') || '';
}

function isOwnerOrCoOwner(sender) {
  const ownerNum   = normaliseJid(process.env.OWNER_JID   || '221951679328499@lid');
  const coOwnerNum = normaliseJid(process.env.COOWNER_JID || '194592469209292@lid');
  const sNum       = normaliseJid(sender);
  return sNum === ownerNum || sNum === coOwnerNum;
}

module.exports = {
  name: 'attacks',
  aliases: ['attack', 'ap', 'patterns'],
  description: 'Manage your martial attack patterns',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key?.remoteJid;
    const db     = getDatabase();
    const player = db.users?.[sender];
    if (!player) return sock.sendMessage(chatId, { text: '❌ Register first!' }, { quoted: msg });

    const ap  = initAP(player);
    const sub = (args[0] || '').toLowerCase();

    // ── /attacks (show equipped) ───────────────────────────────────────────────
    if (!sub || sub === 'equipped') {
      if (ap.equipped.length === 0) {
        return sock.sendMessage(chatId, {
          text: [
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            `🥋 *ATTACK PATTERNS*`,
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            ``,
            `No patterns equipped.`,
            `Owned: ${ap.owned.length} | Slots: 0/${MAX_EQUIPPED}`,
            ``,
            `📌 /attacks shop — browse today's shop`,
            `📌 /attacks buy <#> — purchase a pattern`,
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          ].join('\n'),
        }, { quoted: msg });
      }

      const lines = ap.equipped.map((id, i) => {
        const atk = DB.generateAttack(id);
        if (!atk) return `  ${i+1}. #${id} *(invalid)*`;
        const re  = DB.RANK_EMOJI[atk.rank] || '⬜';
        const eff = atk.effect ? ` ${atk.effect.emoji}` : '';
        return `  ${i+1}. ${re} *#${id}* ${atk.name}${eff} ×${atk.dmgMult}`;
      });

      return sock.sendMessage(chatId, {
        text: [
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `🥋 *${player.name}'s ATTACK PATTERNS*`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `Slots: ${ap.equipped.length}/${MAX_EQUIPPED} | Owned: ${ap.owned.length}`,
          ``,
          ...lines,
          ``,
          `📌 /dungeon attack <#> — use in combat`,
          `📌 /attacks all — see all owned`,
          `📌 /attacks equip <#> — equip a pattern`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
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

      // Split into chunks if too long
      const chunk = lines.slice(0, 20);
      const more  = lines.length > 20 ? `\n...and ${lines.length - 20} more` : '';

      return sock.sendMessage(chatId, {
        text: [
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `🥋 *ALL OWNED PATTERNS (${ap.owned.length})*`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `✅ = equipped`,
          ``,
          ...chunk,
          more,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
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
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          DB.formatAttack(atk),
          ``,
          owned    ? `✅ *Owned*${equipped ? ' | ⚔️ Equipped' : ''}` : `❌ Not owned`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
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
          `✅ *Attack #${num} Equipped*`,
          `${DB.RANK_EMOJI[atk.rank]} ${atk.name}`,
          `Slot ${ap.equipped.length}/${MAX_EQUIPPED}`,
          ``,
          `Use in combat: */dungeon attack ${num}*`,
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
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `${DB.RANK_EMOJI[rankArg]} *${rankArg}-Rank Attack Patterns*`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `Range: #${cfg.range[0]}–#${cfg.range[1]}`,
          `Currency: ${costInfo}`,
          cfg.hasEffect ? `⚡ Has special effects` : ``,
          ``,
          `*Sample (first 10):*`,
          ...sample.map(a => DB.formatAttack(a, true)),
          ``,
          `📌 /attacks info <#> for full details`,
          `📌 /attacks shop for today's available patterns`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ].filter(l => l !== '').join('\n'),
      }, { quoted: msg });
    }

    // ── /attacks shop ─────────────────────────────────────────────────────────
    if (sub === 'shop') {
      const items = Shop.getShopDisplay(db);

      const lines = items.map((atk, i) => {
        const re  = DB.RANK_EMOJI[atk.rank] || '⬜';
        const eff = atk.effect ? ` ${atk.effect.emoji}` : '';
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
        return `${i+1}. ${re} *#${atk.id}* ${atk.name}${eff}${stock}${ownedMark} — ${costStr}`;
      });

      return sock.sendMessage(chatId, {
        text: [
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `🥋 *ATTACK PATTERN SHOP*`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `Resets daily at WAT midnight`,
          `N = Nexus | MS = Mana Stones`,
          `✅ = already owned`,
          ``,
          ...lines,
          ``,
          `📌 /attacks buy <#> — purchase`,
          `📌 /attacks info <#> — view details`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
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
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `🥋 *ATTACK PATTERN ACQUIRED*`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          ``,
          `${re} *#${atk.id} — ${atk.name}*`,
          `Rank: ${atk.rank}-Rank | ×${atk.dmgMult} ATK`,
          atk.effect ? `${atk.effect.emoji} ${atk.effect.label} (${atk.effect.chance}% | ${atk.effect.duration}t)` : `No special effect`,
          ``,
          `_${atk.flavour}_`,
          ``,
          `📌 /attacks equip ${num} — equip it now`,
          `📌 /dungeon attack ${num} — use in combat`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ].join('\n'),
      }, { quoted: msg });
    }

    // ── Fallback ──────────────────────────────────────────────────────────────
    return sock.sendMessage(chatId, {
      text: [
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `🥋 *ATTACK PATTERN COMMANDS*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `/attacks              — equipped patterns`,
        `/attacks all          — all owned patterns`,
        `/attacks info <#>     — view any pattern`,
        `/attacks equip <#>    — equip (max 10)`,
        `/attacks unequip <#>  — free a slot`,
        `/attacks rank <rank>  — browse by rank`,
        `/attacks shop         — today's shop`,
        `/attacks buy <#>      — purchase`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ].join('\n'),
    }, { quoted: msg });
  },
};
