// ═══════════════════════════════════════════════════════════════
// /mine — Mining on a cleared dungeon floor (Push #97)
//
//   /mine            — swing your best tool (floor must be clear; 3× per floor)
//   /mine info       — your tools, durability, lifetime stats
//   /mine shop       — the mining shop
//   /mine buy <#>    — buy a tool / lantern / repair kit
//   /mine use <#>    — switch the tool you swing with (Push #102g)
// ═══════════════════════════════════════════════════════════════
'use strict';

const Mining = require('../../rpg/utils/Mining');
const Buttons = (() => { try { return require('../../utils/buttons'); } catch (e) { return null; } })();

async function reply(sock, chatId, msg, text, btnPairs, pro) {
  if (pro && Buttons && btnPairs && btnPairs.length) {
    try { return await Buttons.sendButtons(sock, chatId, { text, buttons: Buttons.quickReplies(btnPairs) }, msg); } catch (e) {}
  }
  if (btnPairs && btnPairs.length) text += `\n\n` + btnPairs.map(b => `▫️ ${b[0]} → ${b[1]}`).join('\n');
  return sock.sendMessage(chatId, { text }, { quoted: msg });
}

function findMyGate(sender) {
  let all = {};
  try { all = require('../../rpg/dungeons/GateManager').GateManager.activeGates || {}; } catch (e) {}
  const GKM = require('../../rpg/dungeons/GateKeyManager');
  const sNum = GKM.normaliseJid ? GKM.normaliseJid(sender) : String(sender).split('@')[0].replace(/[^0-9]/g, '');
  for (const g of Object.values(all)) {
    const r = g && g.raid; if (!r || r.status !== 'active') continue;
    const hit = (r.members || []).find(x => x && (x.id === sender || (GKM.normaliseJid ? GKM.normaliseJid(x.id) : String(x.id).split('@')[0].replace(/[^0-9]/g, '')) === sNum));
    if (hit) return { gate: g, memberId: hit.id };
  }
  return null;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

module.exports = {
  name: 'mine',
  aliases: ['mining'],
  description: '⛏️ Mine a cleared dungeon floor for Mana Stones & Essence Stones (tools in /mine shop)',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];
    if (!player) return sock.sendMessage(chatId, { text: '❌ Not registered! Use /register' }, { quoted: msg });
    const UI = require('../../rpg/utils/UI');
    const pro = UI.isPro(player);
    const FRAME = pro ? UI.PRO_BAR : UI.FREE_BAR;
    const sub = String(args[0] || '').toLowerCase();

    if (sub === 'info' || sub === 'tools') return reply(sock, chatId, msg, Mining.infoText(player, FRAME), [['🛒 Shop', '/mine shop'], ['⛏️ Mine', '/mine']], pro);
    if (sub === 'shop' || sub === 'store') return reply(sock, chatId, msg, Mining.shopText(player, FRAME), [['⛏️ Buy Weak Pickaxe', '/mine buy 1'], ['⚒️ Buy Strong Pickaxe', '/mine buy 2'], ['🧰 My tools', '/mine info']], pro);
    if (sub === 'use' || sub === 'switch' || sub === 'equip') { // Push #102g (BUG-056)
      const r = Mining.useTool(player, args.slice(1).join(' '));
      if (!r.ok) return reply(sock, chatId, msg, r.error, [['🧰 My tools', '/mine info']], pro);
      saveDatabase();
      return reply(sock, chatId, msg, [FRAME, `⛏️ *MINING — TOOL SWITCHED*`, FRAME, r.line].join('\n'), [['🧰 My tools', '/mine info'], ['⛏️ Mine', '/mine']], pro);
    }
    if (sub === 'buy') {
      const r = Mining.buy(player, args.slice(1).join(' '));
      if (!r.ok) return sock.sendMessage(chatId, { text: r.error }, { quoted: msg });
      saveDatabase();
      return reply(sock, chatId, msg, [FRAME, `🛒 *MINING SHOP — PURCHASE*`, FRAME, r.line, `💸 Paid: ${Mining.priceLine(r.paid)}`, `💰 Left: 💠 ${(player.gold || 0).toLocaleString()} · 💎 ${(player.manaCrystals || 0).toLocaleString()}`, FRAME].join('\n'), [['🧰 My tools', '/mine info'], ['🛒 Shop', '/mine shop']], pro);
    }
    if (sub && sub !== 'swing' && sub !== 'dig') {
      return reply(sock, chatId, msg, [FRAME, `⛏️ *MINING*`, FRAME, `*/mine* — swing on a cleared floor (3× per floor)`, `*/mine info* — tools & stats`, `*/mine use <#>* — switch tool`, `*/mine shop* · */mine buy <#>*`, FRAME].join('\n'), [['⛏️ Mine', '/mine'], ['🛒 Shop', '/mine shop'], ['🧰 Tools', '/mine info']], pro);
    }

    // ── Swing ────────────────────────────────────────────────────
    const found = findMyGate(sender);
    if (!found) return reply(sock, chatId, msg, `❌ *You are not inside an active dungeon raid.*\nMining happens on a cleared floor, before the party advances.`, [['🧰 My tools', '/mine info'], ['🛒 Shop', '/mine shop']], pro);
    const { gate, memberId } = found;
    const home = gate.raid.chatId || gate.chatId || null;
    if (home && String(home).endsWith('@g.us') && home !== chatId) return sock.sendMessage(chatId, { text: `❌ *Mine in the dungeon GC where your raid is running.*` }, { quoted: msg });
    try { const _lc = require('../../rpg/utils/BotLane').check(gate.raid, { what: 'raid' }); if (_lc && _lc.error) return sock.sendMessage(chatId, { text: _lc.error }, { quoted: msg }); } catch (e) {}
    const can = Mining.canMine(gate, player, memberId);
    if (!can.ok) return reply(sock, chatId, msg, can.error, [['🧰 My tools', '/mine info'], ['🛒 Shop', '/mine shop']], pro);

    gate.mining = gate.mining || {}; gate.mining._busy = gate.mining._busy || {}; gate.mining._busy[memberId] = Date.now();
    gate.floorClearedAt = Date.now();
    const lines = Mining.progressLines(can.def, player.name, can.floor);
    try {
      for (let i = 0; i < lines.length; i++) {
        await sock.sendMessage(chatId, { text: `${lines[i]}  _(${i + 1}/${lines.length})_` });
        await sleep(can.def.roundMs);
      }
    } catch (e) {}
    delete gate.mining._busy[memberId];
    const r = Mining.resolve(gate, player, memberId);
    if (!r.ok) return sock.sendMessage(chatId, { text: r.error }, { quoted: msg });
    try { require('../../rpg/dungeons/GateRaid').saveGateState(db, gate); } catch (e) {}
    saveDatabase();
    const btn = r.left > 0 && !r.broke ? [['⛏️ Mine again', '/mine'], ['➡️ Advance', '/party advance']] : [['➡️ Advance', '/party advance'], ['🛒 Shop', '/mine shop']];
    return reply(sock, chatId, msg, Mining.resultText(player, r, gate), btn, pro);
  },
};
