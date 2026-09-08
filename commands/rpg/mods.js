// ═══════════════════════════════════════════════════════════════
// /mods — List all bot owners + mods
// Tier hierarchy:
//   👑 Owner — Senku (221951679328499@lid)
//   ⭐ Mod   — operator-managed list
// ═══════════════════════════════════════════════════════════════

const Perms = require('../../utils/permissions');

const COOWNER_JID = process.env.COOWNER_JID || '194592469209292@lid';

function normaliseJid(jid) {
  return jid?.split('@')[0]?.split(':')[0]?.replace(/[^0-9]/g, '') || '';
}

function formatJidDisplay(jid, db) {
  const u = db.users?.[jid];
  if (u?.name) return u.name;
  const bare = normaliseJid(jid);
  if (/^\d+$/.test(bare)) {
    return `+${bare}`;
  }
  return bare || jid;
}

module.exports = {
  name: 'mods',
  aliases: ['modlist', 'botstaff', 'admins', 'staff'],
  description: '⭐ List all bot owners and mods',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    if (!Array.isArray(db.botMods))   db.botMods   = [];
    if (!Array.isArray(db.botOwners)) db.botOwners = [];

    const owners = Perms.getBotOwners(db);
    const mods   = Perms.getBotMods(db);

    db.botMods   = [...new Set(mods.map(j => j))];
    db.botOwners = [...new Set(owners.map(j => j))];
    saveDatabase();

    // Filter out Co-owner (Naruto) from visible display list (keep Senku only)
    const coOwnerNum = normaliseJid(COOWNER_JID);
    const visibleOwners = owners.filter(j => normaliseJid(j) !== coOwnerNum);

    let txt = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n👑 BOT STAFF 👑\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    txt += `👑 Owner: ${visibleOwners.length}\n`;
    txt += `⭐ Mods:  ${mods.length}\n`;
    txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    // ── Owner ─────────────────────────────────────────────
    txt += `👑 *OWNER*\n`;
    txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    for (let i = 0; i < visibleOwners.length; i++) {
      const jid = visibleOwners[i];
      const u   = db.users[jid];
      const name = u?.name || 'Senku';
      txt += `${i + 1}. 👑 Owner\n`;
      txt += `   👤 ${name}\n`;
      txt += `   📱 @${jid.split('@')[0]}\n`;
      if (u) txt += `   📊 Level ${u.level || 1} | ${u.rank || 'Unranked'}\n`;
      txt += `\n`;
    }

    // ── Mods ───────────────────────────────────────────────
    txt += `⭐ *MODS* (${mods.length})\n`;
    txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    if (mods.length === 0) {
      txt += `_No mods registered yet._\n_Add one with_ \`/set --mod @user --true\` _ (owner-only)_\n`;
    } else {
      for (let i = 0; i < mods.length; i++) {
        const jid = mods[i];
        const u   = db.users[jid];
        const dispName = formatJidDisplay(jid, db);
        txt += `${i + 1}. ⭐ Mod\n`;
        txt += `   👤 ${dispName}\n`;
        txt += `   📱 @${jid.split('@')[0]}\n`;
        if (u) txt += `   📊 Level ${u.level || 1} | ${u.rank || 'Unranked'}\n`;
        txt += `\n`;
      }
    }

    txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    txt += `💡 *MANAGEMENT COMMANDS:*\n`;
    txt += `/set --mod @user --true   — promote to mod (owner)\n`;
    txt += `/set --mod @user --false  — demote mod (owner)\n`;
    txt += `/set --owner @user --true — add as super-owner (owner)\n`;
    txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

    // Include coOwnerJid in mentions so co-owner receives hidden tag
    await sock.sendMessage(chatId, {
      text: txt,
      mentions: [...owners, ...mods, COOWNER_JID],
    }, { quoted: msg });
  }
};
