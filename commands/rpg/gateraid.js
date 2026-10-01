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
const _effMax = (pl) => { try { return require('../../rpg/utils/GearSystem').effectiveMaxHp(pl); } catch (e) { return (pl && pl.stats && pl.stats.maxHp) || 100; } }; // Push #87: gear/title HP is real HP
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
function statusSummary(entity){ if(!entity||!entity.statusEffects||!entity.statusEffects.length) return null; const m={burn:'🔥 Burn -5% HP', poison:'☠️ Poison -3% HP', bleed:'🩸 Bleed -4% HP', stun:'💫 Stun skip + -50% SPD', freeze:'❄️ Freeze skip + -4% HP', paralyze:'🔱 Paralyze no-move', weaken:'💔 Weaken -75% ATK', weakness:'💔 Weakness -75% ATK', curse:'👁️ Curse -15% DEF', fear:'😱 Fear -50% all', enfeeble:'🐢 Enfeeble -30% DEF', trueslow:'🐌 Slow -35% SPD', silence:'🤐 Silence', blind:'🌫️ Blind -50% ACC', ruin:'💀 Ruin -70% ATK / +70% dmg taken'}; return entity.statusEffects.map(s=>{ const k=(s.type||'').toLowerCase(); const desc=m[k]||k; const dur=s.duration||s.turns||'?'; return `${desc} (${dur}t)`; }).join(' | '); }

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
      // Push #87: point players at EVERY --main dungeon GC with a real invite
      // link (never a raw group id). Falls back to the registry's stored link,
      // then to a live invite code fetch.
      let dungeonLinks = [];
      try {
        const _AG = require('../../rpg/utils/AstralGroups');
        const mains = _AG.getAll(db).filter(g => g && g.isMain && (g.type === 'dungeon' || (Array.isArray(g.features) && g.features.includes('dungeon'))));
        for (const g of mains) {
          let link = g.inviteLink || null;
          if (!link && typeof sock.groupInviteCode === 'function') {
            try { const c = await sock.groupInviteCode(g.groupId); if (c) { link = `https://chat.whatsapp.com/${c}`; if (db.astralGroups?.[g.groupId]) db.astralGroups[g.groupId].inviteLink = link; } } catch (e) {}
          }
          if (link) dungeonLinks.push(`🏰 *${g.groupName || 'Dungeon GC'}*\n${link}`);
        }
      } catch (e) {}
      if (dungeonLinks.length > 0 || gcList.length > 0) {
        const body = dungeonLinks.length
          ? `❌ *Gate raids must be started in a dungeon GC.*\n\nJoin one of the official dungeon groups:\n\n${dungeonLinks.join('\n\n')}`
          : `❌ *Gate raids must be started in a dungeon GC.*\n\nUse this command in your dungeon group instead.`;
        return sock.sendMessage(chatId, { text: body }, { quoted: msg });
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
        for (const g of Object.values(GM.GateManager.activeGates || GM.GateManager.gates || {})) {
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
    // Push #96h-m: a raid belongs to ONE GC. A raider typing /attack (or any raid action) from a
    // different group used to get the whole raid turn posted THERE — the "messages for one GC land
    // in another" bug. Now the raid only plays out in the GC it was opened in.
    try {
      const _home = (gate && gate.raid && gate.raid.status === 'active') ? (keyData?.dungeonChatId || gate.chatId) : null;
      if (_home && String(_home).endsWith('@g.us') && String(chatId).endsWith('@g.us') && _home !== chatId && !msg._berserkAuto) {
        return sock.sendMessage(chatId, { text: `❌ *That raid is running in another group.*\nGo back to the dungeon GC where the gate was opened and act there.` }, { quoted: msg });
      }
    } catch (e) {}
    // Push #88x: a BERSERK hunter (sub-Lv.10 Monster in a passive surge) cannot
    // command their own body — the bot plays their turns (msg._berserkAuto).
    try {
      const TFb = require('../../rpg/utils/Transformation');
      if (!msg._berserkAuto && TFb.isBerserk(player) && !['status', 'info', 'help'].includes(action)) {
        return sock.sendMessage(chatId, { text: TFb.BERSERK_TEXT }, { quoted: msg });
      }
    } catch (e) {}

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
      if (player.pvpBattle) return sock.sendMessage(chatId, { text: '❌ You are in a PvP duel — finish it (or /forfeit) before raiding.' }, { quoted: msg });
      const res = GR.enter(sender, player.name, key, keyData, gate, db);
      if (!res.ok) return sock.sendMessage(chatId, { text: `❌ ${res.error}` }, { quoted: msg });
      try { GR.saveGateState(db, gate); } catch (e) {}
      saveDatabase();

      if (res.lateJoin) { // Push #96h-f: affiliates/members hired after the start raid immediately
        return sock.sendMessage(chatId, { text: [FRAME, `${rd.emoji} *${player.name} joins the raid mid-fight!*`, FRAME, `${rd.label} [${gate.id}] · floor ${gate.currentFloor || 1}/${gate.totalFloors}`, `👥 Party: ${res.raid.members.map(m => m.name).join(', ')}`, `⚔️ You are in — */gateraid ${code} attack* when it is your turn. The beasts have re-calibrated to the bigger party.`, FRAME].join('\n') }, { quoted: msg });
      }
      const isOpenKey = !!keyData.isAffiliate;
      const solo = res.raid.members.length <= 1;
      return sock.sendMessage(chatId, {
        text: [
          `${FRAME}`,
          ...(pro ? [`${rd.emoji} *${solo ? 'SOLO' : 'PARTY'} RAID — RECRUITING* 💎`, UI.PRO_BAR] : [`${rd.emoji} *${solo ? 'SOLO' : 'PARTY'} RAID — RECRUITING*`, UI.FREE_BAR]),
          `${rd.label} [${gate.id}]`,
          ...(gate.strengthPct ? [`💪 Strength: *${require('../../rpg/dungeons/GateManager').strengthText(gate.rank, gate.strengthPct, gate)}*`] : []),
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
      if (player.pvpBattle) return sock.sendMessage(chatId, { text: '❌ You are in a PvP duel — finish it (or /forfeit) before raiding.' }, { quoted: msg });
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
          ...(gate.strengthPct ? [`💪 Strength: *${require('../../rpg/dungeons/GateManager').strengthText(gate.rank, gate.strengthPct, gate)}*`] : []),
          ...(gate.calibrated ? [`🎯 Severity: *${gate.calibrated.label}* ×${gate.calibrated.severity} — tuned to your party's power (${gate.calibrated.partyPower.toLocaleString()})${gate.calibrated.luck ? ` · 🍀 luck −${gate.calibrated.luck}%` : ''}`] : []),
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
      const healAmount = Math.floor(_effMax(player) * pct);
      const oldHp = player.stats.hp || 0;
      player.stats.hp = Math.min(_effMax(player), oldHp + healAmount);
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
        text: `🩹 *${player.name}* used ${tierName}!\n💚 Restored +${actualHeal} HP (${player.stats.hp}/${_effMax(player)})\n🎒 Party Potions Used: ${gate.potionsUsed}/5`
      }, { quoted: msg });
    }

    // ── REVIVE (REVIVE TOKEN) ──────────────────────────────────
    if (action === 'revive') {
      if (raidOver(gate)) return sock.sendMessage(chatId, { text: RAID_OVER_TEXT }, { quoted: msg });
      // Push #88w: revive tokens work ONLY on hunters who actually fell in this raid
      // (or a @mentioned fallen teammate). Living hunters heal with potions.
      const _rvMent = require('../../utils/target').resolveAll(msg, []);
      const _rvTarget = _rvMent.length ? _rvMent[0] : sender;
      if (!GR.isFallen(gate, _rvTarget)) {
        return sock.sendMessage(chatId, { text: _rvMent.length ? `❌ That hunter has not fallen in this raid — Revive Tokens only work on the dead.` : `❌ You have not fallen in this raid — Revive Tokens only work on the dead. Use /party heal for HP.` }, { quoted: msg });
      }
      if ((player.inventory?.reviveTokens || 0) <= 0) {
        return sock.sendMessage(chatId, { text: '❌ You have no Revive Tokens!' }, { quoted: msg });
      }

      // Party revive cap: max 1 revive per gate raid collectively
      if ((gate.revivesUsed || 0) >= 1) {
        return sock.sendMessage(chatId, {
          text: `❌ *Gate Raid Revive Cap Reached!*\n\nOnly *1 Revive Token* can be used collectively across the entire party in a Gate Raid.`
        }, { quoted: msg });
      }

      const _rv = GR.reviveFallen(gate, _rvTarget, db, 50);
      if (!_rv) return sock.sendMessage(chatId, { text: '❌ Could not find that hunter\'s profile.' }, { quoted: msg });
      gate.revivesUsed = 1;
      player.inventory.reviveTokens--;

      try { GR.saveGateState(db, gate); } catch (e) {}
      saveDatabase();
      return sock.sendMessage(chatId, {
        text: `💫 *REVIVE USED!* *${_rv.player.name}* rises again with ${_rv.hp}/${_rv.max} HP and rejoins the party!\n⚠️ Party Revive Cap Reached (1/1 used).`,
        mentions: [_rvTarget],
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
      gate.floorClearedAt = null; // Push #88w
      try { GR.noteRaidTurn(gate, chatId); } catch (e) {} // Push #92: idle clock restarts from /party advance
      try { GR.applyMonsterScaling(gate); } catch (e) {} // Push #88: deeper floor → stronger monsters
      const next = (gate.monsters || []).filter(mm => mm.floor === gate.currentFloor && !mm.defeated);
      const _fm = Math.round((GR.floorMultiplier(gate, gate.currentFloor) - 1) * 100);
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
          ...(_fm > 0 ? [`📈 Monsters here are *+${_fm}%* stronger than Floor 1.`] : []),
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
          if (typeof target.atk !== 'number' || target.atk <= 0) target.atk = Math.floor((GATE_RANKS[gate.rank]?.monsterRange?.[1] || 600) * 0.20 * ((gate.calibrated && gate.calibrated.severity) || 1) * 1.25);
          if (typeof target.def !== 'number') target.def  = Math.floor((gate.rankData?.monsterRange?.[1] || 600) * 0.05);
          if (!Array.isArray(target.statusEffects)) target.statusEffects = [];
        } else if (floor >= gate.totalFloors) {
          return sock.sendMessage(chatId, { text: `✅ The boss is already down. This gate is cleared.` }, { quoted: msg });
        } else {
          return sock.sendMessage(chatId, { text: `✅ Floor ${floor} cleared!\nAdvance: /party advance` }, { quoted: msg });
        }
      }
      // Push #88: SUPPORT CAST — a heal/buff skill targets a TEAMMATE (or self)
      // and does NOT spend the turn: no monster counter-attack. High-rank
      // monsters remember the healer (aggro) for the next few counters.
      if (action === 'skill' && skillArg) {
        try {
          const _mentioned = require('../../utils/target').resolveAll(msg, []);
          const _rawName = String(skillArg).replace(/@\S+/g, '').trim();
          const SCx = require('../../rpg/utils/SkillCatalog');
          const _pre = SCx.resolveSkill(player, _rawName, { allowLibrary: true });
          const _e = _pre.ok ? (_pre.entry || _pre.skill) : null;
          const _t = _e ? String(_e.type || '').toLowerCase() : '';
          const _isSupport = !!_e && (_t === 'heal' || _t === 'buff');
          // ── Push #93: NECROMANCER REFORGED ─────────────────────────────
          try {
            const NX = require('../../rpg/utils/Necromancy');
            if (_e && NX.isNecro(player) && (NX.isBoneWall(_e) || (NX.isSoulDrain(_e) && _mentioned.length))) {
              try { GR.noteRaidTurn(gate, chatId); } catch (e) {}
              if (NX.isBoneWall(_e)) {
                const bw = NX.castBoneWall(player, sender, _e, gate, db, _mentioned);
                GR.releaseCombatLock(gate.id);
                if (!bw.ok) return sock.sendMessage(chatId, { text: `❌ ${bw.error}` }, { quoted: msg });
                try { GR.saveGateState(db, gate); } catch (e) {} saveDatabase();
                return sock.sendMessage(chatId, { text: [
                  ...(pro ? [UI.PRO_BAR, `🦴 *BONE WALL${bw.aoe ? ' — FULL RAID' : ''}* 💎`, UI.PRO_BAR] : [`🦴 *BONE WALL${bw.aoe ? ' — FULL RAID' : ''}*`, UI.FREE_BAR]),
                  `🧱 *${player.name}* raises a fortress of the dead!`,
                  ...bw.lines,
                  ``,
                  `🕊️ Support casts don't use your turn — the monster does not counter.`,
                ].join('\n'), mentions: bw.mentions.filter(j => j !== sender) }, { quoted: msg });
              }
              // Soul Drain @ally — Tithe of the Fallen
              const mj = _mentioned[0]; const mN = GR.GKM.normaliseJid(mj);
              const inParty = (gate.raid?.members || []).find(m => GR.GKM.normaliseJid(m.id) === mN);
              if (!inParty) { GR.releaseCombatLock(gate.id); return sock.sendMessage(chatId, { text: `❌ That hunter is not in this raid party.` }, { quoted: msg }); }
              if (mN === GR.GKM.normaliseJid(sender)) { GR.releaseCombatLock(gate.id); return sock.sendMessage(chatId, { text: `❌ You cannot tithe yourself — tag an ally, or cast it on the monster: /party skill Soul Drain` }, { quoted: msg }); }
              const ally = db.users[mj] || db.users[inParty.id] || Object.values(db.users || {}).find(u => u && u.jid && GR.GKM.normaliseJid(u.jid) === mN);
              if (!ally) { GR.releaseCombatLock(gate.id); return sock.sendMessage(chatId, { text: `❌ Could not find that hunter's profile.` }, { quoted: msg }); }
              if ((ally.stats?.hp ?? 0) <= 0) { GR.releaseCombatLock(gate.id); return sock.sendMessage(chatId, { text: `💀 *${inParty.name || ally.name}* is already down.` }, { quoted: msg }); }
              const _cdS = SCx.onCooldown(player, _e); if (!_cdS.ready) { GR.releaseCombatLock(gate.id); return sock.sendMessage(chatId, { text: `❌ *${_e.name}* is on cooldown! (${Math.ceil(_cdS.msLeft / 1000)}s)` }, { quoted: msg }); }
              const _costS = SCx.effectiveCost(_e, player); if ((player.stats?.energy || 0) < _costS) { GR.releaseCombatLock(gate.id); return sock.sendMessage(chatId, { text: `❌ Not enough energy for *${_e.name}*! Need ${_costS}.` }, { quoted: msg }); }
              player.stats.energy = Math.max(0, (player.stats.energy || 0) - _costS); SCx.setCooldown(player, _e);
              const _lvS = Number((_pre.skill || {}).level || 1);
              const sd = NX.soulDrainAlly(player, ally, _lvS);
              const extra = [];
              try { inParty.hp = ally.stats.hp; } catch (e) {}
              if (sd.fell) extra.push(...GR.hunterFalls(gate, inParty.id, ally, db));
              GR.releaseCombatLock(gate.id);
              try { GR.saveGateState(db, gate); } catch (e) {} saveDatabase();
              return sock.sendMessage(chatId, { text: [
                ...(pro ? [UI.PRO_BAR, `👑 *SOUL DRAIN — TITHE OF THE FALLEN* 💎`, UI.PRO_BAR] : [`👑 *SOUL DRAIN — TITHE OF THE FALLEN*`, UI.FREE_BAR]),
                `🌑 *${player.name}* lays a hand on *${inParty.name || ally.name}*...`,
                ...sd.lines,
                ...extra,
                ``,
                `⚡ −${_costS} energy · 🕊️ does not use your turn.`,
              ].join('\n'), mentions: [inParty.id] }, { quoted: msg });
            }
          } catch (e) { console.error('[gateraid] necromancy cast:', e.message); }
          if (_isSupport) {
            try { GR.noteRaidTurn(gate, chatId); } catch (e) {} // Push #92: a heal/buff is a move too
            let tgtJid = sender, tgt = player;
            if (_mentioned.length) {
              const mj = _mentioned[0];
              const mN = GR.GKM.normaliseJid(mj);
              const inParty = (gate.raid?.members || []).find(m => GR.GKM.normaliseJid(m.id) === mN);
              const _isReviveSkill = /rebirth|revive|resurrect/i.test(`${_e.name} ${_e.effect || ''}`);
              // Push #88w: revive skills work ONLY on fallen hunters — and bring them back into the party.
              if (_isReviveSkill) {
                if (!GR.isFallen(gate, mj)) { GR.releaseCombatLock(gate.id); return sock.sendMessage(chatId, { text: `❌ That hunter has not fallen — revive skills only work on the dead.` }, { quoted: msg }); }
                const _cdR = SCx.onCooldown(player, _e); if (!_cdR.ready) { GR.releaseCombatLock(gate.id); return sock.sendMessage(chatId, { text: `❌ *${_e.name}* is on cooldown! (${Math.ceil(_cdR.msLeft / 1000)}s)` }, { quoted: msg }); }
                const _costR = SCx.effectiveCost(_e, player); if ((player.stats?.energy || 0) < _costR) { GR.releaseCombatLock(gate.id); return sock.sendMessage(chatId, { text: `❌ Not enough energy for *${_e.name}*! Need ${_costR}.` }, { quoted: msg }); }
                const _pctR = Math.max(10, Math.min(100, Number(_e.healingPct) || 30));
                const _rvH = GR.reviveFallen(gate, mj, db, _pctR);
                GR.releaseCombatLock(gate.id);
                if (!_rvH) return sock.sendMessage(chatId, { text: `❌ Could not find that hunter's profile.` }, { quoted: msg });
                player.stats.energy = Math.max(0, (player.stats.energy || 0) - _costR); SCx.setCooldown(player, _e);
                try { GR.saveGateState(db, gate); } catch (e) {} saveDatabase();
                return sock.sendMessage(chatId, { text: `✨ *${player.name}* casts *${_e.name}* — *${_rvH.player.name}* rises again with ${_rvH.hp}/${_rvH.max} HP and rejoins the party!`, mentions: [mj] }, { quoted: msg });
              }
              if (!inParty) { GR.releaseCombatLock(gate.id); return sock.sendMessage(chatId, { text: `❌ That hunter is not in this raid party.` }, { quoted: msg }); }
              tgt = db.users[mj] || db.users[inParty.id] || Object.values(db.users || {}).find(u => u && u.jid && GR.GKM.normaliseJid(u.jid) === mN);
              if (!tgt) { GR.releaseCombatLock(gate.id); return sock.sendMessage(chatId, { text: `❌ Could not find that hunter's profile.` }, { quoted: msg }); }
              tgtJid = inParty.id;
              if ((tgt.stats?.hp ?? 0) <= 0) { GR.releaseCombatLock(gate.id); return sock.sendMessage(chatId, { text: `💀 *${inParty.name || tgt.name}* is down — only a revive skill can help them.` }, { quoted: msg }); }
            }
            const _sc = GR.supportCast(player, sender, tgt, tgtJid, _rawName, gate, db);
            GR.releaseCombatLock(gate.id);
            if (!_sc.ok) return sock.sendMessage(chatId, { text: `❌ ${_sc.error}` }, { quoted: msg });
            const _self = tgtJid === sender && !_sc.party;
            try { GR.saveGateState(db, gate); } catch (e) {}
            saveDatabase();
            try { require('../../rpg/utils/QuestDispatcher').trackAndNotify(player, 'heal', 1, sock, sender, chatId); } catch (e) {}
            return sock.sendMessage(chatId, { text: [
              ...(pro ? [UI.PRO_BAR, `${_sc.isHeal ? '💚' : '✨'} *SUPPORT — ${_sc.skill.name}* 💎`, UI.PRO_BAR] : [`${_sc.isHeal ? '💚' : '✨'} *SUPPORT — ${_sc.skill.name}*`, UI.FREE_BAR]),
              `🙌 *${player.name}* ${_sc.isHeal ? 'heals' : 'buffs'} ${_sc.party ? 'the *whole party*' : _self ? 'themself' : `*${tgt.name}*`}!`,
              ..._sc.lines,
              ``,
              `🕊️ Support casts don't use your turn — the monster does not counter.`,
              ...(['B','A','S'].includes(String(gate.rank).toUpperCase()) ? [`⚠️ High-rank monsters now have their eye on the healer...`] : []),
              ...(pro ? [] : [FRAME, UI.upsell()]),
            ].join('\n'), mentions: _self ? [] : [tgtJid] }, { quoted: msg });
          }
        } catch (e) { console.error('[gateraid] support cast:', e.message); }
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
        // Push #92: pack context — other living Monsters on this raid team.
        let _packAllies = [];
        try { _packAllies = (gate.raid?.members || []).map(m => db.users[m.id] || Object.values(db.users).find(x => x && x.jid && GR.GKM.normaliseJid(x.jid) === GR.GKM.normaliseJid(m.id))).filter(Boolean); } catch (e) {}
        _tickLogs = require('../../rpg/utils/Transformation').withPack(_packAllies, () => UCgTick.tickStatuses(player)) || [];
        if (target && target.statusEffects) {
          if (!target.tempBuffs) target.tempBuffs = {}; // Push #95: monster roars / domain buffs tick down too
          const _tgt = { name: target.name || 'Monster', statusEffects: target.statusEffects, tempBuffs: target.tempBuffs, stats: { hp: target.hp, maxHp: target.maxHp } };
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
      try { GR.noteRaidTurn(gate, chatId); } catch (e) {} // Push #88q: idle-pressure clock
      // Push #88q: INITIATIVE — a faster raid monster can strike BEFORE the
      // hunter's move (hunters no longer always go first). The opening hit is
      // an extra action at 60% force and never kills outright (leaves 1 HP);
      // the normal counter-attack below still follows the hunter's strike.
      let _monActedFirst = false; // Push #88t: an initiative strike IS the monster's action this turn (no second attack)
      try {
        const _goesFirst = _grCanAct.canAct && target && !target.defeated && (target.hp || 0) > 0 && GR.raidMonsterGoesFirst(target, player);
        if (!_goesFirst && GR.raidMonsterGoesFirst.lastHeld && _grCanAct.canAct && target && !target.defeated) { try { await sock.sendMessage(chatId, { text: `⛓️ *${target.name}* is *${String(GR.raidMonsterGoesFirst.lastHeld).toUpperCase()}* — held in place, it cannot move first this turn.` }); } catch (e) {} }
        if (_goesFirst) {
          _monActedFirst = true;
          // Push #96h-e: SILENT initiative — the beast simply moves first; no speed talk.
          // Push #96h-l: …but its move is explained step by step like any other, support moves are free.
          // Push #96h-n: a raised /guard intercepts the opening strike too.
          let _iGuard = null; try { _iGuard = GR.takeGuard(gate, sender, db); } catch (e) { _iGuard = null; }
          const _iVictim = _iGuard ? _iGuard.guardian : player; const _iVictimJid = _iGuard ? _iGuard.guardianJid : sender;
          await sock.sendMessage(chatId, { text: `${target.emoji || '👹'} *${target.name}* lunges before *${player.name}* can act!` });
          if (_iGuard) await sock.sendMessage(chatId, { text: `🛡️ *GUARD!* *${_iGuard.guardianName}* steps in and takes the opening strike meant for *${player.name}*!` });
          const _MSFXi = require('../../rpg/utils/MonsterSkillFX');
          const _iPool = (Array.isArray(target.skills) && target.skills.length) ? target.skills : [{ name: '🔥 Flame Spurt', effect: 'burn', chance: 40 }, { name: '⚡ Volt Shock', effect: 'stun', chance: 25 }, { name: '🩸 Savage Bite', effect: 'bleed', chance: 40 }, { name: '😱 Terror Howl', effect: 'fear', chance: 30 }, { name: '🌀 Void Crush', effect: 'weaken', chance: 35 }];
          const _iPick = _MSFXi.pickMoves(_iPool);
          if (_iPick.support) { try { const _ss = _MSFXi.supportStep(target, player, _iPick.support); for (const b of _ss.blocks) { await sock.sendMessage(chatId, { text: b }); await new Promise(r => setTimeout(r, 500)); } } catch (e) {} }
          const _aDef = GR.effectiveDef(_iVictim, _iVictimJid); // Push #89: gear + title + pet
          const _hpBefore = _iVictim.stats.hp || 1;
          const _aRaw = GR.monsterDamage(target, _aDef, _iVictim);
          const _aDmg = Math.min(Math.max(0, _hpBefore - 1), Math.floor(_aRaw)); // Push #88t: full force (it replaces the counter), never a kill
          const _iSkill = _iPick.attack || { name: 'Strike', effect: null, chance: 0 };
          const _iBare = String(_iSkill.name || 'Strike').replace(/^[^\s]+\s/, '');
          const _iWrap = { name: _iVictim.name, stats: { hp: _hpBefore, maxHp: _effMax(_iVictim) }, statusEffects: _iVictim.statusEffects || [] }; // playTurn applies the damage to this wrapper
          await UCgFlow.playTurn(sock, chatId, {
            attacker: { name: target.name, stats: { hp: target.hp, maxHp: target.maxHp }, statusEffects: target.statusEffects || [] }, defender: _iWrap,
            move: { name: _iSkill.name, description: `A ferocious ${_iBare} technique.`, cooldownMs: 0, effect: _iSkill.effect ? { type: _iSkill.effect, chance: Math.min(90, (_iSkill.chance || 35) * GR.RAID_X2), duration: 2 } : null },
            result: { damage: _aDmg, crit: !!(GR.monsterDamage.last && GR.monsterDamage.last.crit), missed: _aRaw <= 0, dodged: _aRaw <= 0, preAbsorbed: true, absorbedNote: (GR.monsterDamage.last && GR.monsterDamage.last.shieldLine) || null },
            tag: `⚡ *MONSTER STRIKES FIRST*`, defenderBar: 'player', gapMs: 600,
          });
          _iVictim.stats.hp = Math.max(1, _hpBefore - (_aRaw > 0 ? _aDmg : 0));
          try { if (_iWrap.statusEffects !== _iVictim.statusEffects) _iVictim.statusEffects = _iWrap.statusEffects; } catch (e) {}
          try { const _rm = (gate.raid?.members || []).find(m => m.id === _iVictimJid || GR.GKM.normaliseJid(m.id) === GR.GKM.normaliseJid(_iVictimJid)); if (_rm) _rm.hp = _iVictim.stats.hp; } catch (e) {}
          try { const _fx = _MSFXi.apply(target, _iVictim, _iSkill, _aDmg, { skipStatus: true }); if (_fx.lines.length) await sock.sendMessage(chatId, { text: _fx.lines.join('\n') }); } catch (e) {}
        }
      } catch (e) {}
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
              // Push #85: refused — no turn spent, no monster counter.
              result = { damage:0, blocked:true, reason:`*${atk.name || ('Attack #' + patternId)}* is still on cooldown — ${UCg.formatCd(cd.remaining)} left. Pick another equipped attack; your turn was NOT used.` };
            } else {
              // Unified calc: treat monster as defender
              const fakeMonster = { stats:{ hp: target.hp, maxHp: target.maxHp, atk: target.atk, def: target.def||5, speed: 30 }, statusEffects: (target.statusEffects = target.statusEffects || []) };
              const uni = UCg.calcMoveDamage(player, fakeMonster, atk);
              if (uni.missed) result = { damage:0, isCrit:false, atkPattern: atk, missed:true, dodged: !!uni.dodged, missWhy: uni.missWhy || null };
              else result = { damage: uni.damage, isCrit: uni.crit, atkPattern: atk, unified: uni };
              UCg.setCooldown(player, patternId, atk); // Push #88o: a missed/dodged move enters cooldown too
              // Damage + move effect are applied by the shared playTurn flow below.
            }
          }
        }
      } else {
        const useSkill = action === 'skill' ? skillArg : null;
        try { GR.playerDamage.partyAllies = (gate.raid?.members || []).map(m => db.users[m.id] || Object.values(db.users || {}).find(x => x && x.jid && GR.GKM.normaliseJid(x.jid) === GR.GKM.normaliseJid(m.id))).filter(Boolean); } catch (e) { GR.playerDamage.partyAllies = []; } // Push #94: party buffs on hybrid strikes
        result = GR.playerDamage(player, useSkill, { statusEffects: target.statusEffects || [] });
        GR.playerDamage.partyAllies = [];
        // Push #55: pets count in the general attack flow as well (this is the
        // path /attack and /skill take outside /party).
        try {
          const _pba = PetCombat.atkBonus(sender) || 0;
          if (_pba > 0) result.damage = Math.max(1, (result.damage || 0) + _pba);
          if (target && !result.blocked) {
            const _st = PetCombat.abilityStrike(sender, target, { owner: player });
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
          ? { damage: 0, crit: false, missed: true, dodged: !!result.dodged, capability: 1, missWhy: result.missWhy || (result.unified && result.unified.missWhy) || null }
          : { damage: result.damage, crit: !!result.isCrit, missed: false, capability: result.unified ? result.unified.capability : undefined };
      } else if (result.skillUsed) {
        const _sk = result.skillUsed;
        const _skFx = (_sk.effect && typeof _sk.effect === 'object' && _sk.effect.type) ? _sk.effect : null;
        _gmMove = { name: _sk.name, description: _sk.description || 'A class skill unleashed in the heat of battle.', cooldownMs: (_sk.cooldown || 3) * 1000, effect: _skFx, isSkill: true, statuses: result.statuses || [], buffs: result.buffs || [], debuffs: result.debuffs || [], selfDebuffs: result.selfDebuffs || [] };
        _gmResult = { damage: result.damage, crit: !!result.isCrit, missed: !!result.missed, dodged: !!result.dodged, missWhy: result.missWhy || null };
      } else {
        _gmMove = { ...UCgFlow.basicStrike(), statuses: result.statuses || [] };
        _gmResult = { damage: result.damage, crit: !!result.isCrit, missed: !!result.missed, dodged: !!result.dodged, missWhy: result.missWhy || null };
      }
      const atkTitle = atkPattern ? `🥋 *ATTACK PATTERN #${atkPattern.id} — ${atkPattern.name}* [${atkPattern.rank}]` : `⚔️ *PLAYER ATTACK*`;
      const monWrap = { name: target.name, stats: { hp: target.hp, maxHp: target.maxHp }, statusEffects: target.statusEffects };
      await UCgFlow.playTurn(sock, chatId, {
        attacker: player, defender: monWrap, move: _gmMove, result: _gmResult,
        tag: atkTitle, defenderBar: 'monster', gapMs: 600,
      });
      target.hp = Math.max(0, monWrap.stats.hp);
      // Push #93: Soul Drain (monster) heals half the damage; Curse of Ruin lasts 3 ROUNDS.
      try { const NX = require('../../rpg/utils/Necromancy'); const _su = result.skillUsed; const _nl = [];
        if (_su && NX.isSoulDrain(_su) && (result.damage || 0) > 0 && !result.missed) { const _h = Math.floor(result.damage * 0.5); const _bh = player.stats.hp; player.stats.hp = Math.min(_effMax(player), _bh + _h); _nl.push(`🩸 *Soul Drain* — +${player.stats.hp - _bh} HP → ${player.stats.hp}/${_effMax(player)}`); }
        if (_su && NX.isRuin(_su)) { const _liv = (gate.raid?.members || []).length || 1; const _d = NX.scaleRuinToRounds(target, _liv); if (_d) _nl.push(`💀 *CURSE OF RUIN* on *${target.name}* — ATK −${NX.RUIN.atkCut}% · takes +${NX.RUIN.takenUp}% damage for ${NX.RUIN.rounds} rounds (${_d - 1} hunter turns)`); }
        if (_nl.length) await sock.sendMessage(chatId, { text: _nl.join('\n') });
      } catch (e) {}
      // Push #71: recovery skills report the HP they actually restored.
      if (Array.isArray(result.hpPercentLines) && result.hpPercentLines.length) await sock.sendMessage(chatId, { text: result.hpPercentLines.join('\n') });
      else if (result.healed > 0) await sock.sendMessage(chatId, { text: `💚 *${result.skillUsed?.name || 'Recovery'}* restored *${result.healed}* HP → ${player.stats.hp}/${_effMax(player)}` });
      if ((result.synergyNotes || []).length) await sock.sendMessage(chatId, { text: `⚡ *SYNERGY* ${result.synergyNotes.join(' · ')}` });
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
        const _ps = PetCombat.abilityStrike(sender, target, { owner: player });
        if (_ps) _petLines.push(_ps.line);
      } catch (e) {}

      if (target.hp <= 0) {
        // The 5 strike messages are already live — rewards go in their own message.
        const killLines = [];
        target.defeated = true;
        player._runKills = (player._runKills || 0) + 1; // Push #88: Devourer 'Hunger' stacks
        gate.monstersKilled = (gate.monstersKilled || 0) + 1;
        if (!player.stats_history) player.stats_history = {};
        player.stats_history.monstersKilled = (player.stats_history.monstersKilled || 0) + 1;
        try { require('../../rpg/utils/QuestDispatcher').trackAndNotify(player, 'kill', 1, sock, sender, chatId); } catch(e){}

        // Push #88w: REVIVED floor monsters (party idled 60s+ after clearing without
        // advancing) give NO rewards — no Nexus/EXP, no drops, no pet XP, no treasure.
        const _revivedKill = !!target.revived;
        if (_revivedKill) killLines.push(``, `💀 *${target.name}* (revived) defeated — *no rewards*, it was already beaten once.`);
        else try { const BR=require('../../rpg/utils/BattleRewards'); const w=BR.giveBattleWinRewards(player, db, 'gate', player.level, sock, chatId); killLines.push(``, `💀 *${target.name}* defeated!`, BR.formatRewards(w)); try { const _sx = BR.shareRaidExp(gate, sender, db, sock, chatId); if (_sx) killLines.push(_sx); } catch (e) {} } catch(e){ awardXP(player, 'gate_complete', saveDatabase, sock, chatId); killLines.push(``, `💀 *${target.name}* defeated!`); }

        const heal = GR.lifeSteal(player, result.damage);
        if (heal > 0) { player.stats.hp = Math.min(_effMax(player), (player.stats.hp || 0) + heal); killLines.push(`💚 Lifesteal: +${heal} HP`); }
        // Push #88t: support pets heal EVERY combat turn — including the turn the monster dies.
        try { const _kh = PetCombat.healPlayer(sender, player); if (_kh.healed > 0) killLines.push(`💚 *${_kh.petName || 'Pet'}* mended *${_kh.healed}* HP → ${_kh.hp}/${_effMax(player)}`); } catch (e) {}

        const dropLines = _revivedKill ? [] : GR.monsterKilledBy(gate, target, sender, db);
        if (dropLines.length) killLines.push(...dropLines);

        // Push #55: the pet earns XP from the kill (bonding + evolution path)
        if (!_revivedKill) try {
          const _pr = PetCombat.rewardPet(sender, { won: true, exp: 20 + (target.level || 1) * 6 });
          if (_pr) killLines.push(..._pr);
        } catch (e) {}

        // Push #89: on the boss floor the elites are the boss's party — they don't gate the boss fight.
        const _eliteLeft = floor >= gate.totalFloors ? floorMonsters.filter(mm => !mm.defeated && mm.elite).length : 0;
        const remaining = floorMonsters.filter(mm => !mm.defeated && !(mm.elite && floor >= gate.totalFloors)).length;
        killLines.push(``, `👾 *${Math.max(0, remaining)}* monsters remaining on Floor ${floor}${_eliteLeft ? ` (+${_eliteLeft} elite guarding the boss)` : ''}`);

        if (remaining <= 0 && _revivedKill) {
          // Re-cleared a revived floor: treasure was already banked the first time.
          gate.floorClearedAt = Date.now();
          if (floor >= gate.totalFloors) { killLines.push(``, `🏆 *BOSS FLOOR REACHED!*`, `/party boss — Engage the boss!`); }
          else { killLines.push(``, `✅ *Floor ${floor} re-cleared!* Move on within 60s or it revives again (+30%).`, `/party advance — Floor ${floor + 1}`); }
        } else if (remaining <= 0) {
          gate.floorClearedAt = Date.now(); // Push #88w: 60s idle → floor revives
          const fNexus = Math.floor((gate.nexusLoot || 1000) / (gate.totalFloors || 1) * (1 + (require('../../rpg/utils/JobSystem').mod(player, 'nexusMult') || 0) / 100)); // Push #96: Treasure Hunter finds more
          const fCrystals = Math.floor((gate.crystalLoot || 100) / (gate.totalFloors || 1));
          if (!gate.accumulatedTreasure) gate.accumulatedTreasure = { nexus: 0, crystals: 0 };
          gate.accumulatedTreasure.nexus += fNexus;
          gate.accumulatedTreasure.crystals += fCrystals;

          killLines.push(``, `💰 *Floor ${floor} Treasure Accumulated:* +${fNexus.toLocaleString()} 💠 Nexus & +${fCrystals.toLocaleString()} 💎 Mana Stones`);

          // Push #96h-m: floor XP, scaled by floor + rank, committed now (every living raider).
          try { const BRf = require('../../rpg/utils/BattleRewards'); let _fx = 0; const _ids = [sender, ...((gate.raid?.members || []).map(m => m.id).filter(id => id !== sender))];
            for (const id of _ids) { const u = db.users?.[id]; if (!u || (id !== sender && !((gate.raid?.members || []).find(m => m.id === id && (m.hp == null || m.hp > 0))))) continue; const got = BRf.grantFloorXp(u, floor, gate.rank); if (id === sender) _fx = got; LevelUpManager.checkAndApplyLevelUps(u, saveDatabase, sock, chatId); }
            if (_fx) killLines.push(`✨ *Floor ${floor} XP:* +${_fx.toLocaleString()} XP (every living raider) · /xp`); } catch (e) {}
          if (floor >= gate.totalFloors) { killLines.push(``, `🏆 *BOSS FLOOR REACHED!*`, `/party boss — Engage the boss!`); }
          else { killLines.push(``, `✅ *Floor ${floor} CLEARED!*`, `/party advance — Floor ${floor + 1}`, `⏳ Move on within *60s* — idle floors revive *+30% stronger* with no rewards.`); }
        }

        try { GR.saveGateState(db, gate); } catch (e) {}
      saveDatabase();
        return sock.sendMessage(chatId, { text: killLines.filter(Boolean).join('\n') }, { quoted: msg });
      }

      } // ── end player strike (skipped when stunned) ──

      // Monster counter-attack (frozen/stunned/paralyzed monsters lose their turn)
      let _monCanAct = { canAct: true, reason: null };
      try { _monCanAct = require('../../rpg/utils/UnifiedCombat').canAct({ statusEffects: target.statusEffects || [] }); } catch(e){}
      if (_monActedFirst && _monCanAct.canAct) _monCanAct = { canAct: false, reason: 'initiative' }; // Push #88t: one action per turn
      let _gDefGR = 0;
      try { _gDefGR = require('../../rpg/utils/GearSystem').getEquippedBonuses(player).def || 0; } catch (e) {}
      // Push #84: /guard — a teammate intercepts this hit; damage is recomputed
      // against the GUARDIAN's own defence and applied to the guardian.
      let _guardHit = null;
      // Push #88: high-rank monsters / bosses may swing at the HEALER instead.
      let _aggro = null;
      if (_monCanAct.canAct) { try { _aggro = GR.pickAggroTarget(gate, sender, db, !!_fightingBoss); } catch (e) { _aggro = null; } }
      if (_aggro) _guardHit = { guardian: _aggro.player, guardianJid: _aggro.jid, guardianName: _aggro.name, member: _aggro.member, aggro: true };
      if (_monCanAct.canAct && !_guardHit) { try { _guardHit = GR.takeGuard(gate, sender, db); } catch (e) { _guardHit = null; } }
      const _victim = _guardHit ? _guardHit.guardian : player;
      const _victimJid = _guardHit ? _guardHit.guardianJid : sender;
      let _gDefV = _gDefGR;
      if (_guardHit) { try { _gDefV = require('../../rpg/utils/GearSystem').getEquippedBonuses(_victim).def || 0; } catch (e) { _gDefV = 0; } }
      const def = GR.effectiveDef(_victim, _victimJid); // Push #89: guardian's FULL defence (gear + title + pet)
      const dmg = _monCanAct.canAct ? GR.monsterDamage(target, def, _victim) : 0;
      if (_guardHit && _guardHit.aggro) {
        await sock.sendMessage(chatId, { text: `🎯 *AGGRO!* *${target.name}* ignores *${player.name}* and lunges at the healer *${_guardHit.guardianName}*!` });
      } else if (_guardHit) {
        await sock.sendMessage(chatId, { text: `🛡️ *GUARD!* *${_guardHit.guardianName}* steps in front of *${player.name}* and takes the blow!` });
      }

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
      // Push #96h-l: support moves (Regenerate / Harden …) are free — the beast heals or buffs, then still attacks.
      const _MSFXc = require('../../rpg/utils/MonsterSkillFX');
      const _picked = _monCanAct.canAct ? _MSFXc.pickMoves(_pool71, skillPool[Math.floor(Math.random() * skillPool.length)]) : { support: null, attack: null };
      const monsterSkill = _picked.attack;
      // Push #96h-m: a LEAKED beast regenerates 90% of its turns (free support move, like any other).
      if (_monCanAct.canAct && target.leaked && !_picked.support && target.hp < target.maxHp && Math.random() < 0.90) _picked.support = '💚 Regenerate';
      if (_monCanAct.canAct && _picked.support) { try { const _ss = _MSFXc.supportStep(target, _victim, _picked.support); for (const b of _ss.blocks) { await sock.sendMessage(chatId, { text: b }); await new Promise(r => setTimeout(r, 500)); } } catch (e) {} }
      if (!_monCanAct.canAct && _monCanAct.reason === 'initiative') {
        await sock.sendMessage(chatId, { text: [
          ...(pro ? [UI.PRO_BAR, `⚡ *MONSTER SPENT* 💎`, UI.PRO_BAR] : [`⚡ *MONSTER SPENT*`, UI.FREE_BAR]),
          `*${target.name}* already struck first this turn — no counter-attack.`,
          `❤️ Your HP: *${player.stats.hp}/${_effMax(player)}*`,
        ].join('\n') }, { quoted: msg });
      } else if (!_monCanAct.canAct) {
        const _fzWord = _monCanAct.reason === 'frozen' ? 'frozen solid' : _monCanAct.reason === 'paralyzed' ? 'paralyzed' : 'stunned';
        const _fzEmo = _monCanAct.reason === 'frozen' ? '❄️' : _monCanAct.reason === 'paralyzed' ? '🔱' : '💫';
        await sock.sendMessage(chatId, { text: [
          ...(pro ? [UI.PRO_BAR, `🧊 *MONSTER HELD* 💎`, UI.PRO_BAR] : [`🧊 *MONSTER HELD*`, UI.FREE_BAR]),
          `${_fzEmo} *${target.name}* is ${_fzWord} and cannot move!`,
          `💥 Took *0* damage`,
          `❤️ Your HP: *${player.stats.hp}/${_effMax(player)}*`,
        ].join('\n') }, { quoted: msg });
      } else {
        // Same 5-message flow as the player's strike (damage math unchanged;
        // the status is applied inside playTurn via the move effect).
        const _skillBare = monsterSkill.name.replace(/^[^\s]+\s/, '');
        const monAtk = { name: target.name, stats: { hp: target.hp, maxHp: target.maxHp }, statusEffects: target.statusEffects || [] };
        await UCgFlow.playTurn(sock, chatId, {
          attacker: monAtk, defender: _victim,
          move: { name: monsterSkill.name, description: `A ferocious ${_skillBare} technique.`, cooldownMs: 0, effect: monsterSkill.effect ? { type: monsterSkill.effect, chance: Math.min(90, (monsterSkill.chance || 35) * GR.RAID_X2), duration: 2 } : null }, // Push #71: no more 100% status · Push #88q: raid status chance ×2
          result: { damage: dmg, crit: !!(GR.monsterDamage.last && GR.monsterDamage.last.crit), missed: dmg <= 0, dodged: dmg <= 0, preAbsorbed: true, absorbedNote: (GR.monsterDamage.last && GR.monsterDamage.last.shieldLine) || null },
          tag: `💢 *MONSTER COUNTER-ATTACK*`, gapMs: 600,
        });
        // Push #88: passives that trigger on being hit (reflect / survive-lethal / regen).
        try { const _pl = GR.afterMonsterHit(_victim, target, dmg); if (_pl.length) await sock.sendMessage(chatId, { text: _pl.join('\n') }); } catch (e) {}
        // Push #95: the move does what it says — Mana Drain drains energy, Life Drain heals the monster, Roars buff it.
        try { const _fx = require('../../rpg/utils/MonsterSkillFX').apply(target, _victim, monsterSkill, dmg, { skipStatus: true }); if (_fx.lines.length) await sock.sendMessage(chatId, { text: _fx.lines.join('\n') }); } catch (e) {}
      }
      // Push #95: DOMAINS — bosses / B-rank+ monsters may expand a domain over the party.
      try { const DS = require('../../rpg/utils/DomainSystem'); const _hunters = GR.livingMembers ? GR.livingMembers(gate, db) : [player]; const _tl = DS.tick(DS.arenaOf(gate)); if (_tl) await sock.sendMessage(chatId, { text: _tl }); const _dl = DS.monsterTry(DS.arenaOf(gate), target, _hunters, { boss: !!_fightingBoss, rank: gate.rank }); if (_dl) await DS.sendDomain(sock, chatId, _dl); } catch (e) {}

      try { const _lg = require('../../rpg/utils/PetManager').tickLastGift(player); if (_lg && _lg.healed > 0) await sock.sendMessage(chatId, { text: `✨ *Last Gift* (${_lg.from}): +${_lg.healed} HP regen · ${_lg.turnsLeft} turn${_lg.turnsLeft === 1 ? '' : 's'} left` }); } catch (e) {}
      if (_guardHit) {
        // Sync raid member HP + resolve the guardian's death exactly like a normal death.
        try { const gm = _guardHit.member; gm.hp = _victim.stats.hp; } catch (e) {}
        if (_victim.stats.hp <= 0) {
          _victim.stats.hp = 1;
          _victim.stats_history = _victim.stats_history || {};
          _victim.stats_history.gateDeaths = (_victim.stats_history.gateDeaths || 0) + 1;
          const loss = Math.floor((_victim.manaCrystals || 0) * 0.15);
          _victim.manaCrystals = Math.max(0, (_victim.manaCrystals || 0) - loss);
          const _gN = GR.GKM.normaliseJid(_victimJid);
          const _gGone = (id) => id !== _victimJid && (!_gN || GR.GKM.normaliseJid(id) !== _gN);
          if (gate.raid) gate.raid.members = gate.raid.members.filter(m => _gGone(m.id));
          try { GR.markFallen(gate, _victimJid); } catch (e) {} // Push #88w
          try { const _ln = GR.takeLeaderNotice(gate); if (_ln) await sock.sendMessage(chatId, { text: _ln }); } catch (e) {}
          gate.raiders = (gate.raiders || []).filter(_gGone);
          await sock.sendMessage(chatId, { text: [
            _guardHit.aggro ? `💀 *${_guardHit.guardianName} WAS CUT DOWN BY THE MONSTER'S AGGRO!*` : `💀 *${_guardHit.guardianName} FELL PROTECTING ${String(player.name || '').toUpperCase()}!*`,
            `The blow was too strong to withstand. Lost ${loss.toLocaleString()} 💎 · fled with 1 HP.`,
            `🛡️ *${player.name}* was untouched.`,
          ].join('\n') });
          if (gate.raid && gate.raid.members.length === 0) {
            await sock.sendMessage(chatId, { text: GR.wipeGate(gate, key, keyData, chatId, db).join('\n') });
          } else { try { GR.saveGateState(db, gate); } catch (e) {} }
        } else {
          await sock.sendMessage(chatId, { text: `🛡️ *${_guardHit.guardianName}* held the line! ❤️ ${_victim.stats.hp}/${_effMax(_victim)}` });
        }
        saveDatabase();
      }

      if (!_guardHit && player.stats.hp <= 0) {
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

          // Push #88: a single death pays NOTHING out — the party treasure
          // stays banked. Only a full WIPE salvages 10% (to the guild treasury).

          deathLines.push(``, `💀 *YOU FELL IN THE GATE!*`, `Lost ${loss.toLocaleString()} 💎`, `You fled with 1 HP.`);
          // Push #29: JID-tolerant removal + wipe check (never re-persist a
          // wiped gate — wipeGate already dropped it from every registry).
          {
            const _sN = GR.GKM.normaliseJid(sender);
            const _gone = (id) => id !== sender && (!_sN || GR.GKM.normaliseJid(id) !== _sN);
            if (gate.raid) gate.raid.members = gate.raid.members.filter(m => _gone(m.id));
            try { GR.markFallen(gate, sender); } catch (e) {} // Push #88w
            try { const _ln = GR.takeLeaderNotice(gate); if (_ln) await sock.sendMessage(chatId, { text: _ln }); } catch (e) {}
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
        if (_ph.healed > 0) msg3Lines.push(`💚 *${_ph.petName || 'Pet'}* mended *${_ph.healed}* HP → ${_ph.hp}/${_effMax(player)}`);
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
        // Push #89: the boss party falls with the boss (no rewards for them).
        try { for (const _el of (gate.monsters || [])) if (_el && _el.elite && !_el.defeated) { _el.defeated = true; _el.hp = 0; _el.revived = true; } } catch (e) {}
        AuraSystem.addAura(player, 'bossKill');
        try {
          const QD = require('../../rpg/utils/QuestDispatcher');
          QD.trackAndNotify(player, 'boss', 1, sock, sender, chatId);
          QD.trackAndNotify(player, 'clear', 1, sock, sender, chatId);
        } catch(e){}
        // Push #87: /weekly "Defeat 3 World Bosses" — every raid member who hit the boss gets credit.
        try {
          const WK = require('./weekly');
          const hitters = new Set([sender, ...Object.keys(gate.damageDealt || {})]);
          for (const jid of hitters) { const u = db.users[jid]; if (u) WK.trackWeeklyProgress(u, 'boss_kill', 1); }
        } catch (e) {}
        // Gate clear: +15 GP to the killer's guild (weekly + lifetime + quest)
        try { require('../../rpg/utils/GuildPointsSystem').addGuildGP(db, sender, 15, 'Gate clear (' + (gate.rank || '?') + '-Rank)', { quest: true, sock, jid: sender, chatId }); } catch(e){}

        const damageDealt = gate.damageDealt || {};
        const topRaider = Object.entries(damageDealt).sort((a, b) => b[1] - a[1])[0];
        if (topRaider && topRaider[0] === sender) AuraSystem.addAura(player, 'topRaider');

        awardXP(player, 'gate_boss', saveDatabase, sock, chatId);
        try { const BRb=require('../../rpg/utils/BattleRewards'); const wb=BRb.giveBattleWinRewards(player, db, 'gate', player.level, sock, chatId, { boss: true }); out.push(BRb.formatRewards(wb)); try { const _sx = BRb.shareRaidExp(gate, sender, db, sock, chatId); if (_sx) out.push(_sx); } catch (e) {} } catch(e){}

        // Final-blow boss loot → the killer
        const bossDropLines = [];
        const bossDrop = GateManager.rollMonsterKillDrop(gate.rank, boss.baseName || boss.name, player);
        if (bossDrop) {
          require('../../rpg/utils/RewardInventory').grantItem(player, { ...bossDrop, type: bossDrop.type || 'material', fromGate: gate.id }, 'gate');
          bossDropLines.push(`🎁 *BOSS DROP → ${player.name}* (final blow): *${bossDrop.name}*`);
        }

        // Distribute full loot: gold→guild treasury, drops→final-blow, recovery
        const _double = !!(gate.doubleRoll && !gate.isDouble); // Push #96d: a second gate hides behind this boss
        const loot = GR.clearGate(gate, key, keyData, db, saveDatabase, { keepOpen: _double });

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
        out.push(`🪤 */catch* — 3 shared attempts for the whole raid, first success keeps it! Flees in 60s.`);
        try { const B = require('../../utils/buttons'); setTimeout(() => { B.sendButtons(sock, chatId, { text: `🐾 *${loot.wildPet.name}* is loose — tap to catch!`, buttons: B.quickReplies([[`🪤 Catch ${loot.wildPet.name}`.slice(0, 20), '/catch']]) }).catch(() => {}); }, 1200); } catch (e) {} // Push #96h-n: catch button
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
        if (_double) {
          const _ldr = db.users?.[gate.raid?.leader]; const _ln = _ldr ? _ldr.name : 'Leader';
          out.push(``, `🌀 *THE GATE DOES NOT CLOSE…*`, `A *DOUBLE DUNGEON* yawns open behind the fallen boss — rank unknown (B, A or S). Once entered it is sealed: nobody joins, nobody flees.`, `👑 *${_ln}* decides: */party proceed* or */party leave*`);
          try { const Buttons = require('../../utils/buttons'); setTimeout(() => Buttons.sendButtons(sock, chatId, { text: `🌀 *DOUBLE DUNGEON* — ${_ln}, proceed or leave?`, buttons: Buttons.quickReplies([['⚔️ Proceed', '/party proceed'], ['🚪 Leave', '/party leave']]) }).catch(() => {}), 1500); } catch (e) {}
        } else if (gate.isDouble) {
          out.push(``, `🏆 *DOUBLE DUNGEON CONQUERED!* (${gate.rank}-Rank revealed)`, `🎁 Every survivor may open a box: */box blessed* or */box cursed* (sent to your DM)`);
          try { const Buttons = require('../../utils/buttons'); for (const jid of (loot.doubleBoxes || [])) setTimeout(() => Buttons.sendButtons(sock, jid, { text: `🎁 *DOUBLE DUNGEON SURVIVOR* — choose your box:`, buttons: Buttons.quickReplies([['✨ Blessed box', '/box blessed'], ['🖤 Cursed box', '/box cursed']]) }).catch(() => {}), 1200); } catch (e) {}
          out.push(`🚪 *GATE ${gate.id} CLEARED!*`);
        } else out.push(`🚪 *GATE ${gate.id} CLEARED!*`);
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
      // Push #89: the 2 ELITE SOLDIERS are the boss's PARTY — they fight beside it, not before it.
      const floorMonsters = (gate.monsters || []).filter(mm => mm.floor === floor && !mm.defeated && !mm.elite);
      if (floorMonsters.length > 0) return sock.sendMessage(chatId, { text: `❌ Clear all floor ${floor} monsters first!` }, { quoted: msg });
      if (floor < gate.totalFloors) return sock.sendMessage(chatId, { text: `❌ Reach Floor ${gate.totalFloors} before engaging the boss.` }, { quoted: msg });
      if (gate.boss.defeated) return sock.sendMessage(chatId, { text: '✅ Boss already defeated!' }, { quoted: msg });
      try { GR.noteRaidTurn(gate, chatId); } catch (e) {} // Push #92: every boss action restarts the idle clock
      gate.floorClearedAt = null; // Push #88w: engaging the boss = moving on

      const boss = gate.boss;
      // Push #93: boss statuses (Curse of Ruin) count down one per hunter turn.
      try { if ((boss.statusEffects || []).length) { const _bt = { name: boss.name, statusEffects: boss.statusEffects, stats: { hp: boss.hp, maxHp: boss.maxHp } }; const _bl = require('../../rpg/utils/UnifiedCombat').tickStatuses(_bt); boss.hp = Math.max(0, _bt.stats.hp); if (_bl.some(l => /ruin wore off/.test(l))) await sock.sendMessage(chatId, { text: `✨ *Curse of Ruin* on *${boss.name}* has worn off.` }); } } catch (e) {}
      try { GR.playerDamage.partyAllies = (gate.raid?.members || []).map(m => db.users[m.id] || Object.values(db.users || {}).find(x => x && x.jid && GR.GKM.normaliseJid(x.jid) === GR.GKM.normaliseJid(m.id))).filter(Boolean); } catch (e) { GR.playerDamage.partyAllies = []; } // Push #94
      const result = GR.playerDamage(player, skillArg || null, { statusEffects: (boss.statusEffects = boss.statusEffects || []) });
      GR.playerDamage.partyAllies = [];
      if (result.blocked) return sock.sendMessage(chatId, { text: `❌ ${result.reason}` }, { quoted: msg });
      // Push #55: pets fight the boss too — ATK bonus + their own ability hit.
      try {
        const _pbAtk = PetCombat.atkBonus(sender) || 0;
        if (_pbAtk > 0) result.damage = Math.max(1, (result.damage || 0) + _pbAtk);
        const _bstrike = PetCombat.abilityStrike(sender, boss, { owner: player });
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
        _bMove = { name: result.skillUsed.name, description: result.skillUsed.description || 'A class skill unleashed on the boss.', cooldownMs: (result.skillUsed.cooldown || 3) * 1000, effect: null, statuses: (result.statuses || []).filter(st => st && st.type === 'ruin'), debuffs: result.debuffs || [], selfDebuffs: result.selfDebuffs || [] }; // Push #96h-k: stat debuffs land on bosses · Push #93: Curse of Ruin lands on bosses (other statuses stay boss-immune)
      } else {
        _bMove = UCgBoss.basicStrike();
      }
      const bossWrap = { name: boss.name, stats: { hp: boss.hp, maxHp: boss.maxHp }, statusEffects: (boss.statusEffects = boss.statusEffects || []) }; // Push #93: skill statuses (Curse of Ruin) land on the boss
      await UCgBoss.playTurn(sock, chatId, {
        attacker: player, defender: bossWrap, move: _bMove,
        result: { damage: result.damage, crit: !!result.isCrit, missed: false },
        tag: `🏆 *BOSS BATTLE*\n💀 *${boss.name}*`, defenderBar: 'boss', gapMs: 600,
      });
      boss.hp = Math.max(0, bossWrap.stats.hp);

      const lines = [];
      try { const NX = require('../../rpg/utils/Necromancy'); const _su = result.skillUsed;
        if (_su && NX.isSoulDrain(_su) && (result.damage || 0) > 0 && !result.missed) { const _h = Math.floor(result.damage * 0.5); const _bh = player.stats.hp; player.stats.hp = Math.min(_effMax(player), _bh + _h); lines.push(`🩸 Soul Drain: +${player.stats.hp - _bh} HP`); }
        if (_su && NX.isRuin(_su)) { const _tg = boss; const _liv = (gate.raid?.members || []).length || 1; const _d = NX.scaleRuinToRounds(_tg, _liv); if (_d) lines.push(`💀 *CURSE OF RUIN* — ATK −${NX.RUIN.atkCut}% · takes +${NX.RUIN.takenUp}% damage for ${NX.RUIN.rounds} rounds (${_d - 1} hunter turns)`); }
      } catch (e) {}
      if (Array.isArray(result.hpPercentLines) && result.hpPercentLines.length) lines.push(...result.hpPercentLines);
      else if (result.healed > 0) lines.push(`💚 *${result.skillUsed?.name || 'Recovery'}* restored *${result.healed}* HP → ${player.stats.hp}/${_effMax(player)}`);
      if ((result.synergyNotes || []).length) lines.push(`⚡ *SYNERGY* ${result.synergyNotes.join(' · ')}`);
      // Push #55: the boss round reports what the pet did too.
      try { if (result.petLine) lines.push(result.petLine); } catch (e) {}
      try {
        const _bh = PetCombat.healPlayer(sender, player);
        if (_bh.healed > 0) lines.push(`💚 *${_bh.petName}* mended *${_bh.healed}* HP → ${_bh.hp}/${_effMax(player)}`);
      } catch (e) {}

      if (boss.hp <= 0) {
        lines.push(...await finishBossDefeat());
      } else {
        // Push #89: BOSS PARTY — every living elite soldier on this floor strikes
        // alongside the boss (full force, never lethal on its own: leaves ≥1 HP).
        try {
          const _elites = (gate.monsters || []).filter(mm => mm && mm.elite && mm.floor === gate.currentFloor && !mm.defeated && (mm.hp || 0) > 0);
          if (_elites.length) {
            const _eDef = GR.effectiveDef(player, sender);
            for (const _el of _elites) {
              const _er = GR.monsterDamage(_el, _eDef, player);
              const _ecrit = !!(GR.monsterDamage.last && GR.monsterDamage.last.crit);
              if (GR.monsterDamage.last && GR.monsterDamage.last.shieldLine) lines.push(GR.monsterDamage.last.shieldLine);
              if (_er <= 0) { lines.push(`⚜️ *${_el.name}* lunges beside the boss — 💨 *${player.name}* dodged!`); continue; }
              const _ed = Math.min(Math.max(0, (player.stats.hp || 1) - 1), Math.floor(_er));
              player.stats.hp = Math.max(1, (player.stats.hp || 1) - _ed);
              lines.push(`⚜️ *${_el.name}* strikes beside the boss — ${_ecrit ? '💥 CRIT ' : ''}💢 *${_ed}* dmg → ❤️ ${player.stats.hp}/${_effMax(player)}`);
            }
            lines.push(`💡 Elites fall with the boss — or thin them first with /party attack.`);
          }
        } catch (e) {}
        let _gDefGR2 = 0;
        try { _gDefGR2 = require('../../rpg/utils/GearSystem').getEquippedBonuses(player).def || 0; } catch (e) {}
        // Push #84: /guard intercept (boss) — resolved against the guardian's stats.
        let _bGuard = null;
        try { const _ag = GR.pickAggroTarget(gate, sender, db, true); if (_ag) _bGuard = { guardian: _ag.player, guardianJid: _ag.jid, guardianName: _ag.name, aggro: true }; } catch (e) {}
        if (!_bGuard) { try { _bGuard = GR.takeGuard(gate, sender, db); } catch (e) { _bGuard = null; } }
        const _bVictim = _bGuard ? _bGuard.guardian : player;
        const _bVictimJid = _bGuard ? _bGuard.guardianJid : sender;
        if (_bGuard) { try { _gDefGR2 = require('../../rpg/utils/GearSystem').getEquippedBonuses(_bVictim).def || 0; } catch (e) { _gDefGR2 = 0; } }
        const def = GR.effectiveDef(_bVictim, _bVictimJid); // Push #89
        // Push #88: the boss hits with its CALIBRATED atk (severity × floor), not a flat rank constant.
        const bossAtk = (typeof boss.atk === 'number' && boss.atk > 0) ? boss.atk : Math.floor(GATE_RANKS[gate.rank].monsterRange[1] * 0.20 * ((gate.calibrated && gate.calibrated.severity) || 1));
        // Push #74: boss hits go through the same dodge/passive/weaken maths.
        const _bossRegen = Math.random() < 0.25 && boss.hp < boss.maxHp; // Push #96d: bosses can Regenerate · Push #96h-l: it is a FREE support move (no damage, no turn) — the boss still strikes
        if (_bossRegen) { try { const _ss = require('../../rpg/utils/MonsterSkillFX').supportStep(boss, _bVictim, '💚 Regenerate'); for (const b of _ss.blocks) { await sock.sendMessage(chatId, { text: b }); await new Promise(r => setTimeout(r, 500)); } } catch (e) {} }
        let dmg = GR.monsterDamage({ atk: bossAtk, speed: boss.speed || 14, statusEffects: boss.statusEffects || [], _raid: true, isBoss: true, rank: gate.rank }, def, _bVictim);
        if (_bGuard && _bGuard.aggro) await sock.sendMessage(chatId, { text: `🎯 *AGGRO!* *${boss.name}* turns on the healer *${_bGuard.guardianName}*!` });
        else if (_bGuard) await sock.sendMessage(chatId, { text: `🛡️ *GUARD!* *${_bGuard.guardianName}* steps in front of *${player.name}* and takes the boss's blow!` });
        const bossAtkW = { name: boss.name, stats: { hp: boss.hp, maxHp: boss.maxHp }, statusEffects: [] };
        await UCgBoss.playTurn(sock, chatId, {
          attacker: bossAtkW, defender: _bVictim,
          move: { name: 'Retaliation', description: 'The boss lashes out with overwhelming force.', cooldownMs: 0 },
          result: { damage: dmg, crit: !!(GR.monsterDamage.last && GR.monsterDamage.last.crit), missed: dmg <= 0, dodged: dmg <= 0, preAbsorbed: true, absorbedNote: (GR.monsterDamage.last && GR.monsterDamage.last.shieldLine) || null },
          tag: `💢 *BOSS COUNTER*`, gapMs: 600,
        });
        try { const _pl = GR.afterMonsterHit(_bVictim, boss, dmg); if (_pl.length) lines.push(..._pl); } catch (e) {}
        const heal = GR.lifeSteal(player, result.damage);
        if (heal > 0) player.stats.hp = Math.min(_effMax(player), player.stats.hp + heal);
        if (heal > 0) lines.push(`💚 Lifesteal: +${heal} HP`);
        try { const _lg = require('../../rpg/utils/PetManager').tickLastGift(player); if (_lg && _lg.healed > 0) lines.push(`✨ *Last Gift* (${_lg.from}): +${_lg.healed} HP · ${_lg.turnsLeft} turns left`); } catch (e) {}
        lines.push(`❤️ Your HP: *${player.stats.hp}/${_effMax(player)}*`);

        if (_bGuard) {
          try { _bGuard.member.hp = _bVictim.stats.hp; } catch (e) {}
          if (_bVictim.stats.hp <= 0) {
            _bVictim.stats.hp = 1;
            _bVictim.stats_history = _bVictim.stats_history || {};
            _bVictim.stats_history.gateDeaths = (_bVictim.stats_history.gateDeaths || 0) + 1;
            const gl = Math.floor((_bVictim.manaCrystals || 0) * 0.15);
            _bVictim.manaCrystals = Math.max(0, (_bVictim.manaCrystals || 0) - gl);
            const _gN = GR.GKM.normaliseJid(_bVictimJid);
            const _gGone = (id) => id !== _bVictimJid && (!_gN || GR.GKM.normaliseJid(id) !== _gN);
            if (gate.raid) gate.raid.members = gate.raid.members.filter(m => _gGone(m.id));
          try { GR.markFallen(gate, _bVictimJid); } catch (e) {} // Push #88w
          try { const _ln = GR.takeLeaderNotice(gate); if (_ln) lines.push(_ln); } catch (e) {}
            gate.raiders = (gate.raiders || []).filter(_gGone);
            lines.push(``, `💀 *${_bGuard.guardianName} FELL PROTECTING ${String(player.name || '').toUpperCase()}!*`, `Too strong to withstand. Lost ${gl.toLocaleString()} 💎 · fled with 1 HP.`);
            if (gate.raid && gate.raid.members.length === 0) lines.push(...GR.wipeGate(gate, key, keyData, chatId, db));
          } else {
            lines.push(`🛡️ *${_bGuard.guardianName}* held the line! ❤️ ${_bVictim.stats.hp}/${_effMax(_bVictim)}`);
          }
        }

        if (!_bGuard && player.stats.hp <= 0) {
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
            try { GR.markFallen(gate, sender); } catch (e) {} // Push #88w
            try { const _ln = GR.takeLeaderNotice(gate); if (_ln) await sock.sendMessage(chatId, { text: _ln }); } catch (e) {}
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
