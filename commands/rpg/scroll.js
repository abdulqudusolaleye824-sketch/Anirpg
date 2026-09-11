// ═══════════════════════════════════════════════════════════════
// /scroll — Manage recipe scrolls
//
// /scroll           — List your scrolls
// /scroll read <#>  — Read a scroll (sends recipe + key to your DM via Serf)
// ═══════════════════════════════════════════════════════════════

'use strict';

const { readScroll, formatScrollRead, checkMaterials } = require('../../rpg/utils/CraftingSystem');
const SerfManager = require('../../rpg/utils/SerfManager');
const { stripDevice } = require('../../utils/constants');

module.exports = {
  name: 'scroll',
  aliases: ['scrolls', 'read'],
  description: '📜 Manage your recipe scrolls and send recipes to DM via Serf',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key?.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];

    if (!player) return sock.sendMessage(chatId, { text: '❌ Register first! Use /register' }, { quoted: msg });
    const UI = require('../../rpg/utils/UI');
    const pro = UI.isPro(player);
    const FRAME = pro ? UI.PRO_BAR : UI.FREE_BAR;

    const scrolls = player.inventory?.scrolls || [];
    const sub = args[0]?.toLowerCase();

    // ── LIST SCROLLS ─────────────────────────────────────────
    if (!sub || (sub !== 'read' && sub !== 'open' && !isNaN(parseInt(sub)))) {
      // If user typed /scroll 1
      if (sub && !isNaN(parseInt(sub))) {
        return this.handleReadScroll(sock, msg, args, getDatabase, saveDatabase, sender, parseInt(sub) - 1);
      }

      if (scrolls.length === 0) {
        return sock.sendMessage(chatId, {
          text: [
            ...(pro ? [UI.PRO_BAR, `📜 *YOUR SCROLLS* 💎`, UI.PRO_BAR] : [`📜 *YOUR SCROLLS*`, UI.FREE_BAR]),
            ``,
            `You have no recipe scrolls.`,
            `Buy scrolls from the shop: */shop scrolls*`,
            FRAME,
            ...(pro ? [UI.PRO_MINI, `💎 *PRO SCROLL* — no scrolls yet`] : [UI.upsell()]),
          ].join('\n')
        }, { quoted: msg });
      }

      const lines = [
        ...(pro ? [UI.PRO_BAR, `📜 *YOUR RECIPE SCROLLS* 💎`, UI.PRO_BAR] : [`📜 *YOUR RECIPE SCROLLS*`, UI.FREE_BAR]),
        ``,
      ];

      scrolls.forEach((s, i) => {
        const status = s.crafted ? '✅ Crafted' : s.revealed ? '👁️ Revealed' : '🔒 Sealed';
        lines.push(`${i + 1}. ${s.emoji || '📜'} *${s.rarity || 'Common'} Scroll* [${s.id.slice(-6)}]`);
        lines.push(`   Status: ${status}`);
        if (s.revealed && !s.crafted && s.recipe) {
          lines.push(`   Recipe: *${s.recipe.output}*`);
          lines.push(`   Key: *${s.key}*`);
        }
        lines.push('');
      });

      lines.push(FRAME);
      lines.push(`📖 */scroll read <#>* — Read scroll (dispatches recipe to DM via Serf)`);
      lines.push(FRAME, ...(pro ? [UI.PRO_MINI, `💎 *PRO SCROLL* — ${scrolls.length} scrolls`] : [UI.upsell()]));

      return sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: msg });
    }

    // ── READ SCROLL ───────────────────────────────────────────
    if (sub === 'read' || sub === 'open') {
      const idx = parseInt(args[1]) - 1;
      return this.handleReadScroll(sock, msg, args, getDatabase, saveDatabase, sender, idx);
    }

    return sock.sendMessage(chatId, {
      text: (pro ? `${UI.PRO_BAR}\n📜 *SCROLL COMMANDS* 💎\n${UI.PRO_BAR}\n\n/scroll — list scrolls\n/scroll read <#> — read a scroll (sends recipe to DM via Serf)\n${UI.PRO_BAR}\n${UI.PRO_MINI}\n💎 *PRO SCROLL* — manage your recipes` : `📜 *SCROLL COMMANDS*\n${UI.FREE_BAR}\n\n/scroll — list scrolls\n/scroll read <#> — read a scroll (sends recipe to DM via Serf)\n${UI.FREE_BAR}\n${UI.upsell()}`)
    }, { quoted: msg });
  },

  async handleReadScroll(sock, msg, args, getDatabase, saveDatabase, sender, idx) {
    const chatId = msg.key?.remoteJid;
    const isGroup = chatId.endsWith('@g.us');
    const db = getDatabase();
    const player = db.users[sender];
    const UI = require('../../rpg/utils/UI');
    const pro = UI.isPro(player || {});
    const FRAME = pro ? UI.PRO_BAR : UI.FREE_BAR;

    const scrolls = player.inventory?.scrolls || [];

    if (isNaN(idx) || idx < 0 || idx >= scrolls.length) {
      return sock.sendMessage(chatId, {
        text: `❌ Invalid scroll number. You have ${scrolls.length} scroll(s).\nUsage: */scroll read <#>*`
      }, { quoted: msg });
    }

    const scroll = scrolls[idx];

    if (scroll.crafted) {
      return sock.sendMessage(chatId, {
        text: `❌ This scroll has already been used to craft *${scroll.recipe?.output || 'item'}*.`
      }, { quoted: msg });
    }

    // Reveal if not already
    readScroll(scroll);

    // Track Quests & Achievements for reading scroll
    try {
      const { trackAndNotify } = require('../../rpg/utils/QuestDispatcher');
      const note = trackAndNotify(player, 'scroll', 1, sock, sender, chatId);
      if (note) await sock.sendMessage(chatId, { text: note }, { quoted: msg });
    } catch (e) {}

    try {
      const AchievementManager = require('../../rpg/utils/AchievementManager');
      const newlyUnlocked = AchievementManager.track(player, 'scroll_read', 1);
      const achNote = AchievementManager.buildNotification(newlyUnlocked, player);
      if (achNote) await sock.sendMessage(chatId, { text: achNote, mentions: [sender] }, { quoted: msg });
    } catch (e) {}

    saveDatabase();

    // Check materials
    const matCheck = checkMaterials(player, scroll.recipe);
    const matStatus = matCheck.map(m =>
      `${m.ok ? '✅' : '❌'} ${m.mat} (${m.have}/${m.need})`
    ).join('\n');

    const scrollText = formatScrollRead(scroll, player);
    const fullText = [
      scrollText,
      ``,
      FRAME,
      `🎒 *YOUR MATERIALS*`,
      FRAME,
      matStatus,
      FRAME,
      ...(pro ? [UI.PRO_MINI, `💎 *PRO SCROLL* — key guarded`] : [UI.upsell()]),
    ].join('\n');

    // Deliver via Serf ONLY — IRON WALL GATING
    let MultiSocketManager = null;
    try { MultiSocketManager = require('../../bots/MultiSocketManager'); } catch (e) {}

    const cleanSender = stripDevice(sender);
    const serf = SerfManager.getSerf(db, sender);
    const hasSerf = !!serf;

    let dmSent = false;
    if (MultiSocketManager) {
      const dmRes = await MultiSocketManager.safeSendDM(sock, cleanSender, { text: fullText }, { db });
      dmSent = !dmRes?.dropped;
    }

    if (isGroup) {
      if (dmSent) {
        return sock.sendMessage(chatId, {
          text: (pro ? `${UI.PRO_BAR}\n📬 *RECIPE DISPATCHED TO DM* 💎\n${UI.PRO_BAR}\n\n@${sender.split('@')[0]}, your Recipe Scroll #${idx + 1} (*${scroll.recipe?.output || 'Item'}*) details and craft key have been sent directly to your DM via your Serf!\n${UI.PRO_BAR}\n${UI.PRO_MINI}\n💎 *PRO SCROLL* — Scroll #${idx + 1} dispatched` : `📬 *RECIPE DISPATCHED TO DM*\n${UI.FREE_BAR}\n\n@${sender.split('@')[0]}, your Recipe Scroll #${idx + 1} (*${scroll.recipe?.output || 'Item'}*) details and craft key have been sent directly to your DM via your Serf!\n${UI.FREE_BAR}\n${UI.upsell()}`),
          mentions: [sender]
        }, { quoted: msg });
      } else {
        // Serf offline, banned, or not set — ABSOLUTELY NO LEAKS
        return sock.sendMessage(chatId, {
          text: [
            ...(pro ? [UI.PRO_BAR, `⚠️ *SERF DM NOTIFICATION* 💎`, UI.PRO_BAR] : [`⚠️ *SERF DM NOTIFICATION*`, UI.FREE_BAR]),
            ``,
            `@${sender.split('@')[0]}, private DM delivery was blocked because your assigned Serf is currently offline or not set!`,
            ``,
            `⚓ *Solution:*`,
            hasSerf
              ? `Your assigned Serf is currently offline. You can view your recipe details right here:`
              : `Set up your official Serf using */setserf @bot* to receive private DM alerts.`,
            ``,
            `📜 *Scroll Details:*`,
            fullText,
            FRAME,
            ...(pro ? [UI.PRO_MINI, `💎 *PRO SCROLL* — Scroll #${idx + 1} revealed`] : [UI.upsell()]),
          ].join('\n'),
          mentions: [sender]
        }, { quoted: msg });
      }
    } else {
      if (!dmSent) {
        return sock.sendMessage(chatId, { text: fullText }, { quoted: msg });
      }
    }
  }
};
