/**
 * /procoin  (/pc)     — Check your Procoin balance
 * /addprocoin (/addpc) — Owner/co-owner only: grant Procoins to a player
 *
 * Procoin (PC) is a premium currency:
 *   • Not earnable by players through any normal means
 *   • Only owner (221951679328499@lid) or co-owner (194592469209292@lid) can grant
 *   • Grant target: @mention or replied-to message author
 *
 * Usage:
 *   /pc                       — Check your own balance
 *   /pc @user                 — Check another player's balance
 *   /addpc 2000 @user         — Grant 2000 PC to @user
 *   /addpc 2000               — Grant 2000 PC to replied-to user
 */

'use strict';

const config = require('../../config.json');

const OWNER_JID    = config.ownerNumber   || '221951679328499@lid';
const CO_OWNER_JID = config.coOwnerNumber || '194592469209292@lid';

// Normalise a JID (strip :XX device suffix, keep @lid or @s.whatsapp.net)
function normaliseJid(jid) {
  if (!jid) return null;
  return jid.replace(/:[0-9]+@/, '@');
}

function isPrivileged(sender) {
  const s = normaliseJid(sender);
  return s === normaliseJid(OWNER_JID) || s === normaliseJid(CO_OWNER_JID);
}

function initProcoin(player) {
  if (player.procoin == null) player.procoin = 0;
  return player;
}

module.exports = {
  name: 'procoin',
  aliases: ['pc', 'addpc', 'addprocoin'],
  description: '💠 Procoin (PC) — premium currency granted by owner/co-owner only',
  usage: '/pc | /addpc <amount> @user',
  category: 'economy',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId   = msg.key.remoteJid;
    const db       = getDatabase();
    const command  = msg.message?.extendedTextMessage?.text?.trim().split(' ')[0]?.slice(1).toLowerCase()
                  || msg.message?.conversation?.trim().split(' ')[0]?.slice(1).toLowerCase()
                  || '';

    const isAddCmd = command === 'addprocoin' || command === 'addpc';
    const UI = require('../../rpg/utils/UI');
    const pro = UI.isPro(db.users?.[sender] || db.users?.[normaliseJid(sender)] || {});
    const FRAME = pro ? UI.PRO_BAR : UI.FREE_BAR;

    // ── /addprocoin / /addpc ───────────────────────────────────────────────────
    if (isAddCmd) {
      if (!isPrivileged(sender)) {
        return sock.sendMessage(chatId, {
          text: [
            ...(pro ? [UI.PRO_BAR, `💠 *PROCOIN — ACCESS DENIED* 💎`, UI.PRO_BAR] : [`💠 *PROCOIN — ACCESS DENIED*`, UI.FREE_BAR]),
            ``,
            `❌ Only the *Owner* or *Co-Owner* can grant Procoins.`,
            FRAME,
            ...(pro ? [UI.PRO_MINI, `💎 *PRO MINT* — grants are owner-only`] : [UI.upsell()]),
          ].join('\n'),
        }, { quoted: msg });
      }

      // Parse amount from args
      const amount = parseInt(args.find(a => /^\d+$/.test(a)));
      if (!amount || amount <= 0) {
        return sock.sendMessage(chatId, {
          text: [
            ...(pro ? [UI.PRO_BAR, `💠 *GRANT PROCOIN* 💎`, UI.PRO_BAR] : [`💠 *GRANT PROCOIN*`, UI.FREE_BAR]),
            ``,
            `❌ Please specify a valid amount.`,
            ``,
            `*Usage:*`,
            `/addpc 2000 @user`,
            `/addpc 500  _(reply to a message)_`,
            FRAME,
            ...(pro ? [UI.PRO_MINI, `💎 *PRO MINT* — owner grants`] : [UI.upsell()]),
          ].join('\n'),
        }, { quoted: msg });
      }

      // Resolve target: mention > replied-to
      const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
      const targetJid = normaliseJid(mentionedJids[0] || quotedParticipant);

      if (!targetJid) {
        return sock.sendMessage(chatId, {
          text: [
            ...(pro ? [UI.PRO_BAR, `💠 *GRANT PROCOIN* 💎`, UI.PRO_BAR] : [`💠 *GRANT PROCOIN*`, UI.FREE_BAR]),
            ``,
            `❌ No target found.`,
            `@mention a player or reply to their message.`,
            ``,
            `*Example:* /addpc 2000 @user`,
            FRAME,
            ...(pro ? [UI.PRO_MINI, `💎 *PRO MINT* — owner grants`] : [UI.upsell()]),
          ].join('\n'),
        }, { quoted: msg });
      }

      // Find target player — try both JID formats
      const targetPlayer = db.users?.[targetJid]
        || db.users?.[mentionedJids[0]]
        || db.users?.[quotedParticipant];

      if (!targetPlayer) {
        return sock.sendMessage(chatId, {
          text: `❌ That player isn't registered in ✦ 𝐀𝐬𝐭𝐫𝐚™ yet.`,
        }, { quoted: msg });
      }

      initProcoin(targetPlayer);
      targetPlayer.procoin += amount;
      saveDatabase(db);

      const grantorName = db.users?.[normaliseJid(sender)]?.name || 'System';

      return sock.sendMessage(chatId, {
        text: [
          ...(pro ? [UI.PRO_BAR, `💠 *PROCOIN GRANTED* 💎`, UI.PRO_BAR] : [`💠 *PROCOIN GRANTED*`, UI.FREE_BAR]),
          ``,
          `👤 *Player:* ${targetPlayer.name}`,
          `💠 *Granted:* +${amount.toLocaleString()} PC`,
          `💼 *New Balance:* ${targetPlayer.procoin.toLocaleString()} PC`,
          ``,
          `✦ Granted by: *${grantorName}*`,
          FRAME,
          ...(pro ? [UI.PRO_MINI, `💎 *PRO MINT* — +${amount.toLocaleString()} PC to ${targetPlayer.name}`] : [UI.upsell()]),
        ].join('\n'),
        mentions: mentionedJids.length ? mentionedJids : undefined,
      }, { quoted: msg });
    }

    // ── /procoin / /pc — Check OWN balance only ───────────────────────────────
    const player = db.users?.[normaliseJid(sender)] || db.users?.[sender];

    if (!player) {
      return sock.sendMessage(chatId, {
        text: `❌ You're not registered yet. Use */register* first.`,
      }, { quoted: msg });
    }

    initProcoin(player);

    const privNote = isPrivileged(sender)
      ? `\n👑 _(Owner/Co-Owner: use /addpc to grant)_`
      : `\n💡 _Procoins can only be granted by the Owner or Co-Owner._`;

    return sock.sendMessage(chatId, {
      text: [
        ...(pro ? [UI.PRO_BAR, `💠 *PROCOIN BALANCE* 💎`, UI.PRO_BAR] : [`💠 *PROCOIN BALANCE*`, UI.FREE_BAR]),
        ``,
        `👤 *${player.name}*`,
        `💠 *Procoin (PC):* ${player.procoin.toLocaleString()} PC`,
        privNote,
        FRAME,
        ...(pro ? [UI.PRO_MINI, `💎 *PRO MINT* — ${player.procoin.toLocaleString()} PC`] : [UI.upsell()]),
      ].join('\n'),
    }, { quoted: msg });
  },
};
