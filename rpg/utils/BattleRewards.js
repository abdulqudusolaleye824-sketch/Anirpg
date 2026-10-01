// ╔══════════════════════════════════════════════════════╗
// ║         Astra — BattleRewards                      ║
// ║  Unified rewards for ALL battle wins               ║
// ║  Gives aura, BP XP, Astra Pass, general EXP        ║
// ╚══════════════════════════════════════════════════════╝
'use strict';

function isPro(player) {
  return !!(player && player.isPro && player.proExpiresAt && Date.now() < player.proExpiresAt);
}

// Batch-41: optional (sock, chatId) so class awakening + level-ups ANNOUNCE
// on this path instead of firing silently (callers that have no channel
// omit them — rewards are unaffected).
function giveBattleWinRewards(player, db, type='generic', baseLevel=1, sock=null, chatId=null, opts={}) {
  const pro = isPro(player);
  const mult = pro ? 2 : 1;
  // Push #88t: aura gain in gate raids cut by 50%; opts.auraMult overrides.
  const auraMult = Number.isFinite(opts.auraMult) ? opts.auraMult : (type === 'gate' ? 0.5 : 1);
  // Base rewards scaled by level
  const lvl = baseLevel || player.level || 1;
  let aura = (type==='pvp'? 50 : type==='dungeon'? 30 : type==='gate'? 40 : 20) + Math.floor(lvl*1.5);
  // NOTE: bp stays BASE — BattlePass.addPassXPAmount applies Pro x premium
  // (1x/2x/4x) inside. (Pre-doubling here paid Pro+premium 8x — fixed.)
  let bp = (type==='pvp'? 100 : type==='dungeon'? 60 : type==='gate'? 60 : 50);
  let pass = (type==='pvp'? 50 : type==='dungeon'? 30 : type==='gate'? 40 : 25);
  let xp = (type==='pvp'? 500 : 300) + lvl*30;
  aura = Math.floor(aura * mult * auraMult);
  pass = Math.floor(pass * mult);
  xp = Math.floor(xp * mult);
  try { xp = Math.floor(xp * require('./AuraSystem').AuraSystem.expMult(player)); } catch (e) {} // Push #96f: aura title EXP%
  // Push #95: Dungeon Delver XP / Bounty Hunter reward multipliers + Job XP.
  let jobLine = '';
  try {
    const JS = require('./JobSystem'); const jm = JS.mods(player);
    if (jm.xpMult) xp = Math.floor(xp * (1 + jm.xpMult / 100));
    if (jm.rewardMult) { aura = Math.floor(aura * (1 + jm.rewardMult / 100)); pass = Math.floor(pass * (1 + jm.rewardMult / 100)); }
    const jr = JS.gainXp(player, JS.xpFor(type) * (opts.boss ? 2 : 1), type + '_win');
    if (jr) {
      player._lastJobXp = jr.gained;
      if (jr.levelUp) {
        jobLine = `🧭 *JOB LEVEL UP!* ${jr.name} → Job Lv.${jr.to} — *${jr.title}*`;
        if (sock && chatId) { try { sock.sendMessage(chatId, { text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🧭 *JOB LEVEL UP!*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n👤 *${player.name}* — ${jr.name} reached *Job Lv.${jr.to}*\n⭐ New Job Level: *${jr.title}*\n_${(JS.BY_KEY[player.job.key] || {}).lore?.[jr.to - 1] || ''}_\n${JS.describeMods(JS.BY_KEY[player.job.key], jr.to).join('\n')}` }).catch(() => {}); } catch (e) {} }
      }
    }
  } catch (e) {}

  // Aura with title routing — use addRawAura so title thresholds are checked cleanly
  try {
    const { AuraSystem } = require('./AuraSystem');
    const res = AuraSystem.addRawAura(player, aura, type+'_win');
    // addRawAura already updated aura & title; ensure we don't double add
    // If addRawAura failed, fallback manual
    if (!res || typeof res.newTotal !== 'number') throw new Error('no res');
  } catch(e) {
    player.aura = (player.aura||0) + aura;
    try { const { AuraSystem:AS2 } = require('./AuraSystem'); AS2.getAuraTitle(player.aura); } catch(e2){}
  }

  // Battle Pass XP (direct amount — the old call multiplied by the source
  // table for pvp (150×bp!) and granted ZERO for dungeon/gate
  // because those '<type>_win' sources don't exist in XP_SOURCES)
  try {
    const BP = require('./BattlePass');
    if (BP.addPassXPAmount) BP.addPassXPAmount(player, bp);
    else player.battlePassXp = (player.battlePassXp||0)+bp;
    player._lastBpAdded = bp;
  } catch(e){
    player.battlePassXp = (player.battlePassXp||0)+bp;
    player._lastBpAdded = bp;
  }

  // Astra Pass
  try {
    const AP = require('./AstraPass');
    if (AP.addPassXP) AP.addPassXP(player, pass);
    else player.astraPassXp = (player.astraPassXp||0)+pass;
  } catch(e){
    player.astraPassXp = (player.astraPassXp||0)+pass;
  }
  player._lastPassAdded = pass;

  // General EXP via SilentXP
  try {
    const { awardXP } = require('./SilentXP');
    const res = awardXP(player, 'battle_win', null, sock, chatId);
    // awardXP already gives XP, but we also add our scaled xp
    player.xp = (player.xp||0) + xp;
    // Also trigger level up check
    try { const LUM = require('./LevelUpManager'); LUM.checkAndApplyLevelUps(player, ()=>{}, sock, chatId); } catch(e){}
  } catch(e){
    player.xp = (player.xp||0)+xp;
  }
  player._lastAuraAdded = aura;
  player._lastXpAdded = xp;

  return { aura, bp, pass, xp, pro, mult, jobLine, jobXp: player._lastJobXp || 0 };
}

function formatRewards(win) {
  const proTag = win.pro ? ' 🌟 PRO 2×' : '';
  return [
    `🌀 Aura: +${win.aura}${win.pro?' (2×)':''}`,
    `🎖️ Battle Pass XP: +${win.bp}${win.pro?' (2×)':''}`,
    `🌟 Astra Pass: +${win.pass}${win.pro?' (2×)':''}`,
    `✨ XP: +${win.xp}${win.pro?' (2×)':''} (general)`,
    win.jobXp ? `🧭 Job XP: +${win.jobXp}` : null,
  ].filter(Boolean).join('\n') + proTag;
}

// Push #88t: GENERAL EXP ONLY (no aura / pass / BP) — paid to every other
// raid member when a monster or boss falls. Same XP formula as the killer.
function giveSharedExp(player, type='gate', baseLevel=1, sock=null, chatId=null) {
  const pro = isPro(player);
  const mult = pro ? 2 : 1;
  const lvl = baseLevel || player.level || 1;
  let xp = Math.floor(((type==='pvp'? 500 : 300) + lvl*30) * mult);
  try { xp = Math.floor(xp * require('./AuraSystem').AuraSystem.expMult(player)); } catch (e) {} // Push #96f
  try { const JS = require('./JobSystem'); const jm = JS.mods(player); if (jm.xpMult) xp = Math.floor(xp * (1 + jm.xpMult / 100)); JS.gainXp(player, JS.xpFor('kill'), 'shared'); } catch (e) {} // Push #95: party members earn Job XP too
  player.xp = (player.xp||0) + xp;
  try { const LUM = require('./LevelUpManager'); LUM.checkAndApplyLevelUps(player, ()=>{}, sock, chatId); } catch(e){}
  return { xp, pro };
}
// Push #88t: pay shared EXP to every ALIVE raid member except `killerJid`.
// Returns one summary line ('' when nobody else is in the raid).
function shareRaidExp(gate, killerJid, db, sock=null, chatId=null) {
  try {
    const GKM = require('../dungeons/GateKeyManager');
    const norm = (j) => { try { return GKM.normaliseJid(j); } catch (e) { return String(j||'').split('@')[0].split(':')[0]; } };
    const members = (gate && gate.raid && Array.isArray(gate.raid.members)) ? gate.raid.members : [];
    const killer = norm(killerJid);
    const paid = [];
    for (const m of members) {
      if (!m || !m.id || norm(m.id) === killer) continue;
      if (m.dead || m.left || (typeof m.hp === 'number' && m.hp <= 0)) continue;
      const u = (db && db.users && (db.users[m.id] || Object.values(db.users).find(x => x && x.jid && norm(x.jid) === norm(m.id)))) || null;
      if (!u) continue;
      const r = giveSharedExp(u, 'gate', u.level || 1, sock, chatId);
      paid.push(`${u.name || m.name || norm(m.id)} +${r.xp}${r.pro ? ' (2×)' : ''}`);
    }
    return paid.length ? `✨ *Party EXP:* ${paid.join(' · ')}` : '';
  } catch (e) { return ''; }
}
// Push #96h-m: FLOOR-GATE XP — clearing a floor pays XP that scales with the floor and the gate
// rank, committed straight to the profile (level-ups applied by the caller).
const FLOOR_RANK_MULT = { F: 0.8, E: 1, D: 1.5, C: 2.2, B: 3.2, A: 4.5, S: 6, SS: 8 };
function floorXp(floor, rank) { return Math.floor((250 + Math.max(1, floor) * 180) * (FLOOR_RANK_MULT[String(rank || 'E').toUpperCase()] || 1)); }
function grantFloorXp(player, floor, rank) {
  if (!player) return 0; let xp = floorXp(floor, rank);
  try { xp = Math.floor(xp * require('./AuraSystem').AuraSystem.expMult(player)); } catch (e) {}
  try { const JS = require('./JobSystem'); const jm = JS.mods ? JS.mods(player) : {}; if (jm && jm.xpMult) xp = Math.floor(xp * (1 + jm.xpMult / 100)); } catch (e) {}
  player.xp = (player.xp || 0) + xp; player.lifetimeXp = (player.lifetimeXp || 0) + xp; return xp;
}
module.exports = { floorXp, grantFloorXp, FLOOR_RANK_MULT, giveBattleWinRewards, formatRewards, isPro, giveSharedExp, shareRaidExp };
