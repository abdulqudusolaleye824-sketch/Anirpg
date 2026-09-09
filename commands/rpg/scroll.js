// ═══════════════════════════════════════════════════════════════
// /scroll — Manage recipe scrolls
//
// /scroll           — List your scrolls
// /scroll read <#>  — Read a scroll (sends recipe + key to your DM via Serf)
// ═══════════════════════════════════════════════════════════════

'use strict';

const { readScroll, formatScrollRead, checkMaterials } = require('../../rpg/utils/CraftingSystem');
const SerfManager = require('../../rpg/utils/SerfManager');

module.exports = {
  name: 'scroll',
  aliases: ['scrolls'],
  description: '📜 Manage your recipe scrolls and send recipes to DM via Serf',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key?.remoteJid;
    const isGroup = chatId.endsWith('@g.us');
    const db = getDatabase();
    const player = db.users[sender];

    if (!player) return sock.sendMessage(chatId, { text: '❌ Register first! Use /register' }, { quoted: msg });

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
            `📜 *YOUR SCROLLS*`,
            ``,
            `You have no recipe scrolls.`,
            `Buy scrolls from the shop: */shop scrolls*`,
          ].join('\n')
        }, { quoted: msg });
      }

      const lines = [
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `📜 *YOUR RECIPE SCROLLS*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
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

      lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      lines.push(`📖 */scroll read <#>* — Read scroll (dispatches recipe to DM via Serf)`);
      lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

      return sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: msg });
    }

    // ── READ SCROLL ───────────────────────────────────────────
    if (sub === 'read' || sub === 'open') {
      const idx = parseInt(args[1]) - 1;
      return this.handleReadScroll(sock, msg, args, getDatabase, saveDatabase, sender, idx);
    }

    return sock.sendMessage(chatId, {
      text: '/scroll — list scrolls\n/scroll read <#> — read a scroll (sends recipe to DM via Serf)'
    }, { quoted: msg });
  },

  async handleReadScroll(sock, msg, args, getDatabase, saveDatabase, sender, idx) {
    const chatId = msg.key?.remoteJid;
    const isGroup = chatId.endsWith('@g.us');
    const db = getDatabase();
    const player = db.users[sender];

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
    saveDatabase();

    // Check materials
    const matCheck = checkMaterials(player, scroll.recipe);
    const matStatus = matCheck.map(m =>
      `${m.ok ? '✅' : '❌'} ${m.mat} (${m.have}/${m.need})`
    ).join('\n');

    const scrollText = formatScrollRead(scroll);
    const fullText = [
      scrollText,
      ``,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `🎒 *YOUR MATERIALS*`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      matStatus,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ].join('\n');

    // Deliver via Serf socket or primary socket
    let MultiSocketManager = null;
    try { MultiSocketManager = require('../../bots/MultiSocketManager'); } catch (e) {}

    const serf = SerfManager.getSerf(db, sender);
    const serfSock = serf?.botKey && MultiSocketManager ? MultiSocketManager.getSocket(serf.botKey) : null;
    const targetSock = serfSock || (MultiSocketManager ? MultiSocketManager.getAnySocket() : null) || sock;

    const dmJid = `${sender.split('@')[0]}@s.whatsapp.net`;
    let dmSent = false;

    try {
      await targetSock.sendMessage(dmJid, { text: fullText });
      dmSent = true;
    } catch (e) {
      try {
        await sock.sendMessage(dmJid, { text: fullText });
        dmSent = true;
      } catch (err) {
        dmSent = false;
      }
    }

    if (isGroup) {
      if (dmSent) {
        return sock.sendMessage(chatId, {
          text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📬 *RECIPE DISPATCHED TO DM*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n@${sender.split('@')[0]}, your Recipe Scroll #${idx + 1} (*${scroll.recipe.output}*) details and craft key have been sent directly to your DM!`,
          mentions: [sender]
        }, { quoted: msg });
      } else {
        // Fallback in group if DM delivery failed completely
        return sock.sendMessage(chatId, {
          text: `⚠️ *DM delivery failed.* Here is your recipe details:\n\n${fullText}`,
        }, { quoted: msg });
      }
    } else {
      if (!dmSent) {
        return sock.sendMessage(chatId, { text: fullText }, { quoted: msg });
      }
    }
  }
};
