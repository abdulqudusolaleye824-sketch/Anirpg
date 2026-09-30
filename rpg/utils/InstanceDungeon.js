'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// Push #95 — INSTANCE DUNGEONS (Job Change Quests), KEYS and DAILY BOXES
//   • Finishing all 4 daily quests: 10% chance of an INSTANCE KEY — only if
//     the hunter already qualifies for a job they do not hold (keys are bound,
//     never tradeable). Pro hunters additionally choose a Blessed or Cursed
//     box (buttons, in DM).
//   • /instance start [job] consumes a key and opens a DM-only endless
//     dungeon: floor after floor of monsters, every 5th a boss. Reaching the
//     target floor of the chosen job clears its Job Change Quest; keep
//     climbing for extra Job XP / Mana Stones until you fall or leave.
// ═══════════════════════════════════════════════════════════════════════════
const JS = require('./JobSystem');
const KEY_CHANCE = 0.10;

function _pro(p) { try { return require('./UI').isPro(p); } catch (e) { return false; } }
function _max(p) { try { return require('./GearSystem').effectiveMaxHp(p) || p.stats.maxHp || 100; } catch (e) { return (p && p.stats && p.stats.maxHp) || 100; } }
function dayKey(player) { try { return player.dailyQuests && player.dailyQuests.dayKey; } catch (e) { return null; } }

// Jobs the hunter could switch to right now (available and not current).
function eligibleJobs(player) { const cur = JS.current(player); return JS.available(player).filter(j => !cur || j.key !== cur.key); }
function keys(player) { return Math.max(0, Number(player && player.jobKeys) || 0); }

// ── Daily completion hook ─────────────────────────────────────────────────
// Returns { lines } to append to the daily message; sends Pro box buttons.
function onDailyComplete(player, sock, jid, chatId) {
  const lines = [];
  if (!player) return { lines };
  const dk = dayKey(player) || new Date().toISOString().slice(0, 10);
  if (player._dailyDoneRewarded === dk) return { lines };
  player._dailyDoneRewarded = dk;
  // Key roll — only for hunters who already qualify for a job change.
  if (eligibleJobs(player).length && Math.random() < KEY_CHANCE) {
    player.jobKeys = keys(player) + 1;
    lines.push(`🗝️ *INSTANCE KEY!* A Job Change Quest key materialises (you hold ${player.jobKeys}). Bound to you — /instance start`);
  }
  // Pro: Blessed / Cursed box choice in DM.
  if (_pro(player)) {
    player.pendingBoxes = (Number(player.pendingBoxes) || 0) + 1;
    lines.push(`🎁 *PRO BOX* — choose Blessed or Cursed in your DM 💎`);
    if (sock && jid) {
      (async () => {
        try {
          const Buttons = require('../../utils/buttons');
          const text = [`🎁 *DAILY BOX* 💎`, `All 4 daily quests done, *${player.name}*. Fate offers two boxes:`, ``, `✨ *Blessed* — light: Mana Stones, UP, Mending Stones, potions, maybe a key.`, `🖤 *Cursed* — dark: bigger jackpots, rare materials, keys… or a price.`, ``, `Boxes waiting: ${player.pendingBoxes}`].join('\n');
          await Buttons.sendButtons(sock, jid, { text, buttons: Buttons.quickReplies([['✨ Blessed box', '/box blessed'], ['🖤 Cursed box', '/box cursed']]) });
        } catch (e) { try { await sock.sendMessage(jid, { text: `🎁 Daily box ready — /box blessed or /box cursed` }); } catch (e2) {} }
      })();
    }
  }
  return { lines };
}

// ── Boxes ─────────────────────────────────────────────────────────────────
function _pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function openBox(player, kind) {
  if (!_pro(player)) return { ok: false, error: 'Daily boxes are a *Pro* feature 💎' };
  if ((Number(player.pendingBoxes) || 0) < 1) return { ok: false, error: 'No box waiting — finish all 4 daily quests first.' };
  kind = String(kind || '').toLowerCase();
  if (kind !== 'blessed' && kind !== 'cursed') return { ok: false, error: 'Choose /box blessed or /box cursed.' };
  player.pendingBoxes -= 1;
  const lvl = Math.max(1, player.level || 1); const inv = player.inventory || (player.inventory = {});
  const out = [];
  const RI = (() => { try { return require('./RewardInventory'); } catch (e) { return null; } })();
  if (kind === 'blessed') {
    const gold = Math.floor((8000 + lvl * 900) * (0.8 + Math.random() * 0.6)); player.gold = (player.gold || 0) + gold; out.push(`💠 +${gold.toLocaleString()} Mana Stones`);
    const r = Math.random();
    if (r < 0.30) { inv.mendingStones = (inv.mendingStones || 0) + 1; out.push(`🪨 +1 Mending Stone`); }
    else if (r < 0.60) { const up = 2 + Math.floor(Math.random() * 4); player.upgradePoints = (player.upgradePoints || 0) + up; out.push(`📈 +${up} Upgrade Points`); }
    else if (r < 0.85) { inv.mediumHealthPotions = (inv.mediumHealthPotions || 0) + 2; out.push(`🧪 +2 Medium Health Potions`); }
    else { inv.higherHealthPotions = (inv.higherHealthPotions || 0) + 1; inv.reviveTokens = (inv.reviveTokens || 0) + 1; out.push(`🧪 +1 Higher Health Potion · ✨ +1 Revive Token`); }
    if (eligibleJobs(player).length && Math.random() < 0.12) { player.jobKeys = keys(player) + 1; out.push(`🗝️ +1 Instance Key (bound)`); }
    if (player.stats) { player.stats.hp = _max(player); out.push(`💚 Fully healed`); }
    return { ok: true, kind, lines: out, title: '✨ BLESSED BOX' };
  }
  // cursed — dark rewards, sometimes with a price
  const r = Math.random();
  if (r < 0.40) { const gold = Math.floor((25000 + lvl * 2500) * (0.8 + Math.random() * 0.8)); player.gold = (player.gold || 0) + gold; out.push(`🖤 Dark jackpot: +${gold.toLocaleString()} Mana Stones`); }
  else if (r < 0.65) { const up = 6 + Math.floor(Math.random() * 6); player.upgradePoints = (player.upgradePoints || 0) + up; out.push(`🩸 Blood-bought power: +${up} Upgrade Points`); }
  else if (r < 0.85) {
    const rank = lvl >= 60 ? 'S' : lvl >= 40 ? 'A' : lvl >= 25 ? 'B' : 'C';
    let mat = `${rank}-Rank Mana Essence`; try { const { rollBaseMaterial } = require('../data/MonsterDrops'); mat = rollBaseMaterial(rank) || mat; } catch (e) {}
    if (RI) RI.grantItem(player, { name: mat, type: 'material', rarity: rank === 'S' ? 'legendary' : rank === 'A' ? 'epic' : 'rare' }, 'cursed_box'); out.push(`🕳️ Cursed relic material: *${mat}*`);
  } else {
    const loss = Math.floor((player.gold || 0) * 0.05); player.gold = Math.max(0, (player.gold || 0) - loss);
    try { require('./StatusEffectManager').applyEffect(player, 'curse', 3); } catch (e) {}
    out.push(`☠️ The box bites back: −${loss.toLocaleString()} Mana Stones and a 3-turn CURSE clings to you.`);
  }
  if (eligibleJobs(player).length && Math.random() < 0.20) { player.jobKeys = keys(player) + 1; out.push(`🗝️ +1 Instance Key (bound)`); }
  return { ok: true, kind, lines: out, title: '🖤 CURSED BOX' };
}

// ── Instance dungeon ─────────────────────────────────────────────────────
const RANK_BY_FLOOR = (f) => f >= 21 ? 'S' : f >= 17 ? 'A' : f >= 13 ? 'B' : f >= 9 ? 'C' : f >= 5 ? 'D' : 'E';
function targetFloorFor(job) { const i = JS.JOBS.findIndex(j => j.key === job.key); return 5 + Math.max(0, i); }

function makeMonster(player, floor) {
  const rank = RANK_BY_FLOOR(floor);
  let def = null; try { def = require('../data/SoloLevelingMonsters').pickForStrength(rank, 100); } catch (e) {}
  const lvl = Math.max(1, player.level || 1);
  const isBoss = floor % 5 === 0;
  const fm = 1 + (floor - 1) * 0.12;
  const pAtk = (player.stats && player.stats.atk) || 50, pHp = _max(player), pDef = (player.stats && player.stats.def) || 20;
  // Scaled to the hunter: ~3–4 hits per floor, ~25–35% of their HP lost per
  // floor at Lv.1 of the ladder; deeper floors (and bosses) climb steadily.
  const hp = Math.floor((pAtk * 2 + pHp * 0.2) * fm * (isBoss ? 1.5 : 1));
  const atk = Math.floor((pDef * 0.5 + pHp * 0.025 + lvl * 1.5) * fm * (isBoss ? 1.2 : 1));
  const dfn = Math.floor((pAtk * 0.2 + lvl * 2) * fm);
  const name = (def && def.name) || _pick(['Shade', 'Ghoul', 'Warg', 'Imp', 'Sentinel']);
  return { id: `inst_${floor}`, name: isBoss ? `${name} Overlord` : name, emoji: isBoss ? '👑' : '👹', level: lvl + floor, rank, isBoss, floor,
    abilities: (def && def.skills && def.skills.length) ? def.skills : ['Strike', 'Rend'],
    stats: { hp, maxHp: hp, atk, def: dfn, speed: 90 + floor * 3 }, statusEffects: [], tempBuffs: {} };
}

function start(player, jobQuery) {
  if (player.instance && player.instance.active) return { ok: false, error: 'You are already inside an instance — /instance attack, or /instance leave.' };
  if (keys(player) < 1) return { ok: false, error: 'You need an *Instance Key* — 10% chance whenever you finish all 4 daily quests (if a job change is open to you).' };
  const elig = eligibleJobs(player);
  if (!elig.length) return { ok: false, error: 'No job change is open to you yet — level up to unlock more jobs (/job list).' };
  let job = jobQuery ? JS.findJob(jobQuery) : elig[elig.length - 1];
  if (!job) return { ok: false, error: 'Unknown job — /job list' };
  if (!elig.some(j => j.key === job.key)) return { ok: false, error: `${job.emoji} *${job.name}* is not open to you (${JS.isAvailable(player, job) ? 'already your job' : `unlocks at Lv.${job.unlock}`}).` };
  if ((player.stats?.hp || 0) <= 0) return { ok: false, error: 'You cannot enter an instance while fallen.' };
  player.jobKeys = keys(player) - 1;
  const target = targetFloorFor(job);
  player.instance = { active: true, job: job.key, floor: 1, target, kills: 0, startedAt: Date.now(), monster: makeMonster(player, 1), passed: false, gold: 0, jobXp: 0, domain: null, turn: 0 };
  return { ok: true, job, target, inst: player.instance };
}

function _buildMove(player, skillQuery) {
  const UC = require('./UnifiedCombat');
  if (!skillQuery) return { move: { ...UC.basicStrike(), name: 'Strike' }, entry: null };
  const SC = require('./SkillCatalog');
  const r = SC.resolveSkill(player, skillQuery, { allowLibrary: true });
  if (!r.ok) return { error: r.error };
  const entry = r.entry || SC.buildRoster(player).find(e => e.name === r.skill.name);
  if (!entry) return { error: 'That skill is not in your unlocked ladder — /skills' };
  const cost = SC.effectiveCost(entry, player);
  if ((player.stats.energy || 0) < cost) return { error: `Not enough ${player.energyType || 'energy'} — *${entry.name}* costs ${cost}, you have ${player.stats.energy || 0}.` };
  const cd = SC.onCooldown ? SC.onCooldown(player, entry) : null; if (cd && cd.ready === false) return { error: `*${entry.name}* is still on cooldown (${Math.ceil((cd.msLeft || 0) / 1000)}s).` };
  const b = SC.levelBonus(entry); const pct = (entry.damagePct || 100) / 100; const st0 = (entry.statuses || [])[0] || null;
  const isSupport = entry.type === 'heal' || entry.type === 'buff' || ((entry.healingPct || 0) > 0 && !(entry.damagePct > 100));
  return { entry, cost, isSupport, move: { name: entry.name, description: entry.description, dmgMult: Math.max(0.25, +(pct * b.dmgMult).toFixed(2)), atkMult: 1.1, defMult: 1.05, critMult: 1.5 + Math.min(0.6, pct * 0.1), accuracy: 90, effect: st0 ? { type: st0.type, chance: st0.chance ?? 60, duration: st0.duration || 2 } : null, buffs: entry.buffs || [], debuffs: entry.debuffs || [], selfDebuffs: entry.selfDebuffs || [] } };
}

// One full round: hunter acts, monster answers. Returns { lines, ended, passed, floorCleared }.
function act(player, skillQuery) {
  const inst = player.instance;
  if (!inst || !inst.active) return { ok: false, error: 'You are not inside an instance — /instance start' };
  const UC = require('./UnifiedCombat'); const SC = require('./SkillCatalog'); const MSFX = require('./MonsterSkillFX'); const DS = require('./DomainSystem');
  const m = inst.monster; const lines = []; inst.turn = (inst.turn || 0) + 1;
  const canAct = UC.canAct ? UC.canAct(player) : { canAct: true };
  const built = _buildMove(player, skillQuery);
  if (built.error) return { ok: false, error: built.error };
  if (canAct && canAct.canAct === false) lines.push(`💫 *${player.name}* is ${canAct.reason || 'held'} and cannot act!`);
  else {
    if (built.entry) { player.stats.energy = Math.max(0, (player.stats.energy || 0) - built.cost); try { SC.setCooldown && SC.setCooldown(player, built.entry); } catch (e) {} }
    if (built.isSupport) {
      const e = built.entry;
      if (e.type === 'heal' || (e.healingPct || 0) > 0) { const amt = Math.floor(_max(player) * ((e.healingPct || 20) / 100) * (SC.levelBonus(e).healMult || 1)); const b = player.stats.hp; player.stats.hp = Math.min(_max(player), b + amt); lines.push(`💚 *${e.name}* — +${player.stats.hp - b} HP → ${player.stats.hp}/${_max(player)}`); }
      try { for (const n of UC.applyMoveBuffs({ name: e.name, buffs: e.buffs || [], debuffs: [], selfDebuffs: e.selfDebuffs || [] }, player, player)) lines.push(n); } catch (er) {}
      try { const sf = SC.applySupportFields(e, player, player, { name: player.name }); lines.push(...sf.lines); } catch (er) {}
      try { const TF = require('./Transformation'); if (TF.isTransformSkill(e)) { const tr = TF.cast(player, e); lines.push(...(tr.ok ? tr.lines : [`❌ ${tr.error}`])); } } catch (er) {}
    } else {
      const res = UC.calcMoveDamage(player, m, built.move);
      if (!res.damage || res.missed) { lines.push(`💨 *${built.move.name}* misses ${m.name}!`); try { JS.noteHit(player, false); } catch (e) {} }
      else {
        let dmg = res.damage;
        m.stats.hp = Math.max(0, m.stats.hp - dmg);
        try { JS.noteHit(player, true); } catch (e) {}
        lines.push(`⚔️ *${built.move.name}* hits ${m.emoji} ${m.name} for *${dmg}*${res.crit ? ' 💥 CRIT' : ''} → ${m.stats.hp}/${m.stats.maxHp}`);
        try { const fx = UC.tryApplyEffect(built.move, player, m); if (fx) lines.push(`${fx.emoji || '☠️'} ${m.name} is ${fx.name || fx.type} (${fx.duration}t)`); } catch (e) {}
        try { for (const n of UC.applyMoveBuffs(built.move, player, m)) lines.push(n); } catch (e) {}
        try { const pm = require('./ClassPower').passiveMultipliers(player); const ls = ((player.stats.lifesteal || 0) + (pm.lifesteal || 0)) / 100; if (ls > 0) { const h = Math.floor(dmg * ls); const b = player.stats.hp; player.stats.hp = Math.min(_max(player), b + h); if (player.stats.hp > b) lines.push(`🩸 Lifesteal +${player.stats.hp - b} HP`); } } catch (e) {}
        if (built.entry) { try { const sf = SC.applySupportFields(built.entry, player, player, { name: player.name }); lines.push(...sf.lines); } catch (e) {} }
      }
    }
  }
  // Monster falls?
  if (m.stats.hp <= 0) {
    inst.kills++;
    const reward = Math.floor((300 + inst.floor * 250 + (player.level || 1) * 20) * (m.isBoss ? 3 : 1));
    player.gold = (player.gold || 0) + reward; inst.gold += reward;
    const jx = JS.gainXp(player, JS.xpFor(m.isBoss ? 'boss' : 'floor'), 'instance'); if (jx) { inst.jobXp += jx.gained; if (jx.levelUp) lines.push(`🧭 *JOB LEVEL UP!* ${jx.name} → Job Lv.${jx.to} — *${jx.title}*`); }
    if (inst.floor % 5 === 0) { player.upgradePoints = (player.upgradePoints || 0) + 1; lines.push(`📈 +1 Upgrade Point (floor ${inst.floor} boss)`); }
    lines.push(`☠️ *${m.name} falls!* +${reward.toLocaleString()} Mana Stones${jx ? ` · +${jx.gained} Job XP` : ''}`);
    try { player.statusEffects = []; } catch (e) {}
    inst.domain = null;
    const job = JS.BY_KEY[inst.job];
    if (!inst.passed && inst.floor >= inst.target) { inst.passed = true; player.jobQuest = { cleared: inst.job, at: Date.now(), floor: inst.floor }; lines.push(`🏆 *JOB CHANGE QUEST CLEARED!* Floor ${inst.floor} reached — *${job.name}* is yours: /job change ${job.name}`, `Keep climbing for extra rewards, or /instance leave.`); }
    // Breather between floors: +20% HP (a boss floor: +35%).
    { const b = player.stats.hp; player.stats.hp = Math.min(_max(player), b + Math.floor(_max(player) * (m.isBoss ? 0.35 : 0.2))); if (player.stats.hp > b) lines.push(`💞 You catch your breath: +${player.stats.hp - b} HP`); }
    inst.floor++; inst.monster = makeMonster(player, inst.floor);
    lines.push(`➡️ *Floor ${inst.floor}* — ${inst.monster.emoji} *${inst.monster.name}* [${inst.monster.rank}] HP ${inst.monster.stats.maxHp}${inst.monster.isBoss ? ' · 👑 BOSS' : ''}${!inst.passed ? ` · target floor ${inst.target}` : ''}`);
    return { ok: true, lines, floorCleared: true, bossKill: !!m.isBoss, ended: false };
  }
  // Monster turn
  const mc = UC.canAct ? UC.canAct(m) : { canAct: true };
  try { const st = UC.tickStatuses(player); if (st && st.length) lines.push(...st); } catch (e) {}
  try { const st = UC.tickStatuses(m); if (st && st.length) lines.push(...st); } catch (e) {}
  try { const tl = DS.tick(inst); if (tl) lines.push(tl); } catch (e) {}
  if (m.stats.hp <= 0) return { ok: true, lines: [...lines, `☠️ ${m.name} succumbs to its wounds — strike again to claim the floor.`], ended: false };
  if (mc && mc.canAct === false) lines.push(`🧊 ${m.emoji} ${m.name} is ${mc.reason || 'held'} and cannot move!`);
  else if ((player.stats.hp || 0) > 0) {
    const ability = Math.random() < 0.7 && m.abilities.length ? _pick(m.abilities) : null;
    const abilityName = ability ? (typeof ability === 'string' ? ability : ability.name) : null;
    const c = ability ? MSFX.resolve(ability) : null;
    let mAtk = m.stats.atk; try { mAtk = Math.floor(mAtk * (1 + UC.tempBuffPct(m, 'atk') / 100)); } catch (e) {}
    const pm = (() => { try { return require('./ClassPower').passiveMultipliers(player); } catch (e) { return {}; } })();
    let pDef = (player.stats.def || 0); try { pDef += require('./GearSystem').getEquippedBonuses(player).def || 0; } catch (e) {}
    try { pDef = Math.floor(pDef * (1 + (pm.def || 0) / 100) * (1 + UC.tempBuffPct(player, 'def') / 100)); } catch (e) {}
    if (c && c.pierce) pDef = Math.floor(pDef * (1 - c.pierce / 100));
    const dodge = UC.dodgeChance({ stats: { speed: m.stats.speed, atk: mAtk }, statusEffects: m.statusEffects }, player, pm);
    if (Math.random() * 100 < dodge) lines.push(`💨 ${m.emoji} ${m.name} ${abilityName ? `uses *${abilityName}*` : 'attacks'} — you dodge!`);
    else {
      let dmg = Math.max(Math.floor(_max(player) * 0.03), Math.floor(mAtk * (c ? c.mult : 1) * (0.85 + Math.random() * 0.3)) - Math.floor(pDef * 0.4));
      dmg = Math.floor(dmg * (1 + (pm.dmgTaken || 0) / 100) * (1 + (pm.job && pm.job.monsterDmgTaken || 0) / 100));
      try { require('./JobSystem').noteStruck(player); } catch (e) {} // Push #96: Brawler counter window
      try { dmg = Math.floor(dmg * (1 + UC.tempBuffPct(player, 'damageTaken') / 100) * UC.weakenTakenMult(player)); } catch (e) {}
      try { const NX = require('./Necromancy'); const ab = NX.absorb(player, dmg); if (ab.absorbed > 0) { dmg = ab.dmg; lines.push(NX.shieldLine(ab, player.name) || `🛡️ Absorbed ${ab.absorbed}`); } } catch (e) {}
      player.stats.hp = Math.max(0, player.stats.hp - dmg);
      if (pm.surviveLethal && player.stats.hp <= 0 && (!player._lethalUsedAt || Date.now() - player._lethalUsedAt > 2 * 3600e3)) { player.stats.hp = 1; player._lethalUsedAt = Date.now(); lines.push(`🛡️ *Undying will!* You survive at 1 HP.`); }
      lines.push(`${m.emoji} ${m.name} ${abilityName ? `uses *${abilityName}*` : 'attacks'} — you take *${dmg}* → ${player.stats.hp}/${_max(player)}`);
      if (pm.reflect > 0 && dmg > 0) { const r = Math.max(1, Math.floor(dmg * pm.reflect / 100)); m.stats.hp = Math.max(0, m.stats.hp - r); lines.push(`🔁 Reflected *${r}*`); }
      try { if (dmg > 0) { const rf = UC.reflectDamage(player, m, dmg); if (rf && rf.back > 0) lines.push(rf.line); } } catch (e) {}
      if (ability && player.stats.hp > 0) { try { const fx = MSFX.apply(m, player, ability, dmg); lines.push(...fx.lines); } catch (e) {} }
    }
    try { const dl = DS.monsterTry(inst, m, [player], { boss: m.isBoss, rank: m.rank }); if (dl) lines.push(dl); } catch (e) {}
  }
  if ((player.stats.hp || 0) <= 0) {
    player.stats.hp = 1; // the instance is a trial, not a grave
    const summary = end(player, false);
    return { ok: true, lines: [...lines, `💀 *You fall on floor ${summary.floor}.*`, ...summary.lines], ended: true, passed: summary.passed };
  }
  return { ok: true, lines, ended: false };
}

function end(player, voluntary) {
  const inst = player.instance; if (!inst || !inst.active) return { lines: ['Not inside an instance.'], floor: inst && inst.last ? inst.last.floor : 0, passed: !!(inst && inst.last && inst.last.passed) };
  const job = JS.BY_KEY[inst.job];
  const lines = [`📜 *INSTANCE ${voluntary ? 'LEFT' : 'OVER'}* — ${job ? job.emoji + ' ' + job.name : ''} quest · floor ${inst.floor} · ${inst.kills} kills`, `💠 ${inst.gold.toLocaleString()} Mana Stones · 🧭 ${inst.jobXp} Job XP`, inst.passed ? `🏆 Quest cleared — /job change ${job ? job.name : ''}` : `❌ Quest failed — target was floor ${inst.target}. Another key, another try.`];
  player.instance = { active: false, last: { job: inst.job, floor: inst.floor, passed: inst.passed, at: Date.now() } };
  try { player.statusEffects = []; if (player.tempBuffs) for (const k of Object.keys(player.tempBuffs)) if (k.startsWith('domain:')) delete player.tempBuffs[k]; } catch (e) {}
  return { lines, floor: inst.floor, passed: inst.passed };
}

function status(player) {
  const inst = player.instance;
  if (!inst || !inst.active) return null;
  const job = JS.BY_KEY[inst.job]; const m = inst.monster;
  return [`🏚️ *INSTANCE — ${job.emoji} ${job.name.toUpperCase()} QUEST*`, `Floor *${inst.floor}* · target ${inst.target}${inst.passed ? ' ✅' : ''} · kills ${inst.kills}`, `${m.emoji} *${m.name}* [${m.rank}]${m.isBoss ? ' 👑' : ''} — HP ${m.stats.hp}/${m.stats.maxHp}`, `❤️ You: ${player.stats.hp}/${_max(player)} · ⚡ ${player.stats.energy}/${player.stats.maxEnergy}`, `⚔️ /instance attack · ✨ /instance skill <name> · 🌌 /domain expand · 🚪 /instance leave`].join('\n');
}

module.exports = { KEY_CHANCE, eligibleJobs, keys, onDailyComplete, openBox, targetFloorFor, makeMonster, start, act, end, status };
