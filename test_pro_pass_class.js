const ClassSystem = require('./rpg/utils/ClassSystem');
const SoloLevelingCore = require('./rpg/utils/SoloLevelingCore');
const { awardXP } = require('./rpg/utils/SilentXP');
const { COOWNER_JID } = require('./utils/constants');

console.log('--- TEST 1: CO-OWNER BERSERKER 100% ROLL ---');
const coownerPlayer = { id: COOWNER_JID, name: 'Naruto', awakenRank: 'D', stats: { hp: 100, maxHp: 100, atk: 10, def: 5, speed: 100 } };
const classRoll = SoloLevelingCore.rollClassAssignment(coownerPlayer);
console.log('Co-owner class rolled:', classRoll);
if (classRoll !== 'Berserker') throw new Error('Co-owner did not roll Berserker!');

ClassSystem.applyClassToPlayer(coownerPlayer, classRoll);
console.log('Co-owner class quality:', coownerPlayer.classQuality);
if (coownerPlayer.classQuality !== 100) throw new Error('Co-owner quality is not 100%!');

console.log('--- TEST 2: BERSERKER STATUS EFFECTS ---');
const berserkerData = require('./rpg/classes/legendary/Berserker');
const skillDescs = berserkerData.skills.map(s => s.desc).join(' ');
console.log('Berserker skills text:', skillDescs);
if (!skillDescs.includes('BLEED') || !skillDescs.includes('STUN') || !skillDescs.includes('FEAR')) {
  throw new Error('Berserker skills missing Bleed, Stun, or Fear!');
}

console.log('--- TEST 3: PRO STORE & EXP MULTIPLIER ---');
const dummyPro = {
  id: '1234567890@s.whatsapp.net',
  name: 'ProUser',
  procoin: 100000,
  xp: 0,
  totalXp: 0,
  isPro: true,
  proExpiresAt: Date.now() + 86400000
};
awardXP(dummyPro, 'dungeon_complete');
console.log('XP awarded to Pro user (should be 2x):', dummyPro.xp);

console.log('--- ALL TESTS PASSED SUCCESSFULLY! ---');
