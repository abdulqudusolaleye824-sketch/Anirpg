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

module.exports = {
  name: 'classcmd',   // Primary name (gets aliased to all class cmdNames below)
  description: 'Class-specific skill command — use your class abilities',
  aliases: Object.values(DEFAULT_CMD_NAMES),  // 'heal', 'cast', 'rage', etc.

  // ── Main dispatch ──────────────────────────────────────────────
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];

    if (!player) {
      return sock.sendMessage(chatId, { text: '❌ You are not registered!' }, { quoted: msg });
    }

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

    if (usedCmd && usedCmd !== playerCmd) {
      // Player used a different class's command
      const intendedClass = findClassByCmdName(usedCmd);
      return sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ *${usedCmd}* is the *${intendedClass}* class command.
━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎭 Your class: *${className}*
📌 Your class command: */${playerCmd}*

${getCmdHelp(playerCmd)}`
      }, { quoted: msg });
    }

    // ── 3. No skill specified → show class skills menu ──────────
    const skillName = args[0];
    if (!skillName) {
      return showClassSkillMenu(sock, chatId, player, className);
    }

    // ── 4. Find the skill on the player ───────────────────────
    const skill = findPlayerSkill(player, className, skillName);
    if (!skill) {
      return sock.sendMessage(chatId, {
        text: `❌ *${className}* doesn't know the skill *${skillName}*.\n\nUse */${playerCmd}* (no args) to see your class skills.`
      }, { quoted: msg });
    }

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
          text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚔️ *${skill.name}* queued!
━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Queued for end of round in *${inBattle.type}*.
⏳ Waiting for opponent's action...

${getCmdHelp(extractCommandName(msg, sender))}
━━━━━━━━━━━━━━━━━━━━━━━━━━━`
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

  // Energy check
  const energyCost = skill.energyCost || 15;
  if ((player.stats.energy || 0) < energyCost) {
    return sock.sendMessage(chatId, {
      text: `❌ Not enough energy!\n\n${player.energyColor || '💙'} ${player.energyType || 'Energy'}: ${player.stats.energy}/${player.stats.maxEnergy}\n⚡ Cost: ${energyCost}`
    }, { quoted: msg });
  }

  // Cooldown check
  if (!player.skillCooldowns) player.skillCooldowns = {};
  if (!player.lastSkillUse)  player.lastSkillUse  = {};
  const lastUse = player.lastSkillUse[skill.name] || 0;
  const cooldownMs = (skill.cooldown || 0) * 1000;
  if (Date.now() - lastUse < cooldownMs) {
    const remaining = Math.ceil((cooldownMs - (Date.now() - lastUse)) / 1000);
    return sock.sendMessage(chatId, {
      text: `⏰ *${skill.name}* is on cooldown! (${remaining}s remaining)`
    }, { quoted: msg });
  }

  // Deduct energy, set cooldown
  player.stats.energy = Math.max(0, (player.stats.energy || 0) - energyCost);
  player.lastSkillUse[skill.name] = Date.now();

  // Apply effect (very simplified default)
  let resultText = `🔮 *${player.name}* used *${skill.name}*!`;

  if (skill.damage && skill.damage > 0) {
    // Damage skill
    const atk = player.stats.atk || 10;
    const damage = Math.floor(skill.damage * (1 + (atk / 100)));
    resultText += `\n💥 Dealt *${damage.toLocaleString()}* damage!`;
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
    text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
${resultText}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
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

  // Cooldown check
  if (!player.lastSkillUse)  player.lastSkillUse  = {};
  const lastUse = player.lastSkillUse[skill.name] || 0;
  const cooldownMs = (skill.cooldown || 0) * 1000;
  if (Date.now() - lastUse < cooldownMs) {
    const remaining = Math.ceil((cooldownMs - (Date.now() - lastUse)) / 1000);
    return sock.sendMessage(chatId, {
      text: `⏰ *${skill.name}* is on cooldown! (${remaining}s remaining)`
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

  return sock.sendMessage(chatId, {
    text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
💖 *${skill.name}* cast!
━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 *Target:* ${targetJid === sender ? `${player.name} (self)` : targetName}
📜 *Effect:* ${skill.description || 'Healing'}
${effectText ? '\n' + effectText : ''}

❤️ *HP:* ${targetStats.hp}/${targetStats.maxHp}
⚡ *Energy:* ${player.stats.energy}/${player.stats.maxEnergy} (-${energyCost})
━━━━━━━━━━━━━━━━━━━━━━━━━━━`
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
  const q = skillName.toLowerCase();
  // Look in player.skills.active first (the equipped skills)
  if (player.skills && Array.isArray(player.skills.active)) {
    const m = player.skills.active.find(s => s.name && s.name.toLowerCase() === q);
    if (m) return m;
  }
  // Then player.classSkills (from the new system)
  if (Array.isArray(player.classSkills)) {
    const m = player.classSkills.find(s => s.name && s.name.toLowerCase() === q);
    if (m) return m;
  }
  // Then player.availableSkills (library)
  if (Array.isArray(player.availableSkills)) {
    const m = player.availableSkills.find(s => s.name && s.name.toLowerCase() === q);
    if (m) return m;
  }
  return null;
}

function showClassSkillMenu(sock, chatId, player, className) {
  const data = CS.CLASS_DATA[className];
  if (!data) {
    return sock.sendMessage(chatId, { text: `❌ Class data not found: ${className}` }, { quoted: msg });
  }
  const playerCmd = getClassCmdName(className);

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

  const lines = [
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `${data.emoji} *${className.toUpperCase()} — Class Skills*`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
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
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━');

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
// Battle types: 'dungeon_solo', 'dungeon_party', 'boss', 'worldboss', 'pvp', 'guild_raid'
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
  // Worldboss battle (loose check)
  if (player.inWorldBoss || player.worldBoss) {
    return { type: 'worldboss', battle: player.worldBoss, context: player };
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
