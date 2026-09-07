/**
 * /hakai @player
 * Erases ALL data for the target player across every database.
 * Only usable by the bot owner and 194592469209292@lid.
 * Both of those users are immune to /hakai.
 */

const fs   = require('fs');
const path = require('path');

const BOT_OWNER = '221951679328499@lid';
const ALLOWED   = [BOT_OWNER, '194592469209292@lid'];

module.exports = {
  name: 'hakai',
  description: '💀 Erase all data for a player across every database (owner only)',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;

    // ── Permission check ──────────────────────────────────────────────────────
    if (!ALLOWED.includes(sender)) {
      return sock.sendMessage(chatId, {
        text: '❌ You do not have permission to use this command.'
      }, { quoted: msg });
    }

    // ── Get target ────────────────────────────────────────────────────────────
    const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

    // No tag = self-hakai: wipe the caller's own data (owner/co-owner only)
    if (!mentions.length) {
      if (!ALLOWED.includes(sender) && !ALLOWED.map(a => a.split('@')[0]).includes(sender.split('@')[0])) {
        return sock.sendMessage(chatId, {
          text: '❌ You do not have permission to use this command.'
        }, { quoted: msg });
      }
      const db2 = getDatabase();
      if (!db2.users?.[sender]) {
        return sock.sendMessage(chatId, {
          text: '❌ You are not registered.'
        }, { quoted: msg });
      }
      const selfName = db2.users[sender].name || sender.split('@')[0];

      // Wipe from main db
      delete db2.users[sender];
      if (db2.guilds) {
        for (const gId in db2.guilds) {
          const g = db2.guilds[gId];
          if (g.leader === sender) { delete db2.guilds[gId]; continue; }
          if (g.members)  Ne.members = g.members.filter(m => m !== sender);
        }
      }
      if (db2.bannedUsers)    delete db2.bannedUsers[sender];
      if (db2.mutedUsers)     delete db2.mutedUsers[sender];
      if (db2.afkUsers)       delete db2.afkUsers[sender];
      if (db2.userCooldowns) {
        for (const k of Object.keys(db2.userCooldowns)) {
          if (k.includes(sender)) delete db2.userCooldowns[k];
        }
      }
      if (db2.dailyQuests)    delete db2.dailyQuests[sender];
      if (db2.pendingTrades) {
        for (const k of Object.keys(db2.pendingTrades)) {
          if (k.includes(sender)) delete db2.pendingTrades[k];
        }
      }
      saveDatabase();

      // Wipe from side databases
      const dataDir = require('path').join(__dirname, '../../rpg/data');
      ['achievements.json', 'playerPets.json', 'playerQuests.json'].forEach(file => {
        const fp = require('path').join(dataDir, file);
        try {
          if (require('fs').existsSync(fp)) {
            const data = JSON.parse(require('fs').readFileSync(fp, 'utf-8'));
            delete data[sender];
            require('fs').writeFileSync(fp, JSON.stringify(data, null, 2), 'utf-8');
          }
        } catch (e) { console.error('Self-hakai side db error:', file, e.message); }
      });

      return sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `💀 HAKAI — SELF ERASURE\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `All data for *${selfName}* has been erased.\n` +
              `Use /register to start over.\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      }, { quoted: msg });
    }

    const targetId = mentions[0];

    // ── Immunity: owner and co-owner cannot be hakai'd ────────────────────────
    if (ALLOWED.includes(targetId)) {
      return sock.sendMessage(chatId, {
        text: `❌ That player is immune to /hakai.`
      }, { quoted: msg });
    }

    const db = getDatabase();

    // Check if target exists at all
    const targetName = db.users?.[targetId]?.name || targetId.split('@')[0];

    // ── 1. Main database ──────────────────────────────────────────────────────
    let wipedMain = false;
    if (db.users?.[targetId]) {
      delete db.users[targetId];
      wipedMain = true;
    }

    // Also scrub from guilds
    if (db.guilds) {
      for (const guildId of Object.keys(db.guilds)) {
        const guild = db.guilds[guildId];
        if (guild.leader === targetId) {
          delete db.guilds[guildId];
        } else if (guild.members) {
          guild.members = guild.members.filter(m => m.id !== targetId);
        }
      }
    }

    // Scrub from ban/mute/afk lists
    if (db.bannedUsers)   delete db.bannedUsers[targetId];
    if (db.mutedUsers)    delete db.mutedUsers[targetId];
    if (db.afkUsers)      delete db.afkUsers[targetId];
    if (db.userCooldowns) {
      for (const key of Object.keys(db.userCooldowns)) {
        if (key.includes(targetId)) delete db.userCooldowns[key];
      }
    }

    saveDatabase();

    // ── 2. Side JSON databases ────────────────────────────────────────────────
    const DATA_DIR = path.join(__dirname, '../../rpg/data');
    const sideFiles = ['playerPets.json', 'playerQuests.json', 'achievements.json'];
    const wipedFiles = [];

    for (const fname of sideFiles) {
      const fp = path.join(DATA_DIR, fname);
      if (!fs.existsSync(fp)) continue;
      try {
        const raw = JSON.parse(fs.readFileSync(fp, 'utf8'));
        if (raw[targetId]) {
          delete raw[targetId];
          fs.writeFileSync(fp, JSON.stringify(raw, null, 2));
          wipedFiles.push(fname.replace('.json', ''));
        }
      } catch (e) {
        console.error(`Hakai: failed to wipe ${fname}:`, e.message);
      }
    }

    // ── Response ──────────────────────────────────────────────────────────────
    let text = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `💀 HAKAI EXECUTED\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `👤 Target: ${targetName}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `🗑️ Main database: ${wipedMain ? '✅ wiped' : '⚠️ not found'}\n`;

    if (wipedFiles.length) {
      for (const f of wipedFiles) text += `🗑️ ${f}: ✅ wiped\n`;
    }

    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `💀 ${targetName} has been erased from existence.`;

    return sock.sendMessage(chatId, {
      text,
      mentions: [targetId]
    }, { quoted: msg });
  }
};