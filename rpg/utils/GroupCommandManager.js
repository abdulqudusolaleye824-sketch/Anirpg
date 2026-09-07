// ═══════════════════════════════════════════════════════════════
// GROUP COMMAND MANAGER
// Control which commands work in which groups
// ═══════════════════════════════════════════════════════════════

class GroupCommandManager {
  
  // Initialize group command settings in database
  static initialize(db) {
    if (!db.groupCommands) {
      db.groupCommands = {
        // groupId: { enabled: ['command1', 'command2'], disabled: ['command3'] }
      };
    }
    if (!db.groupSettings) {
      db.groupSettings = {
        // groupId: { mode: 'whitelist' | 'blacklist' }
      };
    }
  }

  // Check if a command is allowed in a group
  static isCommandAllowed(db, groupId, commandName) {
    this.initialize(db);

    // DM/Private chats - allow all commands
    if (!groupId.includes('@g.us')) {
      return { allowed: true };
    }

    const groupCommands = db.groupCommands[groupId];
    const groupSettings = db.groupSettings[groupId];

    // No settings = allow all commands (default)
    if (!groupCommands && !groupSettings) {
      return { allowed: true };
    }

    const mode = groupSettings?.mode || 'blacklist'; // Default: blacklist mode

    // WHITELIST MODE: Only allowed commands work
    if (mode === 'whitelist') {
      const enabledCommands = groupCommands?.enabled || [];
      if (enabledCommands.includes(commandName)) {
        return { allowed: true };
      }
      return { 
        allowed: false, 
        reason: `❌ Command /${commandName} is not enabled in this group!\n\nUse /cmdlist to see available commands.`
      };
    }

    // BLACKLIST MODE: All commands work except disabled ones
    if (mode === 'blacklist') {
      const disabledCommands = groupCommands?.disabled || [];
      if (disabledCommands.includes(commandName)) {
        return { 
          allowed: false, 
          reason: `❌ Command /${commandName} is disabled in this group!\n\n💡 Tip: This command works in other groups or DMs.`
        };
      }
      return { allowed: true };
    }

    return { allowed: true };
  }

  // Enable a command in a group (whitelist mode)
  static enableCommand(db, groupId, commandName) {
    this.initialize(db);
    
    if (!db.groupCommands[groupId]) {
      db.groupCommands[groupId] = { enabled: [], disabled: [] };
    }

    const commands = db.groupCommands[groupId];
    
    // Add to enabled list
    if (!commands.enabled.includes(commandName)) {
      commands.enabled.push(commandName);
    }
    
    // Remove from disabled list if present
    commands.disabled = commands.disabled.filter(cmd => cmd !== commandName);
    
    return true;
  }

  // Disable a command in a group (blacklist mode)
  static disableCommand(db, groupId, commandName) {
    this.initialize(db);
    
    if (!db.groupCommands[groupId]) {
      db.groupCommands[groupId] = { enabled: [], disabled: [] };
    }

    const commands = db.groupCommands[groupId];
    
    // Add to disabled list
    if (!commands.disabled.includes(commandName)) {
      commands.disabled.push(commandName);
    }
    
    // Remove from enabled list if present
    commands.enabled = commands.enabled.filter(cmd => cmd !== commandName);
    
    return true;
  }

  // Set group mode (whitelist or blacklist)
  static setGroupMode(db, groupId, mode) {
    this.initialize(db);
    
    if (!['whitelist', 'blacklist'].includes(mode)) {
      return { success: false, reason: 'Invalid mode! Use "whitelist" or "blacklist"' };
    }

    if (!db.groupSettings[groupId]) {
      db.groupSettings[groupId] = {};
    }

    db.groupSettings[groupId].mode = mode;
    return { success: true };
  }

  // Get group command settings
  static getGroupSettings(db, groupId) {
    this.initialize(db);
    
    const mode = db.groupSettings[groupId]?.mode || 'blacklist';
    const enabled = db.groupCommands[groupId]?.enabled || [];
    const disabled = db.groupCommands[groupId]?.disabled || [];

    return { mode, enabled, disabled };
  }

  // Reset group settings (allow all commands)
  static resetGroup(db, groupId) {
    this.initialize(db);
    
    delete db.groupCommands[groupId];
    delete db.groupSettings[groupId];
    
    return true;
  }

  // List all groups with custom settings
  static getAllGroupSettings(db) {
    this.initialize(db);
    
    const groups = [];
    
    for (const groupId in db.groupSettings) {
      const settings = this.getGroupSettings(db, groupId);
      groups.push({ groupId, ...settings });
    }
    
    return groups;
  }
}

module.exports = GroupCommandManager;