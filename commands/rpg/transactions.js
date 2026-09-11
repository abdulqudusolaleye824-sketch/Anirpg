// ═══════════════════════════════════════════════════════════════
// /transactions @player (or reply) — MODS + OWNERS ONLY
// Sends the target player's last 50 wallet transactions (money in AND out,
// both 💠 Nexus and 💎 Mana Stones) to the requesting mod's DM via serf.
// Nothing financial is ever posted in the group.
// ═══════════════════════════════════════════════════════════════

'use strict';

const UI = require('../../rpg/utils/UI');

function bare(jid) {
  return String(jid || '').split(':')[0].split('@')[0];
}

module.exports = {
  name: 'transactions',
  aliases: ['txns', 'txhistory'],
  description: '🛡️ (Mod) DM a player\'s last 50 transactions to yourself',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const Perms = require('../../utils/permissions');

    if (!Perms.isBotOwner(db, sender) && !Perms.isBotMod(db, sender)) {
      return sock.sendMessage(chatId, { text: '❌ Mods and owners only.' }, { quoted: msg });
    }

    // Resolve target: mention → replied user → bare number arg
    const ctx = msg.message?.extendedTextMessage?.contextInfo;
    let targetId = ctx?.mentionedJid?.[0] || ctx?.participant || null;
    if (!targetId && args[0]) {
      const want = bare(args[0]);
      targetId = Object.keys(db.users || {}).find(k => bare(k) === want) || null;
    }
    const target = targetId ? db.users?.[targetId] : null;
    if (!target) {
      return sock.sendMessage(chatId, { text: '❌ Usage: /transactions @player (or reply to their message).' }, { quoted: msg });
    }

    const { buildHistoryText } = require('../../rpg/utils/TransactionLog');
    const viewer = db.users[sender];
    const pro = UI.isPro(viewer || {});
    const FRAME = pro ? UI.PRO_BAR : UI.FREE_BAR;

    const txCount = Array.isArray(target.transactions) ? target.transactions.length : 0;
    const statement = [
      ...(pro ? [UI.PRO_BAR, `🧾 *TRANSACTION STATEMENT* 💎`, UI.PRO_BAR] : [`🧾 *TRANSACTION STATEMENT*`, UI.FREE_BAR]),
      `👤 *${target.name || bare(targetId)}*`,
      `💠 Nexus: *${UI.num(target.gold)}* · 💎 Mana: *${UI.num(target.manaCrystals)}*`,
      `📦 Showing last ${Math.min(50, txCount)} of ${txCount} recorded`,
      FRAME,
      buildHistoryText(target, 50),
      FRAME,
      `🛡️ _Confidential — requested by ${viewer?.name || 'mod'}_`,
    ].join('\n');

    const SerfDM = require('../../rpg/utils/SerfDM');
    const dmRes = await SerfDM.sendSerfDM(sock, db, sender, { text: statement });

    if (chatId.endsWith('@g.us')) {
      return sock.sendMessage(chatId, {
        text: `@${bare(sender)}\n` + SerfDM.resultNotice(`🧾 ${target.name || 'PLAYER'} — LAST ${Math.min(50, txCount)} TXNS`, dmRes),
        mentions: [sender],
      }, { quoted: msg });
    }
    if (!dmRes.ok) {
      return sock.sendMessage(chatId, { text: SerfDM.resultNotice('🧾 TRANSACTIONS', dmRes) }, { quoted: msg });
    }
    return null;
  }
};
