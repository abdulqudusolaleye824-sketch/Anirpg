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

    // ── Self 24hr cooldown (12hr for Pro) ───────────────────────
    if (!db.bypassCooldowns) db.bypassCooldowns = {};
    const player = db.users[sender];
    const isPro = player && (player.isPro || player.proStatus) && player.proExpiresAt && player.proExpiresAt > Date.now();
    const effectiveCooldown = isPro ? (12 * 60 * 60 * 1000) : BYPASS_COOLDOWN_MS;
    const lastUsed = db.bypassCooldowns[sender] || 0;
    const timeLeft = effectiveCooldown - (Date.now() - lastUsed);

    if (timeLeft > 0) {
      const hours = Math.floor(timeLeft / 1000 / 60 / 60);
      const minutes = Math.ceil((timeLeft % (1000 * 60 * 60)) / 1000 / 60);
      return sock.sendMessage(chatId, {
        text: `⏰ Bypass on cooldown!\n\nTime remaining: ${hours}h ${minutes}m${isPro ? ' (🌟 PRO 50% Reduced Cooldown)' : ''}`
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

    // ── Clear ALL cooldowns (except this command's own) ──────────
    // NOTE: live battle state (pvpBattle) and AFK status are NOT
    // cooldowns — touching them would corrupt battles / presence.
    const cleared = [];

    // Player timestamp fields
    if (target.dungeonCooldown) { target.dungeonCooldown = 0; cleared.push('⚔️ Dungeon'); }
    if (target.bossCooldown) { target.bossCooldown = 0; cleared.push('👹 Boss'); }
    if (target.skillCooldowns && Object.keys(target.skillCooldowns).length > 0) { target.skillCooldowns = {}; cleared.push('✨ Skills'); }
    if (target.skills?.cooldowns && Object.keys(target.skills.cooldowns).length > 0) { target.skills.cooldowns = {}; cleared.push('✨ Gate skills'); }
    if (target.attackCooldowns && Object.keys(target.attackCooldowns).length > 0) { target.attackCooldowns = {}; cleared.push('🗡️ Attacks'); }
    if (target.cooldowns && Object.keys(target.cooldowns).length > 0) { target.cooldowns = {}; cleared.push('🔧 Other (aura farm, …)'); }
    if (target.stealCooldown) { target.stealCooldown = 0; cleared.push('🦹 Rob/steal'); }
    if (target.dailyQuest?.lastClaimed) { target.dailyQuest.lastClaimed = 0; cleared.push('📅 Daily reward'); }

    // DB-level stores
    if (db.userCooldowns) {
      let n = 0;
      for (const k of Object.keys(db.userCooldowns)) {
        if (k.includes(targetId)) { delete db.userCooldowns[k]; n++; }
      }
      if (n) cleared.push(`🐌 Slowmode ×${n}`);
    }
    if (db.modResetCooldowns?.[targetId]) { delete db.modResetCooldowns[targetId]; cleared.push('🛡️ Mod reset'); }
    if (db.banks) {
      let n = 0;
      for (const bank of Object.values(db.banks)) {
        const acc = bank.accounts?.find((a) => a.userId === targetId);
        if (acc?.lastWithdrawal) { acc.lastWithdrawal = 0; n++; }
      }
      if (n) cleared.push(`🏦 Bank withdraw ×${n}`);
    }

    // In-memory module cooldowns (each command exposes resetCooldownsFor,
    // which reports whether it cleared anything for this player).
    const hookFiles = ['quiz', 'support', 'steal', 'lyrics', 'imagine', 'quote', 'download', 'insta', 'pindl', 'pinterest', 'casino'];
    const hookLabels = { quiz: '📝 Quiz', support: '🛡️ Support', steal: '🥷 Steal', lyrics: '🎤 Lyrics', imagine: '🎨 Imagine', quote: '💬 Quote', download: '⬇️ Downloads', insta: '📸 Insta', pindl: '📌 PinDL', pinterest: '📌 Pinterest', casino: '🎰 Casino' };
    for (const f of hookFiles) {
      try {
        const mod = require(`./${f}`);
        if (mod && typeof mod.resetCooldownsFor === 'function' && mod.resetCooldownsFor(targetId)) {
          cleared.push(hookLabels[f]);
        }
      } catch (e) { /* hook missing — that command has no resetter */ }
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