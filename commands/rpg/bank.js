const BankingSystem = require('../../rpg/banking/BankingSystem');

module.exports = {
  name: 'bank',
  description: '🏦 Banking system - Deposit, withdraw, earn interest',
  
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];

    if (!player) {
      return sock.sendMessage(chatId, {
        text: '❌ You are not registered! Use /register'
      }, { quoted: msg });
    }
    const UI = require('../../rpg/utils/UI');
    const pro = UI.isPro(player);
    const FRAME = pro ? UI.PRO_BAR : UI.FREE_BAR;

    const action = args[0]?.toLowerCase();

    // ═══════════════════════════════════════════════════════════════
    // MAIN MENU
    // ═══════════════════════════════════════════════════════════════
    if (!action) {
      const ownedBank = BankingSystem.getPlayerBank(db, sender);
      const accountBank = BankingSystem.getAccountBank(db, sender);
      
      const menuHead = pro ? `${UI.PRO_BAR}\n🏦 BANKING SYSTEM 🏦 💎\n${UI.PRO_BAR}\n` : `🏦 BANKING SYSTEM 🏦\n${UI.FREE_BAR}\n`;
      let menu = menuHead + `💠 Your Nexus: ${(player.gold||0).toLocaleString()} | 💎 Mana Stones: ${(player.manaCrystals||player.manaStones||0).toLocaleString()}
${FRAME}\n`;

      if (ownedBank) {
        const stats = BankingSystem.getBankStats(ownedBank);
        menu += `\n🏦 YOUR BANK: ${ownedBank.name}
👥 Accounts: ${stats.accounts}
💠 Total Deposits: ${stats.totalDeposits} | 💎 Mana: ${stats.totalDepositsMana||0}
💸 Interest Earned: ${stats.interestCollected} | 💎 Mana Interest: ${stats.interestCollectedMana||0}
${FRAME}\n`;
      }

      if (accountBank) {
        const account = accountBank.accounts.find(a => a.userId === sender);
        menu += `\n💳 YOUR ACCOUNT
🏦 Bank: ${accountBank.name}
💠 Balance: ${account.balance||0} | 💎 Mana Stones: ${account.balanceMana||0}
${FRAME}\n`;
      }

      menu += `\n📌 COMMANDS
${FRAME}
${!ownedBank ? '🏦 /bank create [name] - Create bank\n   Requirements: Level 50 OR 20k Nexus\n   Cost: 10,000 Nexus\n\n' : ''}${!accountBank ? '💳 /bank register [bank] - Open account\n\n' : ''}`;

      if (accountBank) {
        menu += `💠 /bank deposit [amount] [nexus|mana] - Deposit (default Nexus)
   e.g. /bank deposit 1000  | /bank deposit 500 mana
💸 /bank withdraw [amount] [nexus|mana] - Withdraw
   (10% fee to bank owner)
   (1 hr cooldown, 30m Pro)
\n`;
      }

      if (ownedBank) {
        menu += `📊 /bank info - Bank details
👥 /bank accounts - View accounts
💠 /bank collect - Collect monthly interest
\n`;
      }

      menu += `🏦 /bank list - View all banks
${FRAME}
💡 HOW IT WORKS
${FRAME}
1️⃣ High level players create banks
2️⃣ Other players deposit Nexus safely
3️⃣ Bank owner earns 10% on withdrawals
4️⃣ Everyone's Nexus is protected!
${FRAME}`;
      if (pro && ownedBank) {
        try {
          const _st = BankingSystem.getBankStats(ownedBank);
          menu += `${UI.PRO_MINI}\n💎 *PRO VAULT* — ${_st.accounts} accounts · ${UI.num(_st.totalDeposits)} 💠 held\n`;
        } catch (e) {}
      } else if (pro && accountBank) {
        menu += `${UI.PRO_MINI}\n💎 *PRO SHIELD* — your deposits are safe from /rob\n`;
      }
      if (!pro) menu += `${UI.upsell()}\n`;

      return sock.sendMessage(chatId, { text: menu }, { quoted: msg });
    }

    // ═══════════════════════════════════════════════════════════════
    // CREATE BANK
    // ═══════════════════════════════════════════════════════════════
    if (action === 'create') {
      const existingBank = BankingSystem.getPlayerBank(db, sender);
      if (existingBank) {
        return sock.sendMessage(chatId, {
          text: `❌ You already own a bank: ${existingBank.name}`
        }, { quoted: msg });
      }

      const WHITELISTED_BANK_CREATORS = ['221951679328499@lid', '194592469209292@lid'];
      const isWhitelisted = WHITELISTED_BANK_CREATORS.includes(sender) || WHITELISTED_BANK_CREATORS.includes(sender.split('@')[0] + '@lid') || WHITELISTED_BANK_CREATORS.some(j => sender.includes(j.split('@')[0]));
      const canCreate = isWhitelisted
        ? { canCreate: true }
        : BankingSystem.canCreateBank(player);
      if (!canCreate.canCreate) {
        return sock.sendMessage(chatId, {
          text: `❌ Cannot create bank!\n\n${canCreate.reason}\n\n📌 Requirements:\n- Level 50 OR 20,000 Nexus\n- 10,000 Nexus creation fee unless you're Naruto`
        }, { quoted: msg });
      }

      const bankName = args.slice(1).join(' ');
      if (!bankName || bankName.length < 3) {
        return sock.sendMessage(chatId, {
          text: '❌ Bank name must be 3+ characters!\n\nExample: /bank create Senku Bank'
        }, { quoted: msg });
      }

      // Check if name is taken
      if (db.banks) {
        const nameTaken = Object.values(db.banks).some(b => 
          b.name.toLowerCase() === bankName.toLowerCase()
        );
        if (nameTaken) {
          return sock.sendMessage(chatId, {
            text: '❌ Bank name already taken!'
          }, { quoted: msg });
        }
      }

      const isPrivilegedBankCreator = ['221951679328499@lid', '194592469209292@lid'].some(j => sender === j || sender.split('@')[0] === j.split('@')[0]);
      const cost = isPrivilegedBankCreator ? 0 : BankingSystem.BANK_CREATION_REQUIREMENTS.creationCost;
      if (!isPrivilegedBankCreator && player.gold < cost) {
        return sock.sendMessage(chatId, {
          text: `❌ Not enough Nexus!\n\nNeed: ${cost}\nHave: ${player.gold}`
        }, { quoted: msg });
      }

      // Deduct cost (waived for owner/co-owner)
      if (cost > 0) {
        player.gold -= cost;
        try { require('../../rpg/utils/TransactionLog').logTransaction(player, { type: 'bank_fee', amount: cost, currency: '💠', note: `bank creation` }); } catch (e) {};
        if (player.inventory) player.inventory.gold = player.gold;
      }

      // Create bank
      const bank = BankingSystem.createBank(db, sender, bankName);
      saveDatabase();

      // Announce in group
      await sock.sendMessage(chatId, {
        text: `${FRAME}
🏦 NEW BANK OPENED! 🏦
${FRAME}
🏦 Bank: ${bankName}
👑 Owner: ${player.name}
${FRAME}
💠 BENEFITS
${FRAME}
✅ Safe Nexus storage
✅ Protected from theft
✅ 10% interest to bank owner
✅ 1 hr withdrawal system
${FRAME}
📌 TO JOIN
/bank register ${bankName}
${FRAME}
@everyone - Secure your Nexus now!
${FRAME}`
      }, { quoted: msg });

      return;
    }

    // ═══════════════════════════════════════════════════════════════
    // REGISTER ACCOUNT
    // ═══════════════════════════════════════════════════════════════
    if (action === 'register' || action === 'join') {
      const existingAccount = BankingSystem.getAccountBank(db, sender);
      if (existingAccount) {
        return sock.sendMessage(chatId, {
          text: `❌ You already have an account at ${existingAccount.name}!`
        }, { quoted: msg });
      }

      const bankName = args.slice(1).join(' ');
      if (!bankName) {
        return sock.sendMessage(chatId, {
          text: '❌ Specify bank name!\n\nExample: /bank register Senku Bank\n\nUse /bank list to see all banks'
        }, { quoted: msg });
      }

      if (!db.banks) {
        return sock.sendMessage(chatId, {
          text: '❌ No banks exist yet!'
        }, { quoted: msg });
      }

      const bank = Object.values(db.banks).find(b => 
        b.name.toLowerCase() === bankName.toLowerCase()
      );

      if (!bank) {
        return sock.sendMessage(chatId, {
          text: `❌ Bank not found: ${bankName}\n\nUse /bank list to see all banks`
        }, { quoted: msg });
      }

      const BOT_OWNER = '221951679328499@lid';
      const CO_OWNER  = '194592469209292@lid';
      const isSuperUser = sender === BOT_OWNER || sender === CO_OWNER;
      const isBankOwner = bank.owner === sender;

      // Bank owners can register at their own bank (no deposit required)
      // Owner and co-owner always free, no minimum
      let initialDeposit = 0;
      if (!isSuperUser && !isBankOwner) {
        // Normal hunter — must deposit minimum 100 Nexus
        initialDeposit = player.gold || 0;
        if (initialDeposit < 100) {
          return sock.sendMessage(chatId, {
            text: '❌ Minimum 100 Nexus required to open account!'
          }, { quoted: msg });
        }
        // Transfer all Nexus to bank
        player.gold = 0;
        try { require('../../rpg/utils/TransactionLog').logTransaction(player, { type: 'bank_deposit', amount: initialDeposit, currency: '💠', note: `account opening` }); } catch (e) {};
        if (player.inventory) player.inventory.gold = 0;
      }

      // Create account
      BankingSystem.openAccount(bank, sender, player.name, initialDeposit);
      saveDatabase();

      await sock.sendMessage(chatId, {
        text: `${FRAME}
✅ ACCOUNT OPENED! ✅
${FRAME}
🏦 Bank: ${bank.name}
💠 Initial Deposit: ${initialDeposit}
${FRAME}
💡 YOUR GOLD IS NOW SAFE!
${FRAME}
📌 IMPORTANT
- Bank owner earns 10% on withdrawals
- 1 hr cooldown between withdrawals
- All earnings auto-deposit to bank
${FRAME}
Use /bank deposit to add more!
${FRAME}`
      }, { quoted: msg });

      // Notify bank owner — serf-only (fix non-serfbot DMs on new member join)
      try {
        let _notifySock = null;
        try {
          const SerfManager2 = require('../../rpg/utils/SerfManager');
          const MSM2 = require('../../bots/MultiSocketManager');
          const serf2 = SerfManager2.getSerf(db, bank.owner);
          _notifySock = serf2?.botKey ? MSM2.getSocket(serf2.botKey) : null;
        } catch {}
        if (_notifySock) {
          await _notifySock.sendMessage(bank.owner, {
            text: `🏦 NEW ACCOUNT!\n\n${player.name} joined ${bank.name}\nDeposit: ${initialDeposit} gold`
          });
        } else {
          try { console.log(`[BANK] Skipped NEW ACCOUNT DM to ${bank.owner} — no serf`); } catch {}
        }
      } catch (e) {}

      return;
    }

    // ═══════════════════════════════════════════════════════════════
    // DEPOSIT
    // ═══════════════════════════════════════════════════════════════
      if (action === 'deposit') {
      const bank = BankingSystem.getAccountBank(db, sender);
      if (!bank) {
        return sock.sendMessage(chatId, {
          text: '❌ You don\'t have a bank account!\n\nUse /bank register [bank name]'
        }, { quoted: msg });
      }

      const amount = parseInt(args[1]);
      let currency = (args[2]||'nexus').toLowerCase();
      if (['mana','manastones','ms','crystals','crystal'].includes(currency)) currency='mana'; else currency='nexus';
      
      // ✅ FIX: Validate amount first
      if (!amount || amount < 1) {
        return sock.sendMessage(chatId, {
          text: '❌ Invalid amount!\n\nExample: /bank deposit 1000\n/bank deposit 500 mana'
        }, { quoted: msg });
      }

      if (currency==='mana') {
        const haveMana = player.manaCrystals||player.manaStones||0;
        if (haveMana < amount) {
          return sock.sendMessage(chatId, {
            text: `❌ Not enough Mana Stones!\n\nHave: ${haveMana}\nNeed: ${amount}`
          }, { quoted: msg });
        }
        player.manaCrystals = haveMana - amount;
        try { require('../../rpg/utils/TransactionLog').logTransaction(player, { type: 'bank_deposit', amount: amount, currency: '💎', note: `bank ${bank.name}` }); } catch (e) {};
        player.manaStones = player.manaCrystals;
        const resultM = BankingSystem.deposit(bank, sender, amount, 'mana');
        saveDatabase();
        return sock.sendMessage(chatId, {
          text: `${FRAME}\n✅ DEPOSIT SUCCESS! ✅\n${FRAME}\n🏦 Bank: ${bank.name}\n💎 Deposited: ${amount} Mana Stones\n${FRAME}\n💳 Bank Mana Balance: ${resultM.newBalance}\n💎 Wallet Mana: ${player.manaCrystals}\n${FRAME}`
        }, { quoted: msg });
      }

      // Nexus handling
      if ((player.gold || 0) < amount) {
        return sock.sendMessage(chatId, {
          text: `❌ Not enough Nexus!\n\nHave: ${player.gold || 0}\nNeed: ${amount}`
        }, { quoted: msg });
      }

      // ✅ FIX: Deduct Nexus FIRST, then deposit
      player.gold -= amount;
      try { require('../../rpg/utils/TransactionLog').logTransaction(player, { type: 'bank_deposit', amount: amount, currency: '💠', note: `bank ${bank.name}` }); } catch (e) {};
      if (player.gold < 0) player.gold = 0; // Safety check
      if (player.inventory) player.inventory.gold = player.gold;

      const result = BankingSystem.deposit(bank, sender, amount, 'nexus');
      saveDatabase();

      return sock.sendMessage(chatId, {
        text: `${FRAME}
✅ DEPOSIT SUCCESS! ✅
${FRAME}
🏦 Bank: ${bank.name}
💠 Deposited: ${amount}
${FRAME}
💳 Bank Balance: ${result.newBalance}
💠 Wallet: ${player.gold}
${FRAME}`
      }, { quoted: msg });
    }


    // ═══════════════════════════════════════════════════════════════
    // WITHDRAW
    // ═══════════════════════════════════════════════════════════════
    if (action === 'withdraw') {
      const bank = BankingSystem.getAccountBank(db, sender);
      if (!bank) {
        return sock.sendMessage(chatId, {
          text: '❌ You don\'t have a bank account!'
        }, { quoted: msg });
      }

      const amount = parseInt(args[1]);
      let wCurrency = (args[2]||'nexus').toLowerCase();
      if (['mana','manastones','ms','crystals','crystal'].includes(wCurrency)) wCurrency='mana'; else wCurrency='nexus';
      if (!amount || amount < 1) {
        return sock.sendMessage(chatId, {
          text: '❌ Invalid amount!\n\nExample: /bank withdraw 1000\n/bank withdraw 500 mana'
        }, { quoted: msg });
      }

      const result = BankingSystem.withdraw(bank, sender, amount, player, wCurrency);
      
      if (!result.success) {
        return sock.sendMessage(chatId, {
          text: `❌ Withdrawal failed!\n\n${result.reason}`
        }, { quoted: msg });
      }

      if (result.currency==='mana') {
        player.manaCrystals = (player.manaCrystals||0) + result.withdrawn;
        try { require('../../rpg/utils/TransactionLog').logTransaction(player, { type: 'bank_withdraw', amount: result.withdrawn, currency: '💎', note: `bank ${bank.name}` }); } catch (e) {};
        player.manaStones = player.manaCrystals;
        const ownerM = db.users[bank.owner];
        if (ownerM) {
          ownerM.manaCrystals = (ownerM.manaCrystals||0) + result.interest;
          try { require('../../rpg/utils/TransactionLog').logTransaction(ownerM, { type: 'bank_interest', amount: result.interest, currency: '💎', note: `bank ${bank.name}` }); } catch (e) {};
          ownerM.manaStones = ownerM.manaCrystals;
        }
      } else {
        // Give player the Nexus (after 10% fee)
        player.gold = (player.gold || 0) + result.withdrawn;
        try { require('../../rpg/utils/TransactionLog').logTransaction(player, { type: 'bank_withdraw', amount: result.withdrawn, currency: '💠', note: `bank ${bank.name}` }); } catch (e) {};
        if (player.inventory) player.inventory.gold = player.gold;
        // Give bank owner the interest
        const owner = db.users[bank.owner];
        if (owner) {
          owner.gold = (owner.gold || 0) + result.interest;
          try { require('../../rpg/utils/TransactionLog').logTransaction(owner, { type: 'bank_interest', amount: result.interest, currency: '💠', note: `bank ${bank.name}` }); } catch (e) {};
          if (owner.inventory) owner.inventory.gold = owner.gold;
        }
      }

      saveDatabase();

      await sock.sendMessage(chatId, {
        text: `${FRAME}
✅ WITHDRAWAL SUCCESS! ✅
${FRAME}
🏦 Bank: ${bank.name}
💠 Requested: ${amount}
💸 Bank Fee (10%): ${result.interest}
💠 Received: ${result.withdrawn}
${FRAME}
💳 Bank Balance: ${result.newBalance}
💠 Wallet: ${player.gold}
${FRAME}
⏰ Next withdrawal: 1 hr
${FRAME}`
      }, { quoted: msg });

      // Notify bank owner — serf-only (fix non-serfbot DMs on withdraw interest)
      try {
        let _notifySock2 = null;
        try {
          const SerfManager3 = require('../../rpg/utils/SerfManager');
          const MSM3 = require('../../bots/MultiSocketManager');
          const serf3 = SerfManager3.getSerf(db, bank.owner);
          _notifySock2 = serf3?.botKey ? MSM3.getSocket(serf3.botKey) : null;
        } catch {}
        if (_notifySock2) {
          await _notifySock2.sendMessage(bank.owner, {
            text: `💠 BANK INTEREST!\n\n${player.name} withdrew ${amount}\nYou earned: ${result.interest} gold`
          });
        } else {
          try { console.log(`[BANK] Skipped BANK INTEREST DM to ${bank.owner} — no serf`); } catch {}
        }
      } catch (e) {}

      return;
    }

    // ═══════════════════════════════════════════════════════════════
    // BANK INFO
    // ═══════════════════════════════════════════════════════════════
    if (action === 'info') {
      const bank = BankingSystem.getPlayerBank(db, sender);
      if (!bank) {
        return sock.sendMessage(chatId, {
          text: '❌ You don\'t own a bank!'
        }, { quoted: msg });
      }

      const stats = BankingSystem.getBankStats(bank);
      const daysOld = Math.floor((Date.now() - bank.createdAt) / (24 * 60 * 60 * 1000));

      return sock.sendMessage(chatId, {
        text: `${FRAME}
🏦 BANK DETAILS 🏦
${FRAME}
🏦 Name: ${bank.name}
👑 Owner: ${player.name}
📅 Age: ${daysOld} days
${FRAME}
📊 STATISTICS
${FRAME}
👥 Accounts: ${stats.accounts}
💠 Total Deposits: ${stats.totalDeposits}
📊 Avg Deposit: ${stats.avgDeposit}
💸 Interest Earned: ${stats.interestCollected}
${FRAME}
Use /bank accounts to see customers!
${FRAME}`
      }, { quoted: msg });
    }

    // ═══════════════════════════════════════════════════════════════
    // VIEW ACCOUNTS
    // ═══════════════════════════════════════════════════════════════
    if (action === 'accounts') {
      const bank = BankingSystem.getPlayerBank(db, sender);
      if (!bank) {
        return sock.sendMessage(chatId, {
          text: '❌ You don\'t own a bank!'
        }, { quoted: msg });
      }

      if (!bank.accounts || bank.accounts.length === 0) {
        return sock.sendMessage(chatId, {
          text: '❌ No accounts yet!'
        }, { quoted: msg });
      }

      let list = `${FRAME}
👥 BANK ACCOUNTS 👥
${FRAME}
🏦 ${bank.name}
${FRAME}\n\n`;

      bank.accounts.forEach((acc, i) => {
        list += `${i + 1}. ${acc.userName}\n`;
        list += `   💠 Balance: ${acc.balance}\n`;
        list += `   📊 Total Deposited: ${acc.totalDeposited}\n\n`;
      });

      list += `${FRAME}\n`;
      list += `Total: ${bank.accounts.length} accounts`;

      return sock.sendMessage(chatId, { text: list }, { quoted: msg });
    }

    // ═══════════════════════════════════════════════════════════════
    // LIST ALL BANKS
    // ═══════════════════════════════════════════════════════════════
    if (action === 'list') {
      if (!db.banks || Object.keys(db.banks).length === 0) {
        return sock.sendMessage(chatId, {
          text: '❌ No banks exist yet!\n\nBe the first to create one!\n/bank create [name]'
        }, { quoted: msg });
      }

      let list = `${FRAME}
🏦 ALL BANKS 🏦
${FRAME}\n\n`;

      Object.values(db.banks).forEach((bank, i) => {
        const owner = db.users[bank.owner];
        const stats = BankingSystem.getBankStats(bank);
        
        list += `${i + 1}. 🏦 ${bank.name}\n`;
        list += `   👑 Owner: ${owner?.name || 'Unknown'}\n`;
        list += `   👥 Accounts: ${stats.accounts}\n`;
        list += `   💠 Deposits: ${stats.totalDeposits}\n\n`;
      });

      list += `${FRAME}\n`;
      list += `Join with: /bank register [bank name]`;

      return sock.sendMessage(chatId, { text: list }, { quoted: msg });
    }

    // ═══════════════════════════════════════════════════════════════
    // COLLECT MONTHLY INTEREST
    // ═══════════════════════════════════════════════════════════════
    if (action === 'collect') {
      const bank = BankingSystem.getPlayerBank(db, sender);
      if (!bank) {
        return sock.sendMessage(chatId, {
          text: '❌ You don\'t own a bank!'
        }, { quoted: msg });
      }

      const bankId = Object.keys(db.banks).find(id => db.banks[id] === bank);
      const result = BankingSystem.collectMonthlyInterest(db, bankId);

      if (!result.success) {
        return sock.sendMessage(chatId, {
          text: `❌ Cannot collect yet!\n\n${result.reason}`
        }, { quoted: msg });
      }

      // Give owner the interest
      player.gold = (player.gold || 0) + result.interest;
      if (player.inventory) player.inventory.gold = player.gold;
      
      saveDatabase();

      return sock.sendMessage(chatId, {
        text: `${FRAME}
💠 MONTHLY INTEREST! 💰
${FRAME}
🏦 ${bank.name}
${FRAME}
💸 Interest Collected: ${result.interest}
💠 Your Nexus: ${player.gold}
${FRAME}
📊 Total Interest Earned: ${bank.interestCollected}
${FRAME}
Next collection: 30 days
${FRAME}`
      }, { quoted: msg });
    }

    return sock.sendMessage(chatId, {
      text: '❌ Invalid command!\n\nUse /bank for menu'
    }, { quoted: msg });
  }
};