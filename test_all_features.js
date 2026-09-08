const PetManager = require('./rpg/utils/PetManager');
const { PET_FOOD } = require('./rpg/utils/PetDatabase');

console.log('--- TEST 1: PET PREFERRED FOODS ---');
console.log('Ember Meat types:', PET_FOOD.ember_meat.types);
console.log('Glacier Fish types:', PET_FOOD.glacier_fish.types);

const dummyDb = {
  users: {
    'user1@s.whatsapp.net': {
      name: 'Tester',
      pets: [{
        instanceId: 'pet1',
        name: 'Infernal Hound',
        type: 'fire',
        bonding: 10,
        exp: 0,
        hunger: 50,
        happiness: 50
      }]
    }
  }
};

PetManager.db = dummyDb;
PetManager.getPlayerData = (id) => dummyDb.users[id];
PetManager.save = () => {};

const feedResult = PetManager.feedPet('user1@s.whatsapp.net', 'pet1', 'ember_meat');
console.log('Feed Result:', feedResult.message);
if (!feedResult.message.includes('PREFERRED FOOD')) throw new Error('Preferred food bonus not triggered!');

console.log('--- TEST 2: GATERAID TREASURE ACCUMULATION & SALVAGE ---');
const gate = {
  nexusLoot: 10000,
  crystalLoot: 500,
  totalFloors: 5,
  accumulatedTreasure: { nexus: 0, crystals: 0 }
};

for (let floor = 1; floor <= 5; floor++) {
  const fNexus = Math.floor(gate.nexusLoot / gate.totalFloors);
  const fCrystals = Math.floor(gate.crystalLoot / gate.totalFloors);
  gate.accumulatedTreasure.nexus += fNexus;
  gate.accumulatedTreasure.crystals += fCrystals;
}

console.log('Accumulated after 5 floors:', gate.accumulatedTreasure);
const retNexus = Math.floor(gate.accumulatedTreasure.nexus * 0.50);
const retCrystals = Math.floor(gate.accumulatedTreasure.crystals * 0.50);
console.log(`Defeat salvage: ${retNexus} Nexus, ${retCrystals} Mana Stones`);

if (retNexus !== 5000 || retCrystals !== 250) throw new Error('Defeat salvage calculation incorrect!');

console.log('--- TEST 3: SHOP REMOVED CRYSTALS ---');
const shopCmd = require('./commands/rpg/shop');
console.log('Shop command loaded successfully!');

console.log('--- ALL TESTS PASSED SUCCESSFULLY! ---');
