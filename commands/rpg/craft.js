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
    const CSx = require('../../rpg/utils/CraftingSystem');
    const FRAME0 = UI.isPro(player) ? UI.PRO_BAR : UI.FREE_BAR;

    // Push #103b: /craft status — timed forges in progress
    if (/^(status|jobs|queue|progress)$/i.test(fullInput) || !fullInput) {
      const jobs = CSx.jobsOf(db, sender);
      const L = [FRAME0, `⚒️ *YOUR FORGE*`, FRAME0];
      if (!jobs.length) L.push(`Nothing on the anvil.`, ``, `Usage: */craft <item name> --<KEY>*`, `📖 Read a scroll in DMs to get the key (/scroll).`);
      else for (const j of jobs) L.push(`• *${j.recipe.output}* (${j.rarity}${j.mode !== 'standard' ? ` · ${j.mode}` : ''}) — ready in *${CSx.fmtDur(j.readyAt - Date.now())}*`);
      L.push(``, `⏳ Forge times: E 12h · D 1d · C 1.5d · B 2d · A 3d · S 5d${UI.isPro(player) ? ' · 💎 Pro: half' : ' · Pro: half time'}`, `📣 You are notified here when a piece is done${UI.isPro(player) ? ' (and by DM via your serf)' : ''}.`, FRAME0);
      return sock.sendMessage(chatId, { text: L.join('\n') }, { quoted: msg });
    }

    // Parse item name and key — format: <item name> --<KEY> [confirm [quality|quantity]]   (Push #97/#103b)
    const keyMatch = fullInput.match(/--([A-Z0-9]{6})(?:\s+confirm(?:\s+(quality|quantity))?)?$/i);
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
    const craftMode = keyMatch[2] ? keyMatch[2].toLowerCase() : null;
    const itemName = fullInput.replace(/\s*confirm(?:\s+(?:quality|quantity))?\s*$/i, '').replace(/--[A-Z0-9]{6}$/i, '').trim();
    const wantsConfirm = /--[A-Z0-9]{6}\s+confirm(?:\s+(?:quality|quantity))?$/i.test(fullInput);

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
      const _modes = CSx.craftModes(player);
      if (_modes.includes('quality')) L.push(`⏳ Forge time: *${CSx.fmtDur(CSx.craftDurationMs(player, pv.rarity, 'quality'))}* (quality) · *${CSx.fmtDur(CSx.craftDurationMs(player, pv.rarity, 'quantity'))}* (quantity)`, `🪶 Shaman's choice — *Quality*: +20% all stats & durability · *Quantity*: −20% forge time, plain piece.`);
      else L.push(`⏳ Forge time: *${CSx.fmtDur(CSx.craftDurationMs(player, pv.rarity))}*${pro ? ' (💎 Pro: half)' : ''} — you are notified here when it is done.`);
      L.push(`🏪 Crafted pieces are store-grade: same stats & durability bands as /store for that rank.`);
      if (pv.canCraft) L.push(``, CSx.craftModes(player).includes('quality') ? `👉 Confirm: */craft ${pv.recipe.output} --${key} confirm quality* or *… confirm quantity*` : `👉 Confirm: */craft ${pv.recipe.output} --${key} confirm*`);
      else L.push(``, `🔒 Not ready — ${pv.missing.length} item(s) missing. See the steps on the card.`);
      L.push(FRAME);
      return L.join('\n');
    })();
    if (!wantsConfirm || !pv.canCraft) {
      let img = null; try { img = await require('../../rpg/utils/CraftRenderer').renderCraftImage(pv, player); } catch (e) { img = null; }
      const _sh = CSx.craftModes(player).includes('quality');
      const btns = pv.canCraft ? (_sh ? [['✨ Quality (+20%)', `/craft ${pv.recipe.output} --${key} confirm quality`], ['⏱️ Quantity (−20% time)', `/craft ${pv.recipe.output} --${key} confirm quantity`], ['📜 Scrolls', '/scroll']] : [[`⚒️ FORGE (${pv.successPct}%)`, `/craft ${pv.recipe.output} --${key} confirm`], ['📜 Scrolls', '/scroll']]) : [['♻️ Recycle mats', '/recycle'], ['📜 Scrolls', '/scroll']];
      if (img) { try { await sock.sendMessage(chatId, { image: img, caption: previewText }, { quoted: msg }); if (pro && Buttons) { try { await Buttons.sendButtons(sock, chatId, { text: pv.canCraft ? `⚒️ Ready. Forge *${pv.recipe.output}*?` : `🔒 Gather the missing items first.`, buttons: Buttons.quickReplies(btns) }); } catch (e) {} } return; } catch (e) {} }
      return _reply(previewText, btns);
    }

    // Push #103b: a Shaman must pick Quality or Quantity before the forge lights.
    if (CSx.craftModes(player).includes('quality') && !craftMode) {
      return _reply([FRAME, `🪶 *SHAMAN'S CHOICE — ${pv.recipe.output}*`, FRAME,
        `✨ *Quality* — +20% all stats & durability · ready in *${CSx.fmtDur(CSx.craftDurationMs(player, pv.rarity, 'quality'))}*`,
        `⏱️ *Quantity* — plain piece · ready in *${CSx.fmtDur(CSx.craftDurationMs(player, pv.rarity, 'quantity'))}*`, FRAME].join('\n'),
        [['✨ Quality', `/craft ${pv.recipe.output} --${key} confirm quality`], ['⏱️ Quantity', `/craft ${pv.recipe.output} --${key} confirm quantity`]]);
    }
    // Light the forge (confirmed) — pays now, delivers when the timer ends.
    const result = attemptCraft(player, itemName, key, db, { mode: craftMode || 'standard', chatId, owner: sender });

    if (!result.success) {
      if (result.failed) { saveDatabase(); try { require('../../rpg/utils/QuestDispatcher').trackAndNotify(player, 'craft', 1, sock, sender, chatId); } catch (e) {} }
      return _reply(result.reason, result.failed ? [['🔁 Try again', `/craft ${itemName} --${key}`], ['♻️ Recycle', '/recycle']] : []);
    }

    // Daily quest: item crafted (counts when the forge is lit)
    try { require('../../rpg/utils/QuestDispatcher').trackAndNotify(player, 'craft', 1, sock, sender, chatId); } catch(e){}
    saveDatabase();
    const j = result.job;
    return _reply([FRAME, `🔥 *FORGE LIT — ${j.recipe.output}*`, FRAME,
      `⭐ ${String(j.rarity).toUpperCase()}${j.mode === 'quality' ? ' · ✨ Shaman Quality (+20%)' : j.mode === 'quantity' ? ' · ⏱️ Shaman Quantity (−20% time)' : ''}`,
      `⏳ Ready in *${CSx.fmtDur(result.ms)}* — you'll be pinged here${pro ? ' and DM\'d via your serf' : ''} when it's done.`,
      `💸 Spent: ${(result.spent?.mats || []).map(m => `${m.mat} ×${m.need}`).join(', ')}, ${result.spent?.essence?.name} ×${result.spent?.essence?.need}, 💠 ${Number(result.spent?.nexus || 0).toLocaleString()}`,
      `🔎 */craft status* — see your forge`, FRAME].join('\n'), [['⚒️ Forge status', '/craft status'], ['📜 Scrolls', '/scroll']]);
  }
};
