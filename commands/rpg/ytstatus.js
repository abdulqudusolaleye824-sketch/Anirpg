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

    // Batch-50: Deno = JS runtime yt-dlp needs to solve YouTube's
    // n/signature challenges (EJS). Missing runtime = missing formats.
    let deno = false;
    try { deno = !!(await ToolRunner.hasDeno()); } catch (e) { deno = false; }
    lines.push(deno ? '✅ Deno: *found*' : '⚠️ Deno: *missing* (challenge solving degraded)');

    // ── 3. YT_COOKIES env (never print the value) ──
    const ck = process.env.YT_COOKIES || '';
    lines.push(ck ? `✅ YT_COOKIES: *set* (${ck.length} chars)` : '⚠️ YT_COOKIES: *not set*');

    // Batch-50: yt-dlp prints WARNINGS first and the fatal ERROR last —
    // capturing the head hid the real failure behind Deno warnings and
    // even misfired the IP-block verdict ("challenge" matched a warning).
    // Prefer ERROR lines; otherwise take the tail, never the head.
    const _tailErr = (e) => {
      const all = String(e || '').split('\n').map((l) => l.trim()).filter(Boolean);
      const errs = all.filter((l) => /\berror\b/i.test(l));
      return (errs.length ? errs : all).slice(-2).join('\n').slice(-350) || 'empty result';
    };

    // ── 4. live search probe (stage 1 of /play) ──
    lines.push('', '🔎 Live YouTube probe (1 result)…');
    let probeOk = false;
    let probeErr = '';
    let probeRaw = '';
    try {
      const r = await ToolRunner.ytDlpRun([
        ...(ToolRunner.YOUTUBE_EXTRACTOR_ARGS_FULL || []),
        ...(ToolRunner.YOUTUBE_EJS_ARGS || []),
        '--no-playlist', '--print', '%(id)s | %(title).60s',
        'ytsearch1:never gonna give you up',
      ], { timeout: 45000 });
      if (r && r.ok && String(r.stdout || '').trim()) {
        probeOk = true;
        lines.push(`✅ Search: *working* — ${String(r.stdout).trim().split('\n')[0].slice(0, 70)}`);
      } else {
        probeErr = _tailErr(r && r.error); probeRaw = String((r && r.error) || '').slice(-2000);
        lines.push('❌ Search: *FAILED*');
        lines.push(`_${probeErr}_`);
      }
    } catch (e) {
      probeErr = _tailErr((e && e.message) || e); probeRaw = String((e && e.message) || e).slice(-2000);
      lines.push('❌ Search: *ERROR*');
      lines.push(`_${probeErr}_`);
    }

    // ── 5. media-URL extract probe (stage 2 of /play, no download) ──
    // Batch-49: search often works while the player API refuses media
    // URLs — this pinpoints exactly that split. Same args as /play.
    lines.push('', '🎬 Media-URL probe (no download)…');
    let extractOk = false;
    let extractErr = '';
    let extractRaw = '';
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
        extractErr = _tailErr(x && x.error); extractRaw = String((x && x.error) || '').slice(-2000);
        lines.push('❌ Extract: *FAILED*');
        lines.push(`_${extractErr}_`);
      }
    } catch (e) {
      extractErr = _tailErr((e && e.message) || e); extractRaw = String((e && e.message) || e).slice(-2000);
      lines.push('❌ Extract: *ERROR*');
      lines.push(`_${extractErr}_`);
    }

    // ── 6. verdict ──
    lines.push('', '📋 *Verdict*');
    // Batch-50: strict block patterns, tested against ERROR lines only —
    // bare "challenge"/"bot" matched WARNING text and misdiagnosed.
    const _blocked = (t) => /sign in to confirm|confirm you.?re not a bot|too many requests|\b429\b|\b403\b|forbidden|login required|\bbot check\b|ip.?block|your ip|captcha/i.test(t || '');
    const _ejs = (t) => /\bjsc\b|ejs|remote-components|signature solving|challenge solving|js runtime|po token/i.test(t || '');
    const _cookieFix = ck
      ? 'refresh YT_COOKIES (re-export fresh cookies — sessions expire), then restart.'
      : 'set the YT_COOKIES env var, then restart.';
    const _rawAll = extractRaw + '\n' + probeRaw;
    if (!ytdlpVer) {
      lines.push('• Install yt-dlp on this host, then restart the bot.');
    } else if (probeOk && !extractOk && _blocked(extractErr)) {
      lines.push(`• Classic IP flag: search works but YouTube refuses media URLs to this server → ${_cookieFix}`);
      lines.push('• YT_COOKIES accepts a cookie-file path OR raw Netscape cookie data pasted in directly.');
    } else if ((!extractOk || !probeOk) && _blocked(extractErr + '\n' + probeErr)) {
      lines.push(`• Host IP is flagged by YouTube → ${_cookieFix}`);
    } else if ((!extractOk || !probeOk) && _ejs(_rawAll) && !deno) {
      lines.push('• YouTube challenge solving is broken: Deno (JS runtime) is missing on this host → rebuild so the Dockerfile/nixpacks Deno step runs, then restart.');
    } else if ((!extractOk || !probeOk) && _ejs(_rawAll)) {
      lines.push('• YouTube challenge solving is failing even with Deno → rebuild (requirements now bundle the yt-dlp-ejs solver scripts), then restart.');
    } else if (!extractOk) {
      lines.push('• Media extraction fails for an unknown reason — upgrade yt-dlp to latest, then restart.');
      lines.push(`• If it still fails, ${_cookieFix}`);
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
