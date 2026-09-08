// ═══════════════════════════════════════════════════════════════
// /reset — Mod-level Player Data Wipe with 48-hr Reversal Gate
//
// Usage: /reset @user (or reply to a user's message)
// Restore: /reset restore @user
//
// Rules:
// 1. Mod-level command (Perms.isBotMod).
// 2. Instantly wipes targeted user data.
// 3. Requires target (tag or reply). Fails if no target specified.
// 4. Stores 48-hr reversal backup for restoration if needed.
// 5. Weekly cooldown per mod (7 days).
// ═══════════════════════════════════════════════════════════════

'use strict';

const Perms = require('../../utils/permissions');
const fs = require('fs');
const path = require('path');

const WEEKLY_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const REVERSAL_WINDOW_MS = 48 * 60 * 60 * 1000;     // 48 hours

function formatRemaining(ms) {
  const mins = Math.ceil(ms / 60000);
  const days = Math.floor(mins / 1440);
  const hrs  = Math.floor((mins % 1440) / 60);
  const rMins = mins % 60;
  return `${days}d ${hrs}h ${rMins}m`;
}

module.exports = {
  name: 'reset',
  description: '☠️ [Mod] Instantly wipe targeted user data (with 48-hr reversal & weekly mod cooldown)',
  usage: '/reset @user',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    // 1. Mod / Owner check
    if (!Perms.isBotMod(db, sender)) {
      return sock.sendMessage(chatId, {
        text: '❌ Only bot mods and owners can use /reset.'
      }, { quoted: msg });
    }

    const action = args[0]?.toLowerCase();

    // 2. Resolve Target (mention or quoted participant)
    const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
    const mentionedJid = contextInfo?.mentionedJid?.[0];
    const quotedParticipant = contextInfo?.participant;
    let targetJid = mentionedJid || quotedParticipant;

    // Handle /reset restore @user
    if (action === 'restore') {
      if (!targetJid && args[1]) {
        const rawMention = args[1].replace(/[@\s]/g, '');
        if (rawMention) targetJid = `${rawMention}@s.whatsapp.net`;
      }

      if (!targetJid) {
        return sock.sendMessage(chatId, {
          text: '❌ Tag a user (@user) or reply to their message to restore their data.'
        }, { quoted: msg });
      }

      if (!db.userResetBackups || !db.userResetBackups[targetJid]) {
        return sock.sendMessage(chatId, {
          text: `❌ No active 48-hour backup found for *@${targetJid.split('@')[0]}*.`
        }, { quoted: msg });
      }

      const backup = db.userResetBackups[targetJid];
      if (Date.now() > backup.expiresAt) {
        delete db.userResetBackups[targetJid];
        saveDatabase();
        return sock.sendMessage(chatId, {
          text: `❌ The 48-hour reversal window for *@${targetJid.split('@')[0]}* has expired.`
        }, { quoted: msg });
      }

      // Restore user data
      db.users[targetJid] = backup.data;
      delete db.userResetBackups[targetJid];
      saveDatabase();

      return sock.sendMessage(chatId, {
        text: [
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `🔄 *PLAYER DATA RESTORED*`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `👤 Player: *@${targetJid.split('@')[0]}*`,
          `🛡️ Restored By: *@${sender.split('@')[0]}*`,
          ``,
          `Player profile and stats have been fully restored from backup!`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ].join('\n'),
        mentions: [targetJid, sender],
      }, { quoted: msg });
    }

    // Parse target for wipe
    if (!targetJid && args[0]) {
      const rawMention = args[0].replace(/[@\s]/g, '');
      if (rawMention && rawMention.match(/^\d+$/)) {
        targetJid = `${rawMention}@s.whatsapp.net`;
      }
    }

    // Requirement: If no one is mentioned/replied to, the reset MUST fail!
    if (!targetJid) {
      return sock.sendMessage(chatId, {
        text: '❌ Tag a user (@user) or reply to their message to reset them.'
      }, { quoted: msg });
    }

    // 3. Weekly Mod Cooldown Check
    if (!db.modResetCooldowns) db.modResetCooldowns = {};
    const lastUsed = db.modResetCooldowns[sender] || 0;
    const elapsed = Date.now() - lastUsed;

    if (elapsed < WEEKLY_COOLDOWN_MS) {
      const remaining = WEEKLY_COOLDOWN_MS - elapsed;
      return sock.sendMessage(chatId, {
        text: `⏳ *Mod /reset Cooldown Active*\n\nYour weekly /reset cooldown has *${formatRemaining(remaining)}* remaining.`
      }, { quoted: msg });
    }

    // 4. Target User Data Check
    const targetUser = db.users?.[targetJid];
    if (!targetUser) {
      return sock.sendMessage(chatId, {
        text: `❌ User *@${targetJid.split('@')[0]}* has no registered data.`,
        mentions: [targetJid]
      }, { quoted: msg });
    }

    // 5. Create 48-hr Reversal Backup
    if (!db.userResetBackups) db.userResetBackups = {};
    db.userResetBackups[targetJid] = {
      data: JSON.parse(JSON.stringify(targetUser)),
      resetAt: Date.now(),
      expiresAt: Date.now() + REVERSAL_WINDOW_MS,
      resetBy: sender,
    };

    // 6. Wipe Target Data
    delete db.users[targetJid];

    // Wipe side JSON files (pets, quests, achievements)
    try {
      const dataDir = path.join(__dirname, '..', '..', 'rpg', 'data');
      for (const fname of ['playerPets.json', 'playerQuests.json', 'achievements.json']) {
        const fp = path.join(dataDir, fname);
        if (fs.existsSync(fp)) {
          const raw = JSON.parse(fs.readFileSync(fp, 'utf8'));
          if (raw[targetJid]) {
            delete raw[targetJid];
            fs.writeFileSync(fp, JSON.stringify(raw, null, 2));
          }
        }
      }
    } catch (err) {
      console.error('Error cleaning side JSON files during /reset:', err.message);
    }

    // 7. Update Mod Cooldown & Save
    db.modResetCooldowns[sender] = Date.now();
    saveDatabase();

    return sock.sendMessage(chatId, {
      text: [
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `☠️ *PLAYER DATA RESET*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `👤 Target: *@${targetJid.split('@')[0]}*`,
        `🛡️ Reset By: *@${sender.split('@')[0]}*`,
        `⏰ Reversal Window: *48 Hours*`,
        ``,
        `All data for *@${targetJid.split('@')[0]}* has been wiped.`,
        `*(Restore within 48h using \`/reset restore @user\`)*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ].join('\n'),
      mentions: [targetJid, sender],
    }, { quoted: msg });
  }
};
