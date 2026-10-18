// ═══════════════════════════════════════════════════════════════
// Corpses — Push #103b (Necromancer / Phantom combat snippet)
// A battlefield ledger of EVERYTHING that actually died in this fight:
// monsters, bosses, hunters and summons. Necromancer summons/explosions and
// Phantom possession consume REAL corpses from this ledger — nothing is
// conjured from thin air. The ledger lives on the gate (party raids) or on the
// player's solo dungeon run and dies with the fight.
// ═══════════════════════════════════════════════════════════════
'use strict';

const KIND_MULT = { monster: 1, boss: 2.5, hunter: 1.6, summon: 0.5 };
const MAX_CORPSES = 24;

function ledger(ctx) {
  if (!ctx || typeof ctx !== 'object') return [];
  // gate / raid
  if (ctx.raid || ctx.monsters || ctx.totalFloors !== undefined) { if (!Array.isArray(ctx.corpses)) ctx.corpses = []; return ctx.corpses; }
  // player → solo dungeon run
  if (ctx.dungeon && typeof ctx.dungeon === 'object') { if (!Array.isArray(ctx.dungeon.corpses)) ctx.dungeon.corpses = []; return ctx.dungeon.corpses; }
  if (!Array.isArray(ctx.corpses)) ctx.corpses = [];
  return ctx.corpses;
}

function add(ctx, c) {
  const L = ledger(ctx); if (!c || !c.name) return null;
  const corpse = {
    id: `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`,
    kind: KIND_MULT[c.kind] ? c.kind : 'monster',
    name: String(c.name), level: Math.max(1, Math.floor(Number(c.level) || 1)),
    atk: Math.max(1, Math.floor(Number(c.atk) || 10)), def: Math.max(0, Math.floor(Number(c.def) || 0)),
    maxHp: Math.max(1, Math.floor(Number(c.maxHp) || 100)),
    class: c.class || null, variant: c.variant || null, jid: c.jid || null, emoji: c.emoji || null,
    killedBy: c.killedBy || null, at: Date.now(), used: false,
  };
  L.push(corpse); while (L.length > MAX_CORPSES) L.shift();
  return corpse;
}

function available(ctx) { return ledger(ctx).filter(c => c && !c.used); }
function count(ctx) { return available(ctx).length; }
function difficulty(c) { return Math.max(1, Math.round((c.level || 1) * (KIND_MULT[c.kind] || 1))); }

// Take up to n corpses (strongest first). Marks them used. Returns [] when not enough.
function take(ctx, n = 1, opts = {}) {
  const avail = available(ctx).sort((a, b) => difficulty(b) - difficulty(a));
  if (avail.length < n && !opts.partial) return [];
  const got = avail.slice(0, n); for (const c of got) { c.used = true; c.usedBy = opts.by || null; c.usedFor = opts.purpose || null; }
  return got;
}
function takeAll(ctx, opts = {}) { return take(ctx, available(ctx).length, { ...opts, partial: true }); }
function find(ctx, query) { const q = String(query || '').toLowerCase().trim(); if (!q) return null; return available(ctx).find(c => c.name.toLowerCase() === q) || available(ctx).find(c => c.name.toLowerCase().includes(q)) || null; }
function clear(ctx) { if (ctx && Array.isArray(ctx.corpses)) ctx.corpses = []; if (ctx && ctx.dungeon && Array.isArray(ctx.dungeon.corpses)) ctx.dungeon.corpses = []; }

function label(c) { const k = c.kind === 'boss' ? '👑' : c.kind === 'hunter' ? '🧍' : c.kind === 'summon' ? '👻' : '🐾'; return `${c.emoji || k} ${c.name} (Lv.${c.level}${c.kind !== 'monster' ? ` · ${c.kind}` : ''})`; }
function lines(ctx) { const a = available(ctx); if (!a.length) return ['🪦 No corpses on this battlefield yet.']; return [`🪦 *Corpses on the field: ${a.length}*`, ...a.slice(0, 8).map(c => `  • ${label(c)}`), ...(a.length > 8 ? [`  …and ${a.length - 8} more`] : [])]; }

// Convenience recorders ---------------------------------------------------
function recordMonster(ctx, mon, killedBy = null) { if (!mon) return null; return add(ctx, { kind: mon.isBoss || mon.boss ? 'boss' : 'monster', name: mon.name, level: mon.level || (ctx && ctx.level) || 1, atk: mon.atk || (mon.stats && mon.stats.atk), def: mon.def || (mon.stats && mon.stats.def), maxHp: mon.maxHp || (mon.stats && mon.stats.maxHp) || mon.hp, variant: mon.variant || mon.type || null, emoji: mon.emoji || null, killedBy }); }
function recordBoss(ctx, boss, killedBy = null) { if (!boss) return null; return add(ctx, { kind: 'boss', name: boss.name || 'Gate Boss', level: boss.level || (ctx && ctx.level) || 1, atk: boss.atk, def: boss.def, maxHp: boss.maxHp || boss.hp, emoji: boss.emoji || '👑', killedBy }); }
function recordHunter(ctx, u) { if (!u || !u.stats) return null; return add(ctx, { kind: 'hunter', name: u.name || 'Hunter', level: u.level || 1, atk: u.stats.atk, def: u.stats.def, maxHp: u.stats.maxHp, class: u.class || null, jid: u.jid || u.id || null, emoji: '🧍' }); }
function recordSummon(ctx, s, ownerName = null) { if (!s) return null; return add(ctx, { kind: 'summon', name: s.name, level: s.level || 1, atk: s.atk, def: s.def || 0, maxHp: s.maxHp, emoji: s.emoji || '👻', killedBy: ownerName }); }

module.exports = { KIND_MULT, MAX_CORPSES, ledger, add, available, count, difficulty, take, takeAll, find, clear, label, lines, recordMonster, recordBoss, recordHunter, recordSummon };
