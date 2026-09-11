// ═══════════════════════════════════════════════════════════════
// Astra — Bot message-edit utility (Baileys 7 MESSAGE_EDIT protocol)
// editMessage(sock, chatId, sentMsgOrKey, newText) edits a message the
// bot previously sent. sentMsgOrKey is either the sendMessage result
// (uses its .key) or a raw key object { remoteJid, id, fromMe }.
// ═══════════════════════════════════════════════════════════════

'use strict';

function extractKey(sentMsgOrKey) {
  if (!sentMsgOrKey) return null;
  return sentMsgOrKey.key || sentMsgOrKey;
}

async function editMessage(sock, chatId, sentMsgOrKey, newText) {
  const key = extractKey(sentMsgOrKey);
  if (!key || !key.id) throw new Error('editMessage: no message key to edit');
  return sock.sendMessage(chatId, { text: newText, edit: key });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

module.exports = { editMessage, extractKey, sleep };
