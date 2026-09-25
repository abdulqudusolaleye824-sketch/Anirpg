// ═══════════════════════════════════════════════════════════════
// /burnkey — MOD/OWNER gate-key burner (Push #71)
//
//   /burnkey @player      — burn EVERY live gate key the player owns
//   /burnkey <KEY>        — burn one specific key (8-char code)
//   /burnkey restore <KEY> | @player — Push #88g: undo a burn (key comes back live)
//
// Burning = the key is marked used/expired, removed from the live map, the
// dungeon GC it held is freed, and its gate record is dropped. /reset now
// does this automatically for the wiped player; this is the manual tool.
// ═══════════════════════════════════════════════════════════════

'use strict';

const Perms = require('../../utils/permissions');
const UI = require('../../rpg/utils/UI');
const GKM = require('../../rpg/dungeons/GateKeyManager');

function bare(j) { return String(j || '').split('@')[0].split(':')[0].replace(/\D/g, ''); }

module.exports = {
  name: 'burnkey',
  aliases: ['burnkeys', 'killkey'],
  description: '🔥 Mods: burn a player\'s gate keys (or one key by code)',
  usage: '/burnkey @player  |  /burnkey <KEY>  |  /burnkey restore <KEY|@player>',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const FRAME = UI.FREE_BAR;

    if (!Perms.isBotMod(db, sender)) {
      return sock.sendMessage(chatId, { text: `❌ *MODS ONLY.*\n${FRAME}\n/burnkey is a moderation tool.` }, { quoted: msg });
    }

    const ctx = msg.message?.extendedTextMessage?.contextInfo;
    const target = ctx?.mentionedJid?.[0] || ctx?.participant || null;
    let arg = (args[0] || '').trim();

    // ── Push #88g: /burnkey restore <KEY> | @player ──────────────
    if (/^(restore|unburn|revive)$/i.test(arg)) {
      const rest = args.slice(1);
      const code = (rest[0] || '').trim().toUpperCase();
      const fmt = ms => { const m = Math.round(ms / 60000); return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`; };
      if (/^[A-Z0-9]{8}$/.test(code)) {
        const r = GKM.restoreKey(code, db, { by: sender });
        if (!r.ok) return sock.sendMessage(chatId, { text: `❌ ${r.error}` }, { quoted: msg });
        saveDatabase();
        return sock.sendMessage(chatId, {
          text: [FRAME, `♻️ *GATE KEY RESTORED*`, FRAME, `🔑 Key: \`${r.key}\` (${r.rank || '?'}-Rank)`, `👤 Owner: @${bare(r.ownedBy) || '?'}`, `⏳ Stability: ${fmt(r.remainingMs)} left`, r.gateRestored ? `🌀 Gate record restored` : `🌀 Gate record: n/a`, `🛡️ By: @${sender.split('@')[0]}`, FRAME].join('\n'),
          mentions: [r.ownedBy, sender].filter(Boolean),
        }, { quoted: msg });
      }
      // Player form: restore every burnt key still restorable, or list them.
      let pj = target;
      if (!pj && rest[0]) {
        const b = rest[0].replace(/\D/g, '');
        if (b.length >= 8) pj = `${b}@s.whatsapp.net`;
        else { const q = rest.join(' ').trim().toLowerCase(); for (const [k, u] of Object.entries(db.users || {})) if (u?.name && String(u.name).toLowerCase() === q) { pj = k; break; } }
      }
      if (!pj) return sock.sendMessage(chatId, { text: `❌ Usage: /burnkey restore <KEY>  |  /burnkey restore @player` }, { quoted: msg });
      const burnt = GKM.burntKeysOf(pj, db);
      const pname = db.users?.[pj]?.name || `@${bare(pj)}`;
      if (!burnt.length) return sock.sendMessage(chatId, { text: `ℹ️ *${pname}* has no burnt gate keys on record.` }, { quoted: msg, mentions: [pj] });
      const done = [], failed = [];
      for (const b of burnt) { const r = GKM.restoreKey(b.key, db, { by: sender }); if (r.ok) done.push(r); else failed.push({ key: b.key, error: r.error }); }
      saveDatabase();
      return sock.sendMessage(chatId, {
        text: [
          FRAME, `♻️ *GATE KEYS RESTORED*`, FRAME, `👤 Hunter: *${pname}*`,
          ...(done.length ? [`🔑 Restored (${done.length}):`, ...done.map(r => `  • \`${r.key}\` — ${r.rank || '?'}-Rank · ${fmt(r.remainingMs)} left`)] : [`🔑 Restored: none`]),
          ...(failed.length ? [``, `⚠️ Skipped (${failed.length}):`, ...failed.map(f => `  • \`${f.key}\` — raid already completed`)] : []),
          ``, `🛡️ By: @${sender.split('@')[0]}`, FRAME,
        ].join('\n'),
        mentions: [pj, sender],
      }, { quoted: msg });
    }

    // ── Single key by code ───────────────────────────────────────
    if (!target && /^[A-Z0-9]{8}$/i.test(arg)) {
      const code = arg.toUpperCase();
      const k = GKM.activeKeys[code] || db.gateKeys?.[code];
      if (!k) return sock.sendMessage(chatId, { text: `❌ No gate key \`${code}\` on record.` }, { quoted: msg });
      const burned = GKM.burnKeysOf(k.ownedBy, db, { by: sender, includeDead: true }).filter(b => b.key === code);
      if (!burned.length) {
        // Owner mismatch shouldn't happen; force-burn the single record.
        k.expired = true; k.used = true; k.raidComplete = true; k.burnedAt = Date.now(); k.burnedBy = sender;
        if (db.gateKeys?.[code]) Object.assign(db.gateKeys[code], { expired: true, used: true, raidComplete: true });
        delete GKM.activeKeys[code];
      }
      saveDatabase();
      return sock.sendMessage(chatId, {
        text: [FRAME, `🔥 *GATE KEY BURNT*`, FRAME, `🔑 Key: \`${code}\` (${k.gateRank || '?'}-Rank)`, `👤 Owner: @${bare(k.ownedBy) || '?'}`, `🛡️ By: @${sender.split('@')[0]}`, FRAME].join('\n'),
        mentions: [k.ownedBy, sender].filter(Boolean),
      }, { quoted: msg });
    }

    // ── All keys of a player ─────────────────────────────────────
    let jid = target;
    if (!jid && arg) {
      const b = arg.replace(/\D/g, '');
      if (b.length >= 8) jid = `${b}@s.whatsapp.net`;
      else {
        const q = args.join(' ').trim().toLowerCase();
        for (const [k, u] of Object.entries(db.users || {})) if (u?.name && String(u.name).toLowerCase() === q) { jid = k; break; }
      }
    }
    if (!jid) {
      return sock.sendMessage(chatId, { text: `❌ Tag/reply to a player, or give a key code.\nUsage: /burnkey @player  |  /burnkey <KEY>` }, { quoted: msg });
    }

    const burned = GKM.burnKeysOf(jid, db, { by: sender });
    saveDatabase();
    const name = db.users?.[jid]?.name || `@${bare(jid)}`;
    if (!burned.length) {
      return sock.sendMessage(chatId, { text: `ℹ️ *${name}* holds no live gate keys — nothing to burn.` }, { quoted: msg, mentions: [jid] });
    }
    return sock.sendMessage(chatId, {
      text: [
        FRAME,
        `🔥 *GATE KEYS BURNT*`,
        FRAME,
        `👤 Hunter: *${name}*`,
        `🔑 Burnt (${burned.length}):`,
        ...burned.map(b => `  • \`${b.key}\` — ${b.rank || '?'}-Rank`),
        ``,
        `🛡️ By: @${sender.split('@')[0]}`,
        FRAME,
      ].join('\n'),
      mentions: [jid, sender],
    }, { quoted: msg });
  },
};
