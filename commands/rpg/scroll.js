// ═══════════════════════════════════════════════════════════════
// /scroll — Manage recipe scrolls
//
// /scroll           — list your scrolls
// /scroll read <id> — read a scroll (DM only, reveals recipe + key)
// /scroll info <id> — re-read an already revealed scroll
// ═══════════════════════════════════════════════════════════════

const { readScroll, formatScrollRead, checkMaterials } = require('../../rpg/utils/CraftingSystem');

module.exports = {
  name: 'scroll',
  description: '📜 Manage your recipe scrolls',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key?.remoteJid;
    const isGroup = chatId.endsWith('@g.us');
    const db = getDatabase();
    const player = db.users[sender];

    if (!player) return sock.sendMessage(chatId, { text: '❌ Register first! Use /register' }, { quoted: msg });

    const scrolls = player.inventory?.scrolls || [];
    const sub = args[0]?.toLowerCase();

    // ── LIST SCROLLS ─────────────────────────────────────────
    if (!sub) {
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
        lines.push(`${i + 1}. ${s.emoji} *${s.rarity} Scroll* [${s.id.slice(-6)}]`);
        lines.push(`   Status: ${status}`);
        if (s.revealed && !s.crafted) {
          lines.push(`   Recipe: *${s.recipe.output}*`);
          lines.push(`   Key: *${s.key}*`);
        }
        lines.push('');
      });

      lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      lines.push(`📖 */scroll read <#>* — Read a scroll (DM only)`);
      lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

      return sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: msg });
    }

    // ── READ SCROLL ───────────────────────────────────────────
    if (sub === 'read' || sub === 'open') {
      // Must be in DMs
      if (isGroup) {
        return sock.sendMessage(chatId, {
          text: [
            `🔒 *Scrolls can only be read in DMs.*`,
            ``,
            `Your recipe and key are private.`,
            `Message the bot directly to read your scroll.`,
          ].join('\n')
        }, { quoted: msg });
      }

      const idx = parseInt(args[1]) - 1;
      if (isNaN(idx) || idx < 0 || idx >= scrolls.length) {
        return sock.sendMessage(chatId, {
          text: `❌ Invalid scroll number. You have ${scrolls.length} scroll(s).\nUsage: */scroll read <#>*`
        }, { quoted: msg });
      }

      const scroll = scrolls[idx];

      if (scroll.crafted) {
        return sock.sendMessage(chatId, {
          text: `❌ This scroll has already been used to craft *${scroll.recipe.output}*.`
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

      return sock.sendMessage(chatId, { text: fullText }, { quoted: msg });
    }

    return sock.sendMessage(chatId, {
      text: '/scroll — list scrolls\n/scroll read <#> — read a scroll (DM only)'
    }, { quoted: msg });
  }
};
