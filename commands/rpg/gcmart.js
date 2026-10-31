// 10-30 (owner): /gcmart — the GC bot plans & pricing card (what a group pays to have ✦ 𝐀𝐬𝐭𝐫𝐚™ inside).
'use strict';
const UI = require('../../rpg/utils/UI');
const PLANS = [
  { name: 'Regular',        price: 4000,  blurb: 'the full RPG in your GC — raids, dungeons, guilds, PvP, economy, mini-games, AI chat' },
  { name: 'Dungeons Plus',  price: 6000,  blurb: 'everything in Regular + priority dungeon & gate spawns, Red-Gate/Double-Dungeon events, instance towers' },
  { name: 'High Priority',  price: 10000, blurb: 'everything in Dungeons Plus + first-in-line bot response, dedicated serf DMs, priority support and early features' },
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
      '*Bring ✦ 𝐀𝐬𝐭𝐫𝐚™ into your group.* Monthly plans, paid per GC:',
      '',
      ...PLANS.map((p, i) => `${['🥉', '🥈', '🥇'][i]} *${p.name}* — *${fmt(p.price)}/month*\n   ${p.blurb}`),
      '',
      '➕ *Add-on*',
      ...ADDONS.map(a => `   *${a.name}* — *+${fmt(a.price)}/month* · ${a.blurb}`),
      '',
      '📌 Prices apply from your *next purchase* — a plan already paid for runs to its end at the old price.',
      '📌 One payment covers one GC. Pro passes for players are separate — see */prostore*.',
      '',
      '🛒 *To buy or upgrade:* */support* or DM a mod (*/mods*) with your GC link and the plan name.',
    ];
    const text = UI.card(viewer, { icon: '🏬', title: '✦ 𝐀𝐬𝐭𝐫𝐚™ GC MART', lines, tip: '/joingc once your plan is active' });
    return sock.sendMessage(chatId, { text }, { quoted: msg });
  },
  PLANS, ADDONS,
};
