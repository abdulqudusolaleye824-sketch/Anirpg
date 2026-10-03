// ═══════════════════════════════════════════════════════════════
// /instance — Job Change Quest instance dungeons (DM only)
//   Push #96h-z9: 10 floors × 5 monsters, 2 h limit (auto-closes), NO auto-attack.
//   Combat uses the SAME commands as regular dungeons, routed here while inside:
//     /attack                 → basic strike
//     /attack <id>            → equipped attack pattern
//     /skillcmd <skill>       → class skill (also /cast, /skill)
//   /instance start [job] · /instance (status) · /instance leave
// ═══════════════════════════════════════════════════════════════
const UI = require('../../rpg/utils/UI');
const ID = require('../../rpg/utils/InstanceDungeon');
const JS = require('../../rpg/utils/JobSystem');

module.exports = {
  name: 'instance',
  aliases: ['jobquest', 'inst'],
  description: '🏚️ Instance dungeon — 10 floors × 5 monsters in DM, clears a Job Change Quest (needs an Instance Key)',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key?.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];
    if (!player) return sock.sendMessage(chatId, { text: '❌ Register first! Use /register' }, { quoted: msg });
    const pro = UI.isPro(player);
    const FRAME = pro ? UI.PRO_BAR : UI.FREE_BAR;
    const sub = String(args[0] || '').toLowerCase();
    if (String(chatId).endsWith('@g.us')) return sock.sendMessage(chatId, { text: `🏚️ Instance dungeons run in your *DM* — message me privately: /instance` }, { quoted: msg });

    // 2 h limit — an expired instance closes itself the moment the hunter touches it.
    { const ex = ID.expireCheck(player); if (ex) { saveDatabase(); await sock.sendMessage(chatId, { text: [FRAME, ...ex.lines, FRAME].join('\n') }, { quoted: msg }); if (sub === 'attack' || sub === 'skill' || sub === 'a' || sub === 's') return; } }

    if (sub === 'start' || sub === 'enter') {
      const r = ID.start(player, args.slice(1).join(' '));
      if (!r.ok) return sock.sendMessage(chatId, { text: `❌ ${r.error}` }, { quoted: msg });
      saveDatabase();
      const m = r.inst.monster;
      return sock.sendMessage(chatId, { text: [FRAME, `🏚️ *INSTANCE OPENED — ${r.job.emoji} ${r.job.name.toUpperCase()} QUEST*`, FRAME, `🗝️ Key consumed (${ID.keys(player)} left).`, `🏯 *${ID.FLOORS} floors × ${ID.PER_FLOOR} monsters* — the 5th of every floor is its boss. Clear floor ${ID.FLOORS} and the job is yours.`, `⏰ *2 hours* — then the instance closes itself. No auto-attacks: every move is yours.`, ``, `➡️ *Floor 1 · 1/${ID.PER_FLOOR}* — ${m.emoji} *${m.name}* [${m.rank}] HP ${m.stats.maxHp}`, ``, `⚔️ /attack · /attack <id> · /skillcmd <skill>`, `🚪 /instance leave`, FRAME].join('\n') }, { quoted: msg });
    }

    if (sub === 'attack' || sub === 'skill' || sub === 'a' || sub === 's') {
      const q = (sub === 'skill' || sub === 's') ? args.slice(1).join(' ') : args.slice(1).join(' ');
      if ((sub === 'skill' || sub === 's') && !q) return sock.sendMessage(chatId, { text: '❌ Which skill? /skillcmd <name>' }, { quoted: msg });
      if (!player.instance || !player.instance.active) return sock.sendMessage(chatId, { text: '❌ You are not inside an instance — /instance start' }, { quoted: msg });
      if (player._instBusy && Date.now() - player._instBusy < 15000) return sock.sendMessage(chatId, { text: `⏳ *Your last move is still resolving!* Wait for the turn to finish.` }, { quoted: msg });
      player._instBusy = Date.now();
      const UC = require('../../rpg/utils/UnifiedCombat');
      const inst = player.instance; const floorNo = inst.floor, slotNo = inst.slot || 1;
      let r;
      try {
        r = await ID.act(player, q, {
          // Multi-message detail flow — identical to regular dungeons (move card, effect, result, HP bars).
          strike: async (move, m) => UC.playTurn(sock, chatId, { attacker: player, defender: m, move, defenderBar: m.isBoss ? 'boss' : 'monster', tag: `🏚️ *Floor ${floorNo} · ${slotNo}/${ID.PER_FLOOR}*`, gapMs: 400 }),
        });
      } finally { player._instBusy = 0; }
      if (!r.ok) return sock.sendMessage(chatId, { text: `❌ ${r.error}` }, { quoted: msg });
      if (r.floorCleared || (r.lines || []).some(l => /falls!/.test(l))) { try { const QD = require('../../rpg/utils/QuestDispatcher'); QD.trackAndNotify(player, 'kill', 1, sock, sender, chatId); if (r.bossKill) QD.trackAndNotify(player, 'boss', 1, sock, sender, chatId); if (r.floorCleared) { QD.trackAndNotify(player, 'floor', 1, sock, sender, chatId); QD.trackAndNotify(player, 'deepest', floorNo, sock, sender, chatId); } } catch (e) {} }
      saveDatabase();
      const live = player.instance && player.instance.active;
      const tail = r.ended ? [] : [``, `❤️ ${player.stats.hp}/${require('../../rpg/utils/GearSystem').effectiveMaxHp(player)} · ⚡ ${player.stats.energy}/${player.stats.maxEnergy}${live ? ` · ${player.instance.monster.emoji} ${player.instance.monster.name} ${player.instance.monster.stats.hp}/${player.instance.monster.stats.maxHp}` : ''}`, `⚔️ /attack · /attack <id> · /skillcmd <skill>`];
      const body = [...(r.lines || []), ...tail].filter(l => l !== undefined && l !== null);
      if (!body.length) return;
      return sock.sendMessage(chatId, { text: [FRAME, ...body, FRAME].join('\n') }, { quoted: msg });
    }

    if (sub === 'leave' || sub === 'exit' || sub === 'quit') {
      if (!player.instance || !player.instance.active) return sock.sendMessage(chatId, { text: '❌ You are not inside an instance.' }, { quoted: msg });
      const r = ID.end(player, true); saveDatabase();
      return sock.sendMessage(chatId, { text: [FRAME, ...r.lines, FRAME].join('\n') }, { quoted: msg });
    }

    const st = ID.status(player);
    if (st) return sock.sendMessage(chatId, { text: [FRAME, st, FRAME].join('\n') }, { quoted: msg });
    const elig = ID.eligibleJobs(player);
    return sock.sendMessage(chatId, { text: [FRAME, `🏚️ *INSTANCE DUNGEONS*`, FRAME, `Job changes are sealed behind *Job Change Quests*: a DM dungeon of *${ID.FLOORS} floors × ${ID.PER_FLOOR} monsters* (the 5th of each floor is its boss). Clear floor ${ID.FLOORS} within *2 hours* and the job is yours.`, `⚔️ Same combat as regular dungeons: /attack · /attack <id> · /skillcmd <skill>. No auto-attacks.`, `🗝️ Keys: *${ID.keys(player)}* — 10% chance each time you finish all 4 daily quests (only when a job change is open to you). Bound, not tradeable.`, elig.length ? `🧭 Open to you: ${elig.map(j => `${j.emoji} ${j.name}`).join(', ')}` : `🧭 No job change open yet — /job list`, player.jobQuest && player.jobQuest.cleared ? `🏆 Cleared: *${(JS.BY_KEY[player.jobQuest.cleared] || {}).name}* — /job change ${(JS.BY_KEY[player.jobQuest.cleared] || {}).name}` : null, ``, `▶️ /instance start [job]`, FRAME].filter(l => l !== null).join('\n') }, { quoted: msg });
  },
};
