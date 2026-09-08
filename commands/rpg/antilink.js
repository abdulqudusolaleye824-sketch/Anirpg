// antilink.js — per-group anti-link toggle + whitelist (co-owner spec)
//   /antilink            → view current state
//   /antilink on|off     → enable/disable for THIS group (also auto-on for --main groups)
//   /antilink add <domain> / /antilink rm <domain>  → manage allowed domains
const Perms = require('../../utils/permissions');

// Socials always allowed by default (Instagram / Pinterest / YouTube / TikTok / WhatsApp).
const DEFAULT_ALLOWED = ['instagram.com', 'pinterest.', 'pinterest.com', 'youtube.com', 'youtu.be', 'tiktok.com', 'chat.whatsapp.com', 'wa.me'];

module.exports = {
  name: 'antilink',
  description: '🔗 Enable/disable anti-link for this group (auto-on for --main groups)',
  aliases: ['no links', 'antilinkon'],

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const PermsHelper = Perms;

    if (!PermsHelper.isBotMod(db, sender)) return sock.sendMessage(chatId, { text: '❌ Admins only.' }, { quoted: msg });
    if (!chatId.endsWith('@g.us')) return sock.sendMessage(chatId, { text: '❌ Run this inside a group.' }, { quoted: msg });

    // Ensure per-group settings exist and default the whitelist.
    if (!db.groupSettings) db.groupSettings = {};
    if (!db.groupSettings[chatId]) db.groupSettings[chatId] = { antiLink: false, allowed: [] };
    const gs = db.groupSettings[chatId];
    if (!Array.isArray(gs.allowed)) gs.allowed = [];
    const allowed = gs.allowed.length ? gs.allowed : DEFAULT_ALLOWED.slice();

    const sub = (args[0] || '').toLowerCase();

    // ── View ────────────────────────────────────────────────────
    if (!sub || sub === 'status' || sub === 'view') {
      return sock.sendMessage(chatId, {
        text: [
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `🔗 *ANTI-LINK — ${chatId}`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `Status: *${gs.antiLink ? 'ON ⛔' : 'OFF'}*`,
          ``,
          `✅ Allowed domains (default socials):`,
          ...allowed.map(d => `   • ${d}`),
          ``,
          `📌 /antilink on|off`,
          `📌 /antilink add <domain>`,
          `📌 /antilink rm <domain>`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ].join('\n'),
      }, { quoted: msg });
    }

    // ── on / off ────────────────────────────────────────────────
    if (sub === 'on') { gs.antiLink = true; saveDatabase(); return sock.sendMessage(chatId, { text: '✅ Anti-link enabled for this group.' }, { quoted: msg }); }
    if (sub === 'off') { gs.antiLink = false; saveDatabase(); return sock.sendMessage(chatId, { text: '🔕 Anti-link disabled for this group.' }, { quoted: msg }); }

    // ── add / rm allowed domain ─────────────────────────────────
    if (sub === 'add' || sub === 'allow') {
      const dom = (args[1] || '').toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
      if (!dom) return sock.sendMessage(chatId, { text: '❌ Usage: /antilink add <domain>' }, { quoted: msg });
      if (!gs.allowed.includes(dom)) gs.allowed.push(dom);
      saveDatabase();
      return sock.sendMessage(chatId, { text: `✅ Now allowed: *${dom}*` }, { quoted: msg });
    }
    if (sub === 'rm' || sub === 'disallow' || sub === 'remove') {
      const dom = (args[1] || '').toLowerCase();
      const before = gs.allowed.length;
      gs.allowed = gs.allowed.filter(d => d !== dom);
      saveDatabase();
      return sock.sendMessage(chatId, { text: gs.allowed.length < before ? `🔹 Removed *${dom}* from allowed.` : `❌ *${dom}* is not in the allowed list.` }, { quoted: msg });
    }

    return sock.sendMessage(chatId, { text: `📌 Usage: /antilink [on|off|status|add <domain>|rm <domain>]` }, { quoted: msg });
  },
};
