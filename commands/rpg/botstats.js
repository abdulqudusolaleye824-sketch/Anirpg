const fs   = require('fs');
const path = require('path');
const Perms = require('../../utils/permissions');

module.exports = {
  name: 'botstats',
  description: '📊 View comprehensive bot statistics',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();

    if (!Perms.isBotMod(db, sender)) {
      return sock.sendMessage(chatId, {
        text: '❌ *Mods / Owners only.*\n\nYou need mod permissions to view bot statistics.'
      }, { quoted: msg });
    }

    // ── Load side databases ──────────────────────────────────────
    function loadJson(filePath) {
      try { return JSON.parse(fs.readFileSync(filePath, 'utf-8')); }
      catch { return {}; }
    }
    const dataDir     = path.join(__dirname, '../../rpg/data');
    const achievements = loadJson(path.join(dataDir, 'achievements.json'));
    const playerPets   = loadJson(path.join(dataDir, 'playerPets.json'));
    const playerQuests = loadJson(path.join(dataDir, 'playerQuests.json'));

    // ── Users ────────────────────────────────────────────────────
    const users       = Object.values(db.users || {});
    const totalUsers  = users.length;
    // Build a deduplicated set: owner + co-owner + botMods (per the shared Perms tier)
    const adminSet = new Set(Perms.getBotOwners(db).map(j => j.split('@')[0]));
    (Perms.getBotMods(db) || []).forEach(m => adminSet.add(m.split('@')[0]));
    const totalAdmins = adminSet.size;
    const totalBanned = Object.keys(db.bannedUsers || {}).length;
    const totalMuted  = Object.keys(db.mutedUsers  || {}).length;
    const totalAFK    = Object.keys(db.afkUsers    || {}).length;

    const oneDayAgo   = Date.now() - 86400000;
    const active24h   = users.filter(u => u.lastActive && u.lastActive > oneDayAgo).length;

    // ── Level stats ──────────────────────────────────────────────
    const levels  = users.map(u => u.level || 1);
    const avgLevel = levels.length ? Math.round(levels.reduce((a,b) => a+b,0) / levels.length * 10) / 10 : 0;
    const maxLevel = levels.length ? Math.max(...levels) : 0;
    const minLevel = levels.length ? Math.min(...levels) : 0;

    // Level brackets
    const lv1_10  = levels.filter(l => l <= 10).length;
    const lv11_30 = levels.filter(l => l > 10 && l <= 30).length;
    const lv31_50 = levels.filter(l => l > 30 && l <= 50).length;
    const lv51p   = levels.filter(l => l > 50).length;

    // Top 3 players
    const top3 = [...users].sort((a,b) => (b.level||1) - (a.level||1)).slice(0,3);

    // ── Class distribution ───────────────────────────────────────
    const classCount = {};
    users.forEach(u => {
      const cn = u.class?.name || 'Unknown';
      classCount[cn] = (classCount[cn] || 0) + 1;
    });
    const topClasses = Object.entries(classCount)
      .sort((a,b) => b[1]-a[1]).slice(0,5)
      .map(([name, count]) => `   ${name}: ${count}`).join('\n');
    const rarityCount = { common:0, rare:0, epic:0, legendary:0, divine:0 };
    users.forEach(u => { const r = u.class?.rarity; if (r && rarityCount[r] !== undefined) rarityCount[r]++; });

    // ── Economy ──────────────────────────────────────────────────
    const totalNexus     = users.reduce((s,u) => s + (u.gold||0), 0);
    const totalCrystals = users.reduce((s,u) => s + (u.manaCrystals||0), 0);
    const richestUser   = users.reduce((r,u) => ((u.gold||0) > (r?.gold||0) ? u : r), null);

    // ── Banks ────────────────────────────────────────────────────
    const banks         = Object.values(db.banks || {});
    const totalBanks    = banks.length;
    const totalAccounts = banks.reduce((s,b) => s + (b.accounts?.length||0), 0);
    const totalBankNexus = banks.reduce((s,b) => s + (b.accounts||[]).reduce((ss,a) => ss+(a.balance||0),0), 0);

    // ── Guilds ───────────────────────────────────────────────────
    const guilds       = Object.values(db.guilds || {});
    const totalGuilds  = guilds.length;
    const totalGuildMembers = guilds.reduce((s,g) => s + (g.members?.length||0), 0);
    const topGuild     = guilds.sort((a,b) => (b.members?.length||0)-(a.members?.length||0))[0];

    // ── Combat stats ─────────────────────────────────────────────
    const totalBossKills    = users.reduce((s,u) => {
      const bd = u.bossesDefeated;
      return s + (typeof bd === 'number' ? bd : (bd?.total||0));
    }, 0);
    const totalDungeonClears = users.reduce((s,u) => s + (u.dungeon?.gatesCleared||0), 0);
    const inBossBattle  = users.filter(u => u.inBossBattle).length;
    const pvpWins       = users.reduce((s,u) => s + (u.pvp?.wins||0), 0);
    const pvpLosses     = users.reduce((s,u) => s + (u.pvp?.losses||0), 0);

    // ── Pets & Quests & Achievements ─────────────────────────────
    const totalPetOwners   = Object.keys(playerPets).length;
    const totalQuestPlayers = Object.keys(playerQuests).length;
    const totalAchievementPlayers = Object.keys(achievements).length;

    // ── Groups ───────────────────────────────────────────────────
    const totalGroups   = Object.keys(db.groupSettings || {}).length;
    const antiLinkGroups = Object.values(db.groupSettings || {}).filter(g => g.antiLink).length;

    // ── Subscribers ──────────────────────────────────────────────
    const totalSubs = Object.keys(db.subscribers || {}).length;

    const now = new Date();

    const out = `━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 BOT STATISTICS 📊
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📅 ${now.toLocaleDateString()} ${now.toLocaleTimeString()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
👥 HUNTERS
━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 Total Registered: ${totalUsers}
🟢 Active (24h): ${active24h}
👑 Admins: ${totalAdmins}
🚫 Banned: ${totalBanned}
🔇 Muted: ${totalMuted}
💤 AFK: ${totalAFK}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
⭐ LEVELS
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📈 Average: ${avgLevel} | Max: ${maxLevel} | Min: ${minLevel}
📊 Lv 1–10:  ${lv1_10}  |  11–30: ${lv11_30}
   Lv 31–50: ${lv31_50}  |  51+:   ${lv51p}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏆 TOP HUNTERS
━━━━━━━━━━━━━━━━━━━━━━━━━━━
${top3.map((p,i) => `${['🥇','🥈','🥉'][i]} ${p.name} — Lv${p.level||1} ${p.class?.name||'?'}`).join('\n')}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚔️ CLASSES
━━━━━━━━━━━━━━━━━━━━━━━━━━━
${topClasses}
💠 Common: ${rarityCount.common}  🔵 Rare: ${rarityCount.rare}
🟣 Epic: ${rarityCount.epic}  🟡 Legendary: ${rarityCount.legendary}  ⚗️ Divine: ${rarityCount.divine}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💠 ECONOMY
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💵 Total Wallet Nexus: ${totalNexus.toLocaleString()}
🏦 Total Bank Nexus:   ${totalBankNexus.toLocaleString()}
💎 Total 💎 Mana Stones:    ${totalCrystals.toLocaleString()}
${richestUser ? `👑 Richest: ${richestUser.name} (${(richestUser.gold||0).toLocaleString()} 💠)` : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏦 BANKS
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏛️ Banks: ${totalBanks}  |  Accounts: ${totalAccounts}
💠 Total Deposits: ${totalBankNexus.toLocaleString()} 💠
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏰 GUILDS
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏰 Total Guilds: ${totalGuilds}  |  Members: ${totalGuildMembers}
${topGuild ? `👑 Largest: ${topGuild.name} (${topGuild.members?.length||0} members)` : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚔️ COMBAT
━━━━━━━━━━━━━━━━━━━━━━━━━━━
👹 Boss Kills: ${totalBossKills.toLocaleString()}
🚪 Dungeon Clears: ${totalDungeonClears.toLocaleString()}
⚔️ PvP: ${pvpWins}W / ${pvpLosses}L
🔴 Currently in Battle: ${inBossBattle}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🐾 PETS & QUESTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🐾 Pet Owners: ${totalPetOwners}
📜 Quest Players: ${totalQuestPlayers}
🏅 Achievement Players: ${totalAchievementPlayers}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌐 GROUPS & SYSTEM
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📱 Groups: ${totalGroups}  |  AntiLink: ${antiLinkGroups}
📬 Subscribers: ${totalSubs}
━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

    await sock.sendMessage(chatId, { text: out }, { quoted: msg });
  }
};