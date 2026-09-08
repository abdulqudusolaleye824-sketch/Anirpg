/**
 * /delete — Delete a message in the group (reply to it first).
 * Group-admin tier: the user AND the bot must both be group admins.
 */

'use strict';

const GroupAdmin = require('../../rpg/utils/GroupAdmin');

module.exports = {
  name: 'delete',
  aliases: ['del'],
  description: '🗑️ Delete a message (reply to it)',
  category: 'admin',
  usage: '/delete    (reply to the message you want deleted)',
  availability: 'Group admins (bot must be admin)',
  where: 'Groups only',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    const gate = await GroupAdmin.requireGroupAdmin(sock, chatId, sender, db);
    if (!gate.ok) return sock.sendMessage(chatId, { text: gate.err }, { quoted: msg });

    const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
    const quotedMsgKey = contextInfo?.quotedMessage ? {
      remoteJid: chatId,
      id: contextInfo.stanzaId,
      participant: contextInfo.participant || null,
      fromMe: false,
    } : null;

    if (!quotedMsgKey) {
      return sock.sendMessage(chatId, {
        text: '🗑️ *DELETE A MESSAGE*\n\n📌 *Reply to a message* and type /delete.',
      }, { quoted: msg });
    }

    try {
      await sock.sendMessage(chatId, { delete: quotedMsgKey });
    } catch (e) {
      return sock.sendMessage(chatId, { text: '❌ Failed to delete the message.' }, { quoted: msg });
    }
  },
};
