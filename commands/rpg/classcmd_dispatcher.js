// ═══════════════════════════════════════════════════════════════
// Class-Specific Skill Command Dispatcher
//
// REPLACES the old /dungeon use [skill] and /pvp use 1 patterns.
// Every class has its own befitting command (see rpg/utils/classcmd.js).
// This single file handles ALL class commands — players type
// /heal, /cast, /rage, /prayer, etc. and it routes to their class's
// skills automatically.
//
// How it works:
//   1. Player types /<cmdName> (e.g. /heal)
//   2. We look up the player's class and get its expected cmdName
//   3. If it matches: this is the player's command, use their skill
//   4. If not: friendly "this is the X class's command" message
//
// Each class can declare skill behavior via a handler. If a class
// has no special handler, the default handler applies the skill
// (energy check, cooldown, effect).
// ═══════════════════════════════════════════════════════════════

'use strict';

const { getClassCmdName, isClassCommand, DEFAULT_CMD_NAMES } = require('../../rpg/utils/classcmd');
const CS = require('../../rpg/utils/ClassSystem');
const SD = require('../../rpg/utils/SkillDescriptions');
const { AuraSystem } = require('../../rpg/utils/AuraSystem');
const UI = require('../../rpg/utils/UI');

module.exports = {
  name: 'classcmd',   // Primary name (gets aliased to all class cmdNames below)
  description: 'Class-specific skill command — use your class abilities',
  aliases: [...Object.values(DEFAULT_CMD_NAMES), 'call'],  // 'heal', 'call', 'cast', 'rage', etc.

  // ── Main dispatch ──────────────────────────────────────────────
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];

    if (!player) {
      return sock.sendMessage(chatId, { text: '❌ You are not registered!' }, { quoted: msg });
    }
    const pro = UI.isPro(player);
    const FRAME = pro ? UI.PRO_BAR : UI.FREE_BAR;

    const className = typeof player.class === 'string' ? player.class : (player.class?.name || null);

    // ── 1. No class assigned? ─────────────────────────────────
    if (!className) {
      return sock.sendMessage(chatId, {
        text: `❌ You don't have a class yet!\n\nKeep earning XP — your class awakens between 50,000–150,000 total XP.`
      }, { quoted: msg });
    }

    const playerCmd = getClassCmdName(className);

    // ── 2. Did the player type their class's command? ────────
    //    We can't know which alias was used from `args[0]` because
    //    the command dispatcher strips it. Instead, the handler
    //    is invoked with `commandName` context. We do a final
    //    check here: if the user typed the wrong cmd, redirect.
    //
    //    NOTE: This dispatcher file is registered under the primary
    //    name 'classcmd' with aliases for each class. The handler
    //    framework will call THIS function for ANY of those names.
    //    We determine the actual command name from the message.
    const usedCmd = extractCommandName(msg, sender);

    // /skill (+aliases) is the universal entry point (skill.js forwards here) — always allowed through
    const UNIVERSAL_CMDS = new Set(['skill', 'skills', 'useskill', 'castskill', 'classcmd']);
    const isMatchingCmd = UNIVERSAL_CMDS.has(usedCmd) || (usedCmd === playerCmd) || (className === 'Mage' && (usedCmd === 'call' || usedCmd === 'cast'));

    if (usedCmd && !isMatchingCmd) {
      // Player used a different class's command
      const intendedClass = findClassByCmdName(usedCmd);
      return sock.sendMessage(chatId, {
        text: (pro ? `${UI.PRO_BAR}
❌ *${usedCmd}* is the *${intendedClass}* class command. 💎
${UI.PRO_BAR}
` : `❌ *${usedCmd}* is the *${intendedClass}* class command.
${UI.FREE_BAR}
`) + `🎭 Your class: *${className}*
📌 Your class command: */${playerCmd}*

${getCmdHelp(playerCmd)}
${FRAME}` + (pro ? '' : `\n${UI.upsell()}`)
      }, { quoted: msg });
    }

    // ── 3. No skill specified → show class skills menu ──────────
    const skillName = args[0];
    if (!skillName) {
      return showClassSkillMenu(sock, msg, player, className);
    }

    // ── 4. Find the skill on the player ───────────────────────
    const skill = findPlayerSkill(player, className, skillName);
    if (!skill) {
      return sock.sendMessage(chatId, {
        text: `❌ *${className}* doesn't know the skill *${skillName}*.\n\nUse */${playerCmd}* (no args) to see your class skills.`
      }, { quoted: msg });
    }

    // ── 4b. Route into modern battle engines (mirrors /attack routing) ──
    // The legacy queue in step 5 is write-only for these engines — forward instead.
    // PvP: lock the skill as this turn's move
    if (player.pvpBattle) {
      const _rdy = skillReady(player, skill);
      if (!_rdy.ok) return sock.sendMessage(chatId, { text: `❌ ${_rdy.reason}` }, { quoted: msg });
      // Push #88b: engine sets the cooldown itself — pre-setting here made every routed skill instantly 'on cooldown'.
      const PvpCmd = require('./pvp');
      return PvpCmd.execute(sock, msg, ['skill', skill.name], getDatabase, saveDatabase, sender);
    }
    // Gate raid in current chat (same detection as attacks.js)
    try {
      const GKM = require('../../rpg/dungeons/GateKeyManager');
      const { GateManager } = require('../../rpg/dungeons/GateManager');
      const sNum = normaliseJidShort(sender);
      const gc = GKM.getDungeonGC(chatId);
      let _gkey = null;
      if (gc?.activeKeyId) {
        const keyData = GKM.getKey(gc.activeKeyId) || db.gateKeys?.[gc.activeKeyId];
        if (keyData) {
          const gate = GateManager.getGate(keyData.gateId);
          if (gate?.raid?.status === 'active' && gate.raid.members?.some(m => normaliseJidShort(m.id) === sNum)) _gkey = gc.activeKeyId;
        }
      }
      if (!_gkey) {
        for (const gate of Object.values(GateManager.gates || {})) {
          if (gate?.raid?.status === 'active' && gate.raid.members?.some(m => normaliseJidShort(m.id) === sNum)) { _gkey = gate.raid.key; break; }
        }
      }
      if (_gkey) {
        const _rdy = skillReady(player, skill);
        if (!_rdy.ok) return sock.sendMessage(chatId, { text: `❌ ${_rdy.reason}` }, { quoted: msg });
        // Push #88b: engine sets the cooldown itself — pre-setting here made every routed skill instantly 'on cooldown'.
        const GateRaidCmd = require('./gateraid');
        return GateRaidCmd.execute(sock, msg, [_gkey, 'skill', skill.name], getDatabase, saveDatabase, sender);
      }
    } catch(e){}
    // Dungeon solo / party (modern managers)
    try {
      const DungeonPartyManager = require('../../rpg/dungeons/DungeonPartyManager');
      const _inSolo = !!(db.soloDungeons && db.soloDungeons[sender]);
      const _pty = DungeonPartyManager.getPartyByPlayer(sender);
      if (_inSolo || (_pty && _pty.status === 'active')) {
        const _rdy = skillReady(player, skill);
        if (!_rdy.ok) return sock.sendMessage(chatId, { text: `❌ ${_rdy.reason}` }, { quoted: msg });
        // Push #88b: engine sets the cooldown itself — pre-setting here made every routed skill instantly 'on cooldown'.
        const DungeonCmd = require('./dungeon');
        return DungeonCmd.execute(sock, msg, ['classcmd', skill.name], getDatabase, saveDatabase, sender);
      }
    } catch(e){}

    // ── 5. Dispatch to per-class handler (or default) ─────────
    // First, check if the player is in an active battle. If so, queue
    // the action in the battle and tell the dispatcher to wait for
    // round resolution. Otherwise, fire the skill immediately.
    const inBattle = checkInBattle(player, db);
    if (inBattle) {
      // Queue the action in the current battle
      const cmdName = extractCommandName(msg, sender);
      const result = queueBattleAction(player, db, inBattle, skill.name, cmdName);
      if (result.ok) {
        return sock.sendMessage(chatId, {
          text: (pro ? `${UI.PRO_BAR}
⚔️ *${skill.name}* queued! 💎
${UI.PRO_BAR}
` : `⚔️ *${skill.name}* queued!
${UI.FREE_BAR}
`) + `📋 Queued for end of round in *${inBattle.type}*.
⏳ Waiting for opponent's action...

${getCmdHelp(extractCommandName(msg, sender))}
${FRAME}` + (pro ? `\n${UI.PRO_MINI}\n💎 *PRO FOCUS* — ${skill.energyCost || 15} energy · ${skill.cooldown || 0}s CD` : `\n${UI.upsell()}`)
        }, { quoted: msg });
      } else {
        return sock.sendMessage(chatId, { text: `❌ ${result.reason}` }, { quoted: msg });
      }
    }

    // Not in battle — fire the skill immediately
    const handler = getClassHandler(className);
    return handler(sock, msg, player, skill, db, saveDatabase, getDatabase);
  },
};

// ── Default handler: applies any skill generically ─────────────────────
async function defaultHandler(sock, msg, player, skill, db, saveDatabase, getDatabase) {
  const chatId = msg.key.remoteJid;
  const FRAME = UI.isPro(player) ? UI.PRO_BAR : UI.FREE_BAR;

  // Energy check
  const energyCost = skill.energyCost || 15;
  if ((player.stats.energy || 0) < energyCost) {
    return sock.sendMessage(chatId, {
      text: `❌ Not enough energy!\n\n${player.energyColor || '💙'} ${player.energyType || 'Energy'}: ${player.stats.energy}/${player.stats.maxEnergy}\n⚡ Cost: ${energyCost}`
    }, { quoted: msg });
  }

  // Cooldown check (50% reduced for Pro players)
  if (!player.skillCooldowns) player.skillCooldowns = {};
  if (!player.lastSkillUse)  player.lastSkillUse  = {};
  const isPro = !!((player.isPro || player.proStatus) && player.proExpiresAt && player.proExpiresAt > Date.now());
  const lastUse = player.lastSkillUse[skill.name] || 0;
  let cooldownMs = (skill.cooldown || 0) * 1000;
  if (isPro) cooldownMs = Math.floor(cooldownMs * 0.5);

  if (Date.now() - lastUse < cooldownMs) {
    const remaining = Math.ceil((cooldownMs - (Date.now() - lastUse)) / 1000);
    return sock.sendMessage(chatId, {
      text: `⏰ *${skill.name}* is on cooldown! (${remaining}s remaining)${isPro ? ' (🌟 PRO 50% Reduced Cooldown)' : ''}`
    }, { quoted: msg });
  }

  // Deduct energy, set cooldown
  let SCC = null;
  try { SCC = require('../../rpg/utils/SkillCatalog'); } catch (e) {}
  const realCost = SCC ? SCC.effectiveCost(skill) : energyCost;
  player.stats.energy = Math.max(0, (player.stats.energy || 0) - realCost);
  if (SCC) SCC.setCooldown(player, skill);
  else { player.lastSkillUse = player.lastSkillUse || {}; player.lastSkillUse[skill.name] = Date.now(); }
  try { require('../../rpg/utils/RegenManager').markCombatAction(player); } catch (e) {}

  // Apply effect
  let resultText = `🔮 *${player.name}* used *${skill.name}*!\n_${skill.description || 'A class technique, executed.'}_`;

  if (skill.damage > 0 || (skill.damagePct || 0) > 0) {
    // Catalog maths: skill = % of real ATK (+ technique flat), not the old
    // `skill.damage * (1 + atk/100)` which barely moved the needle.
    let _gAtkCC = 0;
    try { _gAtkCC = require('../../rpg/utils/GearSystem').getEquippedBonuses(player).atk || 0; } catch (e) {}
    const proxy = { ...player, stats: { ...(player.stats || {}), atk: (player.stats.atk || 10) + _gAtkCC } };
    const damage = SCC
      ? SCC.computeDamage(proxy, skill)
      : Math.floor((skill.damage || 0) * (1 + (_gAtkCC + (player.stats.atk || 10)) / 100));
    resultText += `\n💥 Dealt *${damage.toLocaleString()}* damage!`;
    // Status the description promised, applied for real.
    const stats = skill.statuses || [];
    if (stats.length) {
      try {
        const SEM = require('../../rpg/utils/StatusEffectManager');
        const target = player.dungeon?.currentBattle?.monster || null;
        for (const st of stats) {
          if (Math.random() * 100 < (st.chance ?? 100)) {
            if (target) SEM.applyEffect(target, st.type, st.duration);
            const def = SEM.EFFECTS?.[st.type];
            resultText += `\n${def?.emoji || '✨'} ${def?.name || st.type} applied${target ? '' : ' (no live target)'}!`;
          }
        }
      } catch (e) {}
    }
  }

  // Push #76: stat buffs (self) / debuffs (target) from the skill text are applied for real.
  try {
    const UC76 = require('../../rpg/utils/UnifiedCombat');
    const SC76 = require('../../rpg/utils/SkillCatalog');
    const r76 = SC76.resolveSkill(player, skill.name, { silent: true });
    const e76 = (r76 && r76.ok ? (r76.entry || r76.skill) : null) || skill;
    const tgt76 = player.dungeon?.currentBattle?.monster || { name: 'Target', tempBuffs: {} };
    const notes76 = UC76.applyMoveBuffs({ name: skill.name, buffs: e76.buffs || [], debuffs: player.dungeon?.currentBattle?.monster ? (e76.debuffs || []) : [], selfDebuffs: e76.selfDebuffs || [] }, player, tgt76);
    if (notes76.length) resultText += `\n${notes76.join('\n')}`;
  } catch (e) {}

  // Push #71: catalog heal skills carry `type:'heal'` + `healingPct` (not
  // effect.type) — so every class's recovery move heals here too.
  let _catHeal = 0;
  try {
    const SC = require('../../rpg/utils/SkillCatalog');
    const r = SC.resolveSkill(player, skill.name, { silent: true });
    const entry = r && r.ok ? (r.entry || r.skill) : null;
    if (entry && (entry.type === 'heal' || entry.category === 'heal') && !(skill.effect && skill.effect.type === 'heal')) _catHeal = Number(entry.healingPct) || 20;
  } catch (e) {}
  if (_catHeal > 0) {
    const maxHp = player.stats.maxHp || 100;
    const before = player.stats.hp || 0;
    player.stats.hp = Math.min(maxHp, before + Math.floor(maxHp * _catHeal / 100));
    resultText += `\n💚 +${(player.stats.hp - before).toLocaleString()} HP restored (${_catHeal}%)!`;
  }

  if (skill.effect && skill.effect.type === 'heal') {
    const healPct = skill.effect.healPercent || 0.20;
    const maxHp = player.stats.maxHp || 100;
    const healAmt = Math.floor(maxHp * healPct);
    const before = player.stats.hp;
    player.stats.hp = Math.min(maxHp, before + healAmt);
    const actual = player.stats.hp - before;
    resultText += `\n💖 +${actual.toLocaleString()} HP restored!`;
  }

  if (skill.effect && skill.effect.type === 'buff') {
    if (!player.tempBuffs) player.tempBuffs = {};
    player.tempBuffs[skill.name] = { duration: skill.effect.duration || 2, effect: skill.effect };
    resultText += `\n✨ Buff applied for ${skill.effect.duration || 2} turns!`;
  }

  // Aura bonus
  if (typeof AuraSystem.addAura === 'function') {
    try { AuraSystem.addAura(player, 'skillUse'); } catch (e) {}
  }

  saveDatabase();
  return sock.sendMessage(chatId, {
    text: `${FRAME}
${resultText}
${FRAME}
${player.energyColor || '💙'} ${player.energyType || 'Energy'}: ${player.stats.energy}/${player.stats.maxEnergy}`
  }, { quoted: msg });
}

// ── Healer-specific handler: zero-damage, heal allies ───────────────────
async function healerHandler(sock, msg, player, skill, db, saveDatabase, getDatabase) {
  const chatId = msg.key.remoteJid;

  // Energy check
  const energyCost = skill.energyCost || 15;
  if ((player.stats.energy || 0) < energyCost) {
    return sock.sendMessage(chatId, {
      text: `❌ Not enough energy!\n\n${player.energyColor || '💙'} ${player.energyType || 'Energy'}: ${player.stats.energy}/${player.stats.maxEnergy}\n⚡ Cost: ${energyCost}`
    }, { quoted: msg });
  }

  // Cooldown check (50% reduced for Pro)
  if (!player.lastSkillUse)  player.lastSkillUse  = {};
  const isPro = !!((player.isPro || player.proStatus) && player.proExpiresAt && player.proExpiresAt > Date.now());
  const lastUse = player.lastSkillUse[skill.name] || 0;
  let cooldownMs = (skill.cooldown || 0) * 1000;
  if (isPro) cooldownMs = Math.floor(cooldownMs * 0.5);

  if (Date.now() - lastUse < cooldownMs) {
    const remaining = Math.ceil((cooldownMs - (Date.now() - lastUse)) / 1000);
    return sock.sendMessage(chatId, {
      text: `⏰ *${skill.name}* is on cooldown! (${remaining}s remaining)${isPro ? ' (🌟 PRO 50% Reduced Cooldown)' : ''}`
    }, { quoted: msg });
  }

  // Determine target (default: self)
  const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
  let targetJid = sender;
  let targetName = player.name;
  if (mentioned && mentioned !== sender) {
    const targetPlayer = db.users[mentioned];
    if (!targetPlayer) {
      return sock.sendMessage(chatId, { text: '❌ That player is not registered.' }, { quoted: msg });
    }
    targetJid = mentioned;
    targetName = targetPlayer.name;
  }
  const targetStats = db.users[targetJid].stats;

  // Apply effect based on type
  let effectText = '';
  player.stats.energy = Math.max(0, player.stats.energy - energyCost);
  player.lastSkillUse[skill.name] = Date.now();

  if (skill.effect) {
    const e = skill.effect;
    const isAoe = e.target === 'party';
    const isCleanse = e.type?.includes('cleanse') || e.type?.includes('heal_cleanse');
    const isEnergy = e.type === 'energy_restore' || e.type?.includes('energy');
    const isResurrect = e.type === 'resurrect';
    const isShield = e.buffType === 'shield' || e.type === 'buff';

    if (isAoe) {
      // Party-wide heal — apply to all registered users in the same chat
      // For simplicity, heal the target + send a "party" announcement
      applyHeal(targetStats, e.healPercent || 0.20);
      effectText = `💖 +${calcHeal(targetStats, e.healPercent || 0.20)} HP (party-wide)`;
      if (isCleanse) {
        if (targetStats.statusEffects) {
          targetStats.statusEffects = targetStats.statusEffects.filter(s => !['burn', 'poison', 'bleed', 'curse', 'weakened', 'slow'].includes(s.type));
        }
        effectText += `\n✨ Debuffs cleared`;
      }
    } else if (isResurrect) {
      targetStats.hp = Math.max(1, Math.floor((targetStats.maxHp || 100) * (e.healPercent || 0.5)));
      effectText = `💫 ${targetName} has been RESURRECTED!`;
    } else if (isShield) {
      if (!targetStats.tempBuffs) targetStats.tempBuffs = {};
      const shield = Math.floor((targetStats.maxHp || 100) * (e.shieldPercent || 0.4));
      targetStats.tempBuffs.shield = { amount: shield, duration: e.duration || 3 };
      effectText = `🛡️ ${targetName} gains a ${shield} HP shield for ${e.duration || 3} turns`;
    } else if (e.buffType === 'aura_heal') {
      if (!targetStats.tempBuffs) targetStats.tempBuffs = {};
      targetStats.tempBuffs.auraHeal = { pct: e.healPercent || 0.25, duration: e.duration || 2 };
      effectText = `✨ ${targetName} radiates a healing aura (party heals ${Math.round((e.healPercent || 0.25) * 100)}% of damage)`;
    } else if (isEnergy) {
      const eAmt = Math.floor((targetStats.maxEnergy || 100) * (e.energyPercent || 0.30));
      targetStats.energy = Math.min(targetStats.maxEnergy || 100, (targetStats.energy || 0) + eAmt);
      effectText = `⚡ +${eAmt} ${player.energyType || 'Energy'} restored`;
    } else if (e.type?.startsWith('heal')) {
      applyHeal(targetStats, e.healPercent || 0.20);
      effectText = `💖 +${calcHeal(targetStats, e.healPercent || 0.20)} HP restored`;
      if (e.energyPercent) {
        const eAmt = Math.floor((targetStats.maxEnergy || 100) * e.energyPercent);
        targetStats.energy = Math.min(targetStats.maxEnergy || 100, (targetStats.energy || 0) + eAmt);
        effectText += `\n⚡ +${eAmt} ${player.energyType} restored`;
      }
    }
  } else {
    // Fallback: apply by name heuristic
    if (skill.name === 'Healing Light' || skill.name === 'Renew' || skill.name === 'Divine Grace' || skill.name === 'Sanctuary' || skill.name === 'Mass Renewal' || skill.name === 'Purify') {
      const pct = skill.name === 'Sanctuary' || skill.name === 'Mass Renewal' ? 0.20 : 0.25;
      applyHeal(targetStats, pct);
      effectText = `💖 +${calcHeal(targetStats, pct)} HP restored`;
    } else if (skill.name === 'Blessed Shield') {
      if (!targetStats.tempBuffs) targetStats.tempBuffs = {};
      targetStats.tempBuffs.shield = { amount: Math.floor((targetStats.maxHp || 100) * 0.4), duration: 3 };
      effectText = `🛡️ Shield applied (40% max HP for 3 turns)`;
    } else if (skill.name === 'Aura of Light') {
      if (!targetStats.tempBuffs) targetStats.tempBuffs = {};
      targetStats.tempBuffs.auraHeal = { pct: 0.25, duration: 2 };
      effectText = `✨ Aura of Light (party heals 25% of damage for 2 turns)`;
    } else if (skill.name === 'Mana Spring') {
      const eAmt = Math.floor((targetStats.maxEnergy || 100) * 0.30);
      targetStats.energy = Math.min(targetStats.maxEnergy || 100, (targetStats.energy || 0) + eAmt);
      effectText = `⚡ +${eAmt} ${player.energyType} restored`;
    }
  }

  saveDatabase();
  const hPro = UI.isPro(player);
  const hFRAME = hPro ? UI.PRO_BAR : UI.FREE_BAR;
  const hpPct = targetStats.maxHp ? Math.round(100 * targetStats.hp / targetStats.maxHp) : 100;

  return sock.sendMessage(chatId, {
    text: (hPro ? `${UI.PRO_BAR}
💖 *${skill.name}* cast! 💎
${UI.PRO_BAR}
` : `💖 *${skill.name}* cast!
${UI.FREE_BAR}
`) + `🎯 *Target:* ${targetJid === sender ? `${player.name} (self)` : targetName}
📜 *Effect:* ${skill.description || 'Healing'}
${effectText ? '\n' + effectText : ''}

❤️ *HP:* ${targetStats.hp}/${targetStats.maxHp}
⚡ *Energy:* ${player.stats.energy}/${player.stats.maxEnergy} (-${energyCost})
${hFRAME}` + (hPro ? `\n${UI.PRO_MINI}\n💎 *PRO MEND* — target at ${hpPct}% HP` : `\n${UI.upsell()}`)
  }, { quoted: msg });
}

// ── Helpers ───────────────────────────────────────────────────────
function applyHeal(stats, pct) {
  const max = stats.maxHp || 100;
  const before = stats.hp || 0;
  const heal = Math.floor(max * pct);
  stats.hp = Math.min(max, before + heal);
}
function calcHeal(stats, pct) {
  return Math.floor((stats.maxHp || 100) * pct);
}

function getClassHandler(className) {
  // Per-class custom handlers go here
  if (className === 'Healer') return healerHandler;
  return defaultHandler;
}

function findClassByCmdName(cmdName) {
  if (cmdName === 'call' || cmdName === 'cast') return 'Mage';
  for (const [cls, name] of Object.entries(DEFAULT_CMD_NAMES)) {
    if (name === cmdName) return cls;
  }
  return null;
}

function getCmdHelp(cmdName) {
  const tips = {
    heal:  '💡 Use */heal <skill> [target]* to cast healing skills.',
    cast:  '💡 Use */cast <skill>* to cast offensive spells.',
    rage:  '💡 Use */rage <skill>* to unleash fury.',
    strike:'💡 Use */strike <skill>* to attack precisely.',
    prayer:'💡 Use */prayer <skill>* to invoke divine power.',
    hex:   '💡 Use */hex <skill>* to curse enemies.',
    rewind:'💡 Use */rewind <skill>* to manipulate time.',
    chant: '💡 Use */chant <skill>* to channel spirits.',
    rally: '💡 Use */rally <skill>* to lead allies.',
    veil:  '💡 Use */veil <skill>* to phase through shadows.',
    feast: '💡 Use */feast <skill>* to devour the fallen.',
    roar:  '💡 Use */roar <skill>* to channel dragon breath.',
    dance: '💡 Use */dance <skill>* to strike from shadows.',
    summon:'💡 Use */summon <skill>* to conjure allies.',
    drain: '💡 Use */drain <skill>* to steal life force.',
    slash: '💡 Use */slash <skill>* to cut with magic.',
    storm: '💡 Use */storm <skill>* to unleash elements.',
    swing: '💡 Use */swing <skill>* to strike with your weapon.',
    aim:   '💡 Use */aim <skill>* to fire precisely.',
    sneak: '💡 Use */sneak <skill>* to attack from stealth.',
    shield:'💡 Use */shield <skill>* to defend and strike.',
    meditate:'💡 Use */meditate <skill>* to channel inner peace.',
    hunt:  '💡 Use */hunt <skill>* to track your prey.',
    science:'💡 Use */science <skill>* to unleash Senku\'s genius.',
  };
  return tips[cmdName] || `💡 Use */${cmdName} <skill>* to use your class abilities.`;
}

function findPlayerSkill(player, className, skillName) {
  // SkillCatalog owns resolution: equipped + library, tolerant by name/number,
  // and it will not hand back a skill the player has not unlocked yet.
  try {
    const SC = require('../../rpg/utils/SkillCatalog');
    const res = SC.resolveSkill(player, skillName, { allowLibrary: true });
    if (res.ok) return res.skill;
    player._skillResolveError = res.error;
    return null;
  } catch (e) {
    const q = String(skillName || '').toLowerCase();
    for (const arr of [player.skills?.active, player.classSkills, player.availableSkills]) {
      if (!Array.isArray(arr)) continue;
      const m = arr.find(s => s && s.name && s.name.toLowerCase() === q);
      if (m) return m;
    }
    return null;
  }
}

function showClassSkillMenu(sock, msg, player, className) {
  const chatId = msg.key.remoteJid;
  const data = CS.CLASS_DATA[className];
  if (!data) {
    return sock.sendMessage(chatId, { text: `❌ Class data not found: ${className}` }, { quoted: msg });
  }
  const playerCmd = getClassCmdName(className);

  // Only UNLOCKED skills are listed. The old menu dumped every class skill
  // (and every classSkills entry) regardless of level, which is what made the
  // co-owner look like "all skills unlocked on awakening".
  let _SC = null;
  try { _SC = require('../../rpg/utils/SkillCatalog'); } catch (e) {}
  if (_SC) {
    const roster = _SC.getRoster(player);
    if (roster.length) {
      _SC.syncPlayerSkills(player);
      const unlocked = _SC.unlockedSkills(player);
      const passives = _SC.passiveSkills(player);
      const locked   = _SC.lockedSkills(player);
      const lns = [];
      lns.push(`${UI.isPro(player) ? UI.PRO_BAR : UI.FREE_BAR}`);
      lns.push(`✨ *${className} — SKILL LADDER* (${unlocked.length}/${roster.length} unlocked)`);
      lns.push(UI.isPro(player) ? UI.PRO_BAR : UI.FREE_BAR);
      unlocked.forEach((e, i) => {
        const mine = (player.skills.active.concat(player.availableSkills)).find(s => s.name === e.name) || e;
        lns.push(`${i + 1}. *${e.name}* [Lv.${e.unlocksAtLevel}]`);
        lns.push(`   📖 ${e.description}`);
        lns.push(`   ${e.effect.split('\n').join('\n   ')}`);
        lns.push(`   ${_SC.effectiveCost(mine)} energy · ${_SC.effectiveCooldownTurns(mine)} turn CD · ⚔️ ${e.damagePct || 0}% ATK`);
        lns.push('');
      });
      if (passives.length) {
        lns.push(`⚡ *PASSIVES (always on)*`);
        for (const p of passives) lns.push(`   • *${p.name}* — ${p.effect.split('\n').join(' ')}`);
        lns.push('');
      }
      if (locked.length) {
        lns.push(`🔒 *LOCKED* — next: ${locked[0].name} at Lv.${locked[0].unlocksAtLevel} (${locked.length} total)`);
        lns.push(`   /skills locked lists them all`);
      }
      lns.push(UI.isPro(player) ? UI.PRO_BAR : UI.FREE_BAR);
      lns.push(`📌 /skill <name> in combat · /skills to manage your 5 slots`);
      return sock.sendMessage(msg.key.remoteJid, { text: lns.join('\n') }, { quoted: msg });
    }
  }

  // Combine player.skills.active + classSkills for display
  const skills = [];
  if (player.skills && Array.isArray(player.skills.active)) {
    player.skills.active.forEach(s => skills.push({ ...s, _source: 'equipped' }));
  }
  if (Array.isArray(player.classSkills)) {
    player.classSkills.forEach(s => {
      if (!skills.find(x => x.name === s.name)) skills.push({ ...s, _source: 'class' });
    });
  }

  const mPro = UI.isPro(player);
  const mFRAME = mPro ? UI.PRO_BAR : UI.FREE_BAR;
  const lines = [
    ...(mPro ? [UI.PRO_BAR, `${data.emoji} *${className.toUpperCase()} — Class Skills* 💎`, UI.PRO_BAR] : [`${data.emoji} *${className.toUpperCase()} — Class Skills*`, UI.FREE_BAR]),
    `📌 Your class command: */${playerCmd}*`,
    ``,
    `📊 *Available Skills:*`,
  ];
  if (!skills.length) {
    lines.push('  ❌ No skills unlocked yet. Keep leveling!');
  } else {
    skills.slice(0, 10).forEach((s, i) => {
      const tag = s._source === 'equipped' ? '✨' : '📚';
      lines.push(`  ${i+1}. ${tag} *${s.name}*`);
      if (s.damage)       lines.push(`     💥 DMG: ${s.damage}`);
      if (s.energyCost)   lines.push(`     ${player.energyColor || '💙'} Cost: ${s.energyCost} ${player.energyType || 'Energy'}`);
      if (s.cooldown)     lines.push(`     ⏰ CD: ${s.cooldown}t`);
      if (s.description) lines.push(`     📖 ${s.description.slice(0, 60)}...`);
    });
  }
  lines.push('');
  lines.push(`💡 */${playerCmd} <skill>* — use a skill`);
  lines.push(`💡 */${playerCmd} <skill> @user* — target an ally (for heals/buffs)`);
  lines.push(mFRAME);
  if (mPro) {
    const eq = skills.filter(s => s._source === 'equipped').length;
    lines.push(UI.PRO_MINI, `💎 *PRO ARSENAL* — ${skills.length} known · ${eq} equipped`);
  } else lines.push(UI.upsell());

  return sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: msg });
}

function extractCommandName(msg, sender) {
  // The msg.text isn't directly available — the message is in
  // msg.message.conversation or msg.message.extendedTextMessage.text
  const text = msg.message?.conversation
           || msg.message?.extendedTextMessage?.text
           || '';
  const m = text.match(/^\/([a-zA-Z]+)/);
  return m ? m[1].toLowerCase() : null;
}

// ── Battle detection ────────────────────────────────────────────
// Returns { type, battle } if the player is in a battle, else null.
function normaliseJidShort(jid) {
  return jid?.split('@')[0]?.split(':')[0]?.replace(/[^0-9]/g, '') || '';
}

// Energy + cooldown gate for routed skills (same rules queueBattleAction enforced)
function skillReady(player, skill) {
  let SC = null;
  try { SC = require('../../rpg/utils/SkillCatalog'); } catch (e) {}
  const energyCost = SC ? SC.effectiveCost(skill) : (skill.energyCost || 15);
  if ((player.stats.energy || 0) < energyCost) return { ok: false, reason: `Not enough energy! Need ${energyCost}` };
  if (SC) {
    const cd = SC.onCooldown(player, skill);
    if (!cd.ready) return { ok: false, reason: `${skill.name} is on cooldown (${Math.ceil(cd.msLeft / 1000)}s)` };
    return { ok: true };
  }
  const until = player.skillCooldowns?.[skill.name] || player.skills?.cooldowns?.[skill.name] || 0;
  if (until && Date.now() < until) return { ok: false, reason: `${skill.name} is on cooldown` };
  return { ok: true };
}
function setSkillCooldown(player, skill) {
  // Push #88: same key scheme as SkillCatalog.onCooldown (lowercase) so the gate actually enforces.
  try { return require('../../rpg/utils/SkillCatalog').setCooldown(player, skill); } catch (e) {}
  if (!player.skillCooldowns) player.skillCooldowns = {};
  player.skillCooldowns[String(skill.name || '').toLowerCase()] = Date.now() + ((skill.cooldown || 0) * 1000);
}

// Battle types: 'dungeon_solo', 'dungeon_party', 'boss', 'pvp', 'guild_raid'
function checkInBattle(player, db) {
  // Solo dungeon battle
  if (player.dungeon?.currentBattle) {
    return { type: 'dungeon_solo', battle: player.dungeon.currentBattle, context: player.dungeon };
  }
  // Boss battle
  if (player.boss?.currentBattle) {
    return { type: 'boss', battle: player.boss.currentBattle, context: player.boss };
  }
  // PvP battle (stored on the player object)
  if (player.pvpBattle) {
    return { type: 'pvp', battle: player.pvpBattle, context: player };
  }
  // Party battle — find the party the player is in
  if (db.parties) {
    for (const party of Object.values(db.parties)) {
      if (party.members && party.members.includes(player.id || player.userId || '')) {
        if (db.partyBattles && db.partyBattles[party.id]) {
          return { type: 'dungeon_party', battle: db.partyBattles[party.id], context: { party, partyId: party.id } };
        }
      }
    }
  }
  return null;
}

// ── Queue a skill action in a battle ─────────────────────────────
// This stores the player's intent to use a skill. The battle system
// reads these queues at end-of-round to resolve the action.
function queueBattleAction(player, db, inBattle, skillName, cmdName) {
  const battle = inBattle.battle;
  if (!battle) return { ok: false, reason: 'No battle found' };

  // Energy check
  const skill = findPlayerSkill(player, player.class, skillName);
  if (!skill) return { ok: false, reason: `Skill ${skillName} not found` };
  const energyCost = skill.energyCost || 15;
  if ((player.stats.energy || 0) < energyCost) {
    return { ok: false, reason: `Not enough energy! Need ${energyCost}` };
  }

  // Cooldown check
  if (!player.skillCooldowns) player.skillCooldowns = {};
  if (player.skillCooldowns[skillName] && Date.now() < player.skillCooldowns[skillName]) {
    return { ok: false, reason: `${skillName} is on cooldown` };
  }

  // Set cooldown
  player.skillCooldowns[skillName] = Date.now() + ((skill.cooldown || 0) * 1000);

  // Queue the action — battle system reads this at end of round
  if (!battle.playerActions) battle.playerActions = {};
  battle.playerActions[player.id || player.userId] = {
    action: 'skill',
    skillName,
    cmdName,
    timestamp: Date.now(),
  };

  return { ok: true };
}
