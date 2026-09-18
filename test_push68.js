// AniRPG — verification harness for Push #68
//
// 1.  /party boss crash      — "boss is not defined" (finishBossDefeat scope)
// 2.  /attack crash          — "_petLines is not defined" (stunned path)
// 3.  combat self-lock       — the actor can no longer re-enter mid-flow
// 4.  wage activity gate     — <3 dailies/week → auto-skip
// 5.  pro-guildmaster DM     — approval flow (pay / skip / 24h auto-pay /
//                              DM-dropped auto-pay / non-master rejection)
// 6.  /wages command         — pipeline status (due / processing / paid)
// 7.  profile wage line      — status on the profile card
// 8.  /bleep owner command   — rank change + pure-improvement stat floor
// 9.  S-rank odds            — registration S 0.1% (+2.9% to A)
// 10. S-gate odds            — gate S +4.9% (5% → 9.9%, from C)
// 11. gate spawn cadence     — one random spawn per 2h WAT window
// 12. quiz default           — button starts /quiz 10, /quiz <1-20>
// 13. /wageyes|/wageno hook  — DM approval taps before the DM command gate

'use strict';
process.chdir(__dirname);
const assert = require('assert');
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
const pending = [];
const t = (n, f) => {
  try {
    const r = f();
    if (r && typeof r.then === 'function') {
      pending.push(r.then(
        () => { console.log(`  ✅ ${n}`); pass++; },
        (e) => { console.log(`  ❌ ${n}\n       ${e && e.message}`); fail++; }
      ));
      return;
    }
    console.log(`  ✅ ${n}`); pass++;
  } catch (e) { console.log(`  ❌ ${n}\n       ${e && e.message}`); fail++; }
};
const src = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');

console.log('\nAniRPG — Push #68 verification: bug patches + gameplay improv\n');

// ═══════════════════════════════════════════════════════════════
// PART 1 — CRASH BUGS (source structure)
// ═══════════════════════════════════════════════════════════════
const gr = src('commands/rpg/gateraid.js');

t('boss is captured from gate inside finishBossDefeat (fixes "boss is not defined")', () => {
  const i = gr.indexOf('const finishBossDefeat = async () => {');
  assert.ok(i > -1, 'finishBossDefeat missing');
  const block = gr.slice(i, i + 900);
  assert.ok(block.includes('const boss = gate.boss;'), 'must bind boss from gate.boss inside finishBossDefeat');
  const bind = block.indexOf('const boss = gate.boss;');
  assert.ok(block.indexOf('boss.defeated = true') > bind, 'bind must come before first boss use');
});

t('_petLines declared at execute scope, before the canAct block (fixes "_petLines is not defined")', () => {
  const decl = gr.indexOf('let _petStrike = null, _petLines = [];');
  const canAct = gr.indexOf('if (_grCanAct.canAct) {');
  assert.ok(decl > -1 && canAct > -1, 'declaration / canAct block missing');
  assert.ok(decl < canAct, 'declaration must precede the canAct block');
  assert.strictEqual(gr.slice(0, decl).split('let _petStrike = null, _petLines = [];').length - 1, 0, 'must be declared exactly once (old in-block copy removed)');
});

t('combat lock blocks the holder THEMSELVES (no mid-flow re-entry)', () => {
  const grl = src('rpg/dungeons/GateRaid.js');
  assert.ok(!/cur\.holder !== holder/.test(grl), 'old self-exempt condition must be gone');
  assert.ok(grl.includes('self: cur.holder === holder'), 'lock result must flag self-holds');
  assert.ok(gr.includes('_lock.self') && gr.includes('_block.self'), 'both attack + boss branches must use the self message');
});

// ═══════════════════════════════════════════════════════════════
// PART 2 — COMBAT LOCK (functional)
// ═══════════════════════════════════════════════════════════════
let GR = null;
try { GR = require('./rpg/dungeons/GateRaid'); } catch (e) { console.log('  (GateRaid not loadable in sandbox:', e.message.split('\n')[0] + ')'); }

if (GR) {
  t('tryCombatLock: same holder is refused while their flow runs', () => {
    GR.releaseCombatLock('TEST-G1');
    assert.ok(GR.tryCombatLock('TEST-G1', 'a@x', 'Alice').ok, 'first acquire must succeed');
    const self = GR.tryCombatLock('TEST-G1', 'a@x', 'Alice');
    assert.ok(!self.ok, 'same holder must be blocked');
    assert.ok(self.self === true, 'must be flagged self');
    const other = GR.tryCombatLock('TEST-G1', 'b@x', 'Bob');
    assert.ok(!other.ok && other.self === false, 'other holders blocked, not self');
    GR.releaseCombatLock('TEST-G1');
    assert.ok(GR.tryCombatLock('TEST-G1', 'a@x', 'Alice').ok, 'released lock re-acquirable');
    GR.releaseCombatLock('TEST-G1');
  });
}

// ═══════════════════════════════════════════════════════════════
// PART 3 — WAGE ENGINE (functional)
// ═══════════════════════════════════════════════════════════════
const CM = require('./rpg/utils/GuildContractManager');

function fakeDb({ proMaster = true } = {}) {
  const wk = CM.weekKey();
  const now = Date.now();
  const db = {
    guilds: {
      'guild_1': { id: 'guild_1', name: 'Test Guild', leader: '999@s.whatsapp.net', treasury: 100000, manaTreasury: 500 },
    },
    users: {
      '999@s.whatsapp.net': { id: '999@s.whatsapp.net', name: 'Master', guild: null, isPro: proMaster, proExpiresAt: now + 86400000 },
      '111@s.whatsapp.net': { id: '111@s.whatsapp.net', name: 'ActiveGuy', guild: 'guild_1', dailyWeek: { key: wk, count: 3 }, gold: 0, manaCrystals: 0, inventory: {} },
      '222@s.whatsapp.net': { id: '222@s.whatsapp.net', name: 'LazyGuy', guild: 'guild_1', dailyWeek: { key: wk, count: 1 }, gold: 0, manaCrystals: 0, inventory: {} },
    },
    guildContracts: {
      'guild_1': {
        '111': { weeklyNexus: 1000, weeklyMana: 10, weeks: 4, totalWeeks: 4, startAt: now, nextPayAt: now - 60000, weeksPaid: 0, active: true, hiredBy: '999@s.whatsapp.net' },
        '222': { weeklyNexus: 800, weeklyMana: 5, weeks: 4, totalWeeks: 4, startAt: now, nextPayAt: now - 60000, weeksPaid: 0, active: true, hiredBy: '999@s.whatsapp.net' },
      },
    },
  };
  return db;
}

t('weekKey / weeklyDailyClaims count only the current WAT week', () => {
  const wk = CM.weekKey();
  const p = { dailyWeek: { key: wk, count: 3 } };
  assert.strictEqual(CM.weeklyDailyClaims(p), 3);
  const stale = { dailyWeek: { key: '2020-01-01', count: 99 } };
  assert.strictEqual(CM.weeklyDailyClaims(stale), 0);
  assert.strictEqual(CM.weeklyDailyClaims(null), 0);
  // weekKey must be a Monday
  const d = new Date(wk + 'T00:00:00Z');
  assert.strictEqual(d.getUTCDay(), 1, 'weekKey must anchor on Monday');
});

t('inactive member (<3 dailies) is auto-skipped, active member paid — non-pro master', () => {
  const db = fakeDb({ proMaster: false });
  const summaries = CM.processWeeklyPay(db, 'guild_1', null);
  const c111 = db.guildContracts.guild_1['111'];
  const c222 = db.guildContracts.guild_1['222'];
  assert.ok(summaries.length >= 1, 'summaries returned');
  assert.strictEqual(c111.weeksPaid, 1, 'active member week paid');
  assert.strictEqual(db.users['111@s.whatsapp.net'].gold, 1000, 'nexus credited');
  assert.strictEqual(db.users['111@s.whatsapp.net'].manaCrystals, 10, 'mana credited');
  assert.strictEqual(db.guilds.guild_1.treasury, 99000, 'treasury deducted');
  assert.strictEqual(c222.weeksPaid, 1, 'inactive member week consumed (skipped)');
  assert.strictEqual(db.users['222@s.whatsapp.net'].gold, 0, 'no payout for inactive');
  assert.strictEqual(c222.payHistory[0].status, 'skipped_inactive', 'skip recorded');
});

t('pro master: approval pending → DM dropped in sandbox → auto_paid (wages not held hostage)', () => {
  const db = fakeDb({ proMaster: true });
  CM.processWeeklyPay(db, 'guild_1', null);
  const c111 = db.guildContracts.guild_1['111'];
  const ap = db.salaryApprovals?.guild_1?.['111'];
  assert.ok(ap, 'approval record created for the pro-master guild');
  assert.strictEqual(ap.status, 'resolved');
  assert.strictEqual(ap.resolution, 'auto_paid', 'DM unavailable in sandbox → auto-pay path');
  assert.strictEqual(c111.weeksPaid, 1, 'week paid via auto path');
  assert.strictEqual(db.users['111@s.whatsapp.net'].gold, 1000);
});

t('wageyes: master pays a pending member (scoped row-id path)', () => {
  const db = fakeDb({ proMaster: true });
  const now = Date.now();
  db.salaryApprovals = { guild_1: { '111': { guildId: 'guild_1', memberBare: '111', memberName: 'ActiveGuy', nexus: 1000, mana: 10, dueAt: now, askedAt: now, masterJid: '999@s.whatsapp.net', status: 'pending', week: CM.weekKey() } } };
  const res = CM.tryResolveApprovalBySender(db, '999@s.whatsapp.net', true, null, 'guild_1', '111');
  assert.ok(res.handled, 'master tap handled');
  assert.ok(res.result.includes('WAGE PAID — ActiveGuy'), 'paid message: ' + res.result);
  assert.strictEqual(db.users['111@s.whatsapp.net'].gold, 1000);
  assert.strictEqual(db.guildContracts.guild_1['111'].weeksPaid, 1);
});

t('wageno: master skips a pending member', () => {
  const db = fakeDb({ proMaster: true });
  const now = Date.now();
  db.salaryApprovals = { guild_1: { '111': { guildId: 'guild_1', memberBare: '111', memberName: 'ActiveGuy', nexus: 1000, mana: 10, dueAt: now, askedAt: now, status: 'pending', week: CM.weekKey() } } };
  const res = CM.tryResolveApprovalBySender(db, '999@s.whatsapp.net', false, null, 'guild_1', '111');
  assert.ok(res.handled && res.result.includes('WAGE SKIPPED — ActiveGuy'), 'skip message');
  assert.strictEqual(db.users['111@s.whatsapp.net'].gold, 0, 'nothing paid');
  assert.strictEqual(db.guildContracts.guild_1['111'].payHistory[0].status, 'skipped_denied');
});

t('non-master tap is rejected; stale/absent approval is a no-op', () => {
  const db = fakeDb({ proMaster: true });
  const r1 = CM.tryResolveApprovalBySender(db, '555@s.whatsapp.net', true, null, 'guild_1', '111');
  assert.ok(!r1.handled, 'outsider cannot approve');
  const r2 = CM.tryResolveApprovalBySender(db, '999@s.whatsapp.net', true, null, 'guild_1', '111');
  assert.ok(!r2.handled, 'no pending approval → not handled (silently swallowed)');
});

t('wageyes for an INACTIVE member skips the week (gate still enforced)', () => {
  const db = fakeDb({ proMaster: true });
  const now = Date.now();
  db.salaryApprovals = { guild_1: { '222': { guildId: 'guild_1', memberBare: '222', memberName: 'LazyGuy', nexus: 800, mana: 5, dueAt: now, askedAt: now, status: 'pending', week: CM.weekKey() } } };
  const res = CM.tryResolveApprovalBySender(db, '999@s.whatsapp.net', true, null, 'guild_1', '222');
  assert.ok(res.handled, 'handled');
  assert.ok(res.result.includes('skipped regardless'), 'inactive message: ' + res.result);
  assert.strictEqual(db.users['222@s.whatsapp.net'].gold, 0, 'no payout despite ✅');
  assert.strictEqual(db.guildContracts.guild_1['222'].payHistory[0].status, 'skipped_inactive');
});

t('getSalaryStatus: due / processing / scheduled / no-contract states', () => {
  const db = fakeDb({ proMaster: true });
  // scheduled: push nextPayAt into the future
  db.guildContracts.guild_1['111'].nextPayAt = Date.now() + 3 * 86400000;
  let st = CM.getSalaryStatus(db, '111@s.whatsapp.net');
  assert.strictEqual(st.state, 'active');
  assert.strictEqual(st.dueState, 'scheduled');
  assert.strictEqual(st.claims, 3);
  // processing: due now + pending approval
  db.guildContracts.guild_1['111'].nextPayAt = Date.now() - 60000;
  db.salaryApprovals = { guild_1: { '111': { status: 'pending', askedAt: Date.now() } } };
  st = CM.getSalaryStatus(db, '111@s.whatsapp.net');
  assert.strictEqual(st.dueState, 'processing');
  // will_skip: due now, no approval, 1 daily
  st = CM.getSalaryStatus(db, '222@s.whatsapp.net');
  assert.strictEqual(st.dueState, 'will_skip');
  // no contract
  const db2 = fakeDb();
  db2.guildContracts = {};
  st = CM.getSalaryStatus(db2, '111@s.whatsapp.net');
  assert.strictEqual(st.state, 'no_contract');
});

// ═══════════════════════════════════════════════════════════════
// PART 4 — /wages command (functional)
// ═══════════════════════════════════════════════════════════════
const wagesCmd = require('./commands/rpg/wages.js');

function captureSock() {
  const sent = [];
  return { sent, sendMessage: async (jid, content) => { sent.push({ jid, text: content?.text || '' }); return {}; } };
}
const baseMsg = (jid = '111@s.whatsapp.net') => ({ key: { remoteJid: 'test@lid' }, message: {} });

t('/wages: active contract shows pipeline (wage, status, gate, last paid)', () => {
  const db = fakeDb({ proMaster: false });
  db.guildContracts.guild_1['111'].nextPayAt = Date.now() + 2 * 86400000;
  const sock = captureSock();
  return wagesCmd.execute(sock, baseMsg(), [], () => db, () => {}, '111@s.whatsapp.net').then(() => {
    const txt = sock.sent[0]?.text || '';
    assert.ok(txt.includes('WEEKLY WAGES'), 'title present');
    assert.ok(txt.includes('NEXT PAY:'), 'due date shown: ' + txt.slice(0, 200));
    assert.ok(txt.includes('1,000 Nexus'), 'weekly wage shown');
    assert.ok(txt.includes('3/3'), 'activity gate shown');
    assert.ok(txt.includes('Last paid:'), 'last-paid line present');
    assert.ok(txt.includes('/contract'), 'points to /contract for terms');
  });
});

t('/wages: guildless + no-contract states give clean answers', () => {
  const db = fakeDb();
  db.users['111@s.whatsapp.net'].guild = null;
  const sock = captureSock();
  return wagesCmd.execute(sock, baseMsg(), [], () => db, () => {}, '111@s.whatsapp.net').then(() => {
    assert.ok((sock.sent[0]?.text || '').includes('not in a guild'), 'guildless text');
  });
});

// ═══════════════════════════════════════════════════════════════
// PART 5 — /bleep owner command (functional)
// ═══════════════════════════════════════════════════════════════
const bleepCmd = require('./commands/rpg/bleep.js');
const OWNER = '221951679328499@lid'; // built-in owner (constants.js fallback)

function bleepDb() {
  return {
    users: {
      '777@s.whatsapp.net': {
        id: '777@s.whatsapp.net', name: 'Target', awakenRank: 'E', level: 5, class: 'Berserker',
        stats: { hp: 100, atk: 5, def: 3, speed: 80, maxEnergy: 50 },
        baseStats: { hp: 100, atk: 5, def: 3, speed: 80, maxEnergy: 50 },
        manaCrystals: 0, upgradePoints: 0,
      },
    },
  };
}
const mentionMsg = () => ({ key: { remoteJid: 'test@lid' }, message: { extendedTextMessage: { contextInfo: { mentionedJid: ['777@s.whatsapp.net'] } } } });

t('/bleep S @player: rank S, stat floor raised, level/class untouched', () => {
  const db = bleepDb();
  const sock = captureSock();
  return bleepCmd.execute(sock, mentionMsg(), ['S'], () => db, () => {}, OWNER).then(() => {
    const p = db.users['777@s.whatsapp.net'];
    assert.strictEqual(p.awakenRank, 'S', 'rank set');
    assert.ok(p.stats.hp >= 420 && p.stats.atk >= 62 && p.stats.def >= 45, `stat floor applied: ${JSON.stringify(p.stats)}`);
    assert.strictEqual(p.level, 5, 'level untouched');
    assert.strictEqual(p.class, 'Berserker', 'class untouched');
    assert.strictEqual(p.manaCrystals, 6000 - 500, 'mana bonus delta (S-E)');
    assert.strictEqual(p.upgradePoints, 20 - 3, 'upgrade-point delta (S-E)');
    assert.ok(sock.sent[0].text.includes('BLEEP! RANK RECALIBRATED'), 'announcement');
  });
});

t('/bleep: non-owner rejected, bad rank rejected, unknown target rejected', () => {
  const db = bleepDb();
  const sock = captureSock();
  return bleepCmd.execute(sock, mentionMsg(), ['S'], () => db, () => {}, '888@s.whatsapp.net').then(() => {
    assert.ok(sock.sent[0].text.includes('Bot owner only'), 'non-owner blocked');
    return bleepCmd.execute(sock, mentionMsg(), ['Z'], () => db, () => {}, OWNER).then(() => {
      assert.ok(sock.sent[1].text.includes('Usage:'), 'bad rank usage');
      return bleepCmd.execute(sock, { key: { remoteJid: 'test@lid' }, message: {} }, ['S'], () => db, () => {}, OWNER).then(() => {
        assert.ok(sock.sent[2].text.includes('not found'), 'unknown target');
        assert.strictEqual(db.users['777@s.whatsapp.net'].awakenRank, 'E', 'nothing changed');
      });
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// PART 6 — RANK ODDS (functional, Monte-Carlo)
// ═══════════════════════════════════════════════════════════════
const SLC = require('./rpg/utils/SoloLevelingCore');
const { GateManager } = require('./rpg/dungeons/GateManager');

t('registration roll: S ≈ 0.1%, A ≈ 19.9% (300k samples)', () => {
  const N = 300000;
  const counts = { E: 0, D: 0, C: 0, B: 0, A: 0, S: 0 };
  for (let i = 0; i < N; i++) counts[SLC.rollAwakeningRank(`seed${i}`)]++;
  const s = counts.S / N, a = counts.A / N;
  assert.ok(s >= 0.0004 && s <= 0.0016, `S fraction ${s}`);
  assert.ok(a >= 0.19 && a <= 0.208, `A fraction ${a}`);
  assert.ok(counts.E / N > 0.08 && counts.E / N < 0.12, `E fraction ${counts.E / N}`);
});

t('gate roll: S ≈ 9.9%, C ≈ 30.1% (300k samples)', () => {
  const N = 300000;
  const counts = { E: 0, D: 0, C: 0, B: 0, A: 0, S: 0 };
  for (let i = 0; i < N; i++) counts[GateManager.rollGateRank('E')]++;
  const s = counts.S / N, c = counts.C / N;
  assert.ok(s >= 0.09 && s <= 0.108, `gate S fraction ${s}`);
  assert.ok(c >= 0.29 && c <= 0.312, `gate C fraction ${c}`);
});

// ═══════════════════════════════════════════════════════════════
// PART 7 — GATE SPAWN WINDOWS (functional)
// ═══════════════════════════════════════════════════════════════
const GateSpawner = require('./handlers/gateSpawner.js');

t('2h WAT windows: one random spawn inside the current window', () => {
  // 2026-09-18T23:30:00Z == 2026-09-19 00:30 WAT → window [00:00, 02:00) WAT
  const now = Date.UTC(2026, 8, 18, 23, 30, 0);
  const idx = GateSpawner.watWindowIndex(now);
  const range = GateSpawner.windowRange(idx);
  assert.ok(now >= range.start && now < range.end, 'window contains now');
  assert.strictEqual(range.end - range.start, 2 * 3600000, 'window is 2h');
  // WAT = UTC+1 → window boundaries fall on ODD UTC hours (23:00, 01:00, ...)
  const bd = new Date(range.start);
  assert.ok(bd.getUTCHours() % 2 === 1 && bd.getUTCMinutes() === 0, 'window aligned to WAT 2h grid (odd UTC hour)');

  const db = { gateSpawnMeta: {} };
  const chatId = 'wtest@lid';
  GateSpawner.scheduleNextGate(null, chatId, () => db, () => {}, now);
  const meta = db.gateSpawnMeta[chatId];
  assert.ok(meta.nextSpawnAt > now + 9 * 60000, `spawn ≥10min out (got +${Math.round((meta.nextSpawnAt - now) / 60000)}min)`);
  assert.ok(meta.nextSpawnAt <= range.end, 'spawn inside current window');
  assert.strictEqual(meta.spawnWindow, idx);
  GateSpawner.stop(chatId);
});

t('near window end: spawn moves to the NEXT window', () => {
  // 2026-09-19T02:56:00Z == 03:56 WAT → window [02:00,04:00) WAT, only 4min left
  const now = Date.UTC(2026, 8, 19, 2, 56, 0);
  const idx = GateSpawner.watWindowIndex(now);
  const db = { gateSpawnMeta: {} };
  const chatId = 'wtest2@lid';
  GateSpawner.scheduleNextGate(null, chatId, () => db, () => {}, now);
  const meta = db.gateSpawnMeta[chatId];
  assert.strictEqual(meta.spawnWindow, idx + 1, 'target is next window');
  const nextRange = GateSpawner.windowRange(idx + 1);
  assert.ok(meta.nextSpawnAt >= nextRange.start && meta.nextSpawnAt <= nextRange.end, 'spawn inside next window');
  GateSpawner.stop(chatId);
});

// ═══════════════════════════════════════════════════════════════
// PART 8 — QUIZ + REMAINING SOURCE CHECKS
// ═══════════════════════════════════════════════════════════════
const quizSrc = src('commands/rpg/quiz.js');
t('quiz: default 10, /quiz <n> max 20 (logic intact)', () => {
  assert.ok(quizSrc.includes('numQ || 10'), 'default 10');
  assert.ok(quizSrc.includes('const MAX_QUESTIONS       = 20;'), 'max 20');
});

t('games lobby quiz button starts an explicit /quiz 10', () => {
  const g = src('commands/rpg/games.js');
  assert.ok(g.includes("['📝 Quiz', '/quiz 10']"), 'button → /quiz 10');
});

t('daily.js maintains the weekly claim counter (salary gate feed)', () => {
  const d = src('commands/rpg/daily.js');
  assert.ok(d.includes('player.dailyWeek') && d.includes('CMw.weekKey(now)'), 'counter present');
  assert.ok(d.indexOf('player.dailyWeek') < d.indexOf("trackAndNotify(player, 'daily'"), 'counted on successful claim only');
});

t('profile card carries the wage status line', () => {
  const p = src('commands/rpg/profile.js');
  assert.ok(p.includes('getSalaryStatus'), 'uses salary status');
  assert.ok(p.includes('💰 *Wages:*'), 'wages line rendered');
});

t('rpgCommandHandler: /wageyes|/wageno resolved before the DM command gate', () => {
  const h = src('handlers/rpgCommandHandler.js');
  const hook = h.indexOf("commandName === 'wageyes' || commandName === 'wageno'");
  assert.ok(hook > -1, 'hook present');
  assert.ok(h.slice(hook, hook + 1400).includes('tryResolveApprovalBySender'), 'calls the resolver');
  // hook must sit before the DM block that rejects player DM commands
  assert.ok(hook < h.indexOf('COMMANDS DISABLED IN DM'), 'hook before the DM gate');
  // and must be placed after isDM is known (DM-only hook)
  assert.ok(h.indexOf('const isDM') < hook, 'hook placed after isDM is computed');
  assert.ok(h.slice(Math.max(0, hook - 60), hook).includes('isDM &&'), 'guarded by isDM');
});

t('MSM: /link still owner-gated via Perms (co-owner tier included)', () => {
  const m = src('bots/MultiSocketManager.js');
  assert.ok(m.includes('Perms.isBotOwner(db, sender)'), '/link gate intact');
  const pm = src('utils/permissions.js');
  assert.ok(pm.includes('const builtIn = [OWNER_JID, COOWNER_JID, COOWNER_PHONE]'), 'co-owner (lid + phone) are built-in owner tiers');
});

t('gateSpawner: one-per-window cadence wired (constants + stamp)', () => {
  const g = src('handlers/gateSpawner.js');
  assert.ok(g.includes('const WINDOW_MS     = 2 * 60 * 60 * 1000;'), '2h window constant');
  assert.ok(g.includes('meta.lastSpawnWindow'), 'spawn window stamped');
});

// ═══════════════════════════════════════════════════════════════
// PART 9 — CO-OWNER DUAL IDENTITY (Push #69)
// ═══════════════════════════════════════════════════════════════
const C = require('./utils/constants');
const Perms = require('./utils/permissions');

t('co-owner recognized in BOTH JID forms (legacy LID + phone, ±device suffix)', () => {
  assert.ok(C.isCoownerJid('194592469209292@lid'), 'legacy LID');
  assert.ok(C.isCoownerJid('2347062052095@s.whatsapp.net'), 'phone JID');
  assert.ok(C.isCoownerJid('2347062052095:12@s.whatsapp.net'), 'phone + device suffix');
  assert.ok(!C.isCoownerJid('888@s.whatsapp.net'), 'strangers are not co-owner');
  assert.ok(Perms.isBotOwner({}, '2347062052095@s.whatsapp.net'), 'phone → owner tier (unlocks all owner cmds + /link)');
  assert.ok(Perms.isBotOwner({}, '194592469209292@lid'), 'lid → owner tier');
  assert.ok(Perms.isBotOwner({}, '221951679328499@lid'), 'owner still recognized');
});

t('co-owner identity wired into register (S-rank), intent roles, serf + bank super-user', () => {
  const reg = src('commands/rpg/register.js');
  assert.ok(reg.includes('isCoownerJid'), 'register uses dual-identity helper');
  const intent = src('bots/RPGIntentHandler.js');
  assert.ok(intent.includes('COOWNER_PHONE') && intent.includes('coOwnerPhoneNum'), 'intent roles include the phone number');
  const serf = src('commands/rpg/approveserf.js');
  assert.ok(serf.includes('COOWNER_PHONE'), 'approveserf includes the phone number');
  const bank = src('commands/rpg/bank.js');
  assert.ok(bank.includes('isCoownerJid'), 'bank super-user includes the phone number');
});

// ═══════════════════════════════════════════════════════════════
// PART 10 — KICK SEVERANCE + PROFILE VIA TAG/REPLY (Push #70)
// ═══════════════════════════════════════════════════════════════
const CM70 = require('./rpg/utils/GuildContractManager');

t('kick severance: ×2 REMAINING contract balance paid to the kicked member', () => {
  const db = {
    guilds: { g1: { id: 'g1', name: 'TestG', leader: '111@s.whatsapp.net', members: ['222@s.whatsapp.net'] } },
    users: { '222@s.whatsapp.net': { id: '222@s.whatsapp.net', name: 'Kicked', gold: 100, manaCrystals: 5, inventory: { gold: 100 }, guild: 'TestG' } },
    guildContracts: { g1: { '222': { weeklyNexus: 500, weeklyMana: 10, weeks: 4, totalWeeks: 4, weeksPaid: 1, active: true, startAt: Date.now(), nextPayAt: Date.now() + 86400000 } } },
    salaryApprovals: { g1: { '222': { status: 'pending' } } },
  };
  const res = CM70.creditKickPayout(db, 'g1', '222@s.whatsapp.net', null);
  assert.ok(res.success, 'severance succeeded');
  assert.strictEqual(res.payout.nexus, 3000, '500 × 3 remaining weeks × 2');
  assert.strictEqual(res.payout.mana, 60, '10 × 3 remaining weeks × 2');
  assert.strictEqual(db.users['222@s.whatsapp.net'].gold, 3100, 'kicked member credited nexus');
  assert.strictEqual(db.users['222@s.whatsapp.net'].manaCrystals, 65, 'kicked member credited mana');
  assert.ok(!db.guildContracts.g1['222'], 'contract terminated');
  assert.ok(!db.salaryApprovals.g1['222'], 'pending approval cleared');
  const noContract = CM70.creditKickPayout(db, 'g1', '999@s.whatsapp.net', null);
  assert.ok(!noContract.success, 'no contract → no severance (no crash)');
});

t('guild.js: kick pays severance via creditKickPayout; leave stays normal (untouched)', () => {
  const g = src('commands/rpg/guild.js');
  const kickAt = g.indexOf("action === 'kick'");
  const leaveAt = g.indexOf("action === 'leave'");
  const hireAt = g.indexOf("action === 'hire'", leaveAt); // next occurrence AFTER leave (earlier one is in dispatch help)
  const kickBranch = g.slice(kickAt, leaveAt);
  const leaveBranch = g.slice(leaveAt, hireAt);
  assert.ok(kickBranch.includes('creditKickPayout'), 'kick calls the ×2 severance');
  assert.ok(kickBranch.includes('Kick Severance'), 'kick announces the severance');
  assert.ok(!leaveBranch.includes('creditKickPayout'), 'leave does NOT pay severance (untouched)');
  assert.ok(leaveBranch.includes("You left the guild."), 'leave behaviour unchanged');
});

t('profile: works via reply, via tag, device-suffix tolerant, own profile intact', async () => {
  const Profile = require('./commands/rpg/profile');
  const mkSock = () => { const sent = []; return { sent, sendMessage: async (jid, c) => { sent.push(c); return {}; } }; };
  const target = { id: '555@s.whatsapp.net', name: 'RepliedHunter', level: 5, gold: 123, awakenRank: 'E', skills: { active: [] }, class: 'Slayer' };
  const db = { users: { '555@s.whatsapp.net': target, '111@s.whatsapp.net': { id: '111@s.whatsapp.net', name: 'Self', level: 2, gold: 1, awakenRank: 'E', skills: {} } } };
  const base = { key: { remoteJid: 'test@chat' }, message: {} };

  // 1) reply to the target's message (device-suffixed participant — tolerant lookup)
  let sock = mkSock();
  await Profile.execute(sock, { ...base, message: { extendedTextMessage: { text: '/profile', contextInfo: { participant: '555:7@s.whatsapp.net' } } } }, [], () => db, () => {}, '111@s.whatsapp.net');
  assert.ok(sock.sent.length >= 1 && String(sock.sent[0].text || sock.sent[0].caption || '').includes('RepliedHunter'), 'reply → replied-to player\'s card');

  // 2) tag the target
  sock = mkSock();
  await Profile.execute(sock, { ...base, message: { extendedTextMessage: { text: '/profile @x', contextInfo: { mentionedJid: ['555@s.whatsapp.net'] } } } }, [], () => db, () => {}, '111@s.whatsapp.net');
  assert.ok(sock.sent.length >= 1 && String(sock.sent[0].text || sock.sent[0].caption || '').includes('RepliedHunter'), 'tag → tagged player\'s card');

  // 3) bare /profile → own profile (unchanged)
  sock = mkSock();
  await Profile.execute(sock, { ...base, message: { conversation: '/profile' } }, [], () => db, () => {}, '111@s.whatsapp.net');
  assert.ok(sock.sent.length >= 1 && String(sock.sent[0].text || sock.sent[0].caption || '').includes('Self'), 'bare /profile → own card');

  // 4) tag an unregistered player → clean error (no crash)
  sock = mkSock();
  await Profile.execute(sock, { ...base, message: { extendedTextMessage: { text: '/profile @x', contextInfo: { mentionedJid: ['888@s.whatsapp.net'] } } } }, [], () => db, () => {}, '111@s.whatsapp.net');
  assert.ok(sock.sent.length >= 1 && /not registered/i.test(String(sock.sent[0].text || '')), 'unknown target → clean error');
});

// ═══════════════════════════════════════════════════════════════
// Wrap-up — flush async functional tests
// ═══════════════════════════════════════════════════════════════
Promise.allSettled(pending).then(() => {
  console.log(`\n${fail === 0 ? '✅ ALL' : '❌ FAILURES'} — ${pass} passed, ${fail} failed, ${pass + fail} total\n`);
  process.exit(fail === 0 ? 0 : 1);
});
