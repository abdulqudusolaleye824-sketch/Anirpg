// ═══════════════════════════════════════════════════════════════
// GATERAID — Gate code raid (party or solo), floor-by-floor
//
//   /gateraid <CODE>                 — enter (auto party/solo)
//   /gateraid <CODE> join            — join party (guild member/affiliate)
//   /gateraid <CODE> ready           — mark yourself ready (party)
//   /gateraid <CODE> start           — leader starts when all ready (party)
//   /gateraid <CODE> status          — view raid / floor status
//   /gateraid <CODE> attack          — attack current monster
//   /gateraid <CODE> skill <name>    — use a skill
//   /gateraid <CODE> advance         — move to next floor
//   /gateraid <CODE> boss            — engage the boss
// ═══════════════════════════════════════════════════════════════
'use strict';

const GR = require('../../rpg/dungeons/GateRaid');
const { GateManager, GATE_RANKS } = require('../../rpg/dungeons/GateManager');
const { AuraSystem } = require('../../rpg/utils/AuraSystem');
const LevelUpManager = require('../../rpg/utils/LevelUpManager');
const { awardXP } = require('../../rpg/utils/SilentXP');

const XP_PER_MONSTER = { F:200, E:600, D:1800, C:6000, B:20000, A:70000, S:250000, DISASTER:1000000 };
const XP_BOSS_MULT = 5;

function bare(sender) {
  return GR.GKM.normaliseJid(sender);
}

// ── Status summary helper (mirrors dungeon.js — gateraid previously crashed
//    with "statusSummary is not defined" on every attack) ─────────────────
function statusSummary(entity){ if(!entity||!entity.statusEffects||!entity.statusEffects.length) return null; const m={burn:'🔥 Burn -15 HP', poison:'☠️ Poison -10 HP', bleed:'🩸 Bleed -12 HP', stun:'💫 Stun skip', freeze:'❄️ Freeze skip + -3% HP', paralyze:'⚡ Paralyze 70% skip', weaken:'💔 Weaken -30% ATK', curse:'👁️ Curse -15% DEF', fear:'😱 Fear -20% ATK', enfeeble:'🐢 Enfeeble -30% DEF', trueslow:'🐌 Slow -35% SPD', silence:'🤐 Silence', blind:'🌫️ Blind -50% ACC'}; return entity.statusEffects.map(s=>{ const k=(s.type||'').toLowerCase(); const desc=m[k]||k; const dur=s.duration||s.turns||'?'; return `${desc} (${dur}t)`; }).join(' | '); }

module.exports = {
  name: 'gateraid',
  aliases: ['raid', 'gr'],
  description: '⚔️ Run a gate raid with a gate code (party or solo)',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key?.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];
    if (!player) return sock.sendMessage(chatId, { text: '❌ Register first.' }, { quoted: msg });
    const UI = require('../../rpg/utils/UI');
    const pro = UI.isPro(player);
    const FRAME = pro ? UI.PRO_BAR : UI.FREE_BAR;

    // ── Must be in a registered dungeon GC ───────────────────────
    if (chatId.endsWith('@g.us') && !GR.GKM.isDungeonGC(chatId)) {
      const allGCs = GR.GKM.getAllDungeonGCs();
      const gcList = Object.values(allGCs);
      if (gcList.length > 0) {
        return sock.sendMessage(chatId, {
          text: `❌ *Gate raids must be started in a dungeon GC.*\n\nUse this command in your dungeon group instead.\nGroup ID: \`${gcList[0].chatId}\``,
        }, { quoted: msg });
      }
      return sock.sendMessage(chatId, {
        text: `❌ No dungeon GC registered.\nAsk the owner: */setdungeon*`,
      }, { quoted: msg });
    }

    let code = (args[0] || '').toUpperCase().replace(/^--/, '').trim();
    let action = (args[1] || '').toLowerCase() || 'enter';
    let skillArg = args.slice(2).join(' ');

    // Shorthand: /gateraid attack  OR  /gateraid skill <name>  OR  /attack routing via attacks.js
    // Also support /attack or /attack <id> directly in gate raid (via attacks.js detective)
    // If code looks like an action and no second arg, infer code from active raid
    const ACTIONS = ['attack','skill','status','advance','boss','join','ready','start','enter','open','start-raid','help'];
    const isCodeAction = ACTIONS.includes(code.toLowerCase());
    if (isCodeAction || !code) {
      // Try to infer code from player's active gate raid
      let inferred = null;
      // Check via attacks.js detective or via GKM
      try {
        const atkDetect = require('./attacks');
        // try to find active gate via GateManager
        const GM = require('../../rpg/dungeons/GateManager');
        for (const g of Object.values(GM.GateManager.gates || {})) {
          if (g.raid && g.raid.status === 'active') {
            const isMember = g.raid.members?.some(m => String(m.id).split('@')[0].replace(/[^0-9]/g,'') === String(sender).split('@')[0].replace(/[^0-9]/g,''));
            if (isMember) { inferred = g.raid.key || g.id; break; }
          }
        }
        if (!inferred) {
          const gc = require('../../rpg/dungeons/GateKeyManager').getDungeonGC(chatId);
          if (gc?.activeKeyId) inferred = gc.activeKeyId;
        }
      } catch(e){}
      if (inferred) {
        if (isCodeAction) {
          // Shift: code was actually action
          skillArg = action ? (action + (skillArg ? ' ' + skillArg : '')) : skillArg;
          // For skill, skillArg already contains second token? Handle special
          if (code.toLowerCase() === 'skill') {
            // code=skill, action=skillName, skillArg=rest
            skillArg = action + (skillArg ? ' ' + skillArg : '');
          } else if (code.toLowerCase() === 'attack') {
            // /gateraid attack <id> -> code=ATTACK, action=<id>
            // Pass pattern id via skillArg
            skillArg = action;
          }
          action = code.toLowerCase();
          code = inferred;
        } else if (!code) {
          // /gateraid with no args -> status?
          code = inferred;
          action = 'status';
        }
      }
    }

    if (!code) {
      return sock.sendMessage(chatId, {
        text: [
          ...(pro ? [UI.PRO_BAR, `⚔️ *GATE RAID* 💎`, UI.PRO_BAR] : [`⚔️ *GATE RAID*`, UI.FREE_BAR]),
          `Use your gate code to start a raid.`,
          ``,
          `📌 *COMMANDS:*`,
          `• /attack or /attack <id> — attack (works inside gate raid, no code needed)`,
          `• /gateraid <CODE>          — enter (auto party/solo)`,
          `/gateraid <CODE> join     — join party`,
          `/gateraid <CODE> ready    — mark ready`,
          `/gateraid <CODE> start    — start (party leader)`,
          `/gateraid <CODE> status   — status`,
          `• Or in-raid: /gateraid attack / /gateraid skill <name> (code inferred)`,
          `${FRAME}`,
          `💡 Guild member → party raid.\n   No-guild hunter → solo raid.\n   Affiliate key → open to everyone.`,
          ...(pro ? [FRAME] : [FRAME, UI.upsell()]),
        ].join('\n'),
      }, { quoted: msg });
    }

    // ── Resolve the gate by code ────────────────────────────────
    const resolved = GR.resolveCode(code);
    if (!resolved.ok) return sock.sendMessage(chatId, { text: resolved.error }, { quoted: msg });
    const { key, keyData, gate } = resolved;

    // Bind the raid to this dungeon GC
    keyData.dungeonChatId = chatId;
    const gc = GR.GKM.getDungeonGC(chatId);
    if (gc && gc.activeKeyId && gc.activeKeyId !== key) {
      return sock.sendMessage(chatId, { text: '❌ This dungeon GC already has an active gate raid. Clear it first.' }, { quoted: msg });
    }
    if (gc) gc.activeKeyId = key;

    const rd = GATE_RANKS[gate.rank] || GATE_RANKS['E'];

    // ── ENTER (default) ─────────────────────────────────────────
    if (action === 'enter' || action === 'open' || action === 'start-raid') {
      const res = GR.enter(sender, player.name, key, keyData, gate, db);
      if (!res.ok) return sock.sendMessage(chatId, { text: `❌ ${res.error}` }, { quoted: msg });
      saveDatabase();

      const isOpenKey = !!keyData.isAffiliate;
      const solo = res.raid.members.length <= 1;
      return sock.sendMessage(chatId, {
        text: [
          `${FRAME}`,
          ...(pro ? [`${rd.emoji} *${solo ? 'SOLO' : 'PARTY'} RAID — RECRUITING* 💎`, UI.PRO_BAR] : [`${rd.emoji} *${solo ? 'SOLO' : 'PARTY'} RAID — RECRUITING*`, UI.FREE_BAR]),
          `${rd.label} [${gate.id}]`,
          ``,
          isOpenKey
            ? `🔓 *Affiliate key* — open to everyone, no guild required.`
            : `🏰 *Guild key* — open to the owning guild's members.`,
          `👑 Leader: *${player.name} (you)*`,
          ``,
          `📌 *STEPS:*`,
          isOpenKey
            ? `1️⃣ Anyone: /gateraid ${key} join`
            : `1️⃣ Guild members: /gateraid ${key} join`,
          `2️⃣ Everyone: /gateraid ${key} ready`,
          `3️⃣ Leader: /gateraid ${key} start`,
          ``,
          `📊 /gateraid ${key} status — see who's ready`,
          FRAME,
          `💡 A gate instantly opens when you use a code.`,
          `   Add friends above, or start solo with just you.`,
          ...(pro ? [FRAME] : [FRAME, UI.upsell()]),
        ].join('\n'),
      }, { quoted: msg });
    }

    // ── JOIN ────────────────────────────────────────────────────
    if (action === 'join') {
      if (!gate.raid) return sock.sendMessage(chatId, { text: '❌ Start the raid first: /gateraid ' + key }, { quoted: msg });
      const res = GR.join(sender, player.name, gate, db);
      if (!res.ok) return sock.sendMessage(chatId, { text: `❌ ${res.error}` }, { quoted: msg });
      saveDatabase();
      return sock.sendMessage(chatId, {
        text: `✅ *${player.name}* joined the party!\n👥 Members: ${res.raid.members.length}\n\nMark ready: /gateraid ${key} ready`,
        mentions: [sender],
      }, { quoted: msg });
    }

    // ── READY ───────────────────────────────────────────────────
    if (action === 'ready') {
      const res = GR.ready(sender, gate);
      if (!res.ok) return sock.sendMessage(chatId, { text: `❌ ${res.error}` }, { quoted: msg });
      saveDatabase();
      const raid = gate.raid;
      let txt = `✅ *${player.name}* is ready!\n\n`;
      raid.members.forEach(m => { txt += `  ${m.id === raid.leader ? '👑' : '⚔️'} ${m.name} ${m.ready ? '✅' : '⏳'}\n`; });
      if (res.allReadied) txt += `\n🎉 *ALL READY!* Leader: /gateraid ${key} start`;
      return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
    }

    // ── START (party) ───────────────────────────────────────────
    if (action === 'start') {
      const res = GR.start(sender, keyData, gate, db);
      if (!res.ok) return sock.sendMessage(chatId, { text: `❌ ${res.error}` }, { quoted: msg });
      saveDatabase();
      const raid = res.raid;
      return sock.sendMessage(chatId, {
        text: [
          ...(pro ? [UI.PRO_BAR, `${rd.emoji} *RAID STARTED!* 💎`, UI.PRO_BAR] : [`${rd.emoji} *RAID STARTED!*`, UI.FREE_BAR]),
          `${rd.label} [${gate.id}]`,
          `🗺️ Floor 1/${gate.totalFloors}`,
          ``,
          `👥 *Party (${raid.members.length}):*`,
          ...raid.members.map(m => `  ${m.id === raid.leader ? '👑' : '⚔️'} ${m.name}`),
          ``,
          `⚔️ /gateraid ${key} attack`,
          `🔮 /gateraid ${key} skill <name>`,
          `📊 /gateraid ${key} status`,
          ...(pro ? [FRAME, UI.PRO_MINI, `💎 *PRO BREACH* — ${rd.label} · ${raid.members.length} hunters · ${gate.totalFloors} floors`] : [FRAME, UI.upsell()]),
        ].join('\n'),
      }, { quoted: msg });
    }

    // ── STATUS ──────────────────────────────────────────────────
    if (action === 'status' || action === 'info') {
      const m = gate.raid?.members?.find(x => x.id === sender);
      if (!gate.raid && !gate.raiders?.includes(sender)) {
        return sock.sendMessage(chatId, { text: '❌ Start a raid first with your code.' }, { quoted: msg });
      }
      if (gate.raid && !gate.raid.members.some(x => x.id === sender) && !gate.raiders?.includes(sender)) {
        return sock.sendMessage(chatId, { text: '❌ You are not part of this raid.' }, { quoted: msg });
      }
      return sock.sendMessage(chatId, { text: GR.statusOf(gate, db) }, { quoted: msg });
    }

    // ── HEAL (HEALTH POTION) ───────────────────────────────────
    if (action === 'heal' || action === 'item') {
      if (!inRaid(gate, sender)) return sock.sendMessage(chatId, { text: '❌ You are not in this raid.' }, { quoted: msg });

      // Party potion cap: max 5 health potions per gate raid collectively
      if ((gate.potionsUsed || 0) >= 5) {
        return sock.sendMessage(chatId, {
          text: `❌ *Gate Raid Health Potion Cap Reached!*\n\nCollective party cap: *5/5 Health Potions used* in this raid.`
        }, { quoted: msg });
      }

      // Find best available potion
      let tierUsed = null;
      if ((player.inventory?.higherHealthPotions || 0) > 0) tierUsed = 'higher';
      else if ((player.inventory?.mediumHealthPotions || 0) > 0) tierUsed = 'medium';
      else if ((player.inventory?.lowerHealthPotions || 0) > 0 || (player.inventory?.healthPotions || 0) > 0) tierUsed = 'lower';

      if (!tierUsed) {
        return sock.sendMessage(chatId, { text: '❌ You have no Health Potions left in your inventory!' }, { quoted: msg });
      }

      const pct = tierUsed === 'lower' ? 0.10 : tierUsed === 'medium' ? 0.25 : 0.50;
      const tierName = tierUsed === 'lower' ? 'Lower HP Potion' : tierUsed === 'medium' ? 'Medium HP Potion' : 'Higher HP Potion';
      const healAmount = Math.floor((player.stats?.maxHp || 100) * pct);
      const oldHp = player.stats.hp || 0;
      player.stats.hp = Math.min(player.stats.maxHp, oldHp + healAmount);
      const actualHeal = player.stats.hp - oldHp;

      if (tierUsed === 'lower') {
        if ((player.inventory.lowerHealthPotions || 0) > 0) player.inventory.lowerHealthPotions--;
        else if ((player.inventory.healthPotions || 0) > 0) player.inventory.healthPotions--;
      } else if (tierUsed === 'medium') {
        player.inventory.mediumHealthPotions--;
      } else if (tierUsed === 'higher') {
        player.inventory.higherHealthPotions--;
      }

      gate.potionsUsed = (gate.potionsUsed || 0) + 1;
      try { require('../../rpg/utils/QuestDispatcher').trackAndNotify(player, 'heal', 1, sock, sender, chatId); } catch(e){}
      const pm = gate.raid?.members?.find(m => m.id === sender);
      if (pm) pm.hp = player.stats.hp;

      saveDatabase();
      return sock.sendMessage(chatId, {
        text: `🩹 *${player.name}* used ${tierName}!\n💚 Restored +${actualHeal} HP (${player.stats.hp}/${player.stats.maxHp})\n🎒 Party Potions Used: ${gate.potionsUsed}/5`
      }, { quoted: msg });
    }

    // ── REVIVE (REVIVE TOKEN) ──────────────────────────────────
    if (action === 'revive') {
      if ((player.inventory?.reviveTokens || 0) <= 0) {
        return sock.sendMessage(chatId, { text: '❌ You have no Revive Tokens!' }, { quoted: msg });
      }

      // Party revive cap: max 1 revive per gate raid collectively
      if ((gate.revivesUsed || 0) >= 1) {
        return sock.sendMessage(chatId, {
          text: `❌ *Gate Raid Revive Cap Reached!*\n\nOnly *1 Revive Token* can be used collectively across the entire party in a Gate Raid.`
        }, { quoted: msg });
      }

      gate.revivesUsed = 1;
      player.inventory.reviveTokens--;
      player.stats.hp = Math.floor((player.stats?.maxHp || 100) * 0.5);

      if (gate.raid) {
        if (!gate.raid.members.some(m => m.id === sender)) {
          gate.raid.members.push({ id: sender, name: player.name, hp: player.stats.hp, energy: player.stats.energy || 100, ready: true });
        } else {
          const pm = gate.raid.members.find(m => m.id === sender);
          if (pm) pm.hp = player.stats.hp;
        }
      }
      if (!gate.raiders?.includes(sender)) {
        gate.raiders = gate.raiders || [];
        gate.raiders.push(sender);
      }

      saveDatabase();
      return sock.sendMessage(chatId, {
        text: `💫 *REVIVE USED!* *${player.name}* was revived with ${player.stats.hp}/${player.stats.maxHp} HP!\n⚠️ Party Revive Cap Reached (1/1 used).`
      }, { quoted: msg });
    }

    // ── ADVANCE ─────────────────────────────────────────────────
    if (action === 'advance') {
      if (!inRaid(gate, sender)) return sock.sendMessage(chatId, { text: '❌ You are not in this raid.' }, { quoted: msg });
      const floor = gate.currentFloor;
      const floorMonsters = (gate.monsters || []).filter(mm => mm.floor === floor && !mm.defeated);
      if (floorMonsters.length > 0) return sock.sendMessage(chatId, { text: `❌ Clear all monsters on Floor ${floor} first!` }, { quoted: msg });
      if (floor >= gate.totalFloors) return sock.sendMessage(chatId, { text: `⚠️ Final floor. Engage the boss with /gateraid ${key} boss` }, { quoted: msg });
      gate.currentFloor++;
      const next = (gate.monsters || []).filter(mm => mm.floor === gate.currentFloor && !mm.defeated);
      try {
        const QD = require('../../rpg/utils/QuestDispatcher');
        QD.trackAndNotify(player, 'floor', gate.currentFloor, sock, sender, chatId);
        QD.trackAndNotify(player, 'dungeon', 1, sock, sender, chatId);
      } catch(e){}
      saveDatabase();
      return sock.sendMessage(chatId, {
        text: [
          ...(pro ? [UI.PRO_BAR, `➡️ *FLOOR ${gate.currentFloor}* 💎`, UI.PRO_BAR] : [`➡️ *FLOOR ${gate.currentFloor}*`, UI.FREE_BAR]),
          `「System」 Entering Floor ${gate.currentFloor} of ${gate.totalFloors}...`,
          ``,
          `👾 *${next.length} monsters*:`,
          ...next.slice(0, 6).map(mm => `  💀 ${mm.name} — HP ${mm.hp}`),
          next.length > 6 ? `  ...and ${next.length - 6} more` : ``,
          ``,
          `⚔️ /gateraid ${key} attack`,
          ...(pro ? [FRAME, UI.PRO_MINI, `💎 *PRO SCOUT* — strongest: ${next.length ? UI.num(Math.max(...next.map(mm => mm.hp || 0))) : 0} HP`] : [FRAME, UI.upsell()]),
        ].filter(l => l !== '').join('\n'),
      }, { quoted: msg });
    }

    // ── ATTACK / SKILL ──────────────────────────────────────────
    if (action === 'attack' || action === 'skill') {
      if (!inRaid(gate, sender)) return sock.sendMessage(chatId, { text: '❌ You are not in this raid.' }, { quoted: msg });
      const floor = gate.currentFloor;
      const floorMonsters = (gate.monsters || []).filter(mm => mm.floor === floor && !mm.defeated);

      if (floorMonsters.length === 0) {
        if (floor >= gate.totalFloors) return sock.sendMessage(chatId, { text: `⚠️ All monsters cleared! Engage the boss:\n/gateraid ${key} boss` }, { quoted: msg });
        return sock.sendMessage(chatId, { text: `✅ Floor ${floor} cleared!\nAdvance: /gateraid ${key} advance` }, { quoted: msg });
      }

      const target = floorMonsters[0];
      // Check for attack pattern id in skillArg when action is attack (from /attack <id> routed via attacks.js)
      let patternId = null;
      if (action === 'attack' && skillArg) {
        const pid = parseInt(String(skillArg).trim().split(' ')[0]);
        if (!isNaN(pid) && pid >= 1 && pid <= 750) patternId = pid;
      }
      // Show status at start of turn — tick damage/effects then display
      let _gateStatus = null;
      let _tickLogs = [];
      try {
        const UCgTick = require('../../rpg/utils/UnifiedCombat');
        _tickLogs = UCgTick.tickStatuses(player) || [];
        if (target && target.statusEffects) {
          const _tgt = { name: target.name || 'Monster', statusEffects: target.statusEffects, stats: { hp: target.hp, maxHp: target.maxHp } };
          const tl2 = UCgTick.tickStatuses(_tgt);
          target.hp = Math.max(0, _tgt.stats.hp); // write tick damage back — the temp object is discarded
          if (tl2 && tl2.length) _tickLogs = _tickLogs.concat(tl2);
        }
      } catch(e){}
      _gateStatus = statusSummary(player) || (target && target.statusEffects ? statusSummary(target) : null);
      if (_gateStatus || _tickLogs.length) {
        try {
          let statusMsg = '';
          if (_tickLogs.length) statusMsg += _tickLogs.join('\n') + '\n';
          if (_gateStatus) statusMsg += `⚠️ *STATUS EFFECTS*\n${_gateStatus}`;
          if (statusMsg) await sock.sendMessage(chatId, { text: statusMsg.trim() }, { quoted: msg });
        } catch(e){}
      }
      // ── Frozen / stunned players lose their turn (statuses already ticked above) ──
      let _grCanAct = { canAct: true, reason: null };
      try { _grCanAct = require('../../rpg/utils/UnifiedCombat').canAct(player); } catch(e){}
      if (!_grCanAct.canAct) {
        saveDatabase();
        const _grFxMap = { frozen: ['❄️', 'FROZEN 🧊'], stunned: ['💫', 'STUNNED 💫'], paralyzed: ['🔱', 'PARALYZED 🔱'], feared: ['😱', 'FEARED 😱'] };
        const [_fxEmo, _fxWord] = _grFxMap[_grCanAct.reason] || ['💫', 'STUNNED 💫'];
        return sock.sendMessage(chatId, { text: `${FRAME}\n${_fxEmo} *YOU ARE ${_fxWord}!*${pro ? ' 💎' : ''}\n${FRAME}\n_${player.name} cannot move this turn._\nTurn skipped (0 dmg, status -1).\n${FRAME}` }, { quoted: msg });
      }
      let result;
      let atkPattern = null;
      if (patternId) {
        const DBp = require('../../rpg/utils/AttackPatternDB');
        const UCg = require('../../rpg/utils/UnifiedCombat');
        const atk = DBp.generateAttack(patternId);
        atkPattern = atk;
        if (!atk) result = { damage:0, blocked:true, reason:'Invalid pattern' };
        else {
          const owned = player.attackPatterns?.owned || [];
          const equipped = player.attackPatterns?.equipped || [];
          if (!owned.includes(patternId)) {
            result = { damage:0, blocked:true, reason:`You don't own Attack #${patternId}` };
          } else if (!equipped.includes(patternId)) {
            result = { damage:0, blocked:true, reason:`Attack #${patternId} is not equipped — equip it first: /attacks equip ${patternId}` };
          } else {
            const cd = UCg.isOnCooldown(player, patternId);
            if (cd.onCd) {
              result = { damage:0, blocked:true, reason:`attack failed — still on cooldown ${UCg.formatCd(cd.remaining)} remaining (0 dmg, status -1)` };
              try { UCg.tickStatuses(player); } catch(e){}
              // status -1 already
            } else {
              // Unified calc: treat monster as defender
              const fakeMonster = { stats:{ hp: target.hp, maxHp: target.maxHp, atk: target.atk, def: target.def||5, speed: 30 }, statusEffects: (target.statusEffects = target.statusEffects || []) };
              const uni = UCg.calcMoveDamage(player, fakeMonster, atk);
              if (uni.missed) result = { damage:0, isCrit:false, atkPattern: atk, missed:true };
              else { result = { damage: uni.damage, isCrit: uni.crit, atkPattern: atk, unified: uni }; target.hp = Math.max(0, target.hp - uni.damage); UCg.setCooldown(player, patternId, atk); const eff=UCg.tryApplyEffect(atk, player, fakeMonster); if(eff) result.effectApplied = eff; }
              // If not missed, we already set hp; if we set hp above, avoid double-set below
              // To avoid double damage, we will not do the generic target.hp subtraction below — we already did
              // So we need to handle that we already subtracted
              if (!uni.missed) {
                // we have already applied damage, so we will skip the generic subtraction by setting a flag
                result._alreadyApplied = true;
              } else {
                result._alreadyApplied = true;
              }
            }
          }
        }
      } else {
        const useSkill = action === 'skill' ? skillArg : null;
        result = GR.playerDamage(player, useSkill);
      }
      if (result.blocked) return sock.sendMessage(chatId, { text: `❌ ${result.reason}` }, { quoted: msg });

      // Daily quest: attack pattern actually used in combat
      if (atkPattern) { try { require('../../rpg/utils/QuestDispatcher').trackAndNotify(player, 'pattern', 1, sock, sender, chatId); } catch(e){} }

      if (!gate.damageDealt) gate.damageDealt = {};
      gate.damageDealt[sender] = (gate.damageDealt[sender] || 0) + result.damage;

      if (!result._alreadyApplied) target.hp = Math.max(0, target.hp - result.damage);

      const UCgBar = require('../../rpg/utils/UnifiedCombat');
      const BarG = require('../../rpg/utils/BarSystem');
      const pBarG = BarG.getHPBar(player.stats.hp, player.stats.maxHp, UCgBar.isPro(player));
      const atkTitle = atkPattern ? `🥋 *ATTACK PATTERN #${atkPattern.id} — ${atkPattern.name}* [${atkPattern.rank}]` : `⚔️ *PLAYER ATTACK*`;
      const msg1Lines = [
        ...(pro ? [UI.PRO_BAR, `${atkTitle} 💎`, UI.PRO_BAR] : [atkTitle, UI.FREE_BAR]),
        atkPattern ? `_${(atkPattern.description||atkPattern.flavour).slice(0,200)}_` : ``,
        atkPattern ? `📊 Atk×${atkPattern.atkMult} Def×${atkPattern.defMult} Spd×${atkPattern.speedMult} Crit×${atkPattern.critMult} Acc ${atkPattern.accuracy}%` : ``,
        `⚔️ *${player.name}* → *${target.name}*`,
        result.skillUsed ? `🔮 Skill: *${result.skillUsed.name}*` : (atkPattern ? `` : ``),
        result.missed ? `💨 *Missed!* Accuracy ${atkPattern?.accuracy || 85}%` : `${result.isCrit ? '💥 *CRITICAL HIT!* ' : ''}Dealt *${result.damage}* damage${result.effectApplied ? ` ${result.effectApplied.emoji} ${result.effectApplied.type} applied!` : ''}`,
        `👾 ${target.name} HP: ${target.hp}/${target.maxHp} ${BarG.getMonsterHPBar(target.hp, target.maxHp)}`,
        `❤️ You: ${pBarG} ${player.stats.hp}/${player.stats.maxHp}`,
      ];
      if (pro) msg1Lines.push(`💎 *PRO FOCUS* — your raid damage: ${UI.num(gate.damageDealt[sender])}`);

      if (target.hp <= 0) {
        target.defeated = true;
        gate.monstersKilled = (gate.monstersKilled || 0) + 1;
        if (!player.stats_history) player.stats_history = {};
        player.stats_history.monstersKilled = (player.stats_history.monstersKilled || 0) + 1;
        try { require('../../rpg/utils/QuestDispatcher').trackAndNotify(player, 'kill', 1, sock, sender, chatId); } catch(e){}

        try { const BR=require('../../rpg/utils/BattleRewards'); const w=BR.giveBattleWinRewards(player, db, 'gate', player.level); msg1Lines.push(``, `💀 *${target.name}* defeated!`, BR.formatRewards(w)); } catch(e){ awardXP(player, 'gate_complete', saveDatabase, sock, chatId); msg1Lines.push(``, `💀 *${target.name}* defeated!`); }

        const heal = GR.lifeSteal(player, result.damage);
        if (heal > 0) { player.stats.hp = Math.min(player.stats.maxHp, (player.stats.hp || 0) + heal); msg1Lines.push(`💚 Lifesteal: +${heal} HP`); }

        const dropLines = GR.monsterKilledBy(gate, target, sender, db);
        if (dropLines.length) msg1Lines.push(...dropLines);

        const remaining = floorMonsters.filter(mm => !mm.defeated).length - 1;
        msg1Lines.push(``, `👾 *${Math.max(0, remaining)}* monsters remaining on Floor ${floor}`);

        if (remaining <= 0) {
          const fNexus = Math.floor((gate.nexusLoot || 1000) / (gate.totalFloors || 1));
          const fCrystals = Math.floor((gate.crystalLoot || 100) / (gate.totalFloors || 1));
          if (!gate.accumulatedTreasure) gate.accumulatedTreasure = { nexus: 0, crystals: 0 };
          gate.accumulatedTreasure.nexus += fNexus;
          gate.accumulatedTreasure.crystals += fCrystals;

          msg1Lines.push(``, `💰 *Floor ${floor} Treasure Accumulated:* +${fNexus.toLocaleString()} 💠 Nexus & +${fCrystals.toLocaleString()} 💎 Mana Stones`);

          if (floor >= gate.totalFloors) { msg1Lines.push(``, `🏆 *BOSS FLOOR REACHED!*`, `/gateraid ${key} boss — Engage the boss!`); }
          else { msg1Lines.push(``, `✅ *Floor ${floor} CLEARED!*`, `/gateraid ${key} advance — Floor ${floor + 1}`); }
        }

        saveDatabase();
        return sock.sendMessage(chatId, { text: msg1Lines.filter(Boolean).join('\n') }, { quoted: msg });
      }

      // Monster counter-attack (frozen/stunned monsters lose their turn)
      let _monCanAct = { canAct: true, reason: null };
      try { _monCanAct = require('../../rpg/utils/UnifiedCombat').canAct({ statusEffects: target.statusEffects || [] }); } catch(e){}
      const def = (player.stats?.def || 5) + (player.equipped?.armor?.def || 0);
      const dmg = _monCanAct.canAct ? GR.monsterDamage(target, def) : 0;
      if (_monCanAct.canAct) player.stats.hp = Math.max(0, (player.stats.hp || 0) - dmg);

      const skillPool = [
        { name: '🔥 Flame Spurt', effect: 'burn' },
        { name: '⚡ Volt Shock', effect: 'stun' },
        { name: '🩸 Savage Bite', effect: 'bleed' },
        { name: '😱 Terror Howl', effect: 'fear' },
        { name: '🌀 Void Crush', effect: 'weaken' }
      ];
      const monsterSkill = _monCanAct.canAct ? skillPool[Math.floor(Math.random() * skillPool.length)] : null;
      // Monster skills now REALLY inflict their status (burn/stun/bleed/fear/weaken)
      if (monsterSkill) {
        try {
          if (!player.statusEffects) player.statusEffects = [];
          const _ex = player.statusEffects.find(e => (e.type||'').toLowerCase() === monsterSkill.effect);
          if (_ex) _ex.duration = Math.max(_ex.duration || 0, 2);
          else player.statusEffects.push({ type: monsterSkill.effect, duration: 2 });
        } catch(e){}
      }

      const msg2Lines = _monCanAct.canAct ? [
        ...(pro ? [UI.PRO_BAR, `💢 *MONSTER COUNTER-ATTACK* 💎`, UI.PRO_BAR] : [`💢 *MONSTER COUNTER-ATTACK*`, UI.FREE_BAR]),
        `💢 *${target.name}* uses *${monsterSkill.name}*!`,
        `⚡ Inflicted: *${monsterSkill.effect.toUpperCase()}*`,
        `💥 Took *${dmg}* damage`,
        `❤️ Your HP: *${player.stats.hp}/${player.stats.maxHp}*`,
      ] : [
        ...(pro ? [UI.PRO_BAR, `🧊 *MONSTER FROZEN* 💎`, UI.PRO_BAR] : [`🧊 *MONSTER FROZEN*`, UI.FREE_BAR]),
        `❄️ *${target.name}* is ${_monCanAct.reason === 'frozen' ? 'frozen solid' : 'stunned'} and cannot move!`,
        `💥 Took *0* damage`,
        `❤️ Your HP: *${player.stats.hp}/${player.stats.maxHp}*`,
      ];

      if (player.stats.hp <= 0) {
        const PetManager = require('../../rpg/utils/PetManager');
        const sac = PetManager.checkPetSacrifice(sender, player);
        if (sac && sac.sacrificed) {
          msg2Lines.push(``, sac.message);
        } else {
          player.stats.hp = 1;
          player.stats_history = player.stats_history || {};
          player.stats_history.gateDeaths = (player.stats_history.gateDeaths || 0) + 1;
          const loss = Math.floor((player.manaCrystals || 0) * 0.15);
          player.manaCrystals = Math.max(0, (player.manaCrystals || 0) - loss);

          const retNexus = Math.floor((gate.accumulatedTreasure?.nexus || 0) * 0.50);
          const retCrystals = Math.floor((gate.accumulatedTreasure?.crystals || 0) * 0.50);
          if (retNexus > 0 || retCrystals > 0) {
            player.gold = (player.gold || 0) + retNexus;
            if (retNexus > 0) {
              try { require('../../rpg/utils/QuestDispatcher').trackAndNotify(player, 'goldEarn', retNexus, sock, sender, chatId); } catch(e){}
            }
            player.manaCrystals = (player.manaCrystals || 0) + retCrystals;
            msg2Lines.push(``, `💰 *50% PARTY TREASURE SALVAGED:* +${retNexus.toLocaleString()} 💠 Nexus | +${retCrystals.toLocaleString()} 💎 Mana Stones`);
          }

          msg2Lines.push(``, `💀 *YOU FELL IN THE GATE!*`, `Lost ${loss.toLocaleString()} 💎`, `You fled with 1 HP.`);
          if (gate.raid) gate.raid.members = gate.raid.members.filter(m => m.id !== sender);
          gate.raiders = (gate.raiders || []).filter(r => r !== sender);
          saveDatabase();
          return sock.sendMessage(chatId, { text: msg1Lines.concat([''], msg2Lines).filter(Boolean).join('\n') }, { quoted: msg });
        }
      }

      let _nextStatus2 = null;
      try { _nextStatus2 = statusSummary(player); } catch(e){}
      const msg3Lines = [
        ...(pro ? [UI.PRO_BAR, `🎮 *NEXT TURN* 💎`, UI.PRO_BAR] : [`🎮 *NEXT TURN*`, UI.FREE_BAR]),
        ...(_nextStatus2 ? [`⚠️ *YOUR STATUS:* ${_nextStatus2}`] : []),
        `⚔️ /gateraid ${key} attack`,
        `🔮 /gateraid ${key} skill <name>`,
        `🩹 /use heal`,
        ...(pro ? [FRAME] : [FRAME, UI.upsell()]),
      ];

      saveDatabase();
      return sock.sendMessage(chatId, {
        text: msg1Lines.concat([''], msg2Lines, [''], msg3Lines).filter(Boolean).join('\n')
      }, { quoted: msg });
    }

    // ── BOSS ────────────────────────────────────────────────────
    if (action === 'boss') {
      if (!inRaid(gate, sender)) return sock.sendMessage(chatId, { text: '❌ You are not in this raid.' }, { quoted: msg });
      const floor = gate.currentFloor;
      const floorMonsters = (gate.monsters || []).filter(mm => mm.floor === floor && !mm.defeated);
      if (floorMonsters.length > 0) return sock.sendMessage(chatId, { text: `❌ Clear all floor ${floor} monsters first!` }, { quoted: msg });
      if (floor < gate.totalFloors) return sock.sendMessage(chatId, { text: `❌ Reach Floor ${gate.totalFloors} before engaging the boss.` }, { quoted: msg });
      if (gate.boss.defeated) return sock.sendMessage(chatId, { text: '✅ Boss already defeated!' }, { quoted: msg });

      const boss = gate.boss;
      const result = GR.playerDamage(player, skillArg || null);
      if (result.blocked) return sock.sendMessage(chatId, { text: `❌ ${result.reason}` }, { quoted: msg });

      if (!gate.damageDealt) gate.damageDealt = {};
      gate.damageDealt[sender] = (gate.damageDealt[sender] || 0) + result.damage;
      boss.hp = Math.max(0, boss.hp - result.damage);

      const lines = [
        ...(pro ? [UI.PRO_BAR, `🏆 *BOSS BATTLE* 💎`, UI.PRO_BAR] : [`🏆 *BOSS BATTLE*`, UI.FREE_BAR]),
        `💀 *${boss.name}*`,
        ``,
        `⚔️ *${player.name}* ${result.skillUsed ? `→ *${result.skillUsed.name}*` : '→ attacks!'}`,
        `${result.isCrit ? '💥 CRITICAL! ' : ''}Dealt *${result.damage}* damage`,
        ``,
        `👁️ Boss HP: ${boss.hp.toLocaleString()} / ${boss.maxHp.toLocaleString()}`,
      ];

      if (boss.hp <= 0) {
        boss.defeated = true;
        AuraSystem.addAura(player, 'bossKill');
        try {
          const QD = require('../../rpg/utils/QuestDispatcher');
          QD.trackAndNotify(player, 'boss', 1, sock, sender, chatId);
          QD.trackAndNotify(player, 'clear', 1, sock, sender, chatId);
        } catch(e){}
        // Gate clear: +15 GP to the killer's guild (weekly + lifetime + quest)
        try { require('../../rpg/utils/GuildPointsSystem').addGuildGP(db, sender, 15, 'Gate clear (' + (gate.rank || '?') + '-Rank)', { quest: true, sock, jid: sender, chatId }); } catch(e){}

        const damageDealt = gate.damageDealt || {};
        const topRaider = Object.entries(damageDealt).sort((a, b) => b[1] - a[1])[0];
        if (topRaider && topRaider[0] === sender) AuraSystem.addAura(player, 'topRaider');

        awardXP(player, 'gate_boss', saveDatabase, sock, chatId);
        try { const BRb=require('../../rpg/utils/BattleRewards'); const wb=BRb.giveBattleWinRewards(player, db, 'gate', player.level); lines.push(BRb.formatRewards(wb)); } catch(e){}

        // Final-blow boss loot → the killer
        const bossDropLines = [];
        const bossDrop = GateManager.rollMonsterKillDrop(gate.rank, boss.name);
        if (bossDrop) {
          require('../../rpg/utils/RewardInventory').grantItem(player, { ...bossDrop, type: bossDrop.type || 'material', fromGate: gate.id }, 'gate');
          bossDropLines.push(`🎁 *BOSS DROP → ${player.name}* (final blow): *${bossDrop.name}*`);
        }

        // Distribute full loot: gold→guild treasury, drops→final-blow, recovery
        const loot = GR.clearGate(gate, key, keyData, db, saveDatabase);

        lines.push(``, `💀 *${boss.name}* HAS BEEN DEFEATED!`, ``);
        lines.push(`🔥 Aura gained!`);
        if (bossDropLines.length) lines.push(...bossDropLines);
        lines.push(``, `🎁 *LOOT → ${loot.destinationText}*`);
        lines.push(`💠 ${loot.nexus.toLocaleString()} Nexus | 💎 ${loot.crystals.toLocaleString()} Mana Stones`);
        if (loot.affiliatePayouts && Object.keys(loot.affiliatePayouts).length) {
          lines.push(``, `🤝 *Affiliate / recruiter payouts:*`);
          for (const [jid, p] of Object.entries(loot.affiliatePayouts)) {
            const nm = db.users?.[jid]?.name || jid.split('@')[0];
            lines.push(`  • *${nm}* — ${p.percent}% → ${p.gold.toLocaleString()} 💠 + ${p.crystals} 💎`);
          }
        }
        if (loot.contractPayouts && Object.keys(loot.contractPayouts).length) lines.push(`📋 Contracts paid out automatically.`);

        if (loot.wildPet && loot.wildPet.token) {
          lines.push(``, `🐾 *WILD PET APPEARED!*`);
          lines.push(`${loot.wildPet.emoji} *${loot.wildPet.name}* [${loot.wildPet.rarity.toUpperCase()}]`);
          lines.push(`🪤 /caught ${loot.wildPet.token} — hurry, it flees in 60s!`);
        }

        lines.push(``, `💚 *All members: 50% recovery + no cooldown.*`);
        lines.push(`🚪 *GATE ${gate.id} CLEARED!*`);
        lines.push(FRAME);
        if (pro) {
          const topName = topRaider ? (db.users?.[topRaider[0]]?.name || 'a raider') : 'none';
          lines.push(UI.PRO_MINI, topRaider && topRaider[0] === sender ? `💎 *PRO SLAYER* — TOP raid damage: ${UI.num(topRaider[1])}! 🔥` : `💎 *PRO SLAYER* — top: ${topName} (${topRaider ? UI.num(topRaider[1]) : 0})`);
        } else lines.push(UI.upsell());
      } else {
        const def = (player.stats?.def || 5) + (player.equipped?.armor?.def || 0);
        const bossAtk = Math.floor(GATE_RANKS[gate.rank].monsterRange[1] * 0.20);
        const dmg = Math.max(10, bossAtk - Math.floor(def * 0.4));
        player.stats.hp = Math.max(0, (player.stats.hp || 0) - dmg);
        const heal = GR.lifeSteal(player, result.damage);
        if (heal > 0) player.stats.hp = Math.min(player.stats.maxHp, player.stats.hp + heal);
        lines.push(``, `💢 *${boss.name}* retaliates!`, `Took *${dmg}* damage`);
        if (heal > 0) lines.push(`💚 Lifesteal: +${heal} HP`);
        lines.push(`❤️ Your HP: *${player.stats.hp}/${player.stats.maxHp}*`);

        if (player.stats.hp <= 0) {
          const PetManager = require('../../rpg/utils/PetManager');
          const sac = PetManager.checkPetSacrifice(sender, player);
          if (sac && sac.sacrificed) {
            lines.push(``, sac.message);
          } else {
            player.stats.hp = 1;
            player.stats_history = player.stats_history || {};
            player.stats_history.gateDeaths = (player.stats_history.gateDeaths || 0) + 1;
            const loss = Math.floor((player.manaCrystals || 0) * 0.15);
            player.manaCrystals = Math.max(0, (player.manaCrystals || 0) - loss);
            lines.push(``, `💀 *YOU FELL BEFORE THE BOSS!*`, `Lost ${loss.toLocaleString()} 💎`, `You fled with 1 HP.`);
            // Remove from raid
            if (gate.raid) gate.raid.members = gate.raid.members.filter(m => m.id !== sender);
            gate.raiders = (gate.raiders || []).filter(r => r !== sender);
            saveDatabase();
            return sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: msg });
          }
        }

        lines.push(``, `⚔️ /gateraid ${key} boss — Attack again`);
      }

      const pm = gate.raid?.members?.find(m => m.id === sender);
      if (pm) { pm.hp = player.stats.hp; pm.energy = player.stats.energy; }

      saveDatabase();
      return sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: msg });
    }

    return sock.sendMessage(chatId, {
      text: `Usage: /gateraid ${key} [join|ready|start|attack|skill <name>|status|advance|boss]`,
    }, { quoted: msg });
  },
};

// Helper: is the sender an active raider of this gate?
function inRaid(gate, sender) {
  if (gate.raid && gate.raid.members.some(m => m.id === sender)) return true;
  if ((gate.raiders || []).includes(sender)) return true;
  return false;
}
