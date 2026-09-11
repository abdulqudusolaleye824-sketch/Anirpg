// buttontest — owner-only interactive-button diagnostic.
// Sends one native button message (tap-back + URL + copy) and reports which
// delivery mode fired. Tapping ✅ sends `/buttontest tap`, which lands here
// and proves the full round trip: render → tap → route → execute.
'use strict';

const Perms = require('../../utils/permissions');
const Buttons = (() => { try { return require('../../utils/buttons'); } catch (e) { return null; } })();

module.exports = {
  name: 'buttontest',
  description: '🔘 Owner-only button-system diagnostic',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    if (!Perms.isBotOwner(db, sender)) {
      return sock.sendMessage(chatId, { text: '❌ Owner only.' }, { quoted: msg });
    }

    // Tap-back landing: the ✅ button below sends exactly this.
    if ((args[0] || '').toLowerCase() === 'tap') {
      return sock.sendMessage(chatId, {
        text: '✅ *BUTTONS WORK* — tap received and routed correctly.',
      }, { quoted: msg });
    }

    if (!Buttons || typeof Buttons.sendButtons !== 'function') {
      return sock.sendMessage(chatId, { text: '❌ Button module failed to load.' }, { quoted: msg });
    }

    const res = await Buttons.sendButtons(sock, chatId, {
      text: '🔘 *BUTTON TEST*\n\nIf you see tappable buttons below, the system works.\nTap ✅ to confirm the round trip.',
      footer: 'Astra diagnostics',
      buttons: [
        ...Buttons.quickReplies([[`✅ Tap me`, `/buttontest tap`]]),
        ...Buttons.urlButtons([[`🔗 WhatsApp`, `https://whatsapp.com`]]),
        ...Buttons.copyButtons([[`📋 Copy code`, `ASTRA-OK`]]),
      ],
    }, msg);

    const plural = res.chunks === 1 ? '' : 's';
    return sock.sendMessage(chatId, {
      text: `📊 Send mode: *${res.mode}* (${res.chunks} interactive chunk${plural}).` +
        (res.mode === 'interactive'
          ? ''
          : '\n⚠️ Native send unavailable here — numbered/text fallback delivered.'),
    }, { quoted: msg });
  },
};
