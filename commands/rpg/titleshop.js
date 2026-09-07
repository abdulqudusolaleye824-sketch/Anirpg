// ═══════════════════════════════════════════════════════════════
// /titleshop — Buy legendary + mythic titles
// Mythic titles are owner-grant only (use /set --title @user <id>)
// ═══════════════════════════════════════════════════════════════

const { TITLES, RARITIES, getShopPrice, getRarityBadge } = require('../../rpg/utils/TitleSystem');
const Perms = require('../../utils/permissions');

module.exports = {
  name: 'titleshop',
  aliases: ['tshop', 'titles'],
  description: '🛍️ Buy legendary & mythic titles',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];
    if (!player) return sock.sendMessage(chatId, { text: '❌ Register first! /register' }, { quoted: msg });

    const sub = (args[0] || '').toLowerCase();

    // ── /titleshop buy <id> ─────────────────────────────
    if (sub === 'buy') {
      const titleId = args[1];
      if (!titleId) {
        return sock.sendMessage(chatId, {
          text: '❌ Usage: `/titleshop buy <titleId>`\nUse `/titleshop` to see available titles.'
        }, { quoted: msg });
      }
      const def = TITLES[titleId];
      if (!def) return sock.sendMessage(chatId, { text: `❌ Title \`${titleId}\` not found.` }, { quoted: msg });
      if (!def.shop) {
        if (def.grant === 'owner-only') {
          return sock.sendMessage(chatId, {
            text: '🚫 *Mythic titles cannot be bought.*\nThey are granted by Senku or Naruto only.\n\nUse `/set --title @user <titleId>` (owner-only) to request one.'
          }, { quoted: msg });
        }
        return sock.sendMessage(chatId, {
          text: `❌ *${def.display}* is auto-earned by gameplay, not bought.`
        }, { quoted: msg });
      }
      if (!Array.isArray(player.titles)) player.titles = [];
      if (player.titles.includes(titleId)) {
        return sock.sendMessage(chatId, { text: `⚠️ You already own *${def.display}*.` }, { quoted: msg });
      }
      const price = def.shop.price;
      if ((player.gold || 0) < price.gold) {
        return sock.sendMessage(chatId, {
          text: `❌ Not enough gold!\nNeed: ${price.gold.toLocaleString()}g\nHave: ${(player.gold||0).toLocaleString()} 💠`
        }, { quoted: msg });
      }
      if ((player.manaCrystals || 0) < (price.crystals || 0)) {
        return sock.sendMessage(chatId, {
          text: `❌ Not enough Mana Stones!\nNeed: ${price.crystals} 💎\nHave: ${player.manaCrystals || 0} 💎`
        }, { quoted: msg });
      }
      // Charge and grant
      player.gold         -= price.gold;
      player.manaCrystals -= (price.crystals || 0);
      player.titles.push(titleId);
      saveDatabase();
      return sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🛍️ *TITLE PURCHASED!*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n${def.display}\n\n⚡ *Stat Boost:* ${def.boostDesc}\n\n💠 Spent: ${price.gold.toLocaleString()} 💠 + ${price.crystals} 💎\n\nUse \`/title equip ${titleId}\` to equip.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      }, { quoted: msg });
    }

    // ── /titleshop preview <id> ─────────────────────────
    if (sub === 'preview' || sub === 'view') {
      const titleId = args[1];
      if (!titleId) {
        return sock.sendMessage(chatId, { text: '❌ Usage: `/titleshop preview <titleId>`' }, { quoted: msg });
      }
      const def = TITLES[titleId];
      if (!def) return sock.sendMessage(chatId, { text: `❌ Title \`${titleId}\` not found.` }, { quoted: msg });
      const owned = (player.titles || []).includes(titleId);
      const eq    = player.equippedTitle === titleId;
      const price = def.shop ? def.shop.price : null;
      const rarity = getRarityBadge(titleId);
      let txt = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${rarity.code} *${def.display}* ${eq ? '← EQUIPPED' : ''}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      txt += `📜 ${def.desc}\n\n`;
      txt += `${rarity.code} Rarity: *${rarity.label}*\n`;
      txt += `⚡ Stat Boost: ${def.boostDesc}\n`;
      if (owned) txt += `✅ Status: OWNED\n`;
      else if (price) txt += `💠 Price: ${price.gold.toLocaleString()} 💠 + ${price.crystals} 💎\n`;
      else if (def.grant === 'owner-only') txt += `👑 Status: Owner-grant only\n`;
      else txt += `🎮 Status: Auto-earned by gameplay\n`;
      txt += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
      return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
    }

    // ── Default: show shop ───────────────────────────────
    let txt = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🛍️ *TITLE SHOP*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\nYour gold: ${(player.gold||0).toLocaleString()}g\nYour 💎: ${player.manaCrystals || 0}\n\n`;
    // Group by rarity
    const byRarity = {};
    for (const [id, def] of Object.entries(TITLES)) {
      if (!byRarity[def.rarity]) byRarity[def.rarity] = [];
      byRarity[def.rarity].push({ id, ...def });
    }
    const order = ['legendary', 'mythic'];
    for (const rarity of order) {
      const list = byRarity[rarity] || [];
      if (!list.length) continue;
      const badge = RARITIES[rarity];
      txt += `${badge.code} *${badge.label.toUpperCase()} TITLES* ${badge.code}\n`;
      txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      for (const t of list) {
        const owned = (player.titles || []).includes(t.id);
        const eq    = player.equippedTitle === t.id;
        if (t.shop) {
          txt += `${owned ? '✅' : '🛒'} ${t.display}\n`;
          txt += `   _${t.desc}_\n`;
          txt += `   💠 ${t.shop.price.gold.toLocaleString()} 💠 + ${t.shop.price.crystals} 💎\n`;
          txt += `   ⚡ ${t.boostDesc}\n`;
        } else if (t.grant === 'owner-only') {
          txt += `👑 ${t.display}  _[owner-grant]_\n`;
          txt += `   _${t.desc}_\n`;
          txt += `   ⚡ ${t.boostDesc}\n`;
        }
        txt += `\n`;
      }
    }
    txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    txt += `💡 /titleshop buy <id>      — purchase\n`;
    txt += `💡 /titleshop preview <id>  — full details\n`;
    txt += `💡 /title equip <id>        — equip a title\n`;
    txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

    return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
  }
};
