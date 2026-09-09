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
        displayText: `⬅️ Prev (Page ${currentPage - 1})`,
        id: `/${cmd} ${currentPage - 1}`
      }
    });
  }
  if (currentPage < totalPages) {
    buttons.push({
      index: idx++,
      quickReplyButton: {
        displayText: `Next ➡️ (Page ${currentPage + 1})`,
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
        displayText: `${emoji} ${name}`.slice(0, 20),
        url: g.inviteLink
      }
    });
    if (idx > 4) break; // WhatsApp max 3-5 buttons per message; cap at 4 for safety
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
    // Fallback: plain text with manual command hints
    try {
      const fallbackText = (content.caption || content.text || '') + '\n\n' +
        buttons.map(b => {
          const qr = b.quickReplyButton;
          if (qr) return `▶️ ${qr.displayText}: ${qr.id}`;
          const url = b.urlButton;
          if (url) return `🔗 ${url.displayText}: ${url.url}`;
          return '';
        }).filter(Boolean).join('\n');
      return await sock.sendMessage(chatId, {
        text: fallbackText,
        ...(content.image ? { image: content.image } : {})
      }, quoted ? { quoted } : {});
    } catch (e2) {
      console.error('Fallback send also failed:', e2.message);
      return sock.sendMessage(chatId, content, quoted ? { quoted } : {});
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
