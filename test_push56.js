// AniRPG — verification harness for Push #56
// (awakening lore drama, a /reset that really resets, guild roster + shop
//  packages, quiz buttons, pinterest dedupe, scroll balance, GW victory card)
'use strict';
process.chdir(__dirname);
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');

let pass = 0, fail = 0;
const t = (n, f) => { try { f(); console.log(`  ✅ ${n}`); pass++; } catch (e) { console.log(`  ❌ ${n}\n       ${e.message}`); fail++; } };
const PENDING = [];
// Async cases are collected and awaited before the verdict — a fire-and-forget
// promise plus a synchronous process.exit at the end of the file silently
// SKIPS every real-command test and still prints a green total.
const at = (n, f) => { PENDING.push((async () => { try { await f(); console.log(`  ✅ ${n}`); pass++; } catch (e) { console.log(`  ❌ ${n}\n       ${e.message}`); fail++; } })()); };

function universal() {
  const fn = function () {};
  const uni = new Proxy(fn, {
    get(tg, k) {
      if (k === Symbol.toPrimitive) return () => 1;
      if (k === 'valueOf') return () => 1;
      if (k === 'toString') return () => '1';
      if (k === 'toLocaleString') return () => '1';
      if (k === 'then') return undefined;
      if (typeof k === 'symbol') return undefined;
      return uni;
    },
    apply: () => uni,
    has: () => true,
  });
  return uni;
}
const STUBBED = ['@whiskeysockets/baileys', 'pino', 'qrcode', 'qrcode-terminal', 'ws', 'express', 'pm2', 'mongoose', 'ioredis', 'axios', 'node-cron', 'openai', '@google/generative-ai', '@huggingface/inference'];
const _origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (STUBBED.some((s) => request === s || request.startsWith(s + '/'))) return universal();
  try { return _origLoad.call(Module, request, parent, isMain); }
  catch (e) { if (e.code === 'MODULE_NOT_FOUND') return universal(); throw e; }
};

const T = '111@s.whatsapp.net', M = '222@s.whatsapp.net', O = '333@s.whatsapp.net';
function mkSock() {
  const sent = [];
  return { sent, sendMessage: async (jid, content, opts) => { sent.push({ jid, ...content }); return { key: { id: 'm' + sent.length } }; } };
}
function hunter(over = {}) {
  return {
    name: 'H', level: 100, class: 'Mage', gold: 1e7, manaCrystals: 1e5, awakenRank: 'A',
    stats: { hp: 1000, maxHp: 1000, atk: 500, def: 200, speed: 120, energy: 100, maxEnergy: 100, critChance: 10 },
    inventory: { items: [], healthPotions: 0 }, titles: [], ...over,
  };
}

// ═══ 1. Awakening lore drama ════════════════════════════════
console.log('\n── 1. Awakening: every class gets its lore drama ──');
const Drama = require('./rpg/utils/AwakeningDrama');
const CS = require('./rpg/utils/ClassSystem');
const CLASSES = Object.keys(CS.CLASS_DATA);
t(`${CLASSES.length} classes all have authored awakening drama for all three tiers`, () => {
  for (const c of CLASSES) {
    assert.ok(Drama.CLASS_DRAMA[c], `${c} has no drama entry`);
    for (const tier of [1, 2, 3]) {
      const d = Drama.CLASS_DRAMA[c][tier === 1 ? 'trial' : tier === 2 ? 'mantle' : 'apex'];
      assert.ok(d && d.length >= 80, `${c} tier ${tier} is thin (${(d || '').length} chars)`);
    }
  }
});
t('no two classes share the same trial text', () => {
  const seen = new Map();
  for (const c of CLASSES) {
    const txt = Drama.CLASS_DRAMA[c].trial;
    if (seen.has(txt)) throw new Error(`${c} duplicates ${seen.get(txt)}`);
    seen.set(txt, c);
  }
});
t('every class has an evolved form for the second awakening', () => {
  const missing = CLASSES.filter((c) => !Drama.evolvedName({ class: c }, c));
  assert.deepStrictEqual(missing, [], `no evolution: ${missing.join(', ')}`);
});
t('Monster variants get monster lore keyed on classBase', () => {
  const p = { name: 'Rex', class: 'Magma Beetle', classBase: 'Monster' };
  assert.strictEqual(Drama.classKey(p), 'Monster');
  const msgs = Drama.buildDrama({ player: p, tier: 1, className: 'Magma Beetle' });
  assert.ok(/moult/i.test(msgs.join(' ')), 'monster lore not used');
  assert.ok(/Magma Beetle/.test(msgs.join(' ')), 'variant name not shown');
  assert.strictEqual(Drama.evolvedName(p), 'Apex Form');
});
t('the drama is MULTIPLE messages, not one wall of text', () => {
  for (const c of CLASSES) {
    const m1 = Drama.buildDrama({ player: { name: 'X', class: c }, tier: 1, className: c });
    const m2 = Drama.buildDrama({ player: { name: 'X', class: c }, tier: 2, className: c });
    assert.ok(m1.length >= 2, `${c} tier1 = ${m1.length} msg`);
    assert.ok(m2.length >= 3, `${c} tier2 = ${m2.length} msg (metamorphosis missing)`);
    for (const m of [...m1, ...m2]) assert.ok(m.length < 1600, `${c} message too long for WhatsApp: ${m.length}`);
  }
});
t('an unknown class falls back instead of rendering empty', () => {
  const msgs = Drama.buildDrama({ player: { name: 'Y', class: 'Frost Yeti', classBase: 'Monster' }, tier: 1, className: 'Frost Yeti' });
  assert.ok(msgs.length >= 2 && msgs[1].includes('TRIAL OF'), 'no fallback trial');
});
at('/awaken confirm sends the card AND the lore as separate messages (real module)', async () => {
  const db = { users: { 'p@lid': hunter({ class: 'Healer', awakenTier: 1, stats: { hp: 100, maxHp: 1000, atk: 1, def: 1, speed: 1, energy: 1, maxEnergy: 10 } }) } };
  const sock = mkSock();
  const cmd = require('./commands/rpg/awaken.js');
  await cmd.execute(sock, { key: { remoteJid: 'g@g.us' }, message: {} }, ['confirm'], () => db, () => {}, 'p@lid');
  const all = sock.sent.map((s) => s.text).join('\n\n');
  assert.ok(sock.sent.length >= 3, `only ${sock.sent.length} message(s) sent`);
  const p = db.users['p@lid'];
  assert.strictEqual(p.awakenTier, 2, 'tier not applied');
  assert.strictEqual(p.evolvedClass, 'Life Saint', `Healer did not evolve (${p.evolvedClass})`);
  assert.ok(/SECOND SEAL/i.test(all), 'rite message missing');
  assert.ok(/TRIAL OF HEALER/i.test(all), 'class trial missing');
  assert.ok(/METAMORPHOSIS/i.test(all), 'metamorphosis message missing');
  assert.strictEqual(p.awakenings.length, 1, 'awakening not recorded for /profile');
  assert.strictEqual(p.gold, 1e7 - 500000, 'Nexus cost wrong');
  assert.strictEqual(p.manaCrystals, 1e5 - 5000, 'Mana Stone cost wrong');
});

// ═══ 2. /reset — a wipe that actually wipes ════════════════
console.log('\n── 2. /reset: full wipe, guild deleted, members freed ──');
const R = require('./commands/rpg/reset.js').__test;
function fixtureDb() {
  return {
    users: {
      [T]: { name: 'Owner', guild: 'Iron Vows', weeklyGP: 500, totalGP: 900 },
      [M]: { name: 'Mem', guild: 'Iron Vows', weeklyGP: 50, totalGP: 70 },
      [O]: { name: 'Other', guild: 'Other Guild', weeklyGP: 5, totalGP: 1000 },
    },
    guilds: {
      g1: { id: 'g1', name: 'Iron Vows', leader: T, members: [T, M], memberData: [{ id: T, name: 'Owner', rank: 'Guild Master' }, { id: M, name: 'Mem', rank: 'Member' }], weeklyGP: 550, totalGP: 970, guildPoints: 970, gpLog: [{ by: T, amount: 500 }], contracts: [] },
      g2: { id: 'g2', name: 'Other Guild', leader: O, members: [{ id: O, rank: 'Guild Master' }, { id: T, rank: 'Officer' }], memberData: [{ id: O, name: 'Other' }, { id: T, name: 'Owner', rank: 'Officer' }], weeklyGP: 100, totalGP: 1000, guildPoints: 1000 },
    },
    guildInvites: { [T]: { guildId: 'g1' }, [M]: { guildId: 'g1' } },
    guildContracts: { c1: { guildId: 'g1', hireJid: T } },
    dailyQuests: { [T]: { done: 1 }, [M]: { done: 2 } },
    userCooldowns: { [T]: { x: 1 } },
    gateSpawns: { gg: { owner: M, raiders: [T, M], raid: { members: [{ id: T }, { id: M }] }, damageDealt: { [T]: 9, [M]: 4 } } },
    parties: { p1: { leader: M, members: [T, M] } },
    pendingChallenges: { c9: { challenger: T, target: M } },
    pendingTrades: { t1: { from: T, to: M } },
    mutedUsers: { [`g1@g.us_${T}`]: { until: 1 } },
    banlist: { [T]: { reason: 'x' } },
    linkedBots: { kira: '1234@s.whatsapp.net' },
  };
}
t('an OWNER reset deletes the guild and makes every member guildless', () => {
  const db = fixtureDb(); const log = [];
  const snap = R.wipeGuilds(db, T, R.jidVariants(T), log);
  assert.ok(!db.guilds.g1, 'the owned guild survived');
  assert.strictEqual(db.users[M].guild, null, 'a member still points at the deleted guild');
  assert.ok(snap.owned.length === 1 && snap.owned[0].freed.length === 2, 'undo snapshot of freed members incomplete');
  assert.ok(log.some((l) => /made guildless/.test(l)), `log: ${log.join(';')}`);
});
t('a MEMBER reset wipes them out of the guild and re-derives its GP', () => {
  const db = fixtureDb(); const log = [];
  R.wipeGuilds(db, T, R.jidVariants(T), log);
  const g2 = db.guilds.g2;
  assert.ok(!g2.members.some((m) => R.norm(m && m.id ? m.id : m) === '333' || (m && m.id) === T), 'still on the roster');
  assert.ok(!g2.memberData.some((m) => m.id === T), 'still in memberData');
  assert.strictEqual(g2.totalGP, 1000, `GP total ${g2.totalGP} should exclude the wiped member (their 1000 lifetime GP was theirs)`);
  assert.ok(g2.members.length === 1 && g2.memberData.length === 1, 'roster length wrong');
});
t('a reset deletes BOTH shapes of roster entry (jid strings and {id} objects)', () => {
  const db = fixtureDb(); const log = [];
  db.guilds.g3 = { name: 'Mixed', leader: O, members: [M, { id: T, rank: 'Officer' }], memberData: [{ id: T }], weeklyGP: 0, totalGP: 0, guildPoints: 0 };
  R.wipeGuilds(db, T, R.jidVariants(T), log);
  assert.deepStrictEqual(db.guilds.g3.members.map((m) => (m && m.id) || m), [M], 'object-shaped entry survived');
  assert.deepStrictEqual(db.guilds.g3.memberData, [], 'memberData entry survived');
});
t('everything else that referenced the player is scrubbed, moderation is not', () => {
  const db = fixtureDb(); const log = [];
  const variants = R.jidVariants(T);
  R.wipeGuilds(db, T, variants, log);
  delete db.users[T];
  R.wipeLiveSessions(db, variants, log);
  R.scrubCollections(db, variants, log);
  assert.ok(!db.guildInvites[T] && !db.guildInvites[M], 'guild invites survived');
  assert.ok(!db.guildContracts.c1, 'contract to the deleted player survived');
  assert.ok(!db.dailyQuests[T], 'daily quests survived');
  assert.ok(!db.parties.p1.members.includes(T), 'still in the party');
  assert.ok(!db.gateSpawns.gg.raiders.includes(T), 'ghost raider still holding the gate');
  assert.ok(!db.pendingChallenges.c9 && !db.pendingTrades.t1, 'pending challenge/trade survived');
  assert.ok(Object.keys(db.mutedUsers).length === 1, 'moderation mute wiped (must survive)');
  assert.ok(db.banlist[T], 'ban list wiped (must survive)');
  assert.ok(db.linkedBots.kira, 'bot link records must never be touched');
  assert.ok(db.users[O], 'an unrelated player was collateral damage');
});
t('every per-player side file is swept, not just three hard-coded names', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'reset56-'));
  process.env.DATA_DIR = tmp;
  const dir = path.join(tmp, 'rpg_data'); fs.mkdirSync(dir, { recursive: true });
  const files = {
    'playerPets.json': { [T]: { pets: [1] }, [M]: { pets: [2] } },
    'playerQuests.json': { [T]: { q: 1 } },
    'craftData.json': { [T]: { c: 1 }, [M]: { c: 2 } },
    'someNewStore.json': { [T]: { x: 1 } },
  };
  for (const [f, body] of Object.entries(files)) fs.writeFileSync(path.join(dir, f), JSON.stringify(body));
  const variants = R.jidVariants(T);
  const snap = R.snapshotSideFiles(variants);
  const removed = R.wipeSideFiles(variants);
  assert.strictEqual(removed, 4, `removed ${removed}`);
  const pets = JSON.parse(fs.readFileSync(path.join(dir, 'playerPets.json'), 'utf8'));
  assert.ok(!pets[T] && pets[M], 'wrong player removed from pet store');
  assert.ok(!('someNewStore.json' in {}) && !JSON.parse(fs.readFileSync(path.join(dir, 'someNewStore.json'), 'utf8'))[T], 'new side file missed');
  fs.writeFileSync(path.join(dir, 'playerPets.json'), JSON.stringify({}));
  R.restoreSideFiles(snap);
  assert.ok(JSON.parse(fs.readFileSync(path.join(dir, 'playerPets.json'), 'utf8'))[T], 'restore did not put pets back');
});
t('no dangling reference to the wiped player survives anywhere in the db', () => {
  const db = fixtureDb(); const log = [];
  const variants = R.jidVariants(T);
  R.wipeGuilds(db, T, variants, log);
  delete db.users[T];
  R.wipeLiveSessions(db, variants, log);
  R.scrubCollections(db, variants, log);
  const copy = JSON.parse(JSON.stringify(db));
  delete copy.userResetBackups; delete copy.mutedUsers; delete copy.banlist; delete copy.modResetCooldowns;
  const str = JSON.stringify(copy);
  assert.ok(!str.includes(T), 'a live reference to the wiped player remains: ' + str.match(new RegExp('.{40}' + T.replace(/[.]/g, '\\.'), ''))?.[0]);
});
at('/reset end-to-end: wipes the user, deletes their guild, reports it, and /reset restore undoes it', async () => {
  const db = fixtureDb();
  db.users[T].stats = { hp: 1, maxHp: 1, atk: 1, def: 1 };
  const sock = mkSock();
  const cmd = require('./commands/rpg/reset.js');
  const msg = { key: { remoteJid: 'g@g.us' }, message: { extendedTextMessage: { text: `/reset @${M.split('@')[0]}`, contextInfo: {} } } };
  // owner resets M? M is a member of g1 owned by T → member path. Use T as owner via a self-targeting tag:
  const msgOwner = { key: { remoteJid: 'g@g.us' }, message: { extendedTextMessage: { text: '/reset x', contextInfo: { mentionedJid: [T] } } } };
  db.botMods = [M]; db.botOwners = [M];
  await cmd.execute(sock, msgOwner, ['@111'], () => db, () => {}, M);
  const txt = sock.sent.map((s) => s.text).join('\n');
  assert.ok(!db.users[T], 'player row survived /reset');
  assert.ok(!db.guilds.g1, 'owned guild survived /reset');
  assert.strictEqual(db.users[M].guild, null, 'members were not made guildless');
  assert.ok(/PLAYER DATA RESET/.test(txt), 'no confirmation card');
  assert.ok(/deleted/i.test(txt) && /guildless|made guildless/i.test(txt), `report does not mention the guild: ${txt.slice(0,200)}`);
  assert.ok(db.userResetBackups[T].guilds.owned.length === 1, 'guild snapshot missing from the backup');
  // restore
  sock.sent.length = 0;
  await cmd.execute(sock, { key: { remoteJid: 'g@g.us' }, message: { extendedTextMessage: { text: '/reset restore', contextInfo: { mentionedJid: [T] } } } }, ['restore', '@111'], () => db, () => {}, M);
  assert.ok(db.users[T], 'restore did not bring the player back');
  assert.ok(db.guilds.g1, 'restore did not re-create the guild');
  assert.strictEqual(db.users[M].guild, 'Iron Vows', 'restore did not re-point the members');
  assert.ok(/RESTORED/i.test(sock.sent.map((s) => s.text).join('\n')), 'no restore message');
});
t('the mod cooldown still blocks a second wipe in the same week', async () => {
  const db = fixtureDb();
  db.botOwners = [M];
  db.modResetCooldowns = { [M]: Date.now() };
  const sock = mkSock();
  const cmd = require('./commands/rpg/reset.js');
  await cmd.execute(sock, { key: { remoteJid: 'g@g.us' }, message: { extendedTextMessage: { contextInfo: { mentionedJid: [O] } } } }, [], () => db, () => {}, M);
  assert.ok(/Cooldown/.test(sock.sent[0].text), 'cooldown not enforced');
  assert.ok(db.users[O], 'player wiped despite the cooldown');
});

// ═══ 3. Guild roster, packages, and the shop ═══════════════
console.log('\n── 3. /guild members, sealed packages, shop purchases ──');
t('/guild members shows guild rank AND the hunter rank', () => {
  const src = fs.readFileSync('commands/rpg/guild.js', 'utf8');
  assert.ok(src.includes("🏅 Guild Rank"), 'no guild rank in the roster');
  assert.ok(src.includes('Hunter:'), 'no hunter awaken rank in the roster');
  assert.ok(src.includes('memberData'), 'memberData (where ranks live) is ignored');
  assert.ok(/sort\(\(a, b\) =>/.test(src), 'roster is unordered (GM/GP sort missing)');
});
t('/guild leave removes a member whichever shape the roster uses', () => {
  const src = fs.readFileSync('commands/rpg/guild.js', 'utf8');
  assert.ok(!/members\.filter\(m => m\.id !== sender\)/.test(src), 'leave still compares m.id against a JID-string roster');
  assert.ok(src.includes("if (Array.isArray(playerGuild.memberData))"), 'memberData not cleaned on leave');
});
t('/guild disband frees the roster instead of orphaning it', () => {
  const src = fs.readFileSync('commands/rpg/guild.js', 'utf8');
  assert.ok(/has been disbanded/.test(src) && src.includes('now guildless'), 'members are not told/re-set');
  assert.ok(src.includes('db.users[jid].guild = null'), 'player.guild not cleared on disband');
});
t('sealed package → attack pattern lands in /attacks (real module)', () => {
  const S = require('./rpg/utils/SealedPackages');
  const p = hunter();
  const pkg = S.seal({ id: 'pattern_shadow', name: "Shadow Strike", type: 'pattern', currency: 'gold', basePrice: 100000 }, { from: 'Guild Shop', price: 90000 });
  assert.ok(!pkg.pkg.patternId, 'pattern id should be rolled by the shop');
  pkg.pkg.patternId = S.rollPatternId('A', []);
  p.inventory.items.push(pkg);
  const res = S.openAndConsume(p, pkg);
  assert.ok(res.ok, res.error);
  assert.strictEqual(p.attackPatterns.owned.length, 1, 'pattern not added to attackPatterns.owned');
  assert.deepStrictEqual(p.attackPatterns.equipped, p.attackPatterns.owned, 'not auto-equipped');
  assert.strictEqual(p.inventory.items.length, 0, 'package was not consumed');
  const { generateAttack } = require('./rpg/utils/AttackPatternDB');
  const atk = generateAttack(p.attackPatterns.owned[0]);
  assert.ok(atk && atk.rank === 'A', `rolled pattern is ${atk && atk.rank}-Rank, not A`);
});
t('a package never duplicates an owned pattern and rolls a fresh number', () => {
  const S = require('./rpg/utils/SealedPackages');
  const p = hunter(); p.attackPatterns = { owned: [], equipped: [] };
  const ids = [];
  for (let i = 0; i < 4; i++) {
    const pkg = S.seal({ id: 'pattern_dragon', name: "Dragon's Breath", type: 'pattern' }, {});
    pkg.pkg.patternId = S.rollPatternId('B', p.attackPatterns.owned);
    p.inventory.items.push(pkg);
    S.openAndConsume(p, pkg);
    ids.push(pkg.pkg.patternId);
  }
  assert.strictEqual(new Set(ids).size, 4, `duplicate pattern numbers: ${ids}`);
  assert.strictEqual(p.attackPatterns.owned.length, 4);
});
t('a scroll box always yields a readable scroll, whatever case the rarity came in', () => {
  const S = require('./rpg/utils/SealedPackages');
  for (const rarity of ['rare', 'Rare', 'mythic', 'nonsense', undefined]) {
    const p = hunter();
    const r = S.open(p, S.seal({ type: 'scroll', name: 'Recipe Scroll', rarity }, {}));
    const sc = p.inventory.scrolls[0];
    assert.ok(r.ok && sc && sc !== null, `rarity ${rarity}: nothing delivered`);
    assert.ok(sc.key, `rarity ${rarity}: scroll has no craft key`);
    assert.ok(!p.inventory.scrolls.some((x) => x === null || x === undefined), `rarity ${rarity}: null pushed into scrolls`);
  }
});
t('potions route to inventory counters, scrolls to /scroll, stats to stats', () => {
  const S = require('./rpg/utils/SealedPackages');
  const p = hunter();
  const r1 = S.open(p, S.seal({ key: 'mediumHealthPotions', name: 'Medium Health Potion', type: 'potion' }, {}));
  assert.strictEqual(p.inventory.mediumHealthPotions, 1, JSON.stringify(r1));
  const r2 = S.open(p, S.seal({ type: 'scroll', name: 'Rare Scroll', rarity: 'rare' }, {}));
  assert.strictEqual(p.inventory.scrolls.length, 1, 'scroll not delivered');
  const r3 = S.open(p, S.seal({ type: 'stat', stat: 'atk', amount: 25, name: '+25 ATK' }, {}));
  assert.strictEqual(p.stats.atk, 525, `stat not applied (${p.stats.atk})`);
  const r4 = S.open(p, S.seal({ type: 'ticket', amount: 3, name: 'Summon Tickets' }, {}));
  assert.strictEqual(p.summonTickets, 3, 'tickets not credited');
  assert.ok(r1.ok && r2.ok && r3.ok && r4.ok, 'a route reported failure');
});
at('END-TO-END through the real commands: buy → /items row → /equip use → /attacks', async () => {
  const gpath = './commands/rpg/guild.js';
  const guild = require(gpath);
  const T2 = '7788@s.whatsapp.net';
  const player = hunter({
    guild: 'Iron Vows', attackPatterns: { owned: [1], equipped: [1] },
    inventory: { items: [], scrolls: [], healthPotions: 0 },
  });
  const db = {
    users: { [T2]: player },
    guilds: { g1: { id: 'g1', name: 'Iron Vows', leader: T2, members: [T2], memberData: [{ id: T2, name: 'H', rank: 'Guild Master' }], guildPoints: 500000, level: 5, shopLevel: 2 } },
    groupSettings: {}, registeredGCs: { 'g@g.us': {} },
  };
  const sock = mkSock();
  const M = { key: { remoteJid: 'g@g.us' }, message: {} };
  await guild.execute(sock, M, ['shop'], () => db, () => {}, T2);
  const today = db.guilds.g1.dailyShop;
  if (!today.items.some((i) => i.type === 'pattern')) {
    // ensureGuildShopFresh re-rolls anything that is not exactly 10 rows
    today.items = [{ id: 'pattern_shadow', name: 'Shadow Strike', category: 'Attack Patterns', type: 'pattern', currency: 'gold', basePrice: 100000, description: 'x', unitsLeft: 5, maxUnits: 5 }, ...today.items.slice(0, 9)];
  }
  const goldBefore = player.gold;
  sock.sent.length = 0;
  await guild.execute(sock, M, ['shop', 'buy', 'pattern_shadow'], () => db, () => {}, T2);
  const receipt = sock.sent.map((s2) => s2.text).join('\n');
  assert.ok(/GUILD SHOP PURCHASE/.test(receipt), `no receipt: ${receipt.slice(0, 120)}`);
  assert.ok(/Sealed in your inventory/.test(receipt) && /equip use <#>/.test(receipt), 'receipt does not say the box must be opened');
  assert.match(receipt, /Attack pattern \*#(\d+)\*/, 'receipt does not name the pattern inside');
  const promised = Number(receipt.match(/Attack pattern \*#(\d+)\*/)[1]);
  assert.strictEqual(player.gold, goldBefore - 90000, '10% guild discount not applied');
  assert.strictEqual(player.inventory.items.length, 1, 'no package in the inventory');
  assert.deepStrictEqual(player.attackPatterns.owned, [1], 'content granted before the box was opened');
  assert.ok(!player.inventory.patterns, 'the dead inventory.patterns list was written to');

  const items = require('./commands/rpg/items.js');
  sock.sent.length = 0;
  await items.execute(sock, M, [], () => db, () => {}, T2);
  const listing = sock.sent.map((s2) => s2.text).join('\n');
  assert.ok(/📦.*Sealed Shadow Strike Package/.test(listing), 'the box is not listed in /items');

  const equip = require('./commands/rpg/equip.js');
  sock.sent.length = 0;
  await equip.execute(sock, M, ['use', '1'], () => db, () => {}, T2);
  const opened = sock.sent.map((s2) => s2.text).join('\n');
  assert.ok(/PACKAGE OPENED/.test(opened), 'opening produced no confirmation');
  assert.ok(player.attackPatterns.owned.includes(promised), `the promised pattern #${promised} never reached /attacks (${JSON.stringify(player.attackPatterns)})`);
  assert.strictEqual(player.inventory.items.length, 0, 'the box was NOT consumed — reopenable for infinite patterns');

  // /attacks really lists it, and the box cannot be reopened
  const attacks = require('./commands/rpg/attacks.js');
  sock.sent.length = 0;
  await attacks.execute(sock, M, [], () => db, () => {}, T2);
  assert.ok(sock.sent.map((s2) => s2.text).join('\n').includes(String(promised)), 'the new pattern is not shown by /attacks');
  const ownedAfter = player.attackPatterns.owned.length;
  const again = require('./rpg/utils/SealedPackages').openAndConsume(player, { name: 'Sealed Shadow Strike Package' });
  assert.ok(!again.ok || player.attackPatterns.owned.length === ownedAfter, 'a phantom box still produced a pattern');
});
t('one box, one pattern — the stacked /items row cannot be reopened', () => {
  const S = require('./rpg/utils/SealedPackages');
  const it = require('./commands/rpg/items.js');
  const p = hunter({ inventory: { items: [] }, attackPatterns: { owned: [], equipped: [] } });
  for (let i = 0; i < 3; i++) {
    const pkg = S.seal({ id: 'pattern_shadow', name: 'Shadow Strike', type: 'pattern' }, {});
    pkg.pkg.patternId = S.rollPatternId('A', []);
    p.inventory.items.push(pkg);
  }
  for (let i = 0; i < 6; i++) {
    const row = it._buildList(p).find((r) => r.isSealedPackage);
    if (!row) break;
    assert.ok(row !== p.inventory.items[0] || i === 0, 'buildList handed back the stored object');
    S.openAndConsume(p, row);
  }
  assert.strictEqual(p.attackPatterns.owned.length, 3, `3 boxes produced ${p.attackPatterns.owned.length} patterns`);
  assert.strictEqual(p.inventory.items.length, 0, 'boxes were not consumed');
});
t('the guild shop seals instead of faking a pattern into inventory.patterns', () => {
  const src = fs.readFileSync('commands/rpg/guild.js', 'utf8');
  assert.ok(src.includes('SealedPackages'), 'guild shop does not use the package system');
  assert.ok(!src.includes("player.inventory.patterns.push"), 'still pushing patterns into a dead list');
  assert.ok(/equip use <#>/.test(src), 'the receipt does not tell the player how to open it');
});
t('/equip use opens a sealed package by inventory number', () => {
  const src = fs.readFileSync('commands/rpg/equip.js', 'utf8');
  assert.ok(src.includes('isSealedPackage'), '/equip use cannot open packages');
  assert.ok(src.includes('openAndConsume'), 'package is not consumed on open');
});
at('/shop buy scroll debits the wallet the player can actually see', async () => {
  const shop = require('./commands/rpg/shop.js');
  const p = hunter({ manaCrystals: 400000, manaStones: 0, level: 5 }); // stale legacy field present
  const before = p.manaCrystals;
  const db = { users: { [T]: p }, settings: {} };
  const sock = mkSock();
  await shop.execute(sock, { key: { remoteJid: 'g@g.us' }, message: {} }, ['buy', 'scroll', 'sc1'], () => db, () => {}, T);
  const txt = sock.sent.map((s) => s.text).join('\n');
  const cost = require('./rpg/utils/CraftingSystem').SCROLL_SHOP_ITEMS ? 0 : null;
  assert.ok(p.inventory.scrolls.length === 1, `scroll not delivered: ${txt.slice(0, 160)}`);
  assert.ok(p.inventory.scrolls[0] && p.inventory.scrolls[0].key, 'a null/ownerless scroll was pushed into the inventory');
  assert.ok(p.manaCrystals < before, 'the real Mana Stone wallet was never debited (free scroll)');
  assert.strictEqual(p.manaStones, p.manaCrystals, 'legacy mirror left out of sync');
});
t('a broke player is refused with the balance they can see', () => {
  const src = fs.readFileSync('commands/rpg/shop.js', 'utf8');
  assert.ok(/_stoneBalance\(player\)/.test(src), 'scroll purchase does not read the resolved wallet');
  assert.ok(src.includes('/balance shows your live wallet'), 'refusal does not point at /balance');
});

// ═══ 4. Games: quiz buttons + pinterest memory ═════════════
console.log('\n── 4. /quiz buttons and /pinterest memory ──');
const Buttons = require('./utils/buttons');
t('Buttons.sendList builds a real tappable list with one row per option', async () => {
  const sock = mkSock();
  const r = await Buttons.sendList(sock, 'g@g.us', { text: 'Q?', buttonText: '🎯 Answer', rows: [{ id: '/a A', title: 'A' }, { id: '/a B', title: 'B' }] });
  assert.strictEqual(r.mode, 'list');
  const msg = sock.sent[0];
  assert.ok(msg.list && msg.list.sections[0].rows.length === 2, 'rows missing');
  assert.strictEqual(msg.list.buttonText, '🎯 Answer');
  assert.deepStrictEqual(msg.list.sections[0].rows.map((x) => x.rowId), ['/a A', '/a B'], 'taps do not send the answer command');
});
t('/quiz drops the question with the button list FIRST and keeps fallbacks', () => {
  const src = fs.readFileSync('commands/rpg/quiz.js', 'utf8');
  const i = src.indexOf('const _rows = _letters.map');
  assert.ok(i > 0, 'no per-option rows built');
  assert.ok(src.indexOf('Buttons.sendList') < src.indexOf('Buttons.sendButtons'), 'native quick-replies still tried first');
  assert.ok(src.includes("if (!sent) await sock.sendMessage(session.chatId, { text });"), 'plain fallback removed');
  assert.ok(/id: `\/a \$\{L\}`/.test(src), 'row ids are not answer commands');
});
t('a list tap lands in the answer path through the message parser', () => {
  const msm = fs.readFileSync('bots/MultiSocketManager.js', 'utf8');
  assert.ok(msm.includes('listResponseMessage?.singleSelectReply?.selectedRowId'), 'the bot does not read list taps as text');
});
t('/pinterest never repeats an image for the same query, then rotates', () => {
  const P = require('./commands/rpg/pinterest.js');
  const db = {};
  const pool = ['a.jpg', 'b.jpg', 'c.jpg'];
  assert.deepStrictEqual(P._filterUnseen(db, 'Gojo', pool).urls, pool, 'first search filtered');
  P._rememberShown(db, 'gojo', ['a.jpg']);
  assert.deepStrictEqual(P._filterUnseen(db, 'GOJO ', pool).urls, ['b.jpg', 'c.jpg'], 'repeat image not suppressed');
  P._rememberShown(db, 'gojo', ['b.jpg', 'c.jpg']);
  const third = P._filterUnseen(db, 'gojo', pool);
  assert.strictEqual(third.recycled, true, 'exhausted pool did not restart the rotation');
  assert.deepStrictEqual(third.urls, pool, 'rotation produced nothing');
  assert.ok(P._rememberShown(db, 'x', Array.from({ length: 200 }, (_, i) => 'u' + i + '.jpg')) <= 151, 'per-query memory not bounded');
});

// ═══ 5. Weekly Guild War victory card ══════════════════════
console.log('\n── 5. GW victory card: awarded AND announced ──');
at('resolveWeeklyWar returns a podium whose cards were really granted', async () => {
  const W = require('./rpg/utils/WeeklyGuildWar');
  const db = {
    users: { a: { name: 'Ada', weeklyGP: 300 }, b: { name: 'Bo', weeklyGP: 200 }, c: { name: 'Cy', weeklyGP: 50 } },
    guilds: {
      g1: { name: 'Iron Vows', members: ['a'], weeklyGP: 300 },
      g2: { name: 'Ashborn', members: ['b'], weeklyGP: 200 },
      g3: { name: 'Cinders', members: ['c'], weeklyGP: 50 },
    },
    guildWarWeekly: { currentWeek: 'OLD-WEEK', history: [] },
  };
  const summary = W.checkWeeklyReset(db, () => {});
  assert.ok(summary, 'resolution produced no summary to announce');
  assert.strictEqual(summary.first.gp, 300, `podium GP should be pre-reset (got ${summary.first.gp})`);
  assert.strictEqual(summary.first.granted, 1, 'card grant not reported');
  assert.deepStrictEqual(db.users.a.inventory.cards, { gvc_gold: 1 }, 'gold card not delivered to the winner');
  assert.deepStrictEqual(db.users.c.inventory.cards, { gvc_bronze: 1 }, 'bronze card not delivered');
  assert.strictEqual(db.users.a.weeklyGP, 0, 'weekly GP not reset');
  assert.strictEqual(W.checkWeeklyReset(db, () => {}), null, 'resolved twice in one week');
  const card = W.buildResultsCard(summary, db);
  for (const s of ['WEEKLY GUILD WAR', '🥇 *Iron Vows*', '🥈 *Ashborn*', '🥉 *Cinders*', 'WEEKLY MVP', '/use GVC --gold']) assert.ok(card.includes(s), `card missing "${s}"`);
  assert.ok(card.length < 2000, `card is ${card.length} chars`);
});
at('a guild whose members cannot be found is reported honestly', async () => {
  const W = require('./rpg/utils/WeeklyGuildWar');
  const db = { users: {}, guilds: { gx: { name: 'Ghost Guild', members: ['nobody@lid'], weeklyGP: 99 } }, guildWarWeekly: { currentWeek: 'OLD', history: [] } };
  const s = W.checkWeeklyReset(db, () => {});
  assert.strictEqual(s.first.granted, 0, 'claims cards were granted');
  assert.ok(/could not be located/.test(W.buildResultsCard(s, db)), 'no honest warning on the card');
});
t('index.js settles the war on a timer and posts the card', () => {
  const src = fs.readFileSync('index.js', 'utf8');
  assert.ok(src.includes('_announceWeeklyWarIfClosed'), 'no weekly-war scheduler');
  assert.ok(src.includes('buildResultsCard'), 'the announcement never builds a card');
  assert.ok(/announceGC/.test(src), 'the announcements space is not a target');
  assert.ok(src.includes('setInterval(_announceWeeklyWarIfClosed, 10 * 60 * 1000)'), 'not scheduled');
});

// ═══ 6. Nexus relabelling + no regressions ════════════════
console.log('\n── 6. Currency labels and regression guard ──');
t('no user-facing "N gold" strings remain in the shipped commands', () => {
  const offenders = [];
  const walk = (dir) => {
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, f.name);
      if (f.isDirectory()) { if (f.name !== 'node_modules' && f.name !== '.git') walk(p); continue; }
      if (!f.name.endsWith('.js')) continue;
      fs.readFileSync(p, 'utf8').split('\n').forEach((line, i) => {
        if (/^\s*(\/\/|\*)/.test(line)) return;
        if (/([}\)\d]) gold\b/.test(line) && !/trackWeeklyProgress|logTransaction|type: 'gold|'gold'/.test(line)) offenders.push(`${p}:${i + 1}: ${line.trim().slice(0, 90)}`);
      });
    }
  };
  walk('commands'); walk('rpg/utils'); walk('handlers'); walk('utils');
  assert.deepStrictEqual(offenders, [], offenders.slice(0, 6).join('\n'));
});
t('the casino and bank now say Nexus', () => {
  const casino = fs.readFileSync('commands/rpg/casino.js', 'utf8');
  assert.ok(casino.includes('Won: ${winAmount} Nexus') || casino.includes('} Nexus'), 'casino still prints gold');
  const bank = fs.readFileSync('commands/rpg/bank.js', 'utf8');
  assert.ok(bank.includes('Nexus`'), 'bank still prints gold');
});
t('the real battle engines are untouched by this push', () => {
  const gr = fs.readFileSync('rpg/dungeons/GateRaid.js', 'utf8');
  assert.ok(gr.includes('playerDamage'), 'GateRaid damaged');
  assert.ok(fs.readFileSync('rpg/utils/PetCombat.js', 'utf8').includes('abilityStrike'), 'pets regressed');
});

(async () => {
  await Promise.allSettled(PENDING);
  console.log(`\n${fail === 0 ? '✅' : '❌'} Push #56 harness — PASS ${pass} FAIL ${fail} (${PENDING.length} async)`);
  process.exit(fail ? 1 : 0);
})();
