'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// Push #96h-z19 — SHADOW ARMY (the Shadow Monarch's power, awakens at Lv.50)
//   • /supplication <word>  — choose your SUPPLICATION WORD once ("arise",
//     "banana", anything 3-12 letters). From then on `/<word>` is YOUR command.
//   • A monster YOU defeat lingers for 10 minutes with a button bearing your
//     word. `/<word>` (or `/<word> <name>`) tries to EXTRACT it — THREE chances,
//     each weighted by the strength gap between you and the corpse.
//   • Low-ranking soldiers (E–B, non-boss) merge into the MAIN INFANTRY and
//     attack as ONE unified force. High-ranking soldiers (A/S/boss/elite) are
//     NAMED — `/<word> name <old> <new>` — and fight as individuals using the
//     moves they had in life. They never grow stronger.
//   • `/<word> call <name>` / `/<word> call all` summons them for 30 minutes;
//     `/<word> dismiss` sends them home; `/<word> army` lists everything.
//   • Shadow storage is LIMITED: 3 slots at Lv.50, +2 per 10 levels, and the
//     Shadow Monarch job adds +5 per job level (Shadow Monarch Lv.5 → 38).
// ═══════════════════════════════════════════════════════════════════════════
const UNLOCK_LEVEL = 50;
const PENDING_TTL_MS = 10 * 60 * 1000;
const SUMMON_MS = 30 * 60 * 1000;
const MAX_TRIES = 3;
const HIGH_RANKS = new Set(['A', 'S', 'SS', 'SSS', 'NATIONAL', 'MONARCH']);
const RESERVED = new Set(['help', 'start', 'attack', 'skill', 'profile', 'register', 'event', 'pet', 'guild', 'job', 'inv', 'inventory', 'daily', 'shop', 'bank', 'party', 'cast', 'summon', 'call', 'name', 'army', 'dismiss', 'supplication', 'jobskill']);

const bare = (j) => String(j || '').split('@')[0].split(':')[0];
function ensure(player) {
  if (!player) return null;
  if (!player.shadow || typeof player.shadow !== 'object') player.shadow = { word: null, infantry: { count: 0, atk: 0, hp: 0, def: 0, names: [] }, named: [], pending: [], summoned: [], summonedAt: 0 };
  const s = player.shadow;
  if (!s.infantry) s.infantry = { count: 0, atk: 0, hp: 0, def: 0, names: [] };
  if (!Array.isArray(s.named)) s.named = [];
  if (!Array.isArray(s.pending)) s.pending = [];
  if (!Array.isArray(s.summoned)) s.summoned = [];
  return s;
}
function unlocked(player) { return (Number(player && player.level) || 1) >= UNLOCK_LEVEL; }
function shadowJobLevel(player) {
  try { const JS = require('./JobSystem'); const j = JS.ensure(player); if (!j) return 0; if (j.key === 'shadow_monarch') return JS.level(player); const h = (j.history || []).find(x => x && x.key === 'shadow_monarch'); return h ? Math.max(1, Math.min(5, Number(h.level) || 1)) : 0; } catch (e) { return 0; }
}
function capacity(player) {
  const lv = Number(player && player.level) || 1; if (lv < UNLOCK_LEVEL) return 0;
  return 3 + Math.floor((lv - UNLOCK_LEVEL) / 10) * 2 + shadowJobLevel(player) * 5;
}
function used(player) { const s = ensure(player); return (s.infantry.count || 0) + s.named.length; }
function normWord(w) { return String(w || '').toLowerCase().replace(/[^a-z]/g, ''); }
function setWord(player, word, db) {
  if (!unlocked(player)) return { ok: false, error: `👤 The shadows do not answer yet — the Monarch's power awakens at *Lv.${UNLOCK_LEVEL}*.` };
  const s = ensure(player); const w = normWord(word);
  if (w.length < 3 || w.length > 12) return { ok: false, error: '❌ Your supplication word must be 3–12 letters (a–z only).' };
  if (RESERVED.has(w)) return { ok: false, error: `❌ *${w}* is already a command — pick another word.` };
  try { const fs = require('fs'), path = require('path'); for (const d of [path.join(__dirname, '..', '..', 'commands'), path.join(__dirname, '..', '..', 'commands', 'rpg')]) { if (fs.existsSync(path.join(d, `${w}.js`))) return { ok: false, error: `❌ *${w}* is already a command — pick another word.` }; } } catch (e) {}
  if (s.word) return { ok: false, error: `❌ Your word is already *${s.word}* — a Monarch's word is spoken once.` };
  s.word = w; s.wordAt = Date.now();
  return { ok: true, word: w };
}
/** Owner of a supplication word (for the dynamic command hook). */
function ownerOfWord(db, sender, word) { const p = db && db.users && db.users[sender]; const w = normWord(word); return p && p.shadow && p.shadow.word === w ? p : null; }

function _power(st) { st = st || {}; return Math.max(1, (Number(st.atk) || 0) * 3 + (Number(st.def) || 0) * 1.5 + (Number(st.maxHp || st.hp) || 0) / 10 + (Number(st.speed || st.spd) || 0)); }
function _playerPower(player) {
  let atk = player.stats?.atk || 10, def = player.stats?.def || 5, hp = player.stats?.maxHp || 100, spd = player.stats?.speed || 10;
  try { const GS = require('./GearSystem'); atk = GS.effectiveAtk ? GS.effectiveAtk(player) : atk; def = GS.effectiveDef ? GS.effectiveDef(player) : def; hp = GS.effectiveMaxHp ? GS.effectiveMaxHp(player) : hp; } catch (e) {}
  return _power({ atk, def, maxHp: hp, speed: spd });
}
function _rankOf(m) { return String(m.rank || m.tier || m.grade || 'E').toUpperCase().replace(/[^A-Z]/g, '') || 'E'; }
function isHighRank(m) { return !!(m.isBoss || m.boss || m.elite || HIGH_RANKS.has(_rankOf(m))); }
function _moves(m) {
  const out = [];
  for (const src of [m.moves, m.abilities, m.skills, m.attacks]) if (Array.isArray(src)) for (const x of src) { const n = typeof x === 'string' ? x : x && (x.name || x.skill); if (n && !out.includes(n)) out.push(String(n)); }
  if (!out.length) out.push(`${m.name || 'Shadow'}'s Strike`);
  return out.slice(0, 4);
}

/** Called when `player` lands the killing blow. Returns a hint line (or null). */
function registerCorpse(player, monster, source) {
  if (!player || !monster || !unlocked(player)) return null;
  const s = ensure(player); if (!s.word) return null;
  const now = Date.now(); s.pending = s.pending.filter(c => now - c.at < PENDING_TTL_MS);
  const st = monster.stats || monster;
  const corpse = { id: `${now.toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`, name: String(monster.baseName || monster.name || 'Beast').slice(0, 40), emoji: monster.emoji || '👤', rank: _rankOf(monster), high: isHighRank(monster), level: Number(monster.level) || Number(player.level) || 1,
    atk: Math.max(1, Math.floor(Number(st.atk) || 10)), def: Math.max(0, Math.floor(Number(st.def) || 0)), hp: Math.max(1, Math.floor(Number(st.maxHp || monster.maxHp || st.hp) || 50)), speed: Math.floor(Number(st.speed || st.spd) || 10),
    moves: _moves(monster), power: _power({ atk: st.atk, def: st.def, maxHp: st.maxHp || monster.maxHp || st.hp, speed: st.speed }), tries: MAX_TRIES, at: now, source: source || 'battle' };
  s.pending.push(corpse); while (s.pending.length > 5) s.pending.shift();
  return `👤 The shadow of *${corpse.name}* lingers — say */${s.word}* to extract it (${MAX_TRIES} tries, 10 min).`;
}
/** Button pairs for utils/buttons.quickReplies — the kill message's "Arise" button. */
function buttonFor(player) { const s = player && player.shadow; if (!s || !s.word || !s.pending.length) return null; const c = s.pending[s.pending.length - 1]; return [[`👤 ${s.word.toUpperCase()}`, `/${s.word} ${c.name}`]]; }

function extractChance(player, corpse) {
  const ratio = _playerPower(player) / Math.max(1, corpse.power);
  let pct = 20 + (ratio - 1) * 45; // equal strength 20%, 2× stronger 65%, 2.6× ≈ 92%
  if (corpse.high) pct -= 10;
  pct += shadowJobLevel(player) * 4;
  return Math.max(3, Math.min(95, Math.round(pct)));
}
/** One extraction attempt. */
function extract(player, nameQuery) {
  if (!unlocked(player)) return { ok: false, error: `👤 The shadows do not answer yet — the Monarch's power awakens at *Lv.${UNLOCK_LEVEL}*.` };
  const s = ensure(player); if (!s.word) return { ok: false, error: '👤 Choose your supplication word first — */supplication <word>*.' };
  const now = Date.now(); s.pending = s.pending.filter(c => now - c.at < PENDING_TTL_MS && c.tries > 0);
  if (!s.pending.length) return { ok: false, error: `👤 No fallen shadow answers *${s.word}* — defeat something first (10-minute window).` };
  const q = String(nameQuery || '').trim().toLowerCase();
  const corpse = (q && (s.pending.find(c => c.name.toLowerCase() === q) || s.pending.find(c => c.name.toLowerCase().includes(q)))) || s.pending[s.pending.length - 1];
  const cap = capacity(player);
  if (used(player) >= cap) return { ok: false, error: `👤 Your shadow storage is full (*${used(player)}/${cap}*). Level up or walk the Shadow Monarch path for more room — or */${s.word} release <name>*.` };
  const pct = extractChance(player, corpse); corpse.tries--;
  const roll = Math.random() * 100;
  if (roll >= pct) {
    const left = corpse.tries;
    if (!left) s.pending = s.pending.filter(c => c !== corpse);
    return { ok: true, success: false, corpse, pct, text: `👤 *${s.word.toUpperCase()}!*\n\nThe shadow of *${corpse.name}* writhes… and refuses. (${pct}% chance)\n${left ? `🔁 ${left} ${left === 1 ? 'try' : 'tries'} left.` : '💨 It fades beyond your reach.'}` };
  }
  s.pending = s.pending.filter(c => c !== corpse);
  if (corpse.high) {
    let nm = corpse.name; let i = 2; while (s.named.some(x => x.name.toLowerCase() === nm.toLowerCase())) nm = `${corpse.name} ${i++}`;
    const soldier = { id: corpse.id, name: nm, origin: corpse.name, emoji: corpse.emoji, rank: corpse.rank, level: corpse.level, atk: corpse.atk, def: corpse.def, hp: corpse.hp, speed: corpse.speed, moves: corpse.moves, at: now };
    s.named.push(soldier);
    return { ok: true, success: true, corpse, soldier, pct, text: `👤 *${s.word.toUpperCase()}!*\n\n${corpse.emoji} *${corpse.name}* rises from its own shadow and kneels — a *${corpse.rank}-rank shadow soldier*. (${pct}%)\n🏷️ Name it: */${s.word} name ${nm} <new name>*\n📣 Summon: */${s.word} call ${nm}*\n🗃️ Storage ${used(player)}/${cap}` };
  }
  const inf = s.infantry; const n = inf.count || 0;
  inf.atk = Math.round((inf.atk * n + corpse.atk) / (n + 1)); inf.def = Math.round((inf.def * n + corpse.def) / (n + 1)); inf.hp = Math.round((inf.hp * n + corpse.hp) / (n + 1)); inf.count = n + 1;
  inf.names = [...(inf.names || []), corpse.name].slice(-20);
  return { ok: true, success: true, corpse, infantry: true, pct, text: `👤 *${s.word.toUpperCase()}!*\n\n${corpse.emoji} *${corpse.name}* dissolves into shadow and joins your *main infantry* (${inf.count} strong). (${pct}%)\n🗃️ Storage ${used(player)}/${cap}` };
}
function rename(player, oldName, newName) {
  const s = ensure(player); const o = String(oldName || '').trim().toLowerCase(); const nn = String(newName || '').trim().replace(/[*_~`]/g, '').slice(0, 24);
  const sol = s.named.find(x => x.name.toLowerCase() === o) || s.named.find(x => x.name.toLowerCase().includes(o));
  if (!sol) return { ok: false, error: `❌ No named shadow soldier matches *${oldName}*.` };
  if (nn.length < 2) return { ok: false, error: '❌ Give it a name of 2–24 characters.' };
  if (s.named.some(x => x !== sol && x.name.toLowerCase() === nn.toLowerCase())) return { ok: false, error: `❌ You already have a soldier named *${nn}*.` };
  const was = sol.name; sol.name = nn; s.summoned = s.summoned.map(id => id);
  return { ok: true, text: `🏷️ *${was}* is now *${nn}*. It will answer to that name.` };
}
function release(player, name) {
  const s = ensure(player); const q = String(name || '').trim().toLowerCase();
  if (q === 'infantry') { const n = s.infantry.count; s.infantry = { count: 0, atk: 0, hp: 0, def: 0, names: [] }; return { ok: true, text: `💨 You release the main infantry (${n} shadows) back into the dark.` }; }
  const i = s.named.findIndex(x => x.name.toLowerCase() === q || x.name.toLowerCase().includes(q));
  if (i < 0) return { ok: false, error: `❌ No shadow soldier matches *${name}*. (Use *infantry* to release the main infantry.)` };
  const [gone] = s.named.splice(i, 1); s.summoned = s.summoned.filter(id => id !== gone.id);
  return { ok: true, text: `💨 *${gone.name}* returns to the dark. Storage ${used(player)}/${capacity(player)}.` };
}
function call(player, what) {
  const s = ensure(player); const q = String(what || '').trim().toLowerCase();
  if (!s.named.length && !s.infantry.count) return { ok: false, error: '👤 You command no shadows yet.' };
  const now = Date.now();
  if (!q || q === 'all') { s.summoned = s.named.map(x => x.id); s.summonedAt = now; s.infantryOut = true; return { ok: true, text: `👤 *${s.word.toUpperCase()} — CALL ALL!*\n\n${s.named.length ? s.named.map(x => `${x.emoji} *${x.name}*`).join(' · ') : ''}${s.infantry.count ? `\n🛡️ Main infantry (${s.infantry.count}) marches with you.` : ''}\n⏳ Your army fights beside you for 30 minutes.` }; }
  if (q === 'infantry') { s.infantryOut = true; s.summonedAt = now; return { ok: true, text: `🛡️ The main infantry (${s.infantry.count}) rises as one.` }; }
  const sol = s.named.find(x => x.name.toLowerCase() === q) || s.named.find(x => x.name.toLowerCase().includes(q));
  if (!sol) return { ok: false, error: `❌ No shadow soldier answers to *${what}*.` };
  if (!s.summoned.includes(sol.id)) s.summoned.push(sol.id); s.summonedAt = now;
  return { ok: true, text: `👤 *${s.word.toUpperCase()}!* ${sol.emoji} *${sol.name}* steps out of your shadow. (30 min)` };
}
function dismiss(player) { const s = ensure(player); s.summoned = []; s.infantryOut = false; return { ok: true, text: '🌑 Your shadows sink back into the ground.' }; }
function activeSoldiers(player) {
  const s = ensure(player); if (!s.summonedAt || Date.now() - s.summonedAt > SUMMON_MS) { if (s.summoned.length || s.infantryOut) { s.summoned = []; s.infantryOut = false; } return { named: [], infantry: false }; }
  return { named: s.named.filter(x => s.summoned.includes(x.id)), infantry: !!s.infantryOut && s.infantry.count > 0 };
}
/**
 * The army's turn. Applies damage to `target` (hp field or stats.hp) and returns { damage, lines }.
 * Infantry = one unified blow; each named soldier = its own move. Capped at 25% of target max HP per soldier.
 */
function strike(player, target) {
  const out = { damage: 0, lines: [] };
  if (!player || !target) return out;
  const { named, infantry } = activeSoldiers(player); if (!named.length && !infantry) return out;
  const s = ensure(player);
  const tst = target.stats && Number.isFinite(target.stats.hp) ? target.stats : target;
  const tmax = Math.max(1, Number(tst.maxHp || target.maxHp || tst.hp) || 1); const tdef = Number(tst.def || target.def) || 0;
  const hit = (atk, mult) => Math.max(1, Math.min(Math.floor(tmax * 0.25), Math.floor(Math.max(1, atk * mult * (0.9 + Math.random() * 0.2) - tdef * 0.3))));
  const apply = (d) => { if (Number.isFinite(tst.hp)) tst.hp = Math.max(0, tst.hp - d); out.damage += d; };
  if (infantry) { const n = s.infantry.count; const d = hit(s.infantry.atk, 0.9 * Math.pow(n, 0.6)); apply(d); out.lines.push(`🛡️ *Shadow Infantry* (${n}) advances as one — *${d.toLocaleString()}* damage!`); }
  for (const sol of named) { const mv = sol.moves[Math.floor(Math.random() * sol.moves.length)] || 'Strike'; const d = hit(sol.atk, 1.25); apply(d); out.lines.push(`${sol.emoji} *${sol.name}* uses *${mv}* — *${d.toLocaleString()}* damage!`); if (tst.hp <= 0) break; }
  return out;
}
function card(player) {
  const s = ensure(player); const cap = capacity(player);
  const L = [`👤 *SHADOW ARMY*${s.word ? ` — word: */${s.word}*` : ''}`, `🗃️ Storage *${used(player)}/${cap}* · Shadow Monarch job Lv.${shadowJobLevel(player)}`, ''];
  if (!unlocked(player)) L.push(`🔒 Awakens at Lv.${UNLOCK_LEVEL}.`);
  else if (!s.word) L.push('📝 Choose your supplication word: */supplication <word>*');
  const act = activeSoldiers(player);
  L.push(`🛡️ *Main infantry:* ${s.infantry.count || 0} shadows${s.infantry.count ? ` · ATK ${s.infantry.atk} · DEF ${s.infantry.def}${act.infantry ? ' · ⚔️ OUT' : ''}` : ''}`);
  if (s.named.length) { L.push('', '⭐ *Named soldiers:*'); s.named.forEach((x, i) => L.push(`  ${i + 1}. ${x.emoji} *${x.name}* (${x.rank}) — ATK ${x.atk} · HP ${x.hp} · ${x.moves.slice(0, 2).join(', ')}${act.named.includes(x) ? ' · ⚔️ OUT' : ''}`)); }
  const now = Date.now(); const pend = s.pending.filter(c => now - c.at < PENDING_TTL_MS && c.tries > 0);
  if (pend.length) { L.push('', '🕯️ *Lingering shadows:*'); pend.forEach(c => L.push(`  • ${c.emoji} ${c.name} (${c.rank}) — ${c.tries} tries · ${extractChance(player, c)}%`)); }
  if (s.word) L.push('', `📌 /${s.word} [name] · /${s.word} call <name|all|infantry> · /${s.word} name <old> <new> · /${s.word} release <name|infantry> · /${s.word} dismiss`);
  return L;
}
/** Dispatcher for `/<word> ...`. Returns text. */
function handle(player, args) {
  const s = ensure(player); const sub = String(args[0] || '').toLowerCase(); const rest = args.slice(1).join(' ');
  let r;
  if (sub === 'call') r = call(player, rest);
  else if (sub === 'name' || sub === 'rename') { const parts = args.slice(1); if (parts.length < 2) return '📌 /' + s.word + ' name <old name> <new name>'; const sol = s.named.find(x => parts.join(' ').toLowerCase().startsWith(x.name.toLowerCase())); const oldN = sol ? sol.name : parts[0]; const newN = sol ? parts.join(' ').slice(sol.name.length).trim() : parts.slice(1).join(' '); r = rename(player, oldN, newN); }
  else if (sub === 'release' || sub === 'free') r = release(player, rest);
  else if (sub === 'dismiss' || sub === 'return') r = dismiss(player);
  else if (sub === 'army' || sub === 'list' || sub === 'status') return card(player).join('\n');
  else r = extract(player, args.join(' '));
  return r.ok ? r.text : r.error;
}
module.exports = { UNLOCK_LEVEL, MAX_TRIES, ensure, unlocked, capacity, used, setWord, ownerOfWord, registerCorpse, buttonFor, extractChance, extract, rename, release, call, dismiss, activeSoldiers, strike, card, handle, isHighRank, normWord };
