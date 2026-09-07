// ═══════════════════════════════════════════════════════════════
// DUEL — Solo Leveling Style PvP
// - Aura won/lost instead of gold
// - Death mechanic: lose a level + some items on death
// - Gear, pets, and skills factor into damage
// - Realistic multi-round combat
// ═══════════════════════════════════════════════════════════════

const LevelUpManager = require('../../rpg/utils/LevelUpManager');
const { AuraSystem } = require('../../rpg/utils/AuraSystem');
const { calculatePowerRating, AWAKENING_RANKS } = require('../../rpg/utils/SoloLevelingCore');

const DUEL_COOLDOWN = new Map();
const COOLDOWN_MS = 90_000; // 90 seconds

// ─── DAMAGE CALC ─────────────────────────────────────────────────
function calcDamage(attacker, defender) {
  const atkStat = (attacker.stats?.atk || 10) + (attacker.equipped?.weapon?.atk || attacker.equipped?.weapon?.bonus || 0);
  const defStat = (defender.stats?.def || 5) + (defender.equipped?.armor?.def || 0);
  const base = Math.max(5, atkStat - Math.floor(defStat * 0.6));
  const critChance = (attacker.stats?.critChance || 2) / 100;
  const critDamage = (attacker.stats?.critDamage || 150) / 100;
  const isCrit = Math.random() < critChance;
  const damage = Math.floor(base * (0.85 + Math.random() * 0.30) * (isCrit ? critDamage : 1));
  // Lifesteal
  const lifesteal = (attacker.stats?.lifesteal || 0) / 100;
  if (lifesteal > 0) attacker.stats.hp = Math.min(attacker.stats.maxHp, (attacker.stats.hp || 0) + Math.floor(damage * lifesteal));
  return { damage, isCrit };
}

// ─── SKILL USE ────────────────────────────────────────────────────
function pickBestSkill(player) {
  const skills = player.skills?.active || [];
  const ready = skills.filter(s => {
    const cd = player.skills?.cooldowns?.[s.name] || 0;
    return Date.now() >= cd && (player.stats?.energy || 0) >= (s.energyCost || 0);
  });
  if (ready.length === 0) return null;
  // Pick highest damage skill
  return ready.sort((a, b) => (b.damage || 0) - (a.damage || 0))[0];
}

// ─── PET DAMAGE ───────────────────────────────────────────────────
function getPetContribution(player) {
  const pet = player.pet;
  if (!pet || !pet.stats) return 0;
  const petAtk = pet.stats.atk || 0;
  if (petAtk === 0) return 0;
  // Pet deals 30-60% of its ATK randomly
  return Math.floor(petAtk * (0.3 + Math.random() * 0.3));
}

// ─── ROUND SIMULATOR ──────────────────────────────────────────────
function simulateRounds(p1, p2, maxRounds = 8) {
  // Deep clone HP for simulation
  const h1 = { hp: p1.stats?.hp || 100, maxHp: p1.stats?.maxHp || 100 };
  const h2 = { hp: p2.stats?.hp || 100, maxHp: p2.stats?.maxHp || 100 };
  const rounds = [];

  // Who goes first based on speed
  const p1Speed = p1.stats?.speed || 100;
  const p2Speed = p2.stats?.speed || 100;
  let p1First = p1Speed >= p2Speed;

  for (let round = 1; round <= maxRounds; round++) {
    if (h1.hp <= 0 || h2.hp <= 0) break;

    const roundLog = [`*Round ${round}*`];

    // Attacker / Defender order
    const [first, second, fh, sh] = p1First
      ? [p1, p2, h1, h2]
      : [p2, p1, h2, h1];

    // First attacker's turn
    const skill1 = pickBestSkill(first);
    let dmg1 = 0, crit1 = false;
    if (skill1) {
      dmg1 = Math.floor((skill1.damage || 20) * (0.9 + Math.random() * 0.2));
      crit1 = Math.random() < 0.15;
      if (crit1) dmg1 = Math.floor(dmg1 * 1.5);
      if (first.skills?.cooldowns) first.skills.cooldowns[skill1.name] = Date.now() + (skill1.cooldown || 3) * 1000;
    } else {
      const r = calcDamage(first, second);
      dmg1 = r.damage; crit1 = r.isCrit;
    }
    // Pet
    const pet1 = getPetContribution(first);
    dmg1 += pet1;
    sh.hp = Math.max(0, sh.hp - dmg1);
    roundLog.push(`${first.name}: ${skill1 ? `*${skill1.name}* ` : ''}${crit1 ? '💥CRIT ' : ''}${dmg1} dmg${pet1 > 0 ? ` (+${pet1} pet)` : ''} → ${second.name} HP: ${sh.hp}/${sh.maxHp}`);

    if (sh.hp <= 0) { rounds.push(roundLog.join('\n')); break; }

    // Second attacker's turn
    const skill2 = pickBestSkill(second);
    let dmg2 = 0, crit2 = false;
    if (skill2) {
      dmg2 = Math.floor((skill2.damage || 20) * (0.9 + Math.random() * 0.2));
      crit2 = Math.random() < 0.15;
      if (crit2) dmg2 = Math.floor(dmg2 * 1.5);
      if (second.skills?.cooldowns) second.skills.cooldowns[skill2.name] = Date.now() + (skill2.cooldown || 3) * 1000;
    } else {
      const r = calcDamage(second, first);
      dmg2 = r.damage; crit2 = r.isCrit;
    }
    const pet2 = getPetContribution(second);
    dmg2 += pet2;
    fh.hp = Math.max(0, fh.hp - dmg2);
    roundLog.push(`${second.name}: ${skill2 ? `*${skill2.name}* ` : ''}${crit2 ? '💥CRIT ' : ''}${dmg2} dmg${pet2 > 0 ? ` (+${pet2} pet)` : ''} → ${first.name} HP: ${fh.hp}/${fh.maxHp}`);

    rounds.push(roundLog.join('\n'));
    p1First = !p1First; // Alternate initiative
  }

  // Determine winner by remaining HP percentage
  const p1HpPct = h1.hp / h1.maxHp;
  const p2HpPct = h2.hp / h2.maxHp;
  let winner = null, loser = null, winnerHp = 0, loserHp = 0;
  if (h1.hp <= 0) { winner = p2; loser = p1; winnerHp = h2.hp; loserHp = 0; }
  else if (h2.hp <= 0) { winner = p1; loser = p2; winnerHp = h1.hp; loserHp = 0; }
  else if (p1HpPct > p2HpPct) { winner = p1; loser = p2; winnerHp = h1.hp; loserHp = h2.hp; }
  else if (p2HpPct > p1HpPct) { winner = p2; loser = p1; winnerHp = h2.hp; loserHp = h1.hp; }
  // else draw

  return { rounds, winner, loser, winnerHp, loserHp, draw: !winner, h1Final: h1.hp, h2Final: h2.hp };
}

// ─── DEATH PENALTY ───────────────────────────────────────────────
function applyDeathPenalty(player, db) {
  const changes = [];
  // Lose 1 level (min level 1)
  if (player.level > 1) {
    const { getXpRequired } = require('../../rpg/utils/SoloLevelingCore');
    player.level = Math.max(1, player.level - 1);
    player.xp = 0;
    changes.push(`📉 Level dropped to ${player.level}`);
  }
  // Lose 30% of mana stones
  const crystalLoss = Math.floor((player.manaCrystals || 0) * 0.30);
  if (crystalLoss > 0) {
    player.manaCrystals = Math.max(0, (player.manaCrystals || 0) - crystalLoss);
    changes.push(`💎 Lost ${crystalLoss.toLocaleString()} Mana Stones`);
  }
  // Drop a random equipped item back to inventory
  const equipped = player.equipped || {};
  const slots = Object.keys(equipped).filter(k => equipped[k]);
  if (slots.length > 0 && Math.random() < 0.40) {
    const dropSlot = slots[Math.floor(Math.random() * slots.length)];
    const droppedItem = equipped[dropSlot];
    equipped[dropSlot] = null;
    // Put back in inventory
    if (droppedItem) {
      const bucket = droppedItem.type === 'weapon' ? 'weapons' : droppedItem.type === 'armor' ? 'armor' : 'accessories';
      if (!player.inventory) player.inventory = {};
      if (!player.inventory[bucket]) player.inventory[bucket] = [];
      player.inventory[bucket].push(droppedItem);
      changes.push(`⚠️ *${droppedItem.name || dropSlot}* was dropped on death`);
    }
  }
  // HP to 1
  player.stats.hp = 1;
  // Track
  player.deathCount = (player.deathCount || 0) + 1;
  player.lastDeathAt = Date.now();
  return changes;
}

module.exports = {
  name: 'duel',
  aliases: ['pvp', 'fight', 'challenge'],
  description: '⚔️ Challenge another hunter to a duel',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key?.remoteJid;
    const db = getDatabase();
    const challenger = db.users[sender];
    if (!challenger) return sock.sendMessage(chatId, { text: '❌ Register first! Use /register' }, { quoted: msg });

    // Cooldown
    const lastDuel = DUEL_COOLDOWN.get(sender) || 0;
    const cdLeft = Math.max(0, COOLDOWN_MS - (Date.now() - lastDuel));
    if (cdLeft > 0) return sock.sendMessage(chatId, { text: `⏳ Duel cooldown: *${Math.ceil(cdLeft / 1000)}s* remaining.` }, { quoted: msg });

    const mentionedId = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    if (!mentionedId) {
      return sock.sendMessage(chatId, {
        text: [
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `⚔️ *DUEL SYSTEM*`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          ``,
          `Challenge another hunter to a duel.`,
          `Gear, skills, pets, and stats all matter.`,
          ``,
          `⚠️ *DEATH RISK:*`,
          `If you lose badly (HP hits 0), you will:`,
          `• Drop 1 level`,
          `• Lose 30% of Mana Stones`,
          `• Potentially drop a gear piece`,
          ``,
          `🏆 *WIN REWARDS:*`,
          `• Aura gain (PvP win)`,
          `• Streak bonuses`,
          ``,
          `📌 Usage: /duel @user`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ].join('\n')
      }, { quoted: msg });
    }

    if (mentionedId === sender) return sock.sendMessage(chatId, { text: '❌ Cannot duel yourself.' }, { quoted: msg });
    const opponent = db.users[mentionedId];
    if (!opponent) return sock.sendMessage(chatId, { text: '❌ That player is not registered.' }, { quoted: msg });
    if (opponent.inBattle || opponent.inGate) return sock.sendMessage(chatId, { text: `❌ *${opponent.name}* is currently in combat.` }, { quoted: msg });
    if (challenger.inBattle || challenger.inGate) return sock.sendMessage(chatId, { text: '❌ You are already in combat.' }, { quoted: msg });

    DUEL_COOLDOWN.set(sender, Date.now());
    DUEL_COOLDOWN.set(mentionedId, Date.now());

    const cRank = challenger.awakenRank || 'E';
    const oRank = opponent.awakenRank || 'E';
    const cRankData = AWAKENING_RANKS[cRank];
    const oRankData = AWAKENING_RANKS[oRank];
    const cPower = calculatePowerRating(challenger.stats || {}, [], challenger.pet);
    const oPower = calculatePowerRating(opponent.stats || {}, [], opponent.pet);

    // ─── Run simulation ───────────────────────────────────────
    const result = simulateRounds(challenger, opponent);

    // ─── Apply outcome ────────────────────────────────────────
    const { winner, loser, draw, h1Final, h2Final } = result;

    let winnerPlayer = null, loserPlayer = null, winnerId = null, loserId = null;
    if (!draw && winner) {
      winnerPlayer = winner === challenger ? challenger : opponent;
      loserPlayer  = winner === challenger ? opponent : challenger;
      winnerId     = winner === challenger ? sender : mentionedId;
      loserId      = winner === challenger ? mentionedId : sender;
    }

    // Aura changes
    let winnerAuraGain = null, loserAuraLoss = null;
    let deathPenalty = null;
    const isDead = !draw && loserPlayer && h1Final === 0 || h2Final === 0;

    if (!draw && winnerPlayer) {
      // Winner streak
      winnerPlayer.pvpStreak = (winnerPlayer.pvpStreak || 0) + 1;
      loserPlayer.pvpStreak = 0;
      const streakEvent = AuraSystem.getPvpStreakEvent(winnerPlayer.pvpStreak);
      winnerAuraGain = AuraSystem.addAura(winnerPlayer, streakEvent);
      loserAuraLoss = AuraSystem.removeAura(loserPlayer, 'pvpLoss');
      // Track history
      if (!winnerPlayer.stats_history) winnerPlayer.stats_history = {};
      if (!loserPlayer.stats_history) loserPlayer.stats_history = {};
      winnerPlayer.stats_history.pvpWins = (winnerPlayer.stats_history.pvpWins || 0) + 1;
      loserPlayer.stats_history.pvpLosses = (loserPlayer.stats_history.pvpLosses || 0) + 1;
    }

    // Death penalty if HP hit 0
    const loserDied = !draw && (loserPlayer === challenger ? h1Final : h2Final) === 0;
    if (loserDied && loserPlayer) {
      deathPenalty = applyDeathPenalty(loserPlayer, db);
    }

    // Apply HP damage to living combatants
    if (!loserDied) {
      challenger.stats.hp = Math.max(1, h1Final);
      opponent.stats.hp   = Math.max(1, h2Final);
    }

    saveDatabase();

    // ─── Format output as multi-message ─────────────────────────
    // Each section is sent as its own WhatsApp message with a human-like
    // stagger between them. Auto-detected by the chunkedSock proxy.
    const header = [
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `⚔️ *DUEL*`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ``,
      `${cRankData.emoji} *${challenger.name}* [${cRank}] — Power: ${cPower.toLocaleString()}`,
      `    vs`,
      `${oRankData.emoji} *${opponent.name}* [${oRank}] — Power: ${oPower.toLocaleString()}`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ].join('\n');

    // One section per round — the player sees each turn land as a
    // separate bubble, exactly like Solo Leveling chapters.
    const battleLogSections = result.rounds.slice(0, 5).map((round, idx) => ({
      text: [
        `*Round ${idx + 1}*`,
        round,
      ].join('\n'),
    }));

    const outcomeLines = [
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ];
    if (draw) {
      outcomeLines.push(`🤝 *DRAW!*`);
      outcomeLines.push(`Both hunters are evenly matched.`);
    } else {
      outcomeLines.push(`🏆 *WINNER: ${winnerPlayer.name}*`);
      if (loserDied) outcomeLines.push(`💀 *${loserPlayer.name} was defeated!*`);
      outcomeLines.push(``);
      if (winnerAuraGain) {
        outcomeLines.push(`${winnerAuraGain.message}`);
        outcomeLines.push(`✨ ${winnerPlayer.name} Aura: ${winnerAuraGain.newTotal.toLocaleString()}`);
        if (winnerAuraGain.titleChanged) outcomeLines.push(`🎖️ New Title: *${winnerAuraGain.newTitle.title}*`);
      }
      if (loserAuraLoss) outcomeLines.push(`${loserAuraLoss.message}`);
      if (deathPenalty && deathPenalty.length > 0) {
        outcomeLines.push(``);
        outcomeLines.push(`💀 *DEATH PENALTY:*`);
        deathPenalty.forEach(p => outcomeLines.push(p));
      }
    }
    outcomeLines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    return sock.sendMessage(chatId, {
      mentions: [sender, mentionedId],
      sections: [
        { text: header },
        ...battleLogSections,
        { text: outcomeLines.join('\n') },
      ],
    }, { quoted: msg });
  }
};