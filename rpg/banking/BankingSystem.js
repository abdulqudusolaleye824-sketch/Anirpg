class BankingSystem {
  static BANK_CREATION_REQUIREMENTS = {
    minLevel: 50,
    minGold: 1000,
    creationCost: 50000
  };

  static INTEREST_RATE = 0.10; // 10% monthly interest to bank owner
  static WITHDRAWAL_COOLDOWN = 1 * 60 * 60 * 1000; // 1 hour

  static canCreateBank(player) {
    const { minLevel, minGold } = this.BANK_CREATION_REQUIREMENTS;
    
    if (player.level < minLevel) {
      return { 
        canCreate: false, 
        reason: `Need Level ${minLevel} (You: ${player.level})` 
      };
    }
    
    if ((player.gold || 0) < minGold) {
      return { 
        canCreate: false, 
        reason: `Need ${minGold} gold (You: ${player.gold || 0})` 
      };
    }
    
    return { canCreate: true };
  }

  static createBank(db, ownerId, bankName) {
    if (!db.banks) db.banks = {};
    
    const bankId = `bank_${Date.now()}`;
    
    db.banks[bankId] = {
      id: bankId,
      name: bankName,
      owner: ownerId,
      accounts: [],
      totalDeposits: 0,
      interestCollected: 0,
      lastInterestCollection: Date.now(),
      createdAt: Date.now()
    };
    
    return db.banks[bankId];
  }

  static getPlayerBank(db, playerId) {
    if (!db.banks) return null;
    return Object.values(db.banks).find(b => b.owner === playerId);
  }

  static getAccountBank(db, playerId) {
    if (!db.banks) return null;
    return Object.values(db.banks).find(bank => 
      bank.accounts.some(acc => acc.userId === playerId)
    );
  }

  static openAccount(bank, playerId, playerName, initialDeposit) {
    if (!bank.accounts) bank.accounts = [];
    
    const account = {
      userId: playerId,
      userName: playerName,
      balance: initialDeposit,
      depositedAt: Date.now(),
      lastWithdrawal: 0,
      totalDeposited: initialDeposit,
      totalWithdrawn: 0
    };
    
    bank.accounts.push(account);
    bank.totalDeposits += initialDeposit;
    
    return account;
  }

  static deposit(bank, playerId, amount) {
    const account = bank.accounts.find(a => a.userId === playerId);
    if (!account) return { success: false, reason: 'Account not found' };
    
    account.balance += amount;
    account.totalDeposited += amount;
    bank.totalDeposits += amount;
    
    return { success: true, newBalance: account.balance };
  }

  static withdraw(bank, playerId, amount) {
    const account = bank.accounts.find(a => a.userId === playerId);
    if (!account) return { success: false, reason: 'Account not found' };
    
    if (account.balance < amount) {
      return { success: false, reason: 'Insufficient balance' };
    }
    
    // Check cooldown
    const now = Date.now();
    if (account.lastWithdrawal && (now - account.lastWithdrawal) < this.WITHDRAWAL_COOLDOWN) {
      const timeLeft = this.WITHDRAWAL_COOLDOWN - (now - account.lastWithdrawal);
      const daysLeft = Math.ceil(timeLeft / (24 * 60 * 60 * 1000));
      return { 
        success: false, 
        reason: `Withdrawal cooldown: ${daysLeft} days left` 
      };
    }
    
    // Calculate interest for bank owner (10% of withdrawal)
    const interest = Math.floor(amount * this.INTEREST_RATE);
    const amountAfterInterest = amount - interest;
    
    account.balance -= amount;
    account.totalWithdrawn += amount;
    account.lastWithdrawal = now;
    bank.totalDeposits -= amount;
    bank.interestCollected += interest;
    
    return { 
      success: true, 
      withdrawn: amountAfterInterest,
      interest: interest,
      newBalance: account.balance 
    };
  }

  static collectMonthlyInterest(db, bankId) {
    const bank = db.banks[bankId];
    if (!bank) return { success: false, reason: 'Bank not found' };
    
    const now = Date.now();
    const monthInMs = 30 * 24 * 60 * 60 * 1000;
    
    if (now - bank.lastInterestCollection < monthInMs) {
      const timeLeft = monthInMs - (now - bank.lastInterestCollection);
      const daysLeft = Math.ceil(timeLeft / (24 * 60 * 60 * 1000));
      return { 
        success: false, 
        reason: `Next collection in ${daysLeft} days` 
      };
    }
    
    // Calculate 10% interest on all deposits
    const totalInterest = Math.floor(bank.totalDeposits * this.INTEREST_RATE);
    
    bank.lastInterestCollection = now;
    bank.interestCollected += totalInterest;
    
    return { 
      success: true, 
      interest: totalInterest 
    };
  }

  static getBankStats(bank) {
    return {
      name: bank.name,
      accounts: bank.accounts.length,
      totalDeposits: bank.totalDeposits,
      interestCollected: bank.interestCollected,
      avgDeposit: bank.accounts.length > 0 
        ? Math.floor(bank.totalDeposits / bank.accounts.length) 
        : 0
    };
  }
}

module.exports = BankingSystem;