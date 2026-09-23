// ═══════════════════════════════════════════════════════════════
// /swap <#a> <#b>          — swap two weapons' positions in your weapons bag
// /swap gear <#a> <#b>     — same for the gear bag
// Push #88. Why it matters: ONLY the item in slot #1 of each bag passively
// self-mends (+1 durability / hour, Pro: / 30 min). Put the weapon you want
// repaired in slot #1.
// ═══════════════════════════════════════════════════════════════
'use strict';

const UI = require('../../rpg/utils/UI');

function bagOf(player, kind) {
  const items = (player.inventory && Array.isArray(player.inventory.items)) ? player.inventory.items : [];
  const pred = kind === 'gear' ? (i => i && (i.isGear || i.type === 'gear') && !i.isWeapon) : (i => i && i.isWeapon);
  const idx = [];
  items.forEach((it, i) => { if (pred(it)) idx.push(i); });
  return { items, idx };
}

function renderBag(player, kind) {
  const { items, idx } = bagOf(player, kind);
  if (!idx.length) return kind === 'gear' ? '_No gear in your bag._' : '_No weapons in your bag._';
  return idx.map((ai, n) => {
    const b = items[ai];
    const dur = b.maxDurability != null ? ` 🔧 ${b.durability ?? '?'}/${b.maxDurability}` : '';
    return `  ${n + 1}. ${b.emoji || (kind === 'gear' ? '🛡️' : '🗡️')} *${b.name}*${b.rank ? ` (${b.rank})` : ''}${dur}${n === 0 ? '  ← 🔁 mending' : ''}`;
  }).join('\n');
}

module.exports = {
  name: 'swap',
  aliases: ['reorder', 'bagswap'],
  description: '🔁 Swap two bag slots — /swap <#a> <#b> (weapons) · /swap gear <#a> <#b>. Slot #1 self-mends.',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users?.[sender];
    if (!player) return sock.sendMessage(chatId, { text: '❌ You are not registered! Use /register [name].' }, { quoted: msg });

    let kind = 'weapon';
    let a = args[0], b = args[1];
    if (/^(gear|armor|armour)$/i.test(args[0] || '')) { kind = 'gear'; a = args[1]; b = args[2]; }
    if (/^(weapon|weapons|wpn)$/i.test(args[0] || '')) { kind = 'weapon'; a = args[1]; b = args[2]; }

    const pro = UI.isPro(player);
    const FRAME = pro ? UI.PRO_BAR : UI.FREE_BAR;
    const head = kind === 'gear' ? '🛡️ *GEAR BAG*' : '⚔️ *WEAPONS BAG*';

    if (!/^\d+$/.test(a || '') || !/^\d+$/.test(b || '')) {
      return sock.sendMessage(chatId, { text: [
        `🔁 *SWAP BAG SLOTS*`, FRAME,
        `Only slot *#1* of each bag self-mends (+1 durability / ${pro ? '30 min' : 'hour'}).`,
        ``,
        `${head}`, renderBag(player, kind),
        ``,
        `📌 /swap <#a> <#b> — weapons`,
        `📌 /swap gear <#a> <#b> — gear`,
        `💡 Example: /swap 3 1 → puts weapon #3 into the mending slot`,
      ].join('\n') }, { quoted: msg });
    }

    const { items, idx } = bagOf(player, kind);
    const ia = parseInt(a, 10), ib = parseInt(b, 10);
    if (!idx.length) return sock.sendMessage(chatId, { text: `❌ Your ${kind === 'gear' ? 'gear' : 'weapons'} bag is empty.` }, { quoted: msg });
    if (ia < 1 || ia > idx.length || ib < 1 || ib > idx.length) {
      return sock.sendMessage(chatId, { text: `❌ Pick two slots between 1 and ${idx.length}.\n\n${head}\n${renderBag(player, kind)}` }, { quoted: msg });
    }
    if (ia === ib) return sock.sendMessage(chatId, { text: `🤨 That's the same slot. Nothing to swap.` }, { quoted: msg });

    const ra = idx[ia - 1], rb = idx[ib - 1];
    const tmp = items[ra]; items[ra] = items[rb]; items[rb] = tmp;
    // The mending slot changed → restart its timer window from now so the
    // newly placed item doesn't instantly bank hours accrued by the old one.
    if (ia === 1 || ib === 1) player._durRegenAt = Date.now();
    saveDatabase();

    return sock.sendMessage(chatId, { text: [
      `🔁 *SWAPPED!* #${ia} ⇄ #${ib}`, FRAME,
      `${head}`, renderBag(player, kind),
      ``,
      `🔧 Slot #1 now self-mends: *${items[idx[0]].name}*`,
    ].join('\n') }, { quoted: msg });
  }
};
