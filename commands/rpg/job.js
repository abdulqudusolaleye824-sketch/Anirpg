// ═══════════════════════════════════════════════════════════════
// /job — Push #95: the Job progression layer (20 Jobs × 5 Job Levels)
//   /job                → your job card + XP to next Job level
//   /job list           → the 20-job ladder (✅ available · 🔒 locked)
//   /job info <job>     → the 5 Job levels, what each really does
//   /job change <job>   → take/change job (needs a cleared Job Change Quest)
// ═══════════════════════════════════════════════════════════════
const UI = require('../../rpg/utils/UI');
const JS = require('../../rpg/utils/JobSystem');

module.exports = {
  name: 'job',
  aliases: ['jobs', 'profession'],
  description: '🧭 Jobs — a second progression path on top of your class (20 Jobs × 5 Job Levels)',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key?.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];
    if (!player) return sock.sendMessage(chatId, { text: '❌ Register first! Use /register' }, { quoted: msg });
    const pro = UI.isPro(player);
    const FRAME = pro ? UI.PRO_BAR : UI.FREE_BAR;
    const sub = String(args[0] || '').toLowerCase();
    JS.ensure(player);

    if (sub === 'list' || sub === 'all') {
      const lines = JS.JOBS.map((j, i) => {
        const ok = JS.isAvailable(player, j);
        const cur = player.job.key === j.key ? ' ◀️ *you*' : '';
        const un = JS.isUnlocked(player, j); const nx = JS.nextQuestJob(player);
        const mark = un ? '🔓' : (nx && nx.key === j.key ? '🗝️' : (ok ? '⏳' : '🔒'));
        return `${mark} ${String(i + 1).padStart(2, ' ')}. ${j.emoji} *${j.name}* — Lv.${j.unlock}${cur}`;
      });
      return sock.sendMessage(chatId, { text: [FRAME, `🧭 *JOB DIRECTORY* — 20 paths, 5 Job Levels each`, FRAME, ...lines, FRAME, `🔓 unlocked · 🗝️ next quest · ⏳ later on the ladder · 🔒 level-locked`, `📖 /job info <job> · 🔁 /job switch <job> (unlocked) · /job change <job> (after its quest)`, `🗝️ Job changes need a cleared Job Change Quest (/instance).`].join('\n') }, { quoted: msg });
    }

    if (sub === 'info' || sub === 'view') {
      const job = JS.findJob(args.slice(1).join(' '));
      if (!job) return sock.sendMessage(chatId, { text: `❌ Unknown job. See /job list` }, { quoted: msg });
      const lines = [FRAME, `${job.emoji} *${job.name.toUpperCase()}* — ${job.tier} Job · unlocks Lv.${job.unlock}`, FRAME];
      for (let lv = 1; lv <= 5; lv++) {
        lines.push(`*Job Lv.${lv} — ${job.levels[lv - 1]}*`);
        lines.push(`_${job.lore[lv - 1]}_`);
        lines.push(...JS.describeMods(job, lv));
        lines.push('');
      }
      lines.push(`📈 Job XP to reach Lv.2–5: ${JS.JOB_XP_PER_LEVEL.slice(1).join(' / ')} (earned from raid, dungeon, PvP and instance wins).`);
      lines.push(FRAME);
      return sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: msg });
    }

    if (sub === 'switch' || sub === 'equip' || sub === 'swap') {
      const q = args.slice(1).join(' ');
      const un = JS.unlockedKeys(player);
      if (!q) {
        const nx = JS.nextQuestJob(player);
        return sock.sendMessage(chatId, { text: [FRAME, `🔁 *JOB SWITCH* — unlocked jobs`, FRAME, ...(un.length ? un.map(k => { const j = JS.findJob(k); return j ? `${player.job.key === k ? '▶️' : '•'} ${j.emoji} *${j.name}*` : null; }).filter(Boolean) : ['_(none unlocked yet)_']), ``, `Usage: /job switch <job>`, nx ? `🗝️ Next to unlock: ${nx.emoji} *${nx.name}* — clear its Job Change Quest (/instance)` : (un.length === JS.JOBS.length ? '🏁 Every job unlocked.' : '🔒 Level up to reach the next job on the ladder.'), FRAME].join('\n') }, { quoted: msg });
      }
      const job = JS.findJob(q);
      if (!job) return sock.sendMessage(chatId, { text: `❌ Unknown job. See /job list` }, { quoted: msg });
      if (!JS.isUnlocked(player, job)) { const nx = JS.nextQuestJob(player); return sock.sendMessage(chatId, { text: `🔒 ${job.emoji} *${job.name}* is not unlocked. Jobs unlock in order${nx ? ` — next: ${nx.emoji} *${nx.name}* (/instance)` : ''}.` }, { quoted: msg }); }
      const r = JS.setJob(player, job);
      if (!r.ok) return sock.sendMessage(chatId, { text: `❌ ${r.error}` }, { quoted: msg });
      saveDatabase();
      return sock.sendMessage(chatId, { text: [FRAME, `🔁 *JOB SWITCHED*`, FRAME, `👤 *${player.name}* returns to the path of the ${job.emoji} *${job.name}*`, `⭐ Job Lv.${r.level} — _${job.levels[r.level - 1]}_ (progress kept)`, FRAME].join('\n') }, { quoted: msg });
    }

    if (sub === 'change' || sub === 'take' || sub === 'set') {
      const job = JS.findJob(args.slice(1).join(' '));
      if (!job) return sock.sendMessage(chatId, { text: `❌ Unknown job. See /job list` }, { quoted: msg });
      const r = JS.setJob(player, job);
      if (!r.ok) return sock.sendMessage(chatId, { text: `❌ ${r.error}` }, { quoted: msg });
      saveDatabase();
      return sock.sendMessage(chatId, { text: [FRAME, `🧭 *JOB CHANGE COMPLETE*`, FRAME, `👤 *${player.name}* now walks the path of the ${job.emoji} *${job.name}*`, `⭐ Job Lv.${r.level} — _${job.levels[r.level - 1]}_`, `_${job.lore[r.level - 1]}_`, ...JS.describeMods(job, r.level), FRAME, `📈 Job XP grows with every raid, dungeon, PvP and instance win.`].join('\n') }, { quoted: msg });
    }

    // default: card
    const job = JS.current(player);
    if (!job) {
      const avail = JS.available(player);
      return sock.sendMessage(chatId, { text: [FRAME, `🧭 *NO JOB YET*`, FRAME, `Your class is your combat identity — a *Job* is a second progression layer on top.`, avail.length ? `Available at Lv.${player.level || 1}: ${avail.map(j => `${j.emoji} ${j.name}`).join(', ')}` : `First job unlocks at Lv.5 (🐺 Wolf Assassin).`, ``, `🗝️ Taking a job needs a cleared *Job Change Quest*: finish all 4 daily quests for a chance at an instance key, then /instance.`, `📖 /job list · /job info <job>`].join('\n') }, { quoted: msg });
    }
    const lv = JS.level(player); const next = JS.xpToNext(player);
    const clsName = player.class || 'Unawakened';
    return sock.sendMessage(chatId, { text: [FRAME, `🧭 *${player.name.toUpperCase()}'S JOB*`, FRAME, `🎭 Class: *${clsName}*`, `${job.emoji} Job: *${job.name}* Lv.${lv} — _${job.levels[lv - 1]}_`, `📊 Level: ${player.level || 1}`, ``, `_${job.lore[lv - 1]}_`, ...JS.describeMods(job, lv), ``, next == null ? `🏆 Job mastered (Lv.5).` : `📈 ${next.toLocaleString()} Job XP to Job Lv.${lv + 1} — *${job.levels[lv]}*`, player.jobQuest && player.jobQuest.cleared ? `🗝️ Job Change Quest cleared for *${(JS.BY_KEY[player.jobQuest.cleared] || {}).name || player.jobQuest.cleared}* — /job change ${(JS.BY_KEY[player.jobQuest.cleared] || {}).name || ''}` : null, FRAME].filter(l => l !== null).join('\n') }, { quoted: msg });
  },
};
