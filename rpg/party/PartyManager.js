class PartyManager {
  static activeParties = {}; // Format: { partyId: { leader, members, gateId, status, raid } }
  static partyIdCounter = 1;
  
  // Create a new party for a gate
  static createParty(leaderId, leaderName, gateId) {
    const partyId = `PARTY-${this.partyIdCounter++}`;
    
    const party = {
      id: partyId,
      gateId: gateId,
      leader: leaderId,
      leaderName: leaderName,
      members: [{ id: leaderId, name: leaderName }],
      status: 'recruiting', // recruiting, raiding, completed
      createdAt: Date.now(),
      maxMembers: 8,
      raid: null
    };
    
    this.activeParties[partyId] = party;
    
    return party;
  }
  
  // Join a party
  static joinParty(partyId, playerId, playerName) {
    const party = this.activeParties[partyId];
    
    if (!party) {
      return { success: false, message: 'Party not found!' };
    }
    
    if (party.status !== 'recruiting') {
      return { success: false, message: 'Party is not recruiting!' };
    }
    
    if (party.members.length >= party.maxMembers) {
      return { success: false, message: 'Party is full!' };
    }
    
    if (party.members.find(m => m.id === playerId)) {
      return { success: false, message: 'You are already in this party!' };
    }
    
    party.members.push({ id: playerId, name: playerName });
    
    return { success: true, party: party };
  }
  
  // Leave a party
  static leaveParty(partyId, playerId) {
    const party = this.activeParties[partyId];
    
    if (!party) {
      return { success: false, message: 'Party not found!' };
    }
    
    if (party.leader === playerId) {
      // Leader left, disband party
      delete this.activeParties[partyId];
      return { success: true, disbanded: true };
    }
    
    party.members = party.members.filter(m => m.id !== playerId);
    
    return { success: true, party: party };
  }
  
  // Get party by ID
  static getParty(partyId) {
    return this.activeParties[partyId];
  }
  
  // Get party by player ID
  static getPartyByPlayer(playerId) {
    return Object.values(this.activeParties).find(party => 
      party.members.some(m => m.id === playerId)
    );
  }
  
  // Get parties for a specific gate
  static getPartiesForGate(gateId) {
    return Object.values(this.activeParties).filter(party => 
      party.gateId === gateId && party.status === 'recruiting'
    );
  }
  
  // Start raid (leader only)
  static startRaid(partyId, leaderId) {
    const party = this.activeParties[partyId];
    
    if (!party) {
      return { success: false, message: 'Party not found!' };
    }
    
    if (party.leader !== leaderId) {
      return { success: false, message: 'Only the party leader can start the raid!' };
    }
    
    if (party.status !== 'recruiting') {
      return { success: false, message: 'Raid already started!' };
    }
    
    if (party.members.length < 2) {
      return { success: false, message: 'You need at least 2 members to start a raid!' };
    }
    
    party.status = 'raiding';
    party.raid = {
      currentMonsterIndex: 0,
      monstersDefeated: 0,
      startTime: Date.now(),
      turn: 0
    };
    
    return { success: true, party: party };
  }
  
  // Format party info
  static formatPartyInfo(party) {
    const memberList = party.members.map((m, i) => 
      `${i === 0 ? '👑' : '⚔'} ${m.name}`
    ).join('\n');
    
    return `━━━━━━━━━━━━━━━━━━━━━━━━━━━
👥 PARTY INFO 👥
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Party ID: ${party.id}
🚪 Gate: ${party.gateId}
📊 Status: ${party.status.toUpperCase()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
👥 MEMBERS (${party.members.length}/${party.maxMembers})
━━━━━━━━━━━━━━━━━━━━━━━━━━━
${memberList}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 COMMANDS
━━━━━━━━━━━━━━━━━━━━━━━━━━━
/gate party join ${party.id}
/gate party leave
${party.status === 'recruiting' ? `/gate raid start (Leader only)` : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
  }
}

module.exports = PartyManager;
