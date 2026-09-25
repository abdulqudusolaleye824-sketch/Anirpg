// ═══════════════════════════════════════════════════════════════
// /extract — OWNER/CO-OWNER ONLY. Pulls Nexus or Mana Stones straight out
// of a player's BANK account into the owner's wallet.
//
//   /extract @player N 10000   → 10,000 Nexus from their bank
//   /extract @player M 5000    → 5,000 Mana Stones from their bank
//   /extract @player N all     → everything of that currency
// ═══════════════════════════════════════════════════════════════
'use strict';

const Perms = require('../../utils/permissions');
const UI = require('../../rpg/utils/UI');
const Banking = require('../../rpg/banking/BankingSystem');

function bare(j) { return String(j || '').split('@')[0].split(':')[0]; }

module.exports = {
  name: 'extract',
  description: '🏦 Owner: extract Nexus (N) or Mana Stones (M) from a player\'s bank',
  category: 'admin',
  usage: '/extract @player N|M <amount|all>',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const FRAME = UI.FREE_BAR;
    if (!Perms.isBotOwner(db, sender)) return sock.sendMessage(chatId, { text: `❌ *OWNER ONLY.*\n${FRAME}\n/extract is an owner / co-owner command.` }, { quoted: msg });
    const me = db.users[sender];
    if (!me) return sock.sendMessage(chatId, { text: '❌ Register first! Use /register' }, { quoted: msg });

    // Target: tag / reply / number / name; then currency + amount from the rest.
    const ctx = msg.message?.extendedTextMessage?.contextInfo;
    let jid = ctx?.mentionedJid?.[0] || ctx?.participant || null;
    let rest = args.filter(a => !/^@\d+/.test(a));
    if (!jid && rest[0] && !/^[nm]$/i.test(rest[0])) {
      const d = rest[0].replace(/\D/g, '');
      if (d.length >= 8) jid = `${d}@s.whatsapp.net`;
      else { const q = rest[0].toLowerCase(); for (const [k, u] of Object.entries(db.users || {})) if (u?.name && String(u.name).toLowerCase() === q) { jid = k; break; } }
      if (jid) rest = rest.slice(1);
    }
    const cur = (rest[0] || '').toUpperCase();
    const amtRaw = (rest[1] || '').toLowerCase();
    if (!jid || !/^(N|M)$/.test(cur) || !amtRaw) return sock.sendMessage(chatId, { text: `❌ Usage: /extract @player N 10000  (N = Nexus, M = Mana Stones, amount or "all")` }, { quoted: msg });
    // Resolve to the stored key (LID vs phone).
    let key = db.users[jid] ? jid : null;
    if (!key) { const b = bare(jid); for (const k of Object.keys(db.users || {})) if (bare(k) === b) { key = k; break; } }
    if (!key) return sock.sendMessage(chatId, { text: `❌ @${bare(jid)} isn't registered.`, mentions: [jid] }, { quoted: msg });
    const target = db.users[key];
    const bank = Banking.getAccountBank(db, key);
    const acct = bank && bank.accounts.find(a => a.userId === key);
    if (!acct) return sock.sendMessage(chatId, { text: `ℹ️ *${target.name}* has no bank account.` }, { quoted: msg });

    const isMana = cur === 'M';
    const have = Math.max(0, Math.floor(isMana ? (acct.balanceMana || 0) : (acct.balance || 0)));
    let amount = amtRaw === 'all' ? have : parseInt(amtRaw.replace(/[,_]/g, ''), 10);
    if (!Number.isFinite(amount) || amount <= 0) return sock.sendMessage(chatId, { text: `❌ Amount must be a positive number or "all".` }, { quoted: msg });
    if (amount > have) return sock.sendMessage(chatId, { text: `❌ *${target.name}* only has *${have.toLocaleString()}* ${isMana ? '💎 Mana Stones' : '💠 Nexus'} in the bank.` }, { quoted: msg });

    if (isMana) { acct.balanceMana = have - amount; if (typeof bank.totalDepositsMana === 'number') bank.totalDepositsMana = Math.max(0, bank.totalDepositsMana - amount); me.manaCrystals = (me.manaCrystals || 0) + amount; }
    else { acct.balance = have - amount; if (typeof bank.totalDeposits === 'number') bank.totalDeposits = Math.max(0, bank.totalDeposits - amount); me.gold = (me.gold || 0) + amount; }
    try { const TL = require('../../rpg/utils/TransactionLog'); TL.logTransaction(target, { type: 'extract_out', amount: -amount, currency: isMana ? '💎' : '💠', note: `extracted by ${me.name}` }); TL.logTransaction(me, { type: 'extract_in', amount, currency: isMana ? '💎' : '💠', note: `from ${target.name}'s bank` }); } catch (e) {}
    saveDatabase();
    const unit = isMana ? '💎 Mana Stones' : '💠 Nexus';
    return sock.sendMessage(chatId, {
      text: [FRAME, `🏦 *BANK EXTRACTION*`, FRAME, `👤 From: *${target.name}* (@${bare(key)}) — ${bank.name}`, `💸 Extracted: *${amount.toLocaleString()}* ${unit}`, `🏦 Their bank now: *${(isMana ? acct.balanceMana : acct.balance).toLocaleString()}* ${unit}`, `👑 To: @${bare(sender)}'s wallet`, FRAME].join('\n'),
      mentions: [key, sender],
    }, { quoted: msg });
  },
};
