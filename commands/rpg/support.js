// support.js — Sends user all --main community group links via DM
// (Excludes Mods GC; DM is delivered by the user's assigned Serf bot)

const COOLDOWN = 5 * 60 * 1000; // 5 minutes
const supportCooldown = new Map();
const AstralGroups = require('../../rpg/utils/AstralGroups');
const SerfManager = require('../../rpg/utils/SerfManager');
const MultiSocketManager = require('../../bots/MultiSocketManager');

module.exports = {
  name: 'support',
  description: '📩 Get main community group links in your DM',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const config = require('../../config.json');

    // Cooldown check
    const now = Date.now();
    const last = supportCooldown.get(sender) || 0;
    if (now - last < COOLDOWN) {
      const left = Math.ceil((COOLDOWN - (now - last)) / 60000);
      return sock.sendMessage(chatId, {
        text: `⏳ Wait ${left} more minute(s) before using /support again.`
      }, { quoted: msg });
    }
    supportCooldown.set(sender, now);

    // /support owner — notify owner directly
    if (args[0]?.toLowerCase() === 'owner') {
      const ownerId = config.ownerNumber;
      await sock.sendMessage(chatId, { text: '📩 Your message has been forwarded to the Owner.' }, { quoted: msg });
      if (ownerId) {
        await sock.sendMessage(ownerId, {
          text: `━━━━━━━━━━━━━━━━━━━━━━━\n📩 SUPPORT REQUEST\n━━━━━━━━━━━━━━━━━━━━━━━\n👤 User: @${sender.split('@')[0]}\n💬 From: ${chatId}\n⏰ ${new Date().toLocaleString()}\n━━━━━━━━━━━━━━━━━━━━━━━`,
          mentions: [sender]
        });
      }
      return;
    }

    // Get all --main tagged groups excluding mods GC
    const allMain = AstralGroups.getAll(db).filter(g => g.isMain && g.type !== 'mods');

    const groupLines = [];
    for (const g of allMain) {
      const info = AstralGroups.typeInfo(g.type);
      const link = g.inviteLink ? `🔗 ${g.inviteLink}` : `📍 \`${g.groupId}\``;
      groupLines.push(`${info.emoji} *${info.name}* (${g.type.toUpperCase()})\n   ${link}`);
    }

    if (groupLines.length === 0) {
      const supportLink = AstralGroups.getSupportLink(db);
      if (supportLink) {
        groupLines.push(`🛡️ *✦ 𝐀𝐬𝐭𝐫𝐚™ Arise Support*\n   🔗 ${supportLink}`);
      }
    }

    const dmText = [
      `━━━━━━━━━━━━━━━━━━━━━━━`,
      `🛡️ *✦ 𝐀𝐬𝐭𝐫𝐚™ ARISE — COMMUNITY GROUPS*`,
      `━━━━━━━━━━━━━━━━━━━━━━━`,
      `Here are the official community groups:`,
      ``,
      ...(groupLines.length ? groupLines : ['⚠️ No main community groups configured yet. Ask the owner to set them using `/setgroup <type> --main`.']),
      ``,
      `━━━━━━━━━━━━━━━━━━━━━━━`,
      `💡 Need direct assistance? Type \`/support owner\` to message staff.`,
      `━━━━━━━━━━━━━━━━━━━━━━━`,
    ].join('\n');

    // Notify in group chat
    if (chatId.endsWith('@g.us')) {
      await sock.sendMessage(chatId, {
        text: `📩 Main community group links sent to your DM, @${sender.split('@')[0]}!`,
        mentions: [sender]
      }, { quoted: msg });
    }

    // DM user via their Serf bot (if user serf is Hinata, Hinata sends the DM even if active bot here is Kira!)
    const serfKey = SerfManager.getSerfBotKey(db, sender);
    const serfSock = serfKey ? MultiSocketManager.getSocket(serfKey) : null;

    if (serfSock) {
      await serfSock.sendMessage(sender, { text: dmText });
    } else {
      await MultiSocketManager.safeSendDM(sock, sender, { text: dmText }, { getDatabase });
    }

    // Silent owner log
    try {
      const ownerId = config.ownerNumber;
      if (ownerId) {
        await sock.sendMessage(ownerId, {
          text: `📊 /support used by @${sender.split('@')[0]}`,
          mentions: [sender]
        });
      }
    } catch(e) {}
  }
};
