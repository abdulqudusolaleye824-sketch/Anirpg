// Push #102: GUILD KEYRING — gate keys belong to the GUILD, not to a DM.
//   • A key is never DM'd on purchase. It lands in the guild keyring.
//   • /guild keys (Guildmaster / Vice / Officer; an affiliate sees the keys they bought):
//       serf active   → the full keyring goes to the requester's DM through the serf
//       serf missing  → "pick a rank" (E/D/C/B/A/S buttons or a plain letter reply); the ONE key of
//                       that rank lapsing soonest is posted in the group. Pro gets a hint which rank that is.
//   • Anyone holding a key code can still use it — guard it.
//   • Migration: every live key whose owner is in a guild is stamped with that guild (keys bought before
//     this push already carried guildName; affiliate keys carry the granting guild).
const GKM = require('../dungeons/GateKeyManager');
const RANKS = ['E', 'D', 'C', 'B', 'A', 'S'];

function _live(k) { return k && !k.expired && !k.raidComplete && !k.consumed && !k.used && Date.now() < (k.expiresAt || 0); }
function _guildOf(db, jid) { try { return require('./GuildContractManager').resolvePlayerGuild(db, jid, db.users?.[jid]) || null; } catch (e) { return null; } }

/** Stamp guild-less keys with the owner's guild (one-time per key). Returns how many were migrated. */
function migrate(db) {
  let n = 0;
  for (const k of Object.values(db?.gateKeys || {})) {
    if (!k || k.guildName || !k.ownedBy) continue;
    const g = _guildOf(db, k.ownedBy) || (() => { const u = db.users?.[k.ownedBy]; return u && u.guild ? { name: u.guild } : null; })();
    if (g && g.name) { k.guildName = g.name; k.migratedToGuildAt = Date.now(); n++; try { if (GKM.activeKeys && GKM.activeKeys[k.key]) GKM.activeKeys[k.key].guildName = g.name; } catch (e) {} }
  }
  return n;
}
/** Live keys of a guild, soonest-expiring first. */
function pool(db, guildName) {
  migrate(db);
  const want = String(guildName || '').toLowerCase();
  if (!want) return [];
  return Object.values(db?.gateKeys || {}).filter(k => _live(k) && String(k.guildName || '').toLowerCase() === want).sort((a, b) => (a.expiresAt || 0) - (b.expiresAt || 0));
}
/** Who may see the keyring: GM / Vice / Officer of the guild, or an affiliate (their own keys only). */
function access(db, sender) {
  const g = _guildOf(db, sender);
  if (g && g.name && GKM.isGuildLeaderOrOfficer(sender, g.name, db)) return { ok: true, guildName: g.name, role: 'officer' };
  const aff = GKM.getAffiliateData(sender, db);
  if (aff && aff.guildName) return { ok: true, guildName: aff.guildName, role: 'affiliate' };
  if (g && g.name) return { ok: false, guildName: g.name, reason: 'rank', error: `❌ The guild keyring is for the *Guildmaster, Vice GM and Officers*. Ask one of them to open a gate.` };
  return { ok: false, reason: 'noguild', error: `❌ You are not in a guild — gate keys live in a guild's keyring (*/guild keys*).` };
}
function visible(db, sender) {
  const a = access(db, sender); if (!a.ok) return { ...a, keys: [] };
  let keys = pool(db, a.guildName);
  if (a.role === 'affiliate') keys = keys.filter(k => GKM.normaliseJid(k.ownedBy) === GKM.normaliseJid(sender));
  return { ...a, keys };
}
function soonestOfRank(keys, rank) { const r = String(rank || '').toUpperCase(); return (keys || []).find(k => String(k.gateRank || '').toUpperCase() === r) || null; }
function ranksHeld(keys) { return RANKS.filter(r => (keys || []).some(k => String(k.gateRank || '').toUpperCase() === r)); }

function keyCard(k, { pro = false, FRAME = '✦ ━━━━━━━━━━━━━━ ✦' } = {}) {
  let rd = null; try { rd = require('../dungeons/GateManager').GATE_RANKS[k.gateRank]; } catch (e) {}
  rd = rd || { emoji: '🚪', label: `${k.gateRank}-Rank` };
  const left = GKM.formatStability(Math.max(0, (k.expiresAt || 0) - Date.now()));
  return [
    `${rd.emoji} *${rd.label}* — 🔑 \`${k.key}\``,
    `   🏰 ${k.guildName || 'Solo/Affiliate'} · 🆔 ${k.gateId || '?'}${k.totalFloors ? ` · ${k.totalFloors} floors` : ''}`,
    `   ⏳ Lapses in *${left}*`,
  ].join('\n');
}
function listText(keys, { pro = false, FRAME = '✦ ━━━━━━━━━━━━━━ ✦', guildName = '' } = {}) {
  const lines = [FRAME, `🔑 *${guildName ? guildName.toUpperCase() + ' ' : ''}GUILD KEYRING (${keys.length})*${pro ? ' 💎' : ''}`, FRAME, ``];
  keys.forEach((k, i) => { lines.push(`${i + 1}. ${keyCard(k, { pro, FRAME })}`, ``); });
  lines.push(FRAME, `📌 In a registered dungeon GC: */party create --<CODE>*`, `⚠️ Anyone holding a code can use it — guard it.`);
  return lines.join('\n');
}
module.exports = { RANKS, migrate, pool, access, visible, soonestOfRank, ranksHeld, keyCard, listText, _live };
