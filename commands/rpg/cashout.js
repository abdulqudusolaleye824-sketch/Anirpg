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

    // Slim ack only — the full CASHED OUT card is edited onto the flight
    // message itself by the engine (a second full card here reads as a
    // double payout). Payout is settled exactly once (flight.ended guard).
    const bet = Aviator.getFlight(sender)?.bet || 0;
    const profit = res.payout - bet;
    const ack = pro
      ? `✅ *CASHED OUT @ ${res.mult.toFixed(2)}x!* 💎\n💼 *+${res.payout}* Nexus landing on your flight message above!${profit !== 0 ? ` (*${profit > 0 ? '+' : ''}${profit}*)` : ''}\n${UI.PRO_MINI} 💎 *PRO PILOT*`
      : `✅ *CASHED OUT @ ${res.mult.toFixed(2)}x!*\n💼 *+${res.payout}* Nexus landing on your flight message above!${profit !== 0 ? ` (*${profit > 0 ? '+' : ''}${profit}*)` : ''}`;
    try {
      return await sock.sendMessage(chatId, { text: ack, mentions: [sender] }, { quoted: msg });
    } catch (e) {
      // Even if the ack can't send (rate-overlimit), the payout already
      // settled in the engine — never throw, never double-settle.
      return null;
    }
  }
};
