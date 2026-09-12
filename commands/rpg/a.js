// a.js — Quiz answer command (/a A/B/C/D) for the games GC.
// Thin router: the real logic lives in quiz.js handleAnswer.

const quiz = require('./quiz');

module.exports = {
  name: 'a',
  description: '🎌 Answer the running quiz question (games GC)',
  usage: '/a <A/B/C/D>',
  category: 'games',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    if (typeof quiz.handleAnswer !== 'function') {
      return sock.sendMessage(msg.key.remoteJid, { text: `❌ Quiz is unavailable right now.` }, { quoted: msg });
    }
    return quiz.handleAnswer(sock, msg, args, getDatabase, saveDatabase, sender);
  },
};
