const TaxSystem = require('../../rpg/utils/TaxSystem');
const { updatePlayerNexus } = require('../../rpg/utils/NexusManager');
const { SCROLL_SHOP_ITEMS, buyScroll } = require('../../rpg/utils/CraftingSystem');
const { OWNER_JID, COOWNER_JID } = require('../../utils/constants');
const { checkInBattle } = require('../../rpg/utils/RegenManager');

function validatePurchase(player, cost, currency) {
  if (currency === 'gold') {
    if ((player.gold || 0) < cost) return { valid:false, message:`❌ *Not enough Nexus!*\nNeed: *${cost.toLocaleString()}* 💠\nHave: *${(player.gold||0).toLocaleString()}* 💠` };
  } else if (currency === 'crystals') {
    if ((player.manaCrystals || 0) < cost) return { valid:false, message:`❌ *Not enough crystals!*\nNeed: *${cost}* 💎\nHave: *${player.manaCrystals||0}* 💎` };
  }
  return { valid: true };
}

const weaponUpgrades = {
  Warrior:      [{name:'Iron Sword',bonus:15,cost:40000,level:1},{name:'Steel Greatsword',bonus:30,cost:90000,level:10},{name:'Mithril Claymore',bonus:50,cost:150000,level:20},{name:'Dragon Slayer',bonus:80,cost:250000,level:35},{name:'Legendary Excalibur',bonus:120,cost:1000000,level:50}],
  Mage:         [{name:'Wooden Staff',bonus:12,cost:40000,level:1},{name:'Mana Stone Wand',bonus:28,cost:90000,level:10},{name:'Arcane Scepter',bonus:45,cost:150000,level:20},{name:'Staff of the Magi',bonus:75,cost:220000,level:35},{name:'Cosmic Oracle Staff',bonus:115,cost:950000,level:50}],
  Rogue:        [{name:'Iron Dagger',bonus:14,cost:40000,level:1},{name:'Shadow Blade',bonus:32,cost:90000,level:10},{name:'Venomous Kris',bonus:52,cost:150000,level:20},{name:"Assassin's Edge",bonus:85,cost:260000,level:35},{name:'Phantom Reaver',bonus:125,cost:1050000,level:50}],
  Archer:       [{name:'Short Bow',bonus:13,cost:40000,level:1},{name:'Longbow',bonus:29,cost:90000,level:10},{name:'Elven Recurve',bonus:48,cost:150000,level:20},{name:'Dragon Bone Bow',bonus:78,cost:240000,level:35},{name:'Celestial Windrunner',bonus:118,cost:980000,level:50}],
  Knight:       [{name:'Iron Lance',bonus:16,cost:40000,level:1},{name:'Steel Halberd',bonus:31,cost:90000,level:10},{name:'Holy Partisan',bonus:51,cost:150000,level:20},{name:"Paladin's Spear",bonus:82,cost:265000,level:35},{name:'Divine Judgement',bonus:122,cost:1020000,level:50}],
  Tank:         [{name:'Iron Shield',bonus:10,defBonus:15,cost:40000,level:1},{name:'Steel Tower Shield',bonus:20,defBonus:30,cost:90000,level:10},{name:'Fortress Bulwark',bonus:35,defBonus:50,cost:150000,level:20},{name:"Titan's Aegis",bonus:55,defBonus:80,cost:280000,level:35},{name:'Impenetrable Wall',bonus:80,defBonus:120,cost:1100000,level:50}],
  Assassin:     [{name:'Poison Needle',bonus:15,cost:40000,level:1},{name:'Twin Daggers',bonus:33,cost:90000,level:10},{name:'Night Whisper',bonus:54,cost:150000,level:20},{name:"Death's Kiss",bonus:88,cost:270000,level:35},{name:'Soul Reaper',bonus:128,cost:1080000,level:50}],
  Paladin:      [{name:'Holy Mace',bonus:17,cost:40000,level:1},{name:'Blessed Hammer',bonus:32,cost:90000,level:10},{name:'Radiant Morningstar',bonus:52,cost:150000,level:20},{name:'Light Bringer',bonus:83,cost:275000,level:35},{name:"Heaven's Wrath",bonus:123,cost:1040000,level:50}],
  Berserker:    [{name:'Heavy Axe',bonus:18,cost:40000,level:1},{name:'War Cleaver',bonus:35,cost:90000,level:10},{name:'Blood Reaver',bonus:56,cost:150000,level:20},{name:'Fury of the North',bonus:90,cost:285000,level:35},{name:'Ragnarok Destroyer',bonus:130,cost:1120000,level:50}],
  Necromancer:  [{name:'Bone Wand',bonus:13,cost:40000,level:1},{name:'Skull Staff',bonus:27,cost:90000,level:10},{name:"Death's Embrace",bonus:46,cost:150000,level:20},{name:"Lich King's Scepter",bonus:76,cost:230000,level:35},{name:'Apocalypse Reaper',bonus:116,cost:960000,level:50}],
  Devourer:     [{name:'Fang Blade',bonus:16,cost:40000,level:1},{name:'Void Ripper',bonus:34,cost:90000,level:10},{name:'Soul Eater',bonus:55,cost:150000,level:20},{name:'Abyssal Maw',bonus:89,cost:288000,level:35},{name:'Eternal Hunger',bonus:129,cost:1110000,level:50}],
  DragonKnight: [{name:'Scaled Blade',bonus:17,cost:40000,level:1},{name:'Dragonfire Lance',bonus:33,cost:90000,level:10},{name:'Wyrmclaw Halberd',bonus:53,cost:150000,level:20},{name:"Dragon Lord's Glaive",bonus:86,cost:278000,level:35},{name:'Legendary Dragonbane',bonus:126,cost:1060000,level:50}],
  'Dragon Knight':[{name:'Scaled Blade',bonus:17,cost:40000,level:1},{name:'Dragonfire Lance',bonus:33,cost:90000,level:10},{name:'Wyrmclaw Halberd',bonus:53,cost:150000,level:20},{name:"Dragon Lord's Glaive",bonus:86,cost:278000,level:35},{name:'Legendary Dragonbane',bonus:126,cost:1060000,level:50}],
  Senku:        [{name:'Kingdom of Science Staff',bonus:20,cost:50000,level:1},{name:'Nitro Formula Flask',bonus:38,cost:100000,level:10},{name:'Revive Stone Cannon',bonus:58,cost:180000,level:20},{name:'Science Blaster Mk2',bonus:90,cost:300000,level:35},{name:'Perseus Reactor',bonus:135,cost:1200000,level:50}],
};

const CONSUMABLES = [
  {id:1,name:'Lower Health Potion',emoji:'🩹',desc:'Restores 10% HP',cost:800,key:'lowerHealthPotions'},
  {id:2,name:'Medium Health Potion',emoji:'🧪',desc:'Restores 25% HP',cost:5000,key:'mediumHealthPotions'},
  {id:3,name:'Higher Health Potion',emoji:'🍷',desc:'Restores 50% HP',cost:7000,key:'higherHealthPotions'},
  {id:4,name:'Energy Potion',emoji:'⚡',desc:'Restores 50% Energy',cost:600,key:'energyPotions'},
  {id:5,name:'Revive Token',emoji:'🎫',desc:'Auto-revive once in dungeon',cost:3000,key:'reviveTokens'},
  {id:6,name:'Luck Potion',emoji:'🍀',desc:'+25% catch rate & casino odds',cost:2000,key:'luckPotion'},
  {id:7,name:'XP Booster',emoji:'✨',desc:'+50% XP for 3 battles',cost:5000,key:'xpBooster'},
  {id:8,name:'Nexus Multiplier',emoji:'💰',desc:'Next 3 wins give 2x gold',cost:8000,key:'goldMult'},
  {id:9,name:'Shield Scroll',emoji:'🛡️',desc:'Absorbs one hit in next fight',cost:4000,key:'shieldScroll'},
  {id:10,name:'Elixir of Might',emoji:'💪',desc:'+20 ATK for next 5 battles',cost:12000,key:'mightElixir'},
];

const CRYSTAL_ITEMS = [
  {id:1,name:'Power Ring',emoji:'💍',desc:'+5 ATK permanently',cost:500,stat:'atk',amount:5},
  {id:2,name:'Guardian Amulet',emoji:'📿',desc:'+5 DEF permanently',cost:500,stat:'def',amount:5},
  {id:3,name:'Vitality Orb',emoji:'❤️',desc:'+20 Max HP permanently',cost:600,stat:'hp',amount:20},
  {id:4,name:'Energy Core',emoji:'⚡',desc:'+10 Max Energy permanently',cost:600,stat:'en',amount:10},
  {id:5,name:'Swift Boots',emoji:'👟',desc:'+8 SPD permanently',cost:700,stat:'spd',amount:8},
  {id:6,name:'Crit Gem',emoji:'💎',desc:'+3% Crit permanently',cost:800,stat:'crit',amount:3},
  {id:7,name:'Summon Ticket',emoji:'🎟️',desc:'1 summon pull',cost:120,stat:'ticket',amount:1},
  {id:8,name:'Mana Stone x50',emoji:'🔮',desc:'Buy 50 crystals with gold',cost:0,stat:'mcx50',amount:50,goldCost:40000},
];

const BUNDLES = [
  {id:1,name:'Starter Pack',emoji:'🎁',desc:'5 HP Pots + 5 Energy Pots + 1 Revive Token',cost:5000},
  {id:2,name:'Dungeon Kit',emoji:'⚔️',desc:'10 HP Pots + 5 Revive Tokens + 1 XP Booster',cost:18000},
  {id:3,name:'PvP Bundle',emoji:'🏆',desc:'Elixir of Might + Shield Scroll + 2 Luck Potions',cost:20000},
  {id:4,name:'Mana Stone Bundle',emoji:'💎',desc:'200 Mana Stones + 3 Summon Tickets',cost:150000},
  {id:5,name:'Mega Pack',emoji:'👑',desc:'20 HP Pots + 10 Revives + 5 XP Boosters + 500 Mana Stones',cost:60000},
];

module.exports = {
  name: 'shop',
  description: '🏪 Hunter Shop',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];
    if (!player) return sock.sendMessage(chatId, { text: '❌ Register first! /register' }, { quoted: msg });

    if (checkInBattle(player, db)) {
      return sock.sendMessage(chatId, { text: '❌ You cannot access the shop while in battle!' }, { quoted: msg });
    }

    if (!player.inventory) player.inventory = {lowerHealthPotions:0,mediumHealthPotions:0,higherHealthPotions:0,healthPotions:0,energyPotions:0,manaPotions:0,reviveTokens:0,items:[]};
    if (!player.inventory.items) player.inventory.items = [];

    const action = args[0]?.toLowerCase();
    const gold = (player.gold||0).toLocaleString();
    const crystals = (player.manaCrystals||0).toLocaleString();

    if (!action) {
      return sock.sendMessage(chatId, {text:
`━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏪 *HUNTER SHOP*
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💠 Nexus: *${gold}* 💠
💎 Mana Stones: *${crystals}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📂 *CATEGORIES*
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧪 /shop potions    — Consumables (Nexus)
⚔️  /shop weapons   — Class weapons (Nexus)
💎 /shop crystals   — Permanent buffs (Mana Stones)
🎁 /shop bundles    — Value packs (Nexus)
📜 /shop scrolls    — Recipe scrolls (Mana Stones)
📦 /shop inventory  — Your items
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 *HOW TO BUY*
/shop buy potions [#] [amount]
/shop buy crystals [#]
/shop buy bundles [#]
/shop weapon [#]
/shop buy scroll [sc1-sc6]
━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      },{quoted:msg});
    }

    if (action==='potions'||action==='potion') {
      let txt=`━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🧪 *CONSUMABLES SHOP*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n💠 Nexus: *${gold}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      CONSUMABLES.forEach(item=>{
        const n=item.key==='energyPotions'?`${player.energyType||'Energy'} Potion`:item.name;
        txt+=`*${item.id}.* ${item.emoji} *${n}* — ${item.cost.toLocaleString()}g\n   ${item.desc}\n\n`;
      });
      txt+=`━━━━━━━━━━━━━━━━━━━━━━━━━━━\n/shop buy potions [#] [amount]`;
      return sock.sendMessage(chatId,{text:txt},{quoted:msg});
    }

    if (action==='crystals'||action==='crystal') {
      let txt=`━━━━━━━━━━━━━━━━━━━━━━━━━━━\n💎 *MANA STONE SHOP*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n💎 Mana Stones: *${crystals}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      CRYSTAL_ITEMS.forEach(item=>{
        const c=item.goldCost?`${item.goldCost.toLocaleString()} 💠`:`${item.cost}💎`;
        txt+=`*${item.id}.* ${item.emoji} *${item.name}* — ${c}\n   ${item.desc}\n\n`;
      });
      txt+=`━━━━━━━━━━━━━━━━━━━━━━━━━━━\n/shop buy crystals [#]`;
      return sock.sendMessage(chatId,{text:txt},{quoted:msg});
    }

    if (action==='bundles'||action==='bundle') {
      let txt=`━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🎁 *BUNDLE DEALS*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n💠 Nexus: *${gold}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      BUNDLES.forEach(b=>{txt+=`*${b.id}.* ${b.emoji} *${b.name}* — ${b.cost.toLocaleString()}g\n   ${b.desc}\n\n`;});
      txt+=`━━━━━━━━━━━━━━━━━━━━━━━━━━━\n/shop buy bundles [#]`;
      return sock.sendMessage(chatId,{text:txt},{quoted:msg});
    }

    if (action==='scrolls'||action==='scroll') {
      const stones = player.manaStones || player.manaCrystals || 0;
      const lines = [`━━━━━━━━━━━━━━━━━━━━━━━━━━━`,`📜 *RECIPE SCROLLS*`,`━━━━━━━━━━━━━━━━━━━━━━━━━━━`,`💎 Your Mana Stones: *${stones.toLocaleString()}*`,``,`⚠️ Contents unknown until purchased.`,`📖 Read scrolls in DMs to reveal recipe + key.`,``];
      for (const s of SCROLL_SHOP_ITEMS) {
        const can = stones >= s.cost ? '✅' : '❌';
        lines.push(`${can} ${s.emoji} *${s.name}* [${s.id}]`);
        lines.push(`   ${s.desc}`);
        lines.push(`   💎 ${s.cost.toLocaleString()} Mana Stones`);
        lines.push('');
      }
      lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      lines.push(`/shop buy scroll sc1 — buy Common`);
      lines.push(`/shop buy scroll sc6 — buy Mythic`);
      lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      return sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: msg });
    }

    if (action==='inventory'||action==='inv') {
      const hp=player.inventory.healthPotions||0;
      const ep=player.inventory.energyPotions||player.inventory.manaPotions||0;
      const rv=player.inventory.reviveTokens||0;
      const lp=(player.inventory.items||[]).filter(i=>i.isLuckPotion).length;
      const xpb=(player.inventory.items||[]).filter(i=>i.isXpBooster).length;
      const gm=(player.inventory.items||[]).filter(i=>i.isNexusMult).length;
      const ss=(player.inventory.items||[]).filter(i=>i.isShieldScroll).length;
      const me=(player.inventory.items||[]).filter(i=>i.isMightElixir).length;
      return sock.sendMessage(chatId,{text:
`━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎒 *YOUR INVENTORY*
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🩹 HP Potions: *${hp}*
⚡ Energy Potions: *${ep}*
🎫 Revive Tokens: *${rv}*
🍀 Luck Potions: *${lp}*
✨ XP Boosters: *${xpb}*
💠 Nexus Multipliers: *${gm}*
🛡️ Shield Scrolls: *${ss}*
💪 Might Elixirs: *${me}*
🎟️ Summon Tickets: *${player.summonTickets||0}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💠 Nexus: *${gold}*  💎 Mana Stones: *${crystals}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      },{quoted:msg});
    }

    if (action === 'stats') {
      const OWNER_NUM   = OWNER_JID.split('@')[0];
      const COOWNER_NUM = COOWNER_JID.split('@')[0];
      const senderNum   = sender.split('@')[0].split(':')[0];
      if (senderNum !== OWNER_NUM && senderNum !== COOWNER_NUM) {
        return sock.sendMessage(chatId, { text: '❌ Owner/co-owner only command.' }, { quoted: msg });
      }
      const users   = Object.values(db.users || {});
      const total   = users.length;
      const withNexus = users.filter(u => (u.gold||0) > 0).length;
      const totalNexus = users.reduce((s,u) => s+(u.gold||0), 0);
      const totalCrys = users.reduce((s,u) => s+(u.manaCrystals||0), 0);
      const withPro   = users.filter(u => u.proStatus && u.proExpiresAt > Date.now()).length;
      const richest   = [...users].sort((a,b)=>(b.gold||0)-(a.gold||0))[0];

      let shopTxt = '';
      try {
        const { getShopStats } = require('../../rpg/utils/AttackShop');
        const stats = getShopStats(db);
        const { RANK_EMOJI } = require('../../rpg/utils/AttackPatternDB');
        shopTxt = '\n⚔️ *ATTACK SHOP*\n';
        shopTxt += '📅 Day: ' + stats.dayKey + '\n';
        (stats.items||[]).forEach((item,i) => {
          const re = RANK_EMOJI[item.rank]||'⬜';
          shopTxt += (i+1)+'. '+re+' #'+item.id+' '+item.name+' ['+item.rank+'] — '+(item.soldOut?'SOLD OUT':(item.unitsLeft+' left'))+'\n';
        });
      } catch(e) { shopTxt = '\n⚔️ Attack shop: N/A\n'; }

      const txt = [
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        '📊 *SHOP ADMIN STATS*',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        '👥 Total Players: *' + total + '*',
        '💠 Players with Nexus: *' + withNexus + '*',
        '🏦 Total Nexus in economy: *' + totalNexus.toLocaleString() + '*',
        '💎 Total Mana Stones: *' + totalCrys.toLocaleString() + '*',
        '👑 Pro subscribers: *' + withPro + '*',
        richest ? '🥇 Richest: *' + (richest.name||'?') + '* — ' + (richest.gold||0).toLocaleString() + ' Nexus' : '',
        shopTxt,
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      ].filter(Boolean).join('\n');

      return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
    }

    if (action==='weapons') {
      const cn=typeof player.class==='string'?player.class:(player.class?.name || 'Awaiting');
      const cw=weaponUpgrades[cn]||[];
      if(!cw.length) return sock.sendMessage(chatId,{text:`❌ No weapons for *${cn}*!`},{quoted:msg});
      let txt=`━━━━━━━━━━━━━━━━━━━━━━━━━━━\n⚔️ *WEAPONS — ${cn.toUpperCase()}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\nEquipped: *${player.weapon?.name||'None'}*\n💠 Nexus: *${gold}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      cw.forEach((w,i)=>{
        const locked=player.level<w.level;
        const owned=player.weapon?.name===w.name;
        const icon=owned?'📍':locked?'🔒':'✅';
        txt+=`${icon} *${i+1}.* ${w.name}\n   ⚔️ +${w.bonus} ATK${w.defBonus?` | 🛡️ +${w.defBonus} DEF`:''} | 💠 ${w.cost.toLocaleString()} 💠 | Lv.${w.level}\n\n`;
      });
      txt+=`━━━━━━━━━━━━━━━━━━━━━━━━━━━\n/shop weapon [#] to buy`;
      return sock.sendMessage(chatId,{text:txt},{quoted:msg});
    }

    if (action==='weapon') {
      const num=parseInt(args[1]);
      if(!num) return sock.sendMessage(chatId,{text:'❌ /shop weapons to see list'},{quoted:msg});
      const cn=typeof player.class==='string'?player.class:(player.class?.name || 'Awaiting');
      const cw=weaponUpgrades[cn]||[];
      const w=cw[num-1];
      if(!w) return sock.sendMessage(chatId,{text:`❌ Choose 1-${cw.length}`},{quoted:msg});
      if(player.level<w.level) return sock.sendMessage(chatId,{text:`❌ Need Level *${w.level}*! You are ${player.level}`},{quoted:msg});
      if(player.weapon?.name===w.name) return sock.sendMessage(chatId,{text:'❌ Already equipped!'},{quoted:msg});
      const val=validatePurchase(player,w.cost,'gold');
      if(!val.valid) return sock.sendMessage(chatId,{text:val.message},{quoted:msg});
      const tax=TaxSystem.applyTax(db,w.cost,'gold',saveDatabase);
      updatePlayerNexus(player,-w.cost,saveDatabase);
      player.weapon={name:w.name,bonus:w.bonus,attack:w.bonus,defense:w.defBonus||0};
      if(w.defBonus){player.stats.def=(player.stats.def||5)+w.defBonus;}
      saveDatabase();
      return sock.sendMessage(chatId,{text:`━━━━━━━━━━━━━━━━━━━━━━━━━━━\n⚔️ *WEAPON EQUIPPED!*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✨ *${w.name}*\n⚔️ +${w.bonus} ATK${w.defBonus?`\n🛡️ +${w.defBonus} DEF`:''}\n💠 Spent: ${w.cost.toLocaleString()} 💠 (+${tax} 💠 tax)\n💠 Nexus left: ${(player.gold||0).toLocaleString()}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`},{quoted:msg});
    }

    if (action==='buy') {
      const cat=args[1]?.toLowerCase();
      const num=parseInt(args[2]);
      const amount=Math.max(1,parseInt(args[3])||1);

      // ── Scroll purchase ────────────────────────────────────
      if (cat==='scroll' || cat==='scrolls') {
        const scrollId = args[2]?.toLowerCase();
        const scrollItem = SCROLL_SHOP_ITEMS.find(s => s.id === scrollId);
        if (!scrollItem) {
          const list = SCROLL_SHOP_ITEMS.map(s => `${s.emoji} *${s.id}* — ${s.name} (${s.cost.toLocaleString()} MS)`).join('\n');
          return sock.sendMessage(chatId, { text: `📜 *RECIPE SCROLLS*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${list}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\nUsage: /shop buy scroll sc1` }, { quoted: msg });
        }
        const manaStones = player.manaStones || player.manaCrystals || 0;
        if (manaStones < scrollItem.cost) {
          return sock.sendMessage(chatId, { text: `❌ Not enough Mana Stones!\nNeed: *${scrollItem.cost.toLocaleString()}*\nHave: *${manaStones.toLocaleString()}*` }, { quoted: msg });
        }
        if (player.manaStones !== undefined) player.manaStones -= scrollItem.cost;
        else player.manaCrystals -= scrollItem.cost;
        if (!player.inventory) player.inventory = {};
        if (!player.inventory.scrolls) player.inventory.scrolls = [];
        const newScroll = buyScroll(scrollItem.rarity);
        player.inventory.scrolls.push(newScroll);
        saveDatabase();
        return sock.sendMessage(chatId, {
          text: `✅ Purchased *${scrollItem.name}*!\n\n📖 Read it in DMs: */scroll read*\n🔑 Contains a hidden recipe + craft key.`
        }, { quoted: msg });
      }

      if(!cat||!num) return sock.sendMessage(chatId,{text:'❌ Usage: /shop buy [potions/crystals/bundles/scroll] [#] [amount]'},{quoted:msg});

      if(cat==='potions'||cat==='potion') {
        const item=CONSUMABLES.find(c=>c.id===num);
        if(!item) return sock.sendMessage(chatId,{text:'❌ /shop potions to see list'},{quoted:msg});
        const cost=item.cost*amount;
        const val=validatePurchase(player,cost,'gold');
        if(!val.valid) return sock.sendMessage(chatId,{text:val.message},{quoted:msg});
        const tax=TaxSystem.applyTax(db,cost,'gold',saveDatabase);
        updatePlayerNexus(player,-cost,null);
        if(item.key==='lowerHealthPotions' || item.key==='healthPotions') {
          player.inventory.lowerHealthPotions = (player.inventory.lowerHealthPotions || 0) + amount;
          player.inventory.healthPotions = (player.inventory.healthPotions || 0) + amount;
        } else if(item.key==='mediumHealthPotions') {
          player.inventory.mediumHealthPotions = (player.inventory.mediumHealthPotions || 0) + amount;
        } else if(item.key==='higherHealthPotions') {
          player.inventory.higherHealthPotions = (player.inventory.higherHealthPotions || 0) + amount;
        } else if(item.key==='energyPotions'){if(player.inventory.energyPotions!==undefined)player.inventory.energyPotions=(player.inventory.energyPotions||0)+amount;else player.inventory.manaPotions=(player.inventory.manaPotions||0)+amount;}
        else if(item.key==='reviveTokens') player.inventory.reviveTokens=(player.inventory.reviveTokens||0)+amount;
        else if(item.key==='luckPotion'){for(let i=0;i<amount;i++)player.inventory.items.push({name:'Luck Potion',type:'Consumable',rarity:'uncommon',isLuckPotion:true});}
        else if(item.key==='xpBooster'){for(let i=0;i<amount;i++)player.inventory.items.push({name:'XP Booster',type:'Consumable',isXpBooster:true,charges:3});}
        else if(item.key==='goldMult'){for(let i=0;i<amount;i++)player.inventory.items.push({name:'Nexus Multiplier',type:'Consumable',isNexusMult:true,charges:3});}
        else if(item.key==='shieldScroll'){for(let i=0;i<amount;i++)player.inventory.items.push({name:'Shield Scroll',type:'Consumable',isShieldScroll:true});}
        else if(item.key==='mightElixir'){for(let i=0;i<amount;i++)player.inventory.items.push({name:'Elixir of Might',type:'Consumable',isMightElixir:true,charges:5,atkBonus:20});}
        saveDatabase();
        const n=item.key==='energyPotions'?`${player.energyType||'Energy'} Potion`:item.name;
        return sock.sendMessage(chatId,{text:`✅ *${amount}× ${item.emoji} ${n} purchased!*\n💠 Spent: ${cost.toLocaleString()} 💠 (+${tax} 💠 tax)\n💠 Nexus left: ${(player.gold||0).toLocaleString()}`},{quoted:msg});
      }

      if(cat==='crystals'||cat==='crystal') {
        const item=CRYSTAL_ITEMS.find(c=>c.id===num);
        if(!item) return sock.sendMessage(chatId,{text:'❌ /shop crystals to see list'},{quoted:msg});
        if(item.goldCost){
          const val=validatePurchase(player,item.goldCost,'gold');
          if(!val.valid) return sock.sendMessage(chatId,{text:val.message},{quoted:msg});
          updatePlayerNexus(player,-item.goldCost,null);
          player.manaCrystals=(player.manaCrystals||0)+item.amount;
          saveDatabase();
          return sock.sendMessage(chatId,{text:`✅ *+${item.amount} Mana Stones!*\n💎 Total: ${player.manaCrystals}`},{quoted:msg});
        }
        if(item.stat==='ticket'){
          const val=validatePurchase(player,item.cost,'crystals');
          if(!val.valid) return sock.sendMessage(chatId,{text:val.message},{quoted:msg});
          player.manaCrystals-=item.cost;
          player.summonTickets=(player.summonTickets||0)+1;
          saveDatabase();
          return sock.sendMessage(chatId,{text:`✅ *1 Summon Ticket!*\n🎟️ Tickets: ${player.summonTickets}\n💎 Mana Stones left: ${player.manaCrystals}`},{quoted:msg});
        }
        const val=validatePurchase(player,item.cost,'crystals');
        if(!val.valid) return sock.sendMessage(chatId,{text:val.message},{quoted:msg});
        player.manaCrystals-=item.cost;
        if(item.stat==='atk') player.stats.atk=(player.stats.atk||10)+item.amount;
        else if(item.stat==='def') player.stats.def=(player.stats.def||5)+item.amount;
        else if(item.stat==='hp'){player.stats.maxHp=(player.stats.maxHp||100)+item.amount;player.stats.hp=Math.min(player.stats.hp+item.amount,player.stats.maxHp);}
        else if(item.stat==='en') player.stats.maxEnergy=(player.stats.maxEnergy||100)+item.amount;
        else if(item.stat==='spd') player.stats.speed=(player.stats.speed||10)+item.amount;
        else if(item.stat==='crit') player.stats.crit=(player.stats.crit||0)+item.amount;
        if(!player.artifacts?.inventory){player.artifacts={inventory:[],equipped:{weapon:null,armor:null,ring:null,tome:null},enhanced:{}};}
        player.artifacts.inventory.push(item.name);
        saveDatabase();
        return sock.sendMessage(chatId,{text:`━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${item.emoji} *${item.name} APPLIED!*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${item.desc}\n💎 Mana Stones left: ${player.manaCrystals}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`},{quoted:msg});
      }

      if(cat==='bundles'||cat==='bundle') {
        const bundle=BUNDLES.find(b=>b.id===num);
        if(!bundle) return sock.sendMessage(chatId,{text:'❌ /shop bundles to see list'},{quoted:msg});
        const val=validatePurchase(player,bundle.cost,'gold');
        if(!val.valid) return sock.sendMessage(chatId,{text:val.message},{quoted:msg});
        const tax=TaxSystem.applyTax(db,bundle.cost,'gold',saveDatabase);
        updatePlayerNexus(player,-bundle.cost,null);
        let received='';
        if(bundle.id===1){player.inventory.healthPotions=(player.inventory.healthPotions||0)+5;if(player.inventory.energyPotions!==undefined)player.inventory.energyPotions=(player.inventory.energyPotions||0)+5;else player.inventory.manaPotions=(player.inventory.manaPotions||0)+5;player.inventory.reviveTokens=(player.inventory.reviveTokens||0)+1;received='🩹 5 HP Potions\n⚡ 5 Energy Potions\n🎫 1 Revive Token';}
        else if(bundle.id===2){player.inventory.healthPotions=(player.inventory.healthPotions||0)+10;player.inventory.reviveTokens=(player.inventory.reviveTokens||0)+5;player.inventory.items.push({name:'XP Booster',type:'Consumable',isXpBooster:true,charges:3});received='🩹 10 HP Potions\n🎫 5 Revive Tokens\n✨ 1 XP Booster';}
        else if(bundle.id===3){player.inventory.items.push({name:'Elixir of Might',type:'Consumable',isMightElixir:true,charges:5,atkBonus:20});player.inventory.items.push({name:'Shield Scroll',type:'Consumable',isShieldScroll:true});player.inventory.items.push({name:'Luck Potion',type:'Consumable',isLuckPotion:true});player.inventory.items.push({name:'Luck Potion',type:'Consumable',isLuckPotion:true});received='💪 Elixir of Might\n🛡️ Shield Scroll\n🍀 2 Luck Potions';}
        else if(bundle.id===4){player.manaCrystals=(player.manaCrystals||0)+200;player.summonTickets=(player.summonTickets||0)+3;received='💎 200 Mana Stones\n🎟️ 3 Summon Tickets';}
        else if(bundle.id===5){player.inventory.healthPotions=(player.inventory.healthPotions||0)+20;player.inventory.reviveTokens=(player.inventory.reviveTokens||0)+10;for(let i=0;i<5;i++)player.inventory.items.push({name:'XP Booster',type:'Consumable',isXpBooster:true,charges:3});player.manaCrystals=(player.manaCrystals||0)+500;received='🩹 20 HP Potions\n🎫 10 Revive Tokens\n✨ 5 XP Boosters\n💎 500 Mana Stones';}
        saveDatabase();
        return sock.sendMessage(chatId,{text:`━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${bundle.emoji} *${bundle.name} PURCHASED!*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📦 *You received:*\n${received}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n💠 Spent: ${bundle.cost.toLocaleString()} 💠 (+${tax} 💠 tax)\n💠 Nexus left: ${(player.gold||0).toLocaleString()}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`},{quoted:msg});
      }

      return sock.sendMessage(chatId,{text:'❌ Unknown category! Use: potions, crystals, bundles'},{quoted:msg});
    }

    return sock.sendMessage(chatId,{text:'❌ Unknown command!\n/shop — see all categories'},{quoted:msg});
  }
};
