/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║           Astra — /lyrics → /song (audio)               ║
 * ╚══════════════════════════════════════════════════════════╝
 * /lyrics no longer fetches text — it now downloads the song as audio
 * (same robust engine as /yt / /song). Use /song or /lyrics <name>.
 */

'use strict';

const { yt } = require('./utility');

module.exports = {
  ...yt,
  name: 'lyrics',
  aliases: ['lyric', 'song'],
  description: 'Download a song as audio (alias of /song)',
  usage: '/lyrics <song name>',
};
