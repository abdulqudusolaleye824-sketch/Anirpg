// AdminNotices.js — Push #96h-z10
//  • 20 promotion / 20 demotion announcements the bot posts in a GC when a member is
//    promoted to (or demoted from) group admin. ONE bot speaks (the dispatcher); the
//    member is tagged.
//  • Silent bot auto-promotion: whenever a bot lands in a GC (added by hand, /joingc,
//    the connect-time main-GC auto-join or /joinmain) any sibling bot that is already an
//    admin there promotes it — no message.
'use strict';

const PROMOTE = [
  '👑 *{name}* has been raised to Group Admin. Bow, hunters — a new authority walks the hall.',
  '⚔️ The Guild recognises *{name}* — promoted to Group Admin! Keep the gates orderly.',
  '🛡️ *{name}* now carries the admin crest. Respect the badge, respect the hall.',
  '📜 By decree of the Association, *{name}* is now a Group Admin. Rules get teeth today.',
  '🔥 Power shift! *{name}* ascends to Group Admin. Try not to abuse the ban hammer.',
  '✨ A new overseer rises — *{name}* is now Admin. May your moderation be swift and fair.',
  '🏰 The hall has a new keeper: *{name}* — promoted to Group Admin.',
  '⚡ *{name}* was promoted to Admin. The system acknowledges the new chain of command.',
  '🎖️ Congratulations *{name}* — Group Admin status granted. With great power comes great muting.',
  '🗡️ The council has spoken: *{name}* now holds admin rank in this hall.',
  '🌟 Rank up! *{name}* → Group Admin. Hunters, mind your manners.',
  '🧭 *{name}* takes the admin seat. Lost souls, report to them for directions.',
  '🪙 *{name}* has been entrusted with the keys to this hall — Admin promoted.',
  '🐉 A dragon guards this gate now — *{name}* promoted to Group Admin.',
  '📣 Attention: *{name}* is now a Group Admin. Spam at your own risk.',
  '🎯 Sharp eyes, steady hand — *{name}* is promoted to Admin.',
  '🔱 The hall bends the knee: *{name}* is now Group Admin.',
  '🛠️ New admin on duty — *{name}*. Report rule-breakers, not drama.',
  '💠 *{name}* ascends. Group Admin unlocked — the title comes with no respawn timer.',
  '🏹 *{name}* joins the admin ranks. Aim true, moderate fair.',
];

const DEMOTE = [
  '📉 *{name}* has been relieved of admin duty. The crest returns to the vault.',
  '🪦 Admin no more — *{name}* steps down from the hall\'s council.',
  '🔻 *{name}* was demoted. The ban hammer slips from their grasp.',
  '📜 By decree of the Association, *{name}* no longer holds admin rank.',
  '🌫️ The admin crest fades from *{name}*. Back to the ranks, hunter.',
  '⚖️ Power rebalanced — *{name}* is no longer a Group Admin.',
  '🧹 *{name}* has been demoted. Someone else will sweep the hall tonight.',
  '🕯️ A seat on the council goes dark — *{name}* is demoted.',
  '🔓 *{name}* hands back the keys to this hall. Admin status removed.',
  '📴 Admin privileges revoked for *{name}*. The system updates the chain of command.',
  '🍂 *{name}* falls from the admin ranks. Autumn comes for every title.',
  '🪶 Light as a feather now — *{name}* carries no admin weight anymore.',
  '🥀 The hall thanks *{name}* for their service. Admin rank withdrawn.',
  '🎭 Curtain call: *{name}* exits the admin stage.',
  '🏳️ *{name}* lowers the admin banner. A regular hunter once again.',
  '⏳ The sands ran out — *{name}* is no longer Group Admin.',
  '🔕 *{name}* demoted. The mute button is out of reach now.',
  '🧊 Cold shift at the top — *{name}* loses admin status.',
  '🚪 *{name}* steps out of the admin chamber. The door locks behind them.',
  '🌑 An eclipse over *{name}*\'s title — demoted from Group Admin.',
];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function _bare(j) { return String(j || '').split(':')[0].split('@')[0]; }

// Text + mentions for one promote/demote event (several participants → one line each).
function build(action, participants, db) {
  const list = (participants || []).map((p) => (typeof p === 'string' ? p : (p && (p.id || p.jid)) || '')).filter(Boolean);
  if (!list.length) return null;
  const pool = action === 'promote' ? PROMOTE : action === 'demote' ? DEMOTE : null;
  if (!pool) return null;
  const lines = list.map((jid) => {
    const u = db && db.users ? (db.users[jid] || Object.values(db.users).find((x) => x && _bare(x.jid || x.id) === _bare(jid))) : null;
    const name = `@${_bare(jid)}${u && u.name ? ` (${u.name})` : ''}`;
    return pick(pool).replace('{name}', name);
  });
  return { text: lines.join('\n'), mentions: list };
}

// Silent auto-promotion. `sock` = a bot that may be admin here; `targets` = bot jids to promote.
// Returns the jids actually promoted.
async function promoteBots(sock, chatId, targets) {
  const out = [];
  if (!sock || !chatId || !(targets || []).length || typeof sock.groupParticipantsUpdate !== 'function') return out;
  let meta = null; try { meta = await sock.groupMetadata(chatId); } catch (e) { return out; }
  const me = _bare(sock.user && sock.user.id), meLid = _bare(sock.user && sock.user.lid);
  const parts = (meta && meta.participants) || [];
  const isAdmin = (p) => !!(p && (p.admin === 'admin' || p.admin === 'superadmin'));
  // Push #96h-z18: rc14 participants carry `id` = LID and `phoneNumber` = PN — match every form.
  const _same = (p, b) => !!b && (_bare(p.id) === b || _bare(p.lid) === b || _bare(p.jid) === b || _bare(p.phoneNumber) === b);
  const iAmAdmin = parts.some((p) => isAdmin(p) && (_same(p, me) || _same(p, meLid)));
  if (!iAmAdmin) return out;
  const todo = [];
  for (const t of targets) {
    const tb = _bare(typeof t === 'string' ? t : (t && t.id) || '');
    const tl = typeof t === 'object' && t ? _bare(t.lid) : '';
    const row = parts.find((p) => _same(p, tb) || _same(p, tl));
    if (!row || isAdmin(row)) continue;
    todo.push(row.id);
  }
  if (!todo.length) return out;
  try { await sock.groupParticipantsUpdate(chatId, todo, 'promote'); out.push(...todo); } catch (e) {}
  return out;
}

// Every bot in `sockets` (key → sock) that is NOT admin in chatId gets promoted by the first bot that is.
async function promoteAllBots(sockets, chatId) {
  const list = Object.values(sockets || {}).filter((s) => s && s.user && s.user.id);
  const targets = list.map((s) => ({ id: s.user.id, lid: s.user.lid })); // Push #96h-z18: PN + LID per bot
  for (const s of list) {
    try { const done = await promoteBots(s, chatId, targets); if (done.length) return done; } catch (e) {}
  }
  return [];
}

module.exports = { PROMOTE, DEMOTE, build, promoteBots, promoteAllBots };
