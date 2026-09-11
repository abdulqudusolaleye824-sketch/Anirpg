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
    const UI = require('../../rpg/utils/UI');
    const pro = UI.isPro(player);
    const FRAME = pro ? UI.PRO_BAR : UI.FREE_BAR;

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
          text: (pro ? `${UI.PRO_BAR}\n❌ SPECIFY A STAT! 💎\n${UI.PRO_BAR}\n\n📜 AVAILABLE STATS:\n${UI.PRO_BAR}\n❤️ hp - Health Points\n⚔️ atk - Attack Power\n🛡️ def - Defense\n✨ magic - Magic Power\n💨 speed - Speed\n💥 crit - Critical Chance\n🔥 critdmg - Critical Damage\n💚 lifesteal - Lifesteal\n⚡ energy - Max Energy (+5 per point)\n\n${UI.PRO_BAR}\n📖 USAGE:\n${UI.PRO_BAR}\n/upgrade allocate <stat> <amount>\n\nExamples:\n/upgrade allocate atk 10\n/upgrade allocate hp 5\n/upgrade allocate crit 3\n${UI.PRO_BAR}\n${UI.PRO_MINI}\n💎 *PRO STATS* — ${player.upgradePoints || 0} UP banked` : `❌ SPECIFY A STAT!\n${UI.FREE_BAR}\n\n📜 AVAILABLE STATS:\n${UI.FREE_BAR}\n❤️ hp - Health Points\n⚔️ atk - Attack Power\n🛡️ def - Defense\n✨ magic - Magic Power\n💨 speed - Speed\n💥 crit - Critical Chance\n🔥 critdmg - Critical Damage\n💚 lifesteal - Lifesteal\n⚡ energy - Max Energy (+5 per point)\n\n${UI.FREE_BAR}\n📖 USAGE:\n${UI.FREE_BAR}\n/upgrade allocate <stat> <amount>\n\nExamples:\n/upgrade allocate atk 10\n/upgrade allocate hp 5\n/upgrade allocate crit 3\n${UI.FREE_BAR}\n${UI.upsell()}`) 
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
      const guide = StatAllocationSystem.getStatGuide(player.class, player);
      
      return sock.sendMessage(chatId, { text: guide }, { quoted: msg });
    }

    // ═══════════════════════════════════════════════════════════════
    // SHOW DETAILED STATS
    // ═══════════════════════════════════════════════════════════════
    if (action === 'stats' || action === 'details') {
      const totalStats = StatAllocationSystem.getTotalStats(player);
      const className = (player.class && typeof player.class === 'object') ? player.class.name : (player.class || 'Unawakened');
      
      let display = pro ? `${UI.PRO_BAR}\n📊 DETAILED STATS 💎\n${UI.PRO_BAR}\n\n👤 ${player.name} | ${className} Lv.${player.level}\n\n${UI.PRO_BAR}\n💎 STAT BREAKDOWN\n${UI.PRO_BAR}\n\n` : `📊 DETAILED STATS\n${UI.FREE_BAR}\n\n👤 ${player.name} | ${className} Lv.${player.level}\n\n${UI.FREE_BAR}\n💎 STAT BREAKDOWN\n${UI.FREE_BAR}\n\n`;

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
      
      display += `${FRAME}\n💡 TIP: Current stats include base stats,\nallocations, equipment, and artifacts!\n${FRAME}` + (pro ? `\n${UI.PRO_MINI}\n💎 *PRO STATS* — ${player.upgradePoints || 0} UP banked` : `\n${UI.upsell()}`);

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
      
      let info = pro ? `${UI.PRO_BAR}\n${config.emoji} ${config.name} INFO 💎\n${UI.PRO_BAR}\n\n📝 ${config.description}\n\n${UI.PRO_BAR}\n📊 YOUR ALLOCATIONS\n${UI.PRO_BAR}\nAllocated: ${allocations}/${dynamicMax} (${percentage}%)\nCurrent Bonus: +${bonus}${actualStatName.includes('Chance') || actualStatName.includes('Damage') || actualStatName === 'lifesteal' ? '%' : ''}\n\n${UI.PRO_BAR}\n💎 COST & VALUE\n${UI.PRO_BAR}\nCost: ${config.costPerPoint} UP per allocation\nGain: +${config.valuePerPoint} ${config.name} per allocation\nMax Allocations: ${dynamicMax} (scales with level)\n\n${UI.PRO_BAR}\n🎯 RECOMMENDED FOR\n${UI.PRO_BAR}\n${config.recommended}\n\n${UI.PRO_BAR}\n💡 TO ALLOCATE:\n/upgrade allocate ${statName} <amount>\n${UI.PRO_BAR}\n${UI.PRO_MINI}\n💎 *PRO STATS* — ${allocations}/${dynamicMax} ${config.name}` : `${config.emoji} ${config.name} INFO\n${UI.FREE_BAR}\n\n📝 ${config.description}\n\n${UI.FREE_BAR}\n📊 YOUR ALLOCATIONS\n${UI.FREE_BAR}\nAllocated: ${allocations}/${dynamicMax} (${percentage}%)\nCurrent Bonus: +${bonus}${actualStatName.includes('Chance') || actualStatName.includes('Damage') || actualStatName === 'lifesteal' ? '%' : ''}\n\n${UI.FREE_BAR}\n💎 COST & VALUE\n${UI.FREE_BAR}\nCost: ${config.costPerPoint} UP per allocation\nGain: +${config.valuePerPoint} ${config.name} per allocation\nMax Allocations: ${dynamicMax} (scales with level)\n\n${UI.FREE_BAR}\n🎯 RECOMMENDED FOR\n${UI.FREE_BAR}\n${config.recommended}\n\n${UI.FREE_BAR}\n💡 TO ALLOCATE:\n/upgrade allocate ${statName} <amount>\n${UI.FREE_BAR}\n${UI.upsell()}`;

      return sock.sendMessage(chatId, { text: info }, { quoted: msg });
    }

    // ═══════════════════════════════════════════════════════════════
    // RECOMMENDATIONS - NEW!
    // ═══════════════════════════════════════════════════════════════
    if (action === 'recommend' || action === 'recommendations') {
      const recommendations = StatAllocationSystem.getRecommendations(player);
      
      let recommendMsg = pro ? `${UI.PRO_BAR}\n💡 UPGRADE RECOMMENDATIONS 💎\n${UI.PRO_BAR}\n\n👤 ${player.name}\n💎 Upgrade Points: ${player.upgradePoints || 0} UP\n\n${UI.PRO_BAR}\n📋 SUGGESTIONS\n${UI.PRO_BAR}\n\n` : `💡 UPGRADE RECOMMENDATIONS\n${UI.FREE_BAR}\n\n👤 ${player.name}\n💎 Upgrade Points: ${player.upgradePoints || 0} UP\n\n${UI.FREE_BAR}\n📋 SUGGESTIONS\n${UI.FREE_BAR}\n\n`;
      
      recommendations.forEach((rec, i) => {
        recommendMsg += `${i + 1}. ${rec}\n\n`;
      });
      
      recommendMsg += `${FRAME}\n💡 Use /upgrade guide for class tips!\n💡 Use /upgrade allocate to spend UP!\n${FRAME}` + (pro ? `\n${UI.PRO_MINI}\n💎 *PRO STATS* — ${recommendations.length} tips` : `\n${UI.upsell()}`);

      return sock.sendMessage(chatId, { text: recommendMsg }, { quoted: msg });
    }

    // ═══════════════════════════════════════════════════════════════
    // INVALID ACTION
    // ═══════════════════════════════════════════════════════════════
    return sock.sendMessage(chatId, { 
      text: (pro ? `${UI.PRO_BAR}\n❌ INVALID COMMAND 💎\n${UI.PRO_BAR}\n\n📜 AVAILABLE COMMANDS:\n${UI.PRO_BAR}\n/upgrade - View your stats\n/upgrade allocate <stat> <amount>\n/upgrade reset - Reset allocations\n/upgrade guide - Class recommendations\n/upgrade stats - Detailed breakdown\n/upgrade info <stat> - Stat details\n/upgrade recommend - Get smart tips\n${UI.PRO_BAR}\n${UI.PRO_MINI}\n💎 *PRO STATS* — pick a command` : `❌ INVALID COMMAND\n${UI.FREE_BAR}\n\n📜 AVAILABLE COMMANDS:\n${UI.FREE_BAR}\n/upgrade - View your stats\n/upgrade allocate <stat> <amount>\n/upgrade reset - Reset allocations\n/upgrade guide - Class recommendations\n/upgrade stats - Detailed breakdown\n/upgrade info <stat> - Stat details\n/upgrade recommend - Get smart tips\n${UI.FREE_BAR}\n${UI.upsell()}`) 
    }, { quoted: msg });
  }
};