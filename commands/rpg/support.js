// support.js — Sends user all --main community group links via DM with URL Buttons (no messy links)
// (Excludes Mods GC; DM is delivered by the user's assigned Serf bot)

const COOLDOWN = 5 * 60 * 1000; // 5 minutes
const supportCooldown = new Map();
const AstralGroups = require('../../rpg/utils/AstralGroups');
const SerfManager = require('../../rpg/utils/SerfManager');
const MultiSocketManager = require('../../bots/MultiSocketManager');
const ButtonHelper = (()=>{ try { return require('../../utils/buttonHelper'); } catch(e){ return null; } })();

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

    // Build clean list for GC/DM text (no raw links) + button payload
    const groupLinesText = [];
    const buttonGroups = [];
    for (const g of allMain) {
      const info = AstralGroups.typeInfo(g.type);
      groupLinesText.push(`${info.emoji} *${info.name}* (${g.type.toUpperCase()})`);
      if (g.inviteLink) {
        buttonGroups.push({
          type: g.type,
          inviteLink: g.inviteLink,
          typeInfo: info
        });
      }
    }

    if (groupLinesText.length === 0) {
      const supportLink = AstralGroups.getSupportLink(db);
      if (supportLink) {
        groupLinesText.push(`🛡️ *✦ 𝐀𝐬𝐭𝐫𝐚™ Arise Support*`);
        buttonGroups.push({
          type: 'support',
          inviteLink: supportLink,
          typeInfo: { emoji: '🛡️', name: 'Arise Support' }
        });
      }
    }

    const dmText = [
      `━━━━━━━━━━━━━━━━━━━━━━━`,
      `🛡️ *✦ 𝐀𝐬𝐭𝐫𝐚™ ARISE — COMMUNITY GROUPS*`,
      `━━━━━━━━━━━━━━━━━━━━━━━`,
      `Tap a button below to join:`,
      ``,
      ...(groupLinesText.length ? groupLinesText : ['⚠️ No main community groups configured yet. Ask the owner to set them using `/setgroup <type> --main`.']),
      ``,
      `━━━━━━━━━━━━━━━━━━━━━━━`,
      `💡 Need direct assistance? Type \`/support owner\` to message staff.`,
      `━━━━━━━━━━━━━━━━━━━━━━━`,
    ].join('\n');

    // Build URL buttons for DM — no messy links in text!
    let supportButtons = null;
    try {
      if (ButtonHelper?.buildSupportButtons && buttonGroups.length) {
        supportButtons = ButtonHelper.buildSupportButtons(buttonGroups);
      }
    } catch {}

    // Notify in group chat (no links)
    if (chatId.endsWith('@g.us')) {
      await sock.sendMessage(chatId, {
        text: `📩 Main community group links sent to your DM, @${sender.split('@')[0]}! Tap the buttons in DM to join.`,
        mentions: [sender]
      }, { quoted: msg });
    }

    // DM user via their Serf bot — with URL buttons!
    const serfKey = SerfManager.getSerfBotKey(db, sender);
    const serfSock = serfKey ? MultiSocketManager.getSocket(serfKey) : null;
    const dmPayload = { text: dmText, footer: 'Astra™ Official Groups' };

    if (serfSock && supportButtons && supportButtons.length) {
      try {
        if (ButtonHelper?.sendWithButtons) {
          await ButtonHelper.sendWithButtons(serfSock, sender, dmPayload, supportButtons, null);
        } else {
          await serfSock.sendMessage(sender, { text: dmText });
        }
      } catch (e) {
        // Fallback: append links if buttons fail
        await serfSock.sendMessage(sender, { text: dmText + (buttonGroups.length ? '\n\n' + buttonGroups.map(g=>`🔗 ${g.typeInfo.name}: ${g.inviteLink}`).join('\n') : '') });
      }
    } else if (serfSock) {
      await serfSock.sendMessage(sender, { text: dmText });
    } else {
      if (supportButtons && supportButtons.length && ButtonHelper?.sendWithButtons) {
        try {
          await ButtonHelper.sendWithButtons(sock, sender, dmPayload, supportButtons, null);
        } catch {
          await MultiSocketManager.safeSendDM(sock, sender, { text: dmText + '\n\n' + buttonGroups.map(g=>`🔗 ${g.typeInfo.name}: ${g.inviteLink}`).join('\n') }, { getDatabase });
        }
      } else {
        await MultiSocketManager.safeSendDM(sock, sender, { text: dmText }, { getDatabase });
      }
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
