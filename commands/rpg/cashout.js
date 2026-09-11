// ═══════════════════════════════════════════════════════════════
// /cashout — Cash out of your live Aviator flight at the current multiplier
// (Pairs with the 💰 CASH OUT button sent on takeoff.)
// ═══════════════════════════════════════════════════════════════

'use strict';

const Aviator = require('../../rpg/utils/Aviator');

module.exports = {
  name: 'cashout',
  description: '💰 Cash out of your live Aviator flight',
  usage: '/cashout',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key?.remoteJid;
    const db = getDatabase();
    const player = db.users?.[sender];

    if (!player) {
      return sock.sendMessage(chatId, { text: '❌ You are not registered! Use /register' }, { quoted: msg });
    }
    const UI = require('../../rpg/utils/UI');
    const pro = UI.isPro(player);
    const FRAME = pro ? UI.PRO_BAR : UI.FREE_BAR;

    const res = Aviator.cashOut(sender);

    if (!res.ok) {
      if (res.error === 'nofly') {
        const last = Aviator.lastCrashFor(sender);
        if (last) {
          return sock.sendMessage(chatId, {
            text: `💥 *Too late — your flight already crashed @ ${last.mult.toFixed(2)}x!*\n\nStart a new one: */casino aviator <bet>*`
          }, { quoted: msg });
        }
        return sock.sendMessage(chatId, {
          text: `❌ You have no live Aviator flight!\n\nStart one: */casino aviator <bet>*`
        }, { quoted: msg });
      }
      if (res.error === 'crashed') {
        return sock.sendMessage(chatId, { text: `💥 Too late — that flight already crashed!` }, { quoted: msg });
      }
      return sock.sendMessage(chatId, { text: `✅ Already cashed out — the payout is on its way!` }, { quoted: msg });
    }

    const profit = res.payout - (Aviator.getFlight(sender)?.bet || 0);
    return sock.sendMessage(chatId, {
      text: [
        ...(pro ? [UI.PRO_BAR, `💰 *CASHED OUT @ ${res.mult.toFixed(2)}x!* 💎`, UI.PRO_BAR] : [`💰 *CASHED OUT @ ${res.mult.toFixed(2)}x!*`, UI.FREE_BAR]),
        `💼 Payout: *${res.payout}* Nexus${profit > 0 ? ` (*+${profit}*)` : ''}`,
        ...(pro ? [FRAME, UI.PRO_MINI, `💎 *PRO PILOT* — lifetime +${UI.num(player.casino?.totalWon)} / -${UI.num(player.casino?.totalLost)}`] : [FRAME, UI.upsell()]),
      ].join('\n'),
      mentions: [sender],
    }, { quoted: msg });
  }
};
