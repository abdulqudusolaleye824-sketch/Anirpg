// ═══════════════════════════════════════════════════════════════
// /domain — Push #95: Domain Expansion
//   /domain                  → your domain card
//   /domain expand           → expand it in your current raid / dungeon / instance / PvP (350 energy)
//   /domain upgrade [n]      → spend UP (10 → Lv.2, 15 → Lv.3, +5 per level, max Lv.100)
//   /domain name <name>      → rename your domain (Rename Card, owner-approved)
//   /domain desc <text>      → change its description (owner-approved) · owner: /domain approve|reject <id> · /domain pending
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
    // Push #102g (BUG-054): /domain effects works BEFORE the domain awakens — it exists to show what your class can get.
    if (sub === 'effects' || sub === 'list') {
      const d0 = player.domain || {};
      const cls = d0.class || (() => { try { return require('../../rpg/utils/ClassPower').baseClassName(player); } catch (e) { return null; } })() || player.class || 'Hunter';
      const names = DS.CLASS_DOMAINS[cls] || [];
      if (!names.length) return sock.sendMessage(chatId, { text: [FRAME, `🌌 *DOMAIN EFFECTS*`, FRAME, player.class ? `No domain table for *${cls}* yet.` : `Awaken a class first — your domain effects depend on your class.`].join('\n') }, { quoted: msg });
      const lines = names.map((n, i) => {
        const a = DS.ARCHETYPES[i];
        const f = (o, w) => Object.entries(o).filter(([, v]) => v).map(([s, v]) => `${w}${DS.STAT_LABEL[s] || s} ${v > 0 ? '+' : ''}${v}%`).join(', ');
        return `${DS.has(player) && i === d0.idx ? '✨' : '•'} *${n}* — ${f(a.ally, '')}${Object.keys(a.enemy).length ? ' | foes: ' + f(a.enemy, '') : ''}`;
      });
      const foot = DS.has(player) ? `✨ = yours. Values grow +2% per Domain level.` : `One of these awakens at *Lv.20* — chosen by fate, yours forever. You are Lv.${player.level || 1}.`;
      return sock.sendMessage(chatId, { text: [FRAME, `🌌 *${cls.toUpperCase()} DOMAINS* (Lv.1 values)`, FRAME, ...lines, FRAME, foot].join('\n') }, { quoted: msg });
    }

    if (!DS.has(player)) {
      return sock.sendMessage(chatId, { text: [FRAME, `🌌 *DOMAIN — SEALED*`, FRAME, `Every hunter's domain awakens at *Lv.20* — one of the 10 domain effects of your class, chosen by fate, yours forever.`, `You are Lv.${player.level || 1}.`, `📖 /domain effects — see what your class can awaken`].join('\n') }, { quoted: msg });
    }
    const d = player.domain;

    const DA = require('../../rpg/utils/DomainApprovals');
    if (sub === 'rename' || sub === 'name') {
      const name = args.slice(1).join(' ').trim();
      if (!name) return sock.sendMessage(chatId, { text: `✏️ Usage: /domain name <new name> — costs 1 🃏 Rename Card (you have ${player.cards?.namechange || 0}) and needs owner approval.` }, { quoted: msg });
      const r = DS.rename(player, name);
      if (!r.ok) return sock.sendMessage(chatId, { text: `❌ ${r.error}` }, { quoted: msg });
      const sub2 = DA.submit(db, sender, player, { name: r.name }, 'rename');
      if (!sub2.ok) { player.cards.namechange += 1; return sock.sendMessage(chatId, { text: `❌ ${sub2.error}` }, { quoted: msg }); }
      sub2.rec.refundCard = true; saveDatabase();
      DA.notifyOwners(sock, db, sub2.rec).catch(() => {});
      return sock.sendMessage(chatId, { text: `📨 *${r.old}* → *${r.name}* sent for owner approval (${sub2.rec.id}) · 🃏 1 Rename Card used (${r.left} left, refunded if rejected). You'll be told the verdict in your DM.` }, { quoted: msg });
    }
    if (sub === 'desc' || sub === 'description') {
      // Push #103a (BUG-100): /domain desc <text> any time — every change goes to the owners for approval.
      const txt = args.slice(1).join(' ').replace(/[*_~`]/g, '').replace(/\s+/g, ' ').trim();
      if (txt) {
        const sub2 = DA.submit(db, sender, player, { desc: txt }, 'desc');
        if (!sub2.ok) return sock.sendMessage(chatId, { text: `❌ ${sub2.error}` }, { quoted: msg });
        saveDatabase(); DA.notifyOwners(sock, db, sub2.rec).catch(() => {});
        return sock.sendMessage(chatId, { text: `📨 New description for *${d.name}* sent for owner approval (${sub2.rec.id}). Until then it keeps: _${d.desc || '—'}_` }, { quoted: msg });
      }
      const pend = DA.pendingFor(db, sender);
      return sock.sendMessage(chatId, { text: (d.desc ? `📜 *${d.name}* — _${d.desc}_` : `📜 *${d.name}* has no description yet.`) + `\n✏️ Change it: /domain desc <text> (owner-approved).` + (pend ? `\n⏳ Pending approval: ${pend.id}` : '') + (DS.setupStep(player) ? `\n📨 Your DM has the naming prompt waiting.` : '') }, { quoted: msg });
    }
    if (sub === 'approve' || sub === 'reject' || sub === 'pending') {
      let owner = false; try { owner = require('../../utils/permissions').isBotOwner(db, sender); } catch (e) {}
      if (!owner) return sock.sendMessage(chatId, { text: '❌ Owner only.' }, { quoted: msg });
      if (sub === 'pending') { const L = DA.listPending(db); return sock.sendMessage(chatId, { text: L.length ? L.map(DA.card).join('\n\n') : '✅ No domain approvals pending.' }, { quoted: msg }); }
      const id = String(args[1] || '').toUpperCase(); const reason = args.slice(2).join(' ');
      const r = DA.decide(db, id, sub === 'approve', sender, reason);
      if (!r.ok) return sock.sendMessage(chatId, { text: `❌ ${r.error}` }, { quoted: msg });
      if (sub === 'reject' && r.rec.refundCard && r.player) { if (!r.player.cards) r.player.cards = {}; r.player.cards.namechange = (Number(r.player.cards.namechange) || 0) + 1; }
      saveDatabase(); DA.notifyPlayer(sock, db, r.rec).catch(() => {});
      return sock.sendMessage(chatId, { text: `${sub === 'approve' ? '✅ Approved' : '❌ Rejected'} ${r.rec.id} — *${r.rec.player}*${r.rec.name != null ? ` · name *${r.rec.name}*` : ''}${r.rec.desc != null ? ' · description' : ''}${r.rec.refundCard && sub === 'reject' ? ' · 🃏 card refunded' : ''}` }, { quoted: msg });
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
      // Push #103b: PvP — the FIRST caster gathers for 10 s so the rival may open theirs; once both have fired,
      // the clash resolves at once (the second caster skips the wait).
      if (battle.kind === 'pvp' && !DS.active(battle.arena)) {
        const opp = battle.enemies[0]; const now = Date.now();
        if (battle.arena._gatherUntil && battle.arena._gatherUntil > now && battle.arena._gatherBy !== sender) {
          battle.arena._gatherUntil = 0; // rival answered — both domains fire now
        } else if (opp && DS.has(opp) && (opp.stats?.hp || 0) > 0) {
          battle.arena._gatherUntil = now + DS.DOMAIN_WARN_MS; battle.arena._gatherBy = sender;
          await sock.sendMessage(chatId, { text: `⚠️ *${player.name} GATHERS THEIR DOMAIN!*\n⏳ *${opp.name}*, you have *10 seconds* to answer with */domain expand* — then the field is claimed.` }).catch(() => {});
          const _t0 = Date.now(); while (Date.now() - _t0 < DS.DOMAIN_WARN_MS && battle.arena._gatherUntil) await new Promise(r => setTimeout(r, 500));
          battle.arena._gatherUntil = 0;
          if ((player.stats?.hp || 0) <= 0 || !player.pvpBattle) return sock.sendMessage(chatId, { text: `🌫️ *${player.name}*'s domain never unfolded.` }).catch(() => {});
        }
      }
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
    return sock.sendMessage(chatId, { text: [FRAME, `🌌 *${d.name.toUpperCase()}*`, FRAME, d.desc ? `_${d.desc}_` : `_No description yet — /domain desc <text> (owner-approved)_`, `👤 ${player.name} · ${d.class} · Domain Lv.${d.level}/${DS.MAX_LEVEL} · power ${DS.power(player)}`, `⏳ ${e.turns} turns · ⚡ ${DS.costFor(d.level || 1)} energy · cast ${d.casts || 0}×`, ...DS.describe(player), ``, next != null ? `📈 Next level: *${next} UP* (you have ${player.upgradePoints || 0}) — /domain upgrade` : `🏆 Max level.`, `⚔️ /domain expand · ✏️ /domain name · /domain desc`, FRAME, ..._battle].join('\n') }, { quoted: msg });
  },
};
