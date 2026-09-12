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
function giveBattleWinRewards(player, db, type='generic', baseLevel=1, sock=null, chatId=null) {
  const pro = isPro(player);
  const mult = pro ? 2 : 1;
  // Base rewards scaled by level
  const lvl = baseLevel || player.level || 1;
  let aura = (type==='pvp'? 50 : type==='dungeon'? 30 : type==='gate'? 40 : 20) + Math.floor(lvl*1.5);
  // NOTE: bp stays BASE — BattlePass.addPassXPAmount applies Pro x premium
  // (1x/2x/4x) inside. (Pre-doubling here paid Pro+premium 8x — fixed.)
  let bp = (type==='pvp'? 100 : type==='dungeon'? 60 : type==='gate'? 60 : 50);
  let pass = (type==='pvp'? 50 : type==='dungeon'? 30 : type==='gate'? 40 : 25);
  let xp = (type==='pvp'? 500 : 300) + lvl*30;
  aura = Math.floor(aura * mult);
  pass = Math.floor(pass * mult);
  xp = Math.floor(xp * mult);

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

  return { aura, bp, pass, xp, pro, mult };
}

function formatRewards(win) {
  const proTag = win.pro ? ' 🌟 PRO 2×' : '';
  return [
    `🌀 Aura: +${win.aura}${win.pro?' (2×)':''}`,
    `🎖️ Battle Pass XP: +${win.bp}${win.pro?' (2×)':''}`,
    `🌟 Astra Pass: +${win.pass}${win.pro?' (2×)':''}`,
    `✨ XP: +${win.xp}${win.pro?' (2×)':''} (general)`,
  ].join('\n') + proTag;
}

module.exports = { giveBattleWinRewards, formatRewards, isPro };
