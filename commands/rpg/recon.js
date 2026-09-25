// ═══════════════════════════════════════════════════════════════
// /recon @player — OWNER-ONLY class re-roll (Push #71; owner-only since #87)
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
//   /recon @player <Class>|<quality>   — Push #87: pin class and/or quality (1-100)
//        e.g. /recon @p Mage|95   · /recon @p Mage   · /recon @p |80
//   /recon undo @player       — restore the class exactly as it was before the last /recon
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
  description: '🎭 [OWNER] re-roll a player\'s class (removes exclusive classes like Senku)',
  usage: '/recon @player [<Class>|<quality>] · /recon undo @player',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const FRAME = UI.FREE_BAR;

    // Push #87: OWNER ONLY (like /bleep) — mods can no longer re-roll classes.
    if (!Perms.isBotOwner(db, sender)) {
      return sock.sendMessage(chatId, { text: `❌ *BOT OWNER ONLY.*\n${FRAME}\n/recon is an owner tool.` }, { quoted: msg });
    }

    const ctx = msg.message?.extendedTextMessage?.contextInfo;
    const CS0 = require('../../rpg/utils/ClassSystem');
    const SNAP_KEYS = ['class', 'classBase', 'classQuality', 'classSkills', 'monsterVariant', 'classBonusApplied', 'classPowerV74', 'classAssignedAt', 'classReconAt', 'stats', 'baseStats', 'skills', 'equippedSkills', 'skillLoadout', 'skillLevels', 'weapon', 'equippedWeapon', 'passives'];
    const snapshot = (pl) => { const o = {}; for (const k of SNAP_KEYS) if (pl[k] !== undefined) o[k] = JSON.parse(JSON.stringify(pl[k])); return o; };
    const restore = (pl, snap) => { for (const k of SNAP_KEYS) { if (snap[k] !== undefined) pl[k] = JSON.parse(JSON.stringify(snap[k])); else delete pl[k]; } };

    // ── /recon undo @player ────────────────────────────────────
    if ((args[0] || '').toLowerCase() === 'undo') {
      const f2 = findPlayer(db, args.slice(1), ctx);
      if (!f2) return sock.sendMessage(chatId, { text: `❌ Tag, reply to, or name the player.\nUsage: /recon undo @player` }, { quoted: msg });
      const { jid: j2, player: p2 } = f2;
      const snap = p2._reconUndo;
      if (!snap || !snap.data) return sock.sendMessage(chatId, { text: `ℹ️ No /recon to undo for *${p2.name}*.` }, { quoted: msg, mentions: [j2] });
      const nowName = p2.classBase || (typeof p2.class === 'string' ? p2.class : p2.class?.name) || '—';
      restore(p2, snap.data);
      delete p2._reconUndo;
      try { require('../../rpg/utils/SkillCatalog').syncPlayerSkills(p2); } catch (e) {}
      saveDatabase();
      const back = p2.classBase || (typeof p2.class === 'string' ? p2.class : p2.class?.name) || 'none';
      return sock.sendMessage(chatId, {
        text: [FRAME, `↩️ *RECON UNDONE*`, FRAME, `👤 Hunter: *${p2.name}*`, `🗑️ Reverted: *${nowName}*`, `✅ Restored: *${back}* (${p2.classQuality || 0}%)`, `🕒 From recon at ${new Date(snap.at).toLocaleString('en-GB', { timeZone: 'Africa/Lagos' })}`, ``, `🛡️ By: @${sender.split('@')[0]}`, FRAME].join('\n'),
        mentions: [j2, sender],
      }, { quoted: msg });
    }

    // ── Parse "<Class>|<quality>" customization (last arg containing '|' or a bare class/number) ──
    let pinClass = null, pinQuality = null;
    {
      const spec = args.find(a => a && a.includes('|'));
      let rest = args;
      if (spec) {
        const [c, q] = spec.split('|');
        if (c && c.trim()) pinClass = c.trim();
        if (q && q.trim()) pinQuality = Number(q.trim());
        rest = args.filter(a => a !== spec);
      } else if (args.length > 1 || (args.length === 1 && (ctx?.mentionedJid?.[0] || ctx?.participant))) {
        // "/recon @p Mage" or "/recon @p 95" (target comes from mention/reply)
        const tail = args[args.length - 1];
        if (/^\d{1,3}$/.test(tail)) { pinQuality = Number(tail); rest = args.slice(0, -1); }
        else if (CS0.ALL_CLASSES.some(n => n.toLowerCase() === String(tail).toLowerCase()) && !String(tail).startsWith('@')) { pinClass = tail; rest = args.slice(0, -1); }
      }
      args = rest.filter(a => !a.startsWith('@') || true);
      if (pinQuality != null && !(pinQuality >= 1 && pinQuality <= 100)) {
        return sock.sendMessage(chatId, { text: `❌ Quality must be 1-100.` }, { quoted: msg });
      }
    }

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

    const _skillSnap = (() => { try { return require('../../rpg/utils/SkillCatalog').snapshotSkillProgress(player); } catch (e) { return null; } })();
    const _prevUndo = player._reconUndo; // keep the last GOOD snapshot if this attempt fails
    player._reconUndo = { at: Date.now(), by: sender, data: snapshot(player) };
    // Class-only pin keeps the player's existing quality (only a random roll or an explicit |q changes it).
    const keepQ = (pinClass && pinQuality == null) ? (player.classQuality || null) : null;
    const res = CS.reconClass(player, { className: pinClass || undefined, quality: pinQuality != null ? pinQuality : (keepQ || undefined) });
    if (!res.success) { if (_prevUndo) player._reconUndo = _prevUndo; else delete player._reconUndo; return sock.sendMessage(chatId, { text: `❌ ${res.error}` }, { quoted: msg }); }

    // Rebuild derived skill state so /skills and combat read the new class.
    // Push #88f: skill COUNT + LEVELS carry over (old #1 Lv5 → new #1 Lv5).
    let _carry = null;
    try { const SCr = require('../../rpg/utils/SkillCatalog'); SCr.syncPlayerSkills(player); if (_skillSnap) _carry = SCr.carrySkillProgress(player, _skillSnap); } catch (e) {}
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
        `⭐ Quality: *${res.quality || player.classQuality || 0}%*${pinClass || pinQuality != null ? '  _(custom)_' : ''}`,
        ...(_carry ? [`📚 Skills carried: *${_carry.count}* unlocked · levels preserved (${_skillSnap.levels.filter(l => l > 1).length} upgraded)`] : []),
        `↩️ Undo: */recon undo @${bare(jid)}*`,
        ``,
        `🛡️ By: @${sender.split('@')[0]}`,
        FRAME,
      ].join('\n'),
      mentions: [jid, sender],
    }, { quoted: msg });
  },
};
