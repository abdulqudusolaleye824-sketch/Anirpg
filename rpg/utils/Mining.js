// ═══════════════════════════════════════════════════════════════
// Astra — Mining (Push #97)
//
// Once every beast on a floor is dead (and before the party advances), each
// hunter may swing a mining tool up to 3× on that floor. A swing takes ~10s
// (3 progress messages; the excavator is slower). Not guaranteed. Success adds
// Mana Stones to the GATE's loot (paid out with the rest at clear) and can turn
// up an Essence Stone of the gate's rank. Tools have durability and break.
// Baseline dungeon Mana Stones are untouched — mining is pure extra.
// ═══════════════════════════════════════════════════════════════
'use strict';

const ATTEMPTS_PER_FLOOR = 3;

// id → tool. nexus = 💠 price, mana = 💎 price (Mana Stones). min/max = 💎 mined on success.
const TOOLS = {
  weak_pickaxe:   { id: 'weak_pickaxe',   name: 'Weak Pickaxe',    emoji: '⛏️', nexus: 50000,     mana: 0,        durability: 20,  min: 150,  max: 2500,  chance: 0.55, rounds: 3, roundMs: 3300, essence: 0.06, desc: 'Chips at the rock. Up to 2,500 Mana Stones a swing.' },
  strong_pickaxe: { id: 'strong_pickaxe', name: 'Strong Pickaxe',  emoji: '⚒️', nexus: 500000,    mana: 0,        durability: 50,  min: 800,  max: 10000, chance: 0.65, rounds: 3, roundMs: 3300, essence: 0.08, desc: 'Reinforced head. Up to 10,000 Mana Stones a swing.' },
  mining_drill:   { id: 'mining_drill',   name: 'Mining Drill',    emoji: '🔩', nexus: 2500000,   mana: 500000,   durability: 80,  min: 2000, max: 20000, chance: 0.68, rounds: 3, roundMs: 4200, essence: 0.10, desc: 'Mana-powered drill. Up to 20,000 a swing, a little slower.' },
  excavator:      { id: 'excavator',      name: 'Excavator',       emoji: '🚜', nexus: 10000000,  mana: 5000000,  durability: 150, min: 5000, max: 50000, chance: 0.72, rounds: 3, roundMs: 6000, essence: 0.12, desc: 'Heavy machinery. Up to 50,000 a round — but it takes ~18s.' },
  miners_lantern: { id: 'miners_lantern', name: "Miner's Lantern", emoji: '🏮', nexus: 300000,    mana: 0,        durability: 100, accessory: true, chanceBonus: 0.10, essenceBonus: 0.04, desc: 'Worn alongside a tool: +10% mining success, +4% essence stone odds.' },
  repair_kit:     { id: 'repair_kit',     name: 'Tool Repair Kit', emoji: '🧰', nexus: 150000,    mana: 0,        consumable: true, repair: 15, desc: 'Restores 15 durability to your best tool.' },
};
const ORDER = ['weak_pickaxe', 'strong_pickaxe', 'mining_drill', 'excavator', 'miners_lantern', 'repair_kit'];
const RANK_MULT = { E: 0.6, D: 0.8, C: 1.0, B: 1.2, A: 1.4, S: 1.7 }; // richer rock deeper in

function catalog() { return ORDER.map(id => TOOLS[id]); }
function toolById(q) {
  if (!q) return null; const s = String(q).trim().toLowerCase();
  const n = parseInt(s, 10); if (!isNaN(n) && n >= 1 && n <= ORDER.length) return TOOLS[ORDER[n - 1]];
  return TOOLS[s] || catalog().find(t => t.name.toLowerCase() === s || t.name.toLowerCase().includes(s)) || null;
}
function state(player) {
  if (!player.mining || typeof player.mining !== 'object') player.mining = {};
  const m = player.mining;
  if (!Array.isArray(m.tools)) m.tools = [];
  if (!m.stats) m.stats = { swings: 0, hits: 0, mana: 0, essence: 0, broken: 0 };
  return m;
}
function priceLine(t) { return `${t.nexus ? `💠 ${t.nexus.toLocaleString()}` : ''}${t.nexus && t.mana ? ' + ' : ''}${t.mana ? `💎 ${t.mana.toLocaleString()}` : ''}`; }

// Buy a tool: pays 💠 (player.gold) and 💎 (player.manaCrystals). Returns { ok, error, tool, entry }.
function buy(player, q, opts = {}) {
  const t = toolById(q);
  if (!t) return { ok: false, error: `❌ Unknown tool. Use */mine shop* and buy by number (1-${ORDER.length}).` };
  const disc = Math.max(0, Math.min(0.5, Number(opts.discount) || 0));
  const nx = Math.floor(t.nexus * (1 - disc)), mn = Math.floor(t.mana * (1 - disc));
  if ((player.gold || 0) < nx) return { ok: false, error: `❌ Not enough Nexus for *${t.name}*.\nPrice: ${priceLine({ nexus: nx, mana: mn })}\nYou have: 💠 ${(player.gold || 0).toLocaleString()}` };
  if ((player.manaCrystals || 0) < mn) return { ok: false, error: `❌ Not enough Mana Stones for *${t.name}*.\nPrice: ${priceLine({ nexus: nx, mana: mn })}\nYou have: 💎 ${(player.manaCrystals || 0).toLocaleString()}` };
  const m = state(player);
  if (t.consumable) {
    const best = bestTool(player);
    if (!best) return { ok: false, error: `❌ You own no tool to repair. Buy a pickaxe first.` };
    player.gold -= nx; player.manaCrystals = (player.manaCrystals || 0) - mn;
    const def = TOOLS[best.id]; const before = best.durability;
    best.durability = Math.min(def.durability, best.durability + t.repair);
    return { ok: true, tool: t, paid: { nexus: nx, mana: mn }, line: `🧰 *${def.name}* repaired: ${before} → ${best.durability}/${def.durability} durability.` };
  }
  if (t.accessory && m.tools.find(x => x.id === t.id)) return { ok: false, error: `❌ You already carry a *${t.name}*.` };
  player.gold -= nx; player.manaCrystals = (player.manaCrystals || 0) - mn;
  try { require('./TransactionLog').logSpend(player, 'mining_shop', nx, mn, t.name); } catch (e) {}
  const entry = { id: t.id, durability: t.durability, boughtAt: Date.now() };
  m.tools.push(entry);
  return { ok: true, tool: t, entry, paid: { nexus: nx, mana: mn }, line: `${t.emoji} *${t.name}* bought — ${t.durability} durability. Use */mine* on a cleared dungeon floor.` };
}

// Best usable (non-accessory) tool = highest max yield with durability left.
function bestTool(player) {
  const m = state(player);
  const list = m.tools.filter(x => x && TOOLS[x.id] && !TOOLS[x.id].accessory && !TOOLS[x.id].consumable && (x.durability || 0) > 0);
  // Push #102g (BUG-056): a tool chosen with /mine use wins while it still has durability; else the strongest one.
  if (m.active) { const pick = list.find(x => x.id === m.active); if (pick) return pick; }
  list.sort((a, b) => TOOLS[b.id].max - TOOLS[a.id].max);
  return list[0] || null;
}
// Push #102g (BUG-056): /mine use <#|name> — switch the tool you swing with.
function useTool(player, q) {
  const m = state(player);
  const owned = m.tools.filter(x => x && TOOLS[x.id] && !TOOLS[x.id].accessory && !TOOLS[x.id].consumable);
  if (!owned.length) return { ok: false, error: `❌ You own no mining tools. 🛒 */mine shop*` };
  const s = String(q || '').trim().toLowerCase();
  let t = null;
  if (/^\d+$/.test(s)) t = owned[parseInt(s, 10) - 1] || null;
  else if (s) t = owned.find(x => TOOLS[x.id].name.toLowerCase() === s || x.id === s || TOOLS[x.id].name.toLowerCase().includes(s)) || null;
  if (!t) return { ok: false, error: [`❌ Pick a tool you own:`, ...owned.map((x, i) => `  ${i + 1}. ${TOOLS[x.id].emoji} ${TOOLS[x.id].name} — ${x.durability}/${TOOLS[x.id].durability}${m.active === x.id ? ' ✅ active' : ''}`), `Usage: */mine use <#>*`].join('\n') };
  if ((t.durability || 0) <= 0) return { ok: false, error: `❌ ${TOOLS[t.id].emoji} ${TOOLS[t.id].name} is broken (0 durability). Repair it first (*/mine buy repair_kit*) or pick another.` };
  m.active = t.id;
  return { ok: true, tool: t, line: `✅ You now swing with ${TOOLS[t.id].emoji} *${TOOLS[t.id].name}* (${t.durability}/${TOOLS[t.id].durability}).` };
}
function lantern(player) { return state(player).tools.find(x => x && x.id === 'miners_lantern' && (x.durability || 0) > 0) || null; }

// Can this hunter mine the gate's current floor right now?
function canMine(gate, player, jid) {
  if (!gate || !gate.raid || gate.raid.status !== 'active') return { ok: false, error: `❌ You are not inside an active dungeon raid.` };
  if (gate.cleared || gate.broken) return { ok: false, error: `❌ This gate is finished — nothing left to mine.` };
  const floor = gate.currentFloor || 1;
  const alive = (gate.monsters || []).some(m => m && m.floor === floor && !m.defeated && (m.hp || 0) > 0 && !(m.elite && floor >= (gate.totalFloors || 1)));
  if (alive) return { ok: false, error: `❌ *Floor ${floor} is not clear yet.* Kill every beast on it first, then mine before the party advances.` };
  if (gate.doublePending) return { ok: false, error: `❌ The leader is deciding on the Double Dungeon — mining is closed.` };
  const member = (gate.raid.members || []).find(x => x && x.id === jid);
  if (!member) return { ok: false, error: `❌ You are not a member of this raid.` };
  if (member.hp !== undefined && member.hp <= 0) return { ok: false, error: `💀 The dead do not mine.` };
  const tool = bestTool(player);
  if (!tool) return { ok: false, error: `❌ You have no mining tool with durability left.\n🛒 */mine shop* — pickaxes, drills, excavators (also in */guild shop*).` };
  gate.mining = gate.mining || {};
  const used = ((gate.mining[floor] || {})[jid]) || 0;
  if (used >= ATTEMPTS_PER_FLOOR) return { ok: false, error: `❌ You already mined *${ATTEMPTS_PER_FLOOR}×* on Floor ${floor}. Advance and try the next one.` };
  if (gate.mining._busy && gate.mining._busy[jid] && Date.now() - gate.mining._busy[jid] < 30000) return { ok: false, error: `⛏️ You are already swinging — wait for the result.` };
  return { ok: true, floor, tool, def: TOOLS[tool.id], used };
}

function progressLines(def, name, floor) {
  return [
    `${def.emoji} *${name}* raises the *${def.name}* on Floor ${floor}…`,
    def.id === 'excavator' ? `🚜 The excavator roars — rock and dust everywhere…` : `💥 *CLANG!* Sparks fly as the rock splits…`,
    `✨ A faint glow seeps from the crack…`,
  ];
}

// Roll one swing. Mutates player (durability/stats) and gate (loot/attempt count). Deterministic with rng.
function resolve(gate, player, jid, rng = Math.random) {
  const c = canMine(gate, player, jid);
  if (!c.ok) return c;
  const { floor, tool, def } = c;
  const lamp = lantern(player);
  const m = state(player);
  gate.mining[floor] = gate.mining[floor] || {};
  gate.mining[floor][jid] = (gate.mining[floor][jid] || 0) + 1;
  gate.floorClearedAt = Date.now(); // the swing counts as activity — the floor does not revive mid-mining
  tool.durability = Math.max(0, (tool.durability || 0) - 1);
  if (lamp) lamp.durability = Math.max(0, (lamp.durability || 0) - 1);
  m.stats.swings++;
  const chance = Math.min(0.95, def.chance + (lamp ? TOOLS.miners_lantern.chanceBonus : 0));
  const out = { ok: true, floor, def, success: false, mana: 0, essence: 0, broke: false, lampBroke: false, left: ATTEMPTS_PER_FLOOR - gate.mining[floor][jid], durability: tool.durability };
  if (tool.durability <= 0) { out.broke = true; m.stats.broken++; m.tools = m.tools.filter(x => x !== tool); }
  if (lamp && lamp.durability <= 0) { out.lampBroke = true; m.tools = m.tools.filter(x => x !== lamp); }
  if (rng() < chance) {
    out.success = true; m.stats.hits++;
    const rm = RANK_MULT[String(gate.rank || 'E').toUpperCase()] || 1;
    const raw = def.min + rng() * (def.max - def.min);
    out.mana = Math.max(def.min, Math.min(def.max, Math.floor(raw * rm)));
    m.stats.mana += out.mana;
    gate.crystalLoot = (Number(gate.crystalLoot) || 0) + out.mana;              // paid out with the gate's loot
    if (!gate.accumulatedTreasure) gate.accumulatedTreasure = { nexus: 0, crystals: 0 };
    gate.accumulatedTreasure.crystals += out.mana;
    gate.minedCrystals = (gate.minedCrystals || 0) + out.mana;
    const essChance = def.essence + (lamp ? TOOLS.miners_lantern.essenceBonus : 0);
    if (rng() < essChance) { out.essence = 1; m.stats.essence++; try { require('./EssenceStones').grant(player, gate.rank || 'E', 1); } catch (e) {} }
  }
  return out;
}

function resultText(player, r, gate) {
  const L = [];
  if (r.success) {
    L.push(`💎 *STRIKE!* *${player.name}* mined *${r.mana.toLocaleString()} Mana Stones* — added to this gate's loot (paid at clear).`);
    if (r.essence) { const ES = require('./EssenceStones'); L.push(`${ES.emojiFor(gate.rank)} An *${ES.nameFor(gate.rank)}* glints in the rubble! → your inventory`); }
  } else {
    L.push(`🪨 *Nothing but rock.* *${player.name}*'s swing turned up no Mana Stones.`);
  }
  L.push(`${r.def.emoji} ${r.def.name}: ${r.broke ? '*BROKE!* 💥 (0 durability — buy or repair)' : `${r.durability} durability left`}${r.lampBroke ? ` · 🏮 Lantern burnt out` : ''}`);
  L.push(`⛏️ Swings left on Floor ${r.floor}: *${r.left}/${ATTEMPTS_PER_FLOOR}* · gate mined total: 💎 ${(gate.minedCrystals || 0).toLocaleString()}`);
  return L.join('\n');
}

function infoText(player, FRAME = '━━━━━━━━━━━━━━━━━━') {
  const m = state(player);
  const L = [FRAME, `⛏️ *MINING — ${player.name}*`, FRAME];
  if (!m.tools.length) L.push(`You own no mining tools.`, `🛒 */mine shop* — buy a pickaxe (also sold in */guild shop*).`);
  else for (const t of m.tools) { const d = TOOLS[t.id]; if (!d) continue; L.push(`${d.emoji} *${d.name}*${(bestTool(player) || {}) === t ? ' ✅ active' : ''} — ${t.durability}/${d.durability} durability${d.accessory ? ' (accessory)' : ` · ${d.min.toLocaleString()}–${d.max.toLocaleString()} 💎 · ${Math.round(d.chance * 100)}%`}`); }
  const s = m.stats;
  L.push(``, `📊 Swings ${s.swings} · Hits ${s.hits} (${s.swings ? Math.round(s.hits / s.swings * 100) : 0}%) · 💎 ${s.mana.toLocaleString()} mined · Essence ${s.essence} · Broken ${s.broken}`);
  L.push(``, `🔁 */mine use <#>* — switch tool (numbered by order above).`); L.push(``, `📖 *HOW:* clear every beast on a floor → */mine* (up to ${ATTEMPTS_PER_FLOOR}× per floor, ~10s each) → then */party advance*.`, `Mined Mana Stones join the gate loot. Essence Stones go straight to you. Tools lose 1 durability per swing (hit or miss).`, FRAME);
  return L.join('\n');
}

function shopText(player, FRAME = '━━━━━━━━━━━━━━━━━━') {
  const L = [FRAME, `🛒 *MINING SHOP*`, FRAME, `💰 You: 💠 ${(player.gold || 0).toLocaleString()} · 💎 ${(player.manaCrystals || 0).toLocaleString()}`, ``];
  catalog().forEach((t, i) => L.push(`*${i + 1}. ${t.emoji} ${t.name}* — ${priceLine(t)}`, `   ${t.desc}${t.durability && !t.consumable ? ` · ${t.durability} dur.` : ''}${t.chance ? ` · ${Math.round(t.chance * 100)}% success` : ''}`));
  L.push(``, `📌 */mine buy <#>* · */mine info* — your tools`, `💡 Owning a bigger tool automatically uses it. Same tools appear in the Guild Shop (guild discount applies).`, FRAME);
  return L.join('\n');
}

// Guild-shop pool entries (sealed packages route type 'mining_tool' back to Mining.grantFromShop).
function guildShopItems() {
  return ['weak_pickaxe', 'strong_pickaxe', 'mining_drill', 'miners_lantern', 'repair_kit'].map(id => { const t = TOOLS[id]; return { id: `mine_${id}`, toolId: id, name: t.name, category: 'Mining', type: 'mining_tool', currency: t.mana ? 'crystals' : 'gold', basePrice: t.mana ? Math.max(t.mana, Math.round(t.nexus / 10)) : t.nexus, description: t.desc }; });
}
function grantFromShop(player, toolId) {
  const t = TOOLS[toolId]; if (!t) return null;
  const m = state(player);
  if (t.consumable) { const best = bestTool(player); if (best) { const d = TOOLS[best.id]; best.durability = Math.min(d.durability, best.durability + t.repair); return `🧰 ${d.name} repaired (+${t.repair})`; } return `🧰 Repair kit wasted — no tool to repair`; }
  m.tools.push({ id: t.id, durability: t.durability, boughtAt: Date.now() });
  return `${t.emoji} ${t.name} (${t.durability} durability) → /mine`;
}

module.exports = { useTool, TOOLS, ORDER, ATTEMPTS_PER_FLOOR, RANK_MULT, catalog, toolById, state, buy, bestTool, lantern, canMine, resolve, progressLines, resultText, infoText, shopText, guildShopItems, grantFromShop, priceLine };
