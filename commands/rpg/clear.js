module.exports = {
  name: 'clear',
  description: 'Reset ALL players data (ADMIN ONLY - NUCLEAR OPTION)',
  
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    // ============================================
    // ADMIN CHECK - Replace with your WhatsApp number!
    // ============================================
    // Strip JID suffix so we match regardless of @lid vs @s.whatsapp.net (DM vs group)
    const senderId = sender.split('@')[0];
    const ADMIN_NUMBER = '221951679328499';
    const CO_OWNER = '194592469209292';
    if (senderId !== ADMIN_NUMBER && senderId !== CO_OWNER) {
      return sock.sendMessage(chatId, { 
        text: '❌ This command is admin-only!' 
      }, { quoted: msg });
    }

    const action = args[0]?.toLowerCase();

    // Block cold /clear confirm — must run /clear first within 60s
    if (action === 'confirm') {
      if (!db.pendingClear || db.pendingClear.sender !== sender || Date.now() - db.pendingClear.timestamp > 60000) {
        delete db.pendingClear;
        return sock.sendMessage(chatId, {
          text: '❌ You must run */clear* first to see the warning before confirming.'
        }, { quoted: msg });
      }
    }

    // ============================================
    // CONFIRMATION REQUIRED
    // ============================================
    if (action !== 'confirm') {
      db.pendingClear = { sender, timestamp: Date.now() };
      const totalUsers = Object.keys(db.users || {}).length;
      const totalBankAccounts = db.banks ? Object.values(db.banks).reduce((sum, bank) => 
        sum + (bank.accounts ? bank.accounts.length : 0), 0) : 0;
      
      let totalNexus = 0;
      let totalCrystals = 0;
      let totalBankNexus = 0;
      
      // Calculate totals
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
✅ ALL player profiles
✅ ALL stats & levels
✅ ALL inventory & equipment
✅ ALL Nexus & crystals
✅ ALL bank accounts & deposits
✅ ALL skills & artifacts
✅ ALL casino & crime records
✅ EVERYTHING except system data

⚠️ YOUR ACCOUNT WILL BE PROTECTED
━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ WARNING: THIS CANNOT BE UNDONE!
━━━━━━━━━━━━━━━━━━━━━━━━━━━
To proceed, type:
/clear confirm

To cancel, just don't type anything.
━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      }, { quoted: msg });
    }

    // ============================================
    // EXECUTE MASS DELETION — ALL DATABASES
    // ============================================
    if (action === 'confirm') {
      const fs = require('fs');
      const pathLib = require('path');

      const totalUsers = Object.keys(db.users || {}).length;
      let totalNexusErased = 0;
      let totalCrystalsErased = 0;
      let totalBankNexusErased = 0;

      // Save caller's own data to restore after wipe
      const callerData = db.users[sender] ? JSON.parse(JSON.stringify(db.users[sender])) : null;

      // Tally before wipe
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

      // ── Wipe all main database keys ───────────────────────
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
      // Reset botMods to only the two hardcoded owners
      db.botMods = ['221951679328499@lid', '194592469209292@lid'];
      // Preserve: system, groupSettings, disabledCommands, antiLink

      // ── Wipe side JSON databases ──────────────────────────
      const dataDir = pathLib.join(__dirname, '../../rpg/data');
      ['achievements.json', 'playerPets.json', 'playerQuests.json'].forEach(file => {
        const fp = pathLib.join(dataDir, file);
        try { if (fs.existsSync(fp)) fs.writeFileSync(fp, '{}', 'utf-8'); }
        catch (e) { console.error('Clear failed for', file, e.message); }
      });

      // ── ALSO dump the in-memory caches ────────────────────
      // Without this the cached pets/quests get re-saved to disk on the next
      // command, so /clear looked like it "didn't clear". clearAll() resets
      // both the memory Map and the file (would be redundant otherwise).
      try { require('../../rpg/utils/PetManager').clearAll(); }
      catch (e) { console.error('PetManager clearAll failed:', e.message); }

      // ── Restore caller's account ──────────────────────────
      if (callerData) db.users[sender] = callerData;
      delete db.pendingClear;

      const totalBankAccounts = db.banks ? Object.values(db.banks).reduce((sum, bank) => sum + (bank.accounts ? bank.accounts.length : 0), 0) : 0;
      const deletedUsers = totalUsers - (callerData ? 1 : 0);
      const deletedBanks = totalBankAccounts;

      saveDatabase();

      // ============================================
      // CONFIRMATION MESSAGE
      // ============================================
      const confirmationMessage = `━━━━━━━━━━━━━━━━━━━━━━━━━━━
☢️ RESET COMPLETE ☢️
━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Database has been cleared!
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 DELETION REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🗑️ Players Deleted: ${deletedUsers} / ${totalUsers}
🗑️ Banks Deleted: ${deletedBanks} / ${totalBankAccounts}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💠 Nexus Erased (Wallet): ${totalNexusErased.toLocaleString()}
💠 Nexus Erased (Bank): ${totalBankNexusErased.toLocaleString()}
💎 Mana Stones Erased: ${totalCrystalsErased.toLocaleString()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🛡️ YOUR ACCOUNT: PROTECTED ✅
━━━━━━━━━━━━━━━━━━━━━━━━━━━
All players must use /register to play again.

The game is now in a fresh state!
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