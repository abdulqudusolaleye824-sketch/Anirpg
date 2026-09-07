module.exports = {
  name: 'suggest',
  description: '💡 Suggest a feature',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    if (!chatId) return console.error("chatId is undefined!");

    const config = require('../../config.json');
    const ownerId = config.ownerNumber;
    if (!ownerId) return console.error("ownerId is not set in config.json!");

    if (!args.length) {
      await sock.sendMessage(chatId, {
        text: '❌ Please write your suggestion.\nExample:\n/suggest Add guild wars'
      }, { quoted: msg });
      return;
    }

    const suggestion = args.join(' ');

    // Confirm to user
    await sock.sendMessage(chatId, {
      text: '💡 Suggestion sent! Thanks for helping improve the game.'
    }, { quoted: msg });

    // Send to owner + co-owner
    const ALSO_NOTIFY = ['194592469209292@lid'];
    if (ownerId && typeof ownerId === "string") {
      try {
        const suggestionMsg = {
          text: `━━━━━━━━━━━━━━━━━━━━━━━
💡 SUGGESTION
━━━━━━━━━━━━━━━━━━━━━━━
👤 User: @${sender?.split('@')[0] || 'Unknown'}
📍 Group: ${chatId}
📝 Idea:
${suggestion}
━━━━━━━━━━━━━━━━━━━━━━━`,
          mentions: sender ? [sender] : []
        };
        await sock.sendMessage(ownerId, suggestionMsg);
        for (const id of ALSO_NOTIFY) {
          try { await sock.sendMessage(id, suggestionMsg); } catch (e) {}
        }

        console.log(`[SUGGEST] From ${sender}: ${suggestion}`);
      } catch (err) {
        console.error("❌ Failed to send suggestion to owner:", err);
      }
    } else {
      console.error("Invalid ownerId, cannot send suggestion");
    }
  }
};