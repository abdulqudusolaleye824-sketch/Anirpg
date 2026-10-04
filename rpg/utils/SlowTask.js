'use strict';
// Push #96h-z13: WHO is blocking the event loop? The lag watchdog says "1.8 s", not what ran.
// Wrap every timer callback + every Baileys event handler; log any single run > SLOW_MS with its origin.
const SLOW_MS = Number(process.env.SLOW_TASK_MS || 250);
let _lastLogAt = 0; const recent = []; // ring of the last 20 slow tasks (for /health, /api/slow)
function note(label, ms) {
  recent.push({ at: Date.now(), label, ms }); if (recent.length > 20) recent.shift();
  const now = Date.now(); if (now - _lastLogAt < 1000) return; _lastLogAt = now;
  const mu = process.memoryUsage();
  console.error(`🐢 SLOW TASK ${ms}ms — ${label} (heap ${Math.round(mu.heapUsed / 1048576)}MB rss ${Math.round(mu.rss / 1048576)}MB)`);
}
function wrap(label, fn) {
  if (typeof fn !== 'function') return fn;
  return function (...args) {
    const t0 = Date.now();
    try { return fn.apply(this, args); }
    finally { const ms = Date.now() - t0; if (ms >= SLOW_MS) note(label, ms); }
  };
}
function _origin() { try { const l = (new Error().stack || '').split('\n')[3] || ''; return l.trim().replace(/^at /, '').replace(process.cwd() + '/', ''); } catch (e) { return '?'; } }
function installTimers() {
  const oi = global.setInterval, ot = global.setTimeout;
  global.setInterval = function (fn, ms, ...rest) { return oi(wrap(`interval@${_origin()}`, fn), ms, ...rest); };
  global.setTimeout = function (fn, ms, ...rest) {
    if (typeof fn !== 'function') return ot(fn, ms, ...rest);
    // cheap: no stack capture per timeout (thousands/min) — resolve the label lazily from the function source
    return ot(function (...a) { const t0 = Date.now(); try { return fn.apply(this, a); } finally { const d = Date.now() - t0; if (d >= SLOW_MS) note(`timeout ${String(fn).slice(0, 90).replace(/\s+/g, ' ')}`, d); } }, ms, ...rest);
  };
  if (oi.__promisify__) global.setInterval.__promisify__ = oi.__promisify__;
  if (ot.__promisify__) global.setTimeout.__promisify__ = ot.__promisify__;
}
module.exports = { wrap, note, installTimers, recent, SLOW_MS };
