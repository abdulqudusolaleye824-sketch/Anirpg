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
  aliases: ['jeju', 'ea', 'e'],
  description: '🏝️ Jeju Island Raid — /event start|status|attack|hit|domain|lb|end',
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid; const db = getDatabase();
    // Push #96h-z: every event message carries the hunters' tags (names are rendered "Name @number"),
    // and a slow socket ("send timed out") can never surface as a command error.
    const _mentionsOf = (text) => { const out = new Set(); for (const m of String(text || '').matchAll(/@(\d{5,})/g)) { const d = m[1]; const key = Object.keys(db.users || {}).find(k => k.split('@')[0].split(':')[0] === d); out.add(key || `${d}@s.whatsapp.net`); } return [...out]; };
    const send = async (content, quoted = true) => { try { const ms = [...new Set([...(content.mentions || []), ..._mentionsOf(content.text)])]; return await sock.sendMessage(chatId, { ...content, ...(ms.length ? { mentions: ms } : {}) }, quoted ? { quoted: msg } : undefined); } catch (e) { console.error('[event] send:', e.message); return null; } };
    const say = (text, extra = {}) => send({ text, ...extra });
    const player = db.users[sender];
    if (!player) return say('❌ Not registered! Use /register first.');
    const sub = (args[0] || 'status').toLowerCase();
    const inGC = EventSystem.isEventGC(db, chatId);
    const needGC = () => say(EventSystem.gcId(db) ? '🏝️ The Jeju Island Raid is fought in the *Events GC* only.' : '🏝️ No Events GC is set yet — an owner must run */setgc events --main* there.');

    if (sub === 'lb' || sub === 'leaderboard' || sub === 'top') return say(EventSystem.leaderboardText(db, 10));
    if (false) {
      const lb = EventSystem.leaderboard(db, 10);
      if (!db.event) return say('🎪 No event has run yet — the leaderboard opens with the first one.');
      return say([`🏆 *JEJU ISLAND RAID — LEADERBOARD*${db.event.active ? '' : ' (final)'}`, ...(lb.length ? lb.map((e, i) => `${['🥇', '🥈', '🥉'][i] || `${i + 1}.`} *${e.name}* — ${e.points.toLocaleString()} pts · ${e.kills} kills · ${e.hunterKills} hunter kills`) : ['_Nobody has scored yet._'])].join('\n'));
    }
    if (sub === 'status' || sub === 'info') return say(EventSystem.status(db));
    if (sub === 'join') { const r = EventSystem.join(db, player); if (!r.ok) return say(`❌ ${r.error}`); saveDatabase(db); for (const t of r.messages) await send({ text: t }, false); return; }
    if (sub === 'start') {
      if (!Perms.isBotOwner(db, sender)) return say('❌ Only an owner can start the event.');
      if (!inGC) return needGC();
      const r = EventSystem.start(db, sender); if (!r.ok) return say(`❌ ${r.error}`);
      saveDatabase(db);
      return say([`🏝️ *THE JEJU ISLAND RAID HAS BEGUN!*`, `For *10 days* the island belongs to whoever takes it.`, ``, `🌊 Each wave: *${EventSystem.WAVE_SIZE} beasts + 1 boss*. Clear it and a stronger wave rises.`, `🏝️ */ejoin* — enter the island (you get your event domain, then name + describe it).`, `⚔️ */event attack [beast] [skill | #pattern]* — strike a beast with a class skill or an equipped attack pattern (nothing named → your strongest ready skill). */event buff <skill>* — heals, shields, buffs. Beasts: *10 pts*, wave boss: *100 pts*. Everyone fights at *Event Lv.1* (E-Rank beast stats) — kills give event EXP (Pro ×2), levels raise your island stats, 🔮 artifacts drop from beasts (*/event grab* the island spawn). */event stats* shows your event level, HP, ATK, DEF, SPD, CRIT · */event skills* lists your usable skills + patterns · */elb* top hunters. Bosses carry artifacts; 5 surface on the island per day (Claim button). Beasts only counter, never start a fight; left alone 30s they regenerate.`, `🗡️ */event attack @hunter [skill]* — tag a hunter in your attack. They get *20 seconds* to retaliate with their own attack, then both moves land at once. Kill a hunter: take *50%* of their points, theirs reset to *0*.`, `💀 Die and you wait *1 hour* to respawn (*30 min* for Pro).`, `🛌 */eventafk* — untouchable, but you cannot attack.`, `🌌 */event domain* — your *Lv.10 event domain* (name it: /event domain name …).`, `🏅 */epoints* · */estats* · */eshop* · */event lb*`, ``, `Hunters of *all levels* may join. Good hunting.`].join('\n'));
    }
    if (sub === 'end' || sub === 'stop') {
      if (!Perms.isBotOwner(db, sender)) return say('❌ Only an owner can end the event.');
      const ev = EventSystem.end(db, 'owner'); if (!ev) return say('No event is running.');
      saveDatabase(db); const lb = EventSystem.leaderboard(db, 3);
      return say([`🏁 *JEJU ISLAND RAID — OVER.* Waves cleared: ${ev.wavesCleared}`, ...lb.map((e, i) => `${['🥇', '🥈', '🥉'][i]} ${e.name} — ${e.points.toLocaleString()} pts`), `\n_Points can still be spent in /eshop._`].join('\n'));
    }
    // Any expired 20s windows resolve first (so a clash never hangs if the timer died).
    try { for (const r of EventSystem.resolveExpired(db)) await send({ text: r.text }, false); } catch (e) {}
    if (sub === 'grab' || sub === 'artifact' || sub === 'take') {
      if (!inGC) return needGC();
      const r = EventSystem.grabArtifact(db, player); if (!r.ok) return say(`❌ ${r.error}`); saveDatabase(db); return say(r.text);
    }
    if (sub === 'stats' || sub === 'me' || sub === 'level' || sub === 'lvl') { const tj = Target.resolve(msg, []); const who = (tj && _findUser(db, tj)) || player; return say(EventSystem.statsText(db, who)); }
    try { const al = EventSystem.artifactAlert(db); if (al) { saveDatabase(db); let _s = false; try { const B = require('../../utils/buttons'); if (B && B.sendButtons) { await B.sendButtons(sock, chatId, { text: al, buttons: B.quickReplies([['🔮 Claim artifact', '/event grab']]) }, msg); _s = true; } } catch (e) {} if (!_s) await send({ text: al }, false); } } catch (e) {}
    if (sub === 'skills' || sub === 'loadout' || sub === 'moves') return say(EventSystem.loadoutText(db, player));
    // Push #96h-y: the three answers to being targeted (buttons under the challenge).
    if (sub === 'counter' || sub === 'flee' || sub === 'dodge') {
      if (!inGC) return needGC();
      const r = sub === 'counter' ? EventSystem.counterPending(db, player) : sub === 'flee' ? EventSystem.fleePending(db, player) : EventSystem.dodgePending(db, player);
      if (!r.ok) return say(`❌ ${r.error}`); saveDatabase(db); return say(r.text);
    }
    // Push #96h-y: buffs / heals / shields — /event buff <skill> (any class's support skills).
    if (sub === 'buff' || sub === 'support' || sub === 'heal' || sub === 'cast') {
      if (!inGC) return needGC();
      const name = args.slice(1).join(' ').trim(); if (!name) return say('✨ Usage: */event buff <support skill>* — heals, shields and buffs from your /skills.');
      const r = EventSystem.supportSkill(db, player, name); if (!r.ok) return say(`❌ ${r.error}`); saveDatabase(db); return say(r.text);
    }
    if (sub === 'attack' || sub === 'a' || sub === 'strike' || sub === 'hit' || sub === 'pk' || sub === 'skill' || sub === 's') {
      if (!inGC) return needGC();
      const tj = Target.resolve(msg, []); // a TAGGED hunter inside your attack = hunter vs hunter
      const rest = args.slice(1).filter(a => !a.startsWith('@'));
      const victim = tj ? _findUser(db, tj) : null; // a reply to a bot card / unregistered → beast attack
      if (tj && victim && victim !== player) {
        const skill = rest.join(' ').trim() || null; // Push #96h-y: "#12" = attack pattern, otherwise a skill name
        const r = EventSystem.attackHunter(db, player, victim, skill); if (!r.ok) return say(`❌ ${r.error}`);
        saveDatabase(db);
        if (r.pending) {
          // Push #96h-y: Counter / Flee / Dodge+counter buttons for the targeted hunter.
          let _sent = false;
          try { const B = require('../../utils/buttons'); if (B && B.sendButtons) { await B.sendButtons(sock, chatId, { text: r.text, mentions: [...new Set([tj, ..._mentionsOf(r.text)])], buttons: B.quickReplies([[`⚔️ Counter (base ATK)`, `/event counter`], [`🏃 Flee (escape)`, `/event flee`], [`💨 Dodge + counter`, `/event dodge`]]) }, msg); _sent = true; } } catch (e) { _sent = false; }
          if (!_sent) await say(r.text, { mentions: [tj] });
        } else await say(r.text, { mentions: [tj] });
        if (r.pending) { // 20s retaliation window → resolve both moves at once
          const vid = victim.jid || victim.id || victim.name;
          setTimeout(async () => { try { const d2 = getDatabase(); const res = EventSystem.resolvePending(d2, vid); if (res.ok) { saveDatabase(d2); await send({ text: res.text }, false); } } catch (e) {} }, EventSystem.RETALIATE_MS + 500);
        }
        return;
      }
      // Push #96h-y: plain number = beast id · "#12" = attack pattern · words = skill name.
      const _hasId = rest[0] && /^\d+$/.test(rest[0]); const _skill = rest.slice(_hasId ? 1 : 0).join(' ').trim() || null;
      const r = EventSystem.attackMonster(db, player, _hasId ? rest[0] : null, _skill);
      if (!r.ok) return say(`❌ ${r.error}`); saveDatabase(db);
      // Push #96h-x: the island fights read exactly like a dungeon — the shared step-by-step battle flow.
      if (r.flow) {
        try {
          const UC = require('../../rpg/utils/UnifiedCombat'); const f = r.flow;
          const monWrap = { name: f.monster.name, stats: { hp: f.monster.hp, maxHp: f.monster.maxHp }, statusEffects: f.monster.statusEffects };
          const move = f.move || UC.basicStrike();
          // Push #96h-z: the whole turn (strike + counter + results) goes out as ONE message — the old 11-message
          // burst is what made busy sockets time out ("send timed out after 20s").
          const me = f.hunter.player || player; const meName = f.hunter.name || player.name;
          const t1 = await UC.playTurn(sock, chatId, { attacker: { ...me, name: meName }, defender: monWrap, move, result: { ...f.result, preAbsorbed: true }, tag: f.move ? `✨ *EVENT SKILL*` : `⚔️ *EVENT ATTACK*`, defenderBar: 'monster', silent: true });
          const parts = [t1.texts.join('\n')];
          if (f.counter) {
            const c = f.counter; const sk = c.monsterSkill; const skName = sk ? (sk.name || 'Strike') : 'Savage Counter';
            const meWrap = { name: meName, stats: { hp: c.playerHpBefore, maxHp: c.playerMaxHp }, statusEffects: player.statusEffects || [] };
            const t2 = await UC.playTurn(sock, chatId, { attacker: { name: f.monster.name, stats: { hp: c.monsterHp, maxHp: c.monsterMaxHp }, statusEffects: f.monster.statusEffects }, defender: meWrap, move: { name: skName, description: sk ? `A ferocious ${String(skName).replace(/^[^\s]+\s/, '')} technique.` : 'The beast answers the blow with one of its own.', cooldownMs: 0, effect: null }, result: { damage: c.dmg, crit: !!c.crit, missed: false, preAbsorbed: true }, tag: `🩸 *BEAST COUNTERS*`, defenderBar: 'player', silent: true });
            parts.push(t2.texts.join('\n'));
          }
          if (r.tailText && r.tailText.trim()) parts.push(r.tailText);
          await say(parts.join('\n\n'));
          return;
        } catch (e) { console.error('[event] rich flow:', e.message); }
      }
      return say(r.text);
    }
    if (sub === 'domain' || sub === 'de') {
      const what = (args[1] || '').toLowerCase();
      if (what === 'name') { const r = EventSystem.setDomainName(player, args.slice(2).join(' ')); if (r.ok) saveDatabase(db); return say(r.ok ? `${r.text}\n_Now: /event domain desc <description>_` : `❌ ${r.error}`); }
      if (what === 'desc' || what === 'description') { const r = EventSystem.setDomainDesc(player, args.slice(2).join(' ')); if (r.ok) saveDatabase(db); return say(r.ok ? `${r.text}\n_Cast it in the Events GC with /event domain_` : `❌ ${r.error}`); }
      if (what === 'info' || what === 'show') { const d = EventSystem.domainState(player); return say(`🌌 *EVENT DOMAIN (Lv.${EventSystem.DOMAIN_LEVEL})*\nName: ${d.name || '— (/event domain name <name>)'}\nDescription: ${d.desc || '— (/event domain desc <text>)'}\nCasts: ${d.casts || 0} · Cost ${EventSystem.DOMAIN_ENERGY} energy · 1h cooldown\n_Works only inside the Events GC during an event._`); }
      if (!inGC) return needGC();
      const r = EventSystem.castDomain(db, player, chatId); if (!r.ok) return say(`❌ ${r.error}`);
      saveDatabase(db);
      // The name, the description and the effect go out as SEPARATE messages.
      for (const t of r.messages) { await send({ text: t }, false); }
      return;
    }
    return say(EventSystem.status(db));
  },
};
