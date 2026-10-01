// /event — Push #96h: the Jeju Island Raid (Events GC only)
const EventSystem = require('../../rpg/utils/EventSystem');
const Perms = require('../../utils/permissions');
const Target = require('../../utils/target');

function _findUser(db, jid) {
  if (!jid || !db.users) return null; if (db.users[jid]) return db.users[jid];
  const b = String(jid).split('@')[0].split(':')[0];
  for (const [k, u] of Object.entries(db.users)) if (k.split('@')[0] === b || (db.lidMap && db.lidMap[k.split('@')[0]] === b)) return u;
  return null;
}

module.exports = {
  name: 'event',
  aliases: ['jeju', 'ea'],
  description: '🏝️ Jeju Island Raid — /event start|status|attack|hit|domain|lb|end',
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid; const db = getDatabase();
    const say = (text, extra = {}) => sock.sendMessage(chatId, { text, ...extra }, { quoted: msg });
    const player = db.users[sender];
    if (!player) return say('❌ Not registered! Use /register first.');
    const sub = (args[0] || 'status').toLowerCase();
    const inGC = EventSystem.isEventGC(db, chatId);
    const needGC = () => say(EventSystem.gcId(db) ? '🏝️ The Jeju Island Raid is fought in the *Events GC* only.' : '🏝️ No Events GC is set yet — an owner must run */setgc events --main* there.');

    if (sub === 'lb' || sub === 'leaderboard' || sub === 'top') {
      const lb = EventSystem.leaderboard(db, 10);
      if (!db.event) return say('🏝️ No event has run yet.');
      return say([`🏆 *JEJU ISLAND RAID — LEADERBOARD*${db.event.active ? '' : ' (final)'}`, ...(lb.length ? lb.map((e, i) => `${['🥇', '🥈', '🥉'][i] || `${i + 1}.`} *${e.name}* — ${e.points.toLocaleString()} pts · ${e.kills} kills · ${e.hunterKills} hunter kills`) : ['_Nobody has scored yet._'])].join('\n'));
    }
    if (sub === 'status' || sub === 'info') return say(EventSystem.status(db));
    if (sub === 'start') {
      if (!Perms.isBotOwner(db, sender)) return say('❌ Only an owner can start the event.');
      if (!inGC) return needGC();
      const r = EventSystem.start(db, sender); if (!r.ok) return say(`❌ ${r.error}`);
      saveDatabase(db);
      return say([`🏝️ *THE JEJU ISLAND RAID HAS BEGUN!*`, `For *10 days* the island belongs to whoever takes it.`, ``, `🌊 Each wave: *${EventSystem.WAVE_SIZE} beasts + 1 boss*. Clear it and a stronger wave rises.`, `⚔️ */event attack [#]* — strike a beast (they only counter, never start a fight; left alone 30s they regenerate).`, `🗡️ */event hit @hunter* — friendly fire is ON. Kill a hunter: take *50%* of their points, theirs reset to *0*.`, `💀 Die and you wait *1 hour* to respawn.`, `🛌 */eventafk* — untouchable, but you cannot attack.`, `🌌 */event domain* — your *Lv.10 event domain* (name it: /event domain name …).`, `🏅 */epoints* · */estats* · */eshop* · */event lb*`, ``, `Hunters Lv.${EventSystem.DOMAIN_LEVEL}+ only. Good hunting.`].join('\n'));
    }
    if (sub === 'end' || sub === 'stop') {
      if (!Perms.isBotOwner(db, sender)) return say('❌ Only an owner can end the event.');
      const ev = EventSystem.end(db, 'owner'); if (!ev) return say('No event is running.');
      saveDatabase(db); const lb = EventSystem.leaderboard(db, 3);
      return say([`🏁 *JEJU ISLAND RAID — OVER.* Waves cleared: ${ev.wavesCleared}`, ...lb.map((e, i) => `${['🥇', '🥈', '🥉'][i]} ${e.name} — ${e.points.toLocaleString()} pts`), `\n_Points can still be spent in /eshop._`].join('\n'));
    }
    if (sub === 'attack' || sub === 'a' || sub === 'strike') {
      if (!inGC) return needGC();
      const r = EventSystem.attackMonster(db, player, args[1] && /^#?\d+$/.test(args[1]) ? args[1].replace('#', '') : null);
      if (!r.ok) return say(`❌ ${r.error}`); saveDatabase(db); return say(r.text);
    }
    if (sub === 'hit' || sub === 'pk' || sub === 'strikehunter') {
      if (!inGC) return needGC();
      const tj = Target.resolve(msg, args.slice(1)); const victim = tj ? _findUser(db, tj) : null;
      if (!victim) return say('Tag or reply to the hunter you want to strike.');
      const r = EventSystem.attackHunter(db, player, victim); if (!r.ok) return say(`❌ ${r.error}`);
      saveDatabase(db); return say(r.text, { mentions: [tj] });
    }
    if (sub === 'domain' || sub === 'de') {
      const what = (args[1] || '').toLowerCase();
      if ((player.level || 0) < EventSystem.DOMAIN_LEVEL) return say(`🌌 Your event domain awakens at *Lv.${EventSystem.DOMAIN_LEVEL}*.`);
      if (what === 'name') { const r = EventSystem.setDomainName(player, args.slice(2).join(' ')); if (r.ok) saveDatabase(db); return say(r.ok ? `${r.text}\n_Now: /event domain desc <description>_` : `❌ ${r.error}`); }
      if (what === 'desc' || what === 'description') { const r = EventSystem.setDomainDesc(player, args.slice(2).join(' ')); if (r.ok) saveDatabase(db); return say(r.ok ? `${r.text}\n_Cast it in the Events GC with /event domain_` : `❌ ${r.error}`); }
      if (what === 'info' || what === 'show') { const d = EventSystem.domainState(player); return say(`🌌 *EVENT DOMAIN (Lv.${EventSystem.DOMAIN_LEVEL})*\nName: ${d.name || '— (/event domain name <name>)'}\nDescription: ${d.desc || '— (/event domain desc <text>)'}\nCasts: ${d.casts || 0} · Cost ${EventSystem.DOMAIN_ENERGY} energy · 1h cooldown\n_Works only inside the Events GC during an event._`); }
      if (!inGC) return needGC();
      const r = EventSystem.castDomain(db, player, chatId); if (!r.ok) return say(`❌ ${r.error}`);
      saveDatabase(db);
      // The name, the description and the effect go out as SEPARATE messages.
      for (const t of r.messages) { await sock.sendMessage(chatId, { text: t }); }
      return;
    }
    return say(EventSystem.status(db));
  },
};
