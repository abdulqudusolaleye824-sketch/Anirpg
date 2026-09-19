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
const PetCombat = require('../../rpg/utils/PetCombat');
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
function statusSummary(entity){ if(!entity||!entity.statusEffects||!entity.statusEffects.length) return null; const m={burn:'🔥 Burn -5% HP', poison:'☠️ Poison -3% HP', bleed:'🩸 Bleed -4% HP', stun:'💫 Stun skip + -50% SPD', freeze:'❄️ Freeze skip + -4% HP', paralyze:'🔱 Paralyze no-move', weaken:'💔 Weaken -75% ATK', weakness:'💔 Weakness -75% ATK', curse:'👁️ Curse -15% DEF', fear:'😱 Fear -50% all', enfeeble:'🐢 Enfeeble -30% DEF', trueslow:'🐌 Slow -35% SPD', silence:'🤐 Silence', blind:'🌫️ Blind -50% ACC'}; return entity.statusEffects.map(s=>{ const k=(s.type||'').toLowerCase(); const desc=m[k]||k; const dur=s.duration||s.turns||'?'; return `${desc} (${dur}t)`; }).join(' | '); }

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
    // Batch-47: Astral-registered dungeon chats (/setgroup dungeon) count
    // too — mirrored into the raid registry on first raid here.
    if (chatId.endsWith('@g.us') && !GR.GKM.isDungeonGC(chatId)) {
      try {
        const _AG = require('../../rpg/utils/AstralGroups');
        if (_AG.hosts(db, chatId, 'dungeon')) {
          GR.GKM.setDungeonGC(chatId, sender);
          try { GR.GKM.saveGCsToDb(db); } catch (e) {}
        }
      } catch (e) {}
    }
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
          `📌 *COMMANDS (use /party — no key needed):*`,
          `• /attack or /attack <id> — attack (works inside gate raid)`,
          `• /party create --<KEY>   — open a raid with a gate key`,
          `/party join             — join this chat's raid`,
          `/party ready            — mark ready`,
          `/party raid             — launch (party leader)`,
          `/party status           — party + floor status`,
          `/party advance          — next floor · /party boss — final floor`,
          `/party heal|revive      — heal / revive (in raid)`,
          `${FRAME}`,
          `💡 Guild member → party raid.\n   No-guild hunter → solo raid.\n   Affiliate key → open to everyone.`,
          ...(pro ? [FRAME] : [FRAME, UI.upsell()]),
        ].join('\n'),
      }, { quoted: msg });
    }

    // ── Resolve the gate by code ────────────────────────────────
    const resolved = GR.resolveCode(code, db);
    if (!resolved.ok) return sock.sendMessage(chatId, { text: resolved.error }, { quoted: msg });
    const { key, keyData, gate } = resolved;

    // Bind the raid to this dungeon GC
    keyData.dungeonChatId = chatId;
    const gc = GR.GKM.getDungeonGC(chatId);
    if (gc && gc.activeKeyId && gc.activeKeyId !== key) {
      return sock.sendMessage(chatId, { text: '❌ This dungeon GC already has an active gate raid. Clear it first.' }, { quoted: msg });
    }
    if (gc) { gc.activeKeyId = key; try { GR.GKM.saveGCsToDb(db); } catch (e) {} }

    const rd = GATE_RANKS[gate.rank] || GATE_RANKS['E'];

    // ── ENTER (default) ─────────────────────────────────────────
    if (action === 'enter' || action === 'open' || action === 'start-raid') {
      const res = GR.enter(sender, player.name, key, keyData, gate, db);
      if (!res.ok) return sock.sendMessage(chatId, { text: `❌ ${res.error}` }, { quoted: msg });
      try { GR.saveGateState(db, gate); } catch (e) {}
      saveDatabase();

      const isOpenKey = !!keyData.isAffiliate;
      const solo = res.raid.members.length <= 1;
      return sock.sendMessage(chatId, {
        text: [
          `${FRAME}`,
          ...(pro ? [`${rd.emoji} *${solo ? 'SOLO' : 'PARTY'} RAID — RECRUITING* 💎`, UI.PRO_BAR] : [`${rd.emoji} *${solo ? 'SOLO' : 'PARTY'} RAID — RECRUITING*`, UI.FREE_BAR]),
          `${rd.label} [${gate.id}]`,
          ...(gate.strengthPct ? [`💪 Strength: *${require('../../rpg/dungeons/GateManager').strengthText(gate.rank, gate.strengthPct)}*`] : []),
          ``,
          isOpenKey
            ? `🔓 *Affiliate key* — open to everyone, no guild required.`
            : `🏰 *Guild key* — open to the owning guild's members.`,
          `👑 Leader: *${player.name} (you)*`,
          ``,
          `📌 *STEPS:*`,
          isOpenKey
            ? `1️⃣ Anyone: /party join`
            : `1️⃣ Guild members: /party join`,
          `2️⃣ Everyone: /party ready`,
          `3️⃣ Leader: /party start`,
          ``,
          `📊 /party status — see who's ready`,
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
      try { GR.saveGateState(db, gate); } catch (e) {}
      saveDatabase();
      return sock.sendMessage(chatId, {
        text: `✅ *${player.name}* joined the party!\n👥 Members: ${res.raid.members.length}\n\nMark ready: /party ready`,
        mentions: [sender],
      }, { quoted: msg });
    }

    // ── READY ───────────────────────────────────────────────────
    if (action === 'ready') {
      const res = GR.ready(sender, gate);
      if (!res.ok) return sock.sendMessage(chatId, { text: `❌ ${res.error}` }, { quoted: msg });
      try { GR.saveGateState(db, gate); } catch (e) {}
      saveDatabase();
      const raid = gate.raid;
      let txt = `✅ *${player.name}* is ready!\n\n`;
      raid.members.forEach(m => { txt += `  ${m.id === raid.leader ? '👑' : '⚔️'} ${m.name} ${m.ready ? '✅' : '⏳'}\n`; });
      if (res.allReadied) txt += `\n🎉 *ALL READY!* Leader: /party start`;
      return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
    }

    // ── START (party) ───────────────────────────────────────────
    if (action === 'start') {
      const res = GR.start(sender, keyData, gate, db);
      if (!res.ok) return sock.sendMessage(chatId, { text: `❌ ${res.error}` }, { quoted: msg });
      try { GR.saveGateState(db, gate); } catch (e) {}
      saveDatabase();
      const raid = res.raid;
      return sock.sendMessage(chatId, {
        text: [
          ...(pro ? [UI.PRO_BAR, `${rd.emoji} *RAID STARTED!* 💎`, UI.PRO_BAR] : [`${rd.emoji} *RAID STARTED!*`, UI.FREE_BAR]),
          `${rd.label} [${gate.id}]`,
          ...(gate.strengthPct ? [`💪 Strength: *${require('../../rpg/dungeons/GateManager').strengthText(gate.rank, gate.strengthPct)}*`] : []),
          `🗺️ Floor 1/${gate.totalFloors}`,
          ``,
          `👥 *Party (${raid.members.length}):*`,
          ...raid.members.map(m => `  ${m.id === raid.leader ? '👑' : '⚔️'} ${m.name}`),
          ``,
          `⚔️ /party attack`,
          `🔮 /party skill <name>`,
          `📊 /party status`,
          ...(pro ? [FRAME, UI.PRO_MINI, `💎 *PRO BREACH* — ${rd.label} · ${raid.members.length} hunters · ${gate.totalFloors} floors`] : [FRAME, UI.upsell()]),
        ].join('\n'),
      }, { quoted: msg });
    }

    // ── STATUS ──────────────────────────────────────────────────
    if (action === 'status' || action === 'info') {
      // Push #29: JID-tolerant membership (same as inRaid).
      if (!gate.raid && !inRaid(gate, sender)) {
        return sock.sendMessage(chatId, { text: '❌ Start a raid first with your code.' }, { quoted: msg });
      }
      if (gate.raid && !inRaid(gate, sender)) {
        return sock.sendMessage(chatId, { text: '❌ You are not part of this raid.' }, { quoted: msg });
      }
      return sock.sendMessage(chatId, { text: GR.statusOf(gate, db) }, { quoted: msg });
    }

    // ── HEAL (HEALTH POTION) ───────────────────────────────────
    if (action === 'heal' || action === 'item') {
      if (!inRaid(gate, sender)) return sock.sendMessage(chatId, { text: '❌ You are not in this raid.' }, { quoted: msg });
      if (raidOver(gate)) return sock.sendMessage(chatId, { text: RAID_OVER_TEXT }, { quoted: msg });

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
      const pm = gate.raid?.members?.find(m => m.id === sender || GR.GKM.normaliseJid(m.id) === GR.GKM.normaliseJid(sender)); // Push #29
      if (pm) pm.hp = player.stats.hp;

      try { GR.saveGateState(db, gate); } catch (e) {}
      saveDatabase();
      return sock.sendMessage(chatId, {
        text: `🩹 *${player.name}* used ${tierName}!\n💚 Restored +${actualHeal} HP (${player.stats.hp}/${player.stats.maxHp})\n🎒 Party Potions Used: ${gate.potionsUsed}/5`
      }, { quoted: msg });
    }

    // ── REVIVE (REVIVE TOKEN) ──────────────────────────────────
    if (action === 'revive') {
      if (raidOver(gate)) return sock.sendMessage(chatId, { text: RAID_OVER_TEXT }, { quoted: msg });
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

      // Push #29: JID-tolerant re-add (self-heals stored id on format flips).
      {
        const _sN = GR.GKM.normaliseJid(sender);
        const _same = (id) => id === sender || (_sN && GR.GKM.normaliseJid(id) === _sN);
        if (gate.raid) {
          const _ex = gate.raid.members.find(m => _same(m.id));
          if (!_ex) {
            gate.raid.members.push({ id: sender, name: player.name, hp: player.stats.hp, energy: player.stats.energy || 100, ready: true });
          } else {
            _ex.id = sender; _ex.hp = player.stats.hp;
          }
        }
        if (!(gate.raiders || []).some(_same)) {
          gate.raiders = gate.raiders || [];
          gate.raiders.push(sender);
        }
      }

      try { GR.saveGateState(db, gate); } catch (e) {}
      saveDatabase();
      return sock.sendMessage(chatId, {
        text: `💫 *REVIVE USED!* *${player.name}* was revived with ${player.stats.hp}/${player.stats.maxHp} HP!\n⚠️ Party Revive Cap Reached (1/1 used).`
      }, { quoted: msg });
    }

    // ── ADVANCE ─────────────────────────────────────────────────
    if (action === 'advance') {
      if (!inRaid(gate, sender)) return sock.sendMessage(chatId, { text: '❌ You are not in this raid.' }, { quoted: msg });
      if (raidOver(gate)) return sock.sendMessage(chatId, { text: RAID_OVER_TEXT }, { quoted: msg });
      const floor = gate.currentFloor;
      const floorMonsters = (gate.monsters || []).filter(mm => mm.floor === floor && !mm.defeated);
      if (floorMonsters.length > 0) return sock.sendMessage(chatId, { text: `❌ Clear all monsters on Floor ${floor} first!` }, { quoted: msg });
      if (floor >= gate.totalFloors) return sock.sendMessage(chatId, { text: `⚠️ Final floor. Engage the boss with /party boss` }, { quoted: msg });
      gate.currentFloor++;
      const next = (gate.monsters || []).filter(mm => mm.floor === gate.currentFloor && !mm.defeated);
      try {
        const QD = require('../../rpg/utils/QuestDispatcher');
        QD.trackAndNotify(player, 'floor', gate.currentFloor, sock, sender, chatId);
        QD.trackAndNotify(player, 'dungeon', 1, sock, sender, chatId);
      } catch(e){}
      try { GR.saveGateState(db, gate); } catch (e) {}
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
          `⚔️ /party attack`,
          ...(pro ? [FRAME, UI.PRO_MINI, `💎 *PRO SCOUT* — strongest: ${next.length ? UI.num(Math.max(...next.map(mm => mm.hp || 0))) : 0} HP`] : [FRAME, UI.upsell()]),
        ].filter(l => l !== '').join('\n'),
      }, { quoted: msg });
    }

    // ── ATTACK / SKILL ──────────────────────────────────────────
    if (action === 'attack' || action === 'skill') {
      if (!inRaid(gate, sender)) return sock.sendMessage(chatId, { text: '❌ You are not in this raid.' }, { quoted: msg });
      if (raidOver(gate)) return sock.sendMessage(chatId, { text: RAID_OVER_TEXT }, { quoted: msg });
      // Push #29: combat lock — one battle flow at a time per gate.
      const _lock = GR.tryCombatLock(gate.id, sender, player.name);
      if (!_lock.ok) {
        return sock.sendMessage(chatId, {
          // Push #68: the actor's OWN pending flow blocks them too (previously
          // the same holder could re-enter /attack before their 5-message
          // flow finished — double-spent kills and scrambled HP).
          text: _lock.self
            ? `⏳ *Your last move is still resolving!* Wait a moment before striking again.`
            : `⚔️ *${_lock.holderName}* is mid-battle... wait for their flow to finish, then strike!`,
        }, { quoted: msg });
      }
      try {
      const floor = gate.currentFloor;
      let floorMonsters = (gate.monsters || []).filter(mm => mm.floor === floor && !mm.defeated);

      // Push #54: the boss chamber now accepts the GENERAL attack system.
      // /attack, /attack <patternId> and /skill <name> all work here exactly
      // as they do on a normal floor. Previously this branch bounced with
      // "Engage the boss: /party boss", and that command only ever applied the
      // raid's simplified strike — so patterns and skills were unusable on the
      // boss and the boss fight ran on base attack.
      let _fightingBoss = false;
      let target = floorMonsters[0];
      if (floorMonsters.length === 0) {
        const bossAlive = gate.boss && !gate.boss.defeated && (gate.boss.hp || 0) > 0;
        if (floor >= gate.totalFloors && bossAlive) {
          _fightingBoss = true;
          target = gate.boss;
          // The generic monster flow below needs atk/def on the target; the
          // boss carries the same numbers the /party boss branch used.
          if (typeof target.atk !== 'number') target.atk = Math.floor((GATE_RANKS[gate.rank]?.monsterRange?.[1] || 600) * 0.20);
          if (typeof target.def !== 'number') target.def  = Math.floor((gate.rankData?.monsterRange?.[1] || 600) * 0.05);
          if (!Array.isArray(target.statusEffects)) target.statusEffects = [];
        } else if (floor >= gate.totalFloors) {
          return sock.sendMessage(chatId, { text: `✅ The boss is already down. This gate is cleared.` }, { quoted: msg });
        } else {
          return sock.sendMessage(chatId, { text: `✅ Floor ${floor} cleared!\nAdvance: /party advance` }, { quoted: msg });
        }
      }
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
      // Batch-47: a stunned hunter loses their STRIKE, but the battle
      // still plays out — the monster below still counter-attacks.
      if (!_grCanAct.canAct) {
        try { GR.saveGateState(db, gate); } catch (e) {}
      saveDatabase();
        const _grFxMap = { frozen: ['❄️', 'FROZEN 🧊'], stunned: ['💫', 'STUNNED 💫'], paralyzed: ['🔱', 'PARALYZED 🔱'], feared: ['😱', 'FEARED 😱'] };
        const [_fxEmo, _fxWord] = _grFxMap[_grCanAct.reason] || ['💫', 'STUNNED 💫'];
        await sock.sendMessage(chatId, { text: `${FRAME}\n${_fxEmo} *YOU ARE ${_fxWord}!*${pro ? ' 💎' : ''}\n${FRAME}\n_${player.name} cannot move this turn — strike lost!_\n💢 *But the battle plays on...*\n${FRAME}` }, { quoted: msg });
      }
      // Push #68: pet round output declared at execute scope so the stunned
      // path (which skips the strike block) can't hit "_petLines is not defined".
      let _petStrike = null, _petLines = [];
      const UCgFlow = require('../../rpg/utils/UnifiedCombat');
      if (_grCanAct.canAct) {
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
              else { result = { damage: uni.damage, isCrit: uni.crit, atkPattern: atk, unified: uni }; UCg.setCooldown(player, patternId, atk); }
              // Damage + move effect are applied by the shared playTurn flow below.
            }
          }
        }
      } else {
        const useSkill = action === 'skill' ? skillArg : null;
        result = GR.playerDamage(player, useSkill);
        // Push #55: pets count in the general attack flow as well (this is the
        // path /attack and /skill take outside /party).
        try {
          const _pba = PetCombat.atkBonus(sender) || 0;
          if (_pba > 0) result.damage = Math.max(1, (result.damage || 0) + _pba);
          if (target && !result.blocked) {
            const _st = PetCombat.abilityStrike(sender, target);
            if (_st) { result.damage = Math.max(1, (result.damage || 0) + _st.damage); result.petLine = _st.line; }
          }
        } catch (e) {}
      }
      if (result.blocked) return sock.sendMessage(chatId, { text: `❌ ${result.reason}` }, { quoted: msg });

      // Daily quest: attack pattern actually used in combat
      if (atkPattern) { try { require('../../rpg/utils/QuestDispatcher').trackAndNotify(player, 'pattern', 1, sock, sender, chatId); } catch(e){} }

      if (!gate.damageDealt) gate.damageDealt = {};
      gate.damageDealt[sender] = (gate.damageDealt[sender] || 0) + result.damage;

      // (playTurn below applies result.damage to the monster — no subtraction here)

      // ── Player strike: shared 5-message battle flow (damage math unchanged,
      // presentation unified with PvP). playTurn applies damage + move effect.
      target.statusEffects = target.statusEffects || [];
      let _gmMove, _gmResult;
      if (atkPattern) {
        _gmMove = atkPattern;
        _gmResult = result.missed
          ? { damage: 0, crit: false, missed: true, capability: 1 }
          : { damage: result.damage, crit: !!result.isCrit, missed: false, capability: result.unified ? result.unified.capability : undefined };
      } else if (result.skillUsed) {
        const _sk = result.skillUsed;
        const _skFx = (_sk.effect && typeof _sk.effect === 'object' && _sk.effect.type) ? _sk.effect : null;
        _gmMove = { name: _sk.name, description: _sk.description || 'A class skill unleashed in the heat of battle.', cooldownMs: (_sk.cooldown || 3) * 1000, effect: _skFx };
        _gmResult = { damage: result.damage, crit: !!result.isCrit, missed: false };
      } else {
        _gmMove = UCgFlow.basicStrike();
        _gmResult = { damage: result.damage, crit: !!result.isCrit, missed: false };
      }
      const atkTitle = atkPattern ? `🥋 *ATTACK PATTERN #${atkPattern.id} — ${atkPattern.name}* [${atkPattern.rank}]` : `⚔️ *PLAYER ATTACK*`;
      const monWrap = { name: target.name, stats: { hp: target.hp, maxHp: target.maxHp }, statusEffects: target.statusEffects };
      await UCgFlow.playTurn(sock, chatId, {
        attacker: player, defender: monWrap, move: _gmMove, result: _gmResult,
        tag: atkTitle, defenderBar: 'monster', gapMs: 600,
      });
      target.hp = Math.max(0, monWrap.stats.hp);
      // Push #71: recovery skills report the HP they actually restored.
      if (result.healed > 0) await sock.sendMessage(chatId, { text: `💚 *${result.skillUsed?.name || 'Recovery'}* restored *${result.healed}* HP → ${player.stats.hp}/${player.stats.maxHp}` });
      if (pro) await sock.sendMessage(chatId, { text: `💎 *PRO FOCUS* — your raid damage: ${UI.num(gate.damageDealt[sender])}` });

      if (target.hp <= 0 && _fightingBoss) {
        // Boss finished by the general attack system — run the exact same
        // settlement /party boss uses (loot, drops, guild GP, recovery,
        // gate closure), so there is only one reward path to stay correct.
        const bossLines = [];
        try { bossLines.push(...await finishBossDefeat()); } catch (e) {
          console.error('[gateraid] boss settle via /attack failed:', e.message);
          bossLines.push(`💀 *${target.name}* has fallen!`);
        }
        try { GR.saveGateState(db, gate); } catch (e) {}
        saveDatabase();
        return sock.sendMessage(chatId, { text: bossLines.filter(Boolean).join('\n') }, { quoted: msg });
      }

      // Push #55: the pet's own strike lands in the same round (attack pets
      // used to be a flat ATK number and nothing else).
      // Push #68: _petStrike/_petLines are declared at execute scope (see
      // below) — when the player is stunned this whole block is skipped and
      // the counter-attack epilogue still reads _petLines.
      try {
        const _ps = PetCombat.abilityStrike(sender, target);
        if (_ps) _petLines.push(_ps.line);
      } catch (e) {}

      if (target.hp <= 0) {
        // The 5 strike messages are already live — rewards go in their own message.
        const killLines = [];
        target.defeated = true;
        gate.monstersKilled = (gate.monstersKilled || 0) + 1;
        if (!player.stats_history) player.stats_history = {};
        player.stats_history.monstersKilled = (player.stats_history.monstersKilled || 0) + 1;
        try { require('../../rpg/utils/QuestDispatcher').trackAndNotify(player, 'kill', 1, sock, sender, chatId); } catch(e){}

        try { const BR=require('../../rpg/utils/BattleRewards'); const w=BR.giveBattleWinRewards(player, db, 'gate', player.level, sock, chatId); killLines.push(``, `💀 *${target.name}* defeated!`, BR.formatRewards(w)); } catch(e){ awardXP(player, 'gate_complete', saveDatabase, sock, chatId); killLines.push(``, `💀 *${target.name}* defeated!`); }

        const heal = GR.lifeSteal(player, result.damage);
        if (heal > 0) { player.stats.hp = Math.min(player.stats.maxHp, (player.stats.hp || 0) + heal); killLines.push(`💚 Lifesteal: +${heal} HP`); }

        const dropLines = GR.monsterKilledBy(gate, target, sender, db);
        if (dropLines.length) killLines.push(...dropLines);

        // Push #55: the pet earns XP from the kill (bonding + evolution path)
        try {
          const _pr = PetCombat.rewardPet(sender, { won: true, exp: 20 + (target.level || 1) * 6 });
          if (_pr) killLines.push(..._pr);
        } catch (e) {}

        const remaining = floorMonsters.filter(mm => !mm.defeated).length;
        killLines.push(``, `👾 *${Math.max(0, remaining)}* monsters remaining on Floor ${floor}`);

        if (remaining <= 0) {
          const fNexus = Math.floor((gate.nexusLoot || 1000) / (gate.totalFloors || 1));
          const fCrystals = Math.floor((gate.crystalLoot || 100) / (gate.totalFloors || 1));
          if (!gate.accumulatedTreasure) gate.accumulatedTreasure = { nexus: 0, crystals: 0 };
          gate.accumulatedTreasure.nexus += fNexus;
          gate.accumulatedTreasure.crystals += fCrystals;

          killLines.push(``, `💰 *Floor ${floor} Treasure Accumulated:* +${fNexus.toLocaleString()} 💠 Nexus & +${fCrystals.toLocaleString()} 💎 Mana Stones`);

          if (floor >= gate.totalFloors) { killLines.push(``, `🏆 *BOSS FLOOR REACHED!*`, `/party boss — Engage the boss!`); }
          else { killLines.push(``, `✅ *Floor ${floor} CLEARED!*`, `/party advance — Floor ${floor + 1}`); }
        }

        try { GR.saveGateState(db, gate); } catch (e) {}
      saveDatabase();
        return sock.sendMessage(chatId, { text: killLines.filter(Boolean).join('\n') }, { quoted: msg });
      }

      } // ── end player strike (skipped when stunned) ──

      // Monster counter-attack (frozen/stunned/paralyzed monsters lose their turn)
      let _monCanAct = { canAct: true, reason: null };
      try { _monCanAct = require('../../rpg/utils/UnifiedCombat').canAct({ statusEffects: target.statusEffects || [] }); } catch(e){}
      let _gDefGR = 0;
      try { _gDefGR = require('../../rpg/utils/GearSystem').getEquippedBonuses(player).def || 0; } catch (e) {}
      const def = (player.stats?.def || 5) + (player.weapon?.defense || 0) + _gDefGR + (PetCombat.defBonus(sender) || 0);
      const dmg = _monCanAct.canAct ? GR.monsterDamage(target, def) : 0;

      // Push #71: status chance per move (was a flat 100% — every counter
      // stunned/burned/feared the hunter, which made recovery pointless).
      const skillPool = [
        { name: '🔥 Flame Spurt', effect: 'burn',   chance: 40 },
        { name: '⚡ Volt Shock',  effect: 'stun',   chance: 25 },
        { name: '🩸 Savage Bite', effect: 'bleed',  chance: 40 },
        { name: '😱 Terror Howl', effect: 'fear',   chance: 30 },
        { name: '🌀 Void Crush',  effect: 'weaken', chance: 35 }
      ];
      const _pool71 = (Array.isArray(target.skills) && target.skills.length) ? target.skills : skillPool; // Push #71: bestiary moves
      const monsterSkill = _monCanAct.canAct ? _pool71[Math.floor(Math.random() * _pool71.length)] : null;
      if (!_monCanAct.canAct) {
        const _fzWord = _monCanAct.reason === 'frozen' ? 'frozen solid' : _monCanAct.reason === 'paralyzed' ? 'paralyzed' : 'stunned';
        const _fzEmo = _monCanAct.reason === 'frozen' ? '❄️' : _monCanAct.reason === 'paralyzed' ? '🔱' : '💫';
        await sock.sendMessage(chatId, { text: [
          ...(pro ? [UI.PRO_BAR, `🧊 *MONSTER HELD* 💎`, UI.PRO_BAR] : [`🧊 *MONSTER HELD*`, UI.FREE_BAR]),
          `${_fzEmo} *${target.name}* is ${_fzWord} and cannot move!`,
          `💥 Took *0* damage`,
          `❤️ Your HP: *${player.stats.hp}/${player.stats.maxHp}*`,
        ].join('\n') }, { quoted: msg });
      } else {
        // Same 5-message flow as the player's strike (damage math unchanged;
        // the status is applied inside playTurn via the move effect).
        const _skillBare = monsterSkill.name.replace(/^[^\s]+\s/, '');
        const monAtk = { name: target.name, stats: { hp: target.hp, maxHp: target.maxHp }, statusEffects: target.statusEffects || [] };
        await UCgFlow.playTurn(sock, chatId, {
          attacker: monAtk, defender: player,
          move: { name: monsterSkill.name, description: `A ferocious ${_skillBare} technique.`, cooldownMs: 0, effect: { type: monsterSkill.effect, chance: (monsterSkill.chance || 35), duration: 2 } }, // Push #71: no more 100% status
          result: { damage: dmg, crit: false, missed: false },
          tag: `💢 *MONSTER COUNTER-ATTACK*`, gapMs: 600,
        });
      }

      if (player.stats.hp <= 0) {
        const deathLines = [];
        const PetManager = require('../../rpg/utils/PetManager');
        const sac = PetManager.checkPetSacrifice(sender, player);
        if (sac && sac.sacrificed) {
          deathLines.push(``, sac.message);
          await sock.sendMessage(chatId, { text: deathLines.filter(Boolean).join('\n') }, { quoted: msg });
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
            deathLines.push(``, `💰 *50% PARTY TREASURE SALVAGED:* +${retNexus.toLocaleString()} 💠 Nexus | +${retCrystals.toLocaleString()} 💎 Mana Stones`);
          }

          deathLines.push(``, `💀 *YOU FELL IN THE GATE!*`, `Lost ${loss.toLocaleString()} 💎`, `You fled with 1 HP.`);
          // Push #29: JID-tolerant removal + wipe check (never re-persist a
          // wiped gate — wipeGate already dropped it from every registry).
          {
            const _sN = GR.GKM.normaliseJid(sender);
            const _gone = (id) => id !== sender && (!_sN || GR.GKM.normaliseJid(id) !== _sN);
            if (gate.raid) gate.raid.members = gate.raid.members.filter(m => _gone(m.id));
            gate.raiders = (gate.raiders || []).filter(_gone);
          }
          if (gate.raid && gate.raid.members.length === 0) {
            deathLines.push(...GR.wipeGate(gate, key, keyData, chatId, db));
          } else {
            try { GR.saveGateState(db, gate); } catch (e) {}
          }
      saveDatabase();
          return sock.sendMessage(chatId, { text: deathLines.filter(Boolean).join('\n') }, { quoted: msg });
        }
      }

      let _nextStatus2 = null;
      try { _nextStatus2 = statusSummary(player); } catch(e){}
      const msg3Lines = [
        ...(pro ? [UI.PRO_BAR, `🎮 *NEXT TURN* 💎`, UI.PRO_BAR] : [`🎮 *NEXT TURN*`, UI.FREE_BAR]),
        ...(_nextStatus2 ? [`⚠️ *YOUR STATUS:* ${_nextStatus2}`] : []),
        `⚔️ /party attack`,
        `🔮 /party skill <name>`,
        `🩹 /use heal`,
        ...(pro ? [FRAME] : [FRAME, UI.upsell()]),
      ];

      // Push #55: support pets actually heal now, and any pet line the round
      // produced (ability strike) gets shown instead of vanishing.
      try {
        const _ph = PetCombat.healPlayer(sender, player);
        if (_ph.healed > 0) msg3Lines.push(`💚 *${_ph.petName || 'Pet'}* mended *${_ph.healed}* HP → ${_ph.hp}/${player.stats.maxHp}`);
      } catch (e) {}
      if (_petLines.length && target.hp > 0) msg3Lines.push(..._petLines);
      try { GR.saveGateState(db, gate); } catch (e) {}
      saveDatabase();
      return sock.sendMessage(chatId, {
        text: msg3Lines.filter(Boolean).join('\n')
      }, { quoted: msg });
      } finally { GR.releaseCombatLock(gate.id); } // Push #29
    }

    // ── BOSS DEFEAT SETTLEMENT (shared: /party boss AND the general attack
    //    system, since Push #54 lets /attack + /skill fight the boss too) ──
    // Returns the lines to show. The caller saves state and sends.
    const finishBossDefeat = async () => {
      const out = [];
        // Push #68: capture the boss from the gate. The `boss` local in the
        // /party boss branch is block-scoped and was NOT visible here, so
        // every boss settlement (via /party boss OR the general /attack flow)
        // crashed with "boss is not defined".
        const boss = gate.boss;
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
        try { const BRb=require('../../rpg/utils/BattleRewards'); const wb=BRb.giveBattleWinRewards(player, db, 'gate', player.level, sock, chatId); out.push(BRb.formatRewards(wb)); } catch(e){}

        // Final-blow boss loot → the killer
        const bossDropLines = [];
        const bossDrop = GateManager.rollMonsterKillDrop(gate.rank, boss.name);
        if (bossDrop) {
          require('../../rpg/utils/RewardInventory').grantItem(player, { ...bossDrop, type: bossDrop.type || 'material', fromGate: gate.id }, 'gate');
          bossDropLines.push(`🎁 *BOSS DROP → ${player.name}* (final blow): *${bossDrop.name}*`);
        }

        // Distribute full loot: gold→guild treasury, drops→final-blow, recovery
        const loot = GR.clearGate(gate, key, keyData, db, saveDatabase);

        out.push(``, `💀 *${boss.name}* HAS BEEN DEFEATED!`, ``);
        out.push(`🔥 Aura gained!`);
        if (bossDropLines.length) out.push(...bossDropLines);
        out.push(``, `🎁 *LOOT → ${loot.destinationText}*`);
        out.push(`💠 ${loot.nexus.toLocaleString()} Nexus | 💎 ${loot.crystals.toLocaleString()} Mana Stones`);
        if (loot.affiliatePayouts && Object.keys(loot.affiliatePayouts).length) {
        out.push(``, `🤝 *Affiliate / recruiter payouts:*`);
          for (const [jid, p] of Object.entries(loot.affiliatePayouts)) {
            const nm = db.users?.[jid]?.name || jid.split('@')[0];
        out.push(`  • *${nm}* — ${p.percent}% → ${p.gold.toLocaleString()} 💠 + ${p.crystals} 💎`);
          }
        }
        if (loot.contractPayouts && Object.keys(loot.contractPayouts).length) out.push(`📋 Contracts paid out automatically.`);

        if (loot.wildPet && loot.wildPet.token) {
        out.push(``, `🐾 *WILD PET APPEARED!*`);
        out.push(`${loot.wildPet.emoji} *${loot.wildPet.name}* [${loot.wildPet.rarity.toUpperCase()}]`);
        out.push(`🪤 */catch* — hurry, it flees in 60s!`);
        }

        // Push #55: scavenger pets pay out on the clear, and every raider's
        // active pet gets XP for the fight (previously pets gained nothing).
        try {
          const _sv = PetCombat.scavenge(sender, loot.nexus || 0);
          if (_sv.bonus > 0) {
            player.gold = (player.gold || 0) + _sv.bonus;
            player.manaCrystals = (player.manaCrystals || 0) + Math.floor(_sv.bonus / 10);
            out.push(``, `${_sv.pet?.emoji || '🐾'} *${_sv.pet?.nickname || _sv.pet?.name || 'Scavenger'}* dug up *${_sv.bonus.toLocaleString()}* 💠 Nexus (+${Math.floor(_sv.bonus / 10)} 💎)`);
          }
          const _pr = PetCombat.rewardPet(sender, { won: true, exp: 120 });
          if (_pr) out.push(..._pr);
        } catch (e) {}
        try {
          for (const m of (gate.raid?.members || [])) {
            const _mp = db.users?.[m.id];
            if (_mp && _mp.stats?.hp > 0) PetCombat.rewardPet(m.id, { won: true, exp: 120 });
          }
        } catch (e) {}

        out.push(``, `💚 *All members: +50% max HP recovery, no cooldown.*`);
        out.push(`🚪 *GATE ${gate.id} CLEARED!*`);
        out.push(FRAME);
        if (pro) {
          const topName = topRaider ? (db.users?.[topRaider[0]]?.name || 'a raider') : 'none';
        out.push(UI.PRO_MINI, topRaider && topRaider[0] === sender ? `💎 *PRO SLAYER* — TOP raid damage: ${UI.num(topRaider[1])}! 🔥` : `💎 *PRO SLAYER* — top: ${topName} (${topRaider ? UI.num(topRaider[1]) : 0})`);
        } else out.push(UI.upsell());
      return out;
    };


    // ── BOSS ────────────────────────────────────────────────────
    if (action === 'boss') {
      if (!inRaid(gate, sender)) return sock.sendMessage(chatId, { text: '❌ You are not in this raid.' }, { quoted: msg });
      if (raidOver(gate)) return sock.sendMessage(chatId, { text: RAID_OVER_TEXT }, { quoted: msg });
      // Push #29: combat lock — one battle flow at a time per gate.
      const _block = GR.tryCombatLock(gate.id, sender, player.name);
      if (!_block.ok) {
        return sock.sendMessage(chatId, {
          text: _block.self
            ? `⏳ *Your last move is still resolving!* Wait a moment before striking again.`
            : `⚔️ *${_block.holderName}* is mid-battle... wait for their flow to finish, then strike!`,
        }, { quoted: msg });
      }
      try {
      const floor = gate.currentFloor;
      const floorMonsters = (gate.monsters || []).filter(mm => mm.floor === floor && !mm.defeated);
      if (floorMonsters.length > 0) return sock.sendMessage(chatId, { text: `❌ Clear all floor ${floor} monsters first!` }, { quoted: msg });
      if (floor < gate.totalFloors) return sock.sendMessage(chatId, { text: `❌ Reach Floor ${gate.totalFloors} before engaging the boss.` }, { quoted: msg });
      if (gate.boss.defeated) return sock.sendMessage(chatId, { text: '✅ Boss already defeated!' }, { quoted: msg });

      const boss = gate.boss;
      const result = GR.playerDamage(player, skillArg || null);
      if (result.blocked) return sock.sendMessage(chatId, { text: `❌ ${result.reason}` }, { quoted: msg });
      // Push #55: pets fight the boss too — ATK bonus + their own ability hit.
      try {
        const _pbAtk = PetCombat.atkBonus(sender) || 0;
        if (_pbAtk > 0) result.damage = Math.max(1, (result.damage || 0) + _pbAtk);
        const _bstrike = PetCombat.abilityStrike(sender, boss);
        if (_bstrike) {
          result.damage = Math.max(1, (result.damage || 0) + _bstrike.damage);
          result.petLine = _bstrike.line;
        }
      } catch (e) {}

      if (!gate.damageDealt) gate.damageDealt = {};
      gate.damageDealt[sender] = (gate.damageDealt[sender] || 0) + result.damage;
      // Boss strike: shared 5-message flow (damage math unchanged; bosses
      // don't take statuses, exactly as before).
      const UCgBoss = require('../../rpg/utils/UnifiedCombat');
      let _bMove;
      if (result.skillUsed) {
        _bMove = { name: result.skillUsed.name, description: result.skillUsed.description || 'A class skill unleashed on the boss.', cooldownMs: (result.skillUsed.cooldown || 3) * 1000, effect: null };
      } else {
        _bMove = UCgBoss.basicStrike();
      }
      const bossWrap = { name: boss.name, stats: { hp: boss.hp, maxHp: boss.maxHp }, statusEffects: [] };
      await UCgBoss.playTurn(sock, chatId, {
        attacker: player, defender: bossWrap, move: _bMove,
        result: { damage: result.damage, crit: !!result.isCrit, missed: false },
        tag: `🏆 *BOSS BATTLE*\n💀 *${boss.name}*`, defenderBar: 'boss', gapMs: 600,
      });
      boss.hp = Math.max(0, bossWrap.stats.hp);

      const lines = [];
      if (result.healed > 0) lines.push(`💚 *${result.skillUsed?.name || 'Recovery'}* restored *${result.healed}* HP → ${player.stats.hp}/${player.stats.maxHp}`);
      // Push #55: the boss round reports what the pet did too.
      try { if (result.petLine) lines.push(result.petLine); } catch (e) {}
      try {
        const _bh = PetCombat.healPlayer(sender, player);
        if (_bh.healed > 0) lines.push(`💚 *${_bh.petName}* mended *${_bh.healed}* HP → ${_bh.hp}/${player.stats.maxHp}`);
      } catch (e) {}

      if (boss.hp <= 0) {
        lines.push(...await finishBossDefeat());
      } else {
        let _gDefGR2 = 0;
        try { _gDefGR2 = require('../../rpg/utils/GearSystem').getEquippedBonuses(player).def || 0; } catch (e) {}
        const def = (player.stats?.def || 5) + (player.weapon?.defense || 0) + _gDefGR2;
        const bossAtk = Math.floor(GATE_RANKS[gate.rank].monsterRange[1] * 0.20);
        const dmg = Math.max(10, bossAtk - Math.floor(def * 0.4));
        const bossAtkW = { name: boss.name, stats: { hp: boss.hp, maxHp: boss.maxHp }, statusEffects: [] };
        await UCgBoss.playTurn(sock, chatId, {
          attacker: bossAtkW, defender: player,
          move: { name: 'Retaliation', description: 'The boss lashes out with overwhelming force.', cooldownMs: 0 },
          result: { damage: dmg, crit: false, missed: false },
          tag: `💢 *BOSS COUNTER*`, gapMs: 600,
        });
        const heal = GR.lifeSteal(player, result.damage);
        if (heal > 0) player.stats.hp = Math.min(player.stats.maxHp, player.stats.hp + heal);
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
            // Push #29: JID-tolerant removal + wipe check (never re-persist a wiped gate).
            {
              const _sN = GR.GKM.normaliseJid(sender);
              const _gone = (id) => id !== sender && (!_sN || GR.GKM.normaliseJid(id) !== _sN);
              if (gate.raid) gate.raid.members = gate.raid.members.filter(m => _gone(m.id));
              gate.raiders = (gate.raiders || []).filter(_gone);
            }
            if (gate.raid && gate.raid.members.length === 0) {
              lines.push(...GR.wipeGate(gate, key, keyData, chatId, db));
            } else {
              try { GR.saveGateState(db, gate); } catch (e) {}
            }
      saveDatabase();
            return sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: msg });
          }
        }

        lines.push(``, `⚔️ /party boss — Attack again`);
      }

      const pm = gate.raid?.members?.find(m => m.id === sender || GR.GKM.normaliseJid(m.id) === GR.GKM.normaliseJid(sender)); // Push #29
      if (pm) { pm.hp = player.stats.hp; pm.energy = player.stats.energy; }

      try { GR.saveGateState(db, gate); } catch (e) {}
      saveDatabase();
      return sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: msg });
      } finally { GR.releaseCombatLock(gate.id); } // Push #29
    }

    return sock.sendMessage(chatId, {
      text: `Usage: /party [join|ready|start|attack|skill <name>|status|advance|boss]`,
    }, { quoted: msg });
  },
};

// Helper: is the sender an active raider of this gate?
function inRaid(gate, sender) {
  // Push #29: JID-tolerant (exact match fast path, normalised fallback).
  if (gate.raid && gate.raid.members.some(m => m.id === sender)) return true;
  if ((gate.raiders || []).includes(sender)) return true;
  const sN = GR.GKM.normaliseJid(sender);
  if (!sN) return false;
  if (gate.raid && gate.raid.members.some(m => GR.GKM.normaliseJid(m.id) === sN)) return true;
  return (gate.raiders || []).some(r => GR.GKM.normaliseJid(r) === sN);
}

// Push #29: ended raids refuse combat/support actions (wipe-safe).
function raidOver(gate) {
  return !!gate?.raid && ['done', 'wiped', 'closed'].includes(gate.raid.status);
}
const RAID_OVER_TEXT = '❌ This raid has ended. Start a new one: /party create --<KEY>';
