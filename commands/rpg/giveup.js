// ═══════════════════════════════════════════════════════════════
// /giveup @hunter <amount> — Push #95: share Upgrade Points (cap 20 UP per day)
// ═══════════════════════════════════════════════════════════════
const UI = require('../../rpg/utils/UI');
const DS = require('../../rpg/utils/DomainSystem');

function bare(j) { return String(j || '').split('@')[0].split(':')[0].replace(/\D/g, ''); }
function findPlayer(db, args, ctx, selfJid) {
  const mentioned = ctx?.mentionedJid?.[0];
  const replied = ctx?.participant;
  for (const cand of [mentioned, replied]) {
    if (!cand) continue;
    if (db.users?.[cand]) return { jid: cand, player: db.users[cand] };
    const b = bare(cand);
    for (const [k, u] of Object.entries(db.users || {})) if (bare(k) === b) return { jid: k, player: u };
  }
  const words = args.filter(a => !/^\d{1,3}$/.test(a));
  const arg = (words[0] || '').trim();
  if (!arg) return null;
  const b = arg.replace(/\D/g, '');
  if (b.length >= 8) for (const [k, u] of Object.entries(db.users || {})) if (bare(k) === b || bare(u?.id) === b) return { jid: k, player: u };
  const q = words.join(' ').trim().toLowerCase();
  for (const [k, u] of Object.entries(db.users || {})) if (k !== selfJid && u?.name && String(u.name).toLowerCase() === q) return { jid: k, player: u };
  return null;
}

module.exports = {
  name: 'giveup',
  aliases: ['shareup', 'sendup'],
  description: '🎁 Share Upgrade Points with another hunter — /giveup @hunter <amount> (max 20 UP/day)',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key?.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];
    if (!player) return sock.sendMessage(chatId, { text: '❌ Register first! Use /register' }, { quoted: msg });
    const pro = UI.isPro(player);
    const FRAME = pro ? UI.PRO_BAR : UI.FREE_BAR;
    const ctx = msg.message?.extendedTextMessage?.contextInfo;
    const amountArg = [...args].reverse().find(a => /^\d{1,3}$/.test(a));
    const amount = parseInt(amountArg, 10);
    const day = new Date().toISOString().slice(0, 10);
    const sentToday = player.upShare && player.upShare.day === day ? player.upShare.sent : 0;
    if (!amountArg) return sock.sendMessage(chatId, { text: [FRAME, `🎁 *SHARE UPGRADE POINTS*`, FRAME, `/giveup @hunter <amount>`, `You have *${player.upgradePoints || 0} UP* · shared today: ${sentToday}/${DS.UP_SHARE_CAP}`].join('\n') }, { quoted: msg });
    const target = findPlayer(db, args, ctx, sender);
    if (!target) return sock.sendMessage(chatId, { text: '❌ Tag the hunter: /giveup @hunter <amount>' }, { quoted: msg });
    const r = DS.shareUP(player, target.player, amount);
    if (!r.ok) return sock.sendMessage(chatId, { text: `❌ ${r.error}` }, { quoted: msg });
    saveDatabase();
    const text = [FRAME, `🎁 *UPGRADE POINTS SHARED*`, FRAME, `👤 *${player.name}* → *${target.player.name}*: *+${r.sent} UP*`, `📊 You: ${player.upgradePoints} UP · ${target.player.name}: ${target.player.upgradePoints} UP`, `📅 ${r.left} UP left to share today`].join('\n');
    await sock.sendMessage(chatId, { text, mentions: [target.jid] }, { quoted: msg });
    if (target.jid !== chatId && !String(chatId).endsWith('@g.us')) { try { await sock.sendMessage(target.jid, { text: `🎁 *${player.name}* sent you *+${r.sent} UP*! You now have ${target.player.upgradePoints} UP.` }); } catch (e) {} }
  },
};
