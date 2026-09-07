// ═══════════════════════════════════════════════════════════════
// FRIEND SYSTEM - Bond Levels, Streaks, Gifts, Perks
// ═══════════════════════════════════════════════════════════════

const STREAK_TITLES = [
  { days: 7,   title: 'Acquaintance',   emoji: '🤝' },
  { days: 30,  title: 'Battle Buddy',   emoji: '⚔️' },
  { days: 100, title: 'Ride or Die',    emoji: '🔥' },
  { days: 365, title: 'Legendary Bond', emoji: '🌌' }
];

const BOND_PERKS = [
  { level: 1,  xpBonus: 0.05, goldBonus: 0.05, atkBonus: 0 },
  { level: 2,  xpBonus: 0.08, goldBonus: 0.08, atkBonus: 0.02 },
  { level: 3,  xpBonus: 0.10, goldBonus: 0.10, atkBonus: 0.05 },
  { level: 4,  xpBonus: 0.13, goldBonus: 0.13, atkBonus: 0.07 },
  { level: 5,  xpBonus: 0.15, goldBonus: 0.15, atkBonus: 0.10 }
];

const GIFT_COST = { gold: 10000, crystals: 500 };
const MAX_FRIENDS = 10;
const STREAK_WINDOW_MS = 10 * 60 * 60 * 1000; // 10 hours

function getFriendData(player) {
  if (!player.friends) {
    player.friends = {
      list: [],           // [{ id, name, since, bondLevel, bondXp, lastInteract, streak }]
      requests: [],       // incoming: [{ from, fromName, sentAt }]
      lastGift: {},       // { friendId: timestamp }
      lastHelp: 0,        // timestamp of last /friend help used
      lastDuel: {}        // { friendId: timestamp }
    };
  }
  return player.friends;
}

function getBondLevel(bondXp) {
  if (bondXp >= 500) return 5;
  if (bondXp >= 250) return 4;
  if (bondXp >= 100) return 3;
  if (bondXp >= 40)  return 2;
  return 1;
}

function getBondPerks(bondLevel) {
  return BOND_PERKS[Math.min(bondLevel - 1, BOND_PERKS.length - 1)];
}

function getStreakTitle(streak) {
  let current = null;
  for (const t of STREAK_TITLES) {
    if (streak >= t.days) current = t;
  }
  return current;
}

// Add bond XP from an interaction
function addBondXp(friendEntry, amount) {
  friendEntry.bondXp = (friendEntry.bondXp || 0) + amount;
  friendEntry.bondLevel = getBondLevel(friendEntry.bondXp);
}

// Update interaction streak — must interact within 10 hours
function updateStreak(friendEntry) {
  const now = Date.now();
  const last = friendEntry.lastInteract || 0;
  const diff = now - last;

  if (diff <= STREAK_WINDOW_MS) {
    // Within window — streak continues, don't double-count same session
    if (diff > 60000) { // at least 1 minute since last interaction
      friendEntry.streak = (friendEntry.streak || 0) + 1;
    }
  } else {
    // Window expired — reset streak
    friendEntry.streak = 1;
  }
  friendEntry.lastInteract = now;
  addBondXp(friendEntry, 2);
}

// Check if two players are friends
function areFriends(playerA, playerB) {
  const fd = playerA.friends;
  if (!fd) return false;
  return fd.list.some(f => f.id === playerB);
}

// Send friend request
function sendRequest(sender, senderName, target) {
  const fd = getFriendData(target);
  if (fd.list.length >= MAX_FRIENDS) return { ok: false, reason: 'Their friend list is full (10/10)' };
  if (fd.requests.some(r => r.from === sender)) return { ok: false, reason: 'Request already sent' };
  if (areFriends(target, sender)) return { ok: false, reason: 'Already friends' };
  fd.requests.push({ from: sender, fromName: senderName, sentAt: Date.now() });
  return { ok: true };
}

// Accept a friend request
function acceptRequest(player, playerId, playerName, requesterId, requesterName, requesterPlayer) {
  const fd = getFriendData(player);
  const rfd = getFriendData(requesterPlayer);

  const reqIdx = fd.requests.findIndex(r => r.from === requesterId);
  if (reqIdx === -1) return { ok: false, reason: 'No pending request from this player' };
  if (fd.list.length >= MAX_FRIENDS) return { ok: false, reason: 'Your friend list is full (10/10)' };
  if (rfd.list.length >= MAX_FRIENDS) return { ok: false, reason: 'Their friend list is full (10/10)' };

  fd.requests.splice(reqIdx, 1);
  const now = Date.now();

  fd.list.push({ id: requesterId, name: requesterName, since: now, bondLevel: 1, bondXp: 0, lastInteract: now, streak: 1 });
  rfd.list.push({ id: playerId, name: playerName, since: now, bondLevel: 1, bondXp: 0, lastInteract: now, streak: 1 });
  return { ok: true };
}

// Remove friend
function removeFriend(player, friendId, friendPlayer) {
  const fd = getFriendData(player);
  const idx = fd.list.findIndex(f => f.id === friendId);
  if (idx === -1) return false;
  fd.list.splice(idx, 1);
  // Remove from other side too
  if (friendPlayer) {
    const rfd = getFriendData(friendPlayer);
    const ridx = rfd.list.findIndex(f => f.id === player._id || f.name === player.name);
    if (ridx !== -1) rfd.list.splice(ridx, 1);
  }
  return true;
}

// Check if gift cooldown is up (24hr per friend)
function canGift(player, friendId) {
  const fd = getFriendData(player);
  const last = fd.lastGift?.[friendId] || 0;
  return Date.now() - last >= 24 * 60 * 60 * 1000;
}

// Generate a random gift
function generateGift(bondLevel) {
  const pool = [
    { name: 'Health Potion', type: 'item' },
    { name: 'Energy Potion', type: 'item' },
    { gold: 5000 + bondLevel * 2000, type: 'gold' },
    { crystals: 100 + bondLevel * 50, type: 'crystals' },
    { name: 'Luck Potion', type: 'item' }
  ];
  if (bondLevel >= 3) pool.push({ name: 'Revive Token', type: 'item' });
  if (bondLevel >= 5) pool.push({ gold: 20000, crystals: 500, type: 'both' });
  return pool[Math.floor(Math.random() * pool.length)];
}

// Format friend list for display
function formatFriendList(player) {
  const fd = getFriendData(player);
  if (!fd.list.length) return '❌ No friends yet. Use /friend add @user to send a request!';

  let msg = '';
  fd.list.forEach((f, i) => {
    const perks = getBondPerks(f.bondLevel);
    const streakTitle = getStreakTitle(f.streak || 0);
    const titleStr = streakTitle ? ` ${streakTitle.emoji} ${streakTitle.title}` : '';
    msg += `${i+1}. *${f.name}*${titleStr}\n`;
    msg += `   💫 Bond Lv.${f.bondLevel} | 🔥 Streak: ${f.streak || 0} days\n`;
    msg += `   📈 Party Perks: +${Math.floor(perks.xpBonus*100)}% XP, +${Math.floor(perks.goldBonus*100)}% Nexus`;
    if (perks.atkBonus > 0) msg += `, +${Math.floor(perks.atkBonus*100)}% ATK`;
    msg += '\n\n';
  });
  return msg;
}

module.exports = {
  MAX_FRIENDS, GIFT_COST, STREAK_WINDOW_MS,
  getFriendData, getBondLevel, getBondPerks,
  getStreakTitle, addBondXp, updateStreak,
  areFriends, sendRequest, acceptRequest,
  removeFriend, canGift, generateGift, formatFriendList
};
