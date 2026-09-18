// ═══════════════════════════════════════════════════════════════
// /wages (aka /wage) — Weekly wage PIPELINE status
//
// Different from /contract (which shows the contract TERMS: wage amount,
// duration, weeks remaining). /wages answers the payroll questions:
//   • when the pay is due
//   • when it is being processed (guild master approval)
//   • when it was paid / why a week was skipped
// Push #68: also shows the /daily activity gate (3+ claims to earn the week).
// ═══════════════════════════════════════════════════════════════

'use strict';

const CM = require('../../rpg/utils/GuildContractManager');

function formatDateWAT(ms) {
  if (!ms) return 'Unknown';
  try { return new Date(ms + 3600000).toISOString().slice(0, 10); } catch { return 'Unknown'; }
}

function daysLeftText(ms) {
  if (!ms) return '';
  const diff = ms - Date.now();
  if (diff <= 0) return '(due now)';
  const d = Math.ceil(diff / 86400000);
  return `(${d} day${d === 1 ? '' : 's'})`;
}

module.exports = {
  name: 'wages',
  aliases: ['wage', 'paycheck', 'mypay'],
  description: '💰 Check your weekly guild wage status (due / processing / paid)',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const UI = require('../../rpg/utils/UI');
    const pro = UI.isPro(db.users?.[sender] || {});
    const FRAME = pro ? UI.PRO_BAR : UI.FREE_BAR;

    const mentionedId = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const targetId = mentionedId || sender;
    const isOwn = targetId === sender;
    const player = db.users[targetId];

    if (!player) {
      return sock.sendMessage(chatId, {
        text: mentionedId ? `❌ That player is not registered.` : `❌ You are not registered! Use /register.`,
      }, { quoted: msg });
    }

    // Settle any due weeks before displaying (idempotent).
    try {
      if (player.guild) {
        const g = CM.getSalaryStatus(db, targetId);
        if (g.guildId) CM.processWeeklyPay(db, g.guildId, null);
      }
    } catch (e) {}

    const st = CM.getSalaryStatus(db, targetId);
    const who = isOwn ? 'Your' : `*${player.name}'s*`;

    const head = (t) => (pro ? [UI.PRO_BAR, t, UI.PRO_BAR] : [t, UI.FREE_BAR]);

    if (st.state === 'no_guild' || st.state === 'unregistered') {
      return sock.sendMessage(chatId, {
        text: [
          ...head('💰 *WEEKLY WAGES*'),
          ``,
          `${who} not in a guild — wages come from guild hire contracts.`,
          `Join or create a guild: */guild*`,
          ``,
          FRAME,
          ...(pro ? [UI.PRO_MINI, `💎 *PRO WAGES* — guildless`] : [UI.upsell()]),
        ].join('\n'),
      }, { quoted: msg });
    }

    if (st.state === 'no_contract') {
      return sock.sendMessage(chatId, {
        text: [
          ...head(`💰 *WEEKLY WAGES — ${st.guild}*`),
          ``,
          `${who} no active hire contract with *${st.guild}*.`,
          ``,
          `💡 Guild Masters can hire you with:`,
          `\`/guild hire @you <weeklyNexus> <weeklyMana> <weeks>\``,
          ``,
          `Contract terms: */contract*`,
          ``,
          FRAME,
          ...(pro ? [UI.PRO_MINI, `💎 *PRO WAGES* — unsigned`] : [UI.upsell()]),
        ].join('\n'),
      }, { quoted: msg });
    }

    const c = st.contract;
    const weeksTotal = c.weeks || c.totalWeeks || 0;
    const weeksPaid = c.weeksPaid || 0;

    // ── DUE / PROCESSING headline ─────────────────────────────────────────
    let dueLine, dueIcon;
    if (st.state === 'defaulted') {
      dueIcon = '🔴';
      dueLine = `DEFAULTED — ${c.defaultReason || 'guild treasury was short'}`;
    } else if (st.state === 'completed') {
      dueIcon = '✅';
      dueLine = `CONTRACT FULLY PAID${c.completedAt ? ` (completed ${formatDateWAT(c.completedAt)})` : ''}`;
    } else if (st.dueState === 'processing') {
      dueIcon = '🔄';
      dueLine = `BEING PROCESSED — awaiting your guild master's confirmation (auto-pays after 24h)`;
    } else if (st.dueState === 'will_skip') {
      dueIcon = '⚠️';
      dueLine = `DUE THIS WEEK BUT WILL SKIP — only ${st.claims}/${st.minClaims} daily claims this week`;
    } else if (st.dueState === 'due_now') {
      dueIcon = '🟡';
      dueLine = `DUE NOW — next payout cycle will pay it`;
    } else if (st.dueState === 'scheduled') {
      dueIcon = '';
      dueLine = `NEXT PAY: *${formatDateWAT(c.nextPayAt)}* ${daysLeftText(c.nextPayAt)}`;
    } else {
      dueIcon = '⚪';
      dueLine = 'No active pay schedule';
    }

    // ── This week's activity gate ─────────────────────────────────────────
    const ok = st.claims >= st.minClaims;
    const gateLine = `📅 Dailies this week: *${st.claims}/${st.minClaims}* ${ok ? '✅ wage-eligible' : `⏳ claim /daily ${st.minClaims - st.claims} more time${st.minClaims - st.claims === 1 ? '' : 's'} to earn this week`}`;

    // ── Last payout ───────────────────────────────────────────────────────
    const lp = st.lastPaid;
    const lastLine = lp
      ? `📤 Last paid: *${formatDateWAT(lp.at)}* — ${Number(lp.nexus || 0).toLocaleString()} 💠 N + ${Number(lp.mana || 0).toLocaleString()} 💎 M`
      : `📤 Last paid: *never*`;

    // ── Recent weeks history ──────────────────────────────────────────────
    const hist = (Array.isArray(c.payHistory) ? c.payHistory : []).slice(-4).reverse();
    const ICONS = { paid: '💰 paid', skipped_inactive: '⛔ skipped (inactive)', skipped_denied: '⛔ skipped (master)', defaulted: '🔴 defaulted' };
    const histLines = hist.length
      ? hist.map(h => `   ${ICONS[h.status] || h.status} — ${formatDateWAT(h.at)}${h.reason ? ` _(${h.reason})_` : ''}`).reverse()
      : ['   _(no weeks settled yet)_'];

    const bar = weeksTotal ? UI.bar(weeksPaid, weeksTotal, 10, pro) : `—`;

    const lines = [
      ...head(`💰 *${who.toUpperCase() === 'YOUR' ? 'YOUR WEEKLY WAGES' : player.name.toUpperCase() + "'S WEEKLY WAGES"}*`),
      ``,
      `🏰 Guild: *${st.guild}*`,
      `💰 Weekly wage: *${(c.weeklyNexus || 0).toLocaleString()} Nexus* + *${(c.weeklyMana || 0).toLocaleString()} Mana Stones*`,
      ``,
      FRAME,
      `${dueIcon} *STATUS:* ${dueLine}`,
      FRAME,
      gateLine,
      lastLine,
      `📈 Progress: \`${bar}\` ${weeksPaid}/${weeksTotal} weeks`,
      ``,
      FRAME,
      `🕓 *RECENT WEEKS:*`,
      ...histLines,
      ``,
      `📜 Contract terms: */contract*`,
      FRAME,
      ...(pro ? [UI.PRO_MINI, `💎 *PRO WAGES* — ${st.weeksLeft}w left`] : [UI.upsell()]),
    ];

    return sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: msg });
  },
};
