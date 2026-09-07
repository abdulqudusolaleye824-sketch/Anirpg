// ========================================
// rpg/utils/BarSystem.js - FIXED
// No more negative HP crashes
// ========================================

class BarSystem {
  // ═══════════════════════════════════════════════════════════════
  // PLAYER HP BAR
  // ═══════════════════════════════════════════════════════════════
  static getHPBar(currentHP, maxHP) {
    // Validate inputs
    currentHP = Math.max(0, Math.floor(currentHP || 0));
    maxHP = Math.max(1, Math.floor(maxHP || 1));
    
    // Calculate percentage
    const percentage = Math.min(100, Math.max(0, Math.floor((currentHP / maxHP) * 100)));
    
    // Calculate filled bars (out of 10)
    const filledBars = Math.floor((percentage / 100) * 10);
    const emptyBars = 10 - filledBars;
    
    // Choose color based on HP percentage
    let barEmoji = '🟢'; // Green (100-70%)
    if (percentage < 70 && percentage >= 40) {
      barEmoji = '🟡'; // Yellow (70-40%)
    } else if (percentage < 40 && percentage >= 20) {
      barEmoji = '🟠'; // Orange (40-20%)
    } else if (percentage < 20) {
      barEmoji = '🔴'; // Red (20-0%)
    }
    
    const filled = barEmoji.repeat(Math.max(0, filledBars));
    const empty = '⚪'.repeat(Math.max(0, emptyBars));
    
    return `${filled}${empty} ${percentage}%`;
  }
  
  // ═══════════════════════════════════════════════════════════════
  // ENERGY/MANA BAR
  // ═══════════════════════════════════════════════════════════════
  static getHPStatus(currentHP, maxHP) {
    const percent = maxHP > 0 ? (currentHP / maxHP) * 100 : 0;
    if (percent >= 75) return '💚 Healthy';
    if (percent >= 50) return '💛 Moderate';
    if (percent >= 25) return '🧡 Wounded';
    if (percent > 0)   return '❤️ Critical';
    return '💀 Dead';
  }

  static getEnergyBar(currentEnergy, maxEnergy) {
    // Validate inputs
    currentEnergy = Math.max(0, Math.floor(currentEnergy || 0));
    maxEnergy = Math.max(1, Math.floor(maxEnergy || 1));
    
    // Calculate percentage
    const percentage = Math.min(100, Math.max(0, Math.floor((currentEnergy / maxEnergy) * 100)));
    
    // Calculate filled bars (out of 10)
    const filledBars = Math.floor((percentage / 100) * 10);
    const emptyBars = 10 - filledBars;
    
    const filled = '🔵'.repeat(Math.max(0, filledBars));
    const empty = '⚪'.repeat(Math.max(0, emptyBars));
    
    return `${filled}${empty} ${percentage}%`;
  }
  
  // ═══════════════════════════════════════════════════════════════
  // MONSTER HP BAR
  // ═══════════════════════════════════════════════════════════════
  static getMonsterHPBar(currentHP, maxHP) {
    // Validate inputs - CRITICAL FIX
    currentHP = Math.max(0, Math.floor(currentHP || 0));
    maxHP = Math.max(1, Math.floor(maxHP || 1));
    
    // Ensure currentHP doesn't exceed maxHP
    currentHP = Math.min(currentHP, maxHP);
    
    // Calculate percentage
    const percentage = Math.min(100, Math.max(0, Math.floor((currentHP / maxHP) * 100)));
    
    // Calculate filled bars (out of 10)
    const filledBars = Math.floor((percentage / 100) * 10);
    const emptyBars = 10 - filledBars;
    
    // Validate bar counts (prevent negative repeat)
    const validFilledBars = Math.max(0, Math.min(10, filledBars));
    const validEmptyBars = Math.max(0, Math.min(10, emptyBars));
    
    // Choose color based on HP percentage
    let barEmoji = '🟢'; // Green (100-70%)
    if (percentage < 70 && percentage >= 40) {
      barEmoji = '🟡'; // Yellow (70-40%)
    } else if (percentage < 40 && percentage >= 20) {
      barEmoji = '🟠'; // Orange (40-20%)
    } else if (percentage < 20) {
      barEmoji = '🔴'; // Red (20-0%)
    }
    
    const filled = barEmoji.repeat(validFilledBars);
    const empty = '⚪'.repeat(validEmptyBars);
    
    return `${filled}${empty} ${percentage}%`;
  }
  
  // ═══════════════════════════════════════════════════════════════
  // XP BAR
  // ═══════════════════════════════════════════════════════════════
  static getXPBar(currentXP, xpNeeded) {
    // Validate inputs
    currentXP = Math.max(0, Math.floor(currentXP || 0));
    xpNeeded = Math.max(1, Math.floor(xpNeeded || 1));
    
    // Calculate percentage
    const percentage = Math.min(100, Math.max(0, Math.floor((currentXP / xpNeeded) * 100)));
    
    // Calculate filled bars (out of 10)
    const filledBars = Math.floor((percentage / 100) * 10);
    const emptyBars = 10 - filledBars;
    
    const filled = '⭐'.repeat(Math.max(0, filledBars));
    const empty = '⚪'.repeat(Math.max(0, emptyBars));
    
    return `${filled}${empty} ${percentage}%`;
  }
  
  // ═══════════════════════════════════════════════════════════════
  // BOSS HP BAR (Larger, more dramatic)
  // ═══════════════════════════════════════════════════════════════
  static getBossHPBar(currentHP, maxHP) {
    // Validate inputs - CRITICAL FIX
    currentHP = Math.max(0, Math.floor(currentHP || 0));
    maxHP = Math.max(1, Math.floor(maxHP || 1));
    
    // Ensure currentHP doesn't exceed maxHP
    currentHP = Math.min(currentHP, maxHP);
    
    // Calculate percentage
    const percentage = Math.min(100, Math.max(0, Math.floor((currentHP / maxHP) * 100)));
    
    // Calculate filled bars (out of 20 for bosses)
    const filledBars = Math.floor((percentage / 100) * 20);
    const emptyBars = 20 - filledBars;
    
    // Validate bar counts (prevent negative repeat)
    const validFilledBars = Math.max(0, Math.min(20, filledBars));
    const validEmptyBars = Math.max(0, Math.min(20, emptyBars));
    
    // Choose color based on HP percentage
    let barEmoji = '🟩'; // Green (100-70%)
    if (percentage < 70 && percentage >= 40) {
      barEmoji = '🟨'; // Yellow (70-40%)
    } else if (percentage < 40 && percentage >= 20) {
      barEmoji = '🟧'; // Orange (40-20%)
    } else if (percentage < 20) {
      barEmoji = '🟥'; // Red (20-0%)
    }
    
    const filled = barEmoji.repeat(validFilledBars);
    const empty = '⬜'.repeat(validEmptyBars);
    
    return `${filled}${empty}\n${percentage}% (${currentHP}/${maxHP} HP)`;
  }
  
  // ═══════════════════════════════════════════════════════════════
  // STAMINA BAR (For Warriors/Knights)
  // ═══════════════════════════════════════════════════════════════
  static getStaminaBar(currentStamina, maxStamina) {
    // Validate inputs
    currentStamina = Math.max(0, Math.floor(currentStamina || 0));
    maxStamina = Math.max(1, Math.floor(maxStamina || 1));
    
    // Calculate percentage
    const percentage = Math.min(100, Math.max(0, Math.floor((currentStamina / maxStamina) * 100)));
    
    // Calculate filled bars (out of 10)
    const filledBars = Math.floor((percentage / 100) * 10);
    const emptyBars = 10 - filledBars;
    
    const filled = '🟢'.repeat(Math.max(0, filledBars));
    const empty = '⚪'.repeat(Math.max(0, emptyBars));
    
    return `${filled}${empty} ${percentage}%`;
  }
  
  // ═══════════════════════════════════════════════════════════════
  // MANA BAR (For Mages)
  // ═══════════════════════════════════════════════════════════════
  static getManaBar(currentMana, maxMana) {
    // Validate inputs
    currentMana = Math.max(0, Math.floor(currentMana || 0));
    maxMana = Math.max(1, Math.floor(maxMana || 1));
    
    // Calculate percentage
    const percentage = Math.min(100, Math.max(0, Math.floor((currentMana / maxMana) * 100)));
    
    // Calculate filled bars (out of 10)
    const filledBars = Math.floor((percentage / 100) * 10);
    const emptyBars = 10 - filledBars;
    
    const filled = '🔷'.repeat(Math.max(0, filledBars));
    const empty = '⚪'.repeat(Math.max(0, emptyBars));
    
    return `${filled}${empty} ${percentage}%`;
  }
  
  // ═══════════════════════════════════════════════════════════════
  // SHIELD BAR (For Tanks)
  // ═══════════════════════════════════════════════════════════════
  static getShieldBar(currentShield, maxShield) {
    // Validate inputs
    currentShield = Math.max(0, Math.floor(currentShield || 0));
    maxShield = Math.max(1, Math.floor(maxShield || 1));
    
    // Calculate percentage
    const percentage = Math.min(100, Math.max(0, Math.floor((currentShield / maxShield) * 100)));
    
    // Calculate filled bars (out of 10)
    const filledBars = Math.floor((percentage / 100) * 10);
    const emptyBars = 10 - filledBars;
    
    const filled = '🛡️'.repeat(Math.max(0, filledBars));
    const empty = '⚪'.repeat(Math.max(0, emptyBars));
    
    return `${filled}${empty} ${percentage}%`;
  }
}

module.exports = BarSystem;