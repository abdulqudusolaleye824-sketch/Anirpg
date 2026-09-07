// ============================================
// FILE: rpg/dungeons/DungeonPartyManager.js
// Party system for dungeons - max 10 hunters
// ============================================

class DungeonPartyManager {
  static parties = {}; // { partyId: { leader, members, dungeonId, items, status } }
  static partyCounter = 1;

  static createParty(leaderId, leaderName) {
    const partyId = `DPARTY-${this.partyCounter++}`;
    
    this.parties[partyId] = {
      id: partyId,
      leader: leaderId,
      leaderName: leaderName,
      members: [{ id: leaderId, name: leaderName, ready: false }],
      sharedItems: {
        healthPotions: 0,
        energyPotions: 0,
        reviveTokens: 0,
        healthPotionsUsed: 0,   // max 5 per dungeon
        reviveTokensUsed: 0     // max 1 per dungeon
      },
      status: 'recruiting', // recruiting, shopping, active, completed
      createdAt: Date.now(),
      maxMembers: 10           // ← 10 hunters per party
    };

    return this.parties[partyId];
  }

  static joinParty(partyId, playerId, playerName) {
    const party = this.parties[partyId];
    if (!party) return { success: false, message: 'Party not found!' };
    if (party.status !== 'recruiting') return { success: false, message: 'Party not recruiting!' };
    if (party.members.length >= party.maxMembers) return { success: false, message: `Party is full! (${party.maxMembers} hunters max)` };
    if (party.members.find(m => m.id === playerId)) return { success: false, message: 'Already in party!' };

    party.members.push({ id: playerId, name: playerName, ready: false });
    return { success: true, party };
  }

  static leaveParty(partyId, playerId) {
    const party = this.parties[partyId];
    if (!party) return { success: false };
    
    if (party.leader === playerId) {
      delete this.parties[partyId];
      return { success: true, disbanded: true };
    }

    party.members = party.members.filter(m => m.id !== playerId);
    return { success: true };
  }

  static setReady(partyId, playerId, ready = true) {
    const party = this.parties[partyId];
    if (!party) return false;

    const member = party.members.find(m => m.id === playerId);
    if (member) {
      member.ready = ready;
      return true;
    }
    return false;
  }

  static allReady(partyId) {
    const party = this.parties[partyId];
    if (!party || party.members.length === 0) return false;
    return party.members.every(m => m.ready);
  }

  static getPartyByPlayer(playerId) {
    return Object.values(this.parties).find(p => 
      p.members.some(m => m.id === playerId)
    );
  }

  static addItem(partyId, itemType, quantity) {
    const party = this.parties[partyId];
    if (!party) return false;

    if (party.sharedItems[itemType] !== undefined) {
      party.sharedItems[itemType] += quantity;
      return true;
    }
    return false;
  }

  static useItem(partyId, itemType, quantity = 1) {
    const party = this.parties[partyId];
    if (!party) return false;

    if (party.sharedItems[itemType] >= quantity) {
      party.sharedItems[itemType] -= quantity;
      return true;
    }
    return false;
  }

  static formatPartyInfo(party) {
    const memberList = party.members.map(m => 
      `${m.id === party.leader ? '👑' : '⚔'} ${m.name} ${m.ready ? '✅' : '⏳'}`
    ).join('\n');

    const hpUsed = party.sharedItems.healthPotionsUsed || 0;
    const revUsed = party.sharedItems.reviveTokensUsed || 0;

    return `━━━━━━━━━━━━━━━━━━━━━━━━━━━
👥 DUNGEON PARTY 👥
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Party: ${party.id}
📊 Status: ${party.status.toUpperCase()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
👥 MEMBERS (${party.members.length}/${party.maxMembers})
━━━━━━━━━━━━━━━━━━━━━━━━━━━
${memberList}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎒 SHARED ITEMS
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🩹 Health Potions: ${party.sharedItems.healthPotions} (Used: ${hpUsed}/5)
💙 Energy Potions: ${party.sharedItems.energyPotions}
🎫 Revive Tokens: ${party.sharedItems.reviveTokens} (Used: ${revUsed}/1)
━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
  }
}

module.exports = DungeonPartyManager;