const StatAllocationSystem = require('../../rpg/utils/StatAllocationSystem');

module.exports = {
  name: 'upgrade',
  description: '💎 Allocate upgrade points to your stats strategically',
  
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];

    if (!player) {
      return sock.sendMessage(chatId, { 
        text: '❌ Start your journey first with /start!' 
      }, { quoted: msg });
    }

    const action = args[0]?.toLowerCase();

    // ═══════════════════════════════════════════════════════════════
    // SHOW STAT ALLOCATION MENU
    // ═══════════════════════════════════════════════════════════════
    if (!action || action === 'menu' || action === 'status') {
      const display = StatAllocationSystem.getStatAllocationDisplay(player);
      
      return sock.sendMessage(chatId, { text: display }, { quoted: msg });
    }

    // ═══════════════════════════════════════════════════════════════
    // ALLOCATE STAT POINTS
    // ═══════════════════════════════════════════════════════════════
    if (action === 'allocate' || action === 'add' || action === 'invest') {
      const statName = args[1]?.toLowerCase();
      const amount = parseInt(args[2]) || 1;

      if (!statName) {
        return sock.sendMessage(chatId, { 
          text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ SPECIFY A STAT!
━━━━━━━━━━━━━━━━━━━━━━━━━━━

📜 AVAILABLE STATS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━
❤️ hp - Health Points
⚔️ atk - Attack Power
🛡️ def - Defense
✨ magic - Magic Power
💨 speed - Speed
💥 crit - Critical Chance
🔥 critdmg - Critical Damage
💚 lifesteal - Lifesteal
⚡ energy - Max Energy (+5 per point)

━━━━━━━━━━━━━━━━━━━━━━━━━━━
📖 USAGE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━
/upgrade allocate <stat> <amount>

Examples:
/upgrade allocate atk 10
/upgrade allocate hp 5
/upgrade allocate crit 3
━━━━━━━━━━━━━━━━━━━━━━━━━━━` 
        }, { quoted: msg });
      }

      // Map user input to actual stat names
      const statMap = {
        'hp': 'hp',
        'health': 'hp',
        'atk': 'atk',
        'attack': 'atk',
        'def': 'def',
        'defense': 'def',
        'magic': 'magicPower',
        'magicpower': 'magicPower',
        'mp': 'magicPower',
        'speed': 'speed',
        'spd': 'speed',
        'energy': 'energy',
        'ep': 'energy',
        'mana': 'energy',
        'rage': 'energy',
        'dragon': 'energy',
        'dragonforce': 'energy',
        'dragon force': 'energy',
        'dragonenergy': 'energy',
        'blood': 'energy',
        'bloodenergy': 'energy',
        'holy': 'energy',
        'holyenergy': 'energy',
        'focus': 'energy',
        'hunger': 'energy',
        'hungerenergy': 'energy',
        'shadow': 'energy',
        'shadowenergy': 'energy',
        'divine': 'energy',
        'divineenergy': 'energy',
        'force': 'energy',
        'crit': 'critChance',
        'critchance': 'critChance',
        'criticalchance': 'critChance',
        'critdmg': 'critDamage',
        'critdamage': 'critDamage',
        'criticaldamage': 'critDamage',
        'lifesteal': 'lifesteal',
        'ls': 'lifesteal'
      };

      const actualStatName = statMap[statName];
      
      if (!actualStatName) {
        return sock.sendMessage(chatId, { 
          text: `❌ Invalid stat: "${statName}"\n\nUse /upgrade allocate to see available stats!` 
        }, { quoted: msg });
      }

      if (amount < 1 || amount > 100) {
        return sock.sendMessage(chatId, { 
          text: '❌ Amount must be between 1 and 100!' 
        }, { quoted: msg });
      }

      // Allocate the stat
      const result = StatAllocationSystem.allocateStat(player, actualStatName, amount);
      
      saveDatabase();

      return sock.sendMessage(chatId, { 
        text: result.message 
      }, { quoted: msg });
    }

    // ═══════════════════════════════════════════════════════════════
    // RESET ALLOCATIONS
    // ═══════════════════════════════════════════════════════════════
    if (action === 'reset' || action === 'refund') {
      const result = StatAllocationSystem.resetAllocations(player);
      
      saveDatabase();

      return sock.sendMessage(chatId, { 
        text: result.message 
      }, { quoted: msg });
    }

    // ═══════════════════════════════════════════════════════════════
    // STAT GUIDE
    // ═══════════════════════════════════════════════════════════════
    if (action === 'guide' || action === 'help' || action === 'tips') {
      const guide = StatAllocationSystem.getStatGuide(player.class);
      
      return sock.sendMessage(chatId, { text: guide }, { quoted: msg });
    }

    // ═══════════════════════════════════════════════════════════════
    // SHOW DETAILED STATS
    // ═══════════════════════════════════════════════════════════════
    if (action === 'stats' || action === 'details') {
      const totalStats = StatAllocationSystem.getTotalStats(player);
      const className = typeof player.class === 'object' ? player.class.name : player.class;
      
      let display = `━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 DETAILED STATS
━━━━━━━━━━━━━━━━━━━━━━━━━━━

👤 ${player.name} | ${className} Lv.${player.level}

━━━━━━━━━━━━━━━━━━━━━━━━━━━
💎 STAT BREAKDOWN
━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

      // Show each stat with breakdown
      for (const [statName, config] of Object.entries(StatAllocationSystem.STAT_CONFIG)) {
        const baseStat = totalStats.base[statName] || 0;
        const allocations = totalStats.allocated[statName] || 0;
        const bonus = allocations * config.valuePerPoint;
        const current = totalStats.current[statName] || 0;
        
        display += `${config.emoji} ${config.name}\n`;
        display += `   Base: ${baseStat}\n`;
        display += `   Allocated: +${bonus} (${allocations} points)\n`;
        display += `   Current: ${current}\n`;
        display += `\n`;
      }
      
      display += `━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 TIP: Current stats include base stats,
allocations, equipment, and artifacts!
━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

      return sock.sendMessage(chatId, { text: display }, { quoted: msg });
    }

    // ═══════════════════════════════════════════════════════════════
    // STAT INFO (Show specific stat details)
    // ═══════════════════════════════════════════════════════════════
    if (action === 'info') {
      const statName = args[1]?.toLowerCase();
      
      if (!statName) {
        return sock.sendMessage(chatId, { 
          text: '❌ Specify a stat!\n\nExample: /upgrade info atk' 
        }, { quoted: msg });
      }

      const statMap = {
        'hp': 'hp',
        'health': 'hp',
        'atk': 'atk',
        'attack': 'atk',
        'def': 'def',
        'defense': 'def',
        'magic': 'magicPower',
        'magicpower': 'magicPower',
        'speed': 'speed',
        'crit': 'critChance',
        'critdmg': 'critDamage',
        'lifesteal': 'lifesteal'
      };

      const actualStatName = statMap[statName];
      
      if (!actualStatName) {
        return sock.sendMessage(chatId, { 
          text: `❌ Invalid stat: "${statName}"` 
        }, { quoted: msg });
      }

      const config = StatAllocationSystem.STAT_CONFIG[actualStatName];
      const allocations = player.statAllocations?.[actualStatName] || 0;
      const dynamicMax = StatAllocationSystem.getMaxAllocations ? 
        StatAllocationSystem.getMaxAllocations(actualStatName, player.level || 1) :
        (config.baseMax + Math.floor((player.level || 1) * (StatAllocationSystem.STAT_SCALE_FACTOR?.[actualStatName] || 1)));
      const bonus = allocations * config.valuePerPoint;
      const percentage = Math.floor((allocations / dynamicMax) * 100);
      
      let info = `━━━━━━━━━━━━━━━━━━━━━━━━━━━
${config.emoji} ${config.name} INFO
━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 ${config.description}

━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 YOUR ALLOCATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Allocated: ${allocations}/${dynamicMax} (${percentage}%)
Current Bonus: +${bonus}${actualStatName.includes('Chance') || actualStatName.includes('Damage') || actualStatName === 'lifesteal' ? '%' : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━
💎 COST & VALUE
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Cost: ${config.costPerPoint} UP per allocation
Gain: +${config.valuePerPoint} ${config.name} per allocation
Max Allocations: ${dynamicMax} (scales with level)

━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 RECOMMENDED FOR
━━━━━━━━━━━━━━━━━━━━━━━━━━━
${config.recommended}

━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 TO ALLOCATE:
/upgrade allocate ${statName} <amount>
━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

      return sock.sendMessage(chatId, { text: info }, { quoted: msg });
    }

    // ═══════════════════════════════════════════════════════════════
    // RECOMMENDATIONS - NEW!
    // ═══════════════════════════════════════════════════════════════
    if (action === 'recommend' || action === 'recommendations') {
      const recommendations = StatAllocationSystem.getRecommendations(player);
      
      let recommendMsg = `━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 UPGRADE RECOMMENDATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━

👤 ${player.name}
💎 Upgrade Points: ${player.upgradePoints || 0} UP

━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 SUGGESTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━

`;
      
      recommendations.forEach((rec, i) => {
        recommendMsg += `${i + 1}. ${rec}\n\n`;
      });
      
      recommendMsg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 Use /upgrade guide for class tips!
💡 Use /upgrade allocate to spend UP!
━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

      return sock.sendMessage(chatId, { text: recommendMsg }, { quoted: msg });
    }

    // ═══════════════════════════════════════════════════════════════
    // INVALID ACTION
    // ═══════════════════════════════════════════════════════════════
    return sock.sendMessage(chatId, { 
      text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ INVALID COMMAND
━━━━━━━━━━━━━━━━━━━━━━━━━━━

📜 AVAILABLE COMMANDS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━
/upgrade - View your stats
/upgrade allocate <stat> <amount>
/upgrade reset - Reset allocations
/upgrade guide - Class recommendations
/upgrade stats - Detailed breakdown
/upgrade info <stat> - Stat details
/upgrade recommend - Get smart tips
━━━━━━━━━━━━━━━━━━━━━━━━━━━` 
    }, { quoted: msg });
  }
};