// ╔══════════════════════════════════════════════════════╗
// ║         Astra — BattleRewards                      ║
// ║  Unified rewards for ALL battle wins               ║
// ║  Gives aura, BP XP, Astra Pass, general EXP        ║
// ╚══════════════════════════════════════════════════════╝
'use strict';

function isPro(player) {
  return !!(player && player.isPro && player.proExpiresAt && Date.now() < player.proExpiresAt);
}

function giveBattleWinRewards(player, db, type='generic', baseLevel=1) {
  const pro = isPro(player);
  const mult = pro ? 2 : 1;
  // Base rewards scaled by level
  const lvl = baseLevel || player.level || 1;
  let aura = (type==='pvp'? 50 : type==='dungeon'? 30 : type==='gate'? 40 : type==='worldboss'? 60 : 20) + Math.floor(lvl*1.5);
  let bp = (type==='pvp'? 100 : type==='dungeon'? 60 : type==='gate'? 80 : type==='worldboss'? 120 : 50);
  let pass = (type==='pvp'? 50 : type==='dungeon'? 30 : type==='gate'? 40 : type==='worldboss'? 60 : 25);
  let xp = (type==='pvp'? 500 : 300) + lvl*30;
  aura = Math.floor(aura * mult);
  bp = Math.floor(bp * mult);
  pass = Math.floor(pass * mult);
  xp = Math.floor(xp * mult);

  player.aura = (player.aura||0) + aura;
  // Level up aura title check via AuraSystem if available
  try { const Aura = require('./AuraSystem'); if (Aura.addAura) Aura.addAura(player, aura); } catch(e){}

  // Battle Pass XP
  try {
    const BP = require('./BattlePass');
    if (BP.addPassXP) {
      const added = BP.addPassXP(player, type+'_win', bp);
      // BP.addPassXP may return amount added or void; we still count
      player._lastBpAdded = bp;
    } else {
      player.battlePassXp = (player.battlePassXp||0)+bp;
      player._lastBpAdded = bp;
    }
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
    const res = awardXP(player, 'battle_win', null, null, null);
    // awardXP already gives XP, but we also add our scaled xp
    player.xp = (player.xp||0) + xp;
    // Also trigger level up check
    try { const LUM = require('./LevelUpManager'); LUM.checkAndApplyLevelUps(player, ()=>{}, null, null); } catch(e){}
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
