// ═══════════════════════════════════════════════════════════════
// GuildWarRewards — single source of truth for Weekly Guild War prizes (Push #90)
//   • Victory cards (one per member of the top-3 guilds) — /use GVC --gold|--silver|--bronze
//   • Weekly MVP — flat Nexus + title
//   • GP BOOST: using a card gives ×2 / ×1.5 / ×1.25 GP for 3 days (all GP sources)
// ═══════════════════════════════════════════════════════════════
const GP_BOOST_MS = 3 * 24 * 60 * 60 * 1000;

const GVC = {
  gvc_gold:   { flag: '--gold',   emoji: '🥇', label: 'GOLD GUILD VICTORY CARD',   short: 'Gold',   nexus: 150000, manaStones: 30000, gpMult: 2.0,  buff: 'gvcGold' },
  gvc_silver: { flag: '--silver', emoji: '🥈', label: 'SILVER GUILD VICTORY CARD', short: 'Silver', nexus: 100000, manaStones: 20000, gpMult: 1.5,  buff: 'gvcSilver' },
  gvc_bronze: { flag: '--bronze', emoji: '🥉', label: 'BRONZE GUILD VICTORY CARD', short: 'Bronze', nexus: 50000,  manaStones: 20000, gpMult: 1.25, buff: 'gvcBronze' },
};
const MVP_NEXUS = 200000;
const MVP_TITLE = 'Weekly Guild War MVP';

const fmt = (n) => Number(n || 0).toLocaleString();
const k = (n) => n >= 1000 ? `${n / 1000}k` : String(n);

// Short reward line for a card, e.g. "150k 💠 + 30k 💎 + 2× GP (3d)"
function cardSummary(type) {
  const c = GVC[type]; if (!c) return '';
  return `${k(c.nexus)} 💠 + ${k(c.manaStones)} 💎 + ${c.gpMult}× GP for 3 days`;
}

// Activate/extend a GP boost. A stronger boost replaces a weaker one; the same
// tier extends its timer; a weaker one never downgrades an active stronger one.
function applyGpBoost(player, mult, now = Date.now()) {
  if (!player || !(mult > 1)) return null;
  const cur = player.gpBoost;
  const active = cur && cur.until > now ? cur : null;
  if (active && active.mult > mult) return active;
  const until = (active && active.mult === mult ? active.until : now) + GP_BOOST_MS;
  player.gpBoost = { mult, until, since: now };
  return player.gpBoost;
}

function gpMultiplier(player, now = Date.now()) {
  const b = player && player.gpBoost;
  if (!b || !(b.mult > 1) || !(b.until > now)) return 1;
  return b.mult;
}

function gpBoostText(player, now = Date.now()) {
  const b = player && player.gpBoost;
  if (!b || !(b.until > now)) return null;
  const left = b.until - now; const d = Math.floor(left / 86400000); const h = Math.floor((left % 86400000) / 3600000);
  return `⚡ GP Boost ×${b.mult} — ${d}d ${h}h left`;
}

module.exports = { GVC, MVP_NEXUS, MVP_TITLE, GP_BOOST_MS, cardSummary, applyGpBoost, gpMultiplier, gpBoostText, fmt };
