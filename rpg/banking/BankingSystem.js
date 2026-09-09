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
        reason: `Need ${minGold} Nexus (You: ${player.gold || 0})` 
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

  static openAccount(bank, playerId, playerName, initialDeposit, initialMana=0) {
    if (!bank.accounts) bank.accounts = [];
    
    const account = {
      userId: playerId,
      userName: playerName,
      balance: initialDeposit,
      balanceMana: initialMana,
      depositedAt: Date.now(),
      lastWithdrawal: 0,
      lastWithdrawalMana: 0,
      totalDeposited: initialDeposit,
      totalDepositedMana: initialMana,
      totalWithdrawn: 0,
      totalWithdrawnMana: 0
    };
    
    bank.accounts.push(account);
    bank.totalDeposits += initialDeposit;
    
    return account;
  }

  static deposit(bank, playerId, amount, currency='nexus') {
    const account = bank.accounts.find(a => a.userId === playerId);
    if (!account) return { success: false, reason: 'Account not found' };
    if (currency==='mana' || currency==='manastones' || currency==='ms' || currency==='crystals') {
      if (account.balanceMana==null) account.balanceMana=0;
      if (account.totalDepositedMana==null) account.totalDepositedMana=0;
      account.balanceMana += amount;
      account.totalDepositedMana += amount;
      if (bank.totalDepositsMana==null) bank.totalDepositsMana=0;
      bank.totalDepositsMana += amount;
      return { success: true, newBalance: account.balanceMana, currency:'mana' };
    }
    account.balance += amount;
    account.totalDeposited += amount;
    bank.totalDeposits += amount;
    return { success: true, newBalance: account.balance, currency:'nexus' };
  }

  static withdraw(bank, playerId, amount, player = null, currency='nexus') {
    const account = bank.accounts.find(a => a.userId === playerId);
    if (!account) return { success: false, reason: 'Account not found' };
    const isMana = (currency==='mana' || currency==='manastones' || currency==='ms' || currency==='crystals');
    if (isMana) {
      if (account.balanceMana==null) account.balanceMana=0;
      if (account.balanceMana < amount) return { success: false, reason: 'Insufficient Mana Stones balance' };
      const nowM = Date.now();
      const isProM = player && (player.isPro || player.proStatus) && player.proExpiresAt && player.proExpiresAt > nowM;
      const effCdM = isProM ? (30 * 60 * 1000) : this.WITHDRAWAL_COOLDOWN;
      if (account.lastWithdrawalMana && (nowM - account.lastWithdrawalMana) < effCdM) {
        const timeLeft = effCdM - (nowM - account.lastWithdrawalMana);
        const minsLeft = Math.ceil(timeLeft / (60 * 1000));
        return { success: false, reason: `Mana withdrawal cooldown: ${minsLeft} minute(s) left${isProM ? ' (🌟 PRO 50% Reduced Cooldown)' : ''}` };
      }
      const interestM = Math.floor(amount * this.INTEREST_RATE);
      const afterM = amount - interestM;
      account.balanceMana -= amount;
      if (account.totalWithdrawnMana==null) account.totalWithdrawnMana=0;
      account.totalWithdrawnMana += amount;
      account.lastWithdrawalMana = nowM;
      if (bank.totalDepositsMana==null) bank.totalDepositsMana=0;
      bank.totalDepositsMana -= amount;
      if (bank.interestCollectedMana==null) bank.interestCollectedMana=0;
      bank.interestCollectedMana += interestM;
      return { success: true, withdrawn: afterM, interest: interestM, newBalance: account.balanceMana, currency:'mana' };
    }
    if (account.balance < amount) {
      return { success: false, reason: 'Insufficient balance' };
    }
    const now = Date.now();
    const isPro = player && (player.isPro || player.proStatus) && player.proExpiresAt && player.proExpiresAt > now;
    const effectiveCooldown = isPro ? (30 * 60 * 1000) : this.WITHDRAWAL_COOLDOWN;
    if (account.lastWithdrawal && (now - account.lastWithdrawal) < effectiveCooldown) {
      const timeLeft = effectiveCooldown - (now - account.lastWithdrawal);
      const minsLeft = Math.ceil(timeLeft / (60 * 1000));
      return { success: false, reason: `Withdrawal cooldown: ${minsLeft} minute(s) left${isPro ? ' (🌟 PRO 50% Reduced Cooldown)' : ''}` };
    }
    const interest = Math.floor(amount * this.INTEREST_RATE);
    const amountAfterInterest = amount - interest;
    account.balance -= amount;
    account.totalWithdrawn += amount;
    account.lastWithdrawal = now;
    bank.totalDeposits -= amount;
    bank.interestCollected += interest;
    return { success: true, withdrawn: amountAfterInterest, interest: interest, newBalance: account.balance, currency:'nexus' };
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
      totalDepositsMana: bank.totalDepositsMana||0,
      interestCollected: bank.interestCollected,
      interestCollectedMana: bank.interestCollectedMana||0,
      avgDeposit: bank.accounts.length > 0 
        ? Math.floor(bank.totalDeposits / bank.accounts.length) 
        : 0,
      avgDepositMana: bank.accounts.length > 0 && bank.totalDepositsMana
        ? Math.floor((bank.totalDepositsMana||0) / bank.accounts.length)
        : 0
    };
  }
}

module.exports = BankingSystem;