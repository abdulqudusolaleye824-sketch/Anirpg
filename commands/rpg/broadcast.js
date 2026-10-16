/**
 * /broadcast — Owner announcement to EVERY registered hunter (Push #102h rewrite).
 *   /broadcast <message>   — start (serf-routed where a serf exists, else from this bot)
 *   /broadcast resume      — continue a paused/unfinished broadcast from THIS bot (use after a ban / crash)
 *   /broadcast status      — progress of the current job
 *   /broadcast cancel      — drop the current job
 */
'use strict';

const Perms = require('../../utils/permissions');
const BC = require('../../rpg/utils/Broadcast');

module.exports = {
  name: 'broadcast',
  description: '📣 Owner: announce to every hunter (serf-routed, resumable from any bot)',
  ownerOnly: true,

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    if (!Perms.isBotOwner(db, sender)) return sock.sendMessage(chatId, { text: '❌ *Owner only.*' }, { quoted: msg });

    const sub = String(args[0] || '').toLowerCase();
    const job = BC.current(db);

    if (sub === 'status') {
      if (!job && !(db.broadcastJob)) return sock.sendMessage(chatId, { text: '📣 No broadcast yet.' }, { quoted: msg });
      return sock.sendMessage(chatId, { text: BC.summary(job || db.broadcastJob) }, { quoted: msg });
    }
    if (sub === 'cancel') {
      if (!job) return sock.sendMessage(chatId, { text: '📣 Nothing to cancel.' }, { quoted: msg });
      job.status = 'finished'; job.cancelled = true; job.pending = []; saveDatabase();
      return sock.sendMessage(chatId, { text: '🛑 Broadcast cancelled.' }, { quoted: msg });
    }

    let active = job;
    if (sub === 'resume' || sub === 'continue') {
      if (!job) return sock.sendMessage(chatId, { text: '📣 No unfinished broadcast to resume.' }, { quoted: msg });
      if (job.running) return sock.sendMessage(chatId, { text: '📣 It is still running on another bot — wait or /broadcast status.' }, { quoted: msg });
      await sock.sendMessage(chatId, { text: `▶️ Resuming broadcast from this bot — ${job.pending.length} hunters left (${job.viaSerf + job.viaBot} already delivered).` }, { quoted: msg });
    } else {
      const message = args.join(' ').trim();
      if (!message) {
        return sock.sendMessage(chatId, { text: ['📣 *BROADCAST*', '', '/broadcast <message> — send to EVERY hunter', '/broadcast status · resume · cancel', '', 'Hunters with a serf receive it from their serf; the rest from this bot. If this bot drops mid-way, type */broadcast resume* on another bot.'].join('\n') }, { quoted: msg });
      }
      if (job && job.pending.length) {
        return sock.sendMessage(chatId, { text: `⚠️ A broadcast is still unfinished (${job.pending.length} left). */broadcast resume* to continue it or */broadcast cancel* first.` }, { quoted: msg });
      }
      active = BC.start(db, message, sender); saveDatabase();
      const serfCount = (() => { try { const S = require('../../rpg/utils/SerfDM'); return active.pending.filter(j => S.getSerfSocket(db, j).ok).length; } catch (e) { return 0; } })();
      await sock.sendMessage(chatId, { text: `📣 Broadcasting to *${active.total}* hunters — ~${serfCount} via their serfs, ~${active.total - serfCount} via this bot. ETA ~${Math.ceil(active.total * BC.DELAY_MS / 60000)} min. I'll report when done.` }, { quoted: msg });
    }

    // Run in the background — the command returns at once, progress is persisted after every send.
    (async () => {
      try {
        const j = await BC.run(active, sock, db, saveDatabase);
        await sock.sendMessage(chatId, { text: BC.summary(j) }, { quoted: msg });
      } catch (e) {
        try { await sock.sendMessage(chatId, { text: `❌ Broadcast stopped: ${e.message}\n▶️ */broadcast resume* on another bot continues it.` }, { quoted: msg }); } catch (_) {}
      }
    })();
  },
};
