// ═══════════════════════════════════════════════════════════════
// /recon @player — MOD/OWNER class re-roll (Push #71)
//
// Strips the target's current class (its quality-scaled stat bonuses and
// skills included) and rolls a fresh NON-EXCLUSIVE class. Built to take the
// owner-only Senku class off a player who rolled it, but works for any
// class. Level, XP, rank, gold, inventory: untouched.
//
// Usage:
//   /recon @player            — mention / reply
//   /recon 2348012345678      — bare number
//   /recon HunterName         — exact player name
// ═══════════════════════════════════════════════════════════════

'use strict';

const Perms = require('../../utils/permissions');
const UI = require('../../rpg/utils/UI');

function bare(j) { return String(j || '').split('@')[0].split(':')[0].replace(/\D/g, ''); }

function findPlayer(db, args, ctx) {
  const mentioned = ctx?.mentionedJid?.[0];
  const replied = ctx?.participant;
  for (const cand of [mentioned, replied]) {
    if (!cand) continue;
    if (db.users?.[cand]) return { jid: cand, player: db.users[cand] };
    const b = bare(cand);
    for (const [k, u] of Object.entries(db.users || {})) if (bare(k) === b) return { jid: k, player: u };
  }
  const arg = (args[0] || '').trim();
  if (!arg) return null;
  const b = arg.replace(/\D/g, '');
  if (b.length >= 8) {
    for (const [k, u] of Object.entries(db.users || {})) if (bare(k) === b || bare(u?.id) === b) return { jid: k, player: u };
  }
  const q = args.join(' ').trim().toLowerCase();
  for (const [k, u] of Object.entries(db.users || {})) if (u?.name && String(u.name).toLowerCase() === q) return { jid: k, player: u };
  return null;
}

module.exports = {
  name: 'recon',
  aliases: ['reclass', 'rerollclass'],
  description: '🎭 Mods: re-roll a player\'s class (removes exclusive classes like Senku)',
  usage: '/recon @player',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const FRAME = UI.FREE_BAR;

    if (!Perms.isBotMod(db, sender)) {
      return sock.sendMessage(chatId, { text: `❌ *MODS ONLY.*\n${FRAME}\n/recon is a moderation tool.` }, { quoted: msg });
    }

    const ctx = msg.message?.extendedTextMessage?.contextInfo;
    const found = findPlayer(db, args, ctx);
    if (!found) {
      return sock.sendMessage(chatId, { text: `❌ Tag, reply to, or name the player.\nUsage: /recon @player` }, { quoted: msg });
    }
    const { jid, player } = found;

    const CS = require('../../rpg/utils/ClassSystem');
    const oldName = player.classBase || (typeof player.class === 'string' ? player.class : player.class?.name) || null;
    if (!oldName) {
      return sock.sendMessage(chatId, { text: `ℹ️ *${player.name}* has no class yet — nothing to re-roll.` }, { quoted: msg, mentions: [jid] });
    }

    // The owner keeps Senku — never strip an exclusive class from the person it belongs to.
    if (CS.isExclusiveClass(oldName) && CS.hardcodedClassFor(player) === oldName) {
      return sock.sendMessage(chatId, { text: `❌ *${player.name}* is the rightful holder of *${oldName}* — /recon refused.` }, { quoted: msg, mentions: [jid] });
    }

    const res = CS.reconClass(player);
    if (!res.success) return sock.sendMessage(chatId, { text: `❌ ${res.error}` }, { quoted: msg });

    // Rebuild derived skill state so /skills and combat read the new class.
    try { require('../../rpg/utils/SkillCatalog').syncPlayerSkills(player); } catch (e) {}
    saveDatabase();

    const data = CS.CLASS_DATA?.[res.className] || {};
    const shown = player.monsterVariant?.name || res.className;
    return sock.sendMessage(chatId, {
      text: [
        FRAME,
        `🎭 *CLASS RECONSTITUTED*`,
        FRAME,
        `👤 Hunter: *${player.name}*`,
        `🗑️ Removed: *${oldName}*${CS.isExclusiveClass(oldName) ? ' _(exclusive — not rollable)_' : ''}`,
        `✨ New class: *${data.emoji || '🎭'} ${shown}* (${(data.rarity || 'common').toUpperCase()})`,
        `⭐ Quality: *${res.quality || player.classQuality || 0}%*`,
        ``,
        `🛡️ By: @${sender.split('@')[0]}`,
        FRAME,
      ].join('\n'),
      mentions: [jid, sender],
    }, { quoted: msg });
  },
};
