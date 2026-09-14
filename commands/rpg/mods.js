// ═══════════════════════════════════════════════════════════════
// /mods — List all bot owners + mods
// Format cleanly with bare phone numbers and valid WhatsApp tags
// ═══════════════════════════════════════════════════════════════

'use strict';

const Perms = require('../../utils/permissions');

const COOWNER_JID = process.env.COOWNER_JID || '194592469209292@lid';

function cleanBare(jid) {
  return String(jid || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
}

// Push #30: resolve a staff JID to its game profile. Exact hit first, then a
// digits-normalised scan (covers @lid / @s.whatsapp.net + device flips, so the
// game name shows instead of the 'Senku'/'Hunter' fallback).
function findUser(db, jid) {
  if (!db || !db.users) return null;
  if (db.users[jid]) return db.users[jid];
  const want = cleanBare(jid);
  if (!want) return null;
  for (const k of Object.keys(db.users)) {
    if (cleanBare(k) === want) return db.users[k];
  }
  return null;
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

    const coOwnerNum = cleanBare(COOWNER_JID);
    const visibleOwners = owners.filter(j => cleanBare(j) !== coOwnerNum);
    const UI = require('../../rpg/utils/UI');
    const pro = UI.isPro(db.users?.[sender] || {});
    const FRAME = pro ? UI.PRO_BAR : UI.FREE_BAR;

    let txt = pro ? `${UI.PRO_BAR}\n👑 *BOT STAFF* 👑 💎\n${UI.PRO_BAR}\n` : `👑 *BOT STAFF* 👑\n${UI.FREE_BAR}\n`;
    txt += `👑 Owner: ${visibleOwners.length}\n`;
    txt += `⭐ Mods:  ${mods.length}\n`;
    txt += `${FRAME}\n\n`;

    const mentions = [];

    // ── Owner ─────────────────────────────────────────────
    txt += `👑 *OWNER*\n`;
    txt += `${FRAME}\n`;
    for (let i = 0; i < visibleOwners.length; i++) {
      const jid = visibleOwners[i];
      const bareNum = cleanBare(jid);
      const u = findUser(db, jid);
      const name = u?.name || 'Senku';
      mentions.push(jid); // Push #30: mention the REAL JID — a rebuilt @s.whatsapp.net never links for @lid users

      txt += `${i + 1}. 👑 Owner\n`;
      txt += `   👤 ${name}\n`;
      txt += `   📱 @${bareNum}\n`;
      if (u) txt += `   📊 Level ${u.level || 1} | ${u.awakenRank || 'E'}-Rank\n`;
      txt += `\n`;
    }

    // ── Mods ───────────────────────────────────────────────
    txt += `⭐ *MODS* (${mods.length})\n`;
    txt += `${FRAME}\n`;
    if (mods.length === 0) {
      txt += `_No mods registered yet._\n_Add one with_ \`/set --mod @user --true\` _ (owner-only)_\n`;
    } else {
      for (let i = 0; i < mods.length; i++) {
        const jid = mods[i];
        const bareNum = cleanBare(jid);
        const u = findUser(db, jid);
        const name = u?.name || 'Hunter';
        mentions.push(jid); // Push #30: mention the REAL JID

        txt += `${i + 1}. ⭐ Mod\n`;
        txt += `   👤 ${name}\n`;
        txt += `   📱 @${bareNum}\n`; // Push #30: visible tag (links via mentions → renders as name)
        if (u) txt += `   📊 Level ${u.level || 1} | ${u.awakenRank || 'E'}-Rank\n`;
        txt += `\n`;
      }
    }

    txt += `${FRAME}\n`;
    txt += `💡 *MANAGEMENT COMMANDS:*\n`;
    txt += `/set --mod @user --true   — promote to mod (owner)\n`;
    txt += `/set --mod @user --false  — demote mod (owner)\n`;
    txt += `${FRAME}` + (pro ? `\n${UI.PRO_MINI}\n💎 *PRO STAFF* — ${visibleOwners.length} owners · ${mods.length} mods` : `\n${UI.upsell()}`);

    if (COOWNER_JID) mentions.push(COOWNER_JID); // Push #30: real JID

    await sock.sendMessage(chatId, {
      text: txt,
      mentions: [...new Set(mentions)],
    }, { quoted: msg });
  }
};
