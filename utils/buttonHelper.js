// ═══════════════════════════════════════════════════════════════
// Astra — Button Helper for Baileys 7.0.0-rc14
// Supports BOTH legacy templateButtons (quickReply + url) AND modern
// interactiveButtons (nativeFlow) — tries interactive first since
// templateButtons is deprecated and no longer renders on WhatsApp.
// Handles image+caption vs text, patchMessageBeforeSending, and
// fallback to plain text with hints if all button methods fail.
// ═══════════════════════════════════════════════════════════════

'use strict';

let generateWAMessageFromContent = null;
let proto = null;
try {
  const baileys = require('@whiskeysockets/baileys');
  generateWAMessageFromContent = baileys.generateWAMessageFromContent;
  proto = baileys.proto;
} catch (e) {
  // Baileys not available in snapshot cache — will fallback to templateButtons
}

/**
 * Build Next/Prev buttons for /pass and /bp (legacy template format)
 * Returned value is converted to interactive inside sendWithButtons,
 * so callers don't need to change.
 */
function buildPassButtons(currentPage, totalPages, prefix) {
  const cmd = prefix.toLowerCase();
  const buttons = [];
  let idx = 1;
  if (currentPage > 1) {
    buttons.push({ index: idx++, quickReplyButton: { displayText: `⬅️ Prev`, id: `/${cmd} ${currentPage - 1}` } });
  }
  if (currentPage < totalPages) {
    buttons.push({ index: idx++, quickReplyButton: { displayText: `➡️ Next`, id: `/${cmd} ${currentPage + 1}` } });
  }
  buttons.push({ index: idx++, quickReplyButton: { displayText: `🎁 Claim`, id: `/${cmd} claim` } });
  return buttons;
}

function buildSupportButtons(groups) {
  const buttons = [];
  let idx = 1;
  for (const g of groups) {
    if (!g.inviteLink) continue;
    const name = (g.typeInfo?.name || g.type || 'Group').replace(/[^a-zA-Z0-9 ]/g, '').trim().slice(0, 18) || g.type;
    const emoji = g.typeInfo?.emoji || '🔗';
    buttons.push({ index: idx++, urlButton: { displayText: `${emoji} ${name}`.slice(0, 30), url: g.inviteLink } });
    if (idx > 10) break;
  }
  return buttons;
}

function buildPartyJoinButton(key) {
  return [
    { index: 1, quickReplyButton: { displayText: `✅ Join Party`, id: `/party join ${key}` } },
    { index: 2, quickReplyButton: { displayText: `📊 Party Status`, id: `/party status` } },
  ];
}

function buildPartyButtons(key, options = {}) {
  const buttons = [{ index: 1, quickReplyButton: { displayText: options.joinText || `✅ Join Party`, id: `/party join ${key}` } }];
  if (options.showStatus) buttons.push({ index: 2, quickReplyButton: { displayText: `📊 Status`, id: `/party status` } });
  return buttons;
}

/**
 * Generic button builders — the reusable button-config API for all features
 * (party, passes, cashout, ...). Pass [displayText, id-or-url] pairs.
 * Returns legacy template-format buttons; sendWithButtons converts them
 * to interactive (nativeFlow) at send time.
 */
function buildQuickReplies(pairs) {
  return (pairs || []).slice(0, 5).map(([text, id], i) => ({
    index: i + 1,
    quickReplyButton: { displayText: String(text).slice(0, 30), id: String(id) },
  }));
}
function buildUrlButtons(pairs) {
  return (pairs || []).slice(0, 5).map(([text, url], i) => ({
    index: i + 1,
    urlButton: { displayText: String(text).slice(0, 30), url: String(url) },
  }));
}

/**
 * Convert legacy templateButtons (quickReplyButton/urlButton) to
 * interactiveButtons (nativeFlow) format.
 */
function templateToInteractive(templateButtons) {
  const interactive = [];
  for (const b of templateButtons) {
    if (b.quickReplyButton) {
      interactive.push({
        name: 'quick_reply',
        buttonParamsJson: JSON.stringify({ display_text: b.quickReplyButton.displayText, id: b.quickReplyButton.id })
      });
    } else if (b.urlButton) {
      interactive.push({
        name: 'cta_url',
        buttonParamsJson: JSON.stringify({ display_text: b.urlButton.displayText, url: b.urlButton.url, merchant_url: b.urlButton.url })
      });
    } else if (b.callButton) {
      interactive.push({
        name: 'cta_call',
        buttonParamsJson: JSON.stringify({ display_text: b.callButton.displayText, phone_number: b.callButton.phoneNumber })
      });
    }
  }
  return interactive;
}

/**
 * Try to send via interactiveMessage (nativeFlow) — the currently
 * working method for WhatsApp Business. Returns true on success, false on failure.
 */
async function trySendInteractive(sock, chatId, content, interactiveButtons, quoted) {
  if (!generateWAMessageFromContent || !proto) return false;
  const hasImage = !!content.image;
  const bodyText = content.caption || content.text || '';
  const footerText = content.footer || 'Astra™ 2026';
  const titleText = content.title || undefined;

  try {
    let header = undefined;
    let body = { text: bodyText };
    let footer = footerText ? { text: footerText } : undefined;

    // Build nativeFlow buttons
    const nativeFlowMessage = proto.Message.InteractiveMessage.NativeFlowMessage.create({
      buttons: interactiveButtons
    });

    if (hasImage) {
      // For media interactive, header hasMediaAttachment = true and we attach image via generateWAMessage
      // We'll use the approach from shizo-devs example: pass image as media with caption
      header = proto.Message.InteractiveMessage.Header.create({
        title: titleText || bodyText.slice(0, 30) || 'Astra',
        subtitle: undefined,
        hasMediaAttachment: true
      });
    } else {
      header = proto.Message.InteractiveMessage.Header.create({
        title: titleText || undefined,
        subtitle: undefined,
        hasMediaAttachment: false
      });
      if (titleText) body = { text: bodyText };
    }

    const interactiveMessage = proto.Message.InteractiveMessage.create({
      body: proto.Message.InteractiveMessage.Body.create({ text: bodyText }),
      footer: footer ? proto.Message.InteractiveMessage.Footer.create(footer) : undefined,
      header: header,
      nativeFlowMessage
    });

    if (hasImage) {
      // Media + interactive in a single message needs an uploaded-media header,
      // so deliver in two guaranteed steps: the image first, then the buttons.
      // (Direct sock.sendMessage with `interactiveButtons` is NOT attempted —
      // Baileys 7 drops the unknown key and reports success with no buttons.)
      const mtype = content.mimetype || 'image/jpeg';
      await sock.sendMessage(chatId, { image: content.image, caption: bodyText, mimetype: mtype }, quoted ? { quoted } : {});
      const waMsg2 = generateWAMessageFromContent(chatId, {
        viewOnceMessage: {
          message: {
            messageContextInfo: { deviceListMetadataVersion: 2, deviceListMetadata: {} },
            interactiveMessage: proto.Message.InteractiveMessage.create({
              body: proto.Message.InteractiveMessage.Body.create({ text: `Tap a button below:` }),
              footer: proto.Message.InteractiveMessage.Footer.create({ text: footerText }),
              header: proto.Message.InteractiveMessage.Header.create({ title: 'Astra™', subtitle: undefined, hasMediaAttachment: false }),
              nativeFlowMessage
            })
          }
        }
      }, {});
      await sock.relayMessage(chatId, waMsg2.message, { messageId: waMsg2.key.id });
      return true;
    } else {
      const waMsg = generateWAMessageFromContent(chatId, {
        viewOnceMessage: {
          message: {
            messageContextInfo: { deviceListMetadataVersion: 2, deviceListMetadata: {} },
            interactiveMessage
          }
        }
      }, { quoted: quoted || undefined });
      await sock.relayMessage(chatId, waMsg.message, { messageId: waMsg.key.id });
      return true;
    }
  } catch (e) {
    console.error('⚠️ interactive send failed:', e.message);
    return false;
  }
}

/**
 * Send a message with buttons, handling image+caption vs text
 * Strategy:
 * - For quickReply-only (pass/bp/party): try interactive first (modern), then simple buttons, then template
 * - For urlButtons (support: cta_url): try legacy templateButtons FIRST (proven on WhatsApp Business — Sapphire bot on Business used this), then interactive, then plain with links. Business accounts often require template for cta_url.
 */
async function sendWithButtons(sock, chatId, content, buttons, quoted) {
  if (!buttons || buttons.length === 0) {
    return sock.sendMessage(chatId, content, quoted ? { quoted } : {});
  }

  const hasImage = !!content.image;
  const interactiveButtons = templateToInteractive(buttons);

  // ── 1) Interactive (nativeFlow) via generate+relay — the ONLY path Baileys 7
  // delivers. NOTE: sock.sendMessage does NOT understand `interactiveButtons`,
  // `templateButtons` or `buttons` keys in v7 (verified against 7.0.0-rc14) —
  // it drops unknown keys and resolves successfully, which would silently
  // swallow the buttons AND skip every fallback below. Those keys are
  // therefore never attempted here.
  if (interactiveButtons.length > 0) {
    const ok = await trySendInteractive(sock, chatId, content, interactiveButtons, quoted);
    if (ok) return;
    console.error('⚠️ interactive relay failed, falling back to plain text with hints');
  }

  // ── 2) Plain text with manual hints (renders on every client) ────────────
  try {
    const buttonHints = buttons.map(b => {
      const qr = b.quickReplyButton;
      if (qr) return `▶️ ${qr.displayText}: ${qr.id}`;
      const url = b.urlButton;
      if (url) return `🔗 ${url.displayText}: ${url.url}`;
      const call = b.callButton;
      if (call) return `📞 ${call.displayText}: ${call.phoneNumber}`;
      return '';
    }).filter(Boolean).join('\n');
    const baseText = content.caption || content.text || '';
    const fallbackText = baseText + (buttonHints ? '\n\n' + buttonHints : '');
    if (hasImage) {
      return await sock.sendMessage(chatId, { image: content.image, caption: fallbackText, mimetype: content.mimetype || 'image/png' }, quoted ? { quoted } : {});
    }
    return await sock.sendMessage(chatId, { text: fallbackText }, quoted ? { quoted } : {});
  } catch (e2) {
    console.error('Fallback send also failed:', e2.message);
    if (hasImage) return sock.sendMessage(chatId, { image: content.image, caption: content.caption || content.text || '', mimetype: content.mimetype || 'image/png' }, quoted ? { quoted } : {});
    return sock.sendMessage(chatId, { text: content.text || content.caption || '' }, quoted ? { quoted } : {});
  }
}
function patchMessageBeforeSending(message) {
  const requiresPatch = !!(message.buttonsMessage || message.templateMessage || message.listMessage || message.templateButtons || message.buttons || message.interactiveMessage || message.interactiveButtons);
  if (requiresPatch) {
    message = {
      viewOnceMessage: {
        message: {
          messageContextInfo: { deviceListMetadataVersion: 2, deviceListMetadata: {} },
          ...message,
        },
      },
    };
  }
  return message;
}

module.exports = {
  buildPassButtons,
  buildSupportButtons,
  buildPartyJoinButton,
  buildPartyButtons,
  buildQuickReplies,
  buildUrlButtons,
  sendWithButtons,
  patchMessageBeforeSending,
  templateToInteractive
};
