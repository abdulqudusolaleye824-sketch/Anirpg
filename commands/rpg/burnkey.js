// ═══════════════════════════════════════════════════════════════
// /burnkey — MOD/OWNER gate-key burner (Push #71)
//
//   /burnkey @player      — burn EVERY live gate key the player owns
//   /burnkey <KEY>        — burn one specific key (8-char code)
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
  usage: '/burnkey @player  |  /burnkey <KEY>',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const FRAME = UI.FREE_BAR;

    if (!Perms.isBotMod(db, sender)) {
      return sock.sendMessage(chatId, { text: `❌ *MODS ONLY.*\n${FRAME}\n/burnkey is a moderation tool.` }, { quoted: msg });
    }

    const ctx = msg.message?.extendedTextMessage?.contextInfo;
    const target = ctx?.mentionedJid?.[0] || ctx?.participant || null;
    const arg = (args[0] || '').trim();

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
