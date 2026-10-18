'use strict';
// Push #103f: shared engine for the owner grant commands (/addup /addmana /addnexus /addpc).
//   /addX <n> [@hunter|reply]      → one hunter, card in the current chat (as before)
//   /addX --all <n>                → EVERY registered hunter, SILENT (no DM, no group post); only from the owner's DM with a bot.
const Perms = require('../../utils/permissions');
const UI = require('./UI');

const KINDS = {
  up:    { field: 'upgradePoints', label: 'Upgrade Points', unit: 'UP', emoji: '✨', title: 'UPGRADE POINTS GRANTED' },
  mana:  { field: 'manaCrystals',  label: 'Mana Stones',    unit: 'Mana Stones', emoji: '💎', title: 'MANA STONES GRANTED' },
  nexus: { field: 'gold',          label: 'Nexus',          unit: 'Nexus', emoji: '💠', title: 'NEXUS GRANTED' },
  pc:    { field: 'procoin',       label: 'ProCoin',        unit: 'PC', emoji: '🪙', title: 'PROCOIN GRANTED' },
};
function findUser(db, jid) { if (!jid) return null; const b = String(jid).split(':')[0].split('@')[0]; return db.users?.[jid] || db.users?.[`${b}@s.whatsapp.net`] || Object.values(db.users || {}).find(u => u && u.jid && String(u.jid).split(':')[0].split('@')[0] === b) || null; }
function parseAmount(args) { return Math.floor(Number(String(args.find(a => /^\d[\d,_]*$/.test(String(a))) || '').replace(/[,_]/g, ''))); }
function isRegistered(u) { return !!(u && typeof u === 'object' && u.name && u.stats); }
/** Grant to every registered hunter. Returns { players, total }. */
function grantAll(db, kind, amount) {
  const k = KINDS[kind]; let players = 0;
  for (const u of Object.values(db.users || {})) { if (!isRegistered(u)) continue; if (k.field === 'upgradePoints') { try { require('./StatAllocationSystem').initializeStatAllocations(u); } catch (e) {} } u[k.field] = (Number(u[k.field]) || 0) + amount; players++; }
  return { players, total: players * amount };
}
async function run(kind, sock, msg, args, getDatabase, saveDatabase, sender) {
  const k = KINDS[kind]; const chatId = msg.key.remoteJid; const db = getDatabase();
  if (!Perms.isBotOwner(db, sender)) return sock.sendMessage(chatId, { text: '❌ Owner only.' }, { quoted: msg });
  const amount = parseAmount(args);
  const all = args.some(a => /^--?all$/i.test(String(a)));
  if (!amount || amount <= 0) return sock.sendMessage(chatId, { text: `Usage: */add${kind} <amount>* (tag or reply to give it to someone else)\n*/add${kind} --all <amount>* — every registered hunter, silently (owner DM only)` }, { quoted: msg });
  if (all) {
    if (String(chatId).endsWith('@g.us')) return sock.sendMessage(chatId, { text: `🔒 */add${kind} --all* only works from your DM with a bot (it is a silent mass grant).` }, { quoted: msg });
    const r = grantAll(db, kind, amount); saveDatabase();
    return sock.sendMessage(chatId, { text: [UI.PRO_BAR, `${k.emoji} *${k.title} — ALL HUNTERS*`, UI.PRO_BAR, `➕ +${amount.toLocaleString()} ${k.unit} × ${r.players} hunters`, `Σ ${r.total.toLocaleString()} ${k.unit} · 🤫 silent — nobody was notified`, UI.PRO_BAR].join('\n') }, { quoted: msg });
  }
  const targetJid = require('../../utils/target').resolve(msg, args.filter(a => !/^\d[\d,_]*$/.test(String(a)))) || sender;
  const target = findUser(db, targetJid);
  if (!target) return sock.sendMessage(chatId, { text: '❌ That hunter is not registered.' }, { quoted: msg });
  if (k.field === 'upgradePoints') { try { require('./StatAllocationSystem').initializeStatAllocations(target); } catch (e) {} }
  const before = Number(target[k.field]) || 0; target[k.field] = before + amount; saveDatabase();
  const F = UI.isPro(target) ? UI.PRO_BAR : UI.FREE_BAR;
  return sock.sendMessage(chatId, { text: [F, `${k.emoji} *${k.title}*`, F, `👤 *${target.name}*`, `➕ +${amount.toLocaleString()} ${k.unit}`, `${k.emoji} Balance: ${before.toLocaleString()} → *${(before + amount).toLocaleString()}*`, F].join('\n') }, { quoted: msg });
}
module.exports = { KINDS, run, grantAll, findUser, parseAmount };
