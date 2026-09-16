/**
 * AstraLink's HTTP port is the one part of this bot that the whole internet can
 * reach: the user opens it from their phone to link a number. Read routes are
 * harmless, but the state-changing ones are not — /api/release-device-slots can
 * log a bot out of WhatsApp, a pairing request can wipe a session, and a deploy
 * endpoint restarts (and rewrites) the process. So those require a shared secret.
 *
 * ASTRALINK_ADMIN_TOKEN (or ADMIN_API_TOKEN) is read at call time, so it can be
 * set/unset without a code change. Destructive routes FAIL CLOSED: with no token
 * configured they refuse and say why, rather than silently running in the open.
 */
'use strict';
const crypto = require('crypto');

const RATE_WINDOW_MS = Number(process.env.ASTRALINK_RATE_WINDOW_MS || 60000);
const RATE_LIMIT = Number(process.env.ASTRALINK_RATE_LIMIT || 6);
const _buckets = new Map();

function token() {
  return String(process.env.ASTRALINK_ADMIN_TOKEN || process.env.ADMIN_API_TOKEN || '').trim();
}

function configured() { return token().length >= 8; }

function presented(req, url) {
  try {
    const q = url && url.searchParams ? url.searchParams.get('token') : null;
    if (q) return String(q);
  } catch (e) {}
  const h = req.headers || {};
  if (h['x-astralink-token']) return String(h['x-astralink-token']);
  const auth = String(h.authorization || '');
  if (/^bearer\s+/i.test(auth)) return auth.replace(/^bearer\s+/i, '').trim();
  return '';
}

// Compare digests so a wrong-length guess costs the same as a wrong-content one.
function tokenOk(req, url) {
  const want = token();
  if (!want) return false;
  const got = presented(req, url);
  if (!got) return false;
  const a = crypto.createHash('sha256').update(got).digest();
  const b = crypto.createHash('sha256').update(want).digest();
  try { return crypto.timingSafeEqual(a, b); } catch (e) { return false; }
}

function rateOk(bucket) {
  const now = Date.now();
  const hit = _buckets.get(bucket);
  if (!hit || now > hit.resetAt) { _buckets.set(bucket, { n: 1, resetAt: now + RATE_WINDOW_MS }); return { ok: true, remaining: RATE_LIMIT - 1 }; }
  hit.n += 1;
  if (hit.n > RATE_LIMIT) return { ok: false, retryInMs: Math.max(500, hit.resetAt - now) };
  return { ok: true, remaining: RATE_LIMIT - hit.n };
}

/**
 * gate() answers the request itself and returns false when the caller must stop.
 * mode 'locked'  → token mandatory, refuse everything if none is configured
 *                  (for anything that can destroy state).
 * mode 'soft'    → token required only once one is configured; otherwise rate
 *                  limited, so an operator who has not set a secret yet is not
 *                  locked out of their own linking flow.
 */
function gate(res, req, url, { mode = 'locked', bucket = 'astralink' } = {}) {
  const send = (code, obj) => {
    try {
      res.writeHead(code, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(obj));
    } catch (e) {}
  };
  if (mode === 'soft' && !configured()) {
    const r = rateOk(bucket);
    if (!r.ok) {
      send(429, { success: false, error: 'Too many attempts — wait a minute and try again.', retryInMs: r.retryInMs });
      return false;
    }
    return true;
  }
  if (!configured()) {
    send(503, {
      success: false, disabled: true,
      error: 'This action is disabled until ASTRALINK_ADMIN_TOKEN is set in .env. This port is open to the internet, so anything that can log a bot out or redeploy it needs a secret. Add a line like ASTRALINK_ADMIN_TOKEN=<long random string> to .env, restart once, then use the token in the page.',
    });
    return false;
  }
  if (!tokenOk(req, url)) {
    send(401, { success: false, needsToken: true, error: 'Admin token missing or wrong. Append ?token=… (the token is the ASTRALINK_ADMIN_TOKEN value from .env).' });
    return false;
  }
  return true;
}

module.exports = { token, configured, tokenOk, rateOk, gate, _buckets };
