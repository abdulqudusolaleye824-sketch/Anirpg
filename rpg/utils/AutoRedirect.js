// ═══════════════════════════════════════════════════════════════
// AUTO REDIRECT SYSTEM — Ani R.P.G Community Router
// Groups are configured dynamically via /setgroup command.
// Falls back to allowing everywhere until admin sets them.
// ═══════════════════════════════════════════════════════════════

// ── Command → Group category mapping ────────────────────────────
const COMMAND_CATEGORIES = {
  pvp:     ['pvp'],
  casino:  ['casino'],
  // dungeon commands work in ALL groups — no restriction
  // dungeon: ['dungeon', 'worldboss', 'wb', 'coop', 'party', 'boss'],
  guild:   ['guild', 'guildwar', 'gw', 'war'],
};

// ── Default display info per category ───────────────────────────
const CATEGORY_INFO = {
  pvp:     { emoji: '⚔️',  groupName: 'Ani R.P.G PvP',     desc: 'PvP battles & ELO ranking' },
  casino:  { emoji: '🎰',  groupName: 'Ani R.P.G Casino',   desc: 'Slots, Blackjack, Roulette & Dice' },
  dungeon: { emoji: '🏰',  groupName: 'Ani R.P.G Dungeon',  desc: 'Tower dungeons & World Boss raids' },
  guild:   { emoji: '👑',  groupName: 'Ani R.P.G Guild',    desc: 'Guild wars, raids & alliances' },
  support: { emoji: '🛡️', groupName: 'Ani R.P.G Arise',    desc: 'General support & announcements' },
  mods:    { emoji: '🔧',  groupName: 'Ani R.P.G Mods',     desc: 'Moderator-only GC for serf approvals & admin actions' },
};

class AutoRedirect {

  static _getCfg(db) {
    if (!db.communityGroups) db.communityGroups = {};
    return db.communityGroups;
  }

  static getCategory(commandName) {
    for (const [cat, cmds] of Object.entries(COMMAND_CATEGORIES)) {
      if (cmds.includes(commandName)) return cat;
    }
    return null;
  }

  // Returns { allowed: true } or { allowed: false, ...redirectInfo }
  static checkCommand(chatId, commandName, db) {
    if (!chatId.endsWith('@g.us')) return { allowed: true };
    const category = this.getCategory(commandName);
    if (!category) return { allowed: true };

    const cfg = db ? this._getCfg(db) : {};
    const groupCfg = cfg[category];
    if (!groupCfg?.groupId) return { allowed: true }; // not configured yet

    if (chatId === groupCfg.groupId) return { allowed: true };

    const info = CATEGORY_INFO[category];
    return {
      allowed:    false,
      redirect:   true,
      category,
      emoji:      info.emoji,
      groupName:  groupCfg.groupName || info.groupName,
      inviteLink: groupCfg.inviteLink || null,
      command:    commandName,
    };
  }

  static getRedirectMessage(r) {
    const linkLine = r.inviteLink
      ? `\n🔗 *Join here:*\n${r.inviteLink}`
      : `\n_(Link not set yet — ask an admin to run /setgroup ${r.category})_`;
    return (
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `${r.emoji} *WRONG GROUP!*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `❌ */${r.command}* doesn't work here.\n\n` +
      `This command belongs in:\n` +
      `${r.emoji} *${r.groupName}*` +
      `${linkLine}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    );
  }

  static setGroup(db, category, groupId, inviteLink, customName) {
    if (!CATEGORY_INFO[category]) {
      return { success: false, reason: `Unknown category: *${category}*\nValid: ${Object.keys(CATEGORY_INFO).join(', ')}` };
    }
    const cfg = this._getCfg(db);
    cfg[category] = {
      groupId,
      inviteLink: inviteLink || cfg[category]?.inviteLink || null,
      groupName:  customName || CATEGORY_INFO[category].groupName,
      setAt:      Date.now(),
    };
    return { success: true };
  }

  static setLink(db, category, inviteLink) {
    if (!CATEGORY_INFO[category]) return { success: false, reason: `Unknown category: ${category}` };
    const cfg = this._getCfg(db);
    if (!cfg[category]) cfg[category] = {};
    cfg[category].inviteLink = inviteLink;
    return { success: true };
  }

  static getSupportLink(db) {
    return this._getCfg(db).support?.inviteLink || null;
  }

  static getAllGroups(db) {
    const cfg = db ? this._getCfg(db) : {};
    return Object.entries(CATEGORY_INFO).map(([key, info]) => ({
      key, ...info, ...(cfg[key] || {}), configured: !!(cfg[key]?.groupId),
    }));
  }

  // Legacy compat (old callers pass (chatId, commandName) with no db)
  static get GROUP_CONFIGS() { return {}; }
}

module.exports = AutoRedirect;