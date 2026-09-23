// ═══════════════════════════════════════════════════════════════
// /mend <inv#>  — Push #85
// Spend ONE Mending Stone to restore ONE weapon / gear piece to 100%
// durability, picked by its /inv number (equipped items are listed too).
//   /mend            → show what can be mended + stones owned
//   /mend 4          → mend /inv entry 4
//   /mend all        → ONE stone shared evenly across all damaged items (Push #88c)
// ═══════════════════════════════════════════════════════════════

const UI = require('../../rpg/utils/UI');

function takeStone(player) {
  const inv = player.inventory || (player.inventory = {});
  const items = inv.items || [];
  const mi = items.findIndex(i => i && (i.isMendingStone || /mending/i.test(String(i.name || ''))));
  if (mi !== -1) { items.splice(mi, 1); return true; }
  if ((inv.mendingStones || 0) > 0) { inv.mendingStones--; return true; }
  return false;
}
function countStones(player) {
  const inv = player.inventory || {};
  const items = inv.items || [];
  return items.filter(i => i && (i.isMendingStone || /mending/i.test(String(i.name || '')))).length + (inv.mendingStones || 0);
}

module.exports = {
  name: 'mend',
  aliases: ['repair'],
  description: 'Use a Mending Stone on one item: /mend <inv#>',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];
    if (!player) return sock.sendMessage(chatId, { text: '❌ Not registered! Use /start first.' }, { quoted: msg });

    try { require('../../rpg/utils/RewardInventory').repairGearSlots(player); } catch (e) {}
    try { require('../../rpg/utils/RewardInventory').migrateLegacy(player); } catch (e) {}

    let serials = [];
    try { serials = require('./inventory')._serialList(player); } catch (e) { serials = []; }
    const stones = countStones(player);
    const arg = String(args[0] || '').trim().toLowerCase();

    // ── list mode ──
    if (!arg) {
      const mendable = serials
        .map((e, i) => ({ e, n: i + 1 }))
        .filter(({ e }) => (e.kind === 'gear' || e.kind === 'weapon') && e.ref && e.ref.maxDurability != null);
      let t = `🛠️ *MENDING*\n${UI.FREE_BAR}\n🪨 Mending Stones: *${stones}*\n\n`;
      if (!mendable.length) t += '_No weapons or gear to mend._\n';
      else {
        t += '*Your items* (🔧 durability):\n';
        for (const { e, n } of mendable) {
          const d = e.ref.durability ?? 0, m = e.ref.maxDurability;
          const flag = d <= 0 ? ' 💥' : d < m * 0.25 ? ' ⚠️' : d >= m ? ' ✨' : '';
          t += `  *${n}.* ${e.name}${e.equipped ? ' ✅' : ''} 🔧${d}/${m}${flag}\n`;
        }
      }
      t += `\n💡 /mend <number> — 1 stone restores that item to 100%\n💡 /mend all — 1 stone SHARED across all damaged items (10 items → +10% each)`;
      return sock.sendMessage(chatId, { text: t }, { quoted: msg });
    }

    if (stones <= 0) {
      return sock.sendMessage(chatId, { text: '❌ You have no Mending Stones.\n\n💡 Get them from /store, /pro daily, gate raids and season rewards.' }, { quoted: msg });
    }

    // ── mend all ──
    if (arg === 'all') {
      // Push #88c: ONE stone is SHARED — 100% split evenly across every damaged item.
      let r = { count: 0, items: [] }; try { r = require('../../rpg/utils/ArmoryStore').mendAllShared(player); } catch (e) {}
      if (r.count === 0) return sock.sendMessage(chatId, { text: '✨ Everything is already at full durability — stone kept.' }, { quoted: msg });
      takeStone(player);
      saveDatabase();
      const rows = r.items.slice(0, 12).map(it => `  • ${it.name}: ${it.before}/${it.max} → *${it.after}/${it.max}*`);
      if (r.items.length > 12) rows.push(`  …and ${r.items.length - 12} more`);
      return sock.sendMessage(chatId, { text: `🛠️ *Mending Stone shared!*\n\n1 stone ÷ ${r.count} item${r.count === 1 ? '' : 's'} = *+${r.sharePct}%* durability each\n${rows.join('\n')}\n\n🪨 Stones left: *${stones - 1}*\n💡 /mend <number> — 1 stone = one item to 100%` }, { quoted: msg });
    }

    // ── mend one ──
    if (!/^\d+$/.test(arg)) {
      return sock.sendMessage(chatId, { text: '❌ Usage: /mend <inv#>  (or /mend all)\n\nSee /inv for numbers.' }, { quoted: msg });
    }
    const n = parseInt(arg, 10);
    const entry = serials[n - 1];
    if (!entry) return sock.sendMessage(chatId, { text: `❌ No /inv entry #${n}. You have ${serials.length} entries.` }, { quoted: msg });
    if ((entry.kind !== 'gear' && entry.kind !== 'weapon') || !entry.ref) {
      return sock.sendMessage(chatId, { text: `❌ *${entry.name}* isn't a weapon or gear piece — only those can be mended.` }, { quoted: msg });
    }
    const item = entry.ref;
    if (item.maxDurability == null) {
      return sock.sendMessage(chatId, { text: `❌ *${entry.name}* doesn't wear out — nothing to mend.` }, { quoted: msg });
    }
    const before = item.durability ?? 0;
    if (before >= item.maxDurability) {
      return sock.sendMessage(chatId, { text: `✨ *${entry.name}* is already at *${item.maxDurability}/${item.maxDurability}* — stone kept.` }, { quoted: msg });
    }
    takeStone(player);
    item.durability = item.maxDurability;
    saveDatabase();
    return sock.sendMessage(chatId, {
      text: `🛠️ *Mended!*\n\n${item.emoji || (entry.kind === 'weapon' ? '🗡️' : '🛡️')} *${entry.name}*${entry.equipped ? ' ✅' : ''}\n🔧 ${before}/${item.maxDurability} → *${item.maxDurability}/${item.maxDurability}*\n🪨 Stones left: *${stones - 1}*`
    }, { quoted: msg });
  }
};
