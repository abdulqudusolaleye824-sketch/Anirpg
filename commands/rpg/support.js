// support.js — Sends user the Ani R.P.G support group link via DM
// Link is set by owner using: /setgroup support  (run inside Ani R.P.G Arise)

const COOLDOWN = 5 * 60 * 1000; // 5 minutes
const supportCooldown = new Map();
const AutoRedirect = require('../../rpg/utils/AutoRedirect');

module.exports = {
  name: 'support',
  description: '📩 Get the Ani R.P.G Arise support group link in your DM',

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

    // Get support link from communityGroups config
    let supportLink = AutoRedirect.getSupportLink(db);

    if (!supportLink) {
      // Fallback: try to generate this group's invite code
      if (chatId.endsWith('@g.us')) {
        try {
          const code = await sock.groupInviteCode(chatId);
          supportLink = `https://chat.whatsapp.com/${code}`;
        } catch(e) {}
      }
      if (!supportLink) {
        return sock.sendMessage(chatId, {
          text: `❌ Support group link not configured yet.\n\nAsk the owner to run */setgroup support* inside the Ani R.P.G Arise group.`
        }, { quoted: msg });
      }
    }

    // Notify in group
    if (chatId.endsWith('@g.us')) {
      await sock.sendMessage(chatId, {
        text: `📩 Support link sent to your DM, @${sender.split('@')[0]}!`,
        mentions: [sender]
      }, { quoted: msg });
    }

    // DM the user
    await sock.sendMessage(sender, {
      text: `━━━━━━━━━━━━━━━━━━━━━━━\n🛡️ *ALINRPG ARISE — SUPPORT*\n━━━━━━━━━━━━━━━━━━━━━━━\nNeed help? Questions? Bug reports?\nJoin our support group!\n\n🔗 ${supportLink}\n\n💡 You can also type:\n/support owner — message the owner directly\n━━━━━━━━━━━━━━━━━━━━━━━`
    });

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
