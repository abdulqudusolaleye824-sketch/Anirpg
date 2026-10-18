// ═══════════════════════════════════════════════════════════════
// Astra — Guild Labyrinth (Push #97)
//
// A TRAINING raid. The guild master buys ONE Labyrinth Key per week; the key
// opens the labyrinth in a dungeon GC. Up to 50 hunters join. Endless waves of
// the weakest E-rank beasts, free infinite revive/heal inside, negligible XP
// (a Lv1 cannot reach Lv2 in here), no loot. Hunters inside are "not on this
// realm": no raids, no duels, no tags. Only the leader's /labyrinth end closes it.
// ═══════════════════════════════════════════════════════════════
'use strict';

const KEY_COST_NEXUS = 2000000;      // 💠 from the guild treasury (falls back to the master's own Nexus)
const WEEK_MS = 7 * 24 * 3600e3;
const MAX_HUNTERS = 50;
const WAVE_SIZE = 6;
const XP_PER_KILL = 1;               // negligible on purpose: Lv1→Lv2 needs far more than a session yields
const XP_CAP_PER_SESSION = 25;

function _max(p) { try { return require('./GearSystem').effectiveMaxHp(p) || p.stats.maxHp || 100; } catch (e) { return (p && p.stats && p.stats.maxHp) || 100; } }
function _pick(a) { return a[Math.floor(Math.random() * a.length)]; }
function store(db) { if (!db.labyrinths || typeof db.labyrinths !== 'object') db.labyrinths = {}; return db.labyrinths; }
function get(db, chatId) { return store(db)[chatId] || null; }
function findByMember(db, jid) { return Object.values(store(db)).find(l => l && l.active && l.members && l.members[jid]) || null; }

function isMaster(guild, jid) { return !!guild && (guild.leader === jid || (guild.members || []).some(m => m && typeof m === 'object' && m.id === jid && /leader|guild master/i.test(String(m.rank || '')))); }

// ── Key purchase (weekly) ───────────────────────────────────────
function keyState(guild) {
  const k = guild && guild.labyrinthKey;
  if (!k) return { have: false, canBuy: true, nextBuyAt: 0 };
  const nextBuyAt = (k.boughtAt || 0) + WEEK_MS;
  return { have: !k.used, used: !!k.used, canBuy: Date.now() >= nextBuyAt, nextBuyAt, boughtAt: k.boughtAt };
}
function buyKey(db, guild, buyer, jid) {
  if (!guild) return { ok: false, error: '❌ You are not in a guild.' };
  if (!isMaster(guild, jid || buyer.jid || buyer.id)) return { ok: false, error: '❌ Only the *Guild Master* buys the Labyrinth Key.' };
  const ks = keyState(guild);
  if (ks.have) return { ok: false, error: `🗝️ Your guild already holds an unused *Labyrinth Key*. Open it in a dungeon GC: */labyrinth open*.` };
  if (!ks.canBuy) return { ok: false, error: `⏳ One Labyrinth Key per week. Next purchase in *${Math.ceil((ks.nextBuyAt - Date.now()) / 3600e3)}h*.` };
  let from = 'treasury';
  if ((Number(guild.treasury) || 0) >= KEY_COST_NEXUS) guild.treasury -= KEY_COST_NEXUS;
  else if ((Number(buyer.gold) || 0) >= KEY_COST_NEXUS) { buyer.gold -= KEY_COST_NEXUS; from = 'your own Nexus'; }
  else return { ok: false, error: `❌ The key costs 💠 *${KEY_COST_NEXUS.toLocaleString()} Nexus* — guild treasury has ${(guild.treasury || 0).toLocaleString()}, you have ${(buyer.gold || 0).toLocaleString()}.` };
  guild.labyrinthKey = { boughtAt: Date.now(), by: jid || buyer.jid || buyer.id || null, used: false };
  return { ok: true, from, line: `🗝️ *LABYRINTH KEY* bought for 💠 ${KEY_COST_NEXUS.toLocaleString()} (${from}). Open it in a dungeon GC: */labyrinth open* — valid until used, next key in 7 days.` };
}

// ── Open / join / leave / end ───────────────────────────────────
function open(db, guild, leaderJid, chatId) {
  if (!guild) return { ok: false, error: '❌ You are not in a guild.' };
  if (!isMaster(guild, leaderJid) && !_officer(guild, leaderJid)) return { ok: false, error: '❌ Only the Guild Master (or an officer) opens the labyrinth.' };
  if (!keyState(guild).have) return { ok: false, error: '❌ Your guild has no unused *Labyrinth Key*. Master: */labyrinth buy* (one per week).' };
  if (get(db, chatId) && get(db, chatId).active) return { ok: false, error: '❌ A labyrinth is already open in this GC.' };
  const busy = Object.values(store(db)).find(l => l && l.active && l.guild === guild.name);
  if (busy) return { ok: false, error: `❌ Your guild's labyrinth is already running in another GC. */labyrinth end* there first.` };
  guild.labyrinthKey.used = true; guild.labyrinthKey.usedAt = Date.now();
  const lab = { active: true, guild: guild.name, leader: leaderJid, chatId, openedAt: Date.now(), wave: 1, kills: 0, members: {}, monsters: [], log: [] };
  try { require('./BotLane').claim(lab); } catch (e) {}
  spawnWave(lab);
  store(db)[chatId] = lab;
  return { ok: true, lab };
}
function _officer(guild, jid) { return (guild.members || []).some(m => m && typeof m === 'object' && m.id === jid && /officer|vice|elder/i.test(String(m.rank || ''))); }

function join(db, lab, player, jid) {
  if (!lab || !lab.active) return { ok: false, error: '❌ No labyrinth is open here.' };
  if (lab.members[jid]) return { ok: false, error: '✅ You are already inside the labyrinth.' };
  if (Object.keys(lab.members).length >= MAX_HUNTERS) return { ok: false, error: `❌ The labyrinth is full (*${MAX_HUNTERS}* hunters).` };
  const busy = (() => { try { return require('./Engagement').whereBusy(db, jid, player, { ignore: ['labyrinth'] }); } catch (e) { return null; } })();
  if (busy) return { ok: false, error: busy.text };
  lab.members[jid] = { joinedAt: Date.now(), kills: 0, deaths: 0, xp: 0, dmg: 0 };
  player.labyrinth = { active: true, chatId: lab.chatId, guild: lab.guild, since: Date.now() };
  return { ok: true, count: Object.keys(lab.members).length };
}
function leave(db, lab, player, jid) {
  if (player.labyrinth) player.labyrinth = { active: false, last: { chatId: player.labyrinth.chatId, at: Date.now() } };
  try { require('./CombatReset').clearForBattle(player); } catch (e) {}
  if (player.stats && (player.stats.hp || 0) <= 0) player.stats.hp = _max(player); // free heal on the way out
  if (!lab || !lab.members[jid]) return { ok: true, line: `🚪 You step out of the labyrinth.` };
  const m = lab.members[jid]; delete lab.members[jid];
  return { ok: true, line: `🚪 *${player.name}* leaves the labyrinth — ${m.kills} training kills, ${m.deaths} falls (all healed).` };
}
function end(db, lab, byJid, opts = {}) {
  if (!lab || !lab.active) return { ok: false, error: '❌ No labyrinth is open here.' };
  if (!opts.force && lab.leader !== byJid) return { ok: false, error: '❌ Only the labyrinth *leader* can end it (*/labyrinth end*). You can */labyrinth leave* on your own.' };
  lab.active = false; lab.endedAt = Date.now(); lab.endedBy = byJid;
  const lines = [];
  for (const [jid, m] of Object.entries(lab.members)) {
    const u = db.users && db.users[jid];
    if (u) { leave(db, lab, u, jid); }
    lines.push(`• ${u ? u.name : jid.split('@')[0]} — ${m.kills} kills · ${m.deaths} falls · +${m.xp} XP`);
  }
  lab.members = {};
  delete store(db)[lab.chatId];
  const mins = Math.max(1, Math.round((lab.endedAt - lab.openedAt) / 60000));
  return { ok: true, lines: [`🏁 *LABYRINTH CLOSED* — ${lab.guild} · ${mins} min · wave ${lab.wave} · ${lab.kills} kills`, ...lines] };
}

// ── Waves of the weakest E-rank beasts ──────────────────────────
function spawnWave(lab) {
  let pool = [];
  try { const SL = require('../data/SoloLevelingMonsters'); pool = (SL.SL_MONSTERS.E || []).filter(m => m.tier <= 1); if (!pool.length) pool = (SL.SL_MONSTERS.E || []).slice(0, 5); } catch (e) {}
  lab.monsters = [];
  for (let i = 0; i < WAVE_SIZE; i++) {
    const d = pool.length ? _pick(pool) : { name: _pick(['Training Slime', 'Straw Goblin', 'Cave Rat']), skills: ['Strike'] };
    const hp = 40 + Math.min(60, lab.wave * 3);
    lab.monsters.push({ id: i + 1, name: d.name, emoji: '🐀', rank: 'E', level: 1, stats: { hp, maxHp: hp, atk: 3 + Math.min(6, lab.wave), def: 1, speed: 60 }, abilities: (d.skills && d.skills.length ? d.skills.slice(0, 1) : ['Strike']), statusEffects: [], tempBuffs: {}, defeated: false });
  }
}
function alive(lab) { return (lab.monsters || []).filter(m => m && !m.defeated && m.stats.hp > 0); }

// One hunter action. Monsters are trivial and the room never kills for keeps: a fallen hunter is revived at full HP.
function act(db, lab, player, jid, targetId = null, skillQuery = null) {
  if (!lab || !lab.active) return { ok: false, error: '❌ No labyrinth is open here.' };
  const me = lab.members[jid]; if (!me) return { ok: false, error: '❌ Join first: */labyrinth join*.' };
  const UC = require('./UnifiedCombat'); const SC = require('./SkillCatalog');
  const lines = [];
  if ((player.stats.hp || 0) <= 0) { player.stats.hp = _max(player); player.statusEffects = []; me.deaths++; lines.push(`💫 The labyrinth mends you — *${player.name}* back at full HP (free revive).`); }
  let list = alive(lab); if (!list.length) { lab.wave++; spawnWave(lab); list = alive(lab); lines.push(`🌀 *WAVE ${lab.wave}* shuffles in — ${WAVE_SIZE} fresh training beasts.`); }
  const t = (targetId && list.find(m => String(m.id) === String(targetId))) || list[0];
  let move = { name: 'Strike', power: 100, type: 'physical' }, entry = null;
  if (skillQuery) {
    const r = SC.resolveSkill(player, skillQuery); if (!r.ok) return { ok: false, error: r.error || `❌ Unknown skill.` };
    entry = r.entry; move = { name: entry.name, power: entry.damagePct || 120, type: entry.element || 'physical' };
    const cost = Number(entry.energyCost || entry.cost || 0); if (cost && (player.stats.energy || 0) < cost) { player.stats.energy = player.stats.maxEnergy || 100; lines.push(`⚡ The labyrinth refills your energy (free).`); }
    if (cost) player.stats.energy = Math.max(0, (player.stats.energy || 0) - cost);
    if (entry.type === 'heal' || (entry.healingPct || 0) > 0 || (entry.buffs || []).length) { try { const sf = SC.applySupportFields(entry, player, player, { name: player.name }); lines.push(...sf.lines); } catch (e) {} if (entry.healingPct) { const b = player.stats.hp; player.stats.hp = Math.min(_max(player), b + Math.floor(_max(player) * entry.healingPct / 100)); lines.push(`💚 *${entry.name}*: +${player.stats.hp - b} HP (${player.stats.hp}/${_max(player)})`); } }
  }
  const res = UC.calcMoveDamage(player, t, move);
  if (!res.damage || res.missed) lines.push(`💨 *${move.name}* misses ${t.name}!`);
  else {
    t.stats.hp = Math.max(0, t.stats.hp - res.damage); me.dmg += res.damage;
    lines.push(`⚔️ *${player.name}* · *${move.name}* hits 🐀 ${t.name} [#${t.id}] for *${res.damage}*${res.crit ? ' 💥' : ''} → ${t.stats.hp}/${(()=>{try{return require('./GearSystem').effectiveMaxHp(t);}catch(e){return t.stats.maxHp;}})()}`);
    if (t.stats.hp <= 0) {
      t.defeated = true; me.kills++; lab.kills++;
      const xp = me.xp < XP_CAP_PER_SESSION ? XP_PER_KILL : 0; if (xp) { me.xp += xp; player.xp = (player.xp || 0) + xp; }
      lines.push(`☠️ ${t.name} dissolves. ${xp ? `+${xp} XP (training)` : 'no XP — session cap reached'} · wave ${lab.wave}: ${alive(lab).length}/${WAVE_SIZE} left`);
      if (!alive(lab).length) { lab.wave++; spawnWave(lab); lines.push(`🌀 *WAVE ${lab.wave}* — ${WAVE_SIZE} more training beasts step in.`); }
    }
  }
  // the beasts poke back (tiny) — they can drop you, you get back up for free next action
  const atk = alive(lab)[0];
  if (atk && (player.stats.hp || 0) > 0) {
    const dmg = Math.max(1, Math.floor(atk.stats.atk * (0.8 + Math.random() * 0.4)) - Math.floor((player.stats.def || 0) * 0.3));
    player.stats.hp = Math.max(0, player.stats.hp - dmg);
    lines.push(`🐀 ${atk.name} nips *${player.name}* for *${dmg}* → ${player.stats.hp}/${_max(player)}${player.stats.hp <= 0 ? ' — 💫 you fall (free revive on your next action, or /labyrinth heal)' : ''}`);
  }
  return { ok: true, lines };
}
function heal(lab, player, jid) {
  if (!lab || !lab.members[jid]) return { ok: false, error: '❌ You are not inside this labyrinth.' };
  player.stats.hp = _max(player); player.stats.energy = player.stats.maxEnergy || player.stats.energy || 100; player.statusEffects = [];
  return { ok: true, line: `💚 *${player.name}* fully healed and re-energised (labyrinth — free, unlimited).` };
}
function status(db, lab) {
  if (!lab || !lab.active) return null;
  const n = Object.keys(lab.members).length;
  const top = Object.entries(lab.members).sort((a, b) => b[1].kills - a[1].kills).slice(0, 5).map(([jid, m]) => `• ${(db.users && db.users[jid] && db.users[jid].name) || jid.split('@')[0]} — ${m.kills} kills`);
  return [`🧭 *LABYRINTH — ${lab.guild}*`, `Wave *${lab.wave}* · ${alive(lab).length}/${WAVE_SIZE} beasts up · ${lab.kills} kills · *${n}/${MAX_HUNTERS}* hunters · ${Math.round((Date.now() - lab.openedAt) / 60000)} min`, `Leader: ${(db.users && db.users[lab.leader] && db.users[lab.leader].name) || '?'}`, ...(top.length ? ['', ...top] : []), ``, `⚔️ /labyrinth attack [#] · /labyrinth skill <name> · 💚 /labyrinth heal · 🚪 /labyrinth leave · 🏁 /labyrinth end (leader)`].join('\n');
}

module.exports = { KEY_COST_NEXUS, WEEK_MS, MAX_HUNTERS, WAVE_SIZE, XP_PER_KILL, XP_CAP_PER_SESSION, store, get, findByMember, isMaster, keyState, buyKey, open, join, leave, end, spawnWave, alive, act, heal, status };
