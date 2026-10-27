/**
 * /gift <amount> [@hunter | reply]  — transfer Procoin (PC) to another hunter. Anyone can use it. (10-26, owner)
 *   /gift 5000 @Hunter   → takes 5,000 PC from your balance and hands it to the tagged / replied hunter.
 * Rules: whole numbers only · must be registered on both sides · cannot gift yourself or a bot · owners are never targetable (standing rule).
 */
'use strict';
const UI = require('../../rpg/utils/UI');

module.exports = {
  name: 'gift',
  aliases: ['giftpc', 'sendpc'],
  description: '🎁 Gift Procoin to a hunter — /gift <amount> @hunter (or reply)',
  usage: '/gift <amount> @hunter',
  category: 'economy',
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const OG = require('../../rpg/utils/OwnerGrant');
    const me = OG.findUser(db, sender);
    if (!me || !me.name) return sock.sendMessage(chatId, { text: '❌ Register first! Use /register' }, { quoted: msg });
    const pro = UI.isPro(me); const FRAME = pro ? UI.PRO_BAR : UI.FREE_BAR;

    const amount = OG.parseAmount(args);
    const T = require('../../utils/target');
    const targetJid = T.resolve(msg, args.filter(a => !/^\d[\d,_]*$/.test(String(a))));
    if (!Number.isFinite(amount) || amount <= 0 || !targetJid) {
      return sock.sendMessage(chatId, { text: `${FRAME}\n🎁 *GIFT PROCOIN*\n${FRAME}\n\n*/gift <amount> @hunter* — or reply to their message.\nExample: */gift 5000 @Hunter*\n\n💠 Your PC: *${(Number(me.procoin) || 0).toLocaleString()}*` }, { quoted: msg });
    }
    const bare = (j) => String(j || '').split(':')[0].split('@')[0];
    if (bare(targetJid) === bare(sender) || bare(targetJid) === bare(me.jid)) return sock.sendMessage(chatId, { text: '❌ You cannot gift yourself.' }, { quoted: msg });
    try { const Perms = require('../../utils/permissions'); if (Perms.isBotOwner(db, targetJid)) return sock.sendMessage(chatId, { text: '❌ That hunter cannot receive gifts.' }, { quoted: msg }); } catch (e) {}
    const them = OG.findUser(db, targetJid);
    if (!them || !them.name) return sock.sendMessage(chatId, { text: '❌ That hunter is not registered.' }, { quoted: msg });

    const have = Math.floor(Number(me.procoin) || 0);
    if (have < amount) return sock.sendMessage(chatId, { text: `❌ Not enough Procoin.\nNeed: *${amount.toLocaleString()} PC* · Have: *${have.toLocaleString()} PC*` }, { quoted: msg });

    me.procoin = have - amount;
    them.procoin = Math.floor(Number(them.procoin) || 0) + amount;
    try { const TL = require('../../rpg/utils/TransactionLog'); TL.logSpend && TL.logSpend(me, 'gift_pc_out', 0, 0, `${amount} PC → ${them.name}`); } catch (e) {}
    if (!Array.isArray(db.giftLog)) db.giftLog = [];
    db.giftLog.push({ from: me.jid || sender, to: them.jid || targetJid, amount, at: Date.now() });
    if (db.giftLog.length > 2000) db.giftLog.splice(0, db.giftLog.length - 2000);
    saveDatabase();

    const mention = them.jid || targetJid;
    return sock.sendMessage(chatId, { text: [
      ...(pro ? [UI.PRO_BAR, `🎁 *GIFT SENT* 💎`, UI.PRO_BAR] : [`🎁 *GIFT SENT*`, UI.FREE_BAR]),
      `*${me.name}* → *${them.name}*: *${amount.toLocaleString()} PC*`,
      ``,
      `💠 Your PC: *${me.procoin.toLocaleString()}*`,
      `💠 ${them.name}'s PC: *${them.procoin.toLocaleString()}*`,
    ].join('\n'), mentions: [mention] }, { quoted: msg });
  },
};
