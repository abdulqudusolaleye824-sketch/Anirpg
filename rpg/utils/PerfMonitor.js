/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║           Astra — PerfMonitor (event-loop + persistence)     ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * Push #47. "The bot is slow / not responding" was never observable before: the
 * cost was the whole-document serialize on every save (381 call sites), which
 * blocks the loop the WhatsApp sockets need. This module makes it visible and
 * cheap to check:
 *
 *   • counters.writes / serializes / coalescedSaves  → is persistence thrashing?
 *   • counters.lastSerializeMs / lastWriteMs          → how long the loop stalls
 *   • counters.lagMs / maxLagMs                       → measured event-loop drift
 *   • a throttled 🐌 log line whenever lag > 1.5s
 *
 * Exposed in chat via /dbstatus and over HTTP at /api/db-health.
 */
'use strict';

const LAG_WARN_MS = 1500;
const LAG_THROTTLE_MS = 60_000;

const counters = {
  writes: 0,
  serializes: 0,
  coalescedSaves: 0,
  savesRequested: 0,
  lagMs: 0,
  maxLagMs: 0,
  lastSerializeMs: 0,
  lastWriteMs: 0,
  startedAt: Date.now(),
};

let _last = 0;
let _warnAt = 0;

/** One tick of the 1s heartbeat — drift = time the loop could not run. */
function tick() {
  try {
    const now = Date.now();
    if (_last) {
      const drift = now - _last - 1000;
      counters.lagMs = Math.max(0, drift);
      if (drift > counters.maxLagMs) counters.maxLagMs = drift;
      if (drift > LAG_WARN_MS && now - _warnAt > LAG_THROTTLE_MS) {
        _warnAt = now;
        console.error(`🐌 EVENT LOOP LAG ${drift}ms — blocked the loop (last serialize ${counters.lastSerializeMs}ms, writes ${counters.writes}, saves merged ${counters.coalescedSaves}). If this repeats, check DB size and inline blobs: /dbstatus`);
      }
    }
    _last = now;
  } catch (e) { /* monitoring must never break the bot */ }
}

function snapshot() {
  return {
    ...counters,
    uptimeSec: Math.round((Date.now() - counters.startedAt) / 1000),
    savesPerWrite: counters.writes ? +(counters.savesRequested / counters.writes).toFixed(1) : 0,
  };
}

function format() {
  const s = snapshot();
  return [
    `⏱️ *PERFORMANCE*`,
    `  🐌 loop lag now: *${s.lagMs}ms* · worst: *${s.maxLagMs}ms*`,
    `  🧮 serialize cost: *${s.lastSerializeMs}ms* · mirror write: *${s.lastWriteMs}ms*`,
    `  💾 writes: *${s.writes}* · serializes: *${s.serializes}* · saves merged: *${s.coalescedSaves}*`,
    `  📊 saveDatabase() calls per actual write: *${s.savesPerWrite}* (higher = the coalescer is doing its job)`,
  ].join('\n');
}

module.exports = { counters, tick, snapshot, format, LAG_WARN_MS };
