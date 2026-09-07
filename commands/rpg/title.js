// /title — View, equip, and manage titles
// Uses TitleSystem v2 (rarity-tiered, color-coded)

const { TITLES, RARITIES, getRarityBadge, checkAndAwardTitles, getTitleDisplay } = require('../../rpg/utils/TitleSystem');

module.exports = {
  name: 'title',
  aliases: ['titles'],
  description: '🎖️ View and equip your earned titles (each gives a stat boost)',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];
    if (!player) return sock.sendMessage(chatId, { text: '❌ Not registered! Use /register first.' }, { quoted: msg });

    const sub = (args[0] || '').toLowerCase();

    // Auto-award any newly earned titles
    const newTitles = checkAndAwardTitles(player);
    if (newTitles.length) saveDatabase();

    const owned = player.titles || [];
    const equipped = player.equippedTitle;

    // ── /title equip [name] ──────────────────────────────
    if (sub === 'equip' || sub === 'use' || sub === 'set') {
      if (!args[1]) {
        return sock.sendMessage(chatId, {
          text: '❌ Specify a title to equip!\n/title equip [title name]\n\nUse /title to see your titles.'
        }, { quoted: msg });
      }
      const query = args.slice(1).join(' ');
      // Match by partial name (case-insensitive)
      const match = Object.keys(TITLES).find(id =>
        owned.includes(id) &&
        (id.toLowerCase().includes(query.toLowerCase()) ||
         TITLES[id].display.toLowerCase().includes(query.toLowerCase()))
      );
      if (!match) {
        return sock.sendMessage(chatId, {
          text: `❌ Title *"${query}"* not found or not yet earned!\n\nUse /title to see your titles.`
        }, { quoted: msg });
      }
      player.equippedTitle = match;
      saveDatabase();
      const def = TITLES[match];
      const badge = getRarityBadge(match);
      return sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🎖️ *TITLE EQUIPPED!*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n${badge.code} ${def.display}\n\n⚡ *Stat Boost:* ${def.boostDesc}\n\n💡 Your title shows in /profile, /rank, and PvP!\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      }, { quoted: msg });
    }

    // ── /title unequip ───────────────────────────────────
    if (sub === 'unequip' || sub === 'remove') {
      if (!player.equippedTitle) return sock.sendMessage(chatId, { text: '❌ No title equipped.' }, { quoted: msg });
      const was = TITLES[player.equippedTitle]?.display || player.equippedTitle;
      delete player.equippedTitle;
      saveDatabase();
      return sock.sendMessage(chatId, { text: `✅ Unequipped *${was}*.` }, { quoted: msg });
    }

    // ── /title all — show all available titles ───────────
    if (sub === 'all' || sub === 'list') {
      // Group by rarity
      const byRarity = {};
      for (const [id, def] of Object.entries(TITLES)) {
        if (!byRarity[def.rarity]) byRarity[def.rarity] = [];
        byRarity[def.rarity].push({ id, ...def });
      }
      const order = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
      let txt = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🎖️ *ALL TITLES* (${Object.keys(TITLES).length})\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      for (const rarity of order) {
        const list = byRarity[rarity] || [];
        if (!list.length) continue;
        const badge = RARITIES[rarity];
        txt += `\n${badge.code} *${badge.label.toUpperCase()}* ${badge.code}\n`;
        for (const t of list) {
          const have = owned.includes(t.id);
          const eq   = equipped === t.id;
          const icon = eq ? '✅' : have ? '🔓' : '🔒';
          const shopTag = t.shop ? ' 🛒' : (t.grant === 'owner-only' ? ' 👑' : '');
          txt += `${icon}${shopTag} ${t.display}\n   _${t.desc}_\n   ⚡ ${t.boostDesc}\n`;
        }
      }
      txt += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ = Equipped  🔓 = Owned  🔒 = Locked\n🛒 = Shop  👑 = Owner-grant\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
      return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
    }

    // ── /title <rarity> — filter by rarity ──────────────
    if (sub && RARITIES[sub]) {
      const rarity = sub;
      const list = Object.entries(TITLES).filter(([_, def]) => def.rarity === rarity);
      if (!list.length) return sock.sendMessage(chatId, { text: `❌ No ${rarity} titles defined.` }, { quoted: msg });
      const badge = RARITIES[rarity];
      let txt = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${badge.code} *${badge.label.toUpperCase()} TITLES* ${badge.code}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      for (const [id, def] of list) {
        const have = owned.includes(id);
        const eq   = equipped === id;
        const icon = eq ? '✅' : have ? '🔓' : '🔒';
        const shopTag = def.shop ? ' 🛒' : (def.grant === 'owner-only' ? ' 👑' : '');
        txt += `${icon}${shopTag} ${def.display}\n   _${def.desc}_\n   ⚡ ${def.boostDesc}\n`;
      }
      txt += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
      return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
    }

    // ── /title (main view — your earned titles) ─────────
    if (!owned.length) {
      return sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🎖️ *YOUR TITLES*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📭 No titles yet!\n\n💡 Titles are earned through gameplay:\n• Win PvP battles\n• Clear dungeons\n• Defeat world bosses\n• Reach level milestones\n• Pull legendaries in gacha\n• Buy from /titleshop (legendary)\n• Get granted by Senku/Naruto (mythic)\n\n/title all — see all available titles\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      }, { quoted: msg });
    }

    let txt = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🎖️ *YOUR TITLES* (${owned.length})\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    // Sort by rarity tier
    const sorted = [...owned].sort((a, b) => {
      const ta = RARITIES[TITLES[a]?.rarity]?.tier || 0;
      const tb = RARITIES[TITLES[b]?.rarity]?.tier || 0;
      return tb - ta;
    });
    for (const id of sorted) {
      const def = TITLES[id];
      if (!def) continue;
      const isEquipped = equipped === id;
      const badge = getRarityBadge(id);
      txt += `${isEquipped ? '✅' : '🎖️'} ${badge.code} *${def.display}*${isEquipped ? ' ← EQUIPPED' : ''}\n`;
      txt += `   ${badge.label} | ⚡ ${def.boostDesc}\n\n`;
    }

    if (newTitles.length) {
      txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🎊 *JUST UNLOCKED!*\n`;
      for (const id of newTitles) {
        const b = getRarityBadge(id);
        txt += `🆕 ${b.code} ${TITLES[id]?.display || id}\n`;
      }
      txt += '\n';
    }

    txt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n/title equip [name] — equip a title\n/title all          — see all titles\n/title <rarity>     — filter by rarity (common→mythic)\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
    return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
  }
};
