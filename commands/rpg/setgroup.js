// setgroup.js — Consolidated community-group command (✦ 𝐀𝐬𝐭𝐫𝐚™)
// Run INSIDE the target group. Aliases: /setgc
//
//   /setgroup                    → community listing / status
//   /setgroup <type>             → register THIS group (support|pvp|dungeon|casino|guild)
//   /setgroup <type> --main      → register as a MAIN group (never expires)
//   /setgroup <type> <link>      → register + set invite link
//   /setgroup link <url>         → update just the invite link
//   /setgroup reset              → remove THIS group's registration
//
// Subscription lifecycle (owner/co-owner):
//   /ssub | <subscriber name>    → start the 30-day window on a non-main group
//   /renew                       → extend a non-main group by another 30 days
//   /allowgc <pvp|dungeon>       → add a feature onto this group

const AstralGroups = require('../../rpg/utils/AstralGroups');
const Perms = require('../../utils/permissions');

module.exports = {
  name: 'setgroup',
  aliases: ['setgc'],
  description: '🔧 [Admin] Register/manage a ✦ 𝐀𝐬𝐭𝐫𝐚™ community group (with --main / subscription)',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    if (!Perms.isBotMod(db, sender)) {
      return sock.sendMessage(chatId, { text: '❌ Owner / Co-Owner only!' }, { quoted: msg });
    }

    const raw = args[0];
    const sub = raw?.toLowerCase();
    const isMain = args.some((a) => a.toLowerCase() === '--main');

    // ── Listing / status ────────────────────────────────────────
    if (!sub || sub === 'show' || sub === 'list' || sub === 'status') {
      const groups = AstralGroups.getAll(db) || [];
      let txt = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🌐 *✦ 𝐀𝐬𝐭𝐫𝐚™ COMMUNITY GROUPS*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🎮 *Server:* ✦ 𝐀𝐬𝐭𝐫𝐚™\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      const ordered = ['pvp', 'casino', 'dungeon', 'guild', 'support'];
      const shown = groups.filter((g, i, a) => g && g.groupId && a.findIndex((x) => x && x.groupId === g.groupId) === i);
      if (shown.length === 0) {
        txt += `⚠️ No groups registered yet.\n`;
      }
      for (const type of ordered) {
        const info = AstralGroups.typeInfo(type);
        const list = groups.filter((g) => g && g.type === type);
        if (list.length === 0) continue;
        txt += `${info.emoji} *${info.name}* [${type}]\n`;
        txt += `   ${info.desc}\n`;
        for (const g of list) {
          if (!g || !g.groupId) continue;
          const st = AstralGroups.statusOf(db, g.groupId);
          const days = AstralGroups.daysLeft(db, g.groupId);
          const stTxt = st === 'main' ? '👑 Main' : st === 'active' ? `✅ ${days}d left` : st === 'expired' ? '⛔ Expired' : '⚠️ Awaiting /ssub';
          const feats = Array.isArray(g.features) && g.features.length ? `\n   ➕ Features: ${g.features.map((f) => AstralGroups.typeInfo(f)?.name || f).join(', ')}` : '';
          txt += `   └ ID: ...${String(g.groupId).slice(-12)}${g.inviteLink ? `\n   └ Link: ${g.inviteLink}` : ''}\n   └ Status: ${stTxt}${feats}\n`;
        }
        txt += `\n`;
      }
      txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📌 *Setup:* Go to the group, then:\n`;
      txt += `/setgroup <type>          — register (support|pvp|dungeon)\n`;
      txt += `/setgroup <type> --main   — MAIN group (never expires)\n`;
      txt += `/setgroup <type> <link>   — register + set link\n`;
      txt += `/setgroup link <url>      — update link\n`;
      txt += `/setgroup reset           — unregister this group\n`;
      txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n💳 *Subscription:*\n`;
      txt += `/ssub | <name>   — start 30-day window (owner)\n`;
      txt += `/renew           — extend 30 days (owner)\n`;
      txt += `/allowgc <pvp|dungeon> — add a feature here\n`;
      txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
      return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
    }

    // ── /setgroup link <url> ────────────────────────────────────
    if (sub === 'link') {
      const url = args[1];
      const e = AstralGroups.getEntry(db, chatId);
      if (!e) return sock.sendMessage(chatId, { text: '❌ This group is not registered yet. Use /setgroup <type>' }, { quoted: msg });
      if (!url || !url.startsWith('http')) {
        return sock.sendMessage(chatId, { text: '❌ Usage: /setgroup link <https://chat.whatsapp.com/...>' }, { quoted: msg });
      }
      e.inviteLink = url;
      saveDatabase();
      return sock.sendMessage(chatId, { text: `✅ Invite link updated.` }, { quoted: msg });
    }

    // ── /setgroup reset ─────────────────────────────────────────
    if (sub === 'reset') {
      if (db.astralGroups) { delete db.astralGroups[chatId]; }
      saveDatabase();
      return sock.sendMessage(chatId, { text: `✅ This group has been unregistered.` }, { quoted: msg });
    }

    // ── /setgroup <type> [--main] [link] ────────────────────────
    const type = sub;
    const validTypes = AstralGroups.TYPES || ['support', 'pvp', 'dungeon', 'casino', 'guild'];
    if (!AstralGroups.get(type)) {
      return sock.sendMessage(chatId, {
        text: `❌ Unknown type: *${type}*\n\nValid types: ${validTypes.join(', ')}\n\n/setgroup ${type} — register this group\n/setgroup ${type} --main — register as MAIN (never expires)`
      }, { quoted: msg });
    }

    if (!chatId.endsWith('@g.us')) {
      return sock.sendMessage(chatId, { text: '❌ Run this *inside* the group you want to register!' }, { quoted: msg });
    }

    // invite link: explicit, or auto-fetch
    let inviteLink = args.find((a) => a && a.startsWith('https://'));
    if (!inviteLink) {
      try { inviteLink = `https://chat.whatsapp.com/${await sock.groupInviteCode(chatId)}`; } catch (e) {}
    }

    const result = AstralGroups.register(db, type, chatId, inviteLink, { main: isMain });
    if (!result.success) {
      return sock.sendMessage(chatId, { text: `❌ ${result.reason}` }, { quoted: msg });
    }
    saveDatabase();

    const info = AstralGroups.typeInfo(type);
    const mainLine = result.status === 'main'
      ? `👑 *MAIN GROUP* — the bot works here immediately and never expires.`
      : result.status === 'pending'
        ? `⏳ *Subscription pending.* An owner/co-owner must run:\n   /ssub | <subscriber name>\n   to start the 30-day window (the bot stays silent until then).`
        : `✅ The bot is active in this group.`;

    return sock.sendMessage(chatId, {
      text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${info.emoji} *GROUP REGISTERED!*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n🎮 Server: ✦ 𝐀𝐬𝐭𝐫𝐚™\n📋 *Type:* ${type}${isMain ? ' 👑 (--main)' : ''}\n🆔 *Group ID:* saved\n${inviteLink ? `🔗 *Invite link:* ${inviteLink}` : ''}\n\n${mainLine}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    }, { quoted: msg });
  },
};
