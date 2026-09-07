// ═══════════════════════════════════════════════════════════════
// BYPASS COMMAND - Nullify all cooldowns for a player
// Only usable by the bot owner and 194592469209292@lid
// 24hr cooldown per user
// ═══════════════════════════════════════════════════════════════

const ALLOWED_USERS = ['221951679328499@lid', '194592469209292@lid'];
const BYPASS_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

module.exports = {
  name: 'bypass',
  description: 'Nullify all cooldowns for yourself or a tagged player',
  usage: '/bypass [@player]',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    // ── Permission check ────────────────────────────────────────
    if (!ALLOWED_USERS.includes(sender)) {
      return sock.sendMessage(chatId, {
        text: '❌ You do not have permission to use this command.'
      }, { quoted: msg });
    }

    // ── Self 24hr cooldown ───────────────────────────────────────
    if (!db.bypassCooldowns) db.bypassCooldowns = {};
    const lastUsed = db.bypassCooldowns[sender] || 0;
    const timeLeft = BYPASS_COOLDOWN_MS - (Date.now() - lastUsed);

    if (timeLeft > 0) {
      const hours = Math.floor(timeLeft / 1000 / 60 / 60);
      const minutes = Math.ceil((timeLeft % (1000 * 60 * 60)) / 1000 / 60);
      return sock.sendMessage(chatId, {
        text: `⏰ Bypass on cooldown!\n\nTime remaining: ${hours}h ${minutes}m`
      }, { quoted: msg });
    }

    // ── Determine target ─────────────────────────────────────────
    const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const targetId = mentionedJid || sender;
    const target = db.users[targetId];

    if (!target) {
      return sock.sendMessage(chatId, {
        text: '❌ Player not found!'
      }, { quoted: msg });
    }

    // ── Clear all cooldowns ──────────────────────────────────────
    const cleared = [];

    if (target.dungeonCooldown) {
      target.dungeonCooldown = 0;
      cleared.push('⚔️ Dungeon');
    }

    if (target.bossCooldown) {
      target.bossCooldown = 0;
      cleared.push('👹 Boss');
    }

    if (target.skillCooldowns && Object.keys(target.skillCooldowns).length > 0) {
      target.skillCooldowns = {};
      cleared.push('✨ Skills');
    }

    if (target.cooldowns && Object.keys(target.cooldowns).length > 0) {
      target.cooldowns = {};
      cleared.push('🔧 Other');
    }

    // ── Set bypass cooldown for the user who ran it ──────────────
    db.bypassCooldowns[sender] = Date.now();
    saveDatabase();

    const targetName = target.name || targetId.split('@')[0];
    const selfUse = targetId === sender;

    if (cleared.length === 0) {
      return sock.sendMessage(chatId, {
        text: `✅ *${selfUse ? 'Your' : `${targetName}'s`}* cooldowns are already clear — nothing to bypass.`
      }, { quoted: msg });
    }

    return sock.sendMessage(chatId, {
      text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n⚡ BYPASS ACTIVATED\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n👤 Player: *${targetName}*\n\n🗑️ Cooldowns cleared:\n${cleared.map(c => `   ${c}`).join('\n')}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n⏰ Your bypass is on cooldown for 24h`,
      mentions: mentionedJid ? [mentionedJid] : []
    }, { quoted: msg });
  }
};