// ═══════════════════════════════════════════════════════════════
// PET BREEDING — Push #74
//
// • Every pet has a GENDER (male/female). Existing pets get one assigned
//   deterministically from their instanceId the first time they are seen.
// • Two pets can MATE when: opposite gender, both Lv ≥ 5, both happiness ≥ 50,
//   hunger ≤ 60, neither on breeding cooldown, and their SPECIES are
//   compatible (same element family, or a listed cross-pair).
// • Cross-player: the male's owner proposes (/pet mate <my#> @player <their#>),
//   the female's owner accepts (/pet mate accept). Same-owner pairs mate
//   instantly. The FEMALE's owner receives the egg.
// • Offspring: usually the mother's or father's species; sometimes (rarer for
//   cross-pairs) a MIXED offspring from PET_MIX. The egg records its lineage.
// • /egg <#> shows an egg; /eggs lists; /eggs give <#> @player and
//   /pet give <#> @player transfer ownership.
// ═══════════════════════════════════════════════════════════════
'use strict';

const PetManager = require('./PetManager');
const { PET_DATABASE, EGG_TYPES } = require('./PetDatabase');

const BREED_COOLDOWN_MS = 12 * 60 * 60 * 1000; // 12h per parent
const MIN_LEVEL = 5;
const PROPOSAL_TTL_MS = 10 * 60 * 1000;
const proposals = new Map(); // femaleOwnerJid -> { from, maleId, femaleId, at }

// Element families → compatible species groups.
const FAMILY = {
  basic: 'earth', nature: 'earth', earth: 'earth',
  fire: 'fire', lightning: 'fire',
  shadow: 'dark', dark: 'dark',
  wind: 'sky', holy: 'sky', light: 'sky',
  water: 'water', ice: 'water',
};
// Explicit cross-family pairs that still work (both orders).
const CROSS_OK = new Set(['fire:dark', 'earth:water', 'sky:fire', 'earth:sky'].map(k => k.split(':').sort().join(':')));
// Mixed offspring by family pair (either order).
const PET_MIX = {
  'fire:dark': ['nine_tail_fox', 'abyss_demon', 'void_bat'],
  'earth:water': ['king_slime', 'mud_crawler', 'ancient_treant'],
  'sky:fire': ['pyro_bird', 'crystal_phoenix'],
  'earth:sky': ['wind_fairy', 'forest_sprite', 'gold_beetle'],
  'fire:fire': ['flame_fox', 'ember_lizard', 'nine_tail_fox'],
  'dark:dark': ['shadow_wolf', 'dark_serpent', 'abyss_demon'],
  'earth:earth': ['stone_golem_baby', 'king_slime', 'ancient_treant'],
  'sky:sky': ['wind_fairy', 'crystal_phoenix'],
  'water:water': ['dark_serpent', 'mud_crawler'],
};

// normalise PET_MIX keys to sorted form
for (const k of Object.keys(PET_MIX)) { const nk = k.split(':').sort().join(':'); if (nk !== k) { PET_MIX[nk] = PET_MIX[k]; delete PET_MIX[k]; } }
function _hash(str) { let h = 0; for (const c of String(str)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); }
function genderOf(pet) {
  if (!pet) return null;
  if (pet.gender === 'male' || pet.gender === 'female') return pet.gender;
  pet.gender = _hash(pet.instanceId || pet.name) % 2 === 0 ? 'male' : 'female';
  return pet.gender;
}
function genderIcon(pet) { return genderOf(pet) === 'male' ? '♂️' : '♀️'; }
function familyOf(pet) {
  const t = String((pet && pet.type) || (PET_DATABASE[pet && pet.id] || {}).type || 'basic').toLowerCase();
  return FAMILY[t] || 'earth';
}
function pairKey(a, b) { return [a, b].sort().join(':'); }

function ensureGenders(playerId) {
  const pets = PetManager.getPlayerPets(playerId) || [];
  let changed = false;
  for (const p of pets) { if (!p.gender) { genderOf(p); changed = true; } }
  if (changed) PetManager.save();
  return pets;
}

function findPet(playerId, ref) {
  const pets = ensureGenders(playerId);
  const n = parseInt(ref, 10);
  if (!isNaN(n) && pets[n - 1]) return pets[n - 1];
  const q = String(ref || '').toLowerCase();
  return pets.find(p => (p.nickname || '').toLowerCase() === q || (p.name || '').toLowerCase() === q) || null;
}

function compatibility(a, b) {
  if (!a || !b) return { ok: false, reason: 'Pet not found.' };
  if (a.instanceId === b.instanceId) return { ok: false, reason: 'A pet cannot mate with itself.' };
  const ga = genderOf(a), gb = genderOf(b);
  if (ga === gb) return { ok: false, reason: `Both pets are ${ga} — mating needs a ♂️ and a ♀️.` };
  for (const p of [a, b]) {
    if ((p.level || 1) < MIN_LEVEL) return { ok: false, reason: `${p.nickname || p.name} must be Lv.${MIN_LEVEL}+ (is Lv.${p.level || 1}).` };
    if ((p.happiness ?? 100) < 50) return { ok: false, reason: `${p.nickname || p.name} is unhappy (${p.happiness}/100). Play with it first.` };
    if ((p.hunger ?? 0) > 60) return { ok: false, reason: `${p.nickname || p.name} is too hungry (${p.hunger}/100). Feed it first.` };
    if (p.breedCooldownUntil && p.breedCooldownUntil > Date.now()) {
      const h = Math.ceil((p.breedCooldownUntil - Date.now()) / 3600000);
      return { ok: false, reason: `${p.nickname || p.name} needs to rest ${h}h before mating again.` };
    }
  }
  const fa = familyOf(a), fb = familyOf(b);
  const key = pairKey(fa, fb);
  const sameFamily = fa === fb;
  if (!sameFamily && !CROSS_OK.has(key)) {
    return { ok: false, reason: `${a.nickname || a.name} (${fa}) and ${b.nickname || b.name} (${fb}) are not compatible species.` };
  }
  return { ok: true, sameFamily, key, mixChance: sameFamily ? 0.12 : 0.28 };
}

function _eggFor(petId) {
  for (const [eid, e] of Object.entries(EGG_TYPES)) if ((e.possiblePets || []).includes(petId)) return eid;
  return 'common_egg';
}

/** Produce the egg (given to the FEMALE's owner). */
function breed(maleOwner, male, femaleOwner, female) {
  const c = compatibility(male, female);
  if (!c.ok) return { success: false, message: `❌ ${c.reason}` };
  const fpd = PetManager.getPlayerData(femaleOwner);
  if ((fpd.eggs || []).length >= 5) return { success: false, message: `❌ ${femaleOwner === maleOwner ? 'Your' : "The female owner's"} egg bag is full (5/5).` };

  // Offspring species
  let childId = Math.random() < 0.5 ? (male.id || female.id) : (female.id || male.id);
  let mixed = false;
  if (Math.random() < c.mixChance) {
    const pool = (PET_MIX[c.key] || []).filter(id => PET_DATABASE[id]);
    if (pool.length) { childId = pool[Math.floor(Math.random() * pool.length)]; mixed = true; }
  }
  if (!PET_DATABASE[childId]) childId = female.id;
  const child = PET_DATABASE[childId];
  const eggId = _eggFor(childId);
  const eggDef = EGG_TYPES[eggId] || EGG_TYPES.common_egg;
  const egg = {
    instanceId: `egg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    eggId,
    name: `${mixed ? 'Hybrid ' : ''}${eggDef.name}`,
    emoji: mixed ? '🌈🥚' : eggDef.emoji,
    rarity: mixed ? (child.rarity || eggDef.rarity) : eggDef.rarity,
    desc: mixed ? `A shimmering egg — the child of ${male.nickname || male.name} ♂️ and ${female.nickname || female.name} ♀️. Something NEW stirs inside.` : `Laid by ${female.nickname || female.name} ♀️ (sire: ${male.nickname || male.name} ♂️).`,
    hatchLevel: eggDef.hatchLevel || 3,
    obtainedAt: Date.now(),
    bred: true,
    childId,            // fixed species — hatching honours lineage
    mixed,
    parents: { male: { id: male.id, name: male.nickname || male.name, owner: maleOwner }, female: { id: female.id, name: female.nickname || female.name, owner: femaleOwner } },
  };
  fpd.eggs.push(egg);
  const cd = Date.now() + BREED_COOLDOWN_MS;
  male.breedCooldownUntil = cd; female.breedCooldownUntil = cd;
  male.happiness = Math.max(0, (male.happiness ?? 100) - 10); female.happiness = Math.max(0, (female.happiness ?? 100) - 15);
  male.hunger = Math.min(100, (male.hunger ?? 0) + 15); female.hunger = Math.min(100, (female.hunger ?? 0) + 20);
  PetManager.save();
  return {
    success: true, egg, mixed, childId,
    message: [
      `💞 *MATING SUCCESSFUL!*`,
      `${male.emoji} ${male.nickname || male.name} ♂️  ×  ${female.emoji} ${female.nickname || female.name} ♀️`,
      ``,
      `${egg.emoji} *${egg.name}* laid → given to the ♀️ owner's egg bag.`,
      mixed ? `🌈 *A HYBRID!* The parents' bloodlines mixed into something new…` : `🧬 The hatchling will take after one of its parents.`,
      `⏳ Both parents rest for 12h. /eggs to view · /pet hatch <#> to hatch.`,
    ].join('\n'),
  };
}

/** Cross-player proposal flow. */
function propose(fromJid, male, toJid, female) {
  const c = compatibility(male, female);
  if (!c.ok) return { success: false, message: `❌ ${c.reason}` };
  if (genderOf(male) !== 'male') return { success: false, message: `❌ You propose with your ♂️ pet; the ♀️ side accepts. (${male.nickname || male.name} is ♀️ — ask the other player to propose instead.)` };
  proposals.set(toJid, { from: fromJid, maleId: male.instanceId, femaleId: female.instanceId, at: Date.now() });
  return { success: true, message: `💌 Proposal sent: your ${male.emoji} *${male.nickname || male.name}* ♂️ → their ${female.emoji} *${female.nickname || female.name}* ♀️.\nThey have 10 min to reply */pet mate accept* (the egg goes to them).` };
}
function accept(femaleOwner) {
  const p = proposals.get(femaleOwner);
  if (!p) return { success: false, message: '❌ No pending mating proposal for you.' };
  proposals.delete(femaleOwner);
  if (Date.now() - p.at > PROPOSAL_TTL_MS) return { success: false, message: '⏳ That proposal expired.' };
  const male = (PetManager.getPlayerPets(p.from) || []).find(x => x.instanceId === p.maleId);
  const female = (PetManager.getPlayerPets(femaleOwner) || []).find(x => x.instanceId === p.femaleId);
  if (!male || !female) return { success: false, message: '❌ One of the pets is no longer available.' };
  return breed(p.from, male, femaleOwner, female);
}
function decline(femaleOwner) { const had = proposals.delete(femaleOwner); return { success: had, message: had ? '💔 Proposal declined.' : '❌ No pending proposal.' }; }

/** Transfer a pet to another player. */
function givePet(fromJid, pet, toJid) {
  if (!pet) return { success: false, message: '❌ Pet not found.' };
  if (fromJid === toJid) return { success: false, message: '❌ You already own that pet.' };
  const fpd = PetManager.getPlayerData(fromJid); const tpd = PetManager.getPlayerData(toJid);
  if ((tpd.pets || []).length >= 20) return { success: false, message: '❌ Their pet storage is full (20/20).' };
  const i = fpd.pets.findIndex(x => x.instanceId === pet.instanceId);
  if (i < 0) return { success: false, message: '❌ Pet not found.' };
  fpd.pets.splice(i, 1);
  if (fpd.activePet === pet.instanceId) fpd.activePet = fpd.pets[0] ? fpd.pets[0].instanceId : null;
  pet.giftedFrom = fromJid; pet.giftedAt = Date.now();
  tpd.pets.push(pet);
  if (!tpd.activePet) tpd.activePet = pet.instanceId;
  PetManager.save();
  return { success: true, message: `🎁 ${pet.emoji} *${pet.nickname || pet.name}* ${genderIcon(pet)} was given away.` };
}
/** Transfer an egg to another player. */
function giveEgg(fromJid, eggIndex, toJid) {
  const fpd = PetManager.getPlayerData(fromJid); const tpd = PetManager.getPlayerData(toJid);
  const egg = fpd.eggs[eggIndex];
  if (!egg) return { success: false, message: '❌ No egg at that slot.' };
  if (fromJid === toJid) return { success: false, message: '❌ That is already your egg.' };
  if ((tpd.eggs || []).length >= 5) return { success: false, message: '❌ Their egg bag is full (5/5).' };
  fpd.eggs.splice(eggIndex, 1);
  egg.giftedFrom = fromJid; egg.giftedAt = Date.now();
  tpd.eggs.push(egg);
  PetManager.save();
  return { success: true, egg, message: `🎁 ${egg.emoji} *${egg.name}* was given away.` };
}

function eggInfo(egg, idx) {
  if (!egg) return '❌ No egg at that slot.';
  const lines = [
    `${egg.emoji} *${egg.name}* ${idx != null ? `(#${idx + 1})` : ''}`,
    `⭐ Rarity: ${String(egg.rarity || 'common').toUpperCase()}`,
    `📝 ${egg.desc || ''}`,
    `🐣 Hatch: /pet hatch ${idx != null ? idx + 1 : '<#>'}`,
  ];
  if (egg.bred && egg.parents) {
    lines.push(``, `🧬 *Lineage*`, `  ♂️ ${egg.parents.male.name}`, `  ♀️ ${egg.parents.female.name}`, egg.mixed ? `  🌈 Hybrid — a mixed species awaits!` : `  Takes after a parent.`);
  } else {
    const def = EGG_TYPES[egg.eggId];
    if (def) lines.push(``, `🎲 Possible pets: ${(def.possiblePets || []).map(id => (PET_DATABASE[id] || {}).name || id).join(', ')}`);
  }
  lines.push(`📅 Obtained: ${new Date(egg.obtainedAt || Date.now()).toISOString().slice(0, 10)}`);
  return lines.join('\n');
}

module.exports = { genderOf, genderIcon, familyOf, ensureGenders, findPet, compatibility, breed, propose, accept, decline, givePet, giveEgg, eggInfo, PET_MIX, CROSS_OK, BREED_COOLDOWN_MS, MIN_LEVEL };
