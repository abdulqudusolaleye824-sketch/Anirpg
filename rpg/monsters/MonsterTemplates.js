const monsterTypes = [
  // F-Rank Monsters (Level 1-3)
  {
    name: 'Goblin',
    rank: 'F',
    baseHp: 50,
    baseAtk: 8,
    baseDef: 3,
    weakness: 'Warrior'
  },
  {
    name: 'Slime',
    rank: 'F',
    baseHp: 40,
    baseAtk: 6,
    baseDef: 2,
    weakness: 'Mage'
  },
  {
    name: 'Wild Wolf',
    rank: 'F',
    baseHp: 55,
    baseAtk: 10,
    baseDef: 4,
    weakness: 'Archer'
  },

  // E-Rank Monsters (Level 4-6)
  {
    name: 'Skeleton',
    rank: 'E',
    baseHp: 70,
    baseAtk: 12,
    baseDef: 6,
    weakness: 'Paladin'
  },
  {
    name: 'Zombie',
    rank: 'E',
    baseHp: 80,
    baseAtk: 10,
    baseDef: 8,
    weakness: 'Mage'
  },
  {
    name: 'Dark Wolf',
    rank: 'E',
    baseHp: 75,
    baseAtk: 14,
    baseDef: 5,
    weakness: 'Rogue'
  },

  // D-Rank Monsters (Level 7-10)
  {
    name: 'Orc Warrior',
    rank: 'D',
    baseHp: 100,
    baseAtk: 18,
    baseDef: 10,
    weakness: 'Berserker'
  },
  {
    name: 'Shadow Beast',
    rank: 'D',
    baseHp: 110,
    baseAtk: 20,
    baseDef: 8,
    weakness: 'Assassin'
  },
  {
    name: 'Cursed Knight',
    rank: 'D',
    baseHp: 120,
    baseAtk: 16,
    baseDef: 12,
    weakness: 'Necromancer'
  },

  // C-Rank Monsters (Level 11-15)
  {
    name: 'Ice Demon',
    rank: 'C',
    baseHp: 140,
    baseAtk: 24,
    baseDef: 12,
    weakness: 'Mage'
  },
  {
    name: 'Vampire',
    rank: 'C',
    baseHp: 150,
    baseAtk: 26,
    baseDef: 14,
    weakness: 'Paladin'
  },
  {
    name: 'Stone Golem',
    rank: 'C',
    baseHp: 180,
    baseAtk: 22,
    baseDef: 20,
    weakness: 'Berserker'
  },

  // B-Rank Monsters (Level 16-20)
  {
    name: 'Necromancer',
    rank: 'B',
    baseHp: 130,
    baseAtk: 30,
    baseDef: 10,
    weakness: 'Rogue'
  },
  {
    name: 'Hell Hound',
    rank: 'B',
    baseHp: 160,
    baseAtk: 32,
    baseDef: 15,
    weakness: 'Archer'
  },
  {
    name: 'Wyvern',
    rank: 'B',
    baseHp: 200,
    baseAtk: 35,
    baseDef: 18,
    weakness: 'DragonKnight'
  },

  // A-Rank Monsters (Level 21-25)
  {
    name: 'Dragon Whelp',
    rank: 'A',
    baseHp: 220,
    baseAtk: 40,
    baseDef: 20,
    weakness: 'DragonKnight'
  },
  {
    name: 'Demon Lord',
    rank: 'A',
    baseHp: 250,
    baseAtk: 45,
    baseDef: 22,
    weakness: 'Devourer'
  },
  {
    name: 'Ancient Lich',
    rank: 'A',
    baseHp: 200,
    baseAtk: 50,
    baseDef: 18,
    weakness: 'Necromancer'
  },

  // S-Rank Monsters (Level 26+)
  {
    name: 'Elder Dragon',
    rank: 'S',
    baseHp: 300,
    baseAtk: 55,
    baseDef: 25,
    weakness: 'DragonKnight'
  },
  {
    name: 'Void Walker',
    rank: 'S',
    baseHp: 280,
    baseAtk: 60,
    baseDef: 23,
    weakness: 'Assassin'
  }
];

function generateMonster(level) {
  let availableMonsters = monsterTypes.filter(m => {
    if (level <= 3) return m.rank === 'F';
    if (level <= 6) return m.rank === 'E';
    if (level <= 10) return m.rank === 'D';
    if (level <= 15) return m.rank === 'C';
    if (level <= 20) return m.rank === 'B';
    if (level <= 25) return m.rank === 'A';
    return m.rank === 'S';
  });

  if (availableMonsters.length === 0) {
    availableMonsters = monsterTypes.filter(m => m.rank === 'S');
  }

  const template = availableMonsters[Math.floor(Math.random() * availableMonsters.length)];
  
  // ✅ FIX: Slight buff (1.10 instead of 1.08)
  const scaling = Math.pow(1.10, level - 1);
  
  const hp = Math.floor(template.baseHp * scaling);
  const atk = Math.floor(template.baseAtk * scaling);
  const def = Math.floor(template.baseDef * scaling);
  
  return {
    name: template.name,
    rank: template.rank,
    level,
    hp,
    maxHp: hp,
    atk,
    def,
    weakness: template.weakness,
    statusEffects: []
  };
}

function getDungeonRank(playerLevel) {
  if (playerLevel <= 3) return 'F';
  if (playerLevel <= 6) return 'E';
  if (playerLevel <= 10) return 'D';
  if (playerLevel <= 15) return 'C';
  if (playerLevel <= 20) return 'B';
  if (playerLevel <= 25) return 'A';
  return 'S';
}

module.exports = {
  generateMonster,
  monsterTypes,
  getDungeonRank
};