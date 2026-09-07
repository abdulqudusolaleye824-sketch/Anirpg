// ═══════════════════════════════════════════════════════════════
// /find [query] — shows item type + position number in its group
// ═══════════════════════════════════════════════════════════════

module.exports = {
  name: 'find',
  description: 'Search your inventory for an item',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];

    if (!player) return sock.sendMessage(chatId, { text: '❌ Not registered!' }, { quoted: msg });

    const query = args.join(' ').trim().toLowerCase();
    if (!query) {
      return sock.sendMessage(chatId, {
        text: '❌ Provide a search term!\n\nExamples:\n/find helmet\n/find legendary\n/find health potion\n/find meat'
      }, { quoted: msg });
    }

    const inv = player.inventory || {};
    const items = inv.items || [];
    const rarityOrder = { mythic:0, legendary:1, epic:2, rare:3, uncommon:4, common:5 };
    const rarityEmoji = { mythic:'🌌', legendary:'🟠', epic:'🟣', rare:'🔵', uncommon:'🟢', common:'⚪' };

    // Build sectioned lists (same order as /inventory)
    const gearItems    = [...items.filter(i => i.isGear)].sort((a,b)=>(rarityOrder[a.rarity]||6)-(rarityOrder[b.rarity]||6));
    const petFoodItems = items.filter(i => i.isPetFood || i.type === 'PetFood');
    const consumables  = items.filter(i => !i.isGear && !i.isPetFood && i.type !== 'PetFood');

    // Old-style potions as virtual entries
    const synth = [];
    for (let i = 0; i < (inv.healthPotions||0); i++)  synth.push({ name:'Health Potion', type:'Potion', rarity:'common' });
    for (let i = 0; i < (inv.energyPotions||inv.manaPotions||0); i++) synth.push({ name:'Energy Potion', type:'Potion', rarity:'common' });
    for (let i = 0; i < (inv.reviveTokens||0); i++)   synth.push({ name:'Revive Token', type:'Consumable', rarity:'uncommon' });

    const allCons = [...consumables, ...synth];

    const results = [];

    // Search gear
    gearItems.forEach((item, idx) => {
      if ((item.name||'').toLowerCase().includes(query) ||
          (item.rarity||'').toLowerCase().includes(query) ||
          (item.slot||'').toLowerCase().includes(query) ||
          'gear'.includes(query)) {
        results.push({
          section: 'Gear', pos: idx + 1,
          rarity: item.rarity, name: item.name,
          detail: '[' + (item.slot||'?') + '] 🔧' + (item.durability||0) + '/' + (item.maxDurability||0),
          cmd: '/gear equip ' + (idx+1)
        });
      }
    });

    // Stack and search consumables
    const consStacked = {};
    allCons.forEach((item, i) => {
      const k = item.name;
      if (!consStacked[k]) consStacked[k] = { ...item, count: 0, idx: i };
      consStacked[k].count++;
    });
    const consList = Object.values(consStacked).sort((a,b)=>(rarityOrder[a.rarity]||6)-(rarityOrder[b.rarity]||6));
    consList.forEach((item, idx) => {
      if ((item.name||'').toLowerCase().includes(query) ||
          (item.rarity||'').toLowerCase().includes(query) ||
          (item.type||'').toLowerCase().includes(query) ||
          'potion consumable'.includes(query)) {
        results.push({
          section: 'Items', pos: idx + 1,
          rarity: item.rarity, name: item.name,
          detail: '×' + item.count,
          cmd: '/equip use ' + (idx+1)
        });
      }
    });

    // Stack and search pet food
    const foodStacked = {};
    petFoodItems.forEach(item => {
      if (!foodStacked[item.name]) foodStacked[item.name] = { ...item, count: 0 };
      foodStacked[item.name].count++;
    });
    const foodList = Object.values(foodStacked).sort((a,b)=>(rarityOrder[a.rarity]||6)-(rarityOrder[b.rarity]||6));
    foodList.forEach((item, idx) => {
      if ((item.name||'').toLowerCase().includes(query) ||
          (item.rarity||'').toLowerCase().includes(query) ||
          'food pet'.includes(query)) {
        results.push({
          section: 'Pet Food', pos: idx + 1,
          rarity: item.rarity, name: item.name,
          detail: '×' + item.count,
          cmd: '/pet feed <petname> ' + item.name
        });
      }
    });

    if (results.length === 0) {
      return sock.sendMessage(chatId, {
        text: '🔍 No results for "*' + query + '*"\n\n💡 /inventory to see everything.'
      }, { quoted: msg });
    }

    let message = '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    message += '🔍 *Results for "' + query + '"*\n';
    message += '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

    for (const r of results) {
      const re = rarityEmoji[r.rarity] || '📦';
      message += re + ' *' + r.name + '* ' + r.detail + '\n';
      message += '   📂 ' + r.section + ' #' + r.pos + ' — ' + r.cmd + '\n\n';
    }

    message += '━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    return sock.sendMessage(chatId, { text: message }, { quoted: msg });
  }
};
