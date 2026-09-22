// ═══════════════════════════════════════════════════════════════
// ProGC — Push #87: the Pro / Battle-Pass-Premium members-only group.
//
//   /setgc pro --main   → registers THIS group as the Pro GC.
//
// Rules enforced here:
//   • Access: only players with an active PRO pass OR Battle Pass Premium
//     (bot owners/mods always allowed). Non-eligible joiners are removed
//     with a DM explaining how to get in; commands from non-eligible
//     members are refused with the same explanation.
//   • Epic item spawn every 5 hours (separate from the global daily
//     spawn) — Mending Stone is part of the roster (25%).
//   • /rob is banned inside the Pro GC.
//   • Gates spawned in the Pro GC are B / A / S only (no E, D, C).
//   • Never listed by /support (it is not a public community group).
// ═══════════════════════════════════════════════════════════════
'use strict';

const SPAWN_EVERY_MS = 5 * 60 * 60 * 1000;
const _timers = new Map();

function _isProPlayer(p) {
  return !!(p && (p.isPro || p.proStatus) && p.proExpiresAt && p.proExpiresAt > Date.now());
}
function _isBpPremium(p) {
  return !!(p && p.battlePass && p.battlePass.premium);
}
function _bare(j) { return String(j || '').split(':')[0].split('@')[0].replace(/[^0-9]/g, ''); }

function _findUser(db, jid) {
  if (!db?.users) return null;
  if (db.users[jid]) return db.users[jid];
  const b = _bare(jid);
  if (!b) return null;
  if (db.users[`${b}@s.whatsapp.net`]) return db.users[`${b}@s.whatsapp.net`];
  for (const [k, u] of Object.entries(db.users)) if (_bare(k) === b) return u;
  return null;
}

class ProGC {
  static SPAWN_EVERY_MS = SPAWN_EVERY_MS;

  static getEntries(db) {
    try {
      const AG = require('./AstralGroups');
      return AG.getAll(db).filter((g) => g && g.type === 'pro');
    } catch (e) { return []; }
  }
  static isProGC(db, chatId) {
    if (!chatId || !String(chatId).endsWith('@g.us')) return false;
    try { return require('./AstralGroups').hosts(db, chatId, 'pro'); } catch (e) { return false; }
  }
  static primaryLink(db) {
    const e = this.getEntries(db).find((g) => g.isMain) || this.getEntries(db)[0];
    return e ? (e.inviteLink || null) : null;
  }

  /** { ok, reason } — who may be inside / use commands in the Pro GC. */
  static eligibility(db, jid) {
    try {
      const Perms = require('../../utils/permissions');
      if (Perms.isBotOwner(db, jid) || Perms.isBotMod(db, jid)) return { ok: true, why: 'staff' };
    } catch (e) {}
    const p = _findUser(db, jid);
    if (!p) return { ok: false, reason: 'not_registered' };
    if (_isProPlayer(p)) return { ok: true, why: 'pro' };
    if (_isBpPremium(p)) return { ok: true, why: 'bp_premium' };
    return { ok: false, reason: 'not_eligible' };
  }

  static accessMessage(reason) {
    return [
      `🔒 *PRO GC — MEMBERS ONLY*`,
      ``,
      reason === 'not_registered'
        ? `You are not registered. Use */register* in a public Astra group first.`
        : `This group is reserved for hunters with an active *PRO pass* or *Battle Pass Premium*.`,
      ``,
      `💎 Get PRO: */prostore*`,
      `👑 Get BP Premium: */bp buy*`,
      `📖 Details: */profaq*`,
    ].join('\n');
  }

  /** Called from group-participants.update — kicks non-eligible joiners. */
  static async onParticipantsAdded(sock, db, chatId, participants) {
    if (!this.isProGC(db, chatId)) return;
    const me = _bare(sock?.user?.id);
    for (const p of participants || []) {
      const jid = typeof p === 'string' ? p : (p && (p.id || p.jid));
      if (!jid || (me && _bare(jid) === me)) continue;
      const el = this.eligibility(db, jid);
      if (el.ok) continue;
      try { await sock.sendMessage(jid, { text: this.accessMessage(el.reason) }); } catch (e) {}
      try { await sock.groupParticipantsUpdate(chatId, [jid], 'remove'); } catch (e) {
        console.error('[ProGC] could not remove', jid, e.message);
      }
    }
  }

  /** Command gate. Returns null when allowed, or a text to reply with. */
  static commandBlock(db, chatId, sender, commandName) {
    if (!this.isProGC(db, chatId)) return null;
    const el = this.eligibility(db, sender);
    if (!el.ok) return this.accessMessage(el.reason);
    if (commandName === 'rob') {
      return `🚫 */rob* is banned in the Pro GC.\nHunters here are under Astra's protection — take your heists to a public group.`;
    }
    return null;
  }

  /** Force the gate rank roll to B/A/S inside the Pro GC. */
  static rollPremiumRank() {
    const r = Math.random();
    if (r < 0.20) return 'S';   // 20%
    if (r < 0.50) return 'A';   // 30%
    return 'B';                 // 50%
  }

  // ── 5-hour epic spawn ─────────────────────────────────────────
  static _pickEpic() {
    const { SPAWN_ARTIFACTS } = require('../../commands/rpg/artifactspawn');
    const mending = SPAWN_ARTIFACTS.find((a) => a.isMendingStone || a.name === 'Mending Stone');
    if (mending && Math.random() < 0.25) return mending;
    const NON_EQUIP = (a) => !['weapon', 'armor', 'ring', 'tome'].includes(String(a.type || '').toLowerCase());
    const notMend = (a) => !(a.isMendingStone || a.name === 'Mending Stone');
    let pool = SPAWN_ARTIFACTS.filter((a) => a.rarity === 'epic' && NON_EQUIP(a) && notMend(a));
    if (!pool.length) pool = SPAWN_ARTIFACTS.filter((a) => a.rarity === 'epic' && notMend(a));
    if (!pool.length) return mending || null;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  static async spawnNow(sock, chatId, db, saveDatabase) {
    const art = this._pickEpic();
    if (!art) return false;
    const AS = require('../../commands/rpg/artifactspawn');
    if (AS.activeSpawns && AS.activeSpawns.has(chatId)) return false;
    await AS.spawnArtifact(sock, chatId, db, saveDatabase, art); // forced → bypasses global daily limiter
    if (!db.proGCSpawn) db.proGCSpawn = {};
    db.proGCSpawn[chatId] = { lastAt: Date.now(), last: art.name };
    try { saveDatabase(); } catch (e) {}
    return true;
  }

  /** Idempotent per chat. Spawns immediately if 5h already elapsed. */
  static startScheduler(sock, chatId, getDatabase, saveDatabase) {
    if (!chatId || _timers.has(chatId)) return;
    const tick = async () => {
      try {
        const db = getDatabase();
        if (!this.isProGC(db, chatId)) { clearInterval(_timers.get(chatId)); _timers.delete(chatId); return; }
        const last = db.proGCSpawn?.[chatId]?.lastAt || 0;
        if (Date.now() - last >= SPAWN_EVERY_MS) await this.spawnNow(sock, chatId, db, saveDatabase);
      } catch (e) { console.error('[ProGC] spawn tick error:', e.message); }
    };
    const iv = setInterval(tick, 10 * 60 * 1000); // check every 10 min
    _timers.set(chatId, iv);
    setTimeout(tick, 60 * 1000);
    console.log(`[ProGC] 5h epic spawn scheduler armed for ${chatId}`);
  }

  static bootAll(sock, getDatabase, saveDatabase) {
    try {
      const db = getDatabase();
      for (const g of this.getEntries(db)) this.startScheduler(sock, g.groupId, getDatabase, saveDatabase);
    } catch (e) { console.error('[ProGC] bootAll error:', e.message); }
  }
}

module.exports = ProGC;
