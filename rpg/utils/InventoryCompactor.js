'use strict';
// Push #96h-z15: rolled gear carried an ~80-char lore string per instance; hoarders with hundreds of items
// made `inventory` the heaviest field in the document (216 KB for one player). Lore now lives as a tiny
// index (`loreIdx`) and is exposed through a NON-ENUMERABLE getter — readers keep using `item.lore`,
// JSON.stringify never sees it. Re-applied at boot (getters don't survive a JSON round-trip).
let _L = null;
function lists() { if (!_L) { try { const A = require('./ArmoryStore'); _L = { W: A.LORE_W || [], G: A.LORE_G || [] }; } catch (e) { _L = { W: [], G: [] }; } } return _L; }
function loreFor(idx) { const L = lists(); if (idx == null) return undefined; return idx >= 100 ? L.G[idx - 100] : L.W[idx]; }
function attach(item) {
  if (!item || typeof item !== 'object') return item;
  try {
    const d = Object.getOwnPropertyDescriptor(item, 'lore');
    if (d && typeof d.get === 'function') return item;
    if (d && typeof d.value === 'string') {
      const L = lists(); let idx = L.W.indexOf(d.value); if (idx < 0) { const g = L.G.indexOf(d.value); if (g >= 0) idx = 100 + g; }
      if (idx < 0) return item; // unknown lore text — leave as is
      item.loreIdx = idx;
    } else if (item.loreIdx == null) return item;
    delete item.lore;
    Object.defineProperty(item, 'lore', { get() { return loreFor(this.loreIdx); }, set(v) { Object.defineProperty(this, 'lore', { value: v, writable: true, enumerable: true, configurable: true }); }, enumerable: false, configurable: true });
  } catch (e) {}
  return item;
}
function compactPlayer(p) {
  let n = 0; if (!p) return 0;
  const touch = (it) => { if (it && typeof it === 'object' && (Object.prototype.hasOwnProperty.call(it, 'lore') || it.loreIdx != null)) { const before = Object.getOwnPropertyDescriptor(it, 'lore'); attach(it); const after = Object.getOwnPropertyDescriptor(it, 'lore'); if (before && !before.get && after && after.get) n++; } };
  try { for (const it of (p.inventory && Array.isArray(p.inventory.items)) ? p.inventory.items : []) touch(it); } catch (e) {}
  try { touch(p.weapon); } catch (e) {}
  try { for (const v of Object.values(p.equipment || p.equipped || {})) touch(v); } catch (e) {}
  return n;
}
function compactAll(db) { let n = 0; try { for (const u of Object.values((db && db.users) || {})) n += compactPlayer(u); } catch (e) {} return n; }
module.exports = { attach, compactPlayer, compactAll, loreFor };
