// ═══════════════════════════════════════════════════════════════
// /find [query] — shows item type + position number in its group
// ═══════════════════════════════════════════════════════════════

const UI = require('../../rpg/utils/UI');

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
    let petFoodItems = [];
    try {
      const PDB = require('../../rpg/utils/PetDatabase');
      PDB.normalisePetFood(player);
      for (const [id, n] of Object.entries(player.inventory?.petFood || {})) { const f = PDB.PET_FOOD[id]; for (let k = 0; k < (n | 0); k++) petFoodItems.push({ id, name: f ? f.name : id, type: 'PetFood', isPetFood: true }); }
    } catch (e) { petFoodItems = items.filter(i => i.isPetFood || i.type === 'PetFood'); }
    const consumables  = items.filter(i => !i.isGear && !i.isPetFood && i.type !== 'PetFood');

    // Old-style potions as virtual entries
    const synth = [];
    for (let i = 0; i < (inv.healthPotions||0); i++)  synth.push({ name:'Health Potion', type:'Potion', rarity:'common' });
    for (let i = 0; i < (inv.energyPotions||inv.manaPotions||0); i++) synth.push({ name:'Energy Potion', type:'Potion', rarity:'common' });
    for (let i = 0; i < (inv.reviveTokens||0); i++)   synth.push({ name:'Revive Token', type:'Consumable', rarity:'uncommon' });

    const allCons = [...consumables, ...synth];

    const results = [];

    // Search gear + weapons — numbered by /inv serial (Push #82) so the
    // command shown ("/equip 12") really targets that item.
    let serialsG = [];
    try { serialsG = require('./inventory')._serialList(player); } catch (e) { serialsG = []; }
    serialsG.forEach((e, ix) => {
      if (e.kind !== 'gear' && e.kind !== 'weapon') return;
      const item = e.ref || e;
      if ((e.name||'').toLowerCase().includes(query) ||
          (e.rarity||'').toLowerCase().includes(query) ||
          (e.slot||'').toLowerCase().includes(query) ||
          (e.kind === 'weapon' ? 'weapon gear' : 'gear armor').includes(query)) {
        results.push({
          section: e.kind === 'weapon' ? 'Weapons' : 'Gear', pos: ix + 1,
          rarity: e.rarity, name: e.name, ref: item,
          detail: '[' + (e.slot||'?') + '] 🔧' + (item.durability||0) + '/' + (item.maxDurability||0),
          cmd: '/equip ' + (ix+1)
        });
      }
    });

    // Push #82: Items/Pet Food are numbered from the SAME serial list /inv
    // uses (newest-first, materials counted), so "#88" here == "/inv 88" and
    // the ×count matches exactly what /inventory shows.
    let serials = [];
    try { serials = require('./inventory')._serialList(player); } catch (e) { serials = []; }
    serials.forEach((e, ix) => {
      if (e.kind === 'gear' || e.kind === 'weapon') return; // gear handled above
      const nm = (e.name || '').toLowerCase();
      const rr = (e.rarity || '').toLowerCase();
      const isFood = e.kind === 'petfood';
      const kw = isFood ? 'food pet' : (e.kind === 'card' ? 'card' : 'potion consumable material item');
      if (nm.includes(query) || rr.includes(query) || kw.includes(query)) {
        results.push({
          section: isFood ? 'Pet Food' : 'Items', pos: ix + 1,
          rarity: e.rarity, name: e.name, ref: e.ref,
          detail: '×' + (e.count || 1),
          cmd: isFood ? ('/pet feed <petname> ' + e.name) : ('/equip use ' + (ix + 1)),
        });
      }
    });

    if (results.length === 0) {
      return sock.sendMessage(chatId, {
        text: '🔍 No results for "*' + query + '*"\n\n💡 /inventory to see everything.'
      }, { quoted: msg });
    }

    const proF = UI.isPro(player);
    const secs = [...new Set(results.map(r => r.section))];
    let message = (proF ? UI.PRO_BAR : UI.FREE_BAR) + '\n';
    message += '🔍 *Results for "' + query + '"*' + '\n';
    if (proF) message += (UI.PRO_MINI + '\n' + '🔎 PRO SEEKER') + '\n📂 *' + results.length + '* match' + (results.length === 1 ? '' : 'es') + ' across ' + secs.join(' · ') + '\n';
    message += '\n';

    for (const r of results) {
      const re = require('../../rpg/utils/ItemEmoji').tag(r.ref || r); // Push #71
      message += re + ' *' + r.name + '* ' + r.detail + '\n';
      message += '   📂 ' + r.section + ' #' + r.pos + ' — ' + r.cmd + '\n\n';
    }

    message += (proF ? UI.PRO_BAR : UI.FREE_BAR);
    return sock.sendMessage(chatId, { text: message }, { quoted: msg });
  }
};
