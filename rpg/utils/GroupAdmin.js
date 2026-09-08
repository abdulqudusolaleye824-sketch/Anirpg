// ═══════════════════════════════════════════════════════════════
// GROUP ADMIN HELPER — shared gate for group-admin-tier commands
// (kick/remove, promote, demote, delete, open, close).
//
// Rule: BOTH the bot AND the user must be group admins.
//   - Owners / Co-Owners may use these even if they are not a group
//     admin, as long as the bot is a group admin.
//   - Only the Owner / Co-Owner is truly protected from being targeted.
// ═══════════════════════════════════════════════════════════════

'use strict';

const Perms = require('../../utils/permissions');

const ADMIN_STATES = ['admin', 'superadmin'];

function bare(jid) {
  return String(jid).split(':')[0].split('@')[0];
}

function isAdminState(p) {
  return p && ADMIN_STATES.includes(p.admin);
}

/**
 * Resolve a group and assert that:
 *   - it's a group,
 *   - the bot is a group admin,
 *   - the sender is a group admin OR an owner/co-owner.
 *
 * @returns {Promise<{ok:boolean, err?:string, meta?:object, botIsAdmin?:boolean,
 *          isOwner?:boolean, isSelfAdmin?:boolean, botJid?:string}>}
 */
async function requireGroupAdmin(sock, chatId, sender, db) {
  if (!chatId.endsWith('@g.us')) {
    return { ok: false, err: '❌ Group command only.' };
  }

  let meta;
  try {
    meta = await sock.groupMetadata(chatId);
  } catch (e) {
    return { ok: false, err: '❌ Could not load group metadata.' };
  }

  // ── Bot must be a group admin ───────────────────────────────────────
  const botJid = sock?.user?.id || '';
  const botPhone = bare(botJid);
  const botPart = meta.participants.find((p) => bare(p.id) === botPhone);
  const botIsAdmin = isAdminState(botPart);
  if (!botIsAdmin) {
    return { ok: false, err: '❌ I need to be a *group admin* for that.', botIsAdmin: false };
  }

  // ── Sender must be a group admin, unless they're an owner/co-owner ───
  const isOwner = Perms.isBotOwner(db, sender);
  const senderPart = meta.participants.find((p) => p.id === sender || bare(p.id) === bare(sender));
  const isSelfAdmin = isAdminState(senderPart);
  if (!isOwner && !isSelfAdmin) {
    return { ok: false, err: '❌ *Group admins only.*\n\n(You need to be a group admin, or the owner/co-owner.)' };
  }

  return { ok: true, meta, botIsAdmin, isOwner, isSelfAdmin, botJid };
}

/**
 * Owners / Co-Owners / Mods are protected from being kicked/muted etc.
 * @param {object} db
 * @param {string} targetJid
 */
function isProtected(db, targetJid) {
  const t = bare(targetJid);
  if (Perms.getBotOwners(db).some((o) => bare(o) === t)) return true;
  if (Perms.getBotMods(db).some((m) => bare(m) === t)) return true;
  return false;
}

module.exports = { requireGroupAdmin, isProtected, isAdminState, bare };
