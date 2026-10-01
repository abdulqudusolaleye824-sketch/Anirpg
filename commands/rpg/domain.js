// ═══════════════════════════════════════════════════════════════
// /domain — Push #95: Domain Expansion
//   /domain                  → your domain card
//   /domain expand           → expand it in your current raid / dungeon / instance / PvP (350 energy)
//   /domain upgrade [n]      → spend UP (10 → Lv.2, 15 → Lv.3, +5 per level, max Lv.100)
//   /domain name <name>      → rename your domain
//   /domain desc <text>      → set its description (shown when you expand)
//   /domain effects          → the 10 possible effects of your class
// ═══════════════════════════════════════════════════════════════
const UI = require('../../rpg/utils/UI');
const DS = require('../../rpg/utils/DomainSystem');

module.exports = {
  name: 'domain',
  aliases: ['domainexpansion', 'expand'],
  description: '🌌 Domain Expansion — your permanent class domain (unlocks at Lv.20)',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key?.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];
    if (!player) return sock.sendMessage(chatId, { text: '❌ Register first! Use /register' }, { quoted: msg });
    const pro = UI.isPro(player);
    const FRAME = pro ? UI.PRO_BAR : UI.FREE_BAR;
    let sub = String(args[0] || '').toLowerCase();
    if (!sub) { try { const raw = String(msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').trim().toLowerCase(); if (/^[\/!.]?expand\b/.test(raw)) sub = 'expand'; } catch (e) {} } // /expand alias

    // Late unlock safety: a Lv.20+ hunter who levelled before this update.
    if (!DS.has(player) && (player.level || 1) >= 20) { DS.unlock(player); saveDatabase(); }
    if (!DS.has(player)) {
      return sock.sendMessage(chatId, { text: [FRAME, `🌌 *DOMAIN — SEALED*`, FRAME, `Every hunter's domain awakens at *Lv.20* — one of the 10 domain effects of your class, chosen by fate, yours forever.`, `You are Lv.${player.level || 1}.`, `📖 /domain effects — see what your class can awaken`].join('\n') }, { quoted: msg });
    }
    const d = player.domain;

    if (sub === 'effects' || sub === 'list') {
      const cls = d.class || 'Hunter';
      const names = DS.CLASS_DOMAINS[cls] || [];
      const lines = names.map((n, i) => {
        const a = DS.ARCHETYPES[i];
        const f = (o, w) => Object.entries(o).filter(([, v]) => v).map(([s, v]) => `${w}${DS.STAT_LABEL[s] || s} ${v > 0 ? '+' : ''}${v}%`).join(', ');
        return `${i === d.idx ? '✨' : '•'} *${n}* — ${f(a.ally, '')}${Object.keys(a.enemy).length ? ' | foes: ' + f(a.enemy, '') : ''}`;
      });
      return sock.sendMessage(chatId, { text: [FRAME, `🌌 *${cls.toUpperCase()} DOMAINS* (Lv.1 values)`, FRAME, ...lines, FRAME, `✨ = yours. Values grow +2% per Domain level.`].join('\n') }, { quoted: msg });
    }

    if (sub === 'rename' || sub === 'name') {
      const name = args.slice(1).join(' ').trim();
      if (!name) return sock.sendMessage(chatId, { text: `✏️ Usage: /domain rename <new name> — costs 1 🃏 Rename Card (you have ${player.cards?.namechange || 0}).` }, { quoted: msg });
      const r = DS.rename(player, name);
      if (!r.ok) return sock.sendMessage(chatId, { text: `❌ ${r.error}` }, { quoted: msg });
      saveDatabase();
      return sock.sendMessage(chatId, { text: `🌌 *${r.old}* → *${r.name}* · 🃏 1 Rename Card used (${r.left} left)` }, { quoted: msg });
    }
    if (sub === 'desc' || sub === 'description') {
      return sock.sendMessage(chatId, { text: d.desc ? `📜 *${d.name}* — _${d.desc}_\n⚠️ Domain descriptions are permanent.` : `📜 Your domain has no description — it is set once, in your DM, when the domain awakens.${DS.setupStep(player) ? ' Check your DM — the system is still waiting for your reply.' : ''}` }, { quoted: msg });
    }

    if (sub === 'upgrade' || sub === 'up') {
      const n = Math.max(1, parseInt(args[1], 10) || 1);
      const r = DS.upgrade(player, n);
      if (!r.ok) return sock.sendMessage(chatId, { text: `❌ ${r.error}` }, { quoted: msg });
      saveDatabase();
      return sock.sendMessage(chatId, { text: [FRAME, `📈 *DOMAIN UPGRADED* — *${d.name}* Lv.${r.level}`, FRAME, `Spent *${r.spent} UP* (+${r.levels} level${r.levels === 1 ? '' : 's'}) · ${player.upgradePoints || 0} UP left`, `⏳ Lasts ${DS.turnsFor(r.level)} turns`, ...DS.describe(player), r.next != null ? `➡️ Next level: ${r.next} UP` : `🏆 Max level reached.`].join('\n') }, { quoted: msg });
    }

    if (sub === 'expand' || sub === 'cast' || sub === 'open') {
      const battle = DS.findBattle(player, sender, db);
      if (!battle) return sock.sendMessage(chatId, { text: '❌ You can only expand your domain inside a live raid, dungeon, instance or PvP battle.' }, { quoted: msg });
      if ((player.stats?.hp || 0) <= 0) return sock.sendMessage(chatId, { text: '❌ The dead expand nothing.' }, { quoted: msg });
      const r = DS.expand(battle.arena, player, battle.allies, battle.enemies, { kind: battle.kind });
      saveDatabase();
      if (!r.ok) return sock.sendMessage(chatId, { text: r.clashed ? r.error : `❌ ${r.error}` }, { quoted: msg });
      const text = [FRAME, r.text, FRAME, `⚡ ${player.stats.energy}/${player.stats.maxEnergy} ${player.energyType || 'energy'} left`].join('\n');
      await sock.sendMessage(chatId, { text }, { quoted: msg });
      // PvP: tell the opponent too (they may be in another chat / DM).
      if (battle.kind === 'pvp') { try { const opp = battle.enemies[0]; const to = opp && (opp.jid || opp.id); if (to && to !== chatId) await sock.sendMessage(to, { text: `🌌 *${player.name}* expanded their domain against you!\n${r.text}` }); } catch (e) {} }
      return;
    }

    // card
    const e = DS.scaledEffect(player); const next = DS.costToNext(d.level);
    return sock.sendMessage(chatId, { text: [FRAME, `🌌 *${d.name.toUpperCase()}*`, FRAME, d.desc ? `_${d.desc}_` : `_No description yet — /domain desc <text>_`, `👤 ${player.name} · ${d.class} · Domain Lv.${d.level}/${DS.MAX_LEVEL} · power ${DS.power(player)}`, `⏳ ${e.turns} turns · ⚡ ${DS.CAST_ENERGY} energy · cast ${d.casts || 0}×`, ...DS.describe(player), ``, next != null ? `📈 Next level: *${next} UP* (you have ${player.upgradePoints || 0}) — /domain upgrade` : `🏆 Max level.`, `⚔️ /domain expand · ✏️ /domain name · /domain desc`, FRAME].join('\n') }, { quoted: msg });
  },
};
