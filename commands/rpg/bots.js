// /bots — every linked bot's live state, in one card (Push #99). Owner only.
'use strict';
const Perms = require('../../utils/permissions');

function _ago(ms) { if (!ms) return '—'; const s = Math.round(ms / 1000); return s < 60 ? `${s}s` : s < 3600 ? `${Math.round(s / 60)}m` : `${Math.round(s / 3600)}h`; }

module.exports = {
  name: 'bots', aliases: ['botlist', 'linked'],
  description: '🤖 Live state of every linked bot — online / needs re-link / pairing (owner)',
  ownerOnly: true,
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const db = getDatabase();
    if (!Perms.isBotOwner(db, sender)) return sock.sendMessage(msg.key.remoteJid, { text: '❌ Owner only.' }, { quoted: msg });
    let MSM = null; try { MSM = require('../../bots/MultiSocketManager'); } catch (e) {}
    const health = {}; try { for (const h of (MSM?.botHealthReport?.() || [])) health[h.key] = h; } catch (e) {}
    const parked = (() => { try { return MSM?.relinkStatus?.() || {}; } catch (e) { return {}; } })();
    const pairing = (() => { try { return MSM?.listPairingSessions?.() || {}; } catch (e) { return {}; } })();
    const killed = (() => { try { return (require('../../rpg/utils/BotLane').killedList?.() || []).map(x => x.key); } catch (e) { return []; } })();
    let PM = null; try { PM = require('../../bots/PersonalityManager'); } catch (e) {}
    const SA = MSM?.SqliteAuth || null;
    const keys = new Set([...Object.keys(db.linkedBots || {}), ...Object.keys(health), ...Object.keys(parked)]);
    const now = Date.now();
    const lines = ['🤖 *LINKED BOTS*', ''];
    let online = 0;
    for (const k of [...keys].sort()) {
      const name = (() => { try { return PM?.getDisplayName?.(k) || k; } catch (e) { return k; } })();
      const h = health[k]; const lb = (db.linkedBots || {})[k] || {};
      const num = lb.phoneNumber || lb.number || (lb.jid ? String(lb.jid).split('@')[0].split(':')[0] : '') || '';
      let state;
      if (killed.includes(k)) state = '💀 killed (/reset ' + k + ')';
      else if (parked[k]) state = parked[k] === '403' ? '🚫 refused by WhatsApp (403) — /link ' + k : '🔌 logged out — /link ' + k;
      else if (pairing[k] && /awaiting|starting|connecting/.test(pairing[k].status || '')) state = '📲 pairing (' + pairing[k].status + ')';
      else if (h?.online && h?.usable) { state = '🟢 online'; online++; }
      else if (h?.online) state = '🟡 online, not usable' + (h.lastErr ? ` (${String(h.lastErr).slice(0, 40)})` : '');
      else state = '🔴 offline (reconnecting)';
      let auth = '';
      try { if (SA?.isAvailable?.()) { const st = SA.stats(k); auth = ` · 🔑 ${st.total} keys` + (st.credsBackups ? ` · ${st.credsBackups} creds backups` : ''); } } catch (e) {}
      const heard = h?.lastInboundAgoSec != null ? ` · heard ${_ago(h.lastInboundAgoSec * 1000)} ago` : '';
      const recyc = h?.deafRecycles ? ` · ${h.deafRecycles} deaf-recycles` : '';
      lines.push(`*${name}*${num ? ` (+${num})` : ''}\n  ${state}${heard}${recyc}${auth}`);
    }
    if (keys.size === 0) lines.push('No bots linked yet — /link <bot>.');
    lines.push('', `🟢 ${online}/${keys.size} online · ${new Date(now).toISOString().slice(11, 16)}Z`);
    return sock.sendMessage(msg.key.remoteJid, { text: lines.join('\n') }, { quoted: msg });
  },
};
