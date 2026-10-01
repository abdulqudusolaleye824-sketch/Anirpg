/**
 * /addxp <amount> [@hunter | reply]  — OWNER ONLY (Push #96h-n)
 * Grants XP to yourself (no target) or to the tagged / replied-to hunter. Level-ups apply at once.
 */
'use strict';
const Perms = require('../../utils/permissions');
const UI = require('../../rpg/utils/UI');
const LevelUpManager = require('../../rpg/utils/LevelUpManager');

function findUser(db, jid) { if (!jid) return null; const b = String(jid).split(':')[0].split('@')[0]; return db.users?.[jid] || db.users?.[`${b}@s.whatsapp.net`] || Object.values(db.users || {}).find(u => u && u.jid && String(u.jid).split('@')[0] === b) || null; }

module.exports = {
  name: 'addxp', aliases: ['givexp', 'addexp'],
  description: '👑 Owner: add XP to yourself or a tagged/replied hunter',
  usage: '/addxp <amount> [@hunter]', category: 'admin', ownerOnly: true,
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid; const db = getDatabase();
    if (!Perms.isBotOwner(db, sender)) return sock.sendMessage(chatId, { text: '❌ Owner only.' }, { quoted: msg });
    const amount = Math.floor(Number(String(args.find(a => /^\d[\d,_]*$/.test(String(a))) || '').replace(/[,_]/g, '')));
    if (!amount || amount <= 0) return sock.sendMessage(chatId, { text: 'Usage: */addxp <amount>* (tag or reply to give it to someone else)' }, { quoted: msg });
    const targetJid = require('../../utils/target').resolve(msg, args.filter(a => !/^\d[\d,_]*$/.test(String(a)))) || sender;
    const target = findUser(db, targetJid);
    if (!target) return sock.sendMessage(chatId, { text: '❌ That hunter is not registered.' }, { quoted: msg });
    const before = target.level || 1;
    target.xp = (target.xp || 0) + amount; target.lifetimeXp = (target.lifetimeXp || 0) + amount;
    try { LevelUpManager.checkAndApplyLevelUps(target, saveDatabase, sock, chatId); } catch (e) {}
    saveDatabase();
    const F = UI.isPro(target) ? UI.PRO_BAR : UI.FREE_BAR;
    return sock.sendMessage(chatId, { text: [F, `✨ *XP GRANTED*`, F, `👤 *${target.name}*`, `➕ +${amount.toLocaleString()} XP`, `🎚️ Level ${before} → *${target.level || 1}*`, `📈 /xp for the full picture`, F].join('\n'), mentions: [targetJid] }, { quoted: msg });
  },
};
