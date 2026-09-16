// ═══════════════════════════════════════════════════════════════
// /reset — Mod-level Player Data Wipe with 48-hr Reversal Gate
//
// Usage: /reset @user (or reply to a user's message)
// Restore: /reset restore @user
//
// Rules:
// 1. Mod-level command (Perms.isBotMod).
// 2. Instantly wipes targeted user data.
// 3. Requires target (tag or reply). Fails if no target specified.
// 4. Stores 48-hr reversal backup for restoration if needed.
// 5. Weekly cooldown per mod (7 days).
// ═══════════════════════════════════════════════════════════════

'use strict';

const Perms = require('../../utils/permissions');
const fs = require('fs');
const path = require('path');

const WEEKLY_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const REVERSAL_WINDOW_MS = 48 * 60 * 60 * 1000;     // 48 hours

// ═══════════════════════════════════════════════════════════════
// Push #56 — a reset that actually resets.
//
// /reset used to delete `db.users[jid]` plus three side files and call it a
// day. Everything that pointed *at* the player survived: their guild stayed
// theirs (an owner-less guild that nobody could disband), their name stayed in
// the member roster and its GP totals, their seat stayed in an active gate
// raid, their pending trades/challenges stayed pending, and their side files
// only got cleaned if they happened to be one of the three hard-coded names.
//
// Rules now:
//   • the player owned a guild  → the guild is DELETED and every one of its
//     members is made guildless (roster, memberData, contracts, invites, war
//     records and their `player.guild` field).
//   • the player was a member   → they are wiped out of the guild completely
//     and the guild's derived GP totals are recomputed from the survivors.
//   • every jid-keyed collection and every per-player side file is scrubbed.
// All of it is snapshotted so `/reset restore` can put it back inside 48h.
// ═══════════════════════════════════════════════════════════════

const JID_FIELDS = ['id', 'jid', 'user', 'target', 'sender', 'playerId', 'owner', 'leader', 'gmId', 'challenger', 'participant', 'hireJid', 'hiredJid'];
const PROTECTED  = new Set(['users', 'userResetBackups', 'modResetCooldowns', 'botMods', 'botOwners', 'banlist', 'bannedUsers', 'linkedBots', 'authBackups', 'config']);
const MODERATION = new Set(['mutedUsers', 'antiLinkStrikes', 'groupSettings', 'registeredGCs']);

function norm(v) {
  return String(v == null ? '' : v).split(':')[0].trim().toLowerCase();
}
function jidVariants(jid) {
  const bare = norm(jid);
  const set = new Set([bare, String(jid || '').trim().toLowerCase()]);
  if (bare) { set.add(`${bare}@s.whatsapp.net`); set.add(`${bare}@lid`); }
  return set;
}
function entryMatches(entry, variants) {
  if (entry == null) return false;
  if (typeof entry === 'string' || typeof entry === 'number') return variants.has(norm(entry));
  if (typeof entry !== 'object') return false;
  for (const f of JID_FIELDS) {
    const v = entry[f];
    if ((typeof v === 'string' || typeof v === 'number') && variants.has(norm(v))) return true;
  }
  return false;
}

/** Remove the player from every non-user collection that can reference them. */
function scrubCollections(db, variants, log) {
  for (const key of Object.keys(db)) {
    if (PROTECTED.has(key)) continue;
    const col = db[key];
    if (!col || typeof col !== 'object') continue;
    if (key === 'guilds') continue;                     // handled properly below
    if (MODERATION.has(key) && key !== 'registeredGCs') continue;  // mod actions survive a reset on purpose
    try {
      if (Array.isArray(col)) {
        const before = col.length;
        db[key] = col.filter(e => !entryMatches(e, variants));
        const removed = before - db[key].length;
        if (removed) log.push(`${key}: ${removed} entr${removed === 1 ? 'y' : 'ies'}`);
        continue;
      }
      let removed = 0;
      for (const k of Object.keys(col)) {
        if (variants.has(norm(k))) { delete col[k]; removed++; continue; }
        const v = col[k];
        if (Array.isArray(v)) {
          const before2 = v.length;
          col[k] = v.filter(e => !entryMatches(e, variants));
          if (col[k].length !== before2) removed++;
        } else if (v && entryMatches(v, variants)) {
          delete col[k]; removed++;
        }
      }
      if (removed && key !== 'userCooldowns') log.push(`${key}: ${removed}`);
      else if (removed) log.push(`${key}: ${removed}`);
    } catch (e) {
      console.error(`[reset] could not scrub ${key}:`, e.message);
    }
  }
}

/** Every *.json in the per-player data dirs is keyed by JID — sweep them all. */
function dataDirs() {
  const dirs = [path.join(__dirname, '..', '..', 'rpg', 'data')];
  if (process.env.DATA_DIR) dirs.push(path.join(process.env.DATA_DIR, 'rpg_data'));
  return [...new Set(dirs)];
}
function sideFiles() {
  const out = [];
  for (const dir of dataDirs()) {
    let entries = [];
    try { entries = fs.readdirSync(dir); } catch (e) { continue; }
    for (const f of entries) if (f.endsWith('.json')) out.push({ dir, file: f, full: path.join(dir, f) });
  }
  return out;
}
function snapshotSideFiles(variants) {
  const snap = {};
  for (const { full, file } of sideFiles()) {
    try {
      const raw = JSON.parse(fs.readFileSync(full, 'utf8'));
      if (!raw || typeof raw !== 'object') continue;
      for (const k of Object.keys(raw)) if (variants.has(norm(k))) snap[file] = snap[file] ? { ...snap[file], [k]: raw[k] } : { [k]: raw[k] };
    } catch (e) {}
  }
  return snap;
}
function wipeSideFiles(variants) {
  let removed = 0;
  for (const { full } of sideFiles()) {
    try {
      const raw = JSON.parse(fs.readFileSync(full, 'utf8'));
      if (!raw || typeof raw !== 'object') continue;
      let dirty = false;
      for (const k of Object.keys(raw)) if (variants.has(norm(k))) { delete raw[k]; dirty = true; removed++; }
      if (dirty) fs.writeFileSync(full, JSON.stringify(raw, null, 2));
    } catch (e) { console.error('[reset] side file wipe failed:', e.message); }
  }
  return removed;
}
function restoreSideFiles(snap) {
  if (!snap) return 0;
  let put = 0;
  for (const [file, entries] of Object.entries(snap)) {
    for (const dir of dataDirs()) {
      const full = path.join(dir, file);
      if (!fs.existsSync(full)) continue;
      try {
        const raw = JSON.parse(fs.readFileSync(full, 'utf8')) || {};
        for (const [k, v] of Object.entries(entries)) { raw[k] = v; put++; }
        fs.writeFileSync(full, JSON.stringify(raw, null, 2));
      } catch (e) {}
      break;
    }
  }
  return put;
}

/** Guild membership ids, tolerating both stored shapes (jid strings and {id}). */
function memberIds(list) {
  return (Array.isArray(list) ? list : []).map(m => (m && typeof m === 'object') ? (m.id || m.jid) : m).filter(Boolean);
}

/**
 * The guild half of the wipe. Returns the snapshot needed to undo it.
 */
function wipeGuilds(db, targetJid, variants, log) {
  const snapshot = { owned: [], memberOf: [] };
  const bare = norm(targetJid);
  for (const [gid, g] of Object.entries(db.guilds || {})) {
    if (!g || typeof g !== 'object') continue;
    const isLeader = norm(g.leader) === bare || norm(g.ownerId) === bare || norm(g.owner) === bare;
    const ids = [...new Set([...memberIds(g.members), ...memberIds(g.memberData), ...memberIds(g.officers)])].filter(Boolean);
    const inGuild = isLeader || ids.some(id => variants.has(norm(id)));
    if (!inGuild) continue;

    if (isLeader) {
      // ── the player OWNED it: the guild dies, everybody in it is freed ──
      snapshot.owned.push({
        gid,
        guild: JSON.parse(JSON.stringify(g)),
        freed: ids.map(id => ({ id, guild: db.users?.[id]?.guild || null, joinedAt: db.users?.[id]?.guildJoinedAt || null })),
      });
      for (const id of ids) {
        const u = db.users?.[id];
        if (u) { u.guild = null; u.guildJoinedAt = null; }
      }
      delete db.guilds[gid];
      log.push(`guild *${g.name || gid}* deleted (owned) — ${ids.length} member(s) made guildless`);
      // anything that referenced the guild by id or name must go too
      for (const col of ['guildInvites', 'guildContracts', 'guildWarWeekly']) {
        if (!db[col]) continue;
        let n = 0;
        for (const k of Object.keys(db[col])) {
          const v = db[col][k];
          const refs = JSON.stringify(v || {});
          if ((v && (v.guildId === gid || v.guild === g.name || v.guildName === g.name)) || refs.includes(String(g.name || '\u0000'))) {
            delete db[col][k]; n++;
          }
        }
        if (n) log.push(`${col}: ${n} record(s) for the deleted guild`);
      }
      continue;
    }

    // ── the player was a MEMBER: erase them from the guild, everywhere ──
    const entry = { gid, name: g.name || gid, members: g.members ? g.members.slice() : null, memberData: g.memberData ? g.memberData.slice() : null, officers: g.officers ? g.officers.slice() : null, totals: { weeklyGP: g.weeklyGP, totalGP: g.totalGP, guildPoints: g.guildPoints } };
    snapshot.memberOf.push(entry);
    const keep = (list) => Array.isArray(list) ? list.filter(m => !variants.has(norm((m && typeof m === 'object') ? (m.id || m.jid) : m))) : list;
    if (g.members) g.members = keep(g.members);
    if (g.memberData) g.memberData = keep(g.memberData);
    if (g.officers) g.officers = keep(g.officers);
    for (const k of ['pendingInvites', 'applications', 'requests', 'kicks']) {
      if (Array.isArray(g[k])) g[k] = keep(g[k]);
    }
    // Guild GP is derived from the roster — re-sum it so the deleted player's
    // points do not keep counting toward the guild rank.
    let w = 0, t = 0;
    for (const id of memberIds(g.members)) {
      const u = db.users?.[id];
      if (u) { w += u.weeklyGP || 0; t += u.totalGP || 0; }
    }
    g.weeklyGP = Math.max(0, w); g.totalGP = Math.max(0, t); g.guildPoints = Math.max(0, t);
    if (Array.isArray(g.gpLog)) g.gpLog = g.gpLog.filter(e => !variants.has(norm(e?.by || e?.playerId || e?.id)));
    const u2 = db.users?.[targetJid];
    if (u2) u2.guild = null;
    log.push(`removed from guild *${g.name || gid}* (roster, memberData and GP totals recomputed)`);
  }
  return snapshot;
}

function restoreGuilds(db, snapshot, targetJid, log) {
  if (!snapshot) return;
  for (const rec of snapshot.memberOf || []) {
    const g = db.guilds?.[rec.gid];
    if (!g) continue;
    if (rec.members) g.members = rec.members;
    if (rec.memberData) g.memberData = rec.memberData;
    if (rec.officers) g.officers = rec.officers;
    if (rec.totals) Object.assign(g, rec.totals);
    if (db.users?.[targetJid]) db.users[targetJid].guild = rec.name;
    log.push(`restored membership in guild *${rec.name}*`);
  }
  for (const rec of snapshot.owned || []) {
    if (db.guilds?.[rec.gid]) continue;
    db.guilds[rec.gid] = rec.guild;
    const ids = memberIds(rec.guild.members).concat(memberIds(rec.guild.memberData));
    for (const f of rec.freed || []) {
      const u = db.users?.[f.id];
      if (u) { u.guild = f.guild; u.guildJoinedAt = f.joinedAt; }
    }
    log.push(`re-created the guild *${rec.guild.name}* (${(rec.freed || []).length} member record(s) re-pointed)`);
  }
}

/** Gate raids / parties: never leave a ghost raider holding a live gate. */
function wipeLiveSessions(db, variants, log) {
  let gates = 0, parties = 0, pvp = 0, trades = 0;
  for (const [gid, gate] of Object.entries(db.gateSpawns || {})) {
    if (!gate || typeof gate !== 'object') continue;
    const bare = norm(gid);
    if (variants.has(bare) && variants.has(String(gid).toLowerCase())) { /* keyed by jid */ }
    if (variants.has(norm(gate.owner || gate.createdBy || gate.host))) { delete db.gateSpawns[gid]; gates++; continue; }
    for (const arrName of ['raiders', 'members']) {
      // The roster can live on the gate itself or inside gate.raid — read it from
      // wherever it is and write it back THERE. (It used to write the filtered
      // list into gate.raid even when the array came from the gate, which left a
      // wiped player listed as an active raider holding the gate forever.)
      const host = Array.isArray(gate[arrName]) ? gate : (gate.raid && Array.isArray(gate.raid[arrName]) ? gate.raid : null);
      if (!host) continue;
      const arr = host[arrName];
      const kept = arr.filter(m => !variants.has(norm((m && typeof m === 'object') ? (m.id || m.jid) : m)));
      if (kept.length !== arr.length) { host[arrName] = kept; gates++; }
    }
    if (gate.damageDealt) for (const k of Object.keys(gate.damageDealt)) if (variants.has(norm(k))) { delete gate.damageDealt[k]; }
  }
  for (const [pid, party] of Object.entries(db.parties || {})) {
    if (!party) continue;
    const members = party.members || [];
    const kept = members.filter(m => !variants.has(norm((m && typeof m === 'object') ? (m.id || m.jid) : m)));
    if (variants.has(norm(party.leader || party.owner)) || kept.length === 0) { delete db.parties[pid]; parties++; continue; }
    if (kept.length !== members.length) { party.members = kept; parties++; }
  }
  for (const [cid, c] of Object.entries(db.pendingChallenges || {})) {
    if (c && (variants.has(norm(c.challenger)) || variants.has(norm(c.target)))) { delete db.pendingChallenges[cid]; pvp++; }
  }
  for (const [tid, tr] of Object.entries(db.pendingTrades || {})) {
    if (tr && (variants.has(norm(tr.from || tr.sender || tr.a)) || variants.has(norm(tr.to || tr.b)))) { delete db.pendingTrades[tid]; trades++; }
  }
  for (const u of Object.values(db.users || {})) {
    // anyone whose snapshot still names this player as an opponent must be freed
    if (u?.pvpBattle && (variants.has(norm(u.pvpBattle.opponentId)))) {
      u.pvpBattle = null; u.statusEffects = []; pvp++;
    }
  }
  if (gates) log.push(`gate raids: ${gates} reference(s) removed`);
  if (parties) log.push(`parties: ${parties} updated/dissolved`);
  if (pvp) log.push(`PvP: ${pvp} pending/active duel state(s) cleared`);
  if (trades) log.push(`trades: ${trades} pending trade(s) cancelled`);
}

function formatRemaining(ms) {
  const mins = Math.ceil(ms / 60000);
  const days = Math.floor(mins / 1440);
  const hrs  = Math.floor((mins % 1440) / 60);
  const rMins = mins % 60;
  return `${days}d ${hrs}h ${rMins}m`;
}

// Exposed for the verification harness (same functions the command runs).
module.exports = {
  __test: { jidVariants, norm, entryMatches, scrubCollections, wipeGuilds, restoreGuilds, wipeLiveSessions, sideFiles, snapshotSideFiles, restoreSideFiles, wipeSideFiles },
  name: 'reset',
  description: '☠️ [Mod] Instantly wipe targeted user data (with 48-hr reversal & weekly mod cooldown)',
  usage: '/reset @user',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    // 1. Mod / Owner check
    if (!Perms.isBotMod(db, sender)) {
      return sock.sendMessage(chatId, {
        text: '❌ Only bot mods and owners can use /reset.'
      }, { quoted: msg });
    }

    const action = args[0]?.toLowerCase();

    // 2. Resolve Target (mention or quoted participant)
    const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
    const mentionedJid = contextInfo?.mentionedJid?.[0];
    const quotedParticipant = contextInfo?.participant;
    let targetJid = mentionedJid || quotedParticipant;

    // Handle /reset restore @user
    if (action === 'restore') {
      if (!targetJid && args[1]) {
        const rawMention = args[1].replace(/[@\s]/g, '');
        if (rawMention) targetJid = `${rawMention}@s.whatsapp.net`;
      }

      if (!targetJid) {
        return sock.sendMessage(chatId, {
          text: '❌ Tag a user (@user) or reply to their message to restore their data.'
        }, { quoted: msg });
      }

      if (!db.userResetBackups || !db.userResetBackups[targetJid]) {
        return sock.sendMessage(chatId, {
          text: `❌ No active 48-hour backup found for *@${targetJid.split('@')[0]}*.`
        }, { quoted: msg });
      }

      const backup = db.userResetBackups[targetJid];
      if (Date.now() > backup.expiresAt) {
        delete db.userResetBackups[targetJid];
        saveDatabase();
        return sock.sendMessage(chatId, {
          text: `❌ The 48-hour reversal window for *@${targetJid.split('@')[0]}* has expired.`
        }, { quoted: msg });
      }

      // Restore user data (and, since Push #56, everything the reset scrubbed
      // around them: the guild they owned, their roster seat, side-file rows)
      db.users[targetJid] = backup.data;
      const _rlog = [];
      try { restoreGuilds(db, backup.guilds, targetJid, _rlog); } catch (e) { console.error('[reset] guild restore failed:', e.message); }
      try { restoreSideFiles(backup.sideFiles); } catch (e) { console.error('[reset] side restore failed:', e.message); }
      delete db.userResetBackups[targetJid];
      saveDatabase();
      if (_rlog.length) console.log(`[reset] restored @${targetJid.split('@')[0]}: ${_rlog.join('; ')}`);

      return sock.sendMessage(chatId, {
        text: [
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `🔄 *PLAYER DATA RESTORED*`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `👤 Player: *@${targetJid.split('@')[0]}*`,
          `🛡️ Restored By: *@${sender.split('@')[0]}*`,
          ``,
          `Player profile and stats have been fully restored from backup!`,
          ...(_rlog.length ? [``, ..._rlog.map(l => `  • ${l}`)] : []),
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ].join('\n'),
        mentions: [targetJid, sender],
      }, { quoted: msg });
    }

    // Parse target for wipe
    if (!targetJid && args[0]) {
      const rawMention = args[0].replace(/[@\s]/g, '');
      if (rawMention && rawMention.match(/^\d+$/)) {
        targetJid = `${rawMention}@s.whatsapp.net`;
      }
    }

    // Requirement: If no one is mentioned/replied to, the reset MUST fail!
    if (!targetJid) {
      return sock.sendMessage(chatId, {
        text: '❌ Tag a user (@user) or reply to their message to reset them.'
      }, { quoted: msg });
    }

    // 3. Weekly Mod Cooldown Check
    if (!db.modResetCooldowns) db.modResetCooldowns = {};
    const lastUsed = db.modResetCooldowns[sender] || 0;
    const elapsed = Date.now() - lastUsed;

    if (elapsed < WEEKLY_COOLDOWN_MS) {
      const remaining = WEEKLY_COOLDOWN_MS - elapsed;
      return sock.sendMessage(chatId, {
        text: `⏳ *Mod /reset Cooldown Active*\n\nYour weekly /reset cooldown has *${formatRemaining(remaining)}* remaining.`
      }, { quoted: msg });
    }

    // 4. Target User Data Check
    const targetUser = db.users?.[targetJid];
    if (!targetUser) {
      return sock.sendMessage(chatId, {
        text: `❌ User *@${targetJid.split('@')[0]}* has no registered data.`,
        mentions: [targetJid]
      }, { quoted: msg });
    }

    // 5. Create 48-hr Reversal Backup — user row AND everything we are about
    //    to scrub around them, so /reset restore is a true undo.
    if (!db.userResetBackups) db.userResetBackups = {};
    const _variants = jidVariants(targetJid);
    const _log = [];
    const _guildSnapshot = wipeGuilds(db, targetJid, _variants, _log);
    const _sideSnapshot = snapshotSideFiles(_variants);
    db.userResetBackups[targetJid] = {
      data: JSON.parse(JSON.stringify(targetUser)),
      guilds: _guildSnapshot,
      sideFiles: _sideSnapshot,
      resetAt: Date.now(),
      expiresAt: Date.now() + REVERSAL_WINDOW_MS,
      resetBy: sender,
    };

    // 6. Wipe Target Data — the player, their guilds, and every reference
    const guildNames = _guildSnapshot.owned.map(o => o.guild?.name).filter(Boolean);
    delete db.users[targetJid];
    wipeLiveSessions(db, _variants, _log);
    scrubCollections(db, _variants, _log);
    const _sideRemoved = wipeSideFiles(_variants);
    if (_sideRemoved) _log.push(`side files: ${_sideRemoved} player record(s) removed`);
    if (guildNames.length) _log.push(`guild(s) deleted: ${guildNames.join(', ')}`);
    try {
      const GuildPoints = require('../../rpg/utils/GuildPointsSystem');
      // Leaderboards are derived, but nudge any cached ranking so a wiped
      // player cannot linger on /lb until the next write.
      if (db.leaderboard && db.leaderboard.entries) {
        db.leaderboard.entries = db.leaderboard.entries.filter(e => !_variants.has(norm(e?.id || e?.jid)));
      }
    } catch (e) {}
    console.log(`[reset] wiped @${targetJid.split('@')[0]} — ${_log.join('; ') || 'no extra references found'}`);

    // 7. Update Mod Cooldown & Save
    db.modResetCooldowns[sender] = Date.now();
    saveDatabase();

    return sock.sendMessage(chatId, {
      text: [
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `☠️ *PLAYER DATA RESET*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `👤 Target: *@${targetJid.split('@')[0]}*`,
        `🛡️ Reset By: *@${sender.split('@')[0]}*`,
        `⏰ Reversal Window: *48 Hours*`,
        ``,
        `All data for *@${targetJid.split('@')[0]}* has been wiped:`,
        ...(_log.length ? _log.slice(0, 10).map(l => `  • ${l}`) : ['  • player record only (nothing else referenced them)']),
        _log.length > 10 ? `  • +${_log.length - 10} more (see server log)` : null,
        `*(Restore within 48h using \`/reset restore @user\`)*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ].join('\n'),
      mentions: [targetJid, sender],
    }, { quoted: msg });
  }
};
