// ═══════════════════════════════════════════════════════════════
// /box blessed|cursed — Push #95: Pro daily boxes (offered after all 4 daily quests)
// ═══════════════════════════════════════════════════════════════
const UI = require('../../rpg/utils/UI');
const ID = require('../../rpg/utils/InstanceDungeon');

module.exports = {
  name: 'box',
  aliases: ['dailybox'],
  description: '🎁 Daily boxes — /box open (regular) · /box blessed · /box cursed (Pro)',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key?.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];
    if (!player) return sock.sendMessage(chatId, { text: '❌ Register first! Use /register' }, { quoted: msg });
    const pro = UI.isPro(player);
    const FRAME = pro ? UI.PRO_BAR : UI.FREE_BAR;
    const kind = String(args[0] || '').toLowerCase();
    const reg = Number(player.regularBoxes) || 0;
    // Push #96h-z20: 📦 Regular Box — every hunter's daily box (/box open).
    if (kind === 'open' || kind === 'regular') {
      const r = ID.openRegularBox(player);
      if (!r.ok) return sock.sendMessage(chatId, { text: `❌ ${r.error}` }, { quoted: msg });
      saveDatabase();
      const left = Number(player.regularBoxes) || 0;
      return sock.sendMessage(chatId, { text: [FRAME, r.title, FRAME, ...r.lines, left ? `📦 ${left} more waiting — /box open` : null, FRAME].filter(Boolean).join('\n') }, { quoted: msg });
    }
    if (!kind) {
      const n = Number(player.pendingBoxes) || 0;
      if (!pro && !(Number(player.freeBoxes) > 0)) {
        if (reg) { try { const Buttons = require('../../utils/buttons'); return await Buttons.sendButtons(sock, chatId, { text: `📦 *${reg} regular box${reg === 1 ? '' : 'es'} waiting* — rare-or-below item or an Instance Key.`, buttons: Buttons.quickReplies([['📦 Open box', '/box open']]) }, msg); } catch (e) { return sock.sendMessage(chatId, { text: `📦 ${reg} waiting — /box open` }, { quoted: msg }); } }
        return sock.sendMessage(chatId, { text: [FRAME, `📦 *DAILY BOXES*`, FRAME, `Finish all 4 daily quests → a 📦 Regular Box (/box open).`, `Pro hunters 💎 choose a ✨ Blessed or 🖤 Cursed box instead.`, UI.upsell()].join('\n') }, { quoted: msg });
      }
      if (!n && reg) { try { const Buttons = require('../../utils/buttons'); return await Buttons.sendButtons(sock, chatId, { text: `📦 *${reg} regular box${reg === 1 ? '' : 'es'} waiting*`, buttons: Buttons.quickReplies([['📦 Open box', '/box open']]) }, msg); } catch (e) { return sock.sendMessage(chatId, { text: `📦 ${reg} waiting — /box open` }, { quoted: msg }); } }
      if (!n) return sock.sendMessage(chatId, { text: `🎁 No box waiting — finish all 4 daily quests.` }, { quoted: msg });
      try { const Buttons = require('../../utils/buttons'); return await Buttons.sendButtons(sock, chatId, { text: `🎁 *${n} box${n === 1 ? '' : 'es'} waiting* — choose:`, buttons: Buttons.quickReplies([['✨ Blessed box', '/box blessed'], ['🖤 Cursed box', '/box cursed']]) }, msg); } catch (e) { return sock.sendMessage(chatId, { text: `🎁 ${n} waiting — /box blessed or /box cursed` }, { quoted: msg }); }
    }
    const r = ID.openBox(player, kind);
    if (!r.ok) return sock.sendMessage(chatId, { text: `❌ ${r.error}` }, { quoted: msg });
    saveDatabase();
    const left = Number(player.pendingBoxes) || 0;
    return sock.sendMessage(chatId, { text: [FRAME, `${r.title} 💎`, FRAME, ...r.lines, left ? `🎁 ${left} more waiting — /box` : null, FRAME].filter(Boolean).join('\n') }, { quoted: msg });
  },
};
