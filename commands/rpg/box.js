// ═══════════════════════════════════════════════════════════════
// /box blessed|cursed — Push #95: Pro daily boxes (offered after all 4 daily quests)
// ═══════════════════════════════════════════════════════════════
const UI = require('../../rpg/utils/UI');
const ID = require('../../rpg/utils/InstanceDungeon');

module.exports = {
  name: 'box',
  aliases: ['dailybox'],
  description: '🎁 Your boxes — /box · /box open <#> · /box blessed · /box cursed (Pro)',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key?.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];
    if (!player) return sock.sendMessage(chatId, { text: '❌ Register first! Use /register' }, { quoted: msg });
    const pro = UI.isPro(player);
    const FRAME = pro ? UI.PRO_BAR : UI.FREE_BAR;
    const kind = String(args[0] || '').toLowerCase();
    const Buttons = (() => { try { return require('../../utils/buttons'); } catch (e) { return null; } })();
    const reg = Number(player.regularBoxes) || 0;
    const proBoxes = Number(player.pendingBoxes) || 0;
    const canPro = pro || (Number(player.freeBoxes) > 0);
    // Push #96h-z21: owned-box list. Slot 1 = 📦 Regular Box · Slot 2 = 🎁 Pro Daily Box (Blessed / Cursed).
    const owned = [];
    if (reg) owned.push({ n: 1, kind: 'regular', label: `📦 Regular Box ×${reg}`, hint: 'rare-or-below item or an Instance Key' });
    if (proBoxes && canPro) owned.push({ n: 2, kind: 'pro', label: `🎁 Pro Daily Box ×${proBoxes}`, hint: 'choose ✨ Blessed or 🖤 Cursed' });
    const sendBtn = async (text, pairs) => { try { if (Buttons) return await Buttons.sendButtons(sock, chatId, { text, buttons: Buttons.quickReplies(pairs) }, msg); } catch (e) {} return sock.sendMessage(chatId, { text: `${text}\n${pairs.map(([l, c]) => `${l} → ${c}`).join('\n')}` }, { quoted: msg }); };

    if (!kind || kind === 'list') {
      if (!owned.length) return sock.sendMessage(chatId, { text: [FRAME, `🎁 *YOUR BOXES*`, FRAME, `_No boxes right now._`, `Finish all 4 daily quests → a 📦 Regular Box${pro ? ' · as Pro you choose ✨ Blessed / 🖤 Cursed instead' : ''}.`, FRAME].join('\n') }, { quoted: msg });
      const text = [FRAME, `🎁 *YOUR BOXES*`, FRAME, ...owned.map(o => `*${o.n}.* ${o.label} — _${o.hint}_`), ``, `📌 /box open <#>`, FRAME].join('\n');
      return sendBtn(text, owned.map(o => [o.label.slice(0, 20), `/box open ${o.n}`]));
    }

    if (kind === 'open' || kind === 'regular') {
      let n = parseInt(args[1], 10); const confirm = args.some(a => /^confirm$/i.test(String(a)));
      if (!n) { if (kind === 'regular') n = 1; else if (owned.length === 1) n = owned[0].n; else if (!owned.length) return sock.sendMessage(chatId, { text: `❌ No box waiting — finish all 4 daily quests.` }, { quoted: msg }); else return sock.sendMessage(chatId, { text: `📌 Which one? /box open 1 (📦 Regular) · /box open 2 (🎁 Pro)` }, { quoted: msg }); }
      if (n === 2) {
        if (!proBoxes || !canPro) return sock.sendMessage(chatId, { text: `❌ No Pro box waiting.` }, { quoted: msg });
        return sendBtn(`🎁 *PRO DAILY BOX* — ${proBoxes} waiting. Choose your fate:`, [['✨ Blessed (random)', '/box blessed'], ['🖤 Cursed', '/box cursed']]);
      }
      if (n !== 1) return sock.sendMessage(chatId, { text: `❌ No box #${n}. See /box` }, { quoted: msg });
      if (!reg) return sock.sendMessage(chatId, { text: `❌ No regular box waiting — finish all 4 daily quests.` }, { quoted: msg });
      if (!confirm) return sendBtn(`📦 *REGULAR BOX* — ${reg} waiting. Inside: one rare-or-below item, or an Instance Key.`, [['📦 Open it', '/box open 1 confirm']]);
      const r = ID.openRegularBox(player);
      if (!r.ok) return sock.sendMessage(chatId, { text: `❌ ${r.error}` }, { quoted: msg });
      saveDatabase();
      const left = Number(player.regularBoxes) || 0;
      return sock.sendMessage(chatId, { text: [FRAME, r.title, FRAME, ...r.lines, left ? `📦 ${left} more waiting — /box open 1 confirm` : null, FRAME].filter(Boolean).join('\n') }, { quoted: msg });
    }
    if (kind !== 'blessed' && kind !== 'cursed') return sock.sendMessage(chatId, { text: `📌 /box · /box open <#> · /box blessed · /box cursed` }, { quoted: msg });
    const r = ID.openBox(player, kind);
    if (!r.ok) return sock.sendMessage(chatId, { text: `❌ ${r.error}` }, { quoted: msg });
    saveDatabase();
    const left = Number(player.pendingBoxes) || 0;
    return sock.sendMessage(chatId, { text: [FRAME, `${r.title} 💎`, FRAME, ...r.lines, left ? `🎁 ${left} more waiting — /box` : null, FRAME].filter(Boolean).join('\n') }, { quoted: msg });
  },
};
