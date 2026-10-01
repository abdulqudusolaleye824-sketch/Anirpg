/**
 * /xp (alias !xp) — Push #96h-m: Current XP · Total XP · XP to next level.
 */
'use strict';
const UI = require('../../rpg/utils/UI');
const LevelUpManager = require('../../rpg/utils/LevelUpManager');
const { getXpRequired } = require('../../rpg/utils/SoloLevelingCore');

function bare(jid) { return String(jid).split(':')[0].split('@')[0]; }
// Lifetime XP = everything spent climbing to the current level + what sits in the bar now.
function totalXp(player) {
  let t = 0; for (let l = 1; l < (player.level || 1); l++) t += getXpRequired(l) || 0;
  return Math.max(t + (player.xp || 0), player.lifetimeXp || 0);
}
function bar(pct) { const n = Math.max(0, Math.min(10, Math.round(pct / 10))); return '█'.repeat(n) + '░'.repeat(10 - n); }

module.exports = {
  name: 'xp', aliases: ['exp', 'experience'],
  description: '✨ Your XP: current, total and XP needed for the next level',
  usage: '/xp', category: 'progress', totalXp,
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid; const db = getDatabase();
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.participant;
    const target = mentioned || quoted || sender;
    const player = db.users?.[target] || db.users?.[bare(target)] || db.users?.[sender] || db.users?.[bare(sender)];
    if (!player) return sock.sendMessage(chatId, { text: '❌ You are not registered. Use /register first.' }, { quoted: msg });
    try { LevelUpManager.checkAndApplyLevelUps(player, saveDatabase, sock, chatId); } catch (e) {}
    const prog = LevelUpManager.getXPProgress(player);
    const need = Math.max(0, (prog.needed || 0) - (prog.current || 0));
    const F = UI.isPro && UI.isPro(player) ? UI.PRO_BAR : UI.FREE_BAR;
    const text = [F, `✨ *XP — ${player.name || bare(target)}*`, ``,
      `🎚️ Level: *${player.level || 1}*`,
      `📈 Current XP: *${(prog.current || 0).toLocaleString()}* / ${(prog.needed || 0).toLocaleString()}`,
      `${bar(prog.percent || 0)} ${prog.percent || 0}%`,
      `🧮 Total XP: *${totalXp(player).toLocaleString()}*`,
      `⏭️ XP for next level: *${need.toLocaleString()}* more`,
      ``, `💡 Clear gate floors — higher floors & ranks pay more XP.`, F].join('\n');
    return sock.sendMessage(chatId, { text, mentions: [target] }, { quoted: msg });
  },
};
