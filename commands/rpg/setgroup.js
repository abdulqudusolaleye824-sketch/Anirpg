// setgroup.js — Admin command to configure Ani R.P.G community groups
// Usage (run inside the target group):
//   /setgroup pvp          → registers THIS group as the PvP group (auto-fetches link)
//   /setgroup pvp [link]   → sets just the invite link for pvp
//   /setgroup show         → shows current config for all groups
//   /setgroup reset [cat]  → clears config for a category

const AutoRedirect = require('../../rpg/utils/AutoRedirect');
const Perms = require('../../utils/permissions');

const VALID = ['pvp', 'casino', 'dungeon', 'guild', 'support'];

module.exports = {
  name: 'setgroup',
  description: '🔧 [Admin] Configure which groups host which commands',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    // ── Perm check (owner or co-owner or configured mod) ─────────
    if (!Perms.isBotMod(db, sender)) {
      return sock.sendMessage(chatId, { text: '❌ Owner / Co-Owner only!' }, { quoted: msg });
    }

    const sub = args[0]?.toLowerCase();

    // ── /setgroup show ─────────────────────────────────────────
    if (!sub || sub === 'show' || sub === 'list') {
      const groups = AutoRedirect.getAllGroups(db);
      let txt = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🌐 *ALINRPG COMMUNITY GROUPS*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      for (const g of groups) {
        const status = g.configured ? '✅' : '⚠️ Not set';
        txt += `${g.emoji} *${g.groupName}* [${g.key}]\n`;
        txt += `   ${g.desc}\n`;
        txt += `   Status: ${status}\n`;
        if (g.groupId) txt += `   ID: ...${g.groupId.slice(-12)}\n`;
        if (g.inviteLink) txt += `   Link: ${g.inviteLink}\n`;
        txt += `\n`;
      }
      txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      txt += `📌 *Setup:* Go to the group, then:\n`;
      txt += `/setgroup [type]         — register this group\n`;
      txt += `/setgroup [type] [link]  — set invite link\n`;
      txt += `\nTypes: ${VALID.join(', ')}\n`;
      txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
      return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
    }

    // ── /setgroup reset [cat] ──────────────────────────────────
    if (sub === 'reset') {
      const cat = args[1]?.toLowerCase();
      if (!cat || !VALID.includes(cat)) {
        return sock.sendMessage(chatId, { text: `❌ Specify category to reset.\nValid: ${VALID.join(', ')}` }, { quoted: msg });
      }
      if (db.communityGroups) delete db.communityGroups[cat];
      saveDatabase();
      return sock.sendMessage(chatId, { text: `✅ *${cat}* group config cleared.` }, { quoted: msg });
    }

    // ── /setgroup [type] or /setgroup [type] [link] ────────────
    const category = sub;
    if (!VALID.includes(category)) {
      return sock.sendMessage(chatId, {
        text: `❌ Unknown type: *${category}*\n\nValid types: ${VALID.join(', ')}\n\nExample:\n/setgroup pvp\n/setgroup casino\n/setgroup support`
      }, { quoted: msg });
    }

    // Must be in a group to register it
    if (!chatId.endsWith('@g.us')) {
      return sock.sendMessage(chatId, { text: `❌ Run this command *inside* the group you want to register as *${category}*!` }, { quoted: msg });
    }

    const manualLink = args[1]?.startsWith('https://') ? args[1] : null;

    // Auto-fetch invite link if not provided
    let inviteLink = manualLink;
    if (!inviteLink) {
      try {
        const code = await sock.groupInviteCode(chatId);
        inviteLink = `https://chat.whatsapp.com/${code}`;
      } catch(e) {
        inviteLink = null;
      }
    }

    const result = AutoRedirect.setGroup(db, category, chatId, inviteLink);
    if (!result.success) {
      return sock.sendMessage(chatId, { text: `❌ ${result.reason}` }, { quoted: msg });
    }

    saveDatabase();

    const info = AutoRedirect.getAllGroups(db).find(g => g.key === category);
    return sock.sendMessage(chatId, {
      text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${info.emoji} *GROUP REGISTERED!*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n✅ This group is now the *${info.groupName}*\n\n📋 *Category:* ${category}\n🆔 *Group ID:* saved\n${inviteLink ? `🔗 *Invite link:* ${inviteLink}` : '⚠️ Could not auto-fetch link — run:\n/setgroup ${category} [paste_link_here]'}\n\n💡 Users who use /${category === 'dungeon' ? 'dungeon' : category} commands in other groups will now be redirected here.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    }, { quoted: msg });
  }
};
