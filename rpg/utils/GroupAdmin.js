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
 * Batch-34: shared bot-admin resolution (JID + LID aware).
 * ONE system for every command that needs "bot must be group admin"
 * (/open, /close, /kick, /gclink, ...).
 * @returns {{botIsAdmin:boolean, botJid:string}}
 */
function resolveBotAdmin(sock, meta) {
  const botJid = sock?.user?.id || '';
  const botLid = sock?.user?.lid || '';
  const botPhone = bare(botJid);
  const botLidPhone = bare(botLid);

  const parts = meta.participants || [];
  const botPart = parts.find((p) => {
    const pBare = bare(p.id);
    return (
      p.id === botJid ||
      p.id === botLid ||
      (botPhone && pBare === botPhone) ||
      (botLidPhone && pBare === botLidPhone)
    );
  });

  // Fall back: if bot is executing the command, assume bot has admin rights if meta contains it as admin or if participants has >= 1 admin
  const botIsAdmin = isAdminState(botPart) || parts.some(p => isAdminState(p) && (bare(p.id) === botPhone || bare(p.id) === botLidPhone));
  return { botIsAdmin, botJid };
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
  const { botIsAdmin, botJid } = resolveBotAdmin(sock, meta);

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

  return { ok: true, meta, botIsAdmin: true, isOwner, isSelfAdmin, botJid };
}

/**
 * Batch-34: bot-admin-only gate (NO sender requirement).
 * Same bot detection as requireGroupAdmin — for commands any member
 * may use as long as the bot itself is admin (/gclink).
 * @returns {Promise<{ok:boolean, reason?:string, err?:string, meta?:object,
 *          botIsAdmin?:boolean, botJid?:string}>}
 */
async function requireBotAdmin(sock, chatId) {
  if (!chatId || !chatId.endsWith('@g.us')) {
    return { ok: false, reason: 'not-group', err: '❌ Group command only.', botIsAdmin: false };
  }

  let meta;
  try {
    meta = await sock.groupMetadata(chatId);
  } catch (e) {
    return { ok: false, reason: 'meta', err: '❌ Could not load group metadata.', botIsAdmin: false };
  }

  const { botIsAdmin, botJid } = resolveBotAdmin(sock, meta);
  if (!botIsAdmin) {
    return { ok: false, reason: 'bot-not-admin', err: '❌ I need to be a *group admin* for that.', botIsAdmin: false };
  }

  return { ok: true, meta, botIsAdmin: true, botJid };
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

module.exports = { requireGroupAdmin, requireBotAdmin, resolveBotAdmin, isProtected, isAdminState, bare };
