// ═══════════════════════════════════════════════════════════════
// /contract — View Guild Hire Contract & Remaining Weeks
// Shows weekly wage, total duration, weeks paid, remaining weeks, next pay
// ═══════════════════════════════════════════════════════════════

'use strict';

const CM = require('../../rpg/utils/GuildContractManager');

const Week = 7 * 24 * 60 * 60 * 1000;

function formatDate(ms) {
  if (!ms) return 'Unknown';
  try {
    // WAT (UTC+1)
    const d = new Date(ms + 3600000);
    return d.toISOString().slice(0, 10); // YYYY-MM-DD
  } catch { return new Date(ms).toLocaleDateString(); }
}

function formatDaysLeft(nextPayAt) {
  if (!nextPayAt) return 'N/A';
  const diff = nextPayAt - Date.now();
  if (diff <= 0) return 'Due now';
  const days = Math.ceil(diff / (24 * 60 * 60 * 1000));
  if (days === 1) return '1 day';
  return `${days} days`;
}

function findGuild(db, ref) {
  if (!db?.guilds || !ref) return null;
  if (db.guilds[ref]) return db.guilds[ref];
  const lower = String(ref).toLowerCase();
  return Object.values(db.guilds).find(g => g && g.name && g.name.toLowerCase() === lower) || null;
}

function findUserName(db, jid) {
  if (!jid) return jid;
  const bare = String(jid).split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
  for (const [k, u] of Object.entries(db.users || {})) {
    const kb = String(k).split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
    if (kb === bare) return u.name || jid;
  }
  return String(jid).split('@')[0];
}

module.exports = {
  name: 'contract',
  aliases: ['contracts', 'mycontract', 'guildcontract'],
  description: '📜 View your guild hire contract and remaining weeks',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const UI = require('../../rpg/utils/UI');
    const pro = UI.isPro(db.users?.[sender] || {});
    const FRAME = pro ? UI.PRO_BAR : UI.FREE_BAR;

    const mentionedId = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const targetId = mentionedId || sender;
    const isOwn = targetId === sender;
    const targetPlayer = db.users[targetId];

    if (!targetPlayer) {
      return sock.sendMessage(chatId, {
        text: mentionedId ? `❌ That player is not registered.` : `❌ You are not registered! Use /register.`
      }, { quoted: msg });
    }

    const guildRef = targetPlayer.guild;
    if (!guildRef) {
      const who = isOwn ? 'You are' : `*${targetPlayer.name}* is`;
      return sock.sendMessage(chatId, {
        text: (pro ? `${UI.PRO_BAR}\n📜 *GUILD CONTRACT* 💎\n${UI.PRO_BAR}\n\n${who} not in a guild.\nJoin a guild to get a hire contract via /guild hire.\n${UI.PRO_BAR}\n${UI.PRO_MINI}\n💎 *PRO CONTRACT* — guildless` : `📜 *GUILD CONTRACT*\n${UI.FREE_BAR}\n\n${who} not in a guild.\nJoin a guild to get a hire contract via /guild hire.\n${UI.FREE_BAR}\n${UI.upsell()}`)
      }, { quoted: msg });
    }

    const guild = findGuild(db, guildRef);
    if (!guild) {
      return sock.sendMessage(chatId, {
        text: `❌ Guild *${guildRef}* not found.`
      }, { quoted: msg });
    }

    const guildId = guild.id || guildRef;
    const contract = CM.getContract(db, guildId, targetId);

    if (!contract) {
      const who = isOwn ? 'You have' : `*${targetPlayer.name}* has`;
      return sock.sendMessage(chatId, {
        text: (pro ? `${UI.PRO_BAR}\n📜 *GUILD CONTRACT — ${guild.name}* 💎\n${UI.PRO_BAR}\n\n${who} no active hire contract.\n\n💡 Guild Masters can hire with:\n\`/guild hire @player <weeklyNexus> <weeklyMana> <weeks>\`\nExample: \`/guild hire @hunter 5000 100 4\`\n${UI.PRO_BAR}\n${UI.PRO_MINI}\n💎 *PRO CONTRACT* — unsigned` : `📜 *GUILD CONTRACT — ${guild.name}*\n${UI.FREE_BAR}\n\n${who} no active hire contract.\n\n💡 Guild Masters can hire with:\n\`/guild hire @player <weeklyNexus> <weeklyMana> <weeks>\`\nExample: \`/guild hire @hunter 5000 100 4\`\n${UI.FREE_BAR}\n${UI.upsell()}`)
      }, { quoted: msg });
    }

    // Ensure weekly pay is caught up before display
    try { CM.processWeeklyPay(db, guildId, saveDatabase); } catch {}

    const fresh = CM.getContract(db, guildId, targetId) || contract;
    const c = fresh;

    const weeksPaid = c.weeksPaid || 0;
    const totalWeeks = c.weeks || c.totalWeeks || 0;
    const remainingWeeks = Math.max(0, totalWeeks - weeksPaid);
    const weeklyNexus = c.weeklyNexus || 0;
    const weeklyMana = c.weeklyMana || 0;
    const remaining = CM.remainingBalance(db, guildId, targetId) || { nexus: weeklyNexus * remainingWeeks, mana: weeklyMana * remainingWeeks, weeksLeft: remainingWeeks };

    let status = '🟢 ACTIVE';
    let statusDetail = '';
    if (c.completedAt) {
      status = '✅ COMPLETED';
      statusDetail = `Completed on ${formatDate(c.completedAt)}`;
    } else if (c.defaultedAt) {
      status = '🔴 DEFAULTED';
      statusDetail = c.defaultReason || `Defaulted on ${formatDate(c.defaultedAt)}`;
    } else if (!c.active) {
      status = '⚪ INACTIVE';
      statusDetail = remainingWeeks === 0 ? 'Contract fully paid' : 'Inactive';
    } else if (remainingWeeks === 0) {
      status = '✅ COMPLETED';
      statusDetail = 'All weeks paid';
    }

    const progressBar = (() => {
      const total = totalWeeks || 1;
      const paid = Math.min(weeksPaid, total);
      const filled = Math.round((paid / total) * 10);
      return `${UI.bar(paid, total, 10, pro)}` + (pro ? ` ${paid}/${total}` : ` ${paid}/${total}`);
    })();

    const nextPayText = c.active && remainingWeeks > 0 ? `${formatDate(c.nextPayAt)} (${formatDaysLeft(c.nextPayAt)})` : '—';

    const hiredByName = c.hiredBy ? findUserName(db, c.hiredBy) : 'Unknown';
    const endAt = c.startAt ? c.startAt + totalWeeks * Week : null;

    const whoLine = isOwn ? 'Your contract' : `*${targetPlayer.name}'s* contract`;

    const lines = [
      ...(pro ? [UI.PRO_BAR, `📜 *GUILD HIRE CONTRACT* 💎`, UI.PRO_BAR] : [`📜 *GUILD HIRE CONTRACT*`, UI.FREE_BAR]),
      ``,
      `🏰 Guild: *${guild.name}* (\`${guildId}\`)`,
      `👤 Hunter: *${targetPlayer.name}* ${isOwn ? '(You)' : ''}`,
      `📋 ${whoLine}`,
      ``,
      FRAME,
      `📊 *STATUS: ${status}*`,
      FRAME,
      statusDetail ? `ℹ️ ${statusDetail}` : null,
      `📈 Progress: \`${progressBar}\``,
      ``,
      FRAME,
      `💰 *WAGE & DURATION*`,
      FRAME,
      `💠 Weekly Nexus: *${weeklyNexus.toLocaleString()}*`,
      `💎 Weekly Mana Stones: *${weeklyMana.toLocaleString()}*`,
      `⏳ Total Duration: *${totalWeeks} week${totalWeeks !== 1 ? 's' : ''}*`,
      `✅ Weeks Paid: *${weeksPaid}*`,
      `⏰ Remaining Weeks: *${remainingWeeks}*`,
      ``,
      `📦 Remaining Balance: *${remaining.nexus.toLocaleString()} Nexus* + *${remaining.mana.toLocaleString()} Mana*`,
      ``,
      FRAME,
      `📅 *TIMELINE*`,
      FRAME,
      `▶️ Started: *${formatDate(c.startAt)}*`,
      `⏭️ Next Pay: *${nextPayText}*`,
      endAt ? `🏁 Ends: *${formatDate(endAt)}*` : null,
      `👔 Hired By: *${hiredByName}*`,
      ``,
      FRAME,
      remainingWeeks > 0 && c.active ? `💡 Weekly wage is auto-deducted from guild treasury each week.` : null,
      c.active && remainingWeeks > 0 ? `⚠️ Kicking this hunter pays *×2* remaining balance!` : null,
      FRAME,
      ...(pro ? [UI.PRO_MINI, `💎 *PRO CONTRACT* — ${remainingWeeks}w left · ${remaining.nexus.toLocaleString()} Nexus due`] : [UI.upsell()]),
    ].filter(Boolean).join('\n');

    return sock.sendMessage(chatId, { text: lines }, { quoted: msg });
  }
};
