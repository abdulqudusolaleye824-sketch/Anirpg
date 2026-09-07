/**
 * ╔══════════════════════════════════════════════════════╗
 * ║           Astra — /status                           ║
 * ║  Full bot health & system report (owner/co-owner)    ║
 * ╚══════════════════════════════════════════════════════╝
 */

'use strict';

const PersonalityManager = require('../../bots/PersonalityManager');

function isPrivileged(sender, db) {
  const owner   = process.env.OWNER_JID   || '221951679328499@lid';
  const coOwner = process.env.COOWNER_JID || (db.config?.coOwnerNumber || '');
  return sender === owner || sender === coOwner || (db.botMods || []).includes(sender);
}

function uptime() {
  const s = Math.floor(process.uptime());
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${d}d ${h}h ${m}m ${sec}s`;
}

function mb(bytes) {
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

module.exports = {
  name:        'status',
  aliases:     ['botstatus', 'report'],
  description: 'Full bot health & system report',
  usage:       '/status',
  category:    'admin',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db     = getDatabase();

    if (!isPrivileged(sender, db)) {
      return sock.sendMessage(chatId, {
        text: '❌ Only the owner or co-owner can view status reports.',
      }, { quoted: msg });
    }

    const mem    = process.memoryUsage();
    const users  = Object.keys(db.users || {}).length;
    const guilds = Object.keys(db.guilds || {}).length;
    const banned = Object.keys(db.bannedUsers || {}).length;
    const active24 = Object.values(db.users || {}).filter(
      u => u.lastActive && Date.now() - u.lastActive < 86_400_000
    ).length;

    // Bot personality state
    const allKeys     = PersonalityManager.getAllPersonalities();
    const botLines    = allKeys.map(k => {
      const info = PersonalityManager.getPersonalityInfo(k);
      return `  • ${info.displayName} (${k})`;
    });

    // CCTV-enabled groups
    const cctvGroups = Object.entries(db.cctv || {})
      .filter(([, v]) => v.enabled).length;

    // MongoDB status
    const mongoStatus = db._mongoConnected !== false ? '🟢 Connected' : '🔴 Disconnected';

    const lines = [
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '📊 *ANIRPG STATUS REPORT*',
      `🕒 ${new Date().toLocaleString('en-GB', { hour12: false })}`,
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '',
      '⚙️ *SYSTEM*',
      `⏱️ Uptime:    ${uptime()}`,
      `🧠 Heap:      ${mb(mem.heapUsed)} / ${mb(mem.heapTotal)}`,
      `📦 RSS:       ${mb(mem.rss)}`,
      `🗄️ MongoDB:   ${mongoStatus}`,
      `🌐 Node.js:   ${process.version}`,
      '',
      '👥 *PLAYERS*',
      `👤 Registered: ${users}`,
      `🟢 Active 24h: ${active24}`,
      `🏰 Guilds:     ${guilds}`,
      `🚫 Banned:     ${banned}`,
      '',
      '🤖 *BOT PERSONALITIES*',
      ...botLines,
      '',
      '📹 *CCTV GROUPS*',
      `📹 Active logging: ${cctvGroups} group(s)`,
      '',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    ];

    return sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: msg });
  },
};
