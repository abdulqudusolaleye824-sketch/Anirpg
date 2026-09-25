// ═══════════════════════════════════════════════════════════════
// OUTGOING GUARD — Push #88
// Inspect the FINAL WhatsApp proto before it leaves the socket. Refuses any
// message that would render as a bubble with no letter/digit (or a media
// bubble with no uploaded payload), and keeps a ring buffer of every send
// so a blank bubble can be traced to its origin (/api/sends).
// ═══════════════════════════════════════════════════════════════
'use strict';

const _SEND_RING = [];
const _SEND_RING_MAX = 4000;
function _logSend(bot, jid, kind, status, preview) {
  _SEND_RING.push({ t: Date.now(), bot, jid: String(jid || ''), kind, status, preview: String(preview || '').slice(0, 60) });
  if (_SEND_RING.length > _SEND_RING_MAX) _SEND_RING.splice(0, _SEND_RING.length - _SEND_RING_MAX);
}
function getSendLog(n = 200, jid = null) {
  let arr = _SEND_RING;
  if (jid) arr = arr.filter(x => x.jid.includes(jid));
  return arr.slice(-Math.max(1, Math.min(600, n)));
}
const _HAS_LETTER = (s) => /[\p{L}\p{N}]/u.test(String(s ?? '').replace(/[\u200b-\u200f\u2060-\u206f\ufeff\u061c]/g, ''));
function _unwrapOutgoing(m) {
  let cur = m, guard = 0;
  while (cur && typeof cur === 'object' && guard++ < 8) {
    if (cur.ephemeralMessage?.message) { cur = cur.ephemeralMessage.message; continue; }
    if (cur.viewOnceMessage?.message) { cur = cur.viewOnceMessage.message; continue; }
    if (cur.viewOnceMessageV2?.message) { cur = cur.viewOnceMessageV2.message; continue; }
    if (cur.viewOnceMessageV2Extension?.message) { cur = cur.viewOnceMessageV2Extension.message; continue; }
    if (cur.documentWithCaptionMessage?.message) { cur = cur.documentWithCaptionMessage.message; continue; }
    if (cur.editedMessage?.message) { cur = cur.editedMessage.message; continue; }
    if (cur.deviceSentMessage?.message) { cur = cur.deviceSentMessage.message; continue; }
    break;
  }
  return cur || {};
}
// Returns { ok, kind, reason?, preview, keys }
function inspectOutgoing(message) {
  const m = _unwrapOutgoing(message);
  const keys = Object.keys(m || {}).filter(k => k !== 'messageContextInfo' && k !== 'senderKeyDistributionMessage');
  const ks = keys.join(',');
  const has = (k) => m && m[k] != null;
  // Non-rendering / functional payloads — always fine.
  if (has('protocolMessage')) {
    const pm = m.protocolMessage || {};
    // An EDIT that blanks the message is a blank bubble.
    if (pm.editedMessage) { const em = _unwrapOutgoing(pm.editedMessage); const t = em.conversation ?? em.extendedTextMessage?.text ?? em.imageMessage?.caption ?? em.videoMessage?.caption; if (t != null && !_HAS_LETTER(t)) return { ok: false, kind: 'edit', reason: 'EMPTY-EDIT', preview: '', keys: ks }; }
    return { ok: true, kind: 'protocol', preview: '', keys: ks };
  }
  if (has('reactionMessage')) return { ok: true, kind: 'react', preview: m.reactionMessage.text || '', keys: ks };
  if (has('senderKeyDistributionMessage') && !keys.length) return { ok: true, kind: 'skdm', preview: '', keys: ks };
  if (has('pollCreationMessage') || has('pollCreationMessageV2') || has('pollCreationMessageV3')) {
    const p = m.pollCreationMessage || m.pollCreationMessageV2 || m.pollCreationMessageV3;
    return _HAS_LETTER(p && p.name) ? { ok: true, kind: 'poll', preview: p.name, keys: ks } : { ok: false, kind: 'poll', reason: 'EMPTY-POLL', preview: '', keys: ks };
  }
  if (has('pollUpdateMessage')) return { ok: true, kind: 'pollvote', preview: '', keys: ks };
  // Text
  if (has('conversation')) return _HAS_LETTER(m.conversation) ? { ok: true, kind: 'text', preview: m.conversation, keys: ks } : { ok: false, kind: 'text', reason: 'EMPTY-TEXT', preview: m.conversation, keys: ks };
  if (has('extendedTextMessage')) { const t = m.extendedTextMessage.text; return _HAS_LETTER(t) ? { ok: true, kind: 'text', preview: t, keys: ks } : { ok: false, kind: 'text', reason: 'EMPTY-TEXT', preview: t, keys: ks }; }
  // Media — must carry an uploaded payload (url/directPath) or it renders as a dead bubble.
  for (const k of ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage', 'ptvMessage']) {
    if (!has(k)) continue;
    const mm = m[k] || {};
    const uploaded = !!(mm.url || mm.directPath || mm.mediaKey);
    if (!uploaded) return { ok: false, kind: k, reason: 'MEDIA-NOT-UPLOADED', preview: mm.caption || '', keys: ks };
    if (mm.fileLength != null && Number(mm.fileLength) === 0) return { ok: false, kind: k, reason: 'MEDIA-ZERO-BYTES', preview: mm.caption || '', keys: ks };
    return { ok: true, kind: k, preview: mm.caption || mm.fileName || '', keys: ks };
  }
  if (has('contactMessage')) return _HAS_LETTER(m.contactMessage.vcard) ? { ok: true, kind: 'contact', preview: m.contactMessage.displayName || '', keys: ks } : { ok: false, kind: 'contact', reason: 'EMPTY-CONTACT', preview: '', keys: ks };
  if (has('contactsArrayMessage')) { const arr = m.contactsArrayMessage.contacts || []; return arr.some(c => _HAS_LETTER(c && c.vcard)) ? { ok: true, kind: 'contacts', preview: '', keys: ks } : { ok: false, kind: 'contacts', reason: 'EMPTY-CONTACTS', preview: '', keys: ks }; }
  if (has('locationMessage') || has('liveLocationMessage')) { const l = m.locationMessage || m.liveLocationMessage; return (l.degreesLatitude != null && l.degreesLongitude != null) ? { ok: true, kind: 'location', preview: '', keys: ks } : { ok: false, kind: 'location', reason: 'EMPTY-LOCATION', preview: '', keys: ks }; }
  // Interactive / buttons / lists — body text (or a media header) must carry a letter.
  if (has('interactiveMessage')) {
    const im = m.interactiveMessage || {};
    const body = im.body && im.body.text;
    const hdrMedia = im.header && (im.header.imageMessage || im.header.videoMessage || im.header.documentMessage);
    const title = im.header && im.header.title;
    if (_HAS_LETTER(body) || _HAS_LETTER(title) || hdrMedia) return { ok: true, kind: 'interactive', preview: body || title || '', keys: ks };
    return { ok: false, kind: 'interactive', reason: 'EMPTY-INTERACTIVE', preview: '', keys: ks };
  }
  if (has('buttonsMessage')) { const b = m.buttonsMessage; const t = b.contentText || b.text; return (_HAS_LETTER(t) || b.imageMessage) ? { ok: true, kind: 'buttons', preview: t || '', keys: ks } : { ok: false, kind: 'buttons', reason: 'EMPTY-BUTTONS', preview: '', keys: ks }; }
  if (has('listMessage')) { const l = m.listMessage; return (_HAS_LETTER(l.description) || _HAS_LETTER(l.title)) ? { ok: true, kind: 'list', preview: l.title || l.description || '', keys: ks } : { ok: false, kind: 'list', reason: 'EMPTY-LIST', preview: '', keys: ks }; }
  if (has('templateMessage')) { const t = m.templateMessage; const h = t.hydratedTemplate || t.hydratedFourRowTemplate || {}; return (_HAS_LETTER(h.hydratedContentText) || h.imageMessage) ? { ok: true, kind: 'template', preview: h.hydratedContentText || '', keys: ks } : { ok: false, kind: 'template', reason: 'EMPTY-TEMPLATE', preview: '', keys: ks }; }
  if (has('groupInviteMessage')) return { ok: true, kind: 'invite', preview: m.groupInviteMessage.groupName || '', keys: ks };
  if (has('productMessage') || has('orderMessage') || has('requestPaymentMessage') || has('eventMessage')) return { ok: true, kind: keys[0], preview: '', keys: ks };
  // Nothing renderable at all → this IS the blank bubble.
  return { ok: false, kind: keys[0] || 'none', reason: 'NO-RENDERABLE-CONTENT', preview: '', keys: ks };
}


module.exports = { inspectOutgoing, hasLetter: _HAS_LETTER, unwrapOutgoing: _unwrapOutgoing, logSend: _logSend, getSendLog };
