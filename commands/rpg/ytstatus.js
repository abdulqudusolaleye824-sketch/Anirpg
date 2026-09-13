// ═══════════════════════════════════════════════════════════════
// /ytstatus — /play backend diagnostics (bot owner/mod only).
// Reports yt-dlp presence/version, ffmpeg, YT_COOKIES env, and runs a
// live 1-result YouTube search probe so host-side /play failures can be
// diagnosed without touching code. Batch-48.
// ═══════════════════════════════════════════════════════════════

'use strict';

const Perms = require('../../utils/permissions');
const ToolRunner = require('../../rpg/utils/ToolRunner');

module.exports = {
  name: 'ytstatus',
  description: 'Diagnose the /play music backend (owner/mod only)',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    const isOwner = Perms.isBotOwner(db, sender);
    const isMod = Perms.isBotMod(db, sender);
    if (!isOwner && !isMod) {
      return sock.sendMessage(chatId, { text: '❌ Bot owners & bot mods only.' }, { quoted: msg });
    }

    const lines = ['🛠️ *PLAY BACKEND STATUS*', ''];

    // ── 1. yt-dlp presence + version ──
    let ytdlpVer = null;
    try {
      const v = await ToolRunner.ytDlpRun(['--version'], { timeout: 25000 });
      if (v && v.ok) ytdlpVer = String(v.stdout || '').trim().split(/\s+/)[0];
      else if (v && v.notFound) ytdlpVer = null;
    } catch (e) { ytdlpVer = null; }
    lines.push(ytdlpVer ? `✅ yt-dlp: *v${ytdlpVer}*` : '❌ yt-dlp: *NOT FOUND*');

    // ── 2. ffmpeg (needed for opus voice notes) ──
    let ff = false;
    try { ff = !!(await ToolRunner.hasFfmpeg()); } catch (e) { ff = false; }
    lines.push(ff ? '✅ ffmpeg: *found*' : '⚠️ ffmpeg: *missing* (songs send as .m4a)');

    // ── 3. YT_COOKIES env (never print the value) ──
    const ck = process.env.YT_COOKIES || '';
    lines.push(ck ? `✅ YT_COOKIES: *set* (${ck.length} chars)` : '⚠️ YT_COOKIES: *not set*');

    // ── 4. live search probe (stage 1 of /play) ──
    lines.push('', '🔎 Live YouTube probe (1 result)…');
    let probeOk = false;
    let probeErr = '';
    try {
      const r = await ToolRunner.ytDlpRun([
        ...(ToolRunner.YOUTUBE_EXTRACTOR_ARGS_FULL || []),
        '--no-playlist', '--print', '%(id)s | %(title).60s',
        'ytsearch1:never gonna give you up',
      ], { timeout: 45000 });
      if (r && r.ok && String(r.stdout || '').trim()) {
        probeOk = true;
        lines.push(`✅ Search: *working* — ${String(r.stdout).trim().split('\n')[0].slice(0, 70)}`);
      } else {
        probeErr = String((r && r.error) || 'empty result').slice(0, 220);
        lines.push('❌ Search: *FAILED*');
        lines.push(`_${probeErr}_`);
      }
    } catch (e) {
      probeErr = String((e && e.message) || e).slice(0, 220);
      lines.push('❌ Search: *ERROR*');
      lines.push(`_${probeErr}_`);
    }

    // ── 5. media-URL extract probe (stage 2 of /play, no download) ──
    // Batch-49: search often works while the player API refuses media
    // URLs — this pinpoints exactly that split. Same args as /play.
    lines.push('', '🎬 Media-URL probe (no download)…');
    let extractOk = false;
    let extractErr = '';
    try {
      let audio;
      try { audio = await ToolRunner.optimalAudioArgs(); }
      catch (e) { audio = { args: ['-f', 'bestaudio[ext=m4a]/bestaudio'] }; }
      const x = await ToolRunner.ytDlpRun([
        ...(audio.args || []),
        '--no-playlist', '--skip-download', '--print', '%(url)s',
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      ], { timeout: 45000 });
      if (x && x.ok && /^https?:\/\//m.test(String(x.stdout || ''))) {
        extractOk = true;
        lines.push('✅ Extract: *working* — YouTube hands over media URLs');
      } else {
        extractErr = String((x && x.error) || 'empty result').slice(0, 220);
        lines.push('❌ Extract: *FAILED*');
        lines.push(`_${extractErr}_`);
      }
    } catch (e) {
      extractErr = String((e && e.message) || e).slice(0, 220);
      lines.push('❌ Extract: *ERROR*');
      lines.push(`_${extractErr}_`);
    }

    // ── 6. verdict ──
    lines.push('', '📋 *Verdict*');
    const _blocked = (t) => /sign in|confirm|bot|403|429|login|challenge|forbidden/i.test(t || '');
    if (!ytdlpVer) {
      lines.push('• Install yt-dlp on this host, then restart the bot.');
    } else if (probeOk && !extractOk && _blocked(extractErr)) {
      lines.push('• Classic IP flag: search works but YouTube refuses media URLs to this server → set the YT_COOKIES env var, then restart.');
      lines.push('• YT_COOKIES accepts a cookie-file path OR raw Netscape cookie data pasted in directly.');
    } else if ((!extractOk || !probeOk) && _blocked(extractErr + '\n' + probeErr)) {
      lines.push('• Host IP is flagged by YouTube → set the YT_COOKIES env var (Netscape cookies from a logged-in browser), then restart.');
    } else if (!extractOk) {
      lines.push('• Media extraction fails for an unknown reason — upgrade yt-dlp to latest, then restart.');
      lines.push('• If it still fails, set YT_COOKIES and restart.');
    } else if (!probeOk) {
      lines.push('• Upgrade yt-dlp to latest, then restart the bot.');
      lines.push('• If it still fails, set YT_COOKIES and restart.');
    } else if (!ck) {
      lines.push('• Backend healthy. If downloads still fail, set YT_COOKIES.');
    } else {
      lines.push('• Backend healthy — /play should work. Restart the bot if you just pushed.');
    }
    lines.push('• Always *restart the bot after every push*.');

    return sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: msg });
  },
};
