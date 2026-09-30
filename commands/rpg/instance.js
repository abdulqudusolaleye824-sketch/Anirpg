// ═══════════════════════════════════════════════════════════════
// /instance — Push #95: Job Change Quest instance dungeons (DM only)
//   /instance                 → status / how it works
//   /instance start [job]     → spend an Instance Key, open the endless dungeon
//   /instance attack          → strike (the monster answers in the same message)
//   /instance skill <name>    → cast a skill
//   /instance leave           → walk out (cleared if you reached the target floor)
// ═══════════════════════════════════════════════════════════════
const UI = require('../../rpg/utils/UI');
const ID = require('../../rpg/utils/InstanceDungeon');
const JS = require('../../rpg/utils/JobSystem');

module.exports = {
  name: 'instance',
  aliases: ['jobquest', 'inst'],
  description: '🏚️ Instance dungeon — endless floors in DM, clears a Job Change Quest (needs an Instance Key)',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key?.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];
    if (!player) return sock.sendMessage(chatId, { text: '❌ Register first! Use /register' }, { quoted: msg });
    const pro = UI.isPro(player);
    const FRAME = pro ? UI.PRO_BAR : UI.FREE_BAR;
    const sub = String(args[0] || '').toLowerCase();
    if (String(chatId).endsWith('@g.us')) return sock.sendMessage(chatId, { text: `🏚️ Instance dungeons run in your *DM* — message me privately: /instance` }, { quoted: msg });

    if (sub === 'start' || sub === 'enter') {
      const r = ID.start(player, args.slice(1).join(' '));
      if (!r.ok) return sock.sendMessage(chatId, { text: `❌ ${r.error}` }, { quoted: msg });
      saveDatabase();
      const m = r.inst.monster;
      return sock.sendMessage(chatId, { text: [FRAME, `🏚️ *INSTANCE OPENED — ${r.job.emoji} ${r.job.name.toUpperCase()} QUEST*`, FRAME, `🗝️ Key consumed (${ID.keys(player)} left). Endless floors — reach *floor ${r.target}* to clear the quest. Every 5th floor is a boss. Falling ends the run (you keep what you earned).`, ``, `➡️ *Floor 1* — ${m.emoji} *${m.name}* [${m.rank}] HP ${m.stats.maxHp}`, `⚔️ /instance attack · ✨ /instance skill <name> · 🌌 /domain expand`, FRAME].join('\n') }, { quoted: msg });
    }
    if (sub === 'attack' || sub === 'skill' || sub === 'a' || sub === 's') {
      const q = (sub === 'skill' || sub === 's') ? args.slice(1).join(' ') : '';
      if ((sub === 'skill' || sub === 's') && !q) return sock.sendMessage(chatId, { text: '❌ Which skill? /instance skill <name>' }, { quoted: msg });
      const r = ID.act(player, q);
      if (!r.ok) return sock.sendMessage(chatId, { text: `❌ ${r.error}` }, { quoted: msg });
      saveDatabase();
      const inst = player.instance;
      const tail = r.ended ? [] : [``, `❤️ ${player.stats.hp}/${require('../../rpg/utils/GearSystem').effectiveMaxHp(player)} · ⚡ ${player.stats.energy}/${player.stats.maxEnergy}${inst && inst.active && !r.floorCleared ? ` · ${inst.monster.emoji} ${inst.monster.name} ${inst.monster.stats.hp}/${inst.monster.stats.maxHp}` : ''}`];
      return sock.sendMessage(chatId, { text: [FRAME, `🏚️ *FLOOR ${inst && inst.active ? (r.floorCleared ? inst.floor - 1 : inst.floor) : (player.instance.last ? player.instance.last.floor : '?')}*`, FRAME, ...r.lines, ...tail].join('\n') }, { quoted: msg });
    }
    if (sub === 'leave' || sub === 'exit' || sub === 'quit') {
      if (!player.instance || !player.instance.active) return sock.sendMessage(chatId, { text: '❌ You are not inside an instance.' }, { quoted: msg });
      const r = ID.end(player, true); saveDatabase();
      return sock.sendMessage(chatId, { text: [FRAME, ...r.lines, FRAME].join('\n') }, { quoted: msg });
    }
    const st = ID.status(player);
    if (st) return sock.sendMessage(chatId, { text: [FRAME, st, FRAME].join('\n') }, { quoted: msg });
    const elig = ID.eligibleJobs(player);
    return sock.sendMessage(chatId, { text: [FRAME, `🏚️ *INSTANCE DUNGEONS*`, FRAME, `Job changes are sealed behind *Job Change Quests*: an endless DM dungeon. Reach the job's target floor and the change is yours.`, `🗝️ Keys: *${ID.keys(player)}* — 10% chance each time you finish all 4 daily quests (only when a job change is open to you). Bound, not tradeable.`, elig.length ? `🧭 Open to you: ${elig.map(j => `${j.emoji} ${j.name} (floor ${ID.targetFloorFor(j)})`).join(', ')}` : `🧭 No job change open yet — /job list`, player.jobQuest && player.jobQuest.cleared ? `🏆 Cleared: *${(JS.BY_KEY[player.jobQuest.cleared] || {}).name}* — /job change ${(JS.BY_KEY[player.jobQuest.cleared] || {}).name}` : null, ``, `▶️ /instance start [job]`, FRAME].filter(l => l !== null).join('\n') }, { quoted: msg });
  },
};
