// Push #97: /kill <bot> — owner-only. Parks a bot's LANE: the killed bot ignores EVERYTHING (owner included,
// battle flows, timers, sends) until the owner runs /reset <bot> from ANOTHER bot, or the service restarts.
'use strict';
const Perms = require('../../utils/permissions');
const BotLane = require('../../rpg/utils/BotLane');

module.exports = {
  name: 'kill', aliases: ['killbot'],
  description: '👑 [owner] Park a bot — it ignores everything until /reset <bot> from another bot',
  category: 'admin', usage: '/kill <bot name>', where: 'DM or group (owner)',
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid; const db = getDatabase();
    if (!Perms.isBotOwner(db, sender)) return sock.sendMessage(chatId, { text: '❌ Owner-only command.' }, { quoted: msg });
    const q = (args || []).join(' ').trim();
    if (!q) {
      const dead = BotLane.killedList();
      return sock.sendMessage(chatId, { text: [`☠️ *KILL A BOT*`, `Usage: */kill <bot name>*`, `The bot stops reading and sending anything until */reset <bot name>* is typed to a DIFFERENT bot (or the service restarts).`, ``, dead.length ? `Currently killed: ${dead.map(d => BotLane.displayName(d.key)).join(', ')}` : `No bot is killed right now.`].join('\n') }, { quoted: msg });
    }
    const key = BotLane.resolveBotKey(q);
    if (!key) return sock.sendMessage(chatId, { text: `❌ No bot called *${q}*.` }, { quoted: msg });
    const name = BotLane.displayName(key);
    if (BotLane.isKilled(key)) return sock.sendMessage(chatId, { text: `☠️ *${name}* is already killed. Revive with */reset ${name}* from another bot.` }, { quoted: msg });
    let me = null; try { me = BotLane.current(); } catch (e) {}
    const self = me && me === key;
    // Answer FIRST (a killed bot cannot speak), then park the lane.
    await sock.sendMessage(chatId, { text: [`☠️ *${name} KILLED*`, `${name} now ignores every message and command — yours included — and sends nothing.`, `Revive: */reset ${name}* sent to a *different* bot${self ? ' (this bot can no longer answer you)' : ''}, or restart the service.`].join('\n') }, { quoted: msg });
    BotLane.kill(key, sender);
    return null;
  },
};
