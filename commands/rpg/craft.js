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
    const UI = require('../../rpg/utils/UI');

    const fullInput = args.join(' ').trim();

    // Parse item name and key — format: <item name> --<KEY> [confirm]   (Push #97: optional trailing confirm)
    const keyMatch = fullInput.match(/--([A-Z0-9]{6})(?:\s+confirm)?$/i);
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
    const itemName = fullInput.replace(/\s*confirm\s*$/i, '').replace(/--[A-Z0-9]{6}$/i, '').trim();
    const wantsConfirm = /--[A-Z0-9]{6}\s+confirm$/i.test(fullInput);

    if (!itemName) {
      return sock.sendMessage(chatId, {
        text: '❌ Please provide an item name.\nExample: */craft Iron Sword --G3VWU2*'
      }, { quoted: msg });
    }

    // ── Push #97: PREVIEW first (image card: materials have/missing, essence, fee, odds, steps). ──
    // The forge only fires on an explicit confirm — a 10% fail burns everything, so nobody crafts blind.
    const CS = require('../../rpg/utils/CraftingSystem');
    const Buttons = (() => { try { return require('../../utils/buttons'); } catch (e) { return null; } })();
    const pro = UI.isPro(player);
    const FRAME = pro ? UI.PRO_BAR : UI.FREE_BAR;
    const _reply = async (text, btnPairs) => {
      if (pro && Buttons && btnPairs && btnPairs.length) { try { return await Buttons.sendButtons(sock, chatId, { text, buttons: Buttons.quickReplies(btnPairs) }, msg); } catch (e) {} }
      if (btnPairs && btnPairs.length) text += `\n\n` + btnPairs.map(b => `▫️ ${b[0]} → ${b[1]}`).join('\n');
      return sock.sendMessage(chatId, { text }, { quoted: msg });
    };
    const pv = CS.craftPreview(player, itemName, key, db);
    if (!pv.ok) return sock.sendMessage(chatId, { text: pv.reason }, { quoted: msg });
    const previewText = (() => {
      const L = [FRAME, `⚒️ *FORGE PREVIEW — ${pv.recipe.output}*`, FRAME, `⭐ ${String(pv.rarity).toUpperCase()} ${pv.recipe.type || ''}${pv.recipe.subtype ? ` (${pv.recipe.subtype})` : ''}`, ``, `🧪 *MATERIALS*`];
      for (const m of pv.mats) L.push(`${m.ok ? '✅' : '❌'} ${m.mat} — ${m.have}/${m.need}${m.ok ? '' : ` (missing ${m.need - m.have})`}`);
      L.push(`${pv.essence.have >= pv.essence.need ? '✅' : '❌'} ${pv.essence.emoji} ${pv.essence.name} — ${pv.essence.have}/${pv.essence.need}${pv.essence.have >= pv.essence.need ? '' : ` (missing ${pv.essence.need - pv.essence.have})`}`);
      L.push(`${pv.nexus.ok ? '✅' : '❌'} 💠 Forge fee — ${pv.nexus.need.toLocaleString()} Nexus (you: ${pv.nexus.have.toLocaleString()})`);
      L.push(``, `🎲 *${pv.successPct}% success · ${100 - pv.successPct}% FAIL*`, `⚠️ *A fail CONSUMES every material above, the essence stones and the Nexus fee.* The scroll/key survives.`);
      if (pv.canCraft) L.push(``, `👉 Confirm: */craft ${pv.recipe.output} --${key} confirm*`);
      else L.push(``, `🔒 Not ready — ${pv.missing.length} item(s) missing. See the steps on the card.`);
      L.push(FRAME);
      return L.join('\n');
    })();
    if (!wantsConfirm || !pv.canCraft) {
      let img = null; try { img = await require('../../rpg/utils/CraftRenderer').renderCraftImage(pv, player); } catch (e) { img = null; }
      const btns = pv.canCraft ? [['⚒️ FORGE (90%)', `/craft ${pv.recipe.output} --${key} confirm`], ['📜 Scrolls', '/scroll']] : [['♻️ Recycle mats', '/recycle'], ['📜 Scrolls', '/scroll']];
      if (img) { try { await sock.sendMessage(chatId, { image: img, caption: previewText }, { quoted: msg }); if (pro && Buttons) { try { await Buttons.sendButtons(sock, chatId, { text: pv.canCraft ? `⚒️ Ready. Forge *${pv.recipe.output}*?` : `🔒 Gather the missing items first.`, buttons: Buttons.quickReplies(btns) }); } catch (e) {} } return; } catch (e) {} }
      return _reply(previewText, btns);
    }

    // Attempt craft (confirmed)
    const result = attemptCraft(player, itemName, key, db);

    if (!result.success) {
      if (result.failed) { saveDatabase(); try { require('../../rpg/utils/QuestDispatcher').trackAndNotify(player, 'craft', 1, sock, sender, chatId); } catch (e) {} }
      return _reply(result.reason, result.failed ? [['🔁 Try again', `/craft ${itemName} --${key}`], ['♻️ Recycle', '/recycle']] : []);
    }

    const item = result.item;

    // Award Weekly GP (central ledger) + Battle Pass XP for crafting
    try { require('../../rpg/utils/WeeklyGuildWar').addGP(db, sender, 75, saveDatabase); } catch(e) {}
    try { const _BP = require('../../rpg/utils/BattlePass'); if (_BP.addPassXPAmount) _BP.addPassXPAmount(player, 50); } catch(e) {}
    // Daily quest: item crafted (exactly once)
    try { require('../../rpg/utils/QuestDispatcher').trackAndNotify(player, 'craft', 1, sock, sender, chatId); } catch(e){}

    saveDatabase();

    // Notify original owner if someone else used their key
    const stolenKey = result.scrollOwnerJid && result.scrollOwnerJid !== sender;
    if (stolenKey) {
      try {
        const oPro = UI.isPro(db.users?.[result.scrollOwnerJid]);
        await sock.sendMessage(result.scrollOwnerJid, {
          text: [
            ...(oPro ? [UI.PRO_BAR, `🔑 *YOUR SCROLL KEY WAS USED* 💎`, UI.PRO_BAR] : [`🔑 *YOUR SCROLL KEY WAS USED*`, UI.FREE_BAR]),
            ``,
            `Someone used your craft key *${key}*`,
            `and crafted *${item.name}*.`,
            ``,
            `Your scroll has been consumed.`,
            oPro ? UI.PRO_BAR : UI.FREE_BAR,
          ].join('\n')
        });
      } catch (e) {}
    }

    // ── Two-message card: artwork (if available) + stats/lore ──
    const statKeys = ['atk', 'bonus', 'def', 'hp', 'speed', 'critChance', 'lifesteal', 'magicPower', 'energy'];
    const statObj = {};
    for (const k of statKeys) if (item[k]) statObj[k] = item[k];

    // Push #96h-z21: the craft result must ALWAYS be announced. The image card can fail (canvas / media upload
    // hiccups) — players then saw nothing and thought the craft vanished. Text fallback on any failure.
    const _textCard = () => {
      const FRAME = UI.isPro(player) ? UI.PRO_BAR : UI.FREE_BAR;
      const st = Object.entries(statObj).map(([k, v]) => `${k.toUpperCase()} +${v}`).join(' · ');
      return sock.sendMessage(chatId, { text: [FRAME, `🔨 *CRAFTED!* ${item.emoji || '✨'} *${item.name}*`, FRAME, `⭐ Rarity: ${(item.rarity || 'common').toUpperCase()}${item.type ? ` · ${item.type}` : ''}`, st ? `📊 ${st}` : null, item.durability ? `🔧 Durability ${item.durability}/${item.maxDurability}` : null, stolenKey ? `🔑 (crafted with someone else's scroll key)` : null, `🎒 It is in your bag — /inv`, FRAME].filter(Boolean).join('\n') }, { quoted: msg });
    };
    try {
      const _sent = await sendImageCard(sock, chatId, {
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
      if (!_sent) await _textCard();
    } catch (e) { await _textCard(); }
    // Push #97: say EXACTLY where it landed.
    const _slot = result.slot || item.subtype || item.type || 'inventory';
    let _gearNo = 1; try { const gl = (player.inventory.items || []).filter(i => i && i.isGear).slice().sort((a, b) => (b.acquiredAt || 0) - (a.acquiredAt || 0)); const gi = gl.indexOf(result.granted); if (gi >= 0) _gearNo = gi + 1; } catch (e) {}
    const _invPos = result.invIndex >= 0 ? result.invIndex + 1 : (player.inventory.items || []).length;
    return _reply([FRAME, `📦 *${item.name}* → your inventory: */gear* list *#${_gearNo}* (slot: *${_slot}*${String(item.type).toLowerCase() === 'weapon' ? ' — weapon arm' : ''}) · */inv* item *#${_invPos}*.`, `💸 Spent: ${(result.spent?.mats || []).map(m => `${m.mat} ×${m.need}`).join(', ')}, ${result.spent?.essence?.name} ×${result.spent?.essence?.need}, 💠 ${(result.spent?.nexus || 0).toLocaleString()} Nexus`, `🧰 Equip now: */gear equip ${_gearNo}*`, FRAME].join('\n'), [['🧰 Equip it', `/gear equip ${_gearNo}`], ['🎒 Gear list', '/gear']]);
  }
};
