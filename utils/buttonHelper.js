// ═══════════════════════════════════════════════════════════════
// Astra — Button Helper for Baileys 7.0.0-rc14
// Supports templateButtons (quickReply + url) with fallback to text.
// Handles patchMessageBeforeSending requirement for buttons.
// ═══════════════════════════════════════════════════════════════

'use strict';

/**
 * Build Next/Prev buttons for /pass and /bp
 * @param {number} currentPage - 1-indexed
 * @param {number} totalPages
 * @param {string} prefix - "pass" or "bp"
 * @returns {Array} templateButtons
 */
function buildPassButtons(currentPage, totalPages, prefix) {
  const cmd = prefix.toLowerCase(); // "pass" or "bp" or "battlepass"
  const buttons = [];
  let idx = 1;

  if (currentPage > 1) {
    buttons.push({
      index: idx++,
      quickReplyButton: {
        displayText: `⬅️ Prev`,
        id: `/${cmd} ${currentPage - 1}`
      }
    });
  }
  if (currentPage < totalPages) {
    buttons.push({
      index: idx++,
      quickReplyButton: {
        displayText: `➡️ Next`,
        id: `/${cmd} ${currentPage + 1}`
      }
    });
  }
  // Always add a Claim button for convenience
  buttons.push({
    index: idx++,
    quickReplyButton: {
      displayText: `🎁 Claim`,
      id: `/${cmd} claim`
    }
  });

  return buttons;
}

/**
 * Build URL buttons for /support DM
 * @param {Array} groups - from AstralGroups.getAll().filter(g=>g.isMain)
 * @returns {Array} templateButtons (urlButtons)
 */
function buildSupportButtons(groups) {
  const buttons = [];
  let idx = 1;
  for (const g of groups) {
    if (!g.inviteLink) continue;
    // WhatsApp limits displayText to 20 chars, URL to 512
    const name = (g.typeInfo?.name || g.type || 'Group').replace(/[^a-zA-Z0-9 ]/g, '').trim().slice(0, 18) || g.type;
    const emoji = g.typeInfo?.emoji || '🔗';
    buttons.push({
      index: idx++,
      urlButton: {
        displayText: `${emoji} ${name}`.slice(0, 30),
        url: g.inviteLink
      }
    });
    if (idx > 10) break; // Allow up to 10 URL buttons (screenshot shows 6)
  }
  return buttons;
}

/**
 * Build Party Join button
 * @param {string} key - gate/party key
 * @returns {Array} templateButtons
 */
function buildPartyJoinButton(key) {
  return [
    {
      index: 1,
      quickReplyButton: {
        displayText: `✅ Join Party`,
        id: `/party join ${key}`
      }
    },
    {
      index: 2,
      quickReplyButton: {
        displayText: `📊 Party Status`,
        id: `/party status`
      }
    }
  ];
}

/**
 * Build Guild-restricted party join button with extra info
 * Same as above but caller can decide to show blocked message instead
 */
function buildPartyButtons(key, options = {}) {
  const buttons = [
    {
      index: 1,
      quickReplyButton: {
        displayText: options.joinText || `✅ Join Party`,
        id: `/party join ${key}`
      }
    }
  ];
  if (options.showStatus) {
    buttons.push({
      index: 2,
      quickReplyButton: {
        displayText: `📊 Status`,
        id: `/party status`
      }
    });
  }
  return buttons;
}

/**
 * Send a message with templateButtons, handling image+caption vs text
 * Falls back to plain text if button send fails
 */
async function sendWithButtons(sock, chatId, content, buttons, quoted) {
  if (!buttons || buttons.length === 0) {
    return sock.sendMessage(chatId, content, quoted ? { quoted } : {});
  }

  // Try templateButtons first (most compatible with rc14)
  const hasImage = !!content.image;

  try {
    if (hasImage) {
      // Image + buttons: Baileys requires caption + footer + templateButtons
      const msg = {
        image: content.image,
        caption: content.caption || content.text || '',
        footer: content.footer || `Page ${content.page || ''}`.trim() || 'Astra RPG',
        templateButtons: buttons,
      };
      if (content.mimetype) msg.mimetype = content.mimetype;
      return await sock.sendMessage(chatId, msg, quoted ? { quoted } : {});
    } else {
      const msg = {
        text: content.text || content.caption || '',
        footer: content.footer || 'Astra RPG',
        templateButtons: buttons,
      };
      return await sock.sendMessage(chatId, msg, quoted ? { quoted } : {});
    }
  } catch (e) {
    console.error('⚠️ templateButtons send failed, falling back to plain:', e.message);
    // Fallback: plain text with manual command hints — handle image vs text correctly
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
        return await sock.sendMessage(chatId, {
          image: content.image,
          caption: fallbackText,
          mimetype: content.mimetype || 'image/png'
        }, quoted ? { quoted } : {});
      }
      return await sock.sendMessage(chatId, {
        text: fallbackText
      }, quoted ? { quoted } : {});
    } catch (e2) {
      console.error('Fallback send also failed:', e2.message);
      // Final fallback without buttons
      if (hasImage) {
        return sock.sendMessage(chatId, { image: content.image, caption: content.caption || content.text || '', mimetype: content.mimetype || 'image/png' }, quoted ? { quoted } : {});
      }
      return sock.sendMessage(chatId, { text: content.text || content.caption || '' }, quoted ? { quoted } : {});
    }
  }
}

/**
 * Patch function for makeWASocket to enable buttons/templateMessages
 * Usage in makeWASocket: { patchMessageBeforeSending: patchMessageBeforeSending }
 */
function patchMessageBeforeSending(message) {
  const requiresPatch = !!(
    message.buttonsMessage ||
    message.templateMessage ||
    message.listMessage ||
    message.templateButtons ||
    message.buttons
  );
  if (requiresPatch) {
    message = {
      viewOnceMessage: {
        message: {
          messageContextInfo: {
            deviceListMetadataVersion: 2,
            deviceListMetadata: {},
          },
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
  patchMessageBeforeSending
};
