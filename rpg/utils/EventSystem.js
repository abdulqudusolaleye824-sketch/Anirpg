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
const DOMAIN_EFFECT_MS = 20 * 60 * 1000; // Push #96h-z3: a domain stands 20 min or until its turns run out
const RANKS = ['E', 'D', 'C', 'B', 'A', 'S'];
const KILL_POINTS = { E: 10, D: 10, C: 10, B: 10, A: 10, S: 10 }; // Push #96h-y: 10 per beast
const BOSS_POINTS = 100; // Push #96h-y: 100 per wave boss
const PRO_RESPAWN_MS = 30 * 60 * 1000; // Push #96h-y: Pro hunters respawn in 30 min
const BEAST_MULT = { hp: 1.6, atk: 1.5, def: 1.3 }; // Push #96h-y: beasts hit and last noticeably harder
const HUNTER_KILL_BONUS = 25;
// Push #96h-z: EVENT LEVELS — everyone lands at Event Lv.1 with E-Rank beast stats (separate from the real
// level; real HP/gear/titles are NOT used on the island). Kills give event EXP (Pro ×2); levels raise stats;
// event artifacts add on top. Real class skills, Monster-variant skills, attack patterns and the real domain stay.
const EVENT_BASE = { hp: 1300, atk: 110, def: 45, speed: 60, crit: 5 }; // hunter Lv.1 pool
const BEAST_ANCHOR = { atk: 90, hp: 900, def: 35, speed: 60 }; // beasts are built from this (× BEAST_MULT) so an E-beast ≈ an Event Lv.1 hunter
const ELVL_STEP = 0.035, ELVL_MAX = 60; // Lv.11 ≈ D-Rank beast, Lv.21 ≈ C … Lv.51 ≈ S
const EXP_KILL = { E: 20, D: 30, C: 45, B: 65, A: 90, S: 120 }, EXP_BOSS = 300, EXP_HUNTER = 60;
const ARTIFACT_DROP = 0.15, ARTIFACT_SLOTS = 6, ARTIFACT_SPAWN_MS = Math.floor(24 * 60 * 60 * 1000 / 5); // 5 island spawns per day
const AFK_LOCK_MS = 10 * 60 * 1000;
const TF_COOLDOWN_MS = 60 * 60 * 1000; // Push #96h-z7: Monster transformation (cast or innate rampage) once per hour on the island — 30 min for Pro
const MON_FX_TICK_MS = 20 * 1000; // beast statuses count down once per 20 s, not once per hit (many hunters hit the same beast) // once you are in (join / back from AFK) you fight for 10 min before /eventafk
const HUNTER_REGEN_IDLE_MS = 60 * 1000, HUNTER_REGEN_PCT = 0.05; // idle hunters heal 5% per minute
function _elvlMult(L) { return 1 + (Math.max(1, L) - 1) * ELVL_STEP; }
function _erank(L) { return RANKS[Math.min(5, Math.floor((Math.max(1, L) - 1) / 10))]; }
function expNeed(L) { return Math.floor(100 * Math.pow(1.12, Math.max(1, L) - 1)); }
function _artBonus(st) { const a = { hp: 0, atk: 0, def: 0, speed: 0, crit: 0 }; for (const x of (st.artifacts || [])) for (const k in a) a[k] += Number(x[k]) || 0; return a; }
function _tfMult(st) { const t = st && st.transform; if (!t || !((t.turnsLeft || 0) > 0) || Date.now() - (t.startedAt || 0) > 2 * 60 * 60 * 1000) return 1; return Number(t.mult) || 1; } // Push #96h-z5: Monster-class transformations multiply ISLAND stats
function eventStats(db, player) { const st = _p(db, player); const L = st.elvl || 1, m = _elvlMult(L), a = _artBonus(st), tf = _tfMult(st); return { level: L, rank: _erank(L), atk: Math.floor((Math.floor(EVENT_BASE.atk * m) + a.atk) * tf), def: Math.floor((Math.floor(EVENT_BASE.def * m) + a.def) * tf), speed: Math.floor((Math.floor(EVENT_BASE.speed * m) + a.speed) * tf), crit: EVENT_BASE.crit + a.crit, maxHp: Math.floor((Math.floor(EVENT_BASE.hp * m) + a.hp) * tf), exp: st.exp || 0, need: expNeed(L), transform: tf > 1 ? st.transform : null }; }
// event HP pool lives in eventStats.hp — never the real HP.
function _sync(st, es) {
  const now = Date.now();
  if (st.hp == null || st.hp > es.maxHp) st.hp = es.maxHp;
  if (st.hp <= 0) { if (!_isDead(st)) { st.hp = es.maxHp; st.regenMark = now; } return st; }
  const mark = st.regenMark || st.lastAct || st.joinedAt || now; const steps = Math.floor((now - mark) / HUNTER_REGEN_IDLE_MS);
  if (steps > 0 && st.hp < es.maxHp) { st.hp = Math.min(es.maxHp, st.hp + Math.floor(es.maxHp * HUNTER_REGEN_PCT * steps)); st.regenMark = mark + steps * HUNTER_REGEN_IDLE_MS; }
  return st;
}
function _avatar(db, player) {
  const st = _p(db, player); const es = eventStats(db, player); _sync(st, es);
  for (const k of ['skillCooldowns', 'attackCooldowns']) if (!player[k]) player[k] = {};
  // Push #96h-z3: the island has its OWN statuses and buffs (normal-world artifacts, auras, buffs and
  // statuses stay outside). Only energy is shared with the normal world.
  if (!st.statusEffects) st.statusEffects = []; if (!st.tempBuffs) st.tempBuffs = {};
  const av = Object.assign({}, player, { stats: { ...(player.stats || {}), hp: st.hp, maxHp: es.maxHp, atk: es.atk, def: es.def, speed: es.speed, critChance: es.crit }, elvl: es.level, equippedGear: {}, equippedTitle: null, weapon: null, artifacts: { equipped: [], inventory: [], enhanced: {} }, aura: null, auras: null, statusEffects: st.statusEffects, tempBuffs: st.tempBuffs, transform: st.transform || null, _eventAvatar: true, _real: player, _st: st });
  return av;
}
function _commit(av) { const p = av._real, st = av._st; if (!p || !st) return; st.transform = av.transform || null; st.hp = Math.max(0, Math.floor(av.stats.hp || 0)); if (p.stats) { p.stats.energy = av.stats.energy; if (av.stats.mana != null) p.stats.mana = av.stats.mana; } st.lastAct = Date.now(); st.regenMark = Date.now(); }
function _gainExp(db, player, st, amount, lines) {
  amount = Math.floor(amount * (st._pro ? 2 : 1)); st.exp = (st.exp || 0) + amount; let ups = 0; const before = eventStats(db, player).maxHp;
  while ((st.elvl || 1) < ELVL_MAX && st.exp >= expNeed(st.elvl || 1)) { st.exp -= expNeed(st.elvl || 1); st.elvl = (st.elvl || 1) + 1; ups++; }
  const es = eventStats(db, player);
  if (ups) st.hp = Math.min(es.maxHp, (st.hp || 0) + (es.maxHp - before));
  lines.push(`✨ +${amount} event EXP${st._pro ? ' (Pro ×2)' : ''} — ${st.exp}/${es.need} to Lv.${es.level + 1}`);
  if (ups) lines.push(`⬆️ *${_name(player)} → Event Lv.${es.level}* (${es.rank}-Rank) — ❤️ ${es.maxHp} ⚔️ ${es.atk} 🛡️ ${es.def} ⚡ ${es.speed}`);
}
const ARTIFACT_NAMES = [["Beru's Mandible", 'atk'], ["Ant Queen's Carapace", 'def'], ['Jeju Heartstone', 'hp'], ['Mutant Wing', 'speed'], ['Hive Eye', 'crit'], ['Titan Chitin', 'def'], ['Soldier Stinger', 'atk']];
function _artDesc(a) { return ['atk', 'def', 'hp', 'speed', 'crit'].filter(k => a[k]).map(k => `+${a[k]} ${({ atk: 'ATK', def: 'DEF', hp: 'HP', speed: 'SPD', crit: '% CRIT' })[k]}`).join(' '); }
function _artVal(a) { return (a.atk || 0) * 10 + (a.def || 0) * 10 + (a.hp || 0) + (a.speed || 0) * 10 + (a.crit || 0) * 40; }
function _rollArtifact(ev, boss) {
  const [name, stat] = ARTIFACT_NAMES[Math.floor(Math.random() * ARTIFACT_NAMES.length)]; const w = 1 + ((ev && ev.wave || 1) - 1) * 0.15;
  const base = { atk: EVENT_BASE.atk * 0.08, def: EVENT_BASE.def * 0.08, hp: EVENT_BASE.hp * 0.08, speed: EVENT_BASE.speed * 0.08, crit: 2 };
  const v = Math.max(1, Math.round(base[stat] * w * (boss ? 2 : 1) * (0.8 + Math.random() * 0.4)));
  return { name: `${name}${boss ? ' ✦' : ''}`, [stat]: v, tier: boss ? 'boss' : 'beast', wave: ev && ev.wave || 1, at: Date.now() };
}
function _giveArtifact(st, art, lines, who) {
  st.artifacts = st.artifacts || [];
  if (art.hp && st.hp > 0) st.hp = (st.hp || 0) + art.hp; // an HP artifact grows the pool AND fills it
  if (st.artifacts.length < ARTIFACT_SLOTS) { st.artifacts.push(art); lines.push(`🔮 *${who} finds ${art.name}!* ${_artDesc(art)} (${st.artifacts.length}/${ARTIFACT_SLOTS} slots)`); return true; }
  let wi = 0; for (let i = 1; i < st.artifacts.length; i++) if (_artVal(st.artifacts[i]) < _artVal(st.artifacts[wi])) wi = i;
  if (_artVal(art) > _artVal(st.artifacts[wi])) { const old = st.artifacts[wi]; st.artifacts[wi] = art; lines.push(`🔮 *${who} finds ${art.name}!* ${_artDesc(art)} — replaces ${old.name}.`); return true; }
  lines.push(`🔮 ${art.name} (${_artDesc(art)}) dropped, but all ${ARTIFACT_SLOTS} slots hold better — left behind.`); return false;
}

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
function _p(db, player) { if (!player.eventStats) player.eventStats = {}; const id = _ev(db) ? _ev(db).id : (db.event ? db.event.id : 'none'); if (player.eventStats.id !== id) player.eventStats = { id, points: 0, kills: 0, bossKills: 0, hunterKills: 0, deaths: 0, dmg: 0, diedAt: 0, afk: false, spent: 0, joined: false, joinedAt: 0, dmgTaken: 0, skillsUsed: 0, crits: 0, domainCasts: 0, elvl: 1, exp: 0, hp: null, transform: null, artifacts: [], activeSince: 0, lastAct: 0, regenMark: 0 }; try { player.eventStats._pro = !!require('./UI').isPro(player); } catch (e) {} return player.eventStats; }
function isJoined(db, player) { const ev = _ev(db); return !!(ev && player && player.eventStats && player.eventStats.id === ev.id && player.eventStats.joined); }
function _tag(p) { const id = String(_pid(p) || ''); const d = id.split('@')[0].split(':')[0]; return /^\d{5,}$/.test(d) ? `@${d}` : ''; }
// Push #96h-z: every name carries the hunter's tag so everyone knows who is who.
function _name(p) { const n = p.name || p.username || 'Hunter'; const t = _tag(p); return t ? `${n} ${t}` : n; }
function _realStats(p) { return _hunterStats(p); }
function _hunterStats(p) {
  const s = p.stats || {}; let g = { atk: 0, def: 0, hp: 0, speed: 0, crit: 0 };
  try { g = require('./GearSystem').getEquippedBonuses(p) || g; } catch (e) {}
  let tb = {}; try { tb = require('./TitleSystem').getEquippedBoost(p) || {}; } catch (e) {}
  let pet = { atk: 0, def: 0, spd: 0 }; try { const PC = require('./PetCombat'); const id = p.jid || p.id; pet = { atk: PC.atkBonus(id), def: PC.defBonus(id), spd: PC.spdBonus(id) }; } catch (e) {}
  let maxHp = (s.maxHp || 100) + (g.hp || 0) + (tb.hp || 0); try { maxHp = require('./GearSystem').effectiveMaxHp(p) || maxHp; } catch (e) {}
  const wAtk = (p.weapon && (p.weapon.attack || p.weapon.bonus)) || 0;
  // Push #96h-g: base + gear + title + weapon + pet — the same pool the raid engine reads.
  return { atk: (s.atk || 10) + (g.atk || 0) + (tb.atk || 0) + wAtk + pet.atk, def: (s.def || 0) + (g.def || 0) + (tb.def || 0) + pet.def, speed: (s.speed || 50) + (g.speed || 0) + (tb.speed || 0) + pet.spd, crit: (s.critChance || 5) + (g.crit || 0) + (tb.crit || 0), maxHp };
}
// ── Push #96h-z3: statuses really land on the island ──────────
function _mWrap(m) { if (!m.statusEffects) m.statusEffects = []; if (!m.tempBuffs) m.tempBuffs = {}; return { name: m.name, stats: m, statusEffects: m.statusEffects, tempBuffs: m.tempBuffs, isBoss: !!m.isBoss, rank: m.rank }; }
function _tickEntity(wrap, lines) { try { const UC = require('./UnifiedCombat'); const logs = UC.tickStatuses(wrap) || []; for (const l of logs) if (l) lines.push(typeof l === 'string' ? l : (l.text || String(l))); } catch (e) {} }
function _applyStatuses(res, attacker, defender, lines, extra = []) {
  const out = []; if (!res || res.missed) return out;
  { const dr = defender && (defender._real || defender); const dd = dr && dr.eventDomain ? domainActive(dr) : null; if (dd) { lines.push(`🌌 *${defender.name}* stands inside *${dd.name}* — no new status can take hold.`); return out; } }
  let UC; try { UC = require('./UnifiedCombat'); } catch (e) { return out; }
  const list = []; const sk = res.skillUsed;
  if (sk && sk.effect && typeof sk.effect === 'object' && sk.effect.type) list.push(sk.effect);
  for (const st of (res.statuses || [])) if (st && st.type) list.push({ type: st.type, chance: st.chance != null ? st.chance : 50, duration: st.duration || 2 });
  for (const st of extra) if (st && st.type) list.push(st);
  for (const fx of list) { try { const got = UC.tryApplyEffect({ id: 'event', effect: { type: fx.type, chance: fx.chance != null ? fx.chance : 50, duration: fx.duration || 2 } }, attacker, defender); if (got) { try { got.by = _pid(attacker._real || attacker); got.byName = _name(attacker); } catch (e) {} out.push(got); lines.push(`✨ *${defender.name}* is ${String(got.type || fx.type).toUpperCase()} (${got.duration || fx.duration || 2}t) — by ${_name(attacker)}!`); } else if (defender._lastStatusBlock) { lines.push(`🛡️ ${defender._lastStatusBlock}.`); defender._lastStatusBlock = null; } } catch (e) {} }
  return out;
}
// ── Push #96h-z3: event domains stand 20 min / N turns, affect every foe the owner meets, and CLASH ──
function domainActive(player) { const d = player && player.eventDomain; if (!d || !d.activeUntil) return null; if (d.activeUntil < Date.now() || (d.turnsLeft != null && d.turnsLeft <= 0)) { d.activeUntil = 0; return null; } return d; }
function _domainTurn(player, lines, P = null) { const d = domainActive(player); if (!d) return;
  if (P && P.stats && P.stats.hp > 0 && P.stats.hp < P.stats.maxHp) { const heal = Math.floor(P.stats.maxHp * 0.10); P.stats.hp = Math.min(P.stats.maxHp, P.stats.hp + heal); lines.push(`💚 *${d.name}* mends ${_name(player)} +${heal} (10%/turn)`); }
  if (d.turnsLeft != null) { d.turnsLeft -= 1; if (d.turnsLeft <= 0) { d.activeUntil = 0; lines.push(`🌫️ *${d.name}* fades — its turns are spent.`); } else lines.push(`🌌 _${d.name}_ — ${d.turnsLeft} turn${d.turnsLeft === 1 ? '' : 's'} left`); } }
function _domainStatuses(player) { try { const DS = require('./DomainSystem'); const e = DS.scaledEffect(player); return (e && e.statuses) || []; } catch (e) { return []; } }
function _refine(player) { let q = 100, pw = 0; try { q = require('./ClassPower').quality(player); } catch (e) {} try { pw = require('./DomainSystem').power(player); } catch (e) {} const d = player.eventDomain || {}; return { q, pw: pw + (d.ownLevel || DOMAIN_LEVEL) * 4 }; }
function domainClash(attacker, victim) {
  const a = domainActive(attacker), v = domainActive(victim); if (!a || !v) return null;
  const ra = _refine(attacker), rv = _refine(victim); const win = ra.q !== rv.q ? ra.q > rv.q : ra.pw > rv.pw;
  const loser = win ? victim : attacker; loser.eventDomain.activeUntil = 0; loser.eventDomain.turnsLeft = 0;
  return { win, text: `🌌 *DOMAIN CLASH!* ${_name(attacker)}'s *${a.name}* meets ${_name(victim)}'s *${v.name}* — the more refined domain wins: *${win ? a.name : v.name}* holds the field; *${win ? v.name : a.name}* shatters.` };
}
// Push #96h-z7: transformation cooldown (cast or innate surge) — 1 h, Pro 30 min.
function _tfCdMs(st) { return st && st._pro ? TF_COOLDOWN_MS / 2 : TF_COOLDOWN_MS; }
function _tfGuard(P, st, lines) {
  if (!P.transform) return; const t = P.transform;
  if (t._evAt) return; // already accounted
  const left = _tfCdMs(st) - (Date.now() - (st.tfAt || 0));
  if (st.tfAt && left > 0) { try { require('./Transformation').end(P, false); } catch (e) { P.transform = null; } lines.push(`🧬 The surge fizzles — ${_name(P)}'s transformation is recovering (${Math.ceil(left / 60000)} min left).`); return; }
  t._evAt = Date.now(); st.tfAt = Date.now();
}
function _mit(def, atk) { return Math.min(0.70, def / Math.max(1, def + atk)); }
function _dmg(atk, def, mult = 1) { return Math.max(5, Math.floor(atk * (1 - _mit(def, atk)) * mult * (0.9 + Math.random() * 0.2))); }

// ── wave building ─────────────────────────────────────────────
function _party() { return { ...BEAST_ANCHOR }; } // Push #96h-z: beasts are built from the event base, hunters match them per rank
function _partyLegacy(db) {
  const users = Object.values(db.users || {}).filter(u => u && u.stats);
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
    const hp = Math.floor(anchor.atk * 4 * rm * wm * BEAST_MULT.hp);
    const m = { id: i + 1, name: src.name, rank, hp, maxHp: hp, atk: Math.floor(anchor.hp * 0.06 * rm * wm * BEAST_MULT.atk), def: Math.floor(anchor.atk * 0.45 * rm * BEAST_MULT.def), speed: Math.round(anchor.speed * (0.55 + ri * 0.1) * 1.4), lastHit: 0, defeated: false, by: null };
    if (TM) TM.apply(m);
    mons.push(m);
  }
  const bossNames = ['Ant King Beru', 'Queen of the Hive', 'Jeju Titan Ant', 'Mutant Ant Lord'];
  const bhp = Math.floor(anchor.atk * 60 * wm * (1 + waveNo * 0.1) * BEAST_MULT.hp);
  const boss = { id: WAVE_SIZE + 1, name: `${bossNames[(waveNo - 1) % bossNames.length]} (Wave ${waveNo} Boss)`, rank: 'S', isBoss: true, hp: bhp, maxHp: bhp, atk: Math.floor(anchor.hp * 0.22 * wm * BEAST_MULT.atk), def: Math.floor(anchor.atk * 0.9 * BEAST_MULT.def), speed: Math.round(anchor.speed * 1.15 * 1.4), lastHit: 0, defeated: false, by: null, family: 'insect' };
  if (TM) TM.apply(boss);
  boss.artifact = _rollArtifact({ wave: waveNo }, true); // Push #96h-z2: the boss CARRIES its artifact — the killer takes it
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
  ev.active = false; ev.endedAt = Date.now(); ev.endReason = reason; db.eventHistory = (db.eventHistory || []).slice(-5).concat([{ id: ev.id, name: ev.name, startedAt: ev.startedAt, endedAt: ev.endedAt, waves: ev.wavesCleared, top: leaderboard(db, 3).map(e => ({ name: e.name, points: e.points })) }]);
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
  // Push #96h-z: an event artifact surfaces on the island 5× a day — first /event grab (Claim button) takes it.
  if (!ev.artifact && now - (ev.artifactAt || ev.startedAt) >= ARTIFACT_SPAWN_MS) { ev.artifact = _rollArtifact(ev, true); ev.artifactAt = now; ev.artifactNew = true; }
  return ev;
}
function grabArtifact(db, player) {
  const g = _guard(db, player); if (g.error) return { ok: false, error: g.error }; const { ev, st } = g;
  if (!ev.artifact) return { ok: false, error: '🔮 No artifact is lying on the island right now — 5 surface per day (and beasts/bosses drop them).' };
  const art = ev.artifact; ev.artifact = null; ev.artifactAt = Date.now(); ev.artifactNew = false; const lines = g.note ? [g.note] : [];
  _giveArtifact(st, art, lines, _name(player)); const es = eventStats(db, player); lines.push(`📊 Event Lv.${es.level}: ❤️ ${es.maxHp} ⚔️ ${es.atk} 🛡️ ${es.def} ⚡ ${es.speed} 💥 ${es.crit}%`);
  return { ok: true, text: lines.join('\n') };
}
function artifactAlert(db) { const ev = _ev(db); if (!ev || !ev.artifact || !ev.artifactNew) return null; ev.artifactNew = false; return `🔮 *An event artifact surfaces on Jeju Island!* ${ev.artifact.name} (${_artDesc(ev.artifact)}) — first */event grab* takes it.`; }
function alive(ev) { return ev.monsters.filter(m => !m.defeated); }
function _nextWave(db, ev) {
  ev.wavesCleared++; ev.wave++; ev.monsters = buildWave(db, ev.wave);
  return `🌊 *WAVE ${ev.wavesCleared} CLEARED!* The island shakes — *Wave ${ev.wave}* crawls out of the ground: ${WAVE_SIZE} beasts and a boss, stronger than the last.`;
}
function _respawnMs(st) { return st && st._pro ? PRO_RESPAWN_MS : RESPAWN_MS; }
function _isDead(st) { return st.diedAt && Date.now() - st.diedAt < _respawnMs(st); }
function _respawnIn(st) { const ms = _respawnMs(st) - (Date.now() - st.diedAt); return `${Math.ceil(ms / 60000)} min`; }
function _domainMult(player, kind) { return domainActive(player) ? (kind === 'atk' ? 1.25 : 1) : 1; }
function _monDebuff(ev, m, attacker) { return ((m.domDebuffUntil && m.domDebuffUntil > Date.now()) || (attacker && domainActive(attacker))) ? 0.8 : 1; }
function _hunterDebuff(p, attacker) { return ((p.eventStats && p.eventStats.debuffUntil && p.eventStats.debuffUntil > Date.now()) || (attacker && domainActive(attacker))) ? 0.8 : 1; }

// ── auto skill: strongest READY, affordable, damaging class skill ─────────
// Push #96h-y: attack patterns on the island — "#12" / "12" → an owned + equipped pattern.
function _patternOf(player, skillName) {
  const m = String(skillName || '').trim().match(/^#?(\d{1,3})$/); if (!m) return null;
  const pid = parseInt(m[1], 10); if (!(pid >= 1 && pid <= 750)) return null;
  let atk = null; try { atk = require('./AttackPatternDB').generateAttack(pid); } catch (e) { atk = null; }
  if (!atk) return { error: `No attack pattern #${pid}.` };
  const owned = (player.attackPatterns && player.attackPatterns.owned) || []; const eq = (player.attackPatterns && player.attackPatterns.equipped) || [];
  if (!owned.includes(pid)) return { error: `You don't own Attack #${pid}.` };
  if (!eq.includes(pid)) return { error: `Attack #${pid} is not equipped — /attacks equip ${pid}.` };
  return { pid, atk };
}
function _patternStrike(player, targetWrap, pat) {
  const UC = require('./UnifiedCombat'); const cd = UC.isOnCooldown(player, pat.pid);
  if (cd.onCd) return { blocked: true, reason: `*${pat.atk.name}* is on cooldown — ${UC.formatCd(cd.remaining)} left.` };
  const fake = { stats: { hp: targetWrap.hp || 1000, maxHp: targetWrap.maxHp || 1000, atk: targetWrap.atk || 10, def: targetWrap.def || 5, speed: targetWrap.speed || 30 }, statusEffects: targetWrap.statusEffects || [] };
  const uni = UC.calcMoveDamage(player, fake, pat.atk); UC.setCooldown(player, pat.pid, pat.atk);
  return { damage: uni.missed ? 0 : uni.damage, isCrit: !!uni.crit, missed: !!uni.missed, dodged: !!uni.dodged, missWhy: uni.missWhy || null, skillUsed: { name: `#${pat.pid} ${pat.atk.name}`, description: pat.atk.flavour || `${pat.atk.rank}-Rank attack pattern.`, cooldown: Math.round((pat.atk.cooldownMs || 0) / 1000), effect: pat.atk.effect && pat.atk.effect.type ? { type: pat.atk.effect.type, chance: pat.atk.effect.chance, duration: pat.atk.effect.duration } : null }, pattern: true };
}
// Push #96h-y: buffs / heals / shields on the island — any class's support skills through the raid support engine.
function supportSkill(db, player, skillName) {
  const g = _guard(db, player); if (g.error) return { ok: false, error: g.error };
  const P = _avatar(db, player); // Push #96h-z: heals/shields land on the EVENT HP pool
  try { const TF = require('./Transformation'); const SC = require('./SkillCatalog'); const rs = SC.resolveSkill(player, skillName, { allowLibrary: true }); if (rs.ok && TF.isTransformSkill(rs.entry || rs.skill)) { const left = _tfCdMs(g.st) - (Date.now() - (g.st.tfAt || 0)); if (g.st.tfAt && left > 0 && !(P.transform && P.transform._evAt)) return { ok: false, error: `🧬 Your transformation is recovering — *${Math.ceil(left / 60000)} min* left (1 h on the island, 30 min for Pro).` }; } } catch (e) {}
  let r = null; try { const GR = require('../dungeons/GateRaid'); r = GR.supportCast(P, _pid(P), P, _pid(P), skillName, null, db); } catch (e) { r = { ok: false, error: e.message }; }
  if (!r || !r.ok) return { ok: false, error: (r && r.error) || 'That skill cannot be cast here.', notSupport: !!(r && r.notSupport) };
  { const tl = []; _tfGuard(P, g.st, tl); if (tl.length) r.lines = [...(r.lines || []), ...tl]; }
  _commit(P); g.st.skillsUsed++;
  return { ok: true, text: [...(g.note ? [g.note] : []), `✨ *${_name(player)}* casts *${r.skill.name}* on the island`, ...(r.lines || []), `❤️ ${_name(player)}: ${g.st.hp}/${P.stats.maxHp}`].join('\n') };
}
function _autoSkill(player) {
  try {
    const SC = require('./SkillCatalog'); const energy = (player.stats && player.stats.energy) || 0; let best = null, bestDmg = 0;
    for (const e of SC.unlockedSkills(player) || []) {
      if (!e || e.isPassive || (e.type && e.type !== 'damage' && !(e.damagePct > 0))) continue; if (!SC.onCooldown(player, e).ready) continue; if (SC.effectiveCost(e, player) > energy) continue;
      let d = 0; try { d = SC.computeDamage(player, e, { crit: false }) || 0; } catch (x) { d = 0; }
      if (d > bestDmg) { bestDmg = d; best = e; }
    }
    return best ? best.name : null;
  } catch (e) { return null; }
}
// ── /ejoin: enter the island, get your domain, then name + describe it ─────
function join(db, player) {
  const ev = tick(db); if (!ev) return { ok: false, error: 'No event is running right now.' };
  // Push #96h-x: hunters of ALL levels may join (the event domain itself is a Lv.10 domain).
  const st = _p(db, player); if (st.joined) return { ok: false, error: 'You are already on the island — /event status.' };
  st.joined = true; st.joinedAt = Date.now(); st.afk = false; st.activeSince = Date.now(); st.lastAct = Date.now(); st.regenMark = Date.now();
  const pulledIn = pullFromDungeons(db, player); // Push #96h-z8: joining the island pulls you out of any raid / dungeon you were in
  const d = domainState(player); let arch = null;
  try { const DS = require('./DomainSystem'); const cls = (player.class || player.className || 'Hunter'); const idx = Math.abs([...String(player.jid || player.name || '')].reduce((a, c) => a + c.charCodeAt(0), 0)) % 10; const eff = DS.effectFor(cls, idx); d.archetype = eff.arch && eff.arch.key; d.suggested = eff.name; arch = eff.arch; } catch (e) {}
  // Push #96h-t: hunters who ALREADY own a domain keep it — same name, description and level on the island (never below the event's Lv.10).
  try { const rd = player.domain; if (rd && rd.unlocked && rd.name) { d.name = rd.name; d.desc = rd.desc || rd.description || d.desc || `${rd.name} — ${_name(player)}'s own domain, carried onto the island.`; d.ownLevel = Math.max(DOMAIN_LEVEL, Number(rd.level) || 1); d.own = true; } else { d.own = false; d.ownLevel = 0; } } catch (e) {}
  d.setup = d.name ? (d.desc ? null : 'desc') : 'name';
  const archLine = arch ? `Your island domain leans *${arch.key}* — allies ${Object.entries(arch.ally || {}).map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v}%`).join(', ') || '—'}; enemies ${Object.entries(arch.enemy || {}).map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v}%`).join(', ') || '—'}.` : '';
  const _es = eventStats(db, player); _sync(st, _es);
  const msgs = [`🏝️ *${_name(player)} lands on Jeju Island!* Wave ${ev.wave} · ${alive(ev).length} beasts alive.\n🎚️ *Event Lv.${_es.level}* (${_es.rank}-Rank) — ❤️ ${_es.maxHp} ⚔️ ${_es.atk} 🛡️ ${_es.def} ⚡ ${_es.speed} 💥 ${_es.crit}%. Everyone starts here; your real level, HP and gear stay outside. Your class skills, Monster skills, attack patterns and domain come with you. Beast kills give event EXP${st._pro ? ' (Pro ×2)' : ''}; artifacts boost your island stats. You are locked in for *10 min* before /eventafk.`,
    d.own ? `🌌 *Your own domain — ${d.name} (Lv.${d.ownLevel}) — answers on the island.* It keeps its name, description and level here; outside the Events GC nothing changes. On Jeju it also grants:` : `🌌 *Your Lv.${DOMAIN_LEVEL} EVENT DOMAIN awakens.* It works only here: 12% burst on every beast, −20% ATK/DEF on beasts and rival hunters for 10 min, +25% own damage. ${archLine}${d.suggested ? ` (suggested name: *${d.suggested}*)` : ''}`];
  if (d.setup === 'name') msgs.push(`✍️ *Name your domain.* Reply with the name (3–40 characters).`);
  else if (d.setup === 'desc') msgs.push(`✍️ *Describe ${d.name}.* Reply with the description (5–220 characters).`);
  else msgs.push(`Your domain *${d.name}* is ready — */event domain* to expand it. Attack: */event attack*, or tag a hunter in your attack to duel them.`);
  if (pulledIn.length) msgs.push(`🏝️ Pulled out of: ${pulledIn.join(', ')} — the island holds you now. */eventafk* before you raid again.`);
  return { ok: true, messages: msgs };
}
// Plain replies after /ejoin are consumed here (event GC or DM). Returns a reply string or null.
function handleSetupReply(player, text) {
  const d = player && player.eventDomain; if (!d || !d.setup) return null; const t = String(text || '').trim(); if (!t || t.startsWith('/')) return null;
  if (d.setup === 'name') { const r = setDomainName(player, t); if (!r.ok) return `❌ ${r.error}`; d.setup = 'desc'; return `${r.text}\n✍️ Now *describe ${d.name}* — reply with the description.`; }
  if (d.setup === 'desc') { const r = setDomainDesc(player, t); if (!r.ok) return `❌ ${r.error}`; d.setup = null; return `${r.text}\n🌌 *${d.name}* is ready. Expand it in the Events GC with */event domain*. Strike beasts with */event attack*; tag a hunter in it to duel them (20s to retaliate).`; }
  return null;
}
function setupStep(player) { return (player && player.eventDomain && player.eventDomain.setup) || null; }

// ── actions ───────────────────────────────────────────────────
function _guard(db, player) {
  const ev = tick(db); if (!ev) return { error: 'No event is running right now.' };
  const st = _p(db, player);
  if (!st.joined) return { error: '🏝️ You have not joined the raid yet — */ejoin*.' };
  let note = null;
  if (st.afk) { st.afk = false; st.activeSince = Date.now(); const pulled = pullFromDungeons(db, player); note = `⚔️ *${_name(player)} is back on the island!*${pulled.length ? ` Pulled out of: ${pulled.join(', ')}.` : ''} Locked in for 10 min.`; }
  if (_isDead(st)) return { error: `💀 You are down. Respawn in *${_respawnIn(st)}*.` };
  _sync(st, eventStats(db, player));
  return { ev, st, note };
}
function _awardKill(db, ev, m, player, st, lines, how = null) {
  m.defeated = true; m.by = _pid(player); const pts = m.isBoss ? BOSS_POINTS : (KILL_POINTS[m.rank] || 10);
  st.points += pts; st.kills++; if (m.isBoss) st.bossKills++;
  lines.push(`☠️ *${m.name}* falls${how ? ` to ${how}` : ''}! *${_name(player)}* +${pts} points (${st.points} total)`);
  _gainExp(db, player, st, m.isBoss ? EXP_BOSS : (EXP_KILL[m.rank] || 20), lines);
  if (m.isBoss) _giveArtifact(st, m.artifact || _rollArtifact(ev, true), lines, _name(player)); else if (Math.random() < ARTIFACT_DROP) _giveArtifact(st, _rollArtifact(ev, false), lines, _name(player));
}
function attackMonster(db, player, targetId, skillName = null) {
  const g = _guard(db, player); if (g.error) return { ok: false, error: g.error }; const { ev, st } = g;
  let m = targetId ? ev.monsters.find(x => x.id === Number(targetId)) : null;
  if (targetId && !m) return { ok: false, error: `No beast #${targetId} on this wave.` };
  if (m && m.defeated) return { ok: false, error: `*${m.name}* is already dead.` };
  if (!m) { const live = alive(ev).filter(x => !x.isBoss); m = live.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0] || alive(ev)[0]; }
  if (!m) return { ok: false, error: 'Nothing left alive on this wave.' };
  st.lastTarget = m.id;
  if (m.isBoss && alive(ev).length > 1) return { ok: false, error: `👑 *${m.name}* only comes out when the ${alive(ev).length - 1} remaining beasts are dead.` };
  const P = _avatar(db, player); const h = { ...P.stats, crit: P.stats.critChance }; const lines = g.note ? [g.note] : [];
  const MW = _mWrap(m); _tickEntity(P, lines); _tfGuard(P, st, lines);
  if (Date.now() - (m._fxTickAt || 0) >= MON_FX_TICK_MS) { m._fxTickAt = Date.now(); _tickEntity(MW, lines); } // Push #96h-z7: beast statuses last their turns in TIME, not per hit
  if (m.hp <= 0) { // Push #96h-z5: a DOT kill belongs to the hunter who inflicted the effect
    const dots = (m.statusEffects || []).filter(x => x && x.by); const dot = dots[dots.length - 1]; const killer = dot ? (_find(db, dot.by) || player) : player; const ks = _p(db, killer);
    _awardKill(db, ev, m, killer, ks, lines, dot ? `${String(dot.type).toUpperCase()} (inflicted by ${_name(killer)})` : 'its wounds');
    if (!alive(ev).length) lines.push(_nextWave(db, ev)); else if (alive(ev).length === 1 && alive(ev)[0].isBoss) lines.push(`👑 *The wave boss emerges:* ${alive(ev)[0].name} — ${alive(ev)[0].maxHp.toLocaleString()} HP.`);
    _commit(P); return { ok: true, text: lines.join('\n'), tailText: '', flow: null, monster: m }; }
  { const UC = require('./UnifiedCombat'); const ca = UC.canAct(P); if (!ca.canAct) { _domainTurn(player, lines, P); _commit(P); const fx = (P.statusEffects || []).find(e => String(e.type || '').toLowerCase() === { stunned: 'stun', frozen: 'freeze', paralyzed: 'paralyze' }[ca.reason]); return { ok: true, text: [...lines, `😵 *${_name(player)}* is ${ca.reason}${fx && fx.duration ? ` (${fx.duration} more turn${fx.duration === 1 ? '' : 's'})` : ''} and cannot act this turn.${P.stats.hp <= 0 ? '' : ' The beast watches…'}`].join('\n'), tailText: '', flow: null, monster: m }; } }
  if (P.stats.hp <= 0) { st.deaths++; st.diedAt = Date.now(); st.statusEffects = []; st.tempBuffs = {}; st.transform = null; P.transform = null; _commit(P); return { ok: true, text: [...lines, `💀 *${_name(player)}* bleeds out! Respawn in ${st._pro ? 30 : 60} min.`].join('\n'), tailText: '', flow: null, monster: m }; }
  // Push #96h-c: AUTO-WIRED. The strike runs through the real raid engine (gear, weapon,
  // title, passives, buffs, class skills). No skill named → the strongest READY skill the
  // hunter can afford is cast automatically; nothing ready → a basic strike.
  const target = { name: m.name, def: Math.floor(m.def * _monDebuff(ev, m, P)), isBoss: !!m.isBoss, statusEffects: m.statusEffects, rank: m.rank };
  const pick = skillName || _autoSkill(player);
  let res = null;
  const pat = _patternOf(player, skillName); if (pat && pat.error) return { ok: false, error: pat.error };
  if (pat) res = _patternStrike(P, { hp: m.hp, maxHp: m.maxHp, atk: m.atk, def: target.def, speed: m.speed, statusEffects: target.statusEffects }, pat);
  else { try { res = require('../dungeons/GateRaid').playerDamage(P, pick, target); } catch (e) { res = null; } }
  if (res && res.blocked && skillName) return { ok: false, error: res.reason || 'That skill cannot be used now.' };
  if (!res || res.blocked) { const c = Math.random() * 100 < h.crit + 5; res = { damage: _dmg(h.atk, target.def, c ? 1.6 : 1), isCrit: c, skillUsed: null }; }
  if (res.missed && domainActive(player)) { res.missed = false; res.dodged = false; res.damage = res.damage || _dmg(h.atk, target.def, 1); lines.push(`🌌 Inside *${domainActive(player).name}* your moves cannot miss.`); }
  let dmg = Math.max(0, Math.floor((res.damage || 0) * _domainMult(player, 'atk'))); const crit = !!res.isCrit;
  const statusLines = []; _applyStatuses(res, P, MW, statusLines, domainActive(player) ? _domainStatuses(player) : []);
  if (res.healed > 0) { P.stats.hp = Math.min(P.stats.maxHp, (P.stats.hp || 0) + res.healed); lines.push(`💚 *${res.skillUsed ? res.skillUsed.name : 'Recovery'}* restored *${res.healed}* HP`); }
  if (res.skillUsed) st.skillsUsed++; if (crit) st.crits++;
  const _mHpBefore = m.hp;
  m.hp = Math.max(0, m.hp - dmg); m.lastHit = Date.now(); m._regenAt = 0; st.dmg += dmg;
  // Push #96h-x: full dungeon-style presentation — the command layer plays this through UnifiedCombat.playTurn.
  const flow = { hunter: { name: _name(player), player: P }, monster: { name: `${m.name} #${m.id}`, hp: _mHpBefore, maxHp: m.maxHp, statusEffects: m.statusEffects || [] },
    move: res.skillUsed ? { name: res.skillUsed.name, description: res.skillUsed.description || 'A class skill unleashed on the island.', cooldownMs: (res.skillUsed.cooldown || 3) * 1000, effect: (res.skillUsed.effect && typeof res.skillUsed.effect === 'object' && res.skillUsed.effect.type) ? res.skillUsed.effect : null, isSkill: true } : null,
    result: { damage: dmg, crit, missed: !!res.missed, dodged: !!res.dodged, missWhy: res.missWhy || null }, counter: null, statusLines, preLines: lines.slice() };
  lines.push(...statusLines);
  const strikeLine = `${res.skillUsed ? `✨ *${res.skillUsed.name}*` : '⚔️'} *${_name(player)}* hits *${m.name}* #${m.id} for *${dmg.toLocaleString()}*${crit ? ' 💥CRIT' : ''} — ${m.hp.toLocaleString()}/${m.maxHp.toLocaleString()} HP`;
  lines.push(strikeLine);
  if (m.hp <= 0) {
    _awardKill(db, ev, m, player, st, lines);
    if (!alive(ev).length) lines.push(_nextWave(db, ev));
    else if (alive(ev).length === 1 && alive(ev)[0].isBoss) lines.push(`👑 *The wave boss emerges:* ${alive(ev)[0].name} — ${alive(ev)[0].maxHp.toLocaleString()} HP.${alive(ev)[0].artifact ? ` It carries 🔮 *${alive(ev)[0].artifact.name}* (${_artDesc(alive(ev)[0].artifact)}).` : ''}`);
  } else {
    // counter-strike: beasts never start a fight, but they answer one.
    const _ca = require('./UnifiedCombat').canAct(MW);
    if (!_ca.canAct) lines.push(`😵 *${m.name}* is ${_ca.reason} — no counter this turn.`);
    else {
    const mc = (10 + (m.critBonus || 0) + (m.isBoss ? 8 : 0)) > Math.random() * 100;
    let back = 0; try { back = require('../dungeons/GateRaid').monsterDamage({ ...m, atk: Math.floor(m.atk * _monDebuff(ev, m, P) * (m.isBoss ? 1.3 : 1)), _raid: false }, h.def, P) || 0; } catch (e) { back = 0; }
    if (!back) back = _dmg(m.atk * _monDebuff(ev, m, P) * (m.isBoss ? 1.3 : 1), h.def, mc ? 1.5 : 1);
    const _pHpBefore = P.stats.hp || 0;
    P.stats.hp = Math.max(0, (P.stats.hp || 0) - back); st.dmgTaken += back;
    const counterLine = `🩸 *${m.name}* counters for *${back.toLocaleString()}*${mc ? ' 💥' : ''} — ${_name(player)}: ${P.stats.hp}/${h.maxHp} HP`;
    lines.push(counterLine);
    flow.counter = { line: counterLine, dmg: back, crit: mc, playerHpBefore: _pHpBefore, playerMaxHp: h.maxHp, monsterHp: m.hp, monsterMaxHp: m.maxHp, monsterSkill: (Array.isArray(m.skills) && m.skills.length) ? m.skills[Math.floor(Math.random() * m.skills.length)] : null };
    if (P.stats.hp <= 0) { st.deaths++; st.diedAt = Date.now(); P.stats.hp = 0; st.statusEffects = []; st.tempBuffs = {}; lines.push(`💀 *${_name(player)} was slain by ${m.name}!* Respawn in ${st._pro ? 30 : 60} min.`); }
    }
  }
  _domainTurn(player, lines, P);
  _commit(P);
  const _pre = new Set([...(flow.preLines || []), ...statusLines]);
  const tail = lines.filter(l => l !== strikeLine && !(flow.counter && l === flow.counter.line) && !_pre.has(l));
  return { ok: true, text: lines.join('\n'), tailText: tail.join('\n'), flow, monster: m };
}
// ── HUNTER vs HUNTER: tag a hunter in your attack/skill. They get a 20s window to
//    retaliate (their own attack/skill on you); then BOTH moves resolve at once.
const RETALIATE_MS = 20 * 1000;
const BASIC = '__basic__'; // Push #96h-y: Counter button = plain base-ATK strike
function _pid(p) { return p.jid || p.id || p.name; }
function _pend(ev) { if (!ev.pending) ev.pending = {}; return ev.pending; }
function pendingFor(db, player) { const ev = _ev(db); if (!ev) return null; const id = _pid(player); return Object.values(_pend(ev)).find(x => x && (x.attackerId === id || x.victimId === id)) || null; }
function attackHunter(db, player, victim, skillName = null) {
  const g = _guard(db, player); if (g.error) return { ok: false, error: g.error }; const { ev, st } = g;
  if (!victim || victim === player) return { ok: false, error: 'Tag the hunter you want to strike in your attack: */event attack @hunter [skill]*.' };
  // Push #96h-x: no level gate on the island (join check below covers participation).
  const vs = _p(db, victim);
  if (!vs.joined) return { ok: false, error: `*${_name(victim)}* is not on the island (they have not /ejoin-ed).` };
  if (vs.afk) return { ok: false, error: `🛌 *${_name(victim)}* is AFK — untouchable.` };
  if (_isDead(vs)) return { ok: false, error: `*${_name(victim)}* is already down.` };
  // Push #96h-z4: against a HUNTER a plain number is an ATTACK PATTERN (/attack @x 7 → pattern #7); skills are named (/cast @x Fireball).
  if (skillName && /^\d+$/.test(String(skillName).trim())) skillName = `#${String(skillName).trim()}`;
  if (skillName && /^#\d+$/.test(skillName)) { const pt = _patternOf(player, skillName); if (pt && pt.error) return { ok: false, error: pt.error }; }
  else if (skillName) { try { const SC = require('./SkillCatalog'); const r = SC.resolveSkill(player, skillName, { allowLibrary: true }); if (!r.ok) return { ok: false, error: r.error }; skillName = r.skill.name; } catch (e) {} }
  const me = _pid(player), you = _pid(victim); const pend = _pend(ev);
  // Retaliation: the victim answers an open challenge against them → resolve NOW.
  const open = pend[me];
  if (open && open.attackerId === you) { open.victimSkill = skillName; open.victimAnswered = true; return resolvePending(db, me); }
  if (pend[you]) return { ok: false, error: `*${_name(victim)}* is already being challenged — wait for that clash to resolve.` };
  if (Object.values(pend).some(x => x.attackerId === me)) return { ok: false, error: 'Your previous strike has not resolved yet (20s window).' };
  pend[you] = { attackerId: me, victimId: you, attackerSkill: skillName, at: Date.now(), resolveAt: Date.now() + RETALIATE_MS };
  const clash = domainClash(player, victim);
  return { ok: true, pending: true, attackerId: me, victimId: you, resolveAt: pend[you].resolveAt, clash, text: `${g.note ? g.note + '\n' : ''}${clash ? clash.text + '\n' : ''}🗡️ *${_name(player)}* targets *${_name(victim)}*${skillName ? ` with *${skillName}*` : ''}!\n⏳ *${_name(victim)}* has *20 seconds* to retaliate — */event attack @${String(you).split('@')[0]} [skill]* — then both moves land at once.` };
}
function _find(db, id) { if (!id) return null; if (db.users[id]) return db.users[id]; const b = String(id).split('@')[0]; return Object.values(db.users || {}).find(u => u && (_pid(u) === id || String(_pid(u)).split('@')[0] === b)) || null; }
function _strike(db, ev, atkP, defP, skillName, lines) { // atkP/defP are event avatars (Push #96h-z)
  const h = { ...atkP.stats, crit: atkP.stats.critChance }, v = { ...defP.stats }; const as = _p(db, atkP._real || atkP), ds = _p(db, defP._real || defP);
  const vt = { name: _name(defP), def: Math.floor(v.def * _hunterDebuff(defP._real || defP, atkP._real || atkP)), statusEffects: defP.statusEffects || [] };
  { const UC = require('./UnifiedCombat'); const ca = UC.canAct(atkP); if (!ca.canAct) { lines.push(`😵 *${_name(atkP)}* is ${ca.reason} — no move this clash.`); return 0; } }
  let res = null;
  const pat = skillName === BASIC ? null : _patternOf(atkP, skillName);
  if (pat && pat.error) { lines.push(`⚠️ ${_name(atkP)}: ${pat.error} — basic strike instead.`); }
  else if (pat) res = _patternStrike(atkP, { hp: defP.stats.hp, maxHp: v.maxHp, atk: v.atk, def: vt.def, speed: v.speed, statusEffects: vt.statusEffects }, pat);
  else if (skillName !== BASIC) { try { res = require('../dungeons/GateRaid').playerDamage(atkP, skillName || _autoSkill(atkP), vt); } catch (e) { res = null; } }
  if (res && res.blocked) { lines.push(`⚠️ ${_name(atkP)}: ${res.reason || 'skill unavailable'} — basic strike instead.`); res = null; }
  if (!res) { const c = Math.random() * 100 < h.crit; res = { damage: _dmg(h.atk, vt.def, c ? 1.6 : 1), isCrit: c }; }
  const _ar = atkP._real || atkP;
  if (res.missed && domainActive(_ar)) { res.missed = false; res.damage = res.damage || _dmg(h.atk, vt.def, 1); lines.push(`🌌 Inside *${domainActive(_ar).name}* ${_name(atkP)}'s moves cannot miss.`); }
  const crit = !!res.isCrit; const dmg = Math.max(0, Math.floor((res.damage || 0) * _domainMult(_ar, 'atk') * _hunterDebuff(_ar, defP._real || defP)));
  if (res.skillUsed) as.skillsUsed++; if (crit) as.crits++;
  as.dmg += dmg; ds.dmgTaken += dmg;
  lines.push(`${res.skillUsed ? `✨ *${res.skillUsed.name}*` : '🗡️'} *${_name(atkP)}* → *${_name(defP)}*: *${dmg.toLocaleString()}*${crit ? ' 💥CRIT' : ''}${res.missed ? ' (missed)' : ''}`);
  _applyStatuses(res, atkP, defP, lines, domainActive(_ar) ? _domainStatuses(_ar) : []);
  _domainTurn(_ar, lines, atkP);
  return dmg;
}
function resolvePending(db, victimId) {
  const ev = _ev(db); if (!ev) return { ok: false, error: 'No event is running right now.' };
  const pend = _pend(ev); const c = pend[victimId]; if (!c) return { ok: false, error: 'Nothing to resolve.' };
  delete pend[victimId];
  const Ar = _find(db, c.attackerId), Br = _find(db, c.victimId); if (!Ar || !Br) return { ok: false, error: 'A duelist vanished.' };
  const A = _avatar(db, Ar), B = _avatar(db, Br); const as = _p(db, Ar), bs = _p(db, Br); const lines = [`⚔️ *CLASH — ${_name(A)} vs ${_name(B)}*${c.victimAnswered ? '' : ` (${_name(B)} did not retaliate)`}`];
  _tickEntity(A, lines); _tickEntity(B, lines);
  // Both moves are computed from the SAME starting state, then applied together.
  // Push #96h-y: Dodge+counter — speed-based evasion of the opener, then a base-ATK counter.
  let dA;
  if (c.victimDodged) { lines.push(`💨 *${_name(B)}* DODGES ${_name(A)}'s opener (${c.dodgePct}% by speed)!`); dA = 0; }
  else { if (c.victimDodgeTried) lines.push(`💨 *${_name(B)}* tries to dodge (${c.dodgePct}%) — too slow!`); dA = _strike(db, ev, A, B, c.attackerSkill, lines); }
  const dB = c.victimAnswered ? _strike(db, ev, B, A, c.victimSkill, lines) : 0;
  B.stats.hp = Math.max(0, (B.stats.hp || 0) - dA); if (dB) A.stats.hp = Math.max(0, (A.stats.hp || 0) - dB);
  lines.push(`❤️ ${_name(A)} ${A.stats.hp}/${A.stats.maxHp} · ${_name(B)} ${B.stats.hp}/${B.stats.maxHp}`);
  const kill = (winner, loser, ws, ls) => { const stolen = Math.floor((ls.points || 0) * STEAL_PCT); ws.points += stolen + HUNTER_KILL_BONUS; ws.hunterKills++; ls.points = 0; ls.deaths++; ls.diedAt = Date.now(); ls.statusEffects = []; ls.tempBuffs = {}; lines.push(`💀 *${_name(loser)} is slain!* ${_name(winner)} takes *${stolen} points* (+${HUNTER_KILL_BONUS} bounty) — ${_name(loser)}'s points reset to *0*, respawn in ${ls._pro ? 30 : 60} min.`); _gainExp(db, winner._real || winner, ws, EXP_HUNTER, lines); };
  if (B.stats.hp <= 0 && A.stats.hp <= 0) { lines.push(`☠️ *Double knockout!* Both fall — no points change hands.`); as.deaths++; bs.deaths++; as.diedAt = bs.diedAt = Date.now(); }
  else { if (B.stats.hp <= 0) kill(A, B, as, bs); if (A.stats.hp <= 0) kill(B, A, bs, as); }
  _commit(A); _commit(B);
  return { ok: true, text: lines.join('\n'), attackerId: c.attackerId, victimId: c.victimId };
}
// Push #96h-y: the three answers to being targeted.
function counterPending(db, player) {
  const ev = _ev(db); if (!ev) return { ok: false, error: 'No event is running right now.' };
  const me = _pid(player); const open = _pend(ev)[me]; if (!open) return { ok: false, error: 'Nobody is targeting you right now.' };
  open.victimSkill = BASIC; open.victimAnswered = true; return resolvePending(db, me);
}
function fleePending(db, player) {
  const ev = _ev(db); if (!ev) return { ok: false, error: 'No event is running right now.' };
  const me = _pid(player); const open = _pend(ev)[me]; if (!open) return { ok: false, error: 'Nobody is targeting you right now.' };
  const A = _find(db, open.attackerId); const st = _p(db, player);
  // Push #96h-z4: no escape from a hunter whose domain stands — unless YOUR domain stands too (break theirs first).
  if (A && domainActive(A) && !domainActive(player)) return { ok: false, error: `🌌 *${domainActive(A).name}* holds you — you cannot flee from ${_name(A)} while their domain stands. Counter, dodge, or open your own domain.` };
  if (domainActive(player)) { delete _pend(ev)[me]; st.flees = (st.flees || 0) + 1; return { ok: true, fled: true, pct: 100, text: `🏃 *${_name(player)}* steps back into *${domainActive(player).name}* — ${A ? `${_name(A)}'s` : 'the'} strike cannot follow. (A standing domain guarantees the escape.)`, attackerId: open.attackerId }; }
  // Flee = speed + event level + luck (never guaranteed without a domain).
  const vs = eventStats(db, player), as = A ? eventStats(db, A) : { speed: vs.speed, level: vs.level };
  const sv = Math.max(1, vs.speed), sa = Math.max(1, as.speed); const luck = Math.round((Math.random() - 0.5) * 20);
  const pct = Math.round(Math.max(10, Math.min(90, 40 + ((sv - sa) / (sv + sa)) * 50 + (vs.level - as.level) * 2 + luck)));
  if (Math.random() * 100 < pct) { delete _pend(ev)[me]; st.flees = (st.flees || 0) + 1; return { ok: true, fled: true, pct, text: `🏃 *${_name(player)}* FLEES (${pct}% — speed, level & luck) — ${A ? `${_name(A)}'s` : 'the'} strike cuts through empty air. No points change hands.`, attackerId: open.attackerId }; }
  open.victimAnswered = false; open.fleeFailed = pct; const r = resolvePending(db, me); if (r.ok) r.text = `🏃 *${_name(player)}* tries to flee (${pct}%) — too slow!\n${r.text}`; return r;
}
function dodgePending(db, player) {
  const ev = _ev(db); if (!ev) return { ok: false, error: 'No event is running right now.' };
  const me = _pid(player); const open = _pend(ev)[me]; if (!open) return { ok: false, error: 'Nobody is targeting you right now.' };
  const A = _find(db, open.attackerId); const vs = eventStats(db, player), as = A ? eventStats(db, A) : { speed: vs.speed };
  const sv = Math.max(1, vs.speed || 1), sa = Math.max(1, as.speed || 1);
  const pct = Math.round(Math.max(15, Math.min(85, 50 + ((sv - sa) / (sv + sa)) * 70)));
  open.victimDodgeTried = true; open.dodgePct = pct; open.victimDodged = Math.random() * 100 < pct; open.victimSkill = BASIC; open.victimAnswered = true;
  return resolvePending(db, me);
}
function resolveExpired(db) {
  const ev = _ev(db); if (!ev || !ev.pending) return []; const out = []; const now = Date.now();
  for (const [vid, c] of Object.entries(ev.pending)) if (c && now >= c.resolveAt) { const r = resolvePending(db, vid); if (r.ok) out.push(r); }
  return out;
}
// Push #96h-h: while you are ON the island (joined, not AFK) you cannot enter raids or
// dungeons — /eventafk first. Saying anything in the Events GC breaks AFK and pulls you
// out of whatever dungeon/raid you were in (announced).
function blocksRaids(db, player) {
  const ev = _ev(db); if (!ev || !player) return null; const st = player.eventStats;
  if (!st || st.id !== ev.id || !st.joined || st.afk) return null;
  return `🏝️ You are on *Jeju Island* — the event holds you. */eventafk* in the Events GC before you raid or run dungeons.`;
}
function pullFromDungeons(db, player) {
  const out = []; const id = _pid(player);
  try { const GR = require('../dungeons/GateRaid'); const g = GR.findOtherRaid ? GR.findOtherRaid(id, null) : null;
    if (g && g.raid) { const n = require('../dungeons/GateKeyManager').normaliseJid(id); const wasLeader = g.raid.leader === id || require('../dungeons/GateKeyManager').normaliseJid(g.raid.leader) === n;
      g.raid.members = (g.raid.members || []).filter(m => m.id !== id && require('../dungeons/GateKeyManager').normaliseJid(m.id) !== n); g.raiders = (g.raiders || []).filter(j => j !== id);
      if (wasLeader) { try { GR.succeedLeader(g, id); } catch (e) {} } out.push(`${g.rank || '?'}-Rank gate raid${g.id ? ` [${g.id}]` : ''}`); } } catch (e) {}
  try { if (db.soloDungeons && db.soloDungeons[id]) { delete db.soloDungeons[id]; out.push('solo dungeon'); } } catch (e) {}
  try { const DPM = require('../dungeons/DungeonPartyManager'); const party = DPM.getPartyByPlayer(id); if (party) { DPM.leaveParty(party.id, id); out.push('dungeon party'); } } catch (e) {}
  try { if (player.instance && player.instance.active) { require('./InstanceDungeon').end(player, true); out.push('instance'); } } catch (e) {}
  return out;
}
function breakAfk(db, player) {
  const ev = _ev(db); if (!ev || !player) return null; const st = player.eventStats;
  if (!st || st.id !== ev.id || !st.joined || !st.afk) return null;
  st.afk = false; st.activeSince = Date.now(); const pulled = pullFromDungeons(db, player);
  return { ok: true, pulled, text: `⚔️ *${_name(player)} is back on the island!*${pulled.length ? ` Pulled out of: ${pulled.join(', ')}.` : ''} You can be targeted again.` };
}
function toggleAfk(db, player) {
  const ev = tick(db); if (!ev) return { ok: false, error: 'No event is running right now.' };
  const st = _p(db, player); if (!st.joined) return { ok: false, error: 'You have not joined the raid yet — */ejoin*.' };
  if (!st.afk) { const left = AFK_LOCK_MS - (Date.now() - (st.activeSince || st.joinedAt || 0)); if (left > 0) return { ok: false, error: `⏳ You are locked into the fight for *${Math.ceil(left / 60000)} more min* — once you are in, you play 10 minutes before /eventafk.` }; }
  st.afk = !st.afk; if (!st.afk) st.activeSince = Date.now();
  return { ok: true, afk: st.afk, text: st.afk ? `🛌 *${_name(player)} is now AFK* — no hunter or beast can target you, you cannot attack, and you are free to raid/dungeon. *Any event action* (/event attack, buff, grab, domain or tagging a hunter) brings you back and locks you in for 10 min.` : `⚔️ *${_name(player)} is back on the island!* You can be targeted again.` };
}

// ── event domain (Lv.10, event GC only) ───────────────────────
function domainState(player) { if (!player.eventDomain) player.eventDomain = { name: null, desc: null, casts: 0, lastCast: 0, activeUntil: 0 }; return player.eventDomain; }
function setDomainName(player, name) { const n = String(name || '').trim().slice(0, 40); if (n.length < 3) return { ok: false, error: 'Name must be 3–40 characters.' }; domainState(player).name = n; return { ok: true, text: `🌌 Event domain named *${n}*.` }; }
function setDomainDesc(player, desc) { const d = String(desc || '').trim().slice(0, 220); if (d.length < 5) return { ok: false, error: 'Description must be 5–220 characters.' }; domainState(player).desc = d; return { ok: true, text: `📜 Event domain description saved.` }; }
function castDomain(db, player, chatId, victim = null) {
  if (!isEventGC(db, chatId)) return { ok: false, error: 'Your event domain only answers inside the Events GC.' };
  const g = _guard(db, player); if (g.error) return { ok: false, error: g.error }; const { ev, st } = g;
  const d = domainState(player);
  if (!d.name) return { ok: false, error: 'Your event domain has no name yet — */event domain name <name>* then */event domain desc <description>*.' };
  if (!d.desc) return { ok: false, error: 'Give your event domain a description first — */event domain desc <description>*.' };
  const _cdMs = st._pro ? DOMAIN_COOLDOWN_MS / 2 : DOMAIN_COOLDOWN_MS; // Push #96h-z4: Pro domain cooldown halved
  if (Date.now() - (d.lastCast || 0) < _cdMs) return { ok: false, error: `Your domain is still recovering — ${Math.ceil((_cdMs - (Date.now() - d.lastCast)) / 60000)} min left${st._pro ? ' (Pro: 30 min cooldown)' : ' (60 min; Pro 30)'}.` };
  const energy = player.stats.energy || 0; if (energy < DOMAIN_ENERGY) return { ok: false, error: `Domain Expansion costs *${DOMAIN_ENERGY} ${player.energyType || 'energy'}* — you have ${energy}.` };
  player.stats.energy = energy - DOMAIN_ENERGY; d.lastCast = Date.now(); d.activeUntil = Date.now() + DOMAIN_EFFECT_MS; d.casts++; st.domainCasts++;
  try { const rd = player.domain; if (rd && rd.unlocked) { d.own = true; d.ownLevel = Math.max(DOMAIN_LEVEL, Number(rd.level) || 1); } } catch (e) {} // Push #96h-z7: always the CURRENT real domain level
  try { d.turnsLeft = require('./DomainSystem').turnsFor(d.own ? (d.ownLevel || DOMAIN_LEVEL) : DOMAIN_LEVEL); } catch (e) { d.turnsLeft = 6; } // Lv.10 → 6 turns, +1 per 2 levels; 20 min cap
  st.statusEffects = []; // Push #96h-z7: expanding your domain erases every status on you; inside it none can take hold
  const h = _realStats(player); let hit = 0, total = 0; const until = Date.now() + DOMAIN_EFFECT_MS; // the domain keeps its real buff and weight
  const _lvMult = d.own ? Math.min(2, 1 + (Math.max(0, (d.ownLevel || DOMAIN_LEVEL) - DOMAIN_LEVEL)) * 0.05) : 1; // a carried domain hits harder per level above 10 (cap ×2)
  let burstPct = 150; try { const e = require('./DomainSystem').scaledEffect(player); if (e && e.burst) burstPct = e.burst; } catch (e) {}
  const burst = Math.floor(h.atk * (burstPct / 100) * _lvMult * 3); // ALL of the opening burst lands on ONE target
  let burstLine = ''; let hunters = 0; const me = _pid(player);
  if (victim && victim !== player) { // tagged hunter: full burst + domain statuses on THEM
    const V = _avatar(db, victim); const vs = _p(db, victim);
    const dmg = Math.max(1, Math.floor(burst * (1 - _mit(V.stats.def, h.atk)))); V.stats.hp = Math.max(0, V.stats.hp - dmg); vs.dmgTaken += dmg; total = dmg; vs.debuffUntil = until; hunters = 1;
    const fxl = []; _applyStatuses({ missed: false, statuses: [] }, _avatar(db, player), V, fxl, _domainStatuses(player));
    burstLine = `💥 Opening burst: *${_name(victim)}* takes *${dmg.toLocaleString()}* (${V.stats.hp}/${V.stats.maxHp} HP)${fxl.length ? '\n' + fxl.join('\n') : ''}`;
    if (V.stats.hp <= 0) { vs.deaths++; vs.diedAt = Date.now(); vs.statusEffects = []; vs.tempBuffs = {}; const stolen = Math.floor((vs.points || 0) * STEAL_PCT); st.points += stolen + HUNTER_KILL_BONUS; st.hunterKills++; vs.points = 0; burstLine += `\n💀 *${_name(victim)} is crushed by the domain!* +${stolen} stolen points (+${HUNTER_KILL_BONUS} bounty).`; const el = []; _gainExp(db, player, st, EXP_HUNTER, el); burstLine += '\n' + el.join('\n'); }
    _commit(V);
  } else { // no tag: the ACTIVE beast (your last target, else the weakest alive) takes the whole burst
    const live = alive(ev); let m = live.find(x => x.id === st.lastTarget && !x.defeated) || null;
    if (!m) { const nb = live.filter(x => !x.isBoss); m = nb.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0] || live[0]; }
    if (m) { const dmg = Math.max(1, Math.floor(burst * (1 - _mit(m.def, h.atk)))); m.hp = Math.max(0, m.hp - dmg); m.lastHit = Date.now(); m._regenAt = 0; m.domDebuffUntil = until; hit = 1; total = dmg; const fxl = []; _applyStatuses({ missed: false, statuses: [] }, _avatar(db, player), _mWrap(m), fxl, _domainStatuses(player));
      burstLine = `💥 Opening burst: *${m.name}* #${m.id} takes *${dmg.toLocaleString()}* (${m.hp.toLocaleString()}/${m.maxHp.toLocaleString()} HP)${fxl.length ? '\n' + fxl.join('\n') : ''}`;
      if (m.hp <= 0) { const kl = []; _awardKill(db, ev, m, player, st, kl, `the domain`); burstLine += '\n' + kl.join('\n'); if (!alive(ev).length) burstLine += '\n' + _nextWave(db, ev); } }
  }
  st.dmg += total;
  const msgs = [`🌌 *DOMAIN EXPANSION — ${d.name.toUpperCase()}*`, `_${d.desc}_`,
    `👤 ${_name(player)} · ${d.own ? `Domain Lv.${d.ownLevel}` : `Event Domain Lv.${DOMAIN_LEVEL}`}\n${burstLine}\n🌌 *${d.name}* stands for *${d.turnsLeft} turns* (max 20 min): every foe you meet inside it loses 20% ATK/DEF${_domainStatuses(player).length ? ` and risks ${_domainStatuses(player).map(x => `${x.chance}% ${String(x.type).toUpperCase()}`).join(', ')}` : ''}; your moves cannot miss and deal +25%.\n💚 You regenerate 10% HP every turn and no status can touch you inside it; your flee always succeeds. Strike a hunter whose domain is up → *domain clash* (most refined wins).`];
  return { ok: true, messages: msgs };
}

// ── info ──────────────────────────────────────────────────────
function leaderboard(db, n = 10) {
  const ev = db.event; if (!ev) return [];
  return Object.values(db.users || {}).filter(u => u && u.eventStats && u.eventStats.id === ev.id && (u.eventStats.points > 0 || u.eventStats.kills > 0 || u.eventStats.joined)).map(u => ({ name: _name(u), points: u.eventStats.points || 0, kills: u.eventStats.kills || 0, bossKills: u.eventStats.bossKills || 0, hunterKills: u.eventStats.hunterKills || 0, deaths: u.eventStats.deaths || 0, level: u.eventStats.elvl || 1, rank: _erank(u.eventStats.elvl || 1), artifacts: (u.eventStats.artifacts || []).length, afk: !!u.eventStats.afk, dead: !!_isDead(u.eventStats) })).sort((a, b) => b.points - a.points || b.kills - a.kills).slice(0, n);
}
// Push #96h-z2: /elb — top participants with kills · deaths · points · event level.
function leaderboardText(db, n = 10) {
  if (!db.event) return '🎪 No event has run yet — the leaderboard opens with the first one.';
  const lb = leaderboard(db, n); if (!lb.length) return '🏆 Nobody has scored on Jeju Island yet — */ejoin* and strike a beast.';
  return [`🏆 *JEJU ISLAND RAID — TOP ${lb.length}*${db.event.active ? ` · wave ${db.event.wave}` : ' (final)'}`, ...lb.map((e, i) => `${['🥇', '🥈', '🥉'][i] || `${i + 1}.`} *${e.name}* — ${e.points.toLocaleString()} pts\n    🎚️ Lv.${e.level} (${e.rank}) · ☠️ ${e.kills} kills${e.bossKills ? ` (👑${e.bossKills})` : ''} · 🗡️ ${e.hunterKills} hunters · 💀 ${e.deaths} deaths · 🔮 ${e.artifacts}${e.afk ? ' · 🛌' : ''}${e.dead ? ' · ⚰️' : ''}`)].join('\n');
}
// Push #96h-z2: what you can throw on the island right now.
function loadoutText(db, player) {
  const lines = [`🎒 *${_name(player)} — ISLAND LOADOUT*`];
  try { const SC = require('./SkillCatalog'); const sk = SC.unlockedSkills(player) || []; const energy = (player.stats && player.stats.energy) || 0;
    const show = sk.map(e => { const cd = SC.onCooldown(player, e); const cost = SC.effectiveCost(e, player); const tag = !cd.ready ? '⏳' : cost > energy ? '🔋' : '✅'; return `${tag} ${e.name}${e.type && e.type !== 'damage' ? ` _(${e.type})_` : ''} · ${cost}⚡`; });
    lines.push(`✨ *Skills* (✅ ready · ⏳ cooldown · 🔋 no energy):`, show.length ? show.join('\n') : '— none unlocked'); } catch (e) { lines.push('✨ Skills: (unavailable)'); }
  try { const AP = require('./AttackPatternDB'); const eq = (player.attackPatterns && player.attackPatterns.equipped) || []; lines.push(`🎯 *Attack patterns* (equipped — use #id):`, eq.length ? eq.map(id => { let nm = `#${id}`; try { const a = AP.generateAttack(id); nm = `#${id} ${a && a.name ? a.name : ''}`.trim(); } catch (e) {} return `• ${nm}`; }).join('\n') : '— none equipped (/attackpattern)'); } catch (e) {}
  lines.push(``, `⚔️ */event attack [beast] <skill | #id>* · 🗡️ */event attack @hunter <skill | #id>* · ✨ */event buff <support skill>*`);
  return lines.join('\n');
}
function status(db) {
  const ev = tick(db); if (!ev) return '🎪 *ASTRA EVENTS* — nothing is running right now. Watch the Events GC for the next one.';
  const live = alive(ev); const boss = ev.monsters.find(m => m.isBoss); const left = Math.max(0, Math.ceil((ev.endsAt - Date.now()) / DAY));
  const low = live.filter(m => !m.isBoss).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp).slice(0, 5).map(m => `  #${m.id} ${m.typeLabel ? m.typeLabel.split(' ')[0] : '👹'} ${m.name} [${m.rank}] ${m.hp.toLocaleString()}/${m.maxHp.toLocaleString()}`).join('\n');
  return [`🏝️ *JEJU ISLAND RAID* — Wave *${ev.wave}* · ${left} day${left === 1 ? '' : 's'} left`, `👹 Beasts alive: *${live.filter(m => !m.isBoss).length}/${WAVE_SIZE}* · 👑 Boss: ${boss ? (boss.defeated ? 'slain' : `${boss.hp.toLocaleString()}/${boss.maxHp.toLocaleString()} HP`) : '—'}`, `🌊 Waves cleared: ${ev.wavesCleared}`, low ? `\n🎯 *Weakest targets:*\n${low}` : '', `\n/event attack [#] · /event hit @hunter · /event domain · /eventafk · /epoints · /eshop`].filter(Boolean).join('\n');
}
function pointsText(db, player) { const ev = db.event; if (!ev) return 'No event running.'; const st = _p(db, player); return `🏝️ *${_name(player)}* — *${st.points.toLocaleString()} event points*${st.afk ? ' · 🛌 AFK' : ''}${_isDead(st) ? ` · 💀 respawn in ${_respawnIn(st)}` : ''}`; }
function statsText(db, player) { const ev = db.event; if (!ev) return 'No event running.'; const st = _p(db, player); const es = eventStats(db, player); _sync(st, es); const d = player.eventDomain || {}; return [`📊 *JEJU RAID — ${_name(player)}*`, `🎚️ *Event Lv.${es.level}* (${es.rank}-Rank) · EXP ${es.exp}/${es.need}${st._pro ? ' · Pro ×2 EXP' : ''}`, `❤️ ${st.hp}/${es.maxHp} · ⚔️ ATK ${es.atk} · 🛡️ DEF ${es.def} · ⚡ SPD ${es.speed} · 💥 CRIT ${es.crit}%`, `🔮 Artifacts (${(st.artifacts || []).length}/${ARTIFACT_SLOTS}): ${(st.artifacts || []).length ? st.artifacts.map(a => `${a.name} [${_artDesc(a)}]`).join(', ') : 'none yet — beasts drop them, bosses always; /event grab the island spawn'}`, `🏅 Points: ${st.points.toLocaleString()}`, `☠️ Beast kills: ${st.kills} (👑 ${st.bossKills} bosses)`, `🗡️ Hunter kills: ${st.hunterKills}`, `💀 Deaths: ${st.deaths}`, `💥 Damage dealt: ${st.dmg.toLocaleString()} · 🩸 taken: ${(st.dmgTaken || 0).toLocaleString()}`, `✨ Skills cast: ${st.skillsUsed || 0} · 💥 crits: ${st.crits || 0} · 🌌 domain casts: ${st.domainCasts || 0}`, `⏱️ Joined: ${st.joinedAt ? new Date(st.joinedAt).toUTCString().slice(5, 22) : 'not yet (/ejoin)'}`, `🛒 Points spent: ${st.spent || 0}`, `🌌 Event domain: ${d.name ? `${d.name} (${d.casts || 0} casts)` : 'unnamed — /event domain name <name>'}`, `${st.afk ? '🛌 AFK' : '⚔️ Active'}${_isDead(st) ? ` · respawn in ${_respawnIn(st)}` : ''}`].join('\n'); }
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
  const ev = tick(db) || db.event; if (!ev) return '🎪 *ASTRA EVENTS*\n\nNo event is running right now. Seasonal events are announced in the Events GC — when one opens, */einfo* carries the full briefing and */ejoin* gets you in.\n\n_Past events: ' + ((db.eventHistory || []).length ? db.eventHistory.slice(-3).map(h => `${h.name || 'Event'} (${h.waves} waves)`).join(', ') : 'none yet') + '_';
  const live = alive(ev); const boss = ev.monsters.find(m => m.isBoss); const byRank = {}; for (const m of live) if (!m.isBoss) byRank[m.rank] = (byRank[m.rank] || 0) + 1;
  const parts = Object.values(db.users || {}).filter(u => u && u.eventStats && u.eventStats.id === ev.id && u.eventStats.joined); const now = Date.now();
  const active = parts.filter(u => !u.eventStats.afk && !_isDead(u.eventStats)).length, afk = parts.filter(u => u.eventStats.afk).length, dead = parts.filter(u => _isDead(u.eventStats)).length;
  const tot = parts.reduce((a, u) => ({ k: a.k + (u.eventStats.kills || 0), hk: a.hk + (u.eventStats.hunterKills || 0), d: a.d + (u.eventStats.deaths || 0), dmg: a.dmg + (u.eventStats.dmg || 0), pts: a.pts + (u.eventStats.points || 0) }), { k: 0, hk: 0, d: 0, dmg: 0, pts: 0 });
  const killed = ev.monsters.filter(m => m.defeated).length; const prog = Math.round(killed / ev.monsters.length * 100); const bar = '█'.repeat(Math.round(prog / 10)) + '░'.repeat(10 - Math.round(prog / 10));
  const lb = leaderboard(db, 10);
  return [`🏝️ *JEJU ISLAND RAID — FULL BRIEFING*`, ev.active ? `⏳ ${_fmtLeft(ev.endsAt - now)} left · started ${new Date(ev.startedAt).toUTCString().slice(5, 16)}` : `🏁 Ended (${ev.endReason || 'ended'})`,
    ``, `🌊 *PROGRESSION*`, `Wave *${ev.wave}* · waves cleared: ${ev.wavesCleared} · next wave is 22% stronger`, `${bar} ${prog}% of this wave (${killed}/${ev.monsters.length})`,
    `👹 Alive by rank: ${RANKS.map(r => byRank[r] ? `${r}:${byRank[r]}` : null).filter(Boolean).join(' · ') || 'none'}`, `👑 Boss: ${boss ? `${boss.name} — ${boss.defeated ? 'slain' : `${boss.hp.toLocaleString()}/${boss.maxHp.toLocaleString()} HP${live.length > 1 ? ' (locked until the beasts fall)' : ' — OUT NOW'}`}` : '—'}`,
    ``, `👥 *PARTICIPANTS* — ${parts.length} hunters`, `⚔️ active ${active} · 🛌 AFK ${afk} · 💀 respawning ${dead}`, `☠️ beast kills ${tot.k.toLocaleString()} · 🗡️ hunter kills ${tot.hk} · deaths ${tot.d} · 💥 damage ${tot.dmg.toLocaleString()} · 🏅 points held ${tot.pts.toLocaleString()}`,
    ``, `🏆 *TOP 10*`, ...(lb.length ? lb.map((e, i) => `${['🥇', '🥈', '🥉'][i] || `${i + 1}.`} ${e.name} — ${e.points.toLocaleString()} pts · ${e.kills}☠️ ${e.hunterKills}🗡️`) : ['_Nobody has scored yet._']),
    ``, `📜 *RULES*`, `• */ejoin* to enter (all levels) · 10 days · ${WAVE_SIZE} beasts + 1 boss per wave`, `• Beasts never start a fight — they counter; idle 30s → +5% HP per 30s`, `• Friendly fire: tag a hunter in your attack (/event attack @hunter [skill]); they get 20s to retaliate, then both moves land · kill = 50% of their points, theirs reset to 0`, `• Death = 1h respawn · /eventafk = untouchable, no attacking, free to raid — any message here brings you back`, `• Attack with plain */attack [#|@hunter] [skill]* or */skill <skill>* in this GC (reply to a hunter = target them)`, `• Lv.10 event domain: /event domain (name + desc first) · ${DOMAIN_ENERGY} energy · 1h cooldown`, `• Points: E${KILL_POINTS.E} D${KILL_POINTS.D} C${KILL_POINTS.C} B${KILL_POINTS.B} A${KILL_POINTS.A} S${KILL_POINTS.S} · boss ${BOSS_POINTS} · hunter kill +${HUNTER_KILL_BONUS} · spend in /eshop`].join('\n');
}

module.exports = { TF_COOLDOWN_MS, MON_FX_TICK_MS, domainActive, domainClash, DOMAIN_EFFECT_MS, leaderboardText, loadoutText, eventStats, expNeed, grabArtifact, artifactAlert, _avatar, _commit, EVENT_BASE, ELVL_MAX, EXP_KILL, EXP_BOSS, EXP_HUNTER, ARTIFACT_SLOTS, ARTIFACT_SPAWN_MS, AFK_LOCK_MS, HUNTER_REGEN_PCT, supportSkill, counterPending, fleePending, dodgePending, PRO_RESPAWN_MS, BEAST_MULT, KILL_POINTS, BOSS_POINTS, infoText, blocksRaids, breakAfk, pullFromDungeons, RETALIATE_MS, pendingFor, resolvePending, resolveExpired, join, isJoined, handleSetupReply, setupStep, _autoSkill, EVENT_LENGTH_MS, WAVE_SIZE, RESPAWN_MS, REGEN_IDLE_MS, REGEN_PCT, STEAL_PCT, DOMAIN_LEVEL, DOMAIN_ENERGY, SHOP, KILL_POINTS, BOSS_POINTS, gcId, isEventGC, buildWave, start, end, tick, alive, attackMonster, attackHunter, toggleAfk, domainState, setDomainName, setDomainDesc, castDomain, leaderboard, status, pointsText, statsText, shopText, buy, _p };
