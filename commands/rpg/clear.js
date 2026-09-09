module.exports = {
  name: 'clear',
  description: 'Reset ALL players data (ADMIN ONLY - NUCLEAR OPTION)',
  
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    const senderId = sender.split('@')[0];
    const ADMIN_NUMBER = '221951679328499';
    const CO_OWNER = '194592469209292';
    if (senderId !== ADMIN_NUMBER && senderId !== CO_OWNER) {
      return sock.sendMessage(chatId, { 
        text: '❌ This command is admin-only!' 
      }, { quoted: msg });
    }

    const action = args[0]?.toLowerCase();

    if (action === 'confirm') {
      if (!db.pendingClear || db.pendingClear.sender !== sender || Date.now() - db.pendingClear.timestamp > 60000) {
        delete db.pendingClear;
        return sock.sendMessage(chatId, {
          text: '❌ You must run */clear* first to see the warning before confirming.'
        }, { quoted: msg });
      }
    }

    if (action !== 'confirm') {
      db.pendingClear = { sender, timestamp: Date.now() };
      const totalUsers = Object.keys(db.users || {}).length;
      const totalBankAccounts = db.banks ? Object.values(db.banks).reduce((sum, bank) => 
        sum + (bank.accounts ? bank.accounts.length : 0), 0) : 0;
      
      let totalNexus = 0;
      let totalCrystals = 0;
      let totalBankNexus = 0;
      
      for (const userId in db.users) {
        const user = db.users[userId];
        totalNexus += user.gold || 0;
        totalCrystals += user.manaCrystals || 0;
      }
      
      if (db.banks) {
        for (const bankId in db.banks) {
          const bank = db.banks[bankId];
          if (bank.accounts) {
            bank.accounts.forEach(account => {
              totalBankNexus += account.balance || 0;
            });
          }
        }
      }

      return sock.sendMessage(chatId, { 
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
☢️ NUCLEAR RESET ☢️
━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ ADMIN ONLY - REQUIRES CONFIRMATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 CURRENT DATABASE
━━━━━━━━━━━━━━━━━━━━━━━━━━━
👥 Total Players: ${totalUsers}
🏦 Bank Accounts: ${totalBankAccounts}
💠 Total Nexus (Wallet): ${totalNexus.toLocaleString()}
💠 Total Nexus (Bank): ${totalBankNexus.toLocaleString()}
💎 Total 💎 Mana Stones: ${totalCrystals.toLocaleString()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🗑️ THIS WILL DELETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ ALL player profiles (including yours)
✅ ALL stats & levels
✅ ALL inventory & equipment
✅ ALL Nexus & crystals
✅ ALL bank accounts & deposits
✅ ALL skills & artifacts
✅ ALL casino & crime records
✅ EVERYTHING except system data

⚠️ ALL ACCOUNTS WILL BE WIPED
━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ WARNING: THIS CANNOT BE UNDONE!
━━━━━━━━━━━━━━━━━━━━━━━━━━━
To proceed, type:
/clear confirm

To cancel, just don't type anything.
━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      }, { quoted: msg });
    }

    // EXECUTE MASS DELETION — ALL DATABASES
    if (action === 'confirm') {
      const fs = require('fs');
      const pathLib = require('path');

      const totalUsers = Object.keys(db.users || {}).length;
      let totalNexusErased = 0;
      let totalCrystalsErased = 0;
      let totalBankNexusErased = 0;

      for (const userId in db.users) {
        const u = db.users[userId];
        totalNexusErased += u.gold || 0;
        totalCrystalsErased += u.manaCrystals || 0;
      }
      if (db.banks) {
        for (const bid in db.banks) {
          (db.banks[bid].accounts || []).forEach(a => { totalBankNexusErased += a.balance || 0; });
        }
      }

      // Wipe all database keys completely
      db.users           = {};
      db.banks           = {};
      db.guilds          = {};
      db.guildInvites    = {};
      db.bannedUsers     = {};
      db.mutedUsers      = {};
      db.afkUsers        = {};
      db.userCooldowns   = {};
      db.lastCommand     = {};
      db.antiLinkStrikes = {};
      db.pendingTrades   = {};
      db.subscribers     = [];
      db.dailyQuests     = {};
      db.bypassCooldowns = {};
      db.banlist         = {};
      db.christmasEvent  = {};
      db.gateKeys        = {};
      db.dungeonGCs      = {};
      db.affiliates      = {};
      db.gateSpawns      = {};
      db.pendingGuildHires = {};
      db.botMods = ['221951679328499@lid', '194592469209292@lid'];

      // FIX: clear in-memory GateKeyManager & GateManager state (fixes /clear not clearing gate keys)
      try {
        const GKM = require('../../rpg/dungeons/GateKeyManager');
        if (GKM.activeKeys) Object.keys(GKM.activeKeys).forEach(k=>delete GKM.activeKeys[k]);
        if (GKM.dungeonGCs) Object.keys(GKM.dungeonGCs).forEach(k=>delete GKM.dungeonGCs[k]);
        if (GKM.affiliates) Object.keys(GKM.affiliates).forEach(k=>delete GKM.affiliates[k]);
      } catch (e) {}
      try {
        const { GateManager } = require('../../rpg/dungeons/GateManager');
        if (GateManager.activeGates) Object.keys(GateManager.activeGates).forEach(k=>delete GateManager.activeGates[k]);
        GateManager.gatesByChat = {};
      } catch (e) {}
      try {
        const GR = require('../../rpg/dungeons/GateRaid');
        // clear any raid gate references held in GateManager (already cleared above)
      } catch (e) {}

      const dataDir = pathLib.join(__dirname, '../../rpg/data');
      ['achievements.json', 'playerPets.json', 'playerQuests.json'].forEach(file => {
        const fp = pathLib.join(dataDir, file);
        try { if (fs.existsSync(fp)) fs.writeFileSync(fp, '{}', 'utf-8'); }
        catch (e) { console.error('Clear failed for', file, e.message); }
      });

      try { require('../../rpg/utils/PetManager').clearAll(); }
      catch (e) { console.error('PetManager clearAll failed:', e.message); }

      delete db.pendingClear;
      saveDatabase();

      const confirmationMessage = `━━━━━━━━━━━━━━━━━━━━━━━━━━━
☢️ RESET COMPLETE ☢️
━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Entire database has been cleared!
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 DELETION REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🗑️ Players Deleted: ${totalUsers}
💠 Nexus Erased (Wallet): ${totalNexusErased.toLocaleString()}
💠 Nexus Erased (Bank): ${totalBankNexusErased.toLocaleString()}
💎 Mana Stones Erased: ${totalCrystalsErased.toLocaleString()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
All players (including admins) must use /register to play again.
━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏰ Reset completed at: ${new Date().toLocaleString()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

      return sock.sendMessage(chatId, { 
        text: confirmationMessage 
      }, { quoted: msg });
    }

    return sock.sendMessage(chatId, { 
      text: '❌ Invalid option! Use /clear to see menu.' 
    }, { quoted: msg });
  }
};
