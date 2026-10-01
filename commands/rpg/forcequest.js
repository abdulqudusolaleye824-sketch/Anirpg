// /forcequest — OWNER ONLY. Instantly completes today's 4 daily quests for
// yourself, or for a tagged / replied-to hunter. Fires the normal completion
// flow (rewards, streak, Instance-Key roll, Pro box buttons). Push #96d.
'use strict';
const Perms = require('../../utils/permissions');
const Target = require('../../utils/target');
const DQ = require('../../rpg/utils/DailyQuestSystem');
const QD = require('../../rpg/utils/QuestDispatcher');

module.exports = {
  name: 'forcequest',
  aliases: ['fq', 'forcedaily'],
  description: '👑 Owner: force-complete daily quests (self or tagged/replied hunter)',
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    if (!Perms.isBotOwner(db, sender)) return sock.sendMessage(chatId, { text: '❌ Owner only.' }, { quoted: msg });
    let targetJid = Target.resolve(msg, args) || sender;
    let player = db.users?.[targetJid];
    if (!player) { // lid / phone mismatch fallback
      const bare = String(targetJid).split('@')[0];
      const k = Object.keys(db.users || {}).find(x => x.split('@')[0] === bare || (db.lidMap && db.lidMap[x.split('@')[0]] === bare));
      if (k) { targetJid = k; player = db.users[k]; }
    }
    if (!player) return sock.sendMessage(chatId, { text: '❌ That hunter is not registered.' }, { quoted: msg });
    DQ.ensureDailyQuests(player);
    const quests = player.dailyQuests?.quests || [];
    const pending = quests.filter(q => !q.completed);
    if (!pending.length) return sock.sendMessage(chatId, { text: `✅ *${player.name}* has already finished today's daily quests.` }, { quoted: msg });
    let last = null;
    for (const q of pending) {
      const amount = q.type === 'floor' ? q.target : Math.max(1, (q.target || 1) - (q.progress || 0));
      last = QD.trackAndNotify(player, q.type, amount, sock, targetJid, chatId);
    }
    try { saveDatabase(); } catch (e) {}
    return sock.sendMessage(chatId, { text: `👑 *FORCE QUEST* — ${pending.length} daily quest${pending.length === 1 ? '' : 's'} completed for *${player.name}*.`, mentions: [targetJid] }, { quoted: msg });
  },
};
