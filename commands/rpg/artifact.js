const ArtifactSystem = require('../../rpg/utils/ArtifactSystem');

module.exports = {
  name: 'artifact',
  description: '🏺 Manage your legendary artifacts and equipment',
  
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];

    if (!player) {
      return sock.sendMessage(chatId, { 
        text: '❌ You are not registered! Use /register to start.' 
      }, { quoted: msg });
    }

    // Initialize artifact inventory
    if (!player.artifacts || Array.isArray(player.artifacts) || typeof player.artifacts !== 'object') {
      player.artifacts = {};
    }

    player.artifacts.inventory ??= [];
    // Merge gacha summon artifacts into main inventory
    if (Array.isArray(player.summonArtifacts)) {
      for (const a of player.summonArtifacts) {
        if (!player.artifacts.inventory.find(x => (x.name || x) === (a.name || a))) {
          player.artifacts.inventory.push(a);
        }
      }
    }
    player.artifacts.equipped ??= {
      weapon: null,
      armor: null,
      helmet: null,
      gloves: null,
      ring: null,
      amulet: null,
      tome: null
    };
    
    // ✅ NEW: Initialize enhancement tracking
    player.artifacts.enhanced ??= {};

    // Ensure all slots exist
    for (const slot of ['weapon','armor','helmet','gloves','ring','amulet','tome']) {
      if (!(slot in player.artifacts.equipped)) {
        player.artifacts.equipped[slot] = null;
      }
    }

    saveDatabase();

    const action = args[0]?.toLowerCase();

    // ═══════════════════════════════════════════════════════════════
    // VIEW INVENTORY
    // ═══════════════════════════════════════════════════════════════
    if (!action || action === 'list' || action === 'inventory') {
      let message = `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏺 ARTIFACT COLLECTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 ${player.name} | Level ${player.level}
━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

      // Show equipped artifacts
      message += `⚔️ EQUIPPED ARTIFACTS:\n`;
      message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      
      let hasEquipped = false;
      for (const [slot, artifactName] of Object.entries(player.artifacts.equipped)) {
        if (artifactName) {
          const artifact = ArtifactSystem.getArtifact(artifactName);
          if (artifact) {
            const rarity = ArtifactSystem.RARITY_INFO[artifact.rarity];
            const enhancement = player.artifacts.enhanced[artifactName] || 0;
            const enhanceSuffix = enhancement > 0 ? ` +${enhancement}` : '';
            message += `${slot.toUpperCase()}: ${artifact.emoji} ${rarity.color} ${artifact.name}${enhanceSuffix}\n`;
            hasEquipped = true;
          }
        }
      }
      
      if (!hasEquipped) {
        message += `   (No artifacts equipped)\n`;
      }

      message += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      message += `📦 INVENTORY (${player.artifacts.inventory.length}):\n`;
      message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

      if (player.artifacts.inventory.length === 0) {
        message += `   (No artifacts in inventory)\n\n`;
        message += `💡 Artifacts can be obtained from:\n`;
        message += `   • High-level dungeon bosses\n`;
        message += `   • S-Rank gates\n`;
        message += `   • Special events\n`;
      } else {
        player.artifacts.inventory.forEach((artifactName, index) => {
          const artifact = ArtifactSystem.getArtifact(artifactName);
          if (artifact) {
            const rarity = ArtifactSystem.RARITY_INFO[artifact.rarity];
            const enhancement = player.artifacts.enhanced[artifactName] || 0;
            const enhanceSuffix = enhancement > 0 ? ` +${enhancement}` : '';
            message += `${index + 1}. ${artifact.emoji} ${rarity.color} ${artifact.name}${enhanceSuffix}\n`;
            message += `   ${artifact.type.toUpperCase()} | ${artifact.description}\n\n`;
          }
        });
      }

      message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      message += `📜 COMMANDS:\n`;
      message += `/artifact view [#] - View details\n`;
      message += `/artifact equip [#] - Equip artifact\n`;
      message += `/artifact unequip [slot] - Unequip slot\n`;
      message += `/artifact enhance [#] - Upgrade artifact\n`;
      message += `/artifact fuse [#1] [#2] - Combine duplicates\n`;
      message += `/artifact sets - View set bonuses\n`;
      message += `/artifact stats - View your bonuses\n`;
      message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

      return sock.sendMessage(chatId, { text: message }, { quoted: msg });
    }

    // ═══════════════════════════════════════════════════════════════
    // VIEW ARTIFACT DETAILS
    // ═══════════════════════════════════════════════════════════════
    if (action === 'view' || action === 'info') {
      const index = parseInt(args[1]) - 1;

      if (isNaN(index) || index < 0 || index >= player.artifacts.inventory.length) {
        return sock.sendMessage(chatId, { 
          text: '❌ Invalid artifact number! Use /artifact list to see your artifacts.' 
        }, { quoted: msg });
      }

      const artifactName = player.artifacts.inventory[index];
      const artifact = ArtifactSystem.getArtifact(artifactName);

      if (!artifact) {
        return sock.sendMessage(chatId, { 
          text: '❌ Artifact not found!' 
        }, { quoted: msg });
      }

      const enhancement = player.artifacts.enhanced[artifactName] || 0;
      const canEquip = ArtifactSystem.canEquipArtifact(player, artifact);
      
      let message = ArtifactSystem.getArtifactDisplay(artifact, enhancement);
      message += `\n\n`;
      
      if (canEquip.can) {
        message += `✅ You can equip this artifact!\n`;
        message += `Use: /artifact equip ${index + 1}`;
      } else {
        message += `❌ ${canEquip.reason}`;
      }

      return sock.sendMessage(chatId, { text: message }, { quoted: msg });
    }

    // ═══════════════════════════════════════════════════════════════
    // EQUIP ARTIFACT
    // ═══════════════════════════════════════════════════════════════
    if (action === 'equip') {
      const index = parseInt(args[1]) - 1;

      if (isNaN(index) || index < 0 || index >= player.artifacts.inventory.length) {
        return sock.sendMessage(chatId, { 
          text: '❌ Invalid artifact number! Use /artifact list to see your artifacts.' 
        }, { quoted: msg });
      }

      const artifactName = player.artifacts.inventory[index];
      let artifact = ArtifactSystem.getArtifact(artifactName);

      // Spawned artifacts may not be in ArtifactSystem after a bot restart.
      // Reconstruct a minimal entry so the player can still equip it.
      if (!artifact && typeof artifactName === 'string') {
        artifact = {
          name: artifactName,
          emoji: '🏺',
          rarity: 'rare',
          type: 'weapon',
          description: 'A powerful artifact',
          stats: {},
          requirements: {},
        };
        ArtifactSystem.ARTIFACT_DATABASE[artifactName] = artifact;
      }

      if (!artifact) {
        return sock.sendMessage(chatId, { 
          text: '❌ Artifact not found!' 
        }, { quoted: msg });
      }

      const canEquip = ArtifactSystem.canEquipArtifact(player, artifact);
      if (!canEquip.can) {
        return sock.sendMessage(chatId, { 
          text: `❌ Cannot equip!\n\n${canEquip.reason}` 
        }, { quoted: msg });
      }

      const slot = artifact.type;
      
      // If slot already has artifact, move it back to inventory
      if (player.artifacts.equipped[slot]) {
        const oldArtifact = player.artifacts.equipped[slot];
        player.artifacts.inventory.push(oldArtifact);
      }

      // Equip new artifact
      // Unequip old artifact stats first
      if (player.artifacts.equipped[slot]) {
        const oldName = player.artifacts.equipped[slot];
        const oldArt = Array.isArray(player.artifacts.inventory) 
          ? null  // already moved back above
          : null;
        // We'll recalculate on next combat via getEquippedArtifactStats
      }
      
      player.artifacts.equipped[slot] = artifactName;
      player.artifacts.inventory.splice(index, 1);

      // Apply maxHp bonus immediately so player sees it
      const artStats = artifact.stats || artifact.bonus || {};
      if (artStats.hp || artStats.maxHp) {
        const hpBonus = artStats.hp || artStats.maxHp || 0;
        const enh = player.artifacts?.enhanced?.[artifactName] || 0;
        const finalHp = enh > 0 ? Math.floor(hpBonus * (1 + enh * 0.1)) : hpBonus;
        player.stats.maxHp = (player.stats.maxHp || 0) + finalHp;
        player.stats.hp = Math.min(player.stats.maxHp, (player.stats.hp || 0) + finalHp);
      }

      saveDatabase();

      const rarity = ArtifactSystem.RARITY_INFO[artifact.rarity];
      const enhancement = player.artifacts.enhanced[artifactName] || 0;
      const enhanceSuffix = enhancement > 0 ? ` +${enhancement}` : '';
      
      let message = `━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ ARTIFACT EQUIPPED!
━━━━━━━━━━━━━━━━━━━━━━━━━━━

${artifact.emoji} ${rarity.color} ${artifact.name}${enhanceSuffix}
Equipped to: ${slot.toUpperCase()}

━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 BONUS STATS APPLIED:
━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

      for (const [stat, baseValue] of Object.entries(artifact.stats)) {
        const value = enhancement > 0 ? Math.floor(baseValue * (1 + enhancement * 0.1)) : baseValue;
        const sign = value >= 0 ? '+' : '';
        message += `${sign}${value} ${stat.toUpperCase()}\n`;
      }

      if (artifact.abilities && artifact.abilities.length > 0) {
        message += `\n✨ ACTIVE ABILITIES:\n`;
        artifact.abilities.forEach(ability => {
          message += `• ${ability.name}\n`;
        });
      }

      message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

      return sock.sendMessage(chatId, { text: message }, { quoted: msg });
    }

    // ═══════════════════════════════════════════════════════════════
    // UNEQUIP ARTIFACT
    // ═══════════════════════════════════════════════════════════════
    if (action === 'unequip') {
      const slot = args[1]?.toLowerCase();

      if (!slot) {
        return sock.sendMessage(chatId, { 
          text: `❌ Specify slot to unequip!\n\nExample: /artifact unequip weapon\n\nSlots: weapon, armor, helmet, gloves, ring, amulet, tome` 
        }, { quoted: msg });
      }

      if (!player.artifacts.equipped[slot]) {
        return sock.sendMessage(chatId, { 
          text: `❌ No artifact equipped in ${slot.toUpperCase()} slot!` 
        }, { quoted: msg });
      }

      const artifactName = player.artifacts.equipped[slot];
      const artifact = ArtifactSystem.getArtifact(artifactName);

      // Move back to inventory
      player.artifacts.inventory.push(artifactName);
      player.artifacts.equipped[slot] = null;

      saveDatabase();

      const rarity = ArtifactSystem.RARITY_INFO[artifact.rarity];
      return sock.sendMessage(chatId, { 
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ ARTIFACT UNEQUIPPED
━━━━━━━━━━━━━━━━━━━━━━━━━━━

${artifact.emoji} ${rarity.color} ${artifact.name}
Moved to inventory

━━━━━━━━━━━━━━━━━━━━━━━━━━━` 
      }, { quoted: msg });
    }

    // ═══════════════════════════════════════════════════════════════
    // ✅ NEW: ENHANCE ARTIFACT
    // ═══════════════════════════════════════════════════════════════
    if (action === 'enhance' || action === 'upgrade') {
      const index = parseInt(args[1]) - 1;
      
      if (isNaN(index) || index < 0 || index >= player.artifacts.inventory.length) {
        return sock.sendMessage(chatId, { 
          text: '❌ Invalid artifact number! Use /artifact list to see your artifacts.' 
        }, { quoted: msg });
      }
      
      const artifactName = player.artifacts.inventory[index];
      const result = ArtifactSystem.enhanceArtifact(player, artifactName);
      
      saveDatabase();
      
      if (!result.success) {
        return sock.sendMessage(chatId, { text: result.message }, { quoted: msg });
      }
      
      if (result.enhanced) {
        const rarity = ArtifactSystem.RARITY_INFO[result.artifact.rarity];
        return sock.sendMessage(chatId, {
          text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ ENHANCEMENT SUCCESS!
━━━━━━━━━━━━━━━━━━━━━━━━━━━

${result.artifact.emoji} ${rarity.color} ${result.artifact.name}
Now: +${result.newLevel}

📊 Stat Boost: +${result.newLevel * 10}%
💠 Cost: ${result.cost.gold} 💠, ${result.cost.crystals} crystals

━━━━━━━━━━━━━━━━━━━━━━━━━━━`
        }, { quoted: msg });
      } else {
        return sock.sendMessage(chatId, {
          text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
💔 ENHANCEMENT FAILED
━━━━━━━━━━━━━━━━━━━━━━━━━━━

${result.artifact.name} remains at +${result.level}

💠 Lost: ${result.cost.gold} 💠, ${result.cost.crystals} crystals

Try again! Success rate improves with better luck.
━━━━━━━━━━━━━━━━━━━━━━━━━━━`
        }, { quoted: msg });
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // ✅ NEW: FUSE ARTIFACTS
    // ═══════════════════════════════════════════════════════════════
    if (action === 'fuse' || action === 'combine') {
      const index1 = parseInt(args[1]) - 1;
      const index2 = parseInt(args[2]) - 1;
      
      if (isNaN(index1) || isNaN(index2)) {
        return sock.sendMessage(chatId, {
          text: '❌ Usage: /artifact fuse <#1> <#2>\nExample: /artifact fuse 1 2\n\nCombine 2 identical artifacts for +1 enhancement!'
        }, { quoted: msg });
      }
      if (index1 < 0 || index1 >= player.artifacts.inventory.length ||
          index2 < 0 || index2 >= player.artifacts.inventory.length) {
        return sock.sendMessage(chatId, { text: '❌ Invalid artifact number!' }, { quoted: msg });
      }
      if (index1 === index2) {
        return sock.sendMessage(chatId, { text: '❌ Cannot fuse an artifact with itself. Choose two different items.' }, { quoted: msg });
      }

      const artifact1 = player.artifacts.inventory[index1];
      const artifact2 = player.artifacts.inventory[index2];
      
      const result = ArtifactSystem.fuseArtifacts(player, artifact1, artifact2);
      saveDatabase();
      
      if (!result.success) {
        return sock.sendMessage(chatId, { text: result.message }, { quoted: msg });
      }
      
      const rarity = ArtifactSystem.RARITY_INFO[result.artifact.rarity];
      return sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔥 FUSION SUCCESS!
━━━━━━━━━━━━━━━━━━━━━━━━━━━

${result.artifact.emoji} ${rarity.color} ${result.artifact.name}
Now: +${result.newLevel}

2 artifacts combined into 1 enhanced artifact!
━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      }, { quoted: msg });
    }

    // ═══════════════════════════════════════════════════════════════
    // ✅ NEW: VIEW SET BONUSES
    // ═══════════════════════════════════════════════════════════════
    if (action === 'sets') {
      let message = `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 ARTIFACT SETS
━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      
      for (const [setName, setData] of Object.entries(ArtifactSystem.ARTIFACT_SETS)) {
        message += `${setName}\n`;
        message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        
        for (const [pieces, bonus] of Object.entries(setData.bonuses)) {
          message += `${pieces} pieces: ${bonus.effect}\n`;
        }
        message += `\n`;
      }
      
      message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      message += `💡 Equip matching artifacts to activate bonuses!`;
      
      return sock.sendMessage(chatId, { text: message }, { quoted: msg });
    }

    // ═══════════════════════════════════════════════════════════════
    // ✅ NEW: VIEW YOUR ACTIVE BONUSES
    // ═══════════════════════════════════════════════════════════════
    if (action === 'stats' || action === 'bonus' || action === 'bonuses') {
      const setBonuses = ArtifactSystem.getActiveSetBonuses(player);
      const abilities = ArtifactSystem.getActiveArtifactAbilities(player);
      
      let message = `━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ YOUR ARTIFACT BONUSES
━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      
      if (setBonuses.length > 0) {
        message += `🎯 ACTIVE SET BONUSES:\n`;
        setBonuses.forEach(bonus => {
          message += `${bonus.set} (${bonus.pieces} pieces)\n`;
          message += `  ✨ ${bonus.effect}\n`;
        });
        message += `\n`;
      }
      
      if (abilities.length > 0) {
        message += `💫 ACTIVE ABILITIES:\n`;
        abilities.forEach(ability => {
          message += `• ${ability.name}\n`;
          message += `  ${ability.description}\n`;
        });
      }
      
      if (setBonuses.length === 0 && abilities.length === 0) {
        message += `No artifacts equipped!\n\nEquip artifacts to gain powerful bonuses!`;
      }
      
      message += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
      
      return sock.sendMessage(chatId, { text: message }, { quoted: msg });
    }

    // ═══════════════════════════════════════════════════════════════
    // ARTIFACT CODEX
    // ═══════════════════════════════════════════════════════════════
    if (action === 'codex' || action === 'list-all' || action === 'browse') {
      const rarity = args[1]?.toLowerCase();

      let message = `━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 ARTIFACT CODEX
━━━━━━━━━━━━━━━━━━━━━━━━━━━
All artifacts in the world
━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

      let artifacts;
      if (rarity && ArtifactSystem.RARITY_INFO[rarity]) {
        artifacts = ArtifactSystem.getArtifactsByRarity(rarity);
        message += `Showing: ${ArtifactSystem.RARITY_INFO[rarity].color} ${ArtifactSystem.RARITY_INFO[rarity].name} Artifacts\n\n`;
      } else {
        artifacts = Object.values(ArtifactSystem.ARTIFACT_DATABASE);
      }

      const byRarity = {};
      artifacts.forEach(artifact => {
        if (!byRarity[artifact.rarity]) {
          byRarity[artifact.rarity] = [];
        }
        byRarity[artifact.rarity].push(artifact);
      });

      for (const [rarityKey, artifactList] of Object.entries(byRarity)) {
        const rarityInfo = ArtifactSystem.RARITY_INFO[rarityKey];
        message += `${rarityInfo.color} ${rarityInfo.name.toUpperCase()}\n`;
        message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        
        artifactList.forEach(artifact => {
          message += `${artifact.emoji} ${artifact.name}\n`;
          message += `   ${artifact.type} | Lv.${artifact.requirements?.level || 1}+\n`;
          
          const owned = player.artifacts.inventory.includes(artifact.name) || 
                       Object.values(player.artifacts.equipped).includes(artifact.name);
          if (owned) {
            message += `   ✅ OWNED\n`;
          }
          
          message += `\n`;
        });
      }

      message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      message += `💡 Filter by rarity:\n`;
      message += `/artifact codex legendary\n`;
      message += `/artifact codex mythic\n`;
      message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

      return sock.sendMessage(chatId, { text: message }, { quoted: msg });
    }

    // ═══════════════════════════════════════════════════════════════
    // ADMIN: GIVE ARTIFACT
    // ═══════════════════════════════════════════════════════════════
    if (action === 'give' && player.isAdmin) {
      const artifactName = args.slice(1).join(' ');
      
      const artifact = ArtifactSystem.getArtifact(artifactName);
      if (!artifact) {
        return sock.sendMessage(chatId, { 
          text: `❌ Artifact not found!\n\nUse /artifact codex to see all artifacts.` 
        }, { quoted: msg });
      }

      player.artifacts.inventory.push(artifact.name);
      saveDatabase();

      const rarity = ArtifactSystem.RARITY_INFO[artifact.rarity];
      return sock.sendMessage(chatId, { 
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎁 ARTIFACT RECEIVED!
━━━━━━━━━━━━━━━━━━━━━━━━━━━

${artifact.emoji} ${rarity.color} ${artifact.name}

Added to your inventory!
Use /artifact equip to equip it.
━━━━━━━━━━━━━━━━━━━━━━━━━━━` 
      }, { quoted: msg });
    }

    // ═══════════════════════════════════════════════════════════════
    // INVALID COMMAND
    // ═══════════════════════════════════════════════════════════════
    return sock.sendMessage(chatId, { 
      text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ INVALID COMMAND
━━━━━━━━━━━━━━━━━━━━━━━━━━━

📜 AVAILABLE COMMANDS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━
/artifact list - View inventory
/artifact view [#] - View details
/artifact equip [#] - Equip artifact
/artifact unequip [slot] - Unequip
/artifact enhance [#] - Upgrade artifact
/artifact fuse [#1] [#2] - Combine duplicates
/artifact sets - View set bonuses
/artifact stats - View your bonuses
/artifact codex - Browse all artifacts
━━━━━━━━━━━━━━━━━━━━━━━━━━━` 
    }, { quoted: msg });
  }
};