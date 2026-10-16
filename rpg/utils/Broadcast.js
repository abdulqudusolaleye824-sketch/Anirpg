// ═══════════════════════════════════════════════════════════════
// Broadcast — Push #102h. Owner announcement to EVERY registered hunter.
//   • Always on: every player in db.users gets it (no opt-in list).
//   • Routing: hunters with a serf get it FROM their serf; everyone else gets
//     it from the bot the command was typed on (iron wall bypassed on purpose).
//   • Resumable: progress is saved in db.broadcastJob after every send, so if
//     the sending bot dies / gets banned mid-way, `/broadcast resume` on ANY
//     other bot continues from where it stopped (already-sent hunters skipped).
//   • Pace: ≤1 msg / 1.2 s per socket (bot cap is 2 msg/s).
// ═══════════════════════════════════════════════════════════════
'use strict';

const DELAY_MS = 1200;
const bare = (j) => String(j || '').split(':')[0].split('@')[0];

function recipients(db) {
  const out = []; const seen = new Set();
  for (const [k, u] of Object.entries(db.users || {})) {
    if (!u || typeof u !== 'object') continue;
    let jid = String(u.jid || u.id || k);
    if (!jid.includes('@')) jid = `${jid}@s.whatsapp.net`;
    if (jid.endsWith('@g.us')) continue;
    // @lid hunters are messaged at their lid (Baileys delivers to lids fine)
    const b = bare(jid); if (!b || seen.has(b)) continue; seen.add(b);
    out.push(jid);
  }
  return out;
}

function format(text) {
  return ['━━━━━━━━━━━━━━━━━━━━━━━━━━━', '📣 *✦ 𝐀𝐬𝐭𝐫𝐚™ ANNOUNCEMENT* 📣', '━━━━━━━━━━━━━━━━━━━━━━━━━━━', '', String(text).trim(), '', '━━━━━━━━━━━━━━━━━━━━━━━━━━━', '_Official broadcast from the owners._'].join('\n');
}

function start(db, text, byJid) {
  const list = recipients(db);
  db.broadcastJob = { id: `bc-${Date.now()}`, text: String(text), by: bare(byJid), startedAt: Date.now(), total: list.length, pending: list, done: {}, viaSerf: 0, viaBot: 0, failed: 0, failedList: [], status: 'running', runs: 0 };
  return db.broadcastJob;
}

function current(db) { const j = db && db.broadcastJob; return j && j.status !== 'finished' ? j : null; }

/** Run (or resume) the job on `sock`. Calls onProgress(job) every 10 sends. Returns the job. */
async function run(job, sock, db, saveDatabase, { onProgress, delayMs = DELAY_MS } = {}) {
  if (!job || job.status === 'finished') return job;
  if (job.running) return job; // another socket is already on it
  job.running = true; job.runs = (job.runs || 0) + 1; job.status = 'running'; job.lastBot = sock?.user?.id || null;
  const body = format(job.text);
  let SerfDM = null; try { SerfDM = require('./SerfDM'); } catch (e) {}
  let n = 0;
  try {
    while (job.pending.length) {
      // stop cleanly if THIS socket died — the job stays resumable on another bot
      if (!sock || !sock.user || !sock.user.id || sock.ws?.readyState === 3) { job.status = 'paused'; job.pauseReason = 'bot offline'; break; }
      const jid = job.pending[0];
      let via = null, err = null;
      try {
        const sr = SerfDM && SerfDM.getSerfSocket ? SerfDM.getSerfSocket(db, jid) : { ok: false };
        if (sr && sr.ok && sr.serfSock) { await sr.serfSock.sendMessage(jid, { text: body }, { asSelf: true }); via = 'serf'; }
        else { await sock.sendMessage(jid, { text: body }, { asSelf: true }); via = 'bot'; }
      } catch (e) { err = e && e.message ? e.message : String(e); }
      job.pending.shift();
      if (via) { job.done[bare(jid)] = via; if (via === 'serf') job.viaSerf++; else job.viaBot++; }
      else { job.failed++; if (job.failedList.length < 50) job.failedList.push(`${bare(jid)}: ${err}`); job.lastError = err; }
      n++;
      if (n % 10 === 0) { try { saveDatabase && saveDatabase(); } catch (e) {} try { onProgress && onProgress(job); } catch (e) {} }
      // 3 consecutive hard failures from this socket → pause so another bot can take over (ban / rate-limit).
      if (!via) { job.consecFail = (job.consecFail || 0) + 1; if (job.consecFail >= 3 && !/not-registered|item-not-found|404/.test(String(err))) { job.status = 'paused'; job.pauseReason = `3 sends in a row failed from this bot (${err})`; break; } }
      else job.consecFail = 0;
      await new Promise(r => setTimeout(r, delayMs));
    }
    if (!job.pending.length) { job.status = 'finished'; job.finishedAt = Date.now(); }
  } finally { job.running = false; try { saveDatabase && saveDatabase(); } catch (e) {} }
  return job;
}

function summary(job, FRAME = '━━━━━━━━━━━━━━━━━━━━━━━━━━━') {
  const sent = job.viaSerf + job.viaBot;
  const L = [FRAME, job.status === 'finished' ? '✅ *BROADCAST COMPLETE*' : job.status === 'paused' ? '⏸️ *BROADCAST PAUSED*' : '📣 *BROADCAST IN PROGRESS*', FRAME,
    `📨 Delivered: *${sent}/${job.total}*`, `  🤝 via serfs: ${job.viaSerf}`, `  🤖 via this bot: ${job.viaBot}`, `❌ Failed: ${job.failed}`, `⏳ Remaining: ${job.pending.length}`];
  if (job.status === 'paused') L.push(``, `Reason: ${job.pauseReason || '—'}`, `▶️ Type */broadcast resume* on ANY other bot to continue (sent hunters are skipped).`);
  if (job.status === 'finished' && job.failed) L.push(``, `Failed numbers (first ${Math.min(10, job.failedList.length)}):`, ...job.failedList.slice(0, 10).map(x => `  • ${x}`));
  L.push(FRAME);
  return L.join('\n');
}

module.exports = { recipients, format, start, current, run, summary, DELAY_MS };
