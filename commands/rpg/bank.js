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

    const action = args[0]?.toLowerCase();

    // ═══════════════════════════════════════════════════════════════
    // MAIN MENU
    // ═══════════════════════════════════════════════════════════════
    if (!action) {
      const ownedBank = BankingSystem.getPlayerBank(db, sender);
      const accountBank = BankingSystem.getAccountBank(db, sender);
      
      let menu = `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏦 BANKING SYSTEM 🏦
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💠 Your Nexus: ${player.gold || 0}
━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

      if (ownedBank) {
        const stats = BankingSystem.getBankStats(ownedBank);
        menu += `\n🏦 YOUR BANK: ${ownedBank.name}
👥 Accounts: ${stats.accounts}
💠 Total Deposits: ${stats.totalDeposits}
💸 Interest Earned: ${stats.interestCollected}
━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      }

      if (accountBank) {
        const account = accountBank.accounts.find(a => a.userId === sender);
        menu += `\n💳 YOUR ACCOUNT
🏦 Bank: ${accountBank.name}
💠 Balance: ${account.balance}
━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      }

      menu += `\n📌 COMMANDS
━━━━━━━━━━━━━━━━━━━━━━━━━━━
${!ownedBank ? '🏦 /bank create [name] - Create bank\n   Requirements: Level 50 OR 20k Nexus\n   Cost: 10,000 Nexus\n\n' : ''}${!accountBank ? '💳 /bank register [bank] - Open account\n\n' : ''}`;

      if (accountBank) {
        menu += `💠 /bank deposit [amount] - Deposit Nexus
💸 /bank withdraw [amount] - Withdraw
   (10% fee to bank owner)
   (1 hr cooldown)
\n`;
      }

      if (ownedBank) {
        menu += `📊 /bank info - Bank details
👥 /bank accounts - View accounts
💠 /bank collect - Collect monthly interest
\n`;
      }

      menu += `🏦 /bank list - View all banks
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 HOW IT WORKS
━━━━━━━━━━━━━━━━━━━━━━━━━━━
1️⃣ High level players create banks
2️⃣ Other players deposit Nexus safely
3️⃣ Bank owner earns 10% on withdrawals
4️⃣ Everyone's Nexus is protected!
━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

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
        if (player.inventory) player.inventory.gold = player.gold;
      }

      // Create bank
      const bank = BankingSystem.createBank(db, sender, bankName);
      saveDatabase();

      // Announce in group
      await sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏦 NEW BANK OPENED! 🏦
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏦 Bank: ${bankName}
👑 Owner: ${player.name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💠 BENEFITS
━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Safe Nexus storage
✅ Protected from theft
✅ 10% interest to bank owner
✅ 1 hr withdrawal system
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 TO JOIN
/bank register ${bankName}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
@everyone - Secure your Nexus now!
━━━━━━━━━━━━━━━━━━━━━━━━━━━`
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
        if (player.inventory) player.inventory.gold = 0;
      }

      // Create account
      BankingSystem.openAccount(bank, sender, player.name, initialDeposit);
      saveDatabase();

      await sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ ACCOUNT OPENED! ✅
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏦 Bank: ${bank.name}
💠 Initial Deposit: ${initialDeposit}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 YOUR GOLD IS NOW SAFE!
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 IMPORTANT
- Bank owner earns 10% on withdrawals
- 1 hr cooldown between withdrawals
- All earnings auto-deposit to bank
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Use /bank deposit to add more!
━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      }, { quoted: msg });

      // Notify bank owner
      try {
        await sock.sendMessage(bank.owner, {
          text: `🏦 NEW ACCOUNT!\n\n${player.name} joined ${bank.name}\nDeposit: ${initialDeposit} gold`
        });
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
      
      // ✅ FIX: Validate amount first
      if (!amount || amount < 1) {
        return sock.sendMessage(chatId, {
          text: '❌ Invalid amount!\n\nExample: /bank deposit 1000'
        }, { quoted: msg });
      }

      // ✅ FIX: Check if player has enough Nexus BEFORE depositing
      if ((player.gold || 0) < amount) {
        return sock.sendMessage(chatId, {
          text: `❌ Not enough Nexus!\n\nHave: ${player.gold || 0}\nNeed: ${amount}`
        }, { quoted: msg });
      }

      // ✅ FIX: Deduct Nexus FIRST, then deposit
      player.gold -= amount;
      if (player.gold < 0) player.gold = 0; // Safety check
      if (player.inventory) player.inventory.gold = player.gold;

      const result = BankingSystem.deposit(bank, sender, amount);
      saveDatabase();

      return sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ DEPOSIT SUCCESS! ✅
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏦 Bank: ${bank.name}
💠 Deposited: ${amount}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💳 Bank Balance: ${result.newBalance}
💠 Wallet: ${player.gold}
━━━━━━━━━━━━━━━━━━━━━━━━━━━`
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
      if (!amount || amount < 1) {
        return sock.sendMessage(chatId, {
          text: '❌ Invalid amount!\n\nExample: /bank withdraw 1000'
        }, { quoted: msg });
      }

      const result = BankingSystem.withdraw(bank, sender, amount, player);
      
      if (!result.success) {
        return sock.sendMessage(chatId, {
          text: `❌ Withdrawal failed!\n\n${result.reason}`
        }, { quoted: msg });
      }

      // Give player the Nexus (after 10% fee)
      player.gold = (player.gold || 0) + result.withdrawn;
      if (player.inventory) player.inventory.gold = player.gold;

      // Give bank owner the interest
      const owner = db.users[bank.owner];
      if (owner) {
        owner.gold = (owner.gold || 0) + result.interest;
        if (owner.inventory) owner.inventory.gold = owner.gold;
      }

      saveDatabase();

      await sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ WITHDRAWAL SUCCESS! ✅
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏦 Bank: ${bank.name}
💠 Requested: ${amount}
💸 Bank Fee (10%): ${result.interest}
💠 Received: ${result.withdrawn}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💳 Bank Balance: ${result.newBalance}
💠 Wallet: ${player.gold}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏰ Next withdrawal: 1 hr
━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      }, { quoted: msg });

      // Notify bank owner
      try {
        await sock.sendMessage(bank.owner, {
          text: `💠 BANK INTEREST!\n\n${player.name} withdrew ${amount}\nYou earned: ${result.interest} gold`
        });
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
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏦 BANK DETAILS 🏦
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏦 Name: ${bank.name}
👑 Owner: ${player.name}
📅 Age: ${daysOld} days
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 STATISTICS
━━━━━━━━━━━━━━━━━━━━━━━━━━━
👥 Accounts: ${stats.accounts}
💠 Total Deposits: ${stats.totalDeposits}
📊 Avg Deposit: ${stats.avgDeposit}
💸 Interest Earned: ${stats.interestCollected}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Use /bank accounts to see customers!
━━━━━━━━━━━━━━━━━━━━━━━━━━━`
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

      let list = `━━━━━━━━━━━━━━━━━━━━━━━━━━━
👥 BANK ACCOUNTS 👥
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏦 ${bank.name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

      bank.accounts.forEach((acc, i) => {
        list += `${i + 1}. ${acc.userName}\n`;
        list += `   💠 Balance: ${acc.balance}\n`;
        list += `   📊 Total Deposited: ${acc.totalDeposited}\n\n`;
      });

      list += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
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

      let list = `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏦 ALL BANKS 🏦
━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

      Object.values(db.banks).forEach((bank, i) => {
        const owner = db.users[bank.owner];
        const stats = BankingSystem.getBankStats(bank);
        
        list += `${i + 1}. 🏦 ${bank.name}\n`;
        list += `   👑 Owner: ${owner?.name || 'Unknown'}\n`;
        list += `   👥 Accounts: ${stats.accounts}\n`;
        list += `   💠 Deposits: ${stats.totalDeposits}\n\n`;
      });

      list += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
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
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
💠 MONTHLY INTEREST! 💰
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏦 ${bank.name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💸 Interest Collected: ${result.interest}
💠 Your Nexus: ${player.gold}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Total Interest Earned: ${bank.interestCollected}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Next collection: 30 days
━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      }, { quoted: msg });
    }

    return sock.sendMessage(chatId, {
      text: '❌ Invalid command!\n\nUse /bank for menu'
    }, { quoted: msg });
  }
};