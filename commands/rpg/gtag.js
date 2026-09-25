// ═══════════════════════════════════════════════════════════════
// /gtag <message> — HIDDEN tag of every guild member (Push #88m).
// The message shows only your text; every member is mentioned invisibly
// so they all get the notification. Guild Master, Vice GMs and Officers.
// ═══════════════════════════════════════════════════════════════
'use strict';

const UI = require('../../rpg/utils/UI');
const GCM = require('../../rpg/utils/GuildContractManager');

const STAFF_RANKS = new Set(['leader', 'guild master', 'grandmaster', 'vice', 'vice gm', 'vice guild master', 'officer']);
function bare(j) { return String(j || '').split(':')[0].split('@')[0]; }
function idOf(m) { return (m && typeof m === 'object') ? (m.id || m.jid) : m; }

function rankOf(guild, jid) {
  if (bare(guild.leader) === bare(jid)) return 'Leader';
  for (const arr of [guild.members, guild.memberData]) for (const m of (arr || [])) if (m && typeof m === 'object' && bare(idOf(m)) === bare(jid) && m.rank) return m.rank;
  if ((guild.officers || []).some(o => bare(idOf(o)) === bare(jid))) return 'Officer';
  return 'Member';
}

// Every member JID (deduped by bare number, resolved to a real @-JID).
function memberJids(db, guild) {
  const seen = new Map();
  const add = (j) => { if (!j) return; const b = bare(j); if (!b) return; const real = String(j).includes('@') ? String(j) : (Object.keys(db.users || {}).find(k => bare(k) === b) || `${b}@s.whatsapp.net`); if (!seen.has(b)) seen.set(b, real); };
  add(guild.leader);
  for (const arr of [guild.members, guild.memberData, guild.officers]) for (const m of (arr || [])) add(idOf(m));
  for (const [k, u] of Object.entries(db.users || {})) if (u && u.guild && guild.name && String(u.guild).toLowerCase() === String(guild.name).toLowerCase()) add(k);
  return [...seen.values()];
}

module.exports = {
  name: 'gtag',
  aliases: ['guildtag', 'gping'],
  description: '📣 Hidden-tag every guild member (GM / Vice / Officers)',
  usage: '/gtag <message>',
  memberJids, rankOf,

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users?.[sender];
    if (!player) return sock.sendMessage(chatId, { text: '❌ Register first! Use /register' }, { quoted: msg });
    if (!chatId.endsWith('@g.us')) return sock.sendMessage(chatId, { text: '❌ /gtag works in groups only.' }, { quoted: msg });
    const FRAME = UI.isPro(player) ? UI.PRO_BAR : UI.FREE_BAR;
    const guild = GCM.resolvePlayerGuild(db, sender, player);
    if (!guild) return sock.sendMessage(chatId, { text: '❌ You are not in a guild!' }, { quoted: msg });
    const rank = rankOf(guild, sender);
    if (!STAFF_RANKS.has(String(rank).toLowerCase())) return sock.sendMessage(chatId, { text: `❌ Only the Guild Master, Vice GMs and Officers of *${guild.name}* can use /gtag.` }, { quoted: msg });
    const text = args.join(' ').trim();
    if (!text) return sock.sendMessage(chatId, { text: '📌 Usage: /gtag <message>\n_Everyone in your guild is tagged invisibly._' }, { quoted: msg });
    const jids = memberJids(db, guild);
    if (!jids.length) return sock.sendMessage(chatId, { text: `ℹ️ *${guild.name}* has no members to tag.` }, { quoted: msg });
    const icon = guild.icon || '🏰';
    return sock.sendMessage(chatId, {
      text: `${FRAME}\n${icon} *${guild.name}* — ${rank}\n${FRAME}\n${text}\n${FRAME}\n_📣 ${jids.length} member${jids.length === 1 ? '' : 's'} notified_`,
      mentions: jids,
    }, { quoted: msg });
  },
};
