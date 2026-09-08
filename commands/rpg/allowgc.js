// allowgc.js — Add a pvp/dungeon FEATURE onto a group (owner/co-owner)
// Usage: /allowgc pvp   |   /allowgc dungeon
const AstralGroups = require('../../rpg/utils/AstralGroups');
const Perms = require('../../utils/permissions');

module.exports = {
  name: 'allowgc',
  description: '➕ [Owner] Add a pvp or dungeon feature to this community group',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    if (!Perms.isBotOwner(db, sender)) {
      return sock.sendMessage(chatId, { text: '❌ Owner / Co-Owner only!' }, { quoted: msg });
    }
    if (!chatId.endsWith('@g.us')) {
      return sock.sendMessage(chatId, { text: '❌ Run this inside the group.' }, { quoted: msg });
    }

    const feature = args[0]?.toLowerCase();
    if (!feature) {
      return sock.sendMessage(chatId, { text: `❌ Usage: /allowgc <${AstralGroups.FEATURE_TYPES.join('|')}>` }, { quoted: msg });
    }

    const res = AstralGroups.addFeature(db, chatId, feature);
    if (!res.success) return sock.sendMessage(chatId, { text: `❌ ${res.reason}` }, { quoted: msg });
    saveDatabase();

    const info = AstralGroups.typeInfo(res.feature);
    const feats = res.features.map((f) => AstralGroups.typeInfo(f)?.name || f).join(', ');
    return sock.sendMessage(chatId, {
      text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${info.emoji} *FEATURE ENABLED*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n🎮 Server: ✦ 𝐀𝐬𝐭𝐫𝐚™\n➕ Added: *${info.name}*\n\n📋 Enabled features here:\n• ${feats}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    }, { quoted: msg });
  },
};
