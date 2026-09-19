// /version — what build is this container actually running? (Push #73)
'use strict';
const fs = require('fs'); const path = require('path');
module.exports = {
  name: 'version', aliases: ['build', 'ver'],
  description: '🧾 Show the running build (git commit + package version)',
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    let v = 'unknown', pkg = '?';
    try { v = fs.readFileSync(path.join(__dirname, '../../VERSION'), 'utf8').trim(); } catch (e) {}
    try { pkg = require('../../package.json').version; } catch (e) {}
    const has = (f) => fs.existsSync(path.join(__dirname, f)) ? '✅' : '❌';
    return sock.sendMessage(msg.key.remoteJid, { text: [
      `🧾 *BUILD INFO*`,
      `📦 package: *v${pkg}*`,
      `🔖 commit: ${v}`,
      `⏱️ uptime: ${Math.floor(process.uptime() / 60)} min`,
      `🧩 /recon ${has('recon.js')} · /burnkey ${has('burnkey.js')} · /catch ${has('catch.js')}`,
    ].join('\n') }, { quoted: msg });
  },
};
