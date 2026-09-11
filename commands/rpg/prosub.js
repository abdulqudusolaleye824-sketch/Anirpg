// ═══════════════════════════════════════════════════════════════
// /prosub — Subscription dashboard: Pro type, activation date, time
// left, plus Battle Pass / Astra Pass premium status.
// ═══════════════════════════════════════════════════════════════

'use strict';

const UI = require('../../rpg/utils/UI');

function fmtLeft(ms) {
  if (ms <= 0) return 'expired';
  const m = Math.floor(ms / 60000);
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  const mm = m % 60;
  if (d > 0) return `${d}d ${h}h ${mm}m`;
  if (h > 0) return `${h}h ${mm}m`;
  return `${mm}m`;
}

function fmtDate(ts) {
  if (!ts) return '—';
  try {
    return new Date(ts).toUTCString().replace(' GMT', ' WAT').slice(5, 22);
  } catch (e) { return '—'; }
}

module.exports = {
  name: 'prosub',
  aliases: ['mysub', 'subscription'],
  description: '💎 View your Pro & Pass subscriptions and time left',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];
    if (!player) return sock.sendMessage(chatId, { text: '❌ Register first! Use /register' }, { quoted: msg });
    const pro = UI.isPro(player);
    const FRAME = pro ? UI.PRO_BAR : UI.FREE_BAR;

    const tierRaw = player.proTier || player.proStatus || null;
    const tierName = tierRaw ? String(tierRaw).charAt(0).toUpperCase() + String(tierRaw).slice(1) : null;
    const leftMs = (player.proExpiresAt || 0) - Date.now();

    let bpLine = '  🎖️ Battle Pass Premium: _not owned_';
    try {
      const BP = require('../../rpg/utils/BattlePass');
      const bp = BP.getPassState(player);
      if (bp.premium) {
        bpLine = `  🎖️ Battle Pass Premium: ✅ *ACTIVE* (${BP.CURRENT_SEASON?.name || 'current season'})`;
      }
    } catch (e) {}

    let apLine = '  🌟 Astra Pass Premium: _not owned_';
    try {
      const AP = require('../../rpg/utils/AstraPass');
      const ap = AP.getPassState(player);
      if (ap.premiumBought) {
        apLine = `  🌟 Astra Pass Premium: ✅ *ACTIVE* (permanent)`;
      } else if (pro) {
        apLine = `  🌟 Astra Pass Premium: ✅ *via PRO*`;
      }
    } catch (e) { if (pro) apLine = `  🌟 Astra Pass Premium: ✅ *via PRO*`; }

    const lines = pro
      ? [
        UI.PRO_BAR, `💎 *MY SUBSCRIPTIONS* 💎`, UI.PRO_BAR,
        ``,
        `👑 *PRO:* ✅ *ACTIVE*`,
        `  🎫 Type: *${tierName || 'Pro'}*`,
        `  📅 Activated: *${player.proActivatedAt ? fmtDate(player.proActivatedAt) : 'before tracking'}*`,
        `  ⏰ Expires: *${fmtDate(player.proExpiresAt)}*`,
        `  ⌛ Time left: *${fmtLeft(leftMs)}*`,
        ``,
        `🎖️ *PASSES:*`,
        bpLine,
        apLine,
        ``,
        `💼 PC balance: *${(player.procoin || 0).toLocaleString()} PC*`,
        UI.PRO_BAR,
        `💡 /prostore — extend Pro or buy passes`,
      ]
      : [
        `💎 *MY SUBSCRIPTIONS*`,
        UI.FREE_BAR,
        ``,
        `👑 *PRO:* _not active_`,
        ...(player.proExpiresAt && leftMs <= 0 ? [`  ⏰ Last sub expired: *${fmtDate(player.proExpiresAt)}*`] : []),
        ``,
        `🎖️ *PASSES:*`,
        bpLine,
        apLine,
        ``,
        `💼 PC balance: *${(player.procoin || 0).toLocaleString()} PC*`,
        FRAME,
        `💡 /prostore — buy Pro or passes with PC`,
        UI.upsell(),
      ];

    return sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: msg });
  }
};
