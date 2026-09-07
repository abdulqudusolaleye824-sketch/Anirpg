// ═══════════════════════════════════════════════════════════════
// /craft — Craft items using materials + recipe key
//
// Usage:
//   /craft <item name> --<KEY>
//   /craft Shadow Fang Blade --G3VWU2
//
// Rules:
//   - Must have all required materials
//   - Must provide valid 6-char craft key
//   - Key is global — anyone with it can craft
//   - First to craft consumes the key and original scroll
// ═══════════════════════════════════════════════════════════════

const { attemptCraft } = require('../../rpg/utils/CraftingSystem');
const { sendImageCard } = require('../../utils/imageCard');

module.exports = {
  name: 'craft',
  description: '⚒️ Craft an item using materials and a recipe key',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key?.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];

    if (!player) return sock.sendMessage(chatId, { text: '❌ Register first! Use /register' }, { quoted: msg });

    const fullInput = args.join(' ');

    // Parse item name and key — format: <item name> --<KEY>
    const keyMatch = fullInput.match(/--([A-Z0-9]{6})$/i);
    if (!keyMatch) {
      return sock.sendMessage(chatId, {
        text: [
          `❌ *Invalid format.*`,
          ``,
          `Usage: */craft <item name> --<KEY>*`,
          `Example: */craft Shadow Fang Blade --G3VWU2*`,
          ``,
          `📖 Read your scroll in DMs to get the key.`,
        ].join('\n')
      }, { quoted: msg });
    }

    const key = keyMatch[1].toUpperCase();
    const itemName = fullInput.replace(/--[A-Z0-9]{6}$/i, '').trim();

    if (!itemName) {
      return sock.sendMessage(chatId, {
        text: '❌ Please provide an item name.\nExample: */craft Iron Sword --G3VWU2*'
      }, { quoted: msg });
    }

    // Attempt craft
    const result = attemptCraft(player, itemName, key, db);

    if (!result.success) {
      return sock.sendMessage(chatId, { text: result.reason }, { quoted: msg });
    }

    const item = result.item;
    saveDatabase();

    // Notify original owner if someone else used their key
    const stolenKey = result.scrollOwnerJid && result.scrollOwnerJid !== sender;
    if (stolenKey) {
      try {
        await sock.sendMessage(result.scrollOwnerJid, {
          text: [
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            `🔑 *YOUR SCROLL KEY WAS USED*`,
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            ``,
            `Someone used your craft key *${key}*`,
            `and crafted *${item.name}*.`,
            ``,
            `Your scroll has been consumed.`,
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          ].join('\n')
        });
      } catch (e) {}
    }

    // ── Two-message card: artwork (if available) + stats/lore ──
    const statKeys = ['atk', 'bonus', 'def', 'hp', 'speed', 'critChance', 'lifesteal', 'magicPower', 'energy'];
    const statObj = {};
    for (const k of statKeys) if (item[k]) statObj[k] = item[k];

    return sendImageCard(sock, chatId, {
      kind: 'item',
      name: item.name,
      rarity: (item.rarity || 'common').toLowerCase(),
      stats: statObj,
      extra: {
        type: item.type,
        subtype: item.subtype,
        durability: item.durability ? `${item.durability}/${item.maxDurability}` : null,
        infusions: item.infusions,
        craftedBy: item.craftedBy,
        stolen: stolenKey,
      },
    }, { quoted: msg });
  }
};
