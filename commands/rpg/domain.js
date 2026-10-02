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
      // Push #96h-q: ONE free rewrite with /domain desc <text> (up to 2000 chars).
      const txt = args.slice(1).join(' ').replace(/[*_~`]/g, '').replace(/\s+/g, ' ').trim();
      if (txt) {
        if (d.descEdited) return sock.sendMessage(chatId, { text: `❌ You already used your one *free* description change. *${d.name}* keeps: _${d.desc || '—'}_` }, { quoted: msg });
        if (txt.length > 2000) return sock.sendMessage(chatId, { text: `❌ Up to 2000 characters (yours is ${txt.length}).` }, { quoted: msg });
        d.desc = txt; d.descEdited = Date.now(); saveDatabase();
        return sock.sendMessage(chatId, { text: `📜 *${d.name}* — _${d.desc}_\n✅ Description set. That was your one free change — it is permanent now.` }, { quoted: msg });
      }
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
      // Push #96h-c: name → description → effect as separate messages.
      const _parts = DS.splitMessages(r.text); const _last = _parts.length - 1;
      for (let i = 0; i < _parts.length; i++) { const _t = i === 0 ? `${FRAME}\n${_parts[i]}` : i === _last ? `${_parts[i]}\n${FRAME}\n⚡ ${player.stats.energy}/${player.stats.maxEnergy} ${player.energyType || 'energy'} left` : _parts[i]; await sock.sendMessage(chatId, { text: _t }, i === 0 ? { quoted: msg } : undefined); }
      // PvP: tell the opponent too (they may be in another chat / DM).
      // Push #96h-t: the 'expanded their domain against you' DM is scrapped — the expansion plays out in the battle chat only.
      return;
    }

    // card
    const e = DS.scaledEffect(player); const next = DS.costToNext(d.level);
    // Push #96h-q: in battle, say whose domain stands, how long, and whether YOURS is ready.
    const _battle = [];
    try {
      const b = DS.findBattle(player, sender, db);
      if (b && b.arena) {
        const cur = DS.active(b.arena);
        const mine = cur && (String(cur.ownerId) === String(player.jid || player.id || player.name) || (cur.ownerKeys || []).some(k => [player.jid, player.id, player.name].filter(Boolean).map(String).includes(k)));
        _battle.push(FRAME, `⚔️ *BATTLE (${b.kind})*`);
        _battle.push(cur ? `🌌 Active: *${cur.name}* — ${mine ? 'YOURS' : (cur.side === 'monster' ? 'the beast' : cur.ownerName)} · *${cur.turnsLeft}* round${cur.turnsLeft === 1 ? '' : 's'} left` : `🌫️ No domain is active right now.`);
        const cost = DS.costFor(d.level || 1); const en = player.stats?.energy || 0;
        _battle.push(mine ? `✅ Your domain stands — it will fade in ${cur.turnsLeft} round${cur.turnsLeft === 1 ? '' : 's'} (a round = every living hunter acted once).` : (en >= cost ? `✅ *${d.name}* is READY — /domain expand (${cost} energy, you have ${en})` : `⏳ *${d.name}* needs ${cost} energy — you have ${en}.`));
      }
    } catch (e2) {}
    // Push #96h-t: inside a battle, /domain is the SHORT battle card only — no lore spiel.
    if (_battle.length) return sock.sendMessage(chatId, { text: [..._battle, `🌌 *${d.name}* · Lv.${d.level} · lasts ${e.turns} round${e.turns === 1 ? '' : 's'} · ⚡ ${DS.costFor(d.level || 1)} energy`, FRAME].join('\n') }, { quoted: msg });
    return sock.sendMessage(chatId, { text: [FRAME, `🌌 *${d.name.toUpperCase()}*`, FRAME, d.desc ? `_${d.desc}_` : `_No description yet — /domain desc <text> (one free change)_`, `👤 ${player.name} · ${d.class} · Domain Lv.${d.level}/${DS.MAX_LEVEL} · power ${DS.power(player)}`, `⏳ ${e.turns} turns · ⚡ ${DS.costFor(d.level || 1)} energy · cast ${d.casts || 0}×`, ...DS.describe(player), ``, next != null ? `📈 Next level: *${next} UP* (you have ${player.upgradePoints || 0}) — /domain upgrade` : `🏆 Max level.`, `⚔️ /domain expand · ✏️ /domain name · /domain desc`, FRAME, ..._battle].join('\n') }, { quoted: msg });
  },
};
