// Push #102h: one-shot data repairs (run once at boot, keyed in db.migrations).
//   restoreWornWeapons_102h — 1.0.202 made every durability weapon wear per raid hit and the old code DELETED a weapon at
//   0 durability. Two verified losses (BUG-075 / BUG-086) are restored from the 14 Oct offline backup, fully mended.
'use strict';
const RESTORE = {
  "172748517175383@lid": {
    "id": "WA1-muobj2zk-p3jr",
    "name": "Dragonbone Bow of Ashborn",
    "emoji": "🏹",
    "rank": "A",
    "rarity": "legendary",
    "fromStore": true,
    "storeDay": "2026-09-30",
    "acquiredAt": 1791419079716,
    "durability": 66,
    "maxDurability": 127,
    "transferable": true,
    "isWeapon": true,
    "type": "Weapon",
    "weaponType": "Bow",
    "attack": 322,
    "bonus": 322,
    "effects": [
      {
        "type": "bleed",
        "chance": 37,
        "duration": 4
      }
    ],
    "loreIdx": 0
  },
  "187115132457207@lid": {
    "id": "WBX-mv5e803k-x2md",
    "name": "Hexed Katana of the Shadow Army",
    "emoji": "🗡️",
    "rank": "B",
    "rarity": "epic",
    "fromStore": false,
    "storeDay": "2026-10-12",
    "acquiredAt": 1791818081408,
    "durability": 81,
    "maxDurability": 81,
    "transferable": true,
    "isWeapon": true,
    "type": "Weapon",
    "weaponType": "Katana",
    "attack": 239,
    "bonus": 239,
    "effects": [
      {
        "type": "curse",
        "chance": 19,
        "duration": 3
      }
    ],
    "loreIdx": 6,
    "source": "cursed_box"
  }
};
function run(db) {
  if (!db) return 0;
  if (!db.migrations) db.migrations = {};
  if (db.migrations.restoreWornWeapons_102h) return 0;
  let n = 0;
  for (const [jid, w] of Object.entries(RESTORE)) {
    try {
      const u = db.users && (db.users[jid] || Object.values(db.users).find(x => x && String(x.jid || x.id || '').split('@')[0] === jid.split('@')[0]));
      if (!u) continue;
      const items = (u.inventory = u.inventory || { items: [] }).items = Array.isArray(u.inventory.items) ? u.inventory.items : [];
      const have = [u.weapon, ...items].some(x => x && (x.id === w.id || x.name === w.name));
      if (have) continue;
      items.push({ ...w, durability: w.maxDurability, broken: false, restoredAt: Date.now(), restoredWhy: 'BUG-075/086' });
      n++;
    } catch (e) {}
  }
  db.migrations.restoreWornWeapons_102h = { at: Date.now(), restored: n };
  return n;
}
module.exports = { run, RESTORE };
