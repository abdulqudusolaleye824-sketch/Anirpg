// ═══════════════════════════════════════════════════════════════
// /mods — List all bot owners + mods
// Tier hierarchy:
//   👑 Owner   — Senku (221951679328499@lid)
//   👑 Co-Owner — Naruto (194592469209292@lid)
//   ⭐ Mod     — operator-managed list
// ═══════════════════════════════════════════════════════════════

const Perms = require('../../utils/permissions');

module.exports = {
  name: 'mods',
  aliases: ['modlist', 'botstaff', 'admins', 'staff'],
  description: '⭐ List all bot owners and mods',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    // Seed default arrays
    if (!Array.isArray(db.botMods))   db.botMods   = [];
    if (!Array.isArray(db.botOwners)) db.botOwners = [];

    const owners = Perms.getBotOwners(db);   // includes Senku + Naruto always
    const mods   = Perms.getBotMods(db);

    // De-dup and clean
    db.botMods   = [...new Set(mods.map(j => j))];
    db.botOwners = [...new Set(owners.map(j => j))];
    saveDatabase();

    let txt = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n👑 BOT STAFF 👑\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    txt += `👑 Owners: ${owners.length}\n`;
    txt += `⭐ Mods:   ${mods.length}\n`;
    txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    // ── Owners ─────────────────────────────────────────────
    txt += `👑 *OWNERS* (${owners.length})\n`;
    txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    for (let i = 0; i < owners.length; i++) {
      const jid = owners[i];
      const u   = db.users[jid];
      const name = u?.name || jid.split('@')[0];
      const tier = (i === 0) ? '👑 Owner' : '👑 Co-Owner';
      txt += `${i + 1}. ${tier}\n`;
      txt += `   👤 ${name}\n`;
      txt += `   📱 @${jid.split('@')[0]}\n`;
      if (u) txt += `   📊 Level ${u.level || '?'} | ${u.rank || 'Unranked'}\n`;
      txt += `\n`;
    }

    // ── Mods ───────────────────────────────────────────────
    txt += `\n⭐ *MODS* (${mods.length})\n`;
    txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    if (mods.length === 0) {
      txt += `_No mods yet._\n_Add one with_ \`/set --mod @user --true\` _ (owner-only)_\n`;
    } else {
      for (let i = 0; i < mods.length; i++) {
        const jid = mods[i];
        const u   = db.users[jid];
        const name = u?.name || jid.split('@')[0];
        txt += `${i + 1}. ⭐ Mod\n`;
        txt += `   👤 ${name}\n`;
        txt += `   📱 @${jid.split('@')[0]}\n`;
        if (u) txt += `   📊 Level ${u.level || '?'} | ${u.rank || 'Unranked'}\n`;
        txt += `\n`;
      }
    }

    txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    txt += `💡 *MANAGEMENT COMMANDS:*\n`;
    txt += `/set --mod @user --true   — promote to mod (owner)\n`;
    txt += `/set --mod @user --false  — demote mod (owner)\n`;
    txt += `/set --owner @user --true — add as super-owner (owner)\n`;
    txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

    await sock.sendMessage(chatId, {
      text: txt,
      mentions: [...owners, ...mods],
    }, { quoted: msg });
  }
};
