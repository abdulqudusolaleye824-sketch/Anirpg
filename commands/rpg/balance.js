/**
 * /balance (aliases /wallet, /bal) — Show a player's Nexus + Mana Stone balance.
 */

'use strict';

const UI = require('../../rpg/utils/UI');
const { formatTx } = require('../../rpg/utils/TransactionLog');

function bare(jid) {
  return String(jid).split(':')[0].split('@')[0];
}

module.exports = {
  name: 'balance',
  aliases: ['wallet', 'bal'],
  description: '💠 Show your Nexus + Mana Stones balance',
  usage: '/balance   |   /wallet   |   /bal',
  category: 'economy',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    // Allow viewing another player's balance only in groups by mention/reply.
    const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
    const targetId = mentionedJid || quotedParticipant || sender;

    const player =
      db.users?.[targetId] ||
      db.users?.[bare(targetId)] ||
      db.users?.[bare(sender)] ||
      db.users?.[sender];

    if (!player) {
      return sock.sendMessage(chatId, {
        text: '❌ That player is not registered. Use /register first.',
      }, { quoted: msg });
    }

    const isSelf = bare(targetId) === bare(sender);
    const name = player.name || targetId.split('@')[0];

    const viewer = db.users[sender];
    // transactions are newest-first (unshift) — take the first 3 as-is.
    const txs = Array.isArray(player.transactions) ? player.transactions.slice(0, 3) : [];
    const text = UI.card(viewer, {
      icon: '💠',
      title: isSelf ? 'YOUR BALANCE' : 'PLAYER BALANCE',
      lines: [
        `👤 *${name}*`,
        `💠 *Nexus:* ${UI.num(player.gold)}`,
        `💎 *Mana Stones:* ${UI.num(player.manaCrystals)}`,
        `⬆️ *Upgrade Points:* ${UI.num(player.upgradePoints)}`,
      ],
      proLines: txs.length
        ? [`💎 *PRO LEDGER — last ${txs.length}*`,
           ...txs.map((t) => formatTx(t))]
        : [`💎 *PRO LEDGER*`, `  _No transactions recorded yet._`],
      tip: isSelf ? 'Your wallet, at a glance' : `Viewing ${name}'s wallet`,
    });
    return sock.sendMessage(chatId, { text, mentions: isSelf ? undefined : [targetId] }, { quoted: msg });
  },
};
