const fs   = require('fs');
const path = require('path');
const Perms = require('../../utils/permissions');
const UI = require('../../rpg/utils/UI');

module.exports = {
  name: 'botstats',
  description: '📊 View comprehensive bot statistics',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const proB = UI.isPro(db.users[sender]);

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
    // 10-30 (owner): ACCURATE figures — owners/mods/bot numbers are not "hunters"; expired mutes don't count;
    // activity = any command OR any group message in the last 24 h (db.lastSeen is fed by every group message).
    const _nowTs = Date.now();
    const totalBanned = Object.keys(db.bannedUsers || {}).length;
    const totalMuted  = Object.values(db.mutedUsers || {}).filter(m => m && (!m.endsAt || m.endsAt > _nowTs)).length
                      + Object.values(db.groupMutes || {}).reduce((n, g) => n + Object.values(g || {}).filter(m => m && (!m.endsAt || m.endsAt > _nowTs)).length, 0);
    const totalAFK    = Object.keys(db.afkUsers    || {}).length;

    const oneDayAgo   = _nowTs - 86400000;
    const _seenOf = (u, jid) => Math.max(Number(u.lastActive) || 0, Number(u.lastCommandAt) || 0, Number((db.lastSeen || {})[jid] || (db.lastSeen || {})[u.jid] || 0));
    const active24h   = Object.entries(db.users || {}).filter(([jid, u]) => u && _seenOf(u, jid) > oneDayAgo).length;
    const active7d    = Object.entries(db.users || {}).filter(([jid, u]) => u && _seenOf(u, jid) > _nowTs - 7 * 86400000).length;

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
      const bd = u.bossesDefeated; const sh = (u.stats_history && u.stats_history.bossesDefeated) || 0;
      return s + Math.max(typeof bd === 'number' ? bd : (bd?.total||0), sh);
    }, 0);
    const totalDungeonClears = users.reduce((s,u) => s + Math.max((u.dungeon?.gatesCleared||0), (u.stats_history?.gatesCleared||0)), 0);
    let liveRaids = 0, liveRaiders = 0, liveGates = 0;
    try { const GM = require('../../rpg/dungeons/GateManager'); const gs = Object.values(GM.activeGates || {}); liveGates = gs.length; for (const g of gs) { if (g && g.raid && g.raid.status === 'active') { liveRaids++; liveRaiders += (g.raid.members || []).length; } } } catch (e) {}
    const inInstance    = users.filter(u => u.instance && u.instance.active).length;
    const inPvp         = users.filter(u => u.pvpBattle && u.pvpBattle.opponentId).length;
    const inBossBattle  = liveRaiders + inInstance + inPvp;
    const pvpWins       = users.reduce((s,u) => s + (u.pvpWins || u.pvp?.wins || 0), 0);
    const pvpLosses     = users.reduce((s,u) => s + (u.pvpLosses || u.pvp?.losses || 0), 0);

    // ── Pets & Quests & Achievements ─────────────────────────────
    let totalPetOwners = 0;
    try { const PMg = require('../../rpg/utils/PetManager'); for (const v of PMg.playerPets.values()) if (v && ((v.pets || []).length || v.activePet)) totalPetOwners++; } catch (e) { totalPetOwners = Object.values(playerPets).filter(v => v && ((v.pets || []).length || v.activePet)).length; }
    const totalQuestPlayers = users.filter(u => u.dailyQuests && (u.dailyQuests.quests || []).length).length || Object.keys(playerQuests).length;
    const totalAchievementPlayers = users.filter(u => u.achievements && (u.achievements.unlocked || []).length).length || Object.keys(achievements).length;

    // ── Groups ───────────────────────────────────────────────────
    let totalGroups = 0, stoppedGroups = 0, groupsWithBot = 0;
    try {
      const PMp = require('../../bots/PersonalityManager');
      const ids = new Set([...Object.keys(db.botActive || {}), ...Object.keys(db.botPresent || {}), ...Object.keys(db.groupSettings || {})].filter(k => String(k).endsWith('@g.us')));
      totalGroups = ids.size;
      for (const id of ids) { if (PMp.isStopped(id)) stoppedGroups++; else if (PMp.getActiveBot(id)) groupsWithBot++; }
    } catch (e) { totalGroups = Object.keys(db.groupSettings || {}).length; }
    const antiLinkGroups = Object.values(db.groupSettings || {}).filter(g => g && !g.antiLinkOff).length; // anti-link is ON by default

    // ── Subscribers ──────────────────────────────────────────────
    const totalSubs = Object.keys(db.subscribers || {}).length;

    const now = new Date();

    let out = `${(proB ? UI.PRO_BAR : UI.FREE_BAR)}
📊 BOT STATISTICS 📊
📅 ${now.toLocaleDateString()} ${now.toLocaleTimeString()}
${proB ? `${UI.PRO_MINI}\n👑 PRO OVERWATCH\n💹 Avg wallet/hunter: *${Math.round(totalNexus / (totalUsers || 1)).toLocaleString()}* 💠 · ⚔️ PvP win-rate: *${pvpWins + pvpLosses ? Math.round(pvpWins / (pvpWins + pvpLosses) * 100) : 0}%*` : `${(proB ? UI.PRO_MINI : UI.FREE_MINI)}
👥 HUNTERS`}
${proB ? `${(proB ? UI.PRO_MINI : UI.FREE_MINI)}
👥 HUNTERS` : ''}
👤 Total Registered: ${totalUsers}
🟢 Active (24h): ${active24h}  |  7d: ${active7d}
👑 Admins: ${totalAdmins}
🚫 Banned: ${totalBanned}
🔇 Muted: ${totalMuted}
💤 AFK: ${totalAFK}
${(proB ? UI.PRO_MINI : UI.FREE_MINI)}
⭐ LEVELS
📈 Average: ${avgLevel} | Max: ${maxLevel} | Min: ${minLevel}
📊 Lv 1–10:  ${lv1_10}  |  11–30: ${lv11_30}
   Lv 31–50: ${lv31_50}  |  51+:   ${lv51p}
${(proB ? UI.PRO_MINI : UI.FREE_MINI)}
🏆 TOP HUNTERS
${top3.map((p,i) => `${['🥇','🥈','🥉'][i]} ${p.name} — Lv${p.level||1} ${p.class?.name||'?'}`).join('\n')}
${(proB ? UI.PRO_MINI : UI.FREE_MINI)}
⚔️ CLASSES
${topClasses}
💠 Common: ${rarityCount.common}  🔵 Rare: ${rarityCount.rare}
🟣 Epic: ${rarityCount.epic}  🟡 Legendary: ${rarityCount.legendary}  ⚗️ Divine: ${rarityCount.divine}
${(proB ? UI.PRO_MINI : UI.FREE_MINI)}
💠 ECONOMY
💵 Total Wallet Nexus: ${totalNexus.toLocaleString()}
🏦 Total Bank Nexus:   ${totalBankNexus.toLocaleString()}
💎 Total 💎 Mana Stones:    ${totalCrystals.toLocaleString()}
${richestUser ? `👑 Richest: ${richestUser.name} (${(richestUser.gold||0).toLocaleString()} 💠)` : ''}
${(proB ? UI.PRO_MINI : UI.FREE_MINI)}
🏦 BANKS
🏛️ Banks: ${totalBanks}  |  Accounts: ${totalAccounts}
💠 Total Deposits: ${totalBankNexus.toLocaleString()} 💠
${(proB ? UI.PRO_MINI : UI.FREE_MINI)}
🏰 GUILDS
🏰 Total Guilds: ${totalGuilds}  |  Members: ${totalGuildMembers}
${topGuild ? `👑 Largest: ${topGuild.name} (${topGuild.members?.length||0} members)` : ''}
${(proB ? UI.PRO_MINI : UI.FREE_MINI)}
⚔️ COMBAT
👹 Boss Kills: ${totalBossKills.toLocaleString()}
🚪 Dungeon Clears: ${totalDungeonClears.toLocaleString()}
⚔️ PvP: ${pvpWins}W / ${pvpLosses}L
🔴 In battle now: ${inBossBattle} (raiders ${liveRaiders} in ${liveRaids} live raid${liveRaids === 1 ? '' : 's'} · instance ${inInstance} · PvP ${inPvp}) · open gates ${liveGates}
${(proB ? UI.PRO_MINI : UI.FREE_MINI)}
🐾 PETS & QUESTS
🐾 Pet Owners: ${totalPetOwners}
📜 Quest Players: ${totalQuestPlayers}
🏅 Achievement Players: ${totalAchievementPlayers}
${(proB ? UI.PRO_MINI : UI.FREE_MINI)}
🌐 GROUPS & SYSTEM
📱 Groups: ${totalGroups}  |  bot active: ${groupsWithBot}  |  stopped: ${stoppedGroups}  |  AntiLink on: ${antiLinkGroups}
📬 Subscribers: ${totalSubs}
${(proB ? UI.PRO_BAR : UI.FREE_BAR)}`;

    // Push #80: inbound trace — where did the last messages go, per bot?
    try {
      const MSM = require('../../bots/MultiSocketManager');
      const tr = MSM.getInboundTrace ? MSM.getInboundTrace() : {};
      // 10-30 (owner): COMPACT — one line per bot, drop reasons collapsed to their name (no present= lists, no per-message log).
      // Full detail: /botstats trace [bot].
      const _short = (w) => String(w).replace(/\(.*$/, '');
      const wantTrace = /^trace$/i.test(String(args[0] || ''));
      const only = wantTrace && args[1] ? String(args[1]).toLowerCase() : null;
      const L = ['', wantTrace ? '📡 *INBOUND TRACE — detail (since boot)*' : '📡 *INBOUND (since boot)* — _/botstats trace [bot] for detail_'];
      const rows = Object.entries(tr).filter(([k]) => !only || k.toLowerCase() === only).sort((a, b) => (b[1].handled || 0) - (a[1].handled || 0));
      for (const [k, t] of rows) {
        const agg = {}; for (const [w, n] of Object.entries(t.drops || {})) { const sw = _short(w); agg[sw] = (agg[sw] || 0) + n; }
        const drops = Object.entries(agg).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([w, n]) => `${w} ${n}`).join(' · ') || '—';
        L.push(`*${k}* · heard ${t.received} · cmds ${t.commands} · answered ${t.handled} · skipped: ${drops}`);
        if (wantTrace) for (const l of (t.last || []).slice(-8)) L.push(`  ${String(l).replace(/\(active=([^,]+),present=[^)]*\)/, '($1 active)')}`);
      }
      if (!wantTrace) L.push('_skipped = messages this bot saw but another bot answered (normal with several bots per GC)_');
      out += '\n' + L.join('\n');
    } catch (e) {}
    await sock.sendMessage(chatId, { text: out }, { quoted: msg });
  }
};