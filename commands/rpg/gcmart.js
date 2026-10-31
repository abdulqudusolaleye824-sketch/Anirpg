// 10-30 (owner): /gcmart — the GC bot plans & pricing card (what a group pays to have ✦ 𝐀𝐬𝐭𝐫𝐚™ inside).
'use strict';
const UI = require('../../rpg/utils/UI');
const PLANS = [
  { name: 'Regular',       price: 4000,  bots: 1, swaps: 0,        blurb: '1 bot in your GC · no replacement' },
  { name: 'Dungeons Plus', price: 6000,  bots: 2, swaps: 3,        blurb: '2 bots in your GC · 3 replacement chances' },
  { name: 'High Priority', price: 10000, bots: 3, swaps: Infinity, blurb: '3 bots in your GC · unlimited replacements' },
];
const ADDONS = [{ name: 'Gate spawns', price: 4000, blurb: 'scheduled gate spawns in your GC (any plan)' }];
const fmt = n => '₦' + Number(n).toLocaleString('en-NG');
module.exports = {
  name: 'gcmart',
  aliases: ['gcplans', 'gcpricing', 'botplans'],
  description: '🏬 GC bot plans & pricing — what it costs to bring ✦ 𝐀𝐬𝐭𝐫𝐚™ into your group',
  usage: '/gcmart',
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid; const db = getDatabase(); const viewer = db.users && db.users[sender];
    const lines = [
      '*Bring ✦ 𝐀𝐬𝐭𝐫𝐚™ into your group.* Every plan is full bot access — the same game, same commands. Plans differ in *how many bots* sit in your GC and *how many times a bot can be replaced*.',
      '',
      ...PLANS.map((p, i) => `${['🥉', '🥈', '🥇'][i]} *${p.name}* — *${fmt(p.price)}/month*\n   ${p.blurb}`),
      '',
      '➕ *Add-on*',
      ...ADDONS.map(a => `   *${a.name}* — *+${fmt(a.price)}/month* · ${a.blurb}`),
      '',
      '🔁 *Replacement* = a fresh bot takes a dead/offline one\'s seat. Only available after *24 hours* of that bot being inactive.',
      '📌 Prices apply from your *next purchase* — a plan already paid for runs to its end at the old price.',
      '📌 One payment covers one GC. Pro passes for players are separate — see */prostore*.',
      '',
      '🛒 *To buy or upgrade:* */support* or DM a mod (*/mods*) with your GC link and the plan name.',
    ];
    const text = UI.card(viewer, { icon: '🏬', title: '✦ 𝐀𝐬𝐭𝐫𝐚™ GC MART', lines, tip: 'Pick a plan, ping a mod, and the bots walk in' });
    return sock.sendMessage(chatId, { text }, { quoted: msg });
  },
  PLANS, ADDONS,
};
