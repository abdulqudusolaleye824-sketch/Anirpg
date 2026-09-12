// ═══════════════════════════════════════════════════════════════
// ASTRAL GROUPS — Community group registry + 30-day subscription
// Consolidated group-set system (replaces the old single-per-type
// AutoRedirect routing). Every group set via /setgroup is stored
// here; a --main group never expires, others must be subscribed
// (/ssub) and run a 30-day window that /renew extends.
// ═══════════════════════════════════════════════════════════════

const SUB_DAYS = 30; // length of one subscription window

const TYPES = ['support', 'pvp', 'dungeon', 'casino', 'guild', 'mods', 'games'];
const FEATURE_TYPES = ['pvp', 'dungeon'];
const TYPES_WITHOUT_MAIN = ['support', 'pvp', 'dungeon', 'mods'];
const MAIN_ONLY_TYPES = ['casino', 'guild', 'games'];

const TYPE_INFO = {
  pvp:     { emoji: '⚔️', name: '✦ 𝐀𝐬𝐭𝐫𝐚™ PvP',     desc: 'PvP battles & ELO ranking' },
  casino:  { emoji: '🎰', name: '✦ 𝐀𝐬𝐭𝐫𝐚™ Casino',   desc: 'Slots, Blackjack, Roulette & Dice' },
  dungeon: { emoji: '🏰', name: '✦ 𝐀𝐬𝐭𝐫𝐚™ Dungeon',  desc: 'Tower dungeons & World Boss raids' },
  guild:   { emoji: '👑', name: '✦ 𝐀𝐬𝐭𝐫𝐚™ Guild',    desc: 'Guild wars, raids & alliances' },
  support: { emoji: '🛡️', name: '✦ 𝐀𝐬𝐭𝐫𝐚™ Arise',   desc: 'General support & announcements' },
  mods:    { emoji: '🛡️', name: '✦ 𝐀𝐬𝐭𝐫𝐚™ Mods',    desc: 'Moderation & staff GC' },
  games:   { emoji: '🎮', name: '✦ 𝐀𝐬𝐭𝐫𝐚™ Games',   desc: 'Quiz, Tic-Tac-Toe & Chess' },
};

const EXPIRED_MSG =
  '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
  '⛔ *Subscription expired*\n' +
  '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
  '_Contact administration to renew._\n\n' +
  '*(An owner / co-owner can run `/renew` to reactivate this group.)*';

class AstralGroups {
  static TYPES = TYPES;
  static FEATURE_TYPES = FEATURE_TYPES;
  static TYPES_WITHOUT_MAIN = TYPES_WITHOUT_MAIN;
  static MAIN_ONLY_TYPES = MAIN_ONLY_TYPES;

  static _registry(db) {
    if (!db.astralGroups || typeof db.astralGroups !== 'object') db.astralGroups = {};
    return db.astralGroups;
  }

  static get(type) {
    const t = (type || '').toLowerCase();
    if (t === 'mod') return 'mods';
    return TYPES.includes(t) ? t : null;
  }

  static typeInfo(type) { return TYPE_INFO[type] || { emoji: '🌐', name: type, desc: '' }; }

  static register(db, type, groupId, inviteLink, opts = {}) {
    const cat = this.get((type || '').toLowerCase());
    if (!cat) return { success: false, reason: `Unknown type. Valid: ${TYPES.join(', ')}` };

    const isMain = !!opts.main;
    if (!isMain && !TYPES_WITHOUT_MAIN.includes(cat)) {
      return { success: false, reason: `*${TYPE_INFO[cat].name}* must be set with the *--main* tag (only support, pvp, dungeon and mods can be set without it).` };
    }

    const reg = this._registry(db);
    const existing = reg[groupId];
    reg[groupId] = {
      groupId,
      type: cat,
      groupName: opts.groupName || existing?.groupName || null,
      inviteLink: inviteLink || existing?.inviteLink || null,
      setAt: Date.now(),
      isMain,
      status: isMain ? 'main' : 'active',
      startsAt: existing?.startsAt || Date.now(),
      expiresAt: existing?.expiresAt || null,
      subscriber: existing?.subscriber || null,
      features: Array.from(new Set([...(existing?.features || [])])),
    };
    if (isMain) {
      try {
        if (!db.groupSettings) db.groupSettings = {};
        if (!db.groupSettings[groupId]) db.groupSettings[groupId] = { antiLink: false, allowed: [] };
        db.groupSettings[groupId].antiLink = true;
      } catch (e) { /* best effort */ }
    }
    try {
      if (!db.communityGroups) db.communityGroups = {};
      const info = TYPE_INFO[cat];
      db.communityGroups[cat] = {
        groupId,
        inviteLink: inviteLink || db.communityGroups[cat]?.inviteLink || null,
        groupName: opts.groupName || db.communityGroups[cat]?.groupName || info?.name || cat,
        setAt: Date.now(),
      };
    } catch (e) { /* best effort */ }
    return { success: true, status: reg[groupId].status, group: reg[groupId] };
  }

  static getEntry(db, groupId) {
    const e = this._registry(db)[groupId];
    if (e && !e.groupId) e.groupId = groupId;
    return e || null;
  }

  static hasType(db, groupId) {
    return !!this.getEntry(db, groupId);
  }

  static isPending(db, groupId) {
    const e = this.getEntry(db, groupId);
    return !!(e && !e.isMain && e.status === 'pending');
  }

  // Batch-47: dungeon GCs NEVER expire (owner order) — raids must not
  // die to subscription timers. Self-heals stale 'expired' flags on read.
  static isNeverExpiring(entry) {
    if (!entry) return false;
    if (entry.type === 'dungeon') return true;
    return Array.isArray(entry.features) && entry.features.includes('dungeon');
  }

  static isExpired(db, groupId, now = Date.now()) {
    const e = this.getEntry(db, groupId);
    if (!e || e.isMain) return false;
    if (this.isNeverExpiring(e)) { if (e.status === 'expired') e.status = 'active'; return false; }
    if (e.status === 'expired') return true;
    if (e.status === 'active' && e.expiresAt && now >= e.expiresAt) {
      e.status = 'expired';
      return true;
    }
    return false;
  }

  static isActive(db, groupId, now = Date.now()) {
    const e = this.getEntry(db, groupId);
    if (!e) return true;
    if (e.isMain) return true;
    if (e.status === 'active') return !(e.expiresAt && now >= e.expiresAt);
    return true;
  }

  static gate(db, groupId, now = Date.now()) {
    const e = this.getEntry(db, groupId);
    if (!e) return { allow: true, silent: false, expired: false };
    if (e.isMain) return { allow: true, silent: false, expired: false };
    if (this.isNeverExpiring(e)) return { allow: true, silent: false, expired: false }; // batch-47
    if (this.isExpired(db, groupId, now)) {
      return { allow: false, silent: false, expired: true, msg: EXPIRED_MSG };
    }
    if (e.status === 'pending') {
      e.status = 'active';
      return { allow: true, silent: false, expired: false };
    }
    if (e.status === 'active' && e.expiresAt && now >= e.expiresAt) {
      return { allow: false, silent: false, expired: true, msg: EXPIRED_MSG };
    }
    return { allow: true, silent: false, expired: false };
  }

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

  static addFeature(db, groupId, feature) {
    const e = this.getEntry(db, groupId);
    if (!e) return { success: false, reason: 'This group is not registered. Run /setgroup <type> here first.' };
    const cat = (feature || '').toLowerCase();
    if (!FEATURE_TYPES.includes(cat)) {
      return { success: false, reason: `Invalid feature. You can add: ${FEATURE_TYPES.join(', ')}` };
    }
    if (!e.features) e.features = [];
    if (e.features.includes(cat)) {
      return { success: false, reason: `*${TYPE_INFO[cat]?.name || cat}* feature is already enabled in this group.` };
    }
    e.features.push(cat);
    return { success: true, feature: cat, features: e.features };
  }

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
    if (this.isNeverExpiring(e)) { if (e.status === 'expired') e.status = 'active'; return 'active'; }
    if (this.isExpired(db, groupId, now)) return 'expired';
    if (e.expiresAt && now >= e.expiresAt) { e.status = 'expired'; return 'expired'; }
    return e.status;
  }

  static daysLeft(db, groupId, now = Date.now()) {
    const e = this.getEntry(db, groupId);
    if (!e || e.isMain) return null;
    if (!e.expiresAt) return null;
    return Math.max(0, Math.ceil((e.expiresAt - now) / (24 * 60 * 60 * 1000)));
  }

  static getAll(db) {
    const reg = this._registry(db);
    return Object.entries(reg).map(([groupId, e]) => ({
      groupId,
      ...e,
      daysLeft: this.daysLeft(db, groupId),
    }));
  }

  static getByType(db, type) {
    return this.getAll(db).filter((e) => e.type === type);
  }

  static primaryOf(db, type) {
    const list = this.getByType(db, type);
    if (!list.length) return null;
    return list.find((g) => g.isMain) || list.find((g) => this.isActive(db, g.groupId)) || list[0];
  }

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
