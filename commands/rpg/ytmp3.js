/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║           Astra — /ytmp3                                ║
 * ║  YouTube audio (same engine as /yt, PATH-independent)    ║
 * ╚══════════════════════════════════════════════════════════╝
 *
 * This is an alias to the robust /yt implementation in utility.js,
 * which uses ToolRunner (finds yt-dlp even off-PATH) and downloads
 * native audio when ffmpeg isn't installed — so /ytmp3 works without
 * any manual setup.
 */

'use strict';

const { yt } = require('./utility');

module.exports = {
  ...yt,
  name: 'ytmp3',
  aliases: ['yt', 'youtube', 'ytaudio', 'mp3'],
  description: 'Download YouTube audio (alias of /yt)',
  usage: '/ytmp3 <youtube url or song name>',
};
