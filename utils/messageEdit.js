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
  if (!String(newText ?? '').replace(/[\u200b-\u200f\u2060-\u206f\ufeff\u061c]/g, '').trim()) {
    throw new Error('editMessage: refusing to blank a message (empty newText)');
  }
  return sock.sendMessage(chatId, { text: newText, edit: key });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

module.exports = { editMessage, extractKey, sleep };
