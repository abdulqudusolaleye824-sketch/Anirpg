// Push #96h-z14: /petswap <slot 1> <slot 2> — reorder pets inside your open slots (3, 5 with 💎 Pro).
const PetManager = require('../../rpg/utils/PetManager');
module.exports = {
  name: 'petswap',
  aliases: ['pswap', 'swappet'],
  description: 'Swap two pet slots',
  usage: '/petswap <slot 1> <slot 2>',
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase(); const player = db.users[sender];
    if (!player) return sock.sendMessage(chatId, { text: '❌ Use /register first!' }, { quoted: msg });
    const UI = require('../../rpg/utils/UI'); const pro = UI.isPro(player);
    const r = PetManager.swapPets(sender, args[0], args[1]);
    if (!r.success) return sock.sendMessage(chatId, { text: r.message }, { quoted: msg });
    const bar = pro ? UI.PRO_BAR : UI.FREE_BAR;
    const pets = PetManager.getPlayerPets(sender); const cap = PetManager.slotCap(sender); const active = PetManager.getActivePet(sender);
    const lines = pets.map((p, i) => `${i + 1 > cap ? '🔒' : (active && active.instanceId === p.instanceId ? '▶️' : `${i + 1}.`)} ${p.emoji} *${p.nickname || p.name}* Lv.${p.level}`);
    return sock.sendMessage(chatId, { text: [pro ? `${bar}\n🔁 *PET SLOTS* 💎\n${bar}` : `🔁 *PET SLOTS*\n${bar}`, r.message, '', ...lines, bar, `Open slots: *${cap}* (${PetManager.FREE_SLOTS} per hunter, ${PetManager.PRO_SLOTS} with 💎 Pro)`].join('\n') }, { quoted: msg });
  },
};
