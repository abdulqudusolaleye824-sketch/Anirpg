// /exile — network-wide permanent removal (Push #101). Owner, DM only, two confirmations.
'use strict';
const Perms = require('../../utils/permissions');
const Exile = require('../../rpg/utils/Exile');

const _pending = {}; // ownerBare -> { number, reason, step, at }
const STEP_TTL_MS = 10 * 60 * 1000;

module.exports = {
  name: 'exile', aliases: ['banish'],
  description: '👑 Owner (DM): permanently remove a number from every Astra group on every bot, block it, wipe its account; auto-kick if it ever returns',
  usage: '/exile <number> [reason] · /exile confirm · /exile list · /exile lift <number>', ownerOnly: true,
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid; const db = getDatabase();
    if (!Perms.isBotOwner(db, sender)) return sock.sendMessage(chatId, { text: '❌ Owner only.' }, { quoted: msg });
    if (String(chatId).endsWith('@g.us')) return sock.sendMessage(chatId, { text: '🔒 /exile works in my DM only.' }, { quoted: msg });
    const me = Exile.bare(sender);
    const sub = String(args[0] || '').toLowerCase();
    let MSM = null; try { MSM = require('../../bots/MultiSocketManager'); } catch (e) {}
    const sockets = (() => { try { return MSM?.getAllSockets?.() || {}; } catch (e) { return {}; } })();
    const B = (() => { try { return require('../../utils/buttons'); } catch (e) { return null; } })();
    const send = async (text, buttons) => {
      if (buttons && B && B.sendButtons) { try { return await B.sendButtons(sock, chatId, { text, buttons: B.quickReplies(buttons) }); } catch (e) {} }
      return sock.sendMessage(chatId, { text }, { quoted: msg });
    };

    if (sub === 'list') {
      const L = Exile.list(db);
      if (!L.length) return send('📭 No one is exiled.');
      return send(['🚷 *EXILED* (' + L.length + ')', '', ...L.map(r => `• +${r.bare} — ${r.reason} · since ${new Date(r.at).toISOString().slice(0, 10)} · auto-kicked ${r.kicks || 0}×${r.lids?.length ? ` · ${r.lids.length} linked id(s)` : ''}`), '', '/exile lift <number> to reverse.'].join('\n'));
    }
    if (sub === 'lift' || sub === 'pardon' || sub === 'undo') {
      const r = Exile.lift(db, args[1]); if (!r.ok) return send(r.text);
      saveDatabase();
      let unblocked = 0;
      for (const s of Object.values(sockets)) { for (const j of [`${r.bare}@s.whatsapp.net`]) { try { await s.updateBlockStatus(j, 'unblock'); unblocked++; } catch (e) {} } }
      return send(`✅ Exile lifted for +${r.bare}. Unblocked on ${unblocked} bot(s). They may rejoin via a normal invite; their old account is NOT restored.`);
    }
    if (sub === 'cancel') { delete _pending[me]; return send('🚫 Exile cancelled. Nothing was done.'); }

    if (sub === 'confirm') {
      const p = _pending[me];
      if (!p || Date.now() - p.at > STEP_TTL_MS) { delete _pending[me]; return send('⚠️ Nothing to confirm (or it expired). Start again with /exile <number> [reason].'); }
      if (p.step === 1) {
        p.step = 2; p.at = Date.now();
        return send([`⚠️ *FINAL CONFIRMATION* — +${p.number}`, '', 'This will:', '• remove them from EVERY Astra group on EVERY bot', '• block them on every bot (silent — no commands, no DMs)', '• wipe their RPG account, guilds and keys (no undo)', '• auto-kick them within seconds if they ever rejoin', '', 'Only /exile lift can reverse the ban (the account stays wiped).', '', 'Tap *EXILE NOW* to execute.'].join('\n'),
          [['🚷 EXILE NOW', '/exile confirm'], ['✖️ Cancel', '/exile cancel']]);
      }
      // step 2 → execute
      delete _pending[me];
      const r = Exile.add(db, p.number, sender, p.reason); if (!r.ok) return send(r.text);
      const log = []; const wiped = Exile.wipeAccount(db, r.bare, log);
      saveDatabase();
      await send(`⏳ Exiling +${r.bare}… sweeping every group on ${Object.keys(sockets).length} bot(s).`);
      const sw = await Exile.sweepAll(sockets, db, r.bare);
      saveDatabase();
      return send([`🚷 *EXILED* — +${r.bare}`, `📝 ${r.rec.reason}`, '', `👢 Removed from ${sw.kicked} group seat(s) across ${sw.groups} group(s)`, `🚫 Blocked on ${sw.blocked} bot(s)`, `🗑️ Account wiped: ${wiped ? 'yes' : 'no account found'}${r.rec.lids.length ? ` · ${r.rec.lids.length} linked id(s) included` : ''}`, '', 'If they rejoin any group they are removed automatically. /exile list · /exile lift <number>'].join('\n'));
    }

    // start: /exile <number> [reason]
    const number = Exile.bare(args[0]);
    if (!number || number.length < 7) return send('Usage: */exile <number> [reason]*\nExample: /exile 2348012345678 harassment in Support\n\n/exile list · /exile lift <number>');
    if (Perms.isBotOwner(db, `${number}@s.whatsapp.net`) || Perms.isBotOwner(db, number)) return send('❌ Owners cannot be exiled.');
    const ex = Exile.isExiled(db, number); if (ex) return send(`⚠️ +${number} is already exiled.`);
    const reason = args.slice(1).join(' ').trim();
    const u = Object.entries(db.users || {}).find(([j]) => Exile.identities(db, number).includes(Exile.bare(j)));
    _pending[me] = { number, reason, step: 1, at: Date.now() };
    return send([`🚷 *EXILE — step 1 of 2*`, '', `Target: +${number}${u ? ` (hunter *${u[1].name || '?'}*, Lv.${u[1].level || 1})` : ' (no RPG account found)'}`, `Reason: ${reason || '—'}`, '', 'This is permanent and network-wide. You will be asked once more.', '', 'Tap *Continue* or /exile confirm.'].join('\n'),
      [['➡️ Continue', '/exile confirm'], ['✖️ Cancel', '/exile cancel']]);
  },
};
