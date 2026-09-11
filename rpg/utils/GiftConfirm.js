// ═══════════════════════════════════════════════════════════════
// GiftConfirm — PRO epic-and-up gift confirmation (batch-22).
//
// /equip gift and /items give share this module: when a PRO player sends
// an item of EPIC tier or higher, the gift is HELD and a short prompt
// (item name + "really send?") with Confirm/Cancel buttons is shown.
// Tapping Confirm completes the SAME transfer the instant path performs;
// Cancel (or a 120s expiry) aborts and the item stays put.
//
// Non-pro senders and below-epic items bypass this entirely (instant).
// State is an in-memory Map keyed by GIVER jid, so only the giver's own
// tap (or typed command) can confirm — anyone else gets "no pending".
// ═══════════════════════════════════════════════════════════════
'use strict';

const TTL_MS = 120_000;
const TIER_RANK = { mythic: 0, legendary: 1, epic: 2, rare: 3, uncommon: 4, common: 5 };

// giverJid -> { itemName, rarity, recipientId, recipientName, cmd, itemNum, expiresAt }
const pending = new Map();

function tierRank(rarity) {
  const r = TIER_RANK[String(rarity || 'common').toLowerCase()];
  return (r === undefined) ? 6 : r;
}

/** TRUE only for PRO senders gifting EPIC-tier-or-higher items. */
function needsConfirm(pro, rarity) {
  return !!pro && tierRank(rarity) <= TIER_RANK.epic;
}

function prune() {
  const now = Date.now();
  for (const [k, v] of pending) {
    if (!v || !v.expiresAt || v.expiresAt <= now) pending.delete(k);
  }
}

function rarLabel(rarity) {
  const r = String(rarity || 'common');
  return r.charAt(0).toUpperCase() + r.slice(1);
}

/**
 * Hold a gift and ask for confirmation.
 * o = { item, recipientId, recipientName, cmd, itemNum }
 * cmd is '/equip' or '/items' — the command owning the flow, which the
 * confirm/cancel buttons tap back to (plus typed + numbered fallbacks).
 */
async function offer(sock, chatId, msg, giverJid, o) {
  prune();
  pending.set(giverJid, {
    itemName: o.item.name,
    rarity: o.item.rarity || 'common',
    recipientId: o.recipientId,
    recipientName: o.recipientName || 'them',
    cmd: o.cmd,
    itemNum: o.itemNum,
    expiresAt: Date.now() + TTL_MS,
  });

  const text =
    `🎁 Send *${o.item.name}* (${rarLabel(o.item.rarity)}) to *${o.recipientName || 'them'}*?\n\n` +
    `Do you really want to send this item?`;

  try {
    const Buttons = require('../../utils/buttons');
    if (Buttons && Buttons.sendButtons) {
      await Buttons.sendButtons(sock, chatId, {
        title: '🎁 Confirm Gift',
        text,
        buttons: Buttons.quickReplies([
          ['✅ Yes, send it', `${o.cmd} giftconfirm`],
          ['❌ Cancel', `${o.cmd} giftcancel`],
        ]),
      }, msg);
      return { ok: true, via: 'buttons' };
    }
  } catch (e) { /* fall through to typed fallback below */ }

  await sock.sendMessage(chatId, {
    text: text + `\n\nReply *${o.cmd} giftconfirm* to send, or *${o.cmd} giftcancel* to keep it.`,
  }, { quoted: msg });
  return { ok: true, via: 'plain' };
}

/**
 * Take (and clear) the giver's pending gift. Returns { pending } or
 * { error: 'none' | 'expired' }. Confirm AND cancel both consume it,
 * so a double-tap can never send twice.
 */
function take(giverJid) {
  prune();
  const p = pending.get(giverJid);
  if (!p) return { error: 'none' };
  pending.delete(giverJid);
  return { pending: p };
}

/** Non-consuming read (tests / status checks). */
function peek(giverJid) {
  prune();
  return pending.get(giverJid) || null;
}

module.exports = { needsConfirm, tierRank, offer, take, peek, TTL_MS };
