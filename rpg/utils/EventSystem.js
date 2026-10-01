// ═══════════════════════════════════════════════════════════════
// EVENT SYSTEM — Push #96h: the JEJU ISLAND RAID
//
// A 10-day open-field raid that lives in the EVENTS GC (/setgc events --main).
//   • Only an owner / co-owner may /event start.
//   • Waves: 100 beasts + 1 boss. Clear a wave → the next, harder one rolls in.
//   • Beasts never auto-attack. They COUNTER whoever strikes them, and if left
//     alone for 30s they regenerate 5% HP per 30s of quiet.
//   • Friendly fire is ON: /event hit @hunter. Kill a hunter → you take 50% of
//     their points and they drop to 0. A fallen hunter waits 1h to respawn.
//   • /eventafk — nobody can target you, you cannot target anybody.
//   • Lv.10 EVENT DOMAIN — a domain that only works here (/event domain …).
//     Casting sends the NAME and the DESCRIPTION as two separate messages.
//   • /epoints · /estats · /eshop · /event lb
// ═══════════════════════════════════════════════════════════════
'use strict';
const DAY = 24 * 60 * 60 * 1000;
const EVENT_LENGTH_MS = 10 * DAY;
const WAVE_SIZE = 100;
const RESPAWN_MS = 60 * 60 * 1000;
const REGEN_IDLE_MS = 30 * 1000;
const REGEN_PCT = 0.05;
const STEAL_PCT = 0.5;
const DOMAIN_LEVEL = 10;
const DOMAIN_ENERGY = 350;
const DOMAIN_COOLDOWN_MS = 60 * 60 * 1000;
const DOMAIN_EFFECT_MS = 10 * 60 * 1000;
const RANKS = ['E', 'D', 'C', 'B', 'A', 'S'];
const KILL_POINTS = { E: 10, D: 15, C: 20, B: 30, A: 45, S: 60 };
const BOSS_POINTS = 300;
const HUNTER_KILL_BONUS = 25;

const _grant = (p, rank, kind) => { try { return require('./ArmoryStore').grantRandom(p, rank, kind, 'event_shop'); } catch (e) { return null; } };
const _inv = (p) => (p.inventory || (p.inventory = {}));
const SHOP = [
  { key: 'nexus1',  cat: 'Currency', name: '💠 250,000 Nexus',           cost: 150,  give: (p) => { p.gold = (p.gold || 0) + 250000; } },
  { key: 'nexus2',  cat: 'Currency', name: '💠 1,200,000 Nexus',         cost: 600,  give: (p) => { p.gold = (p.gold || 0) + 1200000; } },
  { key: 'mana1',   cat: 'Currency', name: '💎 30,000 Mana Stones',      cost: 250,  give: (p) => { p.manaCrystals = (p.manaCrystals || 0) + 30000; } },
  { key: 'mana2',   cat: 'Currency', name: '💎 150,000 Mana Stones',     cost: 1000, give: (p) => { p.manaCrystals = (p.manaCrystals || 0) + 150000; } },
  { key: 'potion1', cat: 'Potions',  name: '🧪 3× Medium Health Potion', cost: 120,  give: (p) => { _inv(p).mediumHealthPotions = (_inv(p).mediumHealthPotions || 0) + 3; } },
  { key: 'potion2', cat: 'Potions',  name: '🧪 2× Higher Health Potion', cost: 220,  give: (p) => { _inv(p).higherHealthPotions = (_inv(p).higherHealthPotions || 0) + 2; } },
  { key: 'revive',  cat: 'Potions',  name: '✨ Revive Token',             cost: 350,  give: (p) => { _inv(p).reviveTokens = (_inv(p).reviveTokens || 0) + 1; } },
  { key: 'weaponc', cat: 'Armoury',  name: '🗡️ C-Rank weapon (random)',  cost: 500,  give: (p) => _grant(p, 'C', 'weapon') },
  { key: 'gearc',   cat: 'Armoury',  name: '🛡️ C-Rank gear (random)',    cost: 500,  give: (p) => _grant(p, 'C', 'gear') },
  { key: 'weaponb', cat: 'Armoury',  name: '🗡️ B-Rank weapon (random)',  cost: 1200, give: (p) => _grant(p, 'B', 'weapon') },
  { key: 'gearb',   cat: 'Armoury',  name: '🛡️ B-Rank gear (random)',    cost: 1200, give: (p) => _grant(p, 'B', 'gear') },
  { key: 'weapona', cat: 'Armoury',  name: '🗡️ A-Rank weapon (random)',  cost: 3000, give: (p) => _grant(p, 'A', 'weapon') },
  { key: 'geara',   cat: 'Armoury',  name: '🛡️ A-Rank gear (random)',    cost: 3000, give: (p) => _grant(p, 'A', 'gear') },
  { key: 'key',     cat: 'Special',  name: '🗝️ Instance Key',             cost: 400,  give: (p) => { p.jobKeys = (p.jobKeys || 0) + 1; } },
  { key: 'title',   cat: 'Special',  name: '🏝️ Title: Jeju Conqueror',    cost: 2500, give: (p) => { p.titles = Array.isArray(p.titles) ? p.titles : []; if (!p.titles.includes('Jeju Conqueror')) p.titles.push('Jeju Conqueror'); } },
];

function _bare(j) { return String(j || '').split(':')[0].split('@')[0]; }
function _ev(db) { return db && db.event && db.event.active ? db.event : null; }
function _gc(db) { try { return require('./AstralGroups').primaryOf(db, 'events') || null; } catch (e) { return null; } }
function gcId(db) { const g = _gc(db); return g ? (g.groupId || g) : null; }
function isEventGC(db, chatId) { const id = gcId(db); return !!(id && chatId && id === chatId); }
function _p(db, player) { if (!player.eventStats) player.eventStats = {}; const id = _ev(db) ? _ev(db).id : 'none'; if (player.eventStats.id !== id) player.eventStats = { id, points: 0, kills: 0, bossKills: 0, hunterKills: 0, deaths: 0, dmg: 0, diedAt: 0, afk: false, spent: 0 }; return player.eventStats; }
function _name(p) { return p.name || p.username || 'Hunter'; }
function _hunterStats(p) {
  const s = p.stats || {}; let g = { atk: 0, def: 0, hp: 0, speed: 0, crit: 0 };
  try { g = require('./GearSystem').getEquippedBonuses(p) || g; } catch (e) {}
  let maxHp = (s.maxHp || 100) + (g.hp || 0); try { maxHp = require('./GearSystem').effectiveMaxHp(p) || maxHp; } catch (e) {}
  return { atk: (s.atk || 10) + (g.atk || 0), def: (s.def || 0) + (g.def || 0), speed: (s.speed || 50) + (g.speed || 0), crit: 5 + (g.crit || 0), maxHp };
}
function _mit(def, atk) { return Math.min(0.70, def / Math.max(1, def + atk)); }
function _dmg(atk, def, mult = 1) { return Math.max(5, Math.floor(atk * (1 - _mit(def, atk)) * mult * (0.9 + Math.random() * 0.2))); }

// ── wave building ─────────────────────────────────────────────
function _party(db) {
  const users = Object.values(db.users || {}).filter(u => u && (u.level || 0) >= DOMAIN_LEVEL && u.stats);
  users.sort((a, b) => (b.level || 0) - (a.level || 0));
  const top = users.slice(0, 40); if (!top.length) return { atk: 100, hp: 1000, def: 40, speed: 150 };
  const acc = { atk: 0, hp: 0, def: 0, speed: 0 };
  for (const u of top) { const h = _hunterStats(u); acc.atk += h.atk; acc.hp += h.maxHp; acc.def += h.def; acc.speed += h.speed; }
  return { atk: acc.atk / top.length, hp: acc.hp / top.length, def: acc.def / top.length, speed: acc.speed / top.length };
}
function buildWave(db, waveNo) {
  const anchor = _party(db); const wm = 1 + (waveNo - 1) * 0.22;
  let TM = null; try { TM = require('./MonsterTypes'); } catch (e) {}
  let pool = []; try { const GM = require('../dungeons/GateManager'); for (const r of RANKS) pool = pool.concat((GM.buildGateMonsters(r, 4, 100, null) || []).filter(m => m && !m.elite).map(m => ({ name: m.name, rank: r }))); } catch (e) {}
  if (!pool.length) pool = RANKS.map(r => ({ name: `${r}-Rank Jeju Ant`, rank: r }));
  const mons = [];
  for (let i = 0; i < WAVE_SIZE; i++) {
    const ri = Math.min(5, Math.floor(i / (WAVE_SIZE / 6)) + Math.min(3, Math.floor((waveNo - 1) / 2))); const rank = RANKS[Math.min(5, ri)];
    const pick = pool.filter(m => m.rank === rank); const src = pick[Math.floor(Math.random() * pick.length)] || pool[Math.floor(Math.random() * pool.length)];
    const rm = 1 + ri * 0.35;
    const hp = Math.floor(anchor.atk * 4 * rm * wm);
    const m = { id: i + 1, name: src.name, rank, hp, maxHp: hp, atk: Math.floor(anchor.hp * 0.06 * rm * wm), def: Math.floor(anchor.atk * 0.45 * rm), speed: Math.round(anchor.speed * (0.55 + ri * 0.1)), lastHit: 0, defeated: false, by: null };
    if (TM) TM.apply(m);
    mons.push(m);
  }
  const bossNames = ['Ant King Beru', 'Queen of the Hive', 'Jeju Titan Ant', 'Mutant Ant Lord'];
  const bhp = Math.floor(anchor.atk * 60 * wm * (1 + waveNo * 0.1));
  const boss = { id: WAVE_SIZE + 1, name: `${bossNames[(waveNo - 1) % bossNames.length]} (Wave ${waveNo} Boss)`, rank: 'S', isBoss: true, hp: bhp, maxHp: bhp, atk: Math.floor(anchor.hp * 0.22 * wm), def: Math.floor(anchor.atk * 0.9), speed: Math.round(anchor.speed * 1.15), lastHit: 0, defeated: false, by: null, family: 'insect' };
  if (TM) TM.apply(boss);
  mons.push(boss);
  return mons;
}

// ── lifecycle ─────────────────────────────────────────────────
function start(db, starterJid) {
  if (_ev(db)) return { ok: false, error: 'The Jeju Island Raid is already running — /event status.' };
  const now = Date.now();
  db.event = { id: `jeju_${now}`, name: 'Jeju Island Raid', active: true, startedAt: now, endsAt: now + EVENT_LENGTH_MS, startedBy: starterJid, wave: 1, wavesCleared: 0, monsters: buildWave(db, 1), log: [] };
  return { ok: true, event: db.event };
}
function end(db, reason = 'ended') {
  const ev = _ev(db); if (!ev) return null;
  ev.active = false; ev.endedAt = Date.now(); ev.endReason = reason; db.eventHistory = (db.eventHistory || []).slice(-5).concat([{ id: ev.id, startedAt: ev.startedAt, endedAt: ev.endedAt, waves: ev.wavesCleared, top: leaderboard(db, 3).map(e => ({ name: e.name, points: e.points })) }]);
  return ev;
}
function tick(db) { // expiry + regen (cheap; call before any event action)
  const ev = _ev(db); if (!ev) return null;
  if (Date.now() >= ev.endsAt) { end(db, 'time'); return null; }
  const now = Date.now();
  for (const m of ev.monsters) {
    if (m.defeated || m.hp >= m.maxHp || !m.lastHit) continue;
    const idle = now - m.lastHit; if (idle < REGEN_IDLE_MS) continue;
    const steps = Math.floor(idle / REGEN_IDLE_MS); const regenAt = m.lastHit + steps * REGEN_IDLE_MS;
    if ((m._regenAt || 0) >= regenAt) continue;
    const done = Math.floor(((m._regenAt || m.lastHit) - m.lastHit) / REGEN_IDLE_MS); const fresh = steps - done;
    if (fresh > 0) m.hp = Math.min(m.maxHp, m.hp + Math.floor(m.maxHp * REGEN_PCT * fresh));
    m._regenAt = regenAt;
  }
  return ev;
}
function alive(ev) { return ev.monsters.filter(m => !m.defeated); }
function _nextWave(db, ev) {
  ev.wavesCleared++; ev.wave++; ev.monsters = buildWave(db, ev.wave);
  return `🌊 *WAVE ${ev.wavesCleared} CLEARED!* The island shakes — *Wave ${ev.wave}* crawls out of the ground: ${WAVE_SIZE} beasts and a boss, stronger than the last.`;
}
function _isDead(st) { return st.diedAt && Date.now() - st.diedAt < RESPAWN_MS; }
function _respawnIn(st) { const ms = RESPAWN_MS - (Date.now() - st.diedAt); return `${Math.ceil(ms / 60000)} min`; }
function _domainMult(player, kind) { const d = player.eventDomain; if (!d || !d.activeUntil || d.activeUntil < Date.now()) return 1; return kind === 'atk' ? 1.25 : 1; }
function _monDebuff(ev, m) { return (m.domDebuffUntil && m.domDebuffUntil > Date.now()) ? 0.8 : 1; }
function _hunterDebuff(p) { return (p.eventStats && p.eventStats.debuffUntil && p.eventStats.debuffUntil > Date.now()) ? 0.8 : 1; }

// ── actions ───────────────────────────────────────────────────
function _guard(db, player) {
  const ev = tick(db); if (!ev) return { error: 'No event is running right now.' };
  if ((player.level || 0) < DOMAIN_LEVEL) return { error: `The Jeju Island Raid is open to hunters *Lv.${DOMAIN_LEVEL}+*.` };
  const st = _p(db, player);
  if (st.afk) return { error: '🛌 You are AFK — /eventafk to rejoin the fight.' };
  if (_isDead(st)) return { error: `💀 You are down. Respawn in *${_respawnIn(st)}*.` };
  if ((player.stats && player.stats.hp || 0) <= 0) { st.diedAt = st.diedAt || Date.now() - RESPAWN_MS; player.stats.hp = Math.max(1, player.stats.hp); }
  return { ev, st };
}
function attackMonster(db, player, targetId) {
  const g = _guard(db, player); if (g.error) return { ok: false, error: g.error }; const { ev, st } = g;
  let m = targetId ? ev.monsters.find(x => x.id === Number(targetId)) : null;
  if (targetId && !m) return { ok: false, error: `No beast #${targetId} on this wave.` };
  if (m && m.defeated) return { ok: false, error: `*${m.name}* is already dead.` };
  if (!m) { const live = alive(ev).filter(x => !x.isBoss); m = live.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0] || alive(ev)[0]; }
  if (!m) return { ok: false, error: 'Nothing left alive on this wave.' };
  if (m.isBoss && alive(ev).length > 1) return { ok: false, error: `👑 *${m.name}* only comes out when the ${alive(ev).length - 1} remaining beasts are dead.` };
  const h = _hunterStats(player); const lines = [];
  const crit = Math.random() * 100 < h.crit + 5; const dmg = _dmg(h.atk * _domainMult(player, 'atk'), m.def * _monDebuff(ev, m), crit ? 1.6 : 1);
  m.hp = Math.max(0, m.hp - dmg); m.lastHit = Date.now(); m._regenAt = 0; st.dmg += dmg;
  lines.push(`⚔️ *${_name(player)}* hits *${m.name}* #${m.id} for *${dmg.toLocaleString()}*${crit ? ' 💥CRIT' : ''} — ${m.hp.toLocaleString()}/${m.maxHp.toLocaleString()} HP`);
  if (m.hp <= 0) {
    m.defeated = true; m.by = player.jid || player.id; const pts = m.isBoss ? BOSS_POINTS : (KILL_POINTS[m.rank] || 10);
    st.points += pts; st.kills++; if (m.isBoss) st.bossKills++;
    lines.push(`☠️ *${m.name}* falls! +${pts} points (${st.points} total)`);
    if (!alive(ev).length) lines.push(_nextWave(db, ev));
    else if (alive(ev).length === 1 && alive(ev)[0].isBoss) lines.push(`👑 *The wave boss emerges:* ${alive(ev)[0].name} — ${alive(ev)[0].maxHp.toLocaleString()} HP.`);
  } else {
    // counter-strike: beasts never start a fight, but they answer one.
    const mc = (10 + (m.critBonus || 0) + (m.isBoss ? 8 : 0)) > Math.random() * 100;
    const back = _dmg(m.atk * _monDebuff(ev, m) * (m.isBoss ? 1.3 : 1), h.def, mc ? 1.5 : 1);
    player.stats.hp = Math.max(0, (player.stats.hp || 0) - back);
    lines.push(`🩸 *${m.name}* counters for *${back.toLocaleString()}*${mc ? ' 💥' : ''} — you: ${player.stats.hp}/${h.maxHp} HP`);
    if (player.stats.hp <= 0) { st.deaths++; st.diedAt = Date.now(); player.stats.hp = 0; lines.push(`💀 *You were slain by ${m.name}!* Respawn in 60 min.`); }
  }
  return { ok: true, text: lines.join('\n'), monster: m };
}
function attackHunter(db, player, victim) {
  const g = _guard(db, player); if (g.error) return { ok: false, error: g.error }; const { ev, st } = g;
  if (!victim || victim === player) return { ok: false, error: 'Tag a hunter to strike.' };
  if ((victim.level || 0) < DOMAIN_LEVEL) return { ok: false, error: `${_name(victim)} is not part of the raid (Lv.${DOMAIN_LEVEL}+ only).` };
  const vs = _p(db, victim);
  if (vs.afk) return { ok: false, error: `🛌 *${_name(victim)}* is AFK — untouchable.` };
  if (_isDead(vs) || (victim.stats && victim.stats.hp <= 0)) return { ok: false, error: `*${_name(victim)}* is already down.` };
  const h = _hunterStats(player), v = _hunterStats(victim); const lines = [];
  const crit = Math.random() * 100 < h.crit; const dmg = _dmg(h.atk * _domainMult(player, 'atk') * _hunterDebuff(player), v.def * _hunterDebuff(victim), crit ? 1.6 : 1);
  victim.stats.hp = Math.max(0, (victim.stats.hp || 0) - dmg); st.dmg += dmg;
  lines.push(`🗡️ *${_name(player)}* strikes *${_name(victim)}* for *${dmg.toLocaleString()}*${crit ? ' 💥CRIT' : ''} — ${victim.stats.hp}/${v.maxHp} HP`);
  if (victim.stats.hp <= 0) {
    const stolen = Math.floor((vs.points || 0) * STEAL_PCT);
    st.points += stolen + HUNTER_KILL_BONUS; st.hunterKills++; vs.points = 0; vs.deaths++; vs.diedAt = Date.now();
    lines.push(`💀 *${_name(victim)} is slain!* ${_name(player)} steals *${stolen} points* (+${HUNTER_KILL_BONUS} bounty). ${_name(victim)}'s points reset to *0* — respawn in 60 min.`);
  } else {
    const vc = Math.random() * 100 < v.crit; const back = _dmg(v.atk * 0.6 * _hunterDebuff(victim), h.def, vc ? 1.6 : 1);
    player.stats.hp = Math.max(0, (player.stats.hp || 0) - back);
    lines.push(`↩️ *${_name(victim)}* answers for *${back.toLocaleString()}* — you: ${player.stats.hp}/${h.maxHp} HP`);
    if (player.stats.hp <= 0) { const stolen = Math.floor((st.points || 0) * STEAL_PCT); vs.points += stolen + HUNTER_KILL_BONUS; vs.hunterKills++; st.points = 0; st.deaths++; st.diedAt = Date.now(); lines.push(`💀 *The counter kills you!* ${_name(victim)} takes *${stolen} points*; yours reset to 0 — respawn in 60 min.`); }
  }
  return { ok: true, text: lines.join('\n') };
}
function toggleAfk(db, player) {
  const ev = tick(db); if (!ev) return { ok: false, error: 'No event is running right now.' };
  const st = _p(db, player); st.afk = !st.afk;
  return { ok: true, afk: st.afk, text: st.afk ? `🛌 *${_name(player)} is now AFK* — no hunter or beast can target you, and you cannot attack. /eventafk again to return.` : `⚔️ *${_name(player)} is back on the island!* You can be targeted again.` };
}

// ── event domain (Lv.10, event GC only) ───────────────────────
function domainState(player) { if (!player.eventDomain) player.eventDomain = { name: null, desc: null, casts: 0, lastCast: 0, activeUntil: 0 }; return player.eventDomain; }
function setDomainName(player, name) { const n = String(name || '').trim().slice(0, 40); if (n.length < 3) return { ok: false, error: 'Name must be 3–40 characters.' }; domainState(player).name = n; return { ok: true, text: `🌌 Event domain named *${n}*.` }; }
function setDomainDesc(player, desc) { const d = String(desc || '').trim().slice(0, 220); if (d.length < 5) return { ok: false, error: 'Description must be 5–220 characters.' }; domainState(player).desc = d; return { ok: true, text: `📜 Event domain description saved.` }; }
function castDomain(db, player, chatId) {
  if (!isEventGC(db, chatId)) return { ok: false, error: 'Your event domain only answers inside the Events GC.' };
  const g = _guard(db, player); if (g.error) return { ok: false, error: g.error }; const { ev, st } = g;
  const d = domainState(player);
  if (!d.name) return { ok: false, error: 'Your event domain has no name yet — */event domain name <name>* then */event domain desc <description>*.' };
  if (!d.desc) return { ok: false, error: 'Give your event domain a description first — */event domain desc <description>*.' };
  if (Date.now() - (d.lastCast || 0) < DOMAIN_COOLDOWN_MS) return { ok: false, error: `Your domain is still recovering — ${Math.ceil((DOMAIN_COOLDOWN_MS - (Date.now() - d.lastCast)) / 60000)} min left.` };
  const energy = player.stats.energy || 0; if (energy < DOMAIN_ENERGY) return { ok: false, error: `Domain Expansion costs *${DOMAIN_ENERGY} ${player.energyType || 'energy'}* — you have ${energy}.` };
  player.stats.energy = energy - DOMAIN_ENERGY; d.lastCast = Date.now(); d.activeUntil = Date.now() + DOMAIN_EFFECT_MS; d.casts++;
  const h = _hunterStats(player); let hit = 0, total = 0; const until = Date.now() + DOMAIN_EFFECT_MS;
  for (const m of alive(ev)) { const burst = Math.floor(Math.min(m.maxHp * 0.12, h.atk * 3)); m.hp = Math.max(1, m.hp - burst); m.lastHit = Date.now(); m._regenAt = 0; m.domDebuffUntil = until; hit++; total += burst; }
  let hunters = 0; const me = player.jid || player.id;
  for (const u of Object.values(db.users || {})) { if (!u || u === player || (u.jid || u.id) === me || (u.level || 0) < DOMAIN_LEVEL) continue; const us = u.eventStats; if (!us || us.id !== ev.id || us.afk || _isDead(us)) continue; us.debuffUntil = until; hunters++; }
  st.dmg += total;
  const msgs = [`🌌 *DOMAIN EXPANSION — ${d.name.toUpperCase()}*`, `_${d.desc}_`,
    `👤 ${_name(player)} · Event Domain Lv.${DOMAIN_LEVEL}\n💥 ${hit} beasts take *${total.toLocaleString()}* total damage and lose 20% ATK/DEF for 10 min.\n🗡️ ${hunters} rival hunter${hunters === 1 ? '' : 's'} weakened 20% for 10 min.\n⚡ You deal +25% damage for 10 min. 🛡️ Inside your domain you are immune to new status effects.`];
  return { ok: true, messages: msgs };
}

// ── info ──────────────────────────────────────────────────────
function leaderboard(db, n = 10) {
  const ev = db.event; if (!ev) return [];
  return Object.values(db.users || {}).filter(u => u && u.eventStats && u.eventStats.id === ev.id && (u.eventStats.points > 0 || u.eventStats.kills > 0)).map(u => ({ name: _name(u), points: u.eventStats.points || 0, kills: u.eventStats.kills || 0, hunterKills: u.eventStats.hunterKills || 0 })).sort((a, b) => b.points - a.points).slice(0, n);
}
function status(db) {
  const ev = tick(db); if (!ev) return '🏝️ *JEJU ISLAND RAID* — not running. An owner can */event start* in the Events GC.';
  const live = alive(ev); const boss = ev.monsters.find(m => m.isBoss); const left = Math.max(0, Math.ceil((ev.endsAt - Date.now()) / DAY));
  const low = live.filter(m => !m.isBoss).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp).slice(0, 5).map(m => `  #${m.id} ${m.typeLabel ? m.typeLabel.split(' ')[0] : '👹'} ${m.name} [${m.rank}] ${m.hp.toLocaleString()}/${m.maxHp.toLocaleString()}`).join('\n');
  return [`🏝️ *JEJU ISLAND RAID* — Wave *${ev.wave}* · ${left} day${left === 1 ? '' : 's'} left`, `👹 Beasts alive: *${live.filter(m => !m.isBoss).length}/${WAVE_SIZE}* · 👑 Boss: ${boss ? (boss.defeated ? 'slain' : `${boss.hp.toLocaleString()}/${boss.maxHp.toLocaleString()} HP`) : '—'}`, `🌊 Waves cleared: ${ev.wavesCleared}`, low ? `\n🎯 *Weakest targets:*\n${low}` : '', `\n/event attack [#] · /event hit @hunter · /event domain · /eventafk · /epoints · /eshop`].filter(Boolean).join('\n');
}
function pointsText(db, player) { const ev = db.event; if (!ev) return 'No event running.'; const st = _p(db, player); return `🏝️ *${_name(player)}* — *${st.points.toLocaleString()} event points*${st.afk ? ' · 🛌 AFK' : ''}${_isDead(st) ? ` · 💀 respawn in ${_respawnIn(st)}` : ''}`; }
function statsText(db, player) { const ev = db.event; if (!ev) return 'No event running.'; const st = _p(db, player); const d = player.eventDomain || {}; return [`📊 *JEJU RAID — ${_name(player)}*`, `🏅 Points: ${st.points.toLocaleString()}`, `☠️ Beast kills: ${st.kills} (👑 ${st.bossKills} bosses)`, `🗡️ Hunter kills: ${st.hunterKills}`, `💀 Deaths: ${st.deaths}`, `💥 Damage dealt: ${st.dmg.toLocaleString()}`, `🛒 Points spent: ${st.spent || 0}`, `🌌 Event domain: ${d.name ? `${d.name} (${d.casts || 0} casts)` : 'unnamed — /event domain name <name>'}`, `${st.afk ? '🛌 AFK' : '⚔️ Active'}${_isDead(st) ? ` · respawn in ${_respawnIn(st)}` : ''}`].join('\n'); }
function shopText(db, player) {
  const st = db.event ? _p(db, player) : { points: 0 }; const out = [`🛒 *EVENT SHOP* — you have *${st.points.toLocaleString()}* points`];
  let cat = null; SHOP.forEach((it, i) => { if (it.cat !== cat) { cat = it.cat; out.push(`\n*${cat}*`); } out.push(`${i + 1}. ${it.name} — *${it.cost.toLocaleString()}* pts  (/eshop buy ${it.key})`); });
  out.push(`\n_Armoury pieces land in your bag (/equip). Points stay spendable until the event ends._`); return out.join('\n');
}
function buy(db, player, key) {
  if (!db.event) return { ok: false, error: 'No event running.' }; const st = _p(db, player);
  const it = SHOP.find(s => s.key === String(key || '').toLowerCase()) || SHOP[Number(key) - 1]; if (!it) return { ok: false, error: 'Unknown item — /eshop' };
  if (st.points < it.cost) return { ok: false, error: `You need *${it.cost}* points for ${it.name} (you have ${st.points}).` };
  const got = it.give(player);
  if (it.cat === 'Armoury' && !got) return { ok: false, error: 'The armoury is locked right now — try again shortly.' };
  st.points -= it.cost; st.spent = (st.spent || 0) + it.cost;
  return { ok: true, text: `✅ Bought ${it.name} for *${it.cost.toLocaleString()}* points — ${st.points.toLocaleString()} left.${got && got.name ? `\n${got.emoji || '🎁'} *${got.name}* is in your bag — /equip` : ''}` };
}

function _fmtLeft(ms) { ms = Math.max(0, ms); const d = Math.floor(ms / DAY), h = Math.floor((ms % DAY) / 3600000), m = Math.floor((ms % 3600000) / 60000); return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`; }
function infoText(db) {
  const ev = tick(db) || db.event; if (!ev) return '🏝️ *JEJU ISLAND RAID* — no event yet. An owner can */event start* in the Events GC.';
  const live = alive(ev); const boss = ev.monsters.find(m => m.isBoss); const byRank = {}; for (const m of live) if (!m.isBoss) byRank[m.rank] = (byRank[m.rank] || 0) + 1;
  const parts = Object.values(db.users || {}).filter(u => u && u.eventStats && u.eventStats.id === ev.id); const now = Date.now();
  const active = parts.filter(u => !u.eventStats.afk && !_isDead(u.eventStats)).length, afk = parts.filter(u => u.eventStats.afk).length, dead = parts.filter(u => _isDead(u.eventStats)).length;
  const tot = parts.reduce((a, u) => ({ k: a.k + (u.eventStats.kills || 0), hk: a.hk + (u.eventStats.hunterKills || 0), d: a.d + (u.eventStats.deaths || 0), dmg: a.dmg + (u.eventStats.dmg || 0), pts: a.pts + (u.eventStats.points || 0) }), { k: 0, hk: 0, d: 0, dmg: 0, pts: 0 });
  const killed = ev.monsters.filter(m => m.defeated).length; const prog = Math.round(killed / ev.monsters.length * 100); const bar = '█'.repeat(Math.round(prog / 10)) + '░'.repeat(10 - Math.round(prog / 10));
  const lb = leaderboard(db, 10);
  return [`🏝️ *JEJU ISLAND RAID — FULL BRIEFING*`, ev.active ? `⏳ ${_fmtLeft(ev.endsAt - now)} left · started ${new Date(ev.startedAt).toUTCString().slice(5, 16)}` : `🏁 Ended (${ev.endReason || 'ended'})`,
    ``, `🌊 *PROGRESSION*`, `Wave *${ev.wave}* · waves cleared: ${ev.wavesCleared} · next wave is 22% stronger`, `${bar} ${prog}% of this wave (${killed}/${ev.monsters.length})`,
    `👹 Alive by rank: ${RANKS.map(r => byRank[r] ? `${r}:${byRank[r]}` : null).filter(Boolean).join(' · ') || 'none'}`, `👑 Boss: ${boss ? `${boss.name} — ${boss.defeated ? 'slain' : `${boss.hp.toLocaleString()}/${boss.maxHp.toLocaleString()} HP${live.length > 1 ? ' (locked until the beasts fall)' : ' — OUT NOW'}`}` : '—'}`,
    ``, `👥 *PARTICIPANTS* — ${parts.length} hunters`, `⚔️ active ${active} · 🛌 AFK ${afk} · 💀 respawning ${dead}`, `☠️ beast kills ${tot.k.toLocaleString()} · 🗡️ hunter kills ${tot.hk} · deaths ${tot.d} · 💥 damage ${tot.dmg.toLocaleString()} · 🏅 points held ${tot.pts.toLocaleString()}`,
    ``, `🏆 *TOP 10*`, ...(lb.length ? lb.map((e, i) => `${['🥇', '🥈', '🥉'][i] || `${i + 1}.`} ${e.name} — ${e.points.toLocaleString()} pts · ${e.kills}☠️ ${e.hunterKills}🗡️`) : ['_Nobody has scored yet._']),
    ``, `📜 *RULES*`, `• Lv.${DOMAIN_LEVEL}+ · 10 days · ${WAVE_SIZE} beasts + 1 boss per wave`, `• Beasts never start a fight — they counter; idle 30s → +5% HP per 30s`, `• Friendly fire ON: kill a hunter → 50% of their points, theirs reset to 0`, `• Death = 1h respawn · /eventafk = untouchable but no attacking`, `• Lv.10 event domain: /event domain (name + desc first) · ${DOMAIN_ENERGY} energy · 1h cooldown`, `• Points: E${KILL_POINTS.E} D${KILL_POINTS.D} C${KILL_POINTS.C} B${KILL_POINTS.B} A${KILL_POINTS.A} S${KILL_POINTS.S} · boss ${BOSS_POINTS} · hunter kill +${HUNTER_KILL_BONUS} · spend in /eshop`].join('\n');
}

module.exports = { infoText, EVENT_LENGTH_MS, WAVE_SIZE, RESPAWN_MS, REGEN_IDLE_MS, REGEN_PCT, STEAL_PCT, DOMAIN_LEVEL, DOMAIN_ENERGY, SHOP, KILL_POINTS, BOSS_POINTS, gcId, isEventGC, buildWave, start, end, tick, alive, attackMonster, attackHunter, toggleAfk, domainState, setDomainName, setDomainDesc, castDomain, leaderboard, status, pointsText, statsText, shopText, buy, _p };
