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

    let msgContent;
    if (hasImage) {
      // media + interactive needs special handling: use sock.sendMessage with image + interactiveButtons if available
      // Try direct sendMessage with interactiveButtons + image first (newer Baileys helper)
      try {
        // Direct interactive with image via sendMessage (if Baileys patched)
        const direct = {
          image: content.image,
          caption: bodyText,
          footer: footerText,
          interactiveButtons: interactiveButtons
        };
        if (content.mimetype) direct.mimetype = content.mimetype;
        await sock.sendMessage(chatId, direct, quoted ? { quoted } : {});
        return true;
      } catch (e) {
        // Fallback to generateWAMessage + relay
      }
      // Fallback: generateWAMessageFromContent with image
      const mtype = content.mimetype || 'image/jpeg';
      // For image interactive, we need to use relay with viewOnce wrapper
      const waMsg = generateWAMessageFromContent(chatId, {
        viewOnceMessage: {
          message: {
            messageContextInfo: { deviceListMetadataVersion: 2, deviceListMetadata: {} },
            interactiveMessage
          }
        }
      }, { quoted: quoted || undefined });
      // Attach image via uploaded media? Instead relay will need image node.
      // Simpler: send image first, then interactive text buttons as follow-up (guaranteed to show)
      // We'll do two-step: image alone, then interactive text
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
  const hasUrlButton = buttons.some(b => !!b.urlButton);
  const hasOnlyQuickReply = buttons.every(b => !!b.quickReplyButton);

  // ── 1) For URL buttons (support): try legacy templateButtons FIRST — Sapphire on Business used this and it renders on Business, while interactive often does not for non-Business numbers
  if (hasUrlButton) {
    try {
      // Truncate caption to 1000 for templateButtons as well
      let cap = content.caption || content.text || '';
      if (cap.length > 1000) cap = cap.slice(0, 1000) + '…';
      // Limit buttons to 3 for template (WhatsApp limit) — extra will be shown as plain links in final fallback
      const limitedButtons = buttons.slice(0, 3);
      if (hasImage) {
        const msg = {
          image: content.image,
          caption: cap,
          footer: content.footer || 'Astra RPG',
          templateButtons: limitedButtons,
        };
        if (content.mimetype) msg.mimetype = content.mimetype;
        await sock.sendMessage(chatId, msg, quoted ? { quoted } : {});
        return;
      } else {
        const msg = {
          text: cap,
          footer: content.footer || 'Astra RPG',
          templateButtons: limitedButtons,
        };
        await sock.sendMessage(chatId, msg, quoted ? { quoted } : {});
        return;
      }
    } catch (e) {
      console.error('⚠️ templateButtons (url) send failed, trying interactive:', e.message);
    }
    // Fallthrough to interactive for url as second attempt
  }

  // ── 2) Try modern interactive (nativeFlow) — best for quickReply ---
  if (interactiveButtons.length > 0) {
    // First try direct sendMessage with interactiveButtons (some Baileys forks support this directly)
    try {
      const footerText = content.footer || 'Astra™ 2026';
      // Truncate caption for interactive limits (1024)
      let capInteractive = content.caption || content.text || '';
      if (capInteractive.length > 1000) capInteractive = capInteractive.slice(0, 1000) + '…';
      if (hasImage) {
        const directInteractive = {
          image: content.image,
          caption: capInteractive,
          footer: footerText,
          interactiveButtons: interactiveButtons
        };
        if (content.mimetype) directInteractive.mimetype = content.mimetype;
        if (content.title) directInteractive.title = content.title;
        await sock.sendMessage(chatId, directInteractive, quoted ? { quoted } : {});
        return;
      } else {
        const directInteractive = {
          text: content.text || content.caption || '',
          footer: footerText,
          interactiveButtons: interactiveButtons
        };
        if (content.title) directInteractive.title = content.title;
        await sock.sendMessage(chatId, directInteractive, quoted ? { quoted } : {});
        return;
      }
    } catch (e) {
      console.error('⚠️ direct interactiveButtons send failed, trying generateWAMessage:', e.message);
    }

    // Second try: generateWAMessageFromContent + relay (more reliable)
    const ok = await trySendInteractive(sock, chatId, content, interactiveButtons, quoted);
    if (ok) return;
  }

  // ── 3) Fallback: simple buttons (quickReply only, most compatible for text+buttons) ─────
  // Only for quickReply buttons (pass/bp/party), not for urlButtons (support)
  if (hasOnlyQuickReply) {
    try {
      const simpleButtons = buttons.map(b => ({
        buttonId: b.quickReplyButton.id,
        buttonText: { displayText: b.quickReplyButton.displayText },
        type: 1
      }));
      const captionText = content.caption || content.text || '';
      // Truncate caption to 900 chars for buttonsMessage limit
      const truncated = captionText.length > 900 ? captionText.slice(0, 900) + '… (truncated)' : captionText;
      if (hasImage) {
        // For image+buttons with simple buttons, some clients require headerType
        await sock.sendMessage(chatId, {
          image: content.image,
          caption: truncated,
          footer: content.footer || 'Astra™ 2026',
          buttons: simpleButtons,
          headerType: 4
        }, quoted ? { quoted } : {});
        return;
      } else {
        await sock.sendMessage(chatId, {
          text: truncated,
          footer: content.footer || 'Astra™ 2026',
          buttons: simpleButtons,
          headerType: 1
        }, quoted ? { quoted } : {});
        return;
      }
    } catch (e) {
      console.error('⚠️ simple buttons send failed:', e.message);
    }
  }

  // ── 4) Fallback: legacy templateButtons (viewOnce wrapper) — quickReply or second chance for url ─────
  try {
    // Truncate caption to 1000 for templateButtons as well
    let cap = content.caption || content.text || '';
    if (cap.length > 1000) cap = cap.slice(0, 1000) + '…';
    if (hasImage) {
      const msg = {
        image: content.image,
        caption: cap,
        footer: content.footer || 'Astra RPG',
        templateButtons: buttons,
      };
      if (content.mimetype) msg.mimetype = content.mimetype;
      return await sock.sendMessage(chatId, msg, quoted ? { quoted } : {});
    } else {
      const msg = {
        text: cap,
        footer: content.footer || 'Astra RPG',
        templateButtons: buttons,
      };
      return await sock.sendMessage(chatId, msg, quoted ? { quoted } : {});
    }
  } catch (e) {
    console.error('⚠️ templateButtons send failed, falling back to plain:', e.message);
  }

  // ── 5) Final fallback: plain text with manual hints (ensures Business clients without button support still get clickable links) ────────────
  try {
    const buttonHints = buttons.map(b => {
      const qr = b.quickReplyButton;
      if (qr) return `▶️ ${qr.displayText}: ${qr.id}`;
      const url = b.urlButton;
      if (url) return `🔗 ${url.displayText}: ${url.url}`;
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
  sendWithButtons,
  patchMessageBeforeSending,
  templateToInteractive
};
