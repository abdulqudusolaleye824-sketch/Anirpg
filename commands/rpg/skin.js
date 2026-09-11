/**
 * /skin — Player skin management command
 *
 * Subcommands:
 *   /skin            — Show equipped skin + quick menu
 *   /skin list       — All owned skins by rarity
 *   /skin equip <id/name> — Equip a skin
 *   /skin view <id/name>  — View any skin's details
 *   /skin shop       — Browse buyable skins (common/uncommon)
 *   /skin shop <rarity>   — Filter shop by rarity
 */

'use strict';

const {
  initSkinData, equipSkin, getEquippedSkin,
  buySkin, formatSkinCard, formatSkinInventory,
} = require('../../rpg/skins/SkinManager');

const {
  SKINS, SKIN_MAP, RARITY_EMOJI, RARITY_LABEL,
  getSkin, getSkinsByRarity,
} = require('../../rpg/skins/SkinCatalog');

const { buildProfileCard, buildGearData } = require('../../rpg/skins/RigRenderer');
const UI = require('../../rpg/utils/UI');

module.exports = {
  name: 'skin',
  description: '🎭 Player skin system',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db     = getDatabase();
    const player = db.users[sender];

    if (!player) {
      return sock.sendMessage(chatId, { text: '❌ Register first! */register*' }, { quoted: msg });
    }

    initSkinData(player);
    const sub = args[0]?.toLowerCase();

    // ── /skin (no args) — show equipped skin ───────────────────────────────────
    if (!sub) {
      const skin     = getEquippedSkin(player);
      const owned    = player.skins.owned.length;
      const equipped = player.skins.equipped;

      const proS = UI.isPro(player);
      const text = [
        (proS ? UI.PRO_BAR : UI.FREE_BAR),
        '🎭 *YOUR SKIN*',
        `🗂️ Collection: *${owned}* skins owned`,
        proS ? (UI.PRO_MINI + '\n' + '🎭 PRO WARDROBE') : null,
        proS ? `🎰 Total summons: *${player.skins.totalPulls || 0}* · toward pity: *${player.skins.pulls || 0}*` : null,
        ``,
        formatSkinCard(skin, true, true),
        ``,
        `*COMMANDS*`,
        `/skin list · equip <id> · view <id> · shop`,
        `/summon — Pull new skins`,
        (proS ? UI.PRO_BAR : UI.FREE_BAR),
      ].filter(x => x !== null).join('\n');

      // Try to render profile card with skin
      try {
        const gearData = buildGearData(player);
        const cardBuf  = await buildProfileCard(player, skin, gearData);
        await sock.sendMessage(chatId, { image: cardBuf, caption: text }, { quoted: msg });
      } catch (e) {
        await sock.sendMessage(chatId, { text }, { quoted: msg });
      }
      return;
    }

    // ── /skin list ─────────────────────────────────────────────────────────────
    if (sub === 'list' || sub === 'collection' || sub === 'inv') {
      const inventory = formatSkinInventory(player);
      return sock.sendMessage(chatId, {
        text: [
          (UI.isPro(player) ? UI.PRO_BAR : UI.FREE_BAR),
          '🗂️ *SKIN COLLECTION*',
          UI.isPro(player) ? `🗂️ *${player.skins.owned.length}* owned / *${Object.keys(SKIN_MAP).length}* total skins` : null,
          UI.isPro(player) ? '' : null,
          inventory,
          (UI.isPro(player) ? UI.PRO_BAR : UI.FREE_BAR),
        ].filter(x => x !== null).join('\n'),
      }, { quoted: msg });
    }

    // ── /skin equip <id or name> ───────────────────────────────────────────────
    if (sub === 'equip' || sub === 'wear' || sub === 'set') {
      const query = args.slice(1).join(' ').toLowerCase().trim();
      if (!query) {
        return sock.sendMessage(chatId, {
          text: '❌ Specify a skin to equip.\nExample: */skin equip shadow_monarch*\nUse */skin list* to see your skins.',
        }, { quoted: msg });
      }

      // Resolve by id or name
      const skinId = resolveSkinId(query, player.skins.owned);
      if (!skinId) {
        return sock.sendMessage(chatId, {
          text: `❌ Skin *"${query}"* not found in your collection.\nUse */skin list* to see what you own.`,
        }, { quoted: msg });
      }

      const result = equipSkin(player, skinId);
      if (!result.success) {
        return sock.sendMessage(chatId, { text: result.error }, { quoted: msg });
      }

      saveDatabase(db);

      const skin = result.skin;
      const emoji = RARITY_EMOJI[skin.rarity];

      // Try to render card
      try {
        const gearData = buildGearData(player);
        const skinData = { ...skin, assetPath: `skins/${skin.rarity}/${skin.id}.png` };
        const cardBuf  = await buildProfileCard(player, skinData, gearData);
        await sock.sendMessage(chatId, {
          image: cardBuf,
          caption: `✅ Equipped *${skin.name}* ${emoji}\n🎌 ${skin.theme} · ${RARITY_LABEL[skin.rarity]}${UI.isPro(player) ? `\n⚔️ Archetype: *${skin.archetype}*` : ''}`,
        }, { quoted: msg });
      } catch (e) {
        await sock.sendMessage(chatId, {
          text: `✅ Equipped *${skin.name}* ${emoji}\n🎌 ${skin.theme} · ${RARITY_LABEL[skin.rarity]}${UI.isPro(player) ? `\n⚔️ Archetype: *${skin.archetype}*` : ''}`,
        }, { quoted: msg });
      }
      return;
    }

    // ── /skin view <id or name> ────────────────────────────────────────────────
    if (sub === 'view' || sub === 'info' || sub === 'check') {
      const query = args.slice(1).join(' ').toLowerCase().trim();
      if (!query) {
        return sock.sendMessage(chatId, { text: '❌ Specify a skin to view.\nExample: */skin view shadow_monarch*' }, { quoted: msg });
      }

      const skinId = resolveAnySkinId(query);
      if (!skinId) {
        return sock.sendMessage(chatId, { text: `❌ No skin found matching *"${query}"*.` }, { quoted: msg });
      }

      const skin   = getSkin(skinId);
      const owned  = player.skins.owned.includes(skinId);
      const equip  = player.skins.equipped === skinId;

      return sock.sendMessage(chatId, {
        text: [
          (UI.isPro(player) ? UI.PRO_BAR : UI.FREE_BAR),
          '🎭 *SKIN DETAILS*',
          UI.isPro(player) ? `🔮 Shop price: *${skin.cost?.manaStones ? skin.cost.manaStones + ' Mana Stones' : 'not in shop'}*` : null,
          UI.isPro(player) ? '' : null,
          formatSkinCard(skin, owned, equip),
          ``,
          owned
            ? equip ? `✅ Currently equipped` : `✅ Owned — */skin equip ${skin.id}* to wear`
            : skin.source === 'shop'
              ? `🏪 Available in shop — */skin buy ${skin.id}*`
              : skin.source === 'gacha'
                ? `🎰 Obtainable via */summon*`
                : `🏆 Achievement unlock only`,
          (UI.isPro(player) ? UI.PRO_BAR : UI.FREE_BAR),
        ].join('\n'),
      }, { quoted: msg });
    }

    // ── /skin buy <id or name> ─────────────────────────────────────────────────
    if (sub === 'buy' || sub === 'purchase') {
      const query = args.slice(1).join(' ').toLowerCase().trim();
      if (!query) {
        return sock.sendMessage(chatId, { text: '❌ Specify a skin to buy.\nExample: */skin buy village_boy*\nUse */skin shop* to browse.' }, { quoted: msg });
      }

      const skinId = resolveAnySkinId(query);
      if (!skinId) {
        return sock.sendMessage(chatId, { text: `❌ No skin found matching *"${query}"*.` }, { quoted: msg });
      }

      const result = buySkin(player, skinId);
      if (!result.success) {
        return sock.sendMessage(chatId, { text: result.error }, { quoted: msg });
      }

      saveDatabase(db);

      const emoji = RARITY_EMOJI[result.skin.rarity];
      return sock.sendMessage(chatId, {
        text: [
          (UI.isPro(player) ? UI.PRO_BAR : UI.FREE_BAR),
          `✅ *Purchased!*`,
          ``,
          `${emoji} *${result.skin.name}*`,
          `${RARITY_LABEL[result.skin.rarity]} · ${result.skin.theme}`,
          `🔮 Spent: *${result.cost}* Mana Stones`,
          `🔮 Remaining: *${player.manaStones}*`,
          ``,
          `Use */skin equip ${result.skin.id}* to wear it!`,
          (UI.isPro(player) ? UI.PRO_BAR : UI.FREE_BAR),
        ].join('\n'),
      }, { quoted: msg });
    }

    // ── /skin shop [rarity] ────────────────────────────────────────────────────
    if (sub === 'shop' || sub === 'store') {
      const rarityFilter = args[1]?.toLowerCase();
      const validRarities = ['common','uncommon','rare','epic','legendary'];
      const filter = validRarities.includes(rarityFilter) ? rarityFilter : null;

      const shopSkins = SKINS.filter(s =>
        s.source === 'shop' &&
        (!filter || s.rarity === filter) &&
        s.cost?.manaStones > 0
      );

      if (shopSkins.length === 0) {
        return sock.sendMessage(chatId, { text: `❌ No shop skins found for rarity: *${rarityFilter}*` }, { quoted: msg });
      }

      const shopPro = UI.isPro(player);
      const lines = [
        (shopPro ? UI.PRO_BAR : UI.FREE_BAR),
        '🏪 *SKIN SHOP*',
        filter ? `Showing: ${RARITY_LABEL[filter]} skins` : 'All rarities',
        shopPro ? `🔮 Your Mana Stones: *${player.manaStones || 0}*` : null,
        ``,
      ].filter(x => x !== null);

      const grouped = {};
      for (const s of shopSkins) {
        if (!grouped[s.rarity]) grouped[s.rarity] = [];
        grouped[s.rarity].push(s);
      }

      for (const [rarity, skins] of Object.entries(grouped)) {
        lines.push(`${RARITY_EMOJI[rarity]} *${RARITY_LABEL[rarity]}*`);
        for (const s of skins) {
          const owned = player.skins.owned.includes(s.id);
          lines.push(`  ${owned ? '✅' : '  '} ${s.name} — *${s.cost.manaStones}* 🔮  \`${s.id}\``);
        }
        lines.push('');
      }

      lines.push(`💡 */skin buy <id>* to purchase`);
      lines.push(`💡 */skin view <id>* to preview`);
      lines.push(`🎰 */summon* for rare/epic/legendary/mythic skins`);
      lines.push((shopPro ? UI.PRO_BAR : UI.FREE_BAR));

      return sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: msg });
    }

    // ── Unknown subcommand ─────────────────────────────────────────────────────
    return sock.sendMessage(chatId, {
      text: [
        (UI.isPro(player) ? UI.PRO_BAR : UI.FREE_BAR),
        '🎭 *SKIN COMMANDS*',
        `/skin            — Your equipped skin`,
        `/skin list       — All owned skins`,
        `/skin equip <id> — Equip a skin`,
        `/skin view <id>  — Preview any skin`,
        `/skin buy <id>   — Buy from shop`,
        `/skin shop       — Browse shop`,
        `/summon          — Pull new skins`,
        (UI.isPro(player) ? UI.PRO_BAR : UI.FREE_BAR),
      ].join('\n'),
    }, { quoted: msg });
  },
};

// ── Resolve skin ID from a query string ───────────────────────────────────────

function resolveSkinId(query, ownedIds = []) {
  const q = query.toLowerCase().trim();
  // Direct ID match
  if (SKIN_MAP[q] && ownedIds.includes(q)) return q;
  // Name match in owned
  for (const id of ownedIds) {
    const s = SKIN_MAP[id];
    if (s && s.name.toLowerCase() === q) return id;
    if (s && s.name.toLowerCase().includes(q)) return id;
  }
  return null;
}

function resolveAnySkinId(query) {
  const q = query.toLowerCase().trim();
  if (SKIN_MAP[q]) return q;
  for (const skin of Object.values(SKIN_MAP)) {
    if (skin.name.toLowerCase() === q) return skin.id;
    if (skin.name.toLowerCase().includes(q)) return skin.id;
  }
  return null;
}
