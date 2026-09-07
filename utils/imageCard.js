// ═══════════════════════════════════════════════════════════════
// Astra — Image Card Helper
//
// Sends a "trading card" for any entity:
//   Message 1: generated artwork (if available)
//   Message 2: rarity tag + stats + lore
//
// If no image is on disk, sends a fallback card with a colored
// header bar and the same text — never silent.
//
// Uses the multi-message system via the chunkedSock proxy.
// ═══════════════════════════════════════════════════════════════

'use strict';

const fs = require('fs');
const path = require('path');
const Asset = require('../rpg/utils/AssetManager');

const CHUNK_SIZE = 3500;

// Fallback card dimensions (WhatsApp doesn't support inline SVG,
// so we just send text styled to look like a card frame).
const FALLBACK_CARD_TOP = '╔════════════════════════════════╗';
const FALLBACK_CARD_BOT = '╚════════════════════════════════╝';

function buildFallbackCard({ name, kind, rarity, stats, lore, extra }) {
  const lines = Asset.buildCardText({ name, kind, rarity, stats, lore, extra });
  // Wrap in a visual frame
  return `${FALLBACK_CARD_TOP}\n${lines}\n${FALLBACK_CARD_BOT}`;
}

/**
 * Send a two-message card for an entity.
 *
 * @param {object} sock — Baileys socket (or chunkedSock proxy)
 * @param {string} jid — destination JID
 * @param {object} entity — { kind, name, rarity?, tier?, stats?, lore?, extra?, quoted? }
 * @param {object} opts — { quoted, header? }
 *
 * `entity.lore` is auto-resolved from Asset.LORE if not provided.
 * If no image is on disk, sends a single text card (no separate
 * image message) so the user always gets something.
 */
async function sendImageCard(sock, jid, entity, opts = {}) {
  const { kind, name, rarity, tier, stats, extra } = entity;
  const lore = entity.lore || Asset.getLore(name, kind, { rarity });

  // Resolve image
  const imgEntry = Asset.getImage({ kind, name, rarity, tier });
  const sections = [];

  if (imgEntry.exists) {
    // Read the file → upload as buffer → send as image
    try {
      const buf = await fs.promises.readFile(imgEntry.path);
      const payload = { image: buf, caption: '' };
      sections.push(payload);
    } catch (e) {
      console.warn(`[imageCard] failed to read ${imgEntry.path}: ${e.message}`);
      sections.push({ text: buildFallbackCard({ name, kind, rarity, stats, lore, extra }) });
    }
  } else {
    // No image yet — use the fallback framed card
    sections.push({ text: buildFallbackCard({ name, kind, rarity, stats, lore, extra }) });
  }

  // Always send the stats/lore as a separate message for readability
  const cardText = Asset.buildCardText({ name, kind, rarity, stats, lore, extra });
  sections.push({ text: cardText });

  return sock.sendMessage(jid, {
    mentions: opts.mentions,
    sections,
  }, { quoted: opts.quoted });
}

/**
 * Send just the lore+stats block (for places where you want
 * inline text but no separate image).
 */
async function sendLoreCard(sock, jid, entity, opts = {}) {
  const { kind, name, rarity, tier, stats, extra } = entity;
  const lore = entity.lore || Asset.getLore(name, kind, { rarity });
  const text = Asset.buildCardText({ name, kind, rarity, stats, lore, extra });
  return sock.sendMessage(jid, { text }, { quoted: opts.quoted });
}

module.exports = {
  sendImageCard,
  sendLoreCard,
  buildFallbackCard,
  CHUNK_SIZE,
};
