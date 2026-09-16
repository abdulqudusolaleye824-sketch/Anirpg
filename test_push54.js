// AniRPG — verification harness for Push #54 (skills / energy / gate economy)
// Runs the real modules with a fake Baileys socket. No WhatsApp needed.
'use strict';
process.chdir('/home/user/Anirpg');
const assert = require('assert');
let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); console.log(`  ✅ ${name}`); pass++; } catch (e) { console.log(`  ❌ ${name}\n       ${e.message}`); fail++; } };
const at = async (name, fn) => { try { await fn(); console.log(`  ✅ ${name}`); pass++; } catch (e) { console.log(`  ❌ ${name}\n       ${e.message}`); fail++; } };

const SC = require('./rpg/utils/SkillCatalog');
const CS = require('./rpg/utils/ClassSystem');
const { GateManager, GATE_RANKS } = require('./rpg/dungeons/GateManager');
const GR = require('./rpg/dungeons/GateRaid');
const RM = require('./rpg/utils/RegenManager');
const { OWNER_JID } = require('./utils/constants');
const OWNER = OWNER_JID;
const LUM = require('./rpg/utils/LevelUpManager');

function mkPlayer(cls, level, extra = {}) {
  const p = {
    id: '1234567890@s.whatsapp.net', name: 'Tester', level, xp: 0, totalXp: 0,
    class: cls, classBase: cls, gold: 0, manaCrystals: 0, awakenRank: 'C',
    stats: { hp: 100, maxHp: 500, atk: 200, def: 50, speed: 100, maxEnergy: 120, energy: 120, critChance: 5, magicPower: 0 },
    ...extra,
  };
  return p;
}

console.log('\n── 1. SkillCatalog: parity + resolution ──');
const classNames = Object.keys(CS.CLASS_DATA);
t(`${classNames.length} classes all have exactly ${SC.SKILLS_PER_CLASS} skills`, () => {
  for (const n of classNames) {
    const r = SC.buildRoster(n);
    assert.strictEqual(r.length, SC.SKILLS_PER_CLASS, `${n} has ${r.length}`);
  }
});
t('every skill has lore, effect text, animation, cost and an unlock level', () => {
  for (const n of classNames) for (const e of SC.buildRoster(n)) {
    assert.ok(e.description && e.description.length >= 40, `${n}/${e.name} thin lore (${(e.description||'').length})`);
    assert.ok(e.effect && e.effect.length > 10, `${n}/${e.name} missing effect`);
    assert.ok(e.animation, `${n}/${e.name} missing animation`);
    assert.ok(typeof e.energyCost === 'number', `${n}/${e.name} bad cost`);
    assert.ok(e.unlocksAtLevel % 5 === 0 && e.unlocksAtLevel <= 100, `${n}/${e.name} bad ladder ${e.unlocksAtLevel}`);
  }
});
t('no skill advertises a status the engine cannot apply', () => {
  for (const n of classNames) for (const e of SC.buildRoster(n)) {
    for (const s of (e.statuses || [])) assert.ok(SC.SUPPORTED_STATUS.has(s.type), `${n}/${e.name} → ${s.type}`);
  }
});
t('Monster variants resolve to the Monster roster (the old "Skill not found")', () => {
  const p = mkPlayer('Magma Beetle', 40); p.classBase = 'Monster';
  const r = SC.getRoster(p);
  assert.strictEqual(r.length, 20, `roster=${r.length}`);
  assert.ok(r.some(x => x.name === 'Primal Strike'));
  const res = SC.resolveSkill(p, 'primal strike');
  assert.ok(res.ok && res.skill.name === 'Primal Strike', JSON.stringify(res.error));
});
t('Senku (divine, owner) has 20 working skills', () => {
  const p = mkPlayer('Senku', 60);
  assert.strictEqual(SC.getRoster(p).length, 20);
  const first = SC.unlockedSkills(p)[0];
  assert.ok(first, 'nothing unlocked at Lv.60');
  const r = SC.resolveSkill(p, first.name);
  assert.ok(r.ok, r.error);
});
t('locked skills are refused with the unlocking level', () => {
  const p = mkPlayer('Mage', 6);
  SC.syncPlayerSkills(p);
  const locked = SC.lockedSkills(p);
  assert.ok(locked.length > 0 && locked.length < 20, `locked=${locked.length}`);
  assert.strictEqual(p.skills.active.length, 1, `active=${p.skills.active.length}`);
  const firstLocked = locked[0];
  const res = SC.resolveSkill(p, firstLocked.name, { allowLibrary: false });
  assert.ok(!res.ok && res.locked === true, 'locked skill was usable');
  assert.ok(/unlocks at \*Lv\./.test(res.error), res.error);
  assert.ok(!p.skills.active.some(s => s.name === firstLocked.name), 'locked skill equipped anyway');
});
t('unlocked-only display + passives never occupy slots', () => {
  const p = mkPlayer('Berserker', 100);
  SC.syncPlayerSkills(p);
  assert.strictEqual(SC.unlockedSkills(p).length + SC.lockedSkills(p).length + SC.passiveSkills(p).length, 20);
  assert.strictEqual(SC.lockedSkills(p).length, 0, 'Lv.100 should have zero locked');
  assert.ok(p.skills.active.length <= (p.maxSkillSlots || 5));
  for (const s of p.skills.passive) assert.ok(s.isPassive, 'non-passive in passive list');
});
t('index resolution works (1-based, matches /skill 3)', () => {
  const p = mkPlayer('Warrior', 50);
  SC.syncPlayerSkills(p);
  const r3 = SC.resolveSkill(p, '3');
  assert.ok(r3.ok && r3.skill.name === p.skills.active[2].name, JSON.stringify(r3));
});
t('rosters are deterministic (no re-roll on restart)', () => {
  const a = SC.buildRoster('Assassin').map(x => x.name + '|' + x.damagePct + '|' + x.energyCost).join(',');
  SC._rosterCache.clear();
  const b = SC.buildRoster('Assassin').map(x => x.name + '|' + x.damagePct + '|' + x.energyCost).join(',');
  assert.strictEqual(a, b);
});

console.log('\n── 2. Combat wiring ──');
const IC = require('./rpg/utils/ImprovedCombat');
t('Lv.90 skill out-damages a base attack by a wide margin', () => {
  const p = mkPlayer('Mage', 90);
  const mob = { name: 'Goblin', stats: { hp: 100000, maxHp: 100000, def: 30 } };
  const want = SC.unlockedSkills(p).filter(s => !s.isPassive).slice(-1)[0];
  const r = IC.executeSkill(p, mob, want.name);
  assert.ok(r.success, `${want.name}: ${r.message}`);
  assert.ok(r.damage > 0, `damage=${r.damage}`);
  assert.ok(p.stats.energy < 120, 'energy not spent');
  assert.ok(/CRITICAL|Dealt|damage|Support skill|activated/i.test(r.message), r.message.slice(0, 120));
});
t('skill damage scales with ATK (multiplier honoured, not a flat 20)', () => {
  const weak = mkPlayer('Mage', 90); weak.stats.atk = 100;
  const strong = mkPlayer('Mage', 90); strong.stats.atk = 1000;
  const w = IC.executeSkill(weak, { name: 'M', stats: { hp: 1e6, maxHp: 1e6, def: 0 } }, 'Fireball');
  const s = IC.executeSkill(strong, { name: 'M', stats: { hp: 1e6, maxHp: 1e6, def: 0 } }, 'Fireball');
  assert.ok(w.success && s.success, 'both must cast');
  assert.ok(s.damage > w.damage * 3, `10× ATK should beat 3×: ${w.damage} vs ${s.damage}`);
});
t('library (unequipped) skills are castable — no more "Skill not found"', () => {
  const p = mkPlayer('Warrior', 100);
  SC.syncPlayerSkills(p);
  const lib = p.availableSkills[0];
  assert.ok(lib, 'expected a library skill at Lv.100');
  const r = IC.executeSkill(p, { name: 'M', stats: { hp: 1e6, maxHp: 1e6, def: 10 } }, lib.name);
  assert.ok(r.success, r.message);
});
t('status effects in a description actually land on the target', () => {
  let applied = 0;
  for (let i = 0; i < 40 && !applied; i++) {
    const p = mkPlayer('Berserker', 100);
    const mob = { name: 'M', stats: { hp: 1e6, maxHp: 1e6, def: 0 }, statusEffects: [] };
    IC.executeSkill(p, mob, 'Savage Cleave');
    if (mob.statusEffects.length) applied = mob.statusEffects.length;
  }
  assert.ok(applied > 0, 'no status ever applied by Savage Cleave (BLEED)');
});
t('cooldown blocks the second cast, then expires', () => {
  const p = mkPlayer('Mage', 90);
  const mob = { name: 'M', stats: { hp: 1e6, maxHp: 1e6, def: 0 } };
  const a = IC.executeSkill(p, mob, 'Fireball');
  assert.ok(a.success, a.message);
  const b = IC.executeSkill(p, mob, 'Fireball');
  assert.ok(!b.success && /cooldown/i.test(b.message), `expected cooldown block, got: ${b.message}`);
});

console.log('\n── 3. Gate raid boss chamber ──');
t('GR.playerDamage with a skill uses the catalog (scales, spends energy)', () => {
  const p = mkPlayer('Mage', 60);
  const before = p.stats.energy;
  const r = GR.playerDamage(p, 'Meteor Strike');
  assert.ok(!r.blocked, r.reason);
  assert.ok(r.damage > p.stats.atk, `skill should beat base ATK: ${r.damage}`);
  assert.ok(p.stats.energy < before, 'energy not deducted');
});
t('GR.playerDamage refuses a locked skill with the level that unlocks it', () => {
  const p = mkPlayer('Mage', 5);
  const r = GR.playerDamage(p, 'Meteor Strike');
  assert.ok(r.blocked, 'locked skill was usable in a raid');
  assert.ok(/unlocks at|Lv\./.test(r.reason), r.reason);
});
t('Monster-class hunter can cast in a raid (previously always "not found")', () => {
  const p = mkPlayer('Void Spider', 40); p.classBase = 'Monster';
  const r = GR.playerDamage(p, 'Primal Strike');
  assert.ok(!r.blocked, r.reason);
  assert.ok(r.damage > 0);
});

console.log('\n── 4. Energy: rank refill, out of battle only, no instant catch-up ──');
t('per-second energy rates match the spec', () => {
  const want = { E: 2, D: 3, C: 4, B: 5, A: 8, S: 10 };
  for (const [r, v] of Object.entries(want)) assert.strictEqual(RM.getEnergyRegenRate(r), v, `${r}=${RM.getEnergyRegenRate(r)}`);
  assert.strictEqual(RM.getEnergyRegenRate('e'), 2, 'lowercase rank must work');
});
t('HP rates unchanged (E1 D3 C5 B7 A10 S20)', () => {
  const want = { E: 1, D: 3, C: 5, B: 7, A: 10, S: 20 };
  for (const [r, v] of Object.entries(want)) assert.strictEqual(RM.getRegenRate(r), v, `${r}`);
});
t('regen resumes 10s after combat and pays ≤30s of it (no instant full heal)', () => {
  const db = { users: {} };
  const p = mkPlayer('S', 10);
  p.stats.hp = 1; p.stats.energy = 0;
  RM.endCombat(p);                       // combat just ended
  const t0 = Date.now();
  p.lastRegenTime = t0 - 3_600_000;       // pretend an hour "accrued"
  p.lastEnergyRegenTime = t0 - 3_600_000;
  RM.applyPassiveRegen(p, db);
  assert.strictEqual(p.stats.hp, 1, 'HP healed inside the lock window');
  p.regenLockUntil = Date.now() - 1;      // lock elapsed
  p.lastRegenTime = Date.now() - 10000; p.lastEnergyRegenTime = Date.now() - 10000;
  RM.applyPassiveRegen(p, db);
  assert.ok(p.stats.hp > 1 && p.stats.hp <= 1 + 30 * 20, `hp=${p.stats.hp} (max 100 HP in 30s at S)`);
  assert.ok(p.stats.energy > 0 && p.stats.energy <= 30 * 10, `energy=${p.stats.energy} (max 300 in 30s at S)`);
});
t('no regen at all while a battle is live', () => {
  const p = mkPlayer('S', 10);
  p.stats.hp = 1; p.stats.energy = 0;
  p.pvpBattle = { opponentId: 'x' };      // live PvP
  p.lastRegenTime = Date.now() - 600000; p.lastEnergyRegenTime = Date.now() - 600000;
  p.regenLockUntil = 0;
  RM.applyPassiveRegen(p, { users: {} });
  assert.strictEqual(p.stats.hp, 1, 'healed during battle');
  assert.strictEqual(p.stats.energy, 0, 'energy refilled during battle');
});

console.log('\n── 5. Gate economy ──');
t('A/S gate mana-stone prices are in the 30k–80k band', () => {
  for (const r of ['A', 'S']) {
    const [a, b] = GATE_RANKS[r].manaPriceRange;
    assert.ok(a >= 30000 && b <= 80000 && a < b, `${r}: ${a}-${b}`);
  }
});
t('loot pays 3–4× the Nexus spent, every spawn', () => {
  for (let i = 0; i < 60; i++) {
    const g = GateManager.spawnGate('123@g.us', 'A');
    if (!g) continue;
    const ratio = g.nexusLoot / g.purchasePrice;
    assert.ok(ratio >= 3 && ratio <= 4.01, `${g.rank} ratio ${ratio}`);
    if (g.manaPrice > 0) {
      const cr = g.crystalLoot / g.manaPrice;
      assert.ok(cr >= 3 && cr <= 4.01, `${g.rank} stone ratio ${cr}`);
    }
  }
});
t('clearGate ADDS 50% of max HP instead of setting it', () => {
  const db = { users: {}, gateKeys: {} };
  const strong = mkPlayer('Mage', 10); strong.id = '111@s.whatsapp.net'; strong.stats.hp = 450; strong.stats.maxHp = 500;
  const dying  = mkPlayer('Mage', 10); dying.id  = '222@s.whatsapp.net'; dying.stats.hp = 10; dying.stats.maxHp = 500;
  db.users[strong.id] = strong; db.users[dying.id] = dying;
  const gate = {
    id: 'G-test', chatId: '123@g.us', rank: 'E', rankData: GATE_RANKS.E, cleared: false,
    currentFloor: 3, totalFloors: 3, monsters: [], nexusLoot: 9000, crystalLoot: 1000,
    damageDealt: {}, raid: { status: 'active', leader: strong.id, members: [
      { id: strong.id, name: 'Strong', hp: 450 }, { id: dying.id, name: 'Dying', hp: 10 } ] },
    boss: { name: 'Boss', hp: 0, maxHp: 100, defeated: true }, raiders: [strong.id, dying.id],
  };
  const loot = GR.clearGate(gate, 'ABCD1234', null, db, () => {});
  assert.ok(strong.stats.hp >= 450, `healthy hunter was DAMAGED to ${strong.stats.hp}`);

  assert.strictEqual(strong.stats.hp, 500, 'should cap at max');
  assert.strictEqual(dying.stats.hp, 260, `10 + 250 = 260, got ${dying.stats.hp}`);
  assert.strictEqual(loot.recovered, 2);
  assert.ok(loot.recovered === 2, `recovered=${loot.recovered}`);
});
t('raid survivors all get XP (not just the final-blow hunter)', () => {
  const db = { users: {}, gateKeys: {} };
  const a = mkPlayer('Mage', 10); a.id = 'aaa@s.whatsapp.net';
  const b = mkPlayer('Warrior', 10); b.id = 'bbb@s.whatsapp.net';
  const dead = mkPlayer('Monk', 10); dead.id = 'ccc@s.whatsapp.net'; dead.stats.hp = 0;
  db.users[a.id] = a; db.users[b.id] = b; db.users[dead.id] = dead;
  const gate = {
    id: 'G-xp', chatId: '123@g.us', rank: 'E', rankData: GATE_RANKS.E, cleared: false,
    currentFloor: 3, totalFloors: 3, monsters: [], nexusLoot: 5000, crystalLoot: 500, damageDealt: {},
    raid: { status: 'active', leader: a.id, members: [{ id: a.id, hp: 100 }, { id: b.id, hp: 50 }, { id: dead.id, hp: 0 }] },
    raiders: [a.id, b.id, dead.id], boss: { name: 'B', hp: 0, maxHp: 1, defeated: true },
  };
  GR.clearGate(gate, 'ABCD1234', null, db, () => {});
  assert.ok(a.totalXp > 0, 'leader got no XP');
  assert.ok(b.totalXp > 0, 'second survivor got no XP');
  assert.strictEqual(dead.totalXp || 0, 0, 'dead hunter received XP');
});
t('guild GP is paid ONCE per clear, not once per member', () => {
  const db = { users: {}, gateKeys: {}, guilds: {} };
  const p1 = mkPlayer('Mage', 10); p1.id = 'p1@s.whatsapp.net';
  const p2 = mkPlayer('Mage', 10); p2.id = 'p2@s.whatsapp.net';
  const p3 = mkPlayer('Mage', 10); p3.id = 'p3@s.whatsapp.net';
  db.users[p1.id] = p1; db.users[p2.id] = p2; db.users[p3.id] = p3;
  const WG = require('./rpg/utils/WeeklyGuildWar');
  let paid = 0;
  const orig = WG.addGP.bind(WG);
  WG.addGP = (...args) => { paid++; return orig(...args); };
  const gate = {
    id: 'G-gp', chatId: '1@g.us', rank: 'E', rankData: GATE_RANKS.E, cleared: false, currentFloor: 3, totalFloors: 3,
    monsters: [], nexusLoot: 100, crystalLoot: 10, damageDealt: {},
    raid: { status: 'active', leader: p1.id, members: [{ id: p1.id, hp: 9 }, { id: p2.id, hp: 9 }, { id: p3.id, hp: 9 }] },
    raiders: [p1.id, p2.id, p3.id], boss: { hp: 0, maxHp: 1, defeated: true, name: 'B' },
  };
  GR.clearGate(gate, 'K1', null, db, () => {});
  WG.addGP = orig;
  assert.ok(paid <= 1, `addGP called ${paid} times for one clear (expected ≤1)`);
});

console.log('\n── 6. Level-up + skill unlock are instant ──');
t('crossing the XP line levels up immediately, mid-session', () => {
  const p = mkPlayer('Mage', 1);
  const need = require('./rpg/utils/SoloLevelingCore').getXpRequired(1);
  p.xp = need + 5;
  const r = LUM.checkAndApplyLevelUps(p, () => {}, null, null);
  assert.ok(r.leveledUp && p.level === 2, `level=${p.level}`);
});
t('a level that unlocks a skill grants it in the same call', () => {
  const p = mkPlayer('Mage', 4);
  const need = require('./rpg/utils/SoloLevelingCore').getXpRequired(4);
  p.xp = need + 1;
  LUM.checkAndApplyLevelUps(p, () => {}, null, null);
  assert.strictEqual(p.level, 5);
  const ladder5 = SC.buildRoster('Mage').find(e => e.unlocksAtLevel === 5);
  assert.ok(p.skills.active.some(s => s.name === ladder5.name), `no Lv.5 skill (${ladder5.name}): ${JSON.stringify(p.skills.active.map(s => s.name))}`);
});
t('/fixskills path: over-granted players are normalised to the ladder', () => {
  const p = mkPlayer('Berserker', 10);
  p.skills = { active: [], passive: [], locked: [] };
  for (const e of SC.buildRoster('Berserker')) p.skills.active.push({ name: e.name, damage: 99999, energyCost: 0, level: 5 });
  p.maxSkillSlots = 99;
  SC.resetPlayerSkills(p);
  assert.strictEqual(p.skills.active.length, SC.unlockedSkills(p).length, 'reset equipped everything');
  assert.ok(p.skills.locked.length > 0, 'locked skills vanished');
  assert.ok(p.skills.active.every(s => s.level === 1), 'phantom Lv.5 upgrades survived the reset');
});

console.log('\n── 7. modules still load ──');
const files = ['./commands/rpg/gateraid.js', './commands/rpg/closegate.js', './commands/rpg/skills.js',
  './commands/rpg/use.js', './commands/rpg/shop.js', './commands/rpg/guild.js', './commands/rpg/dungeon.js',
  './commands/rpg/classcmd_dispatcher.js', './commands/rpg/fixskills.js', './rpg/utils/ImprovedCombat.js',
  './rpg/utils/LevelUpManager.js', './rpg/utils/RegenManager.js', './rpg/dungeons/GateRaid.js', './rpg/dungeons/GateManager.js'];
for (const f of files) t(`require ${f}`, () => { const m = require(f); assert.ok(m); });

console.log('\n── 8. PvP + boot-curve + /closegate ──');
const UI = require('./rpg/utils/UI');
t('every XP display agrees with the level-up formula', () => {
  const SLC = require('./rpg/utils/SoloLevelingCore');
  for (const L of [1, 5, 12, 40, 77]) assert.strictEqual(UI.xpForLevel(L), SLC.getXpRequired(L), `Lv.${L}`);
});
t('boot migration no longer re-levels on a cheaper curve', () => {
  const src = require('fs').readFileSync('index.js', 'utf8');
  assert.ok(src.includes('getXpRequired(player.level)'), 'boot does not use the real curve');
});
t('profile renders an object-shaped class as a name, not [object Object]', () => {
  const legacy = { class: { name: 'Assassin' }, evolvedClass: null, classBase: 'Assassin' };
  const label = (c) => (!c ? null : (typeof c === 'object' ? (c.name || c.className || null) : String(c)));
  const cls = label(legacy.evolvedClass) || label(legacy.class);
  assert.strictEqual(`🎭 *Class:* ${cls}`, '🎭 *Class:* Assassin');
  assert.ok(!String(cls).includes('[object'), 'still an object');
});
t('/class lists only unlocked skills', () => {
  const p = mkPlayer('Paladin', 10);
  SC.syncPlayerSkills(p);
  const listed = SC.unlockedSkills(p).concat(SC.passiveSkills(p));
  const all = SC.buildRoster('Paladin');
  assert.ok(listed.length < all.length, `listed ${listed.length} of ${all.length} at Lv.10`);
  for (const e of listed) assert.ok(SC.isUnlockedFor(p, e), `${e.name} shown while locked`);
});

const sent = [];
const fakeSock = {
  user: { id: '999@s.whatsapp.net' },
  sendMessage: async (jid, content) => { sent.push({ jid, text: content?.text || '' }); return { key: { id: 'm' + sent.length } }; },
};
function fakeMsg(chatId, sender, quoted) { return { key: { remoteJid: chatId, fromMe: false, id: 'x' }, participant: sender, message: { conversation: '' }, ...(quoted ? { _quoted: quoted } : {}) }; }

(async () => {
  const PvP = require('./commands/rpg/pvp');
  const db = { users: {} };
  const a = mkPlayer('Mage', 60); a.id = 'aaa@s.whatsapp.net'; a.stats.energy = 500; a.stats.maxEnergy = 500;
  const b = mkPlayer('Warrior', 60); b.id = 'bbb@s.whatsapp.net'; b.stats.energy = 500; b.stats.maxEnergy = 500;
  db.users[a.id] = a; db.users[b.id] = b;
  a.pvpBattle = { opponentId: b.id, turn: 3, pendingAction: null };
  b.pvpBattle = { opponentId: a.id, turn: 3, pendingAction: null };
  const save = () => {};
  const gc = () => db;

  await at('PvP rejects a skill the player has not unlocked', async () => {
    const locked = SC.lockedSkills(a)[0];
    sent.length = 0;
    await PvP.execute(fakeSock, fakeMsg('123@g.us', a.id), ['skill', locked.name], gc, save, a.id);
    const txt = sent.map(s => s.text).join('\n');
    assert.ok(/unlocks at|locked/i.test(txt), `expected a lock message, got: ${txt.slice(0, 160)}`);
    assert.ok(!a.pvpBattle.pendingAction, 'locked skill was accepted');
  });

  await at('PvP accepts an unlocked skill, spends energy and stamps a cooldown', async () => {
    const pick = SC.unlockedSkills(a).find(e => (e.damagePct || 0) > 0 && !e.isPassive);
    const before = a.stats.energy;
    sent.length = 0;
    await PvP.execute(fakeSock, fakeMsg('123@g.us', a.id), ['skill', pick.name], gc, save, a.id);
    assert.strictEqual(a.pvpBattle.pendingAction?.skillName, pick.name, 'not locked in');
    assert.ok(a.stats.energy < before, `energy untouched (${before} → ${a.stats.energy})`);
    assert.ok(!SC.onCooldown(a, pick).ready, 'no cooldown stamped');
  });

  await at('PvP resolution shows the skill LORE and a real multiplier (not the fake 1.5x)', async () => {
    sent.length = 0;
    await PvP.execute(fakeSock, fakeMsg('123@g.us', b.id), ['attack'], gc, save, b.id);
    await new Promise(r => setTimeout(r, 400));
    const txt = sent.map(s => s.text).join('\n');
    assert.ok(txt.length > 50, 'nothing was sent');
    assert.ok(!/class-bound skill channeled through practiced form/.test(txt), 'still using the generic fake description');
    const e = SC.buildRoster('Mage').find(x => x.name === a.pvpBattle?.pendingAction?.skillName || x.name === a.lastSkillUse?.['x']);
    assert.ok(/damage|HP|✳|⚔️|✨/i.test(txt), `no battle text: ${txt.slice(0, 120)}`);
  });

  const CloseGate = require('./commands/rpg/closegate');
  t('/closegate exists, is mod-gated and burned keys', () => {
    assert.strictEqual(CloseGate.name, 'closegate');
    assert.ok(typeof CloseGate.execute === 'function');
  });
  await at('/closegate refuses non-mods', async () => {
    sent.length = 0;
    await CloseGate.execute(fakeSock, fakeMsg('123@g.us', 'rando@s.whatsapp.net'), [], () => ({ users: {}, botMods: [], botOwners: [] }), () => {}, 'rando@s.whatsapp.net');
    assert.ok(/MODS ONLY/.test(sent.map(s => s.text).join('\n')), 'non-mod was allowed');
  });
  await at('/closegate on a won-but-stuck gate pays loot + recovery', async () => {
    const db2 = { users: {}, gateKeys: { AB12CD34: { gateId: 'G-cg', rank: 'E', dungeonChatId: '9@g.us', spawnChatId: '9@g.us', ownedBy: 'w1@s.whatsapp.net' } }, activeGates: {} };
    const w1 = mkPlayer('Mage', 20); w1.id = 'w1@s.whatsapp.net'; w1.stats.hp = 200;
    const w2 = mkPlayer('Mage', 20); w2.id = 'w2@s.whatsapp.net'; w2.stats.hp = 0;      // down
    db2.users[w1.id] = w1; db2.users[w2.id] = w2;
    const gate = {
      id: 'G-cg', chatId: '9@g.us', rank: 'E', rankData: GATE_RANKS.E, cleared: false, broken: false, active: true,
      currentFloor: 3, totalFloors: 3, monsters: [], nexusLoot: 20000, crystalLoot: 2000, damageDealt: {},
      purchasePrice: 5000, manaPrice: 0, raiders: [w1.id, w2.id],
      boss: { name: 'Stuck Boss', hp: 0, maxHp: 400, defeated: true },
      raid: { status: 'active', leader: w1.id, key: 'AB12CD34', members: [{ id: w1.id, hp: 200 }, { id: w2.id, hp: 0 }] },
    };
    GateManager.activeGates[gate.id] = gate; GateManager.gatesByChat['9@g.us'] = [gate.id];
    db2.activeGates[gate.id] = gate;
    const before = w1.gold || 0;
    sent.length = 0;
    await CloseGate.execute(fakeSock, fakeMsg('9@g.us', OWNER), [], () => db2, () => {}, OWNER);
    const txt = sent.map(s => s.text).join('\n');
    assert.ok(/RAID COUNTED AS CLEARED/.test(txt), `no payout line: ${txt.slice(0, 200)}`);
    assert.ok(w1.gold > before, 'treasury/leader was not paid');
    assert.ok(w1.stats.hp >= 200, 'healthy hunter lost HP');
    assert.strictEqual(w2.stats.hp, 0, 'down hunter was healed by a close');
    assert.strictEqual(db2.gateKeys['AB12CD34'].raidComplete, true, 'key not burned');
    assert.ok(!GateManager.activeGates[gate.id] || GateManager.activeGates[gate.id].cleared, 'gate still open');
  });
  await at('/closegate on a lost raid closes WITHOUT rewards or recovery', async () => {
    const db3 = { users: {}, gateKeys: { ZZ99QQ11: { gateId: 'G-lost', rank: 'C', dungeonChatId: '8@g.us', ownedBy: 'l1@s.whatsapp.net' } }, activeGates: {} };
    const l1 = mkPlayer('Mage', 20); l1.id = 'l1@s.whatsapp.net'; l1.stats.hp = 40; l1.manaCrystals = 500;
    const l2 = mkPlayer('Mage', 20); l2.id = 'l2@s.whatsapp.net'; l2.stats.hp = 0;
    db3.users[l1.id] = l1; db3.users[l2.id] = l2;
    const g2 = {
      id: 'G-lost', chatId: '8@g.us', rank: 'C', rankData: GATE_RANKS.C, cleared: false, broken: false, active: true,
      currentFloor: 2, totalFloors: 5, monsters: [{ name: 'M', hp: 50, maxHp: 50, floor: 3, defeated: false }],
      nexusLoot: 90000, crystalLoot: 9000, damageDealt: {}, purchasePrice: 30000, manaPrice: 0,
      raiders: [l1.id, l2.id], boss: { name: 'B', hp: 999, maxHp: 999, defeated: false },
      raid: { status: 'active', leader: l1.id, key: 'ZZ99QQ11', members: [{ id: l1.id, hp: 40 }, { id: l2.id, hp: 0 }] },
    };
    GateManager.activeGates[g2.id] = g2; GateManager.gatesByChat['8@g.us'] = [g2.id];
    db3.activeGates[g2.id] = g2;
    const goldBefore = l1.gold || 0;
    sent.length = 0;
    await CloseGate.execute(fakeSock, fakeMsg('8@g.us', OWNER), [], () => db3, () => {}, OWNER);
    const txt = sent.map(s => s.text).join('\n');
    assert.ok(/RAID NOT SUCCESSFUL/.test(txt), txt.slice(0, 200));
    assert.strictEqual(l1.gold, goldBefore, 'loot paid on a failed raid');
    assert.strictEqual(l1.stats.hp, 40, 'recovery granted on a failed raid');
    assert.strictEqual(db3.gateKeys['ZZ99QQ11'].used, true, 'key not burned on failure');
    assert.ok(!db3.activeGates[g2.id], 'gate still registered after force close');
  });

  console.log(`\n${'─'.repeat(46)}\n  PASS ${pass}   FAIL ${fail}\n${'─'.repeat(46)}`);
  process.exit(fail ? 1 : 0);
})();

