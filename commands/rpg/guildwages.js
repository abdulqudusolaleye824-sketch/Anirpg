// /guildwages — Push #96h-e: Guild Master / Vice view of the whole payroll.
'use strict';
const CM = require('../../rpg/utils/GuildContractManager');
function _bare(j) { return String(j || '').split(':')[0].split('@')[0]; }
function _name(db, jid, bare) { const u = db.users?.[jid] || CM.findUserInDb(db, bare); return (u && (u.name || u.username)) || `+${bare}`; }
module.exports = {
  name: 'guildwages',
  aliases: ['gwages', 'payroll'],
  description: '💼 [GM/Vice] Total weekly wages owed to all guild members',
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid; const db = getDatabase();
    const UI = require('../../rpg/utils/UI'); const me = db.users?.[sender];
    const FRAME = UI.isPro(me || {}) ? UI.PRO_BAR : UI.FREE_BAR;
    const say = (text) => sock.sendMessage(chatId, { text }, { quoted: msg });
    if (!me) return say('❌ You are not registered! Use /register.');
    const guild = CM.resolvePlayerGuild(db, sender, me);
    if (!guild) return say('❌ You are not in a guild.');
    if (!CM.isGuildMasterOrVice(db, guild.name, sender)) return say('❌ Only the *Guild Master* or a *Vice* can see the guild payroll.');
    const guildId = Object.keys(db.guilds || {}).find(id => db.guilds[id] === guild) || guild.id;
    // Push #96h-t: ALWAYS the live picture — settle any overdue paydays first, then skip contracts of hunters who left the guild.
    try { if (CM.processWeeklyPay(db, guildId, null).length) saveDatabase(); } catch (e) {}
    const bucket = (db.guildContracts && db.guildContracts[guildId]) || {};
    const rows = []; let _gone = 0;
    let weekNexus = 0, weekMana = 0, owedNexus = 0, owedMana = 0, paidNexus = 0, paidMana = 0;
    for (const [key, c] of Object.entries(bucket)) {
      if (!c || c.active === false || c.completedAt || c.defaultedAt) continue;
      const weeksLeft = Math.max(0, (c.weeks || 0) - (c.weeksPaid || 0)); if (!weeksLeft) continue;
      const bare = _bare(c.jid || key);
      if (!CM.isGuildMember(db, guild.name, c.jid || key)) { _gone++; continue; }
      weekNexus += c.weeklyNexus || 0; weekMana += c.weeklyMana || 0;
      owedNexus += (c.weeklyNexus || 0) * weeksLeft; owedMana += (c.weeklyMana || 0) * weeksLeft;
      paidNexus += (c.weeklyNexus || 0) * (c.weeksPaid || 0); paidMana += (c.weeklyMana || 0) * (c.weeksPaid || 0);
      rows.push({ name: _name(db, c.jid || key, bare), nexus: c.weeklyNexus || 0, mana: c.weeklyMana || 0, weeksLeft, next: c.nextPayAt || 0 });
    }
    rows.sort((a, b) => (b.nexus + b.mana / 10) - (a.nexus + a.mana / 10));
    const nextDue = rows.filter(r => r.next).sort((a, b) => a.next - b.next)[0];
    const tre = guild.treasury || 0, treM = guild.manaTreasury || 0;
    const cover = weekNexus || weekMana ? Math.min(weekNexus ? Math.floor(tre / weekNexus) : 99, weekMana ? Math.floor(treM / weekMana) : 99) : null;
    const lines = [FRAME, `💼 *${guild.name} — PAYROLL*`, FRAME,
      `👥 Contracted members: *${rows.length}*${_gone ? ` _(＋${_gone} contract${_gone === 1 ? '' : 's'} of hunters who left — not counted)_` : ''}`,
      `👥 Guild roster now: *${((guild.members || guild.memberData || []).length) || '—'}* · 🏅 Lv.${guild.level || 1}`,
      `📅 *Weekly total:* 💠 ${weekNexus.toLocaleString()} · 💎 ${weekMana.toLocaleString()}`,
      `📊 *Still owed (all remaining weeks):* 💠 ${owedNexus.toLocaleString()} · 💎 ${owedMana.toLocaleString()}`,
      `✅ *Paid out so far:* 💠 ${paidNexus.toLocaleString()} · 💎 ${paidMana.toLocaleString()}`,
      `🏦 *Treasury:* 💠 ${tre.toLocaleString()} · 💎 ${treM.toLocaleString()}${cover != null ? ` — covers *${cover >= 99 ? '99+' : cover}* week${cover === 1 ? '' : 's'}${cover < 1 ? ' ⚠️ next payday will DEFAULT' : ''}` : ''}`,
      nextDue ? `⏰ Next payday: ${new Date(nextDue.next + 3600000).toISOString().slice(0, 10)}` : '',
      ``, rows.length ? `*Per member (weekly · weeks left)*` : `_No active contracts — hire with /guild hire._`,
      ...rows.slice(0, 25).map((r, i) => `${i + 1}. *${r.name}* — 💠 ${r.nexus.toLocaleString()} · 💎 ${r.mana.toLocaleString()} · ${r.weeksLeft}w`),
      rows.length > 25 ? `…and ${rows.length - 25} more` : '', FRAME].filter(l => l !== '');
    return say(lines.join('\n'));
  },
};
