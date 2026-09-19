// Push #71 regression checks — node test_push71.js
'use strict';
let pass = 0, fail = 0;
function check(name, cond, extra = '') {
  if (cond) { pass++; console.log(`✅ ${name}`); }
  else { fail++; console.log(`❌ ${name} ${extra}`); }
}
const fs = require('fs');
const src = (p) => fs.readFileSync(p, 'utf8');

// ── 1. Kick severance: findGuild accepts object; payout credited + ledgered ──
{
  const CM = require('./rpg/utils/GuildContractManager');
  const db = { users: { 'u@s.whatsapp.net': { name: 'U', gold: 0, manaCrystals: 0, guild: 'SV' } },
    guilds: { guild_1: { id: 'guild_1', name: 'SV', leader: 'gm@s.whatsapp.net', members: [{ id: 'gm@s.whatsapp.net' }, { id: 'u@s.whatsapp.net' }], treasury: 100000, manaTreasury: 5000 } },
    guildContracts: { guild_1: { u: { active: true, weeklyNexus: 1000, weeklyMana: 20, weeks: 4, weeksPaid: 1, startAt: Date.now(), nextPayAt: Date.now() + 1e9 } } } };
  check('findGuild(object) resolves by id', CM.findGuild(db, db.guilds.guild_1) === db.guilds.guild_1);
  check('findGuild(name) resolves', CM.findGuild(db, 'SV') === db.guilds.guild_1);
  const res = CM.creditKickPayout ? CM.creditKickPayout(db, db.guilds.guild_1, 'u@s.whatsapp.net') : null;
  const u = db.users['u@s.whatsapp.net'];
  check('kick payout = 2× remaining (3 weeks × 1000 × 2 = 6000)', u.gold === 6000, `got ${u.gold}`);
  check('kick payout ledgered', Array.isArray(u.txLog || u.transactions || u.ledger) || JSON.stringify(u).includes('kick_severance'));
}

// ── 2. Treasury: resolvePlayerGuild by membership + duplicate merge ──
{
  const CM = require('./rpg/utils/GuildContractManager');
  const db = { users: { '123@s.whatsapp.net': { name: 'P', guild: 'Science Village' } },
    guilds: {
      guild_a: { name: 'Science Village', leader: '999@lid', members: [{ id: '999@lid' }], treasury: 200000, manaTreasury: 100000, createdAt: 1 },
      guild_b: { name: 'Science Village', leader: '999@lid', members: [{ id: '999@lid' }, { id: '123:5@s.whatsapp.net' }], treasury: 37067, manaTreasury: 47130, createdAt: 2 },
    } };
  const merged = CM.mergeDuplicateGuilds(db);
  check('duplicate guilds merged', merged.length === 1 && Object.keys(db.guilds).length === 1);
  const g = Object.values(db.guilds)[0];
  check('treasury summed 237,067 / 147,130', g.treasury === 237067 && g.manaTreasury === 147130, `${g.treasury}/${g.manaTreasury}`);
  const pg = CM.resolvePlayerGuild(db, '123@s.whatsapp.net', db.users['123@s.whatsapp.net']);
  check('resolvePlayerGuild matches device-suffixed member id', pg === g);
}

// ── 3. Ledger helpers exist and log spends ──
{
  const TL = require('./rpg/utils/TransactionLog');
  check('TransactionLog.logSpend/logCredit exported', typeof TL.logSpend === 'function' && typeof TL.logCredit === 'function');
  const p = { gold: 5000, manaCrystals: 100 };
  TL.logSpend(p, 'guild_shop', 1000, 0, 'test');
  const s = JSON.stringify(p);
  check('logSpend writes a ledger entry', s.includes('guild_shop'));
  for (const f of ['rpg/utils/AttackShop.js', 'rpg/dungeons/GateKeyManager.js', 'commands/rpg/guild.js', 'commands/rpg/pet.js'])
    check(`${f} calls logSpend`, src(f).includes('logSpend('));
  check('guild withdraw/wages/kick ledgered as credits', src('commands/rpg/guild.js').includes("'guild_withdraw'") && src('rpg/utils/GuildContractManager.js').includes("'wage'") && src('rpg/utils/GuildContractManager.js').includes("'kick_severance'"));
}

// ── 4. Power: one formula ──
{
  const S = require('./rpg/utils/SoloLevelingCore');
  check('calculatePlayerPower exported', typeof S.calculatePlayerPower === 'function');
  const p = { stats: { atk: 151, def: 70, maxHp: 661, speed: 134, critChance: 7 }, weapon: { bonus: 18 } };
  const a = S.calculatePlayerPower(p), b = S.calculatePlayerPower(p);
  check('power deterministic & > 0', a > 0 && a === b);
  for (const f of ['commands/rpg/profile.js', 'commands/rpg/stats.js', 'commands/rpg/guild.js', 'bots/RPGIntentHandler.js', 'rpg/utils/StatsCard.js'])
    check(`${f} uses calculatePlayerPower`, src(f).includes('calculatePlayerPower('));
}

// ── 5. /wages live ──
{
  const w = src('commands/rpg/wages.js');
  check('/wages re-reads after settlement & saves', w.includes('_settled') && w.includes('Guild treasury now'));
  check('getSalaryStatus uses live membership resolver', src('rpg/utils/GuildContractManager.js').includes('resolvePlayerGuild(db, playerJid, user)'));
}

// ── 6. burnkey ──
{
  const GKM = require('./rpg/dungeons/GateKeyManager');
  check('GKM.burnKeysOf exported', typeof GKM.burnKeysOf === 'function');
  const db = { gateKeys: { ABCD1234: { ownedBy: '555@s.whatsapp.net', expiresAt: Date.now() + 1e7, gateRank: 'C', gateId: 'G-1', dungeonChatId: 'g@g.us' } }, activeGates: { 'G-1': {} }, dungeonGCs: { 'g@g.us': { activeKeyId: 'ABCD1234' } } };
  GKM.activeKeys.ABCD1234 = db.gateKeys.ABCD1234;
  const burned = GKM.burnKeysOf('555:2@s.whatsapp.net', db, { by: 'mod' });
  check('burnKeysOf burns owner\'s live key (device-suffix tolerant)', burned.length === 1 && db.gateKeys.ABCD1234.expired && !GKM.activeKeys.ABCD1234);
  check('burnKeysOf frees GC + gate', db.dungeonGCs['g@g.us'].activeKeyId === null && !db.activeGates['G-1']);
  check('/burnkey command exists', fs.existsSync('commands/rpg/burnkey.js') && require('./commands/rpg/burnkey').name === 'burnkey');
  check('/reset burns keys', src('commands/rpg/reset.js').includes('burnKeysOf('));
}

// ── 7. Senku exclusive + /recon ──
{
  const CS = require('./rpg/utils/ClassSystem');
  const pool = CS.rollableClasses();
  check('Senku not in rollable pool', !pool.includes('Senku') && pool.length > 5);
  let sawSenku = false; for (let i = 0; i < 500; i++) if (CS.rollClassAwakening() === 'Senku') sawSenku = true;
  check('500 rolls never yield Senku', !sawSenku);
  const p = { name: 'X', level: 20, stats: { hp: 500, maxHp: 500, atk: 100, def: 50, speed: 30, energy: 100, maxEnergy: 100 }, class: 'Senku', classBase: 'Senku', classQuality: 100 };
  const r = CS.reconClass(p);
  check('/recon strips Senku and assigns a non-exclusive class', r.success && r.oldName === 'Senku' && p.classBase !== 'Senku' && !CS.isExclusiveClass(p.classBase), JSON.stringify(r));
  check('/recon command exists', require('./commands/rpg/recon').name === 'recon');
}

// ── 8. Pet food loop ──
{
  const PDB = require('./rpg/utils/PetDatabase');
  const p = { gold: 10000, inventory: { items: [{ name: 'Royal Feed', type: 'PetFood', isPetFood: true }], petFood: { 'Monster Kibble': 2 } } };
  PDB.normalisePetFood(p);
  check('legacy items[]/name-keyed food migrated to id bucket', p.inventory.items.length === 0 && (p.inventory.petFood.royal_feed || 0) >= 1 && Object.keys(p.inventory.petFood).every(k => PDB.PET_FOOD[k]), JSON.stringify(p.inventory.petFood));
  check('consumePetFood works', PDB.consumePetFood(p, 'royal_feed', 1) === true && PDB.consumePetFood(p, 'royal_feed', 5) === false);
  const PM = require('./rpg/utils/PetManager');
  check('PetManager.feedPet takes player row (inventory-consuming)', /feedPet\(playerId, petInstanceId, foodName, playerRow/.test(src('rpg/utils/PetManager.js')));
  const pet = src('commands/rpg/pet.js');
  check('/pet foods shows Nexus, /pet buy exists', pet.includes("sub === 'buy'") && pet.includes('Nexus') && !pet.includes('.cost.toLocaleString()}g'));
  check('guild shop pet food + gate drops land in the bucket', src('rpg/utils/SealedPackages.js').includes('addPetFood(') && src('rpg/dungeons/GateRaid.js').includes('addPetFood('));
}

// ── 9. /catch replaces /caught ──
{
  check('/caught is a shim to /catch', src('commands/rpg/caught.js').includes("require('./catch')"));
  check('no user-facing "/caught <token>" left', !src('commands/rpg/gateraid.js').includes('/caught ${') && !src('commands/rpg/closegate.js').includes('/caught ${') && !src('bots/GameKnowledge.js').includes('/caught <token>'));
}

// ── 10. Recovery skills + no 100% status ──
{
  const gr = src('commands/rpg/gateraid.js');
  check('gateraid counter uses per-move chance', gr.includes('monsterSkill.chance || 35') && !gr.includes('chance: 100, duration: 2'));
  check('ImprovedCombat heals from catalog healingPct', src('rpg/utils/ImprovedCombat.js').includes('healingPct'));
  check('GateRaid.playerDamage applies selfHeal', src('rpg/dungeons/GateRaid.js').includes('healed'));
  check('class dispatcher heals catalog heal skills', src('commands/rpg/classcmd_dispatcher.js').includes('_catHeal'));
  check('MonsterAbilities doom not 100%', !/doom[\s\S]{0,200}chance:\s*100/.test(src('rpg/utils/MonsterAbilities.js')));
}

// ── 11. Bestiary + strength + crafting ──
{
  const SL = require('./rpg/data/SoloLevelingMonsters');
  check('50 monsters per rank E–S', ['E','D','C','B','A','S'].every(r => SL.SL_MONSTERS[r].length === 50));
  check('every monster has skills w/ chance < 100 and 4 drops', Object.values(SL.SL_MONSTERS).flat().every(m => m.skills.length && m.skills.every(s => s.chance < 100) && m.drops.length === 4));
  const GM = require('./rpg/dungeons/GateManager');
  const pcts = new Set(); for (let i = 0; i < 300; i++) pcts.add(GM.rollGateStrength());
  check('gate strength rolls within 60–100', [...pcts].every(p => p >= 60 && p <= 100) && pcts.size > 5);
  const weak = GM.buildGateMonsters('A', 7, 60), strong = GM.buildGateMonsters('A', 7, 100);
  const avg = (l) => l.reduce((a, m) => a + m.maxHp, 0) / l.length;
  check('100% gate is tougher than 60% gate', avg(strong) > avg(weak), `${avg(strong)} vs ${avg(weak)}`);
  check('weak gate excludes tier-5 monsters', weak.every(m => m.tier <= 2));
  check('strengthText format', GM.strengthText('E', 100).startsWith('E rank gate 100%') && GM.strengthText('A', 80).startsWith('A rank gate 80%'));
  check('gate/party screens show strength', src('commands/rpg/party.js').split('strengthLine(gate)').length >= 7 && src('commands/rpg/gates.js').includes('strengthText(') && src('commands/rpg/gateraid.js').includes('strengthText('));
  check('gateraid counters use bestiary skills', src('commands/rpg/gateraid.js').includes('target.skills'));
  const C = require('./rpg/utils/CraftingSystem');
  let sl = 0; for (const r of Object.values(C.RECIPES)) for (const l of Object.values(r)) for (const x of l) if (x.set === 'sololeveling') sl++;
  check('SL recipes merged into scroll pools (>=280)', sl >= 280, `${sl}`);
  const allMats = new Set(SL.SL_MATERIALS);
  let bad = 0; for (const r of Object.values(C.RECIPES)) for (const l of Object.values(r)) for (const x of l) if (x.set === 'sololeveling') for (const m of Object.keys(x.materials)) if (!allMats.has(m)) bad++;
  check('every SL recipe material is droppable', bad === 0, `${bad} unknown`);
  const drop = GM.GateManager.rollMonsterKillDrop('S', 'Beru Ant King');
  check('bestiary monster drop resolves (or null by chance)', drop === null || allMats.has(drop.name));
}

// ── 12. Item emojis ──
{
  const IE = require('./rpg/utils/ItemEmoji');
  check('ItemEmoji distinguishes items', IE.icon({ name: 'Frost Wolf Blade' }) !== IE.icon({ name: 'Titan Stone Helm' }) && IE.icon({ name: 'Royal Feed', type: 'PetFood' }) === '🍖');
  check('/inv & /find use ItemEmoji', src('commands/rpg/inventory.js').includes('IE.tag(') && src('commands/rpg/find.js').includes('ItemEmoji'));
}


// ── Push #72 ──
{
  const S = require('./rpg/utils/StatusSynergy');
  check('#72 synergy: fire vs frozen ×1.5', S.bonusFor({ name: 'Hellfire Bolt', effect: { type: 'burn' } }, { statusEffects: [{ type: 'freeze' }] }).mult === 1.5);
  check('#72 synergy: no status → ×1', S.bonusFor({ name: 'Slash' }, { statusEffects: [] }).mult === 1);
  const UC = require('./rpg/utils/UnifiedCombat');
  const d = { statusEffects: [] }; UC.tryApplyEffect({ id: 'x', effect: { type: 'burn', chance: 100, duration: 1 } }, {}, d);
  check('#72 player-applied status lasts ≥2 turns', d.statusEffects[0].duration >= 2);
  check('#72 UnifiedCombat/GateRaid/SkillCatalog wired to synergy', src('rpg/utils/UnifiedCombat.js').includes('StatusSynergy') && src('rpg/dungeons/GateRaid.js').includes('StatusSynergy') && src('rpg/utils/SkillCatalog.js').includes('StatusSynergy'));
  const SC = require('./rpg/utils/SkillCatalog'); const CS = require('./rpg/utils/ClassSystem');
  const p = { name: 'T', level: 60, stats: { hp: 100, maxHp: 1000, atk: 100, def: 50, speed: 30, energy: 500, maxEnergy: 500 } }; CS.applyClassToPlayer(p, 'Necromancer'); p.class = 'Necromancer'; p.classBase = 'Necromancer';
  check('#72 no {p} placeholders in skill ladder', !JSON.stringify(SC.getRoster(p)).includes('{p}'));
  const wk = src('commands/rpg/weekly.js');
  check('#72 /weekly guards missing progress', wk.includes("if (!wc.progress || typeof wc.progress !== 'object') wc.progress = {};"));
  const ps = src('commands/rpg/prostore.js');
  check('#72 pro tiers grant UP 20/100/1200', ps.includes('upgradePoints: 20') && ps.includes('upgradePoints: 100') && ps.includes('upgradePoints: 1200') && ps.split('tier.upgradePoints || 0').length === 3);
  check('#72 no user-facing "Moonstones"', !/Moonstones/.test(src('commands/rpg/send.js')) && !/Legacy Moonstones/.test(src('commands/rpg/tictactoe.js')));
}

// ── syntax of every touched file ──
{
  const { execSync } = require('child_process');
  const files = ['commands/rpg/guild.js','commands/rpg/recon.js','commands/rpg/burnkey.js','commands/rpg/food.js','commands/rpg/pet.js','commands/rpg/wages.js','commands/rpg/party.js','commands/rpg/gates.js','commands/rpg/gateraid.js','commands/rpg/reset.js','commands/rpg/inventory.js','commands/rpg/find.js','commands/rpg/caught.js','commands/rpg/classcmd_dispatcher.js','commands/rpg/profile.js','commands/rpg/stats.js','rpg/utils/GuildContractManager.js','rpg/utils/TransactionLog.js','rpg/utils/SoloLevelingCore.js','rpg/utils/ClassSystem.js','rpg/utils/PetDatabase.js','rpg/utils/PetManager.js','rpg/utils/CraftingSystem.js','rpg/utils/ItemEmoji.js','rpg/utils/ImprovedCombat.js','rpg/utils/AttackShop.js','rpg/utils/SealedPackages.js','rpg/utils/MonsterAbilities.js','rpg/dungeons/GateManager.js','rpg/dungeons/GateRaid.js','rpg/dungeons/GateKeyManager.js','rpg/data/SoloLevelingMonsters.js','rpg/data/recipes_sololeveling.js','bots/RPGIntentHandler.js','rpg/utils/StatsCard.js','rpg/utils/StatusSynergy.js','rpg/utils/UnifiedCombat.js','rpg/utils/AttackPatternDB.js','rpg/utils/EffectParser.js','commands/rpg/prostore.js','commands/rpg/weekly.js','commands/rpg/send.js','commands/rpg/tictactoe.js','commands/rpg/chess.js'];
  let ok = true; for (const f of files) { try { execSync(`node --check ${f}`, { stdio: 'pipe' }); } catch (e) { ok = false; console.log('  syntax:', f); } }
  check(`node --check on ${files.length} touched files`, ok);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
