// Push #96h-z19: /supplication <word> — choose the word that commands your Shadow Army (Lv.50+).
//   /supplication            → your army card
//   /supplication <word>     → bind your word (once)
const UI = require('../../rpg/utils/UI');
module.exports = {
  name: 'supplication',
  aliases: ['shadowarmy', 'army', 'shadows'],
  description: '👤 Shadow Army — set your supplication word, view your soldiers',
  usage: '/supplication [word]',
  category: 'progression',
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid; const db = getDatabase(); const player = db.users?.[sender];
    if (!player) return sock.sendMessage(chatId, { text: '❌ You are not registered. Use /register first.' }, { quoted: msg });
    const SA = require('../../rpg/utils/ShadowArmy');
    if (args[0]) {
      const r = SA.setWord(player, args[0], db);
      if (!r.ok) return sock.sendMessage(chatId, { text: r.error }, { quoted: msg });
      saveDatabase();
      return sock.sendMessage(chatId, { text: UI.card(player, { icon: '👤', title: 'SUPPLICATION WORD BOUND', lines: [`Your word is */${r.word}*.`, '', `When a monster falls to you, say */${r.word}* (or tap its button) to extract its shadow — ${SA.MAX_TRIES} tries, odds set by the strength gap.`, `Low ranks join your *main infantry*; A/S-rank & bosses become *named soldiers* you can */${r.word} name* and */${r.word} call*.`, `🗃️ Storage: ${SA.capacity(player)} shadows (grows with level & the Shadow Monarch job).`], tip: `/${r.word} army · /${r.word} call all` }) }, { quoted: msg });
    }
    return sock.sendMessage(chatId, { text: UI.card(player, { icon: '👤', title: 'SHADOW ARMY', lines: SA.card(player), tip: player.shadow?.word ? `/${player.shadow.word} call all` : '/supplication <word>' }) }, { quoted: msg });
  },
};
