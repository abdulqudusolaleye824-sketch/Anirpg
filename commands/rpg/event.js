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
      if (!db.event) return say('🎪 No event has run yet — the leaderboard opens with the first one.');
      return say([`🏆 *JEJU ISLAND RAID — LEADERBOARD*${db.event.active ? '' : ' (final)'}`, ...(lb.length ? lb.map((e, i) => `${['🥇', '🥈', '🥉'][i] || `${i + 1}.`} *${e.name}* — ${e.points.toLocaleString()} pts · ${e.kills} kills · ${e.hunterKills} hunter kills`) : ['_Nobody has scored yet._'])].join('\n'));
    }
    if (sub === 'status' || sub === 'info') return say(EventSystem.status(db));
    if (sub === 'join') { const r = EventSystem.join(db, player); if (!r.ok) return say(`❌ ${r.error}`); saveDatabase(db); for (const t of r.messages) await sock.sendMessage(chatId, { text: t }); return; }
    if (sub === 'start') {
      if (!Perms.isBotOwner(db, sender)) return say('❌ Only an owner can start the event.');
      if (!inGC) return needGC();
      const r = EventSystem.start(db, sender); if (!r.ok) return say(`❌ ${r.error}`);
      saveDatabase(db);
      return say([`🏝️ *THE JEJU ISLAND RAID HAS BEGUN!*`, `For *10 days* the island belongs to whoever takes it.`, ``, `🌊 Each wave: *${EventSystem.WAVE_SIZE} beasts + 1 boss*. Clear it and a stronger wave rises.`, `🏝️ */ejoin* — enter the island (you get your event domain, then name + describe it).`, `⚔️ */event attack [#] [skill]* — strike a beast; gear, passives and class skills are wired in (no skill named → your strongest ready skill). Beasts only counter, never start a fight; left alone 30s they regenerate.`, `🗡️ */event attack @hunter [skill]* — tag a hunter in your attack. They get *20 seconds* to retaliate with their own attack, then both moves land at once. Kill a hunter: take *50%* of their points, theirs reset to *0*.`, `💀 Die and you wait *1 hour* to respawn.`, `🛌 */eventafk* — untouchable, but you cannot attack.`, `🌌 */event domain* — your *Lv.10 event domain* (name it: /event domain name …).`, `🏅 */epoints* · */estats* · */eshop* · */event lb*`, ``, `Hunters Lv.${EventSystem.DOMAIN_LEVEL}+ only. Good hunting.`].join('\n'));
    }
    if (sub === 'end' || sub === 'stop') {
      if (!Perms.isBotOwner(db, sender)) return say('❌ Only an owner can end the event.');
      const ev = EventSystem.end(db, 'owner'); if (!ev) return say('No event is running.');
      saveDatabase(db); const lb = EventSystem.leaderboard(db, 3);
      return say([`🏁 *JEJU ISLAND RAID — OVER.* Waves cleared: ${ev.wavesCleared}`, ...lb.map((e, i) => `${['🥇', '🥈', '🥉'][i]} ${e.name} — ${e.points.toLocaleString()} pts`), `\n_Points can still be spent in /eshop._`].join('\n'));
    }
    // Any expired 20s windows resolve first (so a clash never hangs if the timer died).
    try { for (const r of EventSystem.resolveExpired(db)) await sock.sendMessage(chatId, { text: r.text }); } catch (e) {}
    if (sub === 'attack' || sub === 'a' || sub === 'strike' || sub === 'hit' || sub === 'pk' || sub === 'skill' || sub === 's') {
      if (!inGC) return needGC();
      const tj = Target.resolve(msg, []); // a TAGGED hunter inside your attack = hunter vs hunter
      const rest = args.slice(1).filter(a => !a.startsWith('@'));
      const victim = tj ? _findUser(db, tj) : null; // a reply to a bot card / unregistered → beast attack
      if (tj && victim && victim !== player) {
        const skill = rest.filter(a => !/^#?\d+$/.test(a)).join(' ').trim() || null;
        const r = EventSystem.attackHunter(db, player, victim, skill); if (!r.ok) return say(`❌ ${r.error}`);
        saveDatabase(db); await say(r.text, { mentions: [tj] });
        if (r.pending) { // 20s retaliation window → resolve both moves at once
          const vid = victim.jid || victim.id || victim.name;
          setTimeout(async () => { try { const d2 = getDatabase(); const res = EventSystem.resolvePending(d2, vid); if (res.ok) { saveDatabase(d2); await sock.sendMessage(chatId, { text: res.text }); } } catch (e) {} }, EventSystem.RETALIATE_MS + 500);
        }
        return;
      }
      const _hasId = rest[0] && /^#?\d+$/.test(rest[0]); const _skill = rest.slice(_hasId ? 1 : 0).join(' ').trim() || null;
      const r = EventSystem.attackMonster(db, player, _hasId ? rest[0].replace('#', '') : null, _skill);
      if (!r.ok) return say(`❌ ${r.error}`); saveDatabase(db); return say(r.text);
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
