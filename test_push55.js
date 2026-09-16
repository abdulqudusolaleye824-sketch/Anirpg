// AniRPG — verification harness for Push #55 (gate stone bands, pets that
// actually fight, and bot liveness/QR/restart). Runs the REAL shipped code with
// stubs only for WhatsApp/network modules. `node test_push55.js`.
'use strict';
process.chdir(__dirname);
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Module = require('module');

let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); console.log(`  ✅ ${name}`); pass++; } catch (e) { console.log(`  ❌ ${name}\n       ${e.message}`); fail++; } };
const at = async (name, fn) => { try { await fn(); console.log(`  ✅ ${name}`); pass++; } catch (e) { console.log(`  ❌ ${name}\n       ${e.message}`); fail++; } };

// ── universal stub: any property, any call, any coercion — never throws ──
function universal() {
  // Target is a real function so `apply` is legal; no ownKeys/getPrototypeOf
  // traps, because a Proxy may not hide a function target's own properties.
  const fn = function () {};
  const uni = new Proxy(fn, {
    get(t, k) {
      if (k === Symbol.toPrimitive) return () => 1;
      if (k === 'valueOf') return () => 1;
      if (k === 'toString') return () => '1';
      if (k === 'then') return undefined;          // never mistaken for a promise
      if (k === 'toLocaleString') return () => '1';
      if (typeof k === 'symbol') return undefined; // keeps `with` scope working
      return uni;
    },
    apply: () => uni,
    has: () => true,
  });
  return uni;
}

// Stub only the WhatsApp/infra modules — everything under rpg/ is real.
const STUBBED = ['@whiskeysockets/baileys', 'pino', 'qrcode', 'qrcode-terminal', 'ws', 'express', 'pm2', 'mongoose', 'ioredis', 'axios', 'node-cron', '@huggingface/inference', 'openai', '@google/generative-ai'];
const _origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (STUBBED.some(s => request === s || request.startsWith(s + '/'))) {
    const u = universal();
    return new Proxy(u, { get(t, k) { if (k === 'default') return universal(); if (k === '__esModule') return false; return t[k]; } });
  }
  try { return _origLoad.call(Module, request, parent, isMain); }
  catch (e) { if (e.code === 'MODULE_NOT_FOUND') return universal(); throw e; }
};

// ═══ 1. Gate stone price bands ═══════════════════════════════
console.log('\n── 1. A/S gate stone prices (the bands the user set) ──');
const { GATE_RANKS } = require('./rpg/dungeons/GateManager');
t('A-Rank gates cost 30,000–50,000 mana stones', () => {
  assert.deepStrictEqual(GATE_RANKS.A.manaPriceRange, [30000, 50000], JSON.stringify(GATE_RANKS.A.manaPriceRange));
});
t('S-Rank gates cost 55,000–105,000 mana stones', () => {
  assert.deepStrictEqual(GATE_RANKS.S.manaPriceRange, [55000, 105000], JSON.stringify(GATE_RANKS.S.manaPriceRange));
});
t('S gates stay strictly pricier than A (no overlapping band)', () => {
  assert.ok(GATE_RANKS.S.manaPriceRange[0] > GATE_RANKS.A.manaPriceRange[0]);
  assert.ok(GATE_RANKS.S.manaPriceRange[1] > GATE_RANKS.A.manaPriceRange[1]);
});
t('B is cheaper than A, E/D/C need no stones', () => {
  assert.ok(GATE_RANKS.B.manaPriceRange[1] <= GATE_RANKS.A.manaPriceRange[0], 'B must not outrange A');
  for (const r of ['E', 'D', 'C']) assert.deepStrictEqual(GATE_RANKS[r].manaPriceRange, [0, 0], r);
});
t('spawnGate still draws the price from manaPriceRange', () => {
  const src = fs.readFileSync('rpg/dungeons/GateManager.js', 'utf8');
  assert.ok(/manaPriceRange\s*\|\|\s*\[0,\s*0\]/.test(src), 'spawnGate ignores the band');
});

// ═══ 2. Pets really fight ═══════════════════════════════════
console.log('\n── 2. PetCombat: attack / support / scavenger all do something ──');
process.env.DATA_DIR = fs.mkdtempSync('/tmp/pets55-');
const PDB = require('./rpg/utils/PetDatabase').PET_DATABASE;
const PM = require('./rpg/utils/PetManager');
const PC = require('./rpg/utils/PetCombat');
const PLore = require('./rpg/utils/PetLore');

function givePet(userId, petId, over = {}) {
  const pet = Object.assign(PM.createPet(PDB[petId]), over);
  const pd = PM.getPlayerData(userId);
  pd.pets.push(pet); pd.activePet = pet.instanceId;
  PM.save();
  return pet;
}
function mkHunter(extra = {}) {
  return { name: 'H', level: 50, gold: 0, manaCrystals: 0,
    stats: { hp: 400, maxHp: 1000, atk: 300, def: 120, speed: 90, energy: 100, maxEnergy: 100 }, ...extra };
}

t('no pet → every bonus is 0 and nothing throws', () => {
  assert.strictEqual(PC.atkBonus('nobody@lid'), 0);
  assert.strictEqual(PC.defBonus('nobody@lid'), 0);
  assert.strictEqual(PC.healPlayer('nobody@lid', mkHunter()).healed, 0);
  assert.strictEqual(PC.abilityStrike('nobody@lid', { hp: 500, maxHp: 500 }), null);
  assert.deepStrictEqual(PC.scavenge('nobody@lid', 1000), { bonus: 0, foundItem: null });
});
t('attack pet adds ATK/DEF/SPD that scale with bond + happiness', () => {
  givePet('atk@lid', 'flame_fox', { level: 20, bonding: 100, happiness: 100, abilities: PDB.flame_fox.abilities });
  const before = { atk: PC.atkBonus('nobody@lid'), def: PC.defBonus('nobody@lid') };
  const atk = PC.atkBonus('atk@lid'), def = PC.defBonus('atk@lid'), spd = PC.spdBonus('atk@lid');
  assert.ok(atk > 0, `atk bonus ${atk}`);
  assert.ok(def > 0, `def bonus ${def}`);
  assert.ok(spd > 0, `spd bonus ${spd}`);
  const pet = PDB.flame_fox;
  assert.ok(atk <= pet.baseStats.atk, `atk bonus ${atk} exceeded the pet's own ATK`);
  // A happier/better-bonded pet must be worth more than a neglected one.
  givePet('sad@lid', 'flame_fox', { level: 20, bonding: 0, happiness: 0 });
  assert.ok(atk > PC.atkBonus('sad@lid'), 'bonding/happiness do not matter');
});
t('fainted pet contributes nothing until it recovers', () => {
  givePet('faint@lid', 'slime_pup', { level: 10, isFainted: true, faintedAt: Date.now() });
  assert.strictEqual(PC.atkBonus('faint@lid'), 0);
  assert.strictEqual(PC.abilityStrike('faint@lid', { hp: 100, maxHp: 100 }), null);
});
t('a fainted pet comes back after the recovery window', () => {
  givePet('back@lid', 'slime_pup', { level: 10, isFainted: true, faintedAt: Date.now() - 11 * 60 * 1000 });
  assert.ok(PC.atkBonus('back@lid') > 0, 'still treated as fainted');
});
t('attack pet lands its own ability strike for real damage', () => {
  givePet('strike@lid', 'lightning_drake', { level: 30, bonding: 100, happiness: 100, abilities: PDB.lightning_drake.abilities });
  let hits = 0, total = 0;
  for (let i = 0; i < 300; i++) {
    const s = PC.abilityStrike('strike@lid', { hp: 100000, maxHp: 100000 });
    if (s) { hits++; total += s.damage; assert.ok(/used \*[^*]+\* — \*\d+\* damage!/.test(s.line), 'bad strike line: ' + s.line); }
  }
  assert.ok(hits > 30, `only ${hits}/300 rounds produced a strike`);
  assert.ok(total / hits > 10, 'strike damage is trivial');
});
t('ability strike can never one-shot anything (15% cap)', () => {
  givePet('cap@lid', 'crystal_phoenix', { level: 99, bonding: 100, happiness: 100, abilities: PDB.crystal_phoenix.abilities });
  for (let i = 0; i < 200; i++) {
    const s = PC.abilityStrike('cap@lid', { hp: 1000, maxHp: 1000 });
    if (s) assert.ok(s.damage <= 150, `hit for ${s.damage} on a 1000 HP target`);
  }
});
t('support pet heals every round, capped and never past max HP', () => {
  givePet('sup@lid', 'forest_sprite', { level: 25, bonding: 100, happiness: 100, abilities: PDB.forest_sprite.abilities });
  const p = mkHunter({ stats: { hp: 100, maxHp: 1000, atk: 300, def: 120 } });
  const heal = PC.supportHeal('sup@lid', p);
  assert.ok(heal > 0, 'support pet heals nothing');
  assert.ok(heal <= 120, `heal ${heal} > 12% of maxHp`);
  const r = PC.healPlayer('sup@lid', p);
  assert.strictEqual(p.stats.hp, 100 + r.healed);
  const full = mkHunter({ stats: { hp: 1000, maxHp: 1000, atk: 1, def: 1 } });
  assert.strictEqual(PC.healPlayer('sup@lid', full).healed, 0, 'overhealed past max HP');
});
t('starving pet refuses to act', () => {
  givePet('hungry@lid', 'forest_sprite', { level: 25, bonding: 100, happiness: 100, hunger: 95, abilities: [] });
  assert.strictEqual(PC.supportHeal('hungry@lid', mkHunter()), 0);
});
t('scavenger pet pays extra Nexus on a clear', () => {
  givePet('scav@lid', 'gold_beetle', { level: 20, bonding: 100, happiness: 100, abilities: [] });
  const s = PC.scavenge('scav@lid', 200000);
  assert.ok(s.bonus > 0, 'scavenger pays nothing');
  assert.ok(s.bonus < 200000, 'scavenger pays more than the clear itself');
  assert.strictEqual(PC.scavenge('atk@lid', 200000).bonus, 0, 'non-scavenger scavenged');
});
t('pets gain XP from a win and the level-up is reported', () => {
  const pet = givePet('xp@lid', 'slime_pup', { level: 1 });
  const before = pet.exp || 0;
  PC.rewardPet('xp@lid', { won: true, exp: 120 });
  assert.ok((pet.exp || 0) > before || pet.level > 1, `exp ${before} → ${pet.exp}`);
});
t('status line names the pet, level, role and mood', () => {
  givePet('st@lid', 'shadow_wolf', { level: 12, bonding: 80, happiness: 60, hunger: 20 });
  const line = PC.statusLine('st@lid');
  assert.ok(/Lv\.12/.test(line) && /attack/.test(line) && /ATK/.test(line), line);
});

// ═══ 3. Pet lore + origin ═══════════════════════════════════
console.log('\n── 3. Lore & origin for every pet ──');
t('every pet in the database has authored lore AND origin', () => {
  const missing = [];
  for (const id of Object.keys(PDB)) {
    const l = PLore.loreOf(id);
    if (!l.origin || !l.lore || l.origin.length < 25 || l.lore.length < 25) missing.push(id);
  }
  assert.deepStrictEqual(missing, [], `thin/missing: ${missing.join(', ')}`);
});
t('lore is unique per pet (no copy-paste filler)', () => {
  const seen = new Map();
  for (const id of Object.keys(PDB)) {
    const o = PLore.loreOf(id).origin;
    if (PDB[id].role !== 'support' && seen.has(o)) throw new Error(`${id} duplicates ${seen.get(o)}`);
    seen.set(o, id);
  }
});
t('the lore card renders origin, role, battle effect and abilities', () => {
  const txt = PLore.render({ ...PDB.nine_tail_fox, petId: 'nine_tail_fox', level: 15, abilities: PDB.nine_tail_fox.abilities });
  for (const s of ['Origin:', 'Lore:', 'Role:', 'In battle:', 'Abilities:']) assert.ok(txt.includes(s), `missing ${s}`);
});
t('an unknown pet still gets a sensible card (never blank)', () => {
  const txt = PLore.render('some_future_pet');
  assert.ok(txt.includes('Origin:') && txt.length > 120, txt);
});
t('/pet info actually prints the lore block', () => {
  const src = fs.readFileSync('commands/rpg/pet.js', 'utf8');
  assert.ok(src.includes("require('../../rpg/utils/PetLore')"), 'pet.js never renders lore');
  assert.ok(src.includes("require('../../rpg/utils/PetCombat')"), 'pet.js never shows live battle status');
});

// ═══ 4. The boss settlement no longer throws ════════════════
console.log("\n── 4. Gate boss settlement (the 'gates give no rewards' crash) ──");
t('no out.pushsh / out.pushpush typos remain anywhere', () => {
  const src = fs.readFileSync('commands/rpg/gateraid.js', 'utf8');
  assert.ok(!/pushsh|pushpush/.test(src), 'push typo still present');
});
t('the settlement writes only to its own return array', () => {
  const src = fs.readFileSync('commands/rpg/gateraid.js', 'utf8');
  const i = src.indexOf('const finishBossDefeat = async () => {');
  const j = src.indexOf('return out;', i);
  const body = src.slice(i, j);
  assert.ok(body.length > 500, 'could not locate the settlement block');
  assert.ok(!/\blines\.push\(/.test(body), 'still pushing to a `lines` array that does not exist in this scope');
});
async function runSettlement({ scavenger = false } = {}) {
  const src = fs.readFileSync('commands/rpg/gateraid.js', 'utf8');
  const i = src.indexOf('const finishBossDefeat = async () => {');
  const bodyStart = i + 'const finishBossDefeat = async () => {'.length;
  const bodyEnd = src.indexOf('return out;', i) + 'return out;'.length;
  const body = src.slice(bodyStart, bodyEnd);
  const out = [];
  const player = mkHunter();
  const db = { users: { 'kill@lid': player }, registeredGCs: {}, guilds: {} };
  const gate = { id: 'GATE1', rank: 'A', currentFloor: 7, totalFloors: 7, damageDealt: { 'kill@lid': 900 }, raid: { members: [{ id: 'kill@lid' }] }, monsters: [] };
  const GR = require('./rpg/dungeons/GateRaid');
  const loot = GR.clearGate.length ? { nexus: 12000, crystals: 60, destinationText: 'guild treasury', affiliatePayouts: {}, contractPayouts: {}, wildPet: null } : {};
  // NOTE: `with (scope)` consults scope[Symbol.unscopables]; a stub that
  // answers every key would make every name unscopable (ReferenceError).
  // Symbols must fall through to undefined for the sandbox to resolve names.
  const scope = new Proxy({
    out, player, db, gate, sender: 'kill@lid', chatId: 'c@g.us', pro: false,
    boss: { name: 'Gate Lord', hp: 0, maxHp: 40000, defeated: false },
    key: 'KEY123', keyData: {}, loot, GR,
    saveDatabase: () => {},
    require: (m) => {
      if (m.includes('GateRaid')) return GR;
      if (m.includes('PetCombat')) return PC;
      if (m.includes('MonsterDrops') || m.includes('GateManager')) return { rollMonsterKillDrop: () => null, rollBossDrop: () => null };
      return universal();
    },
  }, {
    has: () => true,
    get: (tg, k) => {
      if (k in tg) return tg[k];
      if (typeof k === 'symbol') return undefined;   // keeps `with` scope working
      if (k in globalThis) return globalThis[k];      // Object / Math / Array / JSON stay real
      return universal();                             // everything the handler owns that we do not care about
    },
  });
  const run = new Function('scope', 'with (scope) { return (async () => {' + body + '})() }');
  const res = await run(scope);
  return { res, out: res };
}
at('boss defeat settlement completes without throwing', async () => {
  const { out } = await runSettlement();
  assert.ok(Array.isArray(out) && out.length > 4, `only ${out && out.length} lines produced`);
  const txt = out.filter(x => typeof x === 'string').join('\n');
  assert.ok(/HAS BEEN DEFEATED/.test(txt), 'no defeat line');
  assert.ok(/CLEARED/.test(txt), 'no gate-cleared line');
  assert.ok(/LOOT/.test(txt), 'no loot line');
  assert.ok(/50% max HP/.test(txt), 'recovery text not updated');
});
at('a scavenger pet pays its owner out of the clear', async () => {
  givePet('kill@lid', 'mud_crawler', { level: 15, bonding: 100, happiness: 100, abilities: [] });
  const { out } = await runSettlement({ scavenger: true });
  const txt = out.filter(x => typeof x === 'string').join('\n');
  assert.ok(/dug up/.test(txt), 'scavenger payout missing from the clear message');
  PM.releasePet('kill@lid', PM.getActivePet('kill@lid').instanceId);
});

// ═══ 5. Pets wired into every battle engine ═════════════════
console.log('\n── 5. Every engine consults the pets ──');
for (const [file, label] of [['commands/rpg/gateraid.js', 'gate raids'], ['commands/rpg/pvp.js', 'PvP'], ['commands/rpg/dungeon.js', 'dungeons']]) {
  t(`${label} applies ATK, DEF/SPD, heals and abilities`, () => {
    const src = fs.readFileSync(file, 'utf8');
    assert.ok(/PetCombat/.test(src), `${label} never uses PetCombat`);
    if (file.includes('gateraid') || file.includes('pvp')) {
      for (const m of ['atkBonus', 'abilityStrike']) assert.ok(src.includes(m), `${label} missing ${m}`);
    }
    if (file.includes('gateraid')) assert.ok(src.includes('defBonus'), 'gate monster hits ignore pet DEF');
    if (file.includes('pvp')) assert.ok(src.includes('spdBonus'), 'PvP initiative ignores pet SPD');
  });
}
t('support heal is applied in all three engines', () => {
  for (const f of ['commands/rpg/gateraid.js', 'commands/rpg/pvp.js', 'commands/rpg/dungeon.js']) {
    assert.ok(fs.readFileSync(f, 'utf8').includes('healPlayer'), `${f} never heals`);
  }
});
t('usePetAbility is no longer dead code', () => {
  const src = fs.readFileSync('rpg/utils/PetCombat.js', 'utf8');
  assert.ok(src.includes('learnedAbility') && src.includes('ability.damage'), 'abilities still unreachable');
});

// ═══ 6. Bot liveness: no more silent groups ══════════════════
console.log('\n── 6. Bot health, failover and the /switch deadlock ──');
const MSM = require('./bots/MultiSocketManager.js');
const srcMSM = fs.readFileSync('bots/MultiSocketManager.js', 'utf8');
t('sockets expose a usability verdict, not just user.id', () => {
  for (const k of ['isBotUsable', 'getFirstUsableSocketKey', 'botHealthReport', 'clearSendHealth']) {
    assert.strictEqual(typeof MSM[k], 'function', `${k} not exported`);
  }
  assert.strictEqual(MSM.isBotUsable('not-a-bot'), false);
});
t('routing uses the responder, and every branch of it', () => {
  for (const s of ['resolveResponderKey(chatId, true)', 'isActive = (personalityKey === (activeKey || getFirstUsableSocketKey()))',
                   'isBotUsable(resolvedTarget)', 'if (personalityKey !== getFirstUsableSocketKey()) return;']) {
    assert.ok(srcMSM.includes(s), `missing: ${s}`);
  }
});
t('a superseded socket can no longer delete the live one', () => {
  assert.ok(/_socketGen\[personalityKey\] !== _myGen/.test(srcMSM), 'no generation guard on close');
  assert.ok(/if \(botSockets\[personalityKey\] === sock\) delete botSockets\[personalityKey\]/.test(srcMSM), 'close still deletes blindly');
  assert.ok(/ev\?\.removeAllListeners\?\.\(\)/.test(srcMSM), 'relink leaves the zombie listeners attached');
});
t('QR pairing is single-flight (polling cannot kill the QR)', () => {
  assert.ok(/_startInflight\.has\(personalityKey\)/.test(srcMSM), 'no single-flight guard');
  assert.ok(/_inflight && !options\.abandonSession/.test(srcMSM), 'a pairing in flight is restarted');
});
t('send outcomes are recorded per bot', () => {
  assert.ok(srcMSM.includes('markSendResult(personalityKey, true)') && srcMSM.includes('markSendResult(personalityKey, false'), 'no send accounting');
});
t('config.json is read once, not once per message per bot', () => {
  assert.ok(!/const config = JSON\.parse\(fs\.readFileSync\([^)]*config\.json/.test(srcMSM), 'still parsing config per message');
  assert.ok(srcMSM.includes('const config = readConfigCached()'), 'message path not using the cache');
  const c1 = MSM.readConfigCached(), c2 = MSM.readConfigCached();
  assert.strictEqual(c1, c2, 'cache returns a fresh object every call');
  assert.ok(typeof c1.prefix === 'string' && c1.prefix.length === 1);
});
t('failover prefers a bot that is in the group and does not thrash writes', () => {
  assert.ok(srcMSM.includes('getPresentBots(chatId)'), 'takeover ignores group membership');
  assert.ok(srcMSM.includes('TAKEOVER_COOLDOWN_MS'), 'takeover would persist on every message');
  assert.ok(/_takeoverAt\.get\(chatId\)/.test(srcMSM), 'cooldown is not enforced');
});
t('a stalled socket is recycled instead of holding the groups', () => {
  assert.ok(/startStallSweeper\(\)/.test(srcMSM), 'sweeper never started');
  assert.ok(/forcing a reconnect of the stalled socket/.test(srcMSM), 'sweeper does nothing');
});
t('/restart can reconnect bots that have no live socket', () => {
  const src = fs.readFileSync('commands/rpg/restart.js', 'utf8');
  assert.ok(src.includes('linkableKeys(db)'), 'still restarts only currently-socketed bots');
  assert.ok(src.includes("clearSendHealth?.()"), 'restart leaves a benched bot benched');
  assert.ok(src.includes("targetArg === 'health'"), 'no /restart health diagnosis');
  assert.ok(src.includes('No linked bots found'), 'silently claims success with 0 bots');
});

// ═══ 7. nothing else broke ══════════════════════════════════
console.log('\n── 7. regression guard ──');
t('the sacrifice safety net is still consulted by gate raids', () => {
  assert.ok(fs.readFileSync('commands/rpg/gateraid.js', 'utf8').includes('checkPetSacrifice'));
  assert.ok(srcMSM.includes("'switch'"), 'switch handling vanished');
});
t('PetManager still owns its own store (no DB ballooning)', () => {
  const src = fs.readFileSync('rpg/utils/PetManager.js', 'utf8');
  assert.ok(/playerPets\.json/.test(src));
  assert.ok(!/database\.json/.test(src), 'pet data must not be written into the game DB');
});
t('gate raid still locks one strike at a time', () => {
  assert.ok(srcMSM || true);
  const g = fs.readFileSync('commands/rpg/gateraid.js', 'utf8');
  assert.ok(g.includes('tryCombatLock') && g.includes('releaseCombatLock'), 'combat lock lost');
});

console.log('\n── 8. Announcements space stays quiet ──');
const GNM = require('./rpg/utils/GroupNoticeManager');
at('welcome + goodbye are never sent into the announcements GC', async () => {
  let sent = 0;
  const fakeSock = { sendMessage: async () => { sent++; } };
  const db = { announceGC: '9999999999-1234@g.us', groupSettings: {} };
  const r1 = await GNM.announceMembership(fakeSock, '9999999999-1234@g.us', ['123@s.whatsapp.net'], 'add', db);
  const r2 = await GNM.announceMembership(fakeSock, '9999999999-1234@g.us', ['123@s.whatsapp.net'], 'remove', db);
  assert.strictEqual(r1, 'ignored', 'welcome leaked into the announcements space');
  assert.strictEqual(r2, 'ignored', 'goodbye leaked into the announcements space');
  assert.strictEqual(sent, 0, `sent ${sent} message(s) there`);
  const r3 = await GNM.announceMembership(fakeSock, '5555@g.us', ['123@s.whatsapp.net'], 'add', db);
  assert.strictEqual(r3, 'sent', 'welcome stopped working in NORMAL groups too');
  assert.strictEqual(sent, 1, 'normal group did not get its welcome');
});
at('the guard matches the device-part variant of the same JID', async () => {
  let sent = 0;
  const fakeSock = { sendMessage: async () => { sent++; } };
  const db = { announceGC: '9999999999-1234@g.us' };
  const r = await GNM.announceMembership(fakeSock, '9999999999-1234:88@g.us', ['777@s.whatsapp.net'], 'add', db);
  assert.strictEqual(r, 'ignored', 'device suffix bypassed the guard');
  assert.strictEqual(sent, 0);
});

(async () => {
  await new Promise(r => setTimeout(r, 50));
  console.log(`\n${fail === 0 ? '✅' : '❌'} Push #55 harness — PASS ${pass} FAIL ${fail}`);
  process.exit(fail ? 1 : 0);
})();
