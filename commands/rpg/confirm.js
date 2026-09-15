// ═══════════════════════════════════════════════════════════════
// /confirm  ·  /cancel  — one-word answers to a pending confirmation
//
// Push #47. The PRO epic-and-up gift prompt (rpg/utils/GiftConfirm) offers
// native buttons, but WhatsApp does not render native-flow buttons for a
// Web-linked account inside a GROUP — so the tap target silently degrades to a
// numbered menu and the player is stuck with a "confirmation that doesn't work".
//
// These two commands are the always-available path: they only ever complete the
// SAME transfer the button would, by handing the answer back to the command that
// created the prompt (/items or /equip). Nothing is re-implemented here, so the
// two paths can't drift apart.
//
//   /confirm → complete the pending action
//   /cancel  → abort it (item stays put)
// Both consume the pending entry, so a double-tap can never send twice.
// ═══════════════════════════════════════════════════════════════

'use strict';

const GiftConfirm = require('../../rpg/utils/GiftConfirm');

function ownerModule(cmd) {
  if (cmd === '/equip') return require('./equip');
  return require('./items'); // '/items' and anything else default to the items flow
}

async function resolve(sock, msg, args, getDatabase, saveDatabase, sender, action) {
  const chatId = msg.key.remoteJid;
  const db = getDatabase();

  const p = GiftConfirm.peek(sender);
  if (!p) {
    return sock.sendMessage(chatId, {
      text: action === 'confirm'
        ? `ℹ️ Nothing waiting for confirmation.\n\nThe PRO gift prompt appears when you send an EPIC-tier or higher item (*/items give <#> @user*, */equip gift <#> @user*).`
        : `ℹ️ Nothing to cancel.`,
    }, { quoted: msg });
  }

  // Hand the answer to the command that owns the flow — identical code path to
  // the button tap, including its own expiry/ownership checks.
  const mod = ownerModule(p.cmd);
  const sub = action === 'confirm' ? 'giftconfirm' : 'giftcancel';
  try {
    return await mod.execute(sock, msg, [sub], getDatabase, saveDatabase, sender);
  } catch (e) {
    // Never strand the pending entry on a failure — the player can retry.
    console.error(`[confirm] ${p.cmd} ${sub} failed:`, e.message);
    return sock.sendMessage(chatId, {
      text: `❌ Could not ${action} that transfer (${e.message}).\n\nYour item is still in your inventory — try again: *${p.cmd} ${sub}*`,
    }, { quoted: msg });
  }
}

// Shared with /cancel (commands/rpg/cancel.js) so both answers run one code path.
module.exports.resolve = resolve;

module.exports = {
  name: 'confirm',
  aliases: ['yes', 'ky'],
  description: '✅ Confirm the pending action (PRO epic+ gift prompt)',
  usage: '/confirm',

  execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    return resolve(sock, msg, args, getDatabase, saveDatabase, sender, 'confirm');
  },
};

// Named export form kept for the loader: `module.exports` above is the command.

// Re-attach after the command object assignment (module.exports was replaced).
module.exports.resolve = resolve;
