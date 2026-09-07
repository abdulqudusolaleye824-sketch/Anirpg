const GroupCommandManager = require('../../rpg/utils/GroupCommandManager');
const Perms = require('../../utils/permissions');

module.exports = {
  name: 'groupcmd',
  description: 'Manage commands per group (ADMIN ONLY)',
  
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    // ============================================
    // PERM CHECK (owner / co-owner / mod)
    // ============================================
    if (!Perms.isBotMod(db, sender)) {
      return sock.sendMessage(chatId, { 
        text: '❌ This command is admin-only!' 
      }, { quoted: msg });
    }

    // Only works in groups
    if (!chatId.includes('@g.us')) {
      return sock.sendMessage(chatId, { 
        text: '❌ This command only works in groups!' 
      }, { quoted: msg });
    }

    const action = args[0]?.toLowerCase();

    // ============================================
    // MAIN MENU
    // ============================================
    if (!action) {
      const settings = GroupCommandManager.getGroupSettings(db, chatId);
      
      let menu = `━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚙️ GROUP COMMAND MANAGER ⚙️
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 CURRENT SETTINGS
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔧 Mode: ${settings.mode.toUpperCase()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

      if (settings.mode === 'whitelist') {
        menu += `\n✅ ENABLED COMMANDS (${settings.enabled.length})
━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        if (settings.enabled.length > 0) {
          settings.enabled.forEach(cmd => {
            menu += `✅ /${cmd}\n`;
          });
        } else {
          menu += `⚠️ No commands enabled!\nAll commands are blocked.\n`;
        }
      } else {
        menu += `\n❌ DISABLED COMMANDS (${settings.disabled.length})
━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        if (settings.disabled.length > 0) {
          settings.disabled.forEach(cmd => {
            menu += `❌ /${cmd}\n`;
          });
        } else {
          menu += `✅ All commands enabled!\n`;
        }
      }

      menu += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 MODES
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔓 BLACKLIST (default)
   All commands work except disabled ones
   
🔒 WHITELIST
   Only enabled commands work
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 COMMANDS
━━━━━━━━━━━━━━━━━━━━━━━━━━━
/groupcmd mode [whitelist/blacklist]
   Change mode

/groupcmd enable [command]
   Enable a command (whitelist mode)

/groupcmd disable [command]
   Disable a command (blacklist mode)

/groupcmd list
   List all group settings

/groupcmd reset
   Reset to default (allow all)
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 EXAMPLES
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Make PVP-only group:
1. /groupcmd mode whitelist
2. /groupcmd enable pvp
3. /groupcmd enable stats

Make family-friendly group:
1. /groupcmd disable casino
2. /groupcmd disable steal
━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

      return sock.sendMessage(chatId, { text: menu }, { quoted: msg });
    }

    // ============================================
    // SET MODE
    // ============================================
    if (action === 'mode') {
      const mode = args[1]?.toLowerCase();
      
      if (!mode || !['whitelist', 'blacklist'].includes(mode)) {
        return sock.sendMessage(chatId, {
          text: '❌ Invalid mode!\n\nUse: /groupcmd mode whitelist\nor: /groupcmd mode blacklist'
        }, { quoted: msg });
      }

      const result = GroupCommandManager.setGroupMode(db, chatId, mode);
      
      if (!result.success) {
        return sock.sendMessage(chatId, {
          text: `❌ ${result.reason}`
        }, { quoted: msg });
      }

      saveDatabase();

      let response = `━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ MODE CHANGED! ✅
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔧 Mode: ${mode.toUpperCase()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

      if (mode === 'whitelist') {
        response += `\n🔒 WHITELIST MODE ACTIVE
━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ Only enabled commands will work!

Current status:
- All commands are now BLOCKED
- Use /groupcmd enable [command] to allow specific commands

Example:
/groupcmd enable pvp
/groupcmd enable casino
━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
      } else {
        response += `\n🔓 BLACKLIST MODE ACTIVE
━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ All commands work by default!

Current status:
- All commands are now ENABLED
- Use /groupcmd disable [command] to block specific commands

Example:
/groupcmd disable casino
/groupcmd disable steal
━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
      }

      return sock.sendMessage(chatId, { text: response }, { quoted: msg });
    }

    // ============================================
    // ENABLE COMMAND
    // ============================================
    if (action === 'enable') {
      const commandName = args[1]?.toLowerCase();
      
      if (!commandName) {
        return sock.sendMessage(chatId, {
          text: '❌ Specify command name!\n\nExample: /groupcmd enable pvp'
        }, { quoted: msg });
      }

      GroupCommandManager.enableCommand(db, chatId, commandName);
      saveDatabase();

      return sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ COMMAND ENABLED! ✅
━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ /${commandName}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
This command now works in this group!
━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      }, { quoted: msg });
    }

    // ============================================
    // DISABLE COMMAND
    // ============================================
    if (action === 'disable') {
      const commandName = args[1]?.toLowerCase();
      
      if (!commandName) {
        return sock.sendMessage(chatId, {
          text: '❌ Specify command name!\n\nExample: /groupcmd disable casino'
        }, { quoted: msg });
      }

      GroupCommandManager.disableCommand(db, chatId, commandName);
      saveDatabase();

      return sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ COMMAND DISABLED! ✅
━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ /${commandName}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
This command is now blocked in this group!

💡 Users can still use it in:
- Other groups
- Private messages (DM)
━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      }, { quoted: msg });
    }

    // ============================================
    // LIST ALL GROUP SETTINGS
    // ============================================
    if (action === 'list') {
      const allGroups = GroupCommandManager.getAllGroupSettings(db);
      
      if (allGroups.length === 0) {
        return sock.sendMessage(chatId, {
          text: '📊 No custom group settings!\n\nAll groups use default settings (all commands enabled).'
        }, { quoted: msg });
      }

      let list = `━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 ALL GROUP SETTINGS 📊
━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

      for (const group of allGroups) {
        const isCurrentGroup = group.groupId === chatId;
        list += `${isCurrentGroup ? '📍 ' : ''}Group: ${group.groupId.split('@')[0]}\n`;
        list += `🔧 Mode: ${group.mode}\n`;
        
        if (group.mode === 'whitelist') {
          list += `✅ Enabled: ${group.enabled.length} commands\n`;
        } else {
          list += `❌ Disabled: ${group.disabled.length} commands\n`;
        }
        list += `\n`;
      }

      list += `━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

      return sock.sendMessage(chatId, { text: list }, { quoted: msg });
    }

    // ============================================
    // RESET GROUP
    // ============================================
    if (action === 'reset') {
      GroupCommandManager.resetGroup(db, chatId);
      saveDatabase();

      return sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ SETTINGS RESET! ✅
━━━━━━━━━━━━━━━━━━━━━━━━━━━
All commands are now enabled in this group!

Group returned to default settings.
━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      }, { quoted: msg });
    }

    return sock.sendMessage(chatId, {
      text: '❌ Invalid option!\n\nUse /groupcmd to see menu.'
    }, { quoted: msg });
  }
};