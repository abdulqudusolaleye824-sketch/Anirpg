// ═══════════════════════════════════════════════════════════════
// ASTRAL GROUPS — Community group registry + 30-day subscription
// Consolidated group-set system (replaces the old single-per-type
// AutoRedirect routing). Every group set via /setgroup is stored
// here; a --main group never expires, others must be subscribed
// (/ssub) and run a 30-day window that /renew extends.
// ═══════════════════════════════════════════════════════════════

const SUB_DAYS = 30; // length of one subscription window

// Types a group can be set as.
const TYPES = ['support', 'pvp', 'dungeon', 'casino', 'guild'];

// Features that can be ADDED onto a base group with /allowgc.
const FEATURE_TYPES = ['pvp', 'dungeon'];

// Types allowed WITHOUT the --main tag.
const TYPES_WITHOUT_MAIN = ['support', 'pvp', 'dungeon'];
// Types that REQUIRE the --main tag.
const MAIN_ONLY_TYPES = ['casino', 'guild'];

const TYPE_INFO = {
  pvp:     { emoji: '⚔️', name: '✦ 𝐀𝐬𝐭𝐫𝐚™ PvP',     desc: 'PvP battles & ELO ranking' },
  casino:  { emoji: '🎰', name: '✦ 𝐀𝐬𝐭𝐫𝐚™ Casino',   desc: 'Slots, Blackjack, Roulette & Dice' },
  dungeon: { emoji: '🏰', name: '✦ 𝐀𝐬𝐭𝐫𝐚™ Dungeon',  desc: 'Tower dungeons & World Boss raids' },
  guild:   { emoji: '👑', name: '✦ 𝐀𝐬𝐭𝐫𝐚™ Guild',    desc: 'Guild wars, raids & alliances' },
  support: { emoji: '🛡️', name: '✦ 𝐀𝐬𝐭𝐫𝐚™ Arise',   desc: 'General support & announcements' },
};

const EXPIRED_MSG =
  '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
  '⛔ *Subscription expired*\n' +
  '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
  '_Contact administration to renew._\n\n' +
  '*(An owner / co-owner can run `/renew` to reactivate this group.)*';

class AstralGroups {

  static _registry(db) {
    if (!db.astralGroups || typeof db.astralGroups !== 'object') db.astralGroups = {};
    return db.astralGroups;
  }

  static get(type) {
    return TYPES.includes(type) ? type : null;
  }

  static typeInfo(type) { return TYPE_INFO[type]; }

  // ── Register a group (base type). ──────────────────────────────
  // Returns { success, status } where status ∈ main | pending | error.
  static register(db, type, groupId, inviteLink, opts = {}) {
    const cat = this.get((type || '').toLowerCase());
    if (!cat) return { success: false, reason: `Unknown type. Valid: ${TYPES.join(', ')}` };

    const isMain = !!opts.main;
    if (!isMain && !TYPES_WITHOUT_MAIN.includes(cat)) {
      return { success: false, reason: `*${TYPE_INFO[cat].name}* must be set with the *--main* tag (only support, pvp and dungeon can be set without it).` };
    }

    const reg = this._registry(db);
    const existing = reg[groupId];
    reg[groupId] = {
      type: cat,
      inviteLink: inviteLink || existing?.inviteLink || null,
      setAt: Date.now(),
      isMain,
      // Subscription fields (only meaningful for non-main groups):
      status: isMain ? 'main' : 'pending',   // main | pending | active | expired
      startsAt: existing?.startsAt || null,
      expiresAt: existing?.expiresAt || null,
      subscriber: existing?.subscriber || null,
      features: Array.from(new Set([...(existing?.features || [])])),
    };
    // MAIN groups get anti-link auto-enabled (co-owner spec: auto antilink on all main groups).
    if (isMain) {
      try {
        if (!db.groupSettings) db.groupSettings = {};
        if (!db.groupSettings[groupId]) db.groupSettings[groupId] = { antiLink: false, allowed: [] };
        db.groupSettings[groupId].antiLink = true;
      } catch (e) { /* best effort */ }
    }
    // Legacy mirror (so setserf / old readers of db.communityGroups still
    // resolve a group id for this category).
    try {
      if (!db.communityGroups) db.communityGroups = {};
      const info = TYPE_INFO[cat];
      db.communityGroups[cat] = {
        groupId,
        inviteLink: inviteLink || db.communityGroups[cat]?.inviteLink || null,
        groupName: info?.name || cat,
        setAt: Date.now(),
      };
    } catch (e) { /* best effort */ }
    return { success: true, status: reg[groupId].status, group: reg[groupId] };
  }

  static getEntry(db, groupId) {
    return this._registry(db)[groupId] || null;
  }

  static hasType(db, groupId) {
    return !!this.getEntry(db, groupId);
  }

  // A registered group is "silent" (bot gives no responses) when it's a
  // non-main group that hasn't been subscribed yet (pending).
  static isPending(db, groupId) {
    const e = this.getEntry(db, groupId);
    return !!(e && !e.isMain && e.status === 'pending');
  }

  // "Expired" = non-main group past its window (or explicitly expired).
  static isExpired(db, groupId, now = Date.now()) {
    const e = this.getEntry(db, groupId);
    if (!e || e.isMain) return false;
    if (e.status === 'expired') return true;
    if (e.status === 'active' && e.expiresAt && now >= e.expiresAt) {
      e.status = 'expired';
      return true;
    }
    return false;
  }

  // Whether the bot may respond at all in this group.
  static isActive(db, groupId, now = Date.now()) {
    const e = this.getEntry(db, groupId);
    if (!e) return true;          // unregistered = normal behavior
    if (e.isMain) return true;    // main never expires
    if (e.status === 'active') return !(e.expiresAt && now >= e.expiresAt);
    return false;
  }

  // The gate result for the command handler.
  // Returns { allow, silent, expiredMsgs? }
  static gate(db, groupId, now = Date.now()) {
    const e = this.getEntry(db, groupId);
    if (!e) return { allow: true, silent: false, expired: false };
    if (e.isMain) return { allow: true, silent: false, expired: false };
    if (this.isExpired(db, groupId, now)) {
      return { allow: false, silent: false, expired: true, msg: EXPIRED_MSG };
    }
    if (e.status === 'pending') {
      return { allow: false, silent: true, expired: false };
    }
    if (e.status === 'active' && e.expiresAt && now >= e.expiresAt) {
      return { allow: false, silent: false, expired: true, msg: EXPIRED_MSG };
    }
    return { allow: true, silent: false, expired: false };
  }

  // ── /ssub — start the 30-day window (owner/co-owner). ─────────
  static ssub(db, groupId, subscriberName) {
    const e = this.getEntry(db, groupId);
    if (!e) return { success: false, reason: 'This group is not registered. Run /setgroup <type> here first.' };
    if (e.isMain) return { success: false, reason: 'This is a --main group — it never expires and does not need a subscription.' };
    const now = Date.now();
    e.status = 'active';
    e.startsAt = now;
    e.expiresAt = now + SUB_DAYS * 24 * 60 * 60 * 1000;
    if (subscriberName) e.subscriber = subscriberName;
    return { success: true, expiresAt: e.expiresAt, subscriber: e.subscriber };
  }

  // ── /renew — extend the window by SUB_DAYS. ───────────────────
  static renew(db, groupId) {
    const e = this.getEntry(db, groupId);
    if (!e) return { success: false, reason: 'This group is not registered.' };
    if (e.isMain) return { success: false, reason: 'This is a --main group — it never expires.' };
    const now = Date.now();
    const base = e.expiresAt && e.expiresAt > now ? e.expiresAt : now;
    e.expiresAt = base + SUB_DAYS * 24 * 60 * 60 * 1000;
    e.startsAt = now;
    e.status = 'active';
    return { success: true, expiresAt: e.expiresAt };
  }

  // ── /allowgc <feature> — add a pvp/dungeon feature on top. ────
  static addFeature(db, groupId, feature) {
    const e = this.getEntry(db, groupId);
    if (!e) return { success: false, reason: 'This group is not registered. Run /setgroup <type> here first.' };
    const cat = (feature || '').toLowerCase();
    if (!FEATURE_TYPES.includes(cat)) {
      return { success: false, reason: `Invalid feature. You can add: ${FEATURE_TYPES.join(', ')}` };
    }
    if (e.features.includes(cat)) {
      return { success: false, reason: `*${TYPE_INFO[cat].name}* feature is already enabled in this group.` };
    }
    e.features.push(cat);
    return { success: true, feature: cat, features: e.features };
  }

  // Does this group host a given base/feature category?
  static hosts(db, groupId, category) {
    const e = this.getEntry(db, groupId);
    if (!e) return false;
    if (e.type === category) return true;
    return (e.features || []).includes(category);
  }

  static statusOf(db, groupId, now = Date.now()) {
    const e = this.getEntry(db, groupId);
    if (!e) return null;
    if (e.isMain) return 'main';
    if (this.isExpired(db, groupId, now)) return 'expired';
    if (e.expiresAt && now >= e.expiresAt) { e.status = 'expired'; return 'expired'; }
    return e.status; // pending | active
  }

  static daysLeft(db, groupId, now = Date.now()) {
    const e = this.getEntry(db, groupId);
    if (!e || e.isMain) return null;
    if (!e.expiresAt) return null;
    return Math.max(0, Math.ceil((e.expiresAt - now) / (24 * 60 * 60 * 1000)));
  }

  // All registered groups (for the /community listing).
  static getAll(db) {
    const reg = this._registry(db);
    return Object.values(reg).map((e) => ({
      ...e,
      daysLeft: this.daysLeft(db, Object.keys(reg).find((k) => reg[k] === e)),
    }));
  }

  static getByType(db, type) {
    const reg = this._registry(db);
    return Object.values(reg).filter((e) => e.type === type);
  }

  // Preferred "primary" group for a type (for redirects / link lookups):
  // main group first, then an active one, then any.
  static primaryOf(db, type) {
    const list = this.getByType(db, type);
    if (!list.length) return null;
    return list.find((g) => g.isMain) || list.find((g) => this.isActive(db, g.groupId)) || list[0];
  }

  // For a command host: is this chatId a registered group that hosts the
  // category AND is currently active (not pending/expired)?
  static hostsActive(db, chatId, category) {
    if (!this.hosts(db, chatId, category)) return false;
    return this.gate(db, chatId).allow;
  }

  static getSupportLink(db) {
    const p = this.primaryOf(db, 'support');
    return p?.inviteLink || null;
  }
}

module.exports = AstralGroups;
