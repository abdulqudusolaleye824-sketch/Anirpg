module.exports = {
  name: 'help',
  aliases: ['h'],
  description: 'Display help and command list',
  usage: '/help [command]',
  category: 'system',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;

    // 🔹 /help <command>
    if (args[0]) {
      const cmdName = args[0].toLowerCase();

      // Load all commands from cache
      const commandFiles = Object.values(require.cache)
        .map(m => m.exports)
        .filter(
          c =>
            c &&
            typeof c === 'object' &&
            c.execute &&
            typeof c.execute === 'function' &&
            c.name
        );

      const command = commandFiles.find(
        c => c.name === cmdName || (Array.isArray(c.aliases) && c.aliases.includes(cmdName))
      );

      if (!command) {
        return sock.sendMessage(
          chatId,
          { text: `❌ Unknown command: *${cmdName}*\nUse /help to see all commands.` },
          { quoted: msg }
        );
      }

      const aliases = Array.isArray(command.aliases) && command.aliases.length
        ? command.aliases.map(a => '/' + a).join(', ')
        : null;

      const detailMessage = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📘 *COMMAND DETAILS*
━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔹 *Name:* ${command.name}
📝 *Description:* ${command.description || 'No description available'}
📌 *Usage:* ${command.usage || `/${command.name}`}
${aliases ? `🔁 *Aliases:* ${aliases}\n` : ''}📂 *Category:* ${command.category || 'general'}
👥 *Who can use:* ${command.availability || 'Everyone'}
📍 *Where:* ${command.where || 'Any chat'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
`.trim();

      return sock.sendMessage(chatId, { text: detailMessage }, { quoted: msg });
    }

    // 🔹 Category help pages
    const category = args[0]?.toLowerCase();

    if (category === 'pvp') {
      return sock.sendMessage(chatId, { text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚔️ *PVP HELP*
━━━━━━━━━━━━━━━━━━━━━━━━━━━

🥊 *STARTING A FIGHT*
/pvp challenge @user  — Send challenge (60s to accept)
/pvp accept           — Accept a challenge
/pvp decline          — Decline a challenge
/pvp rematch          — Instant rematch (2 min window)

⚔️ *BATTLE ACTIONS*
/pvp attack     — Basic attack (builds momentum)
/pvp guard      — Block 65% damage this turn
/pvp taunt      — Force opponent to attack you
/pvp feint      — Bait guards, steal momentum
/<classcmd> [skill]   — Use a class skill by name (e.g. /heal, /cast, /rage)
/pvp special    — Class special (needs 3 momentum ⚡)
/pvp ultimate   — Limit break (needs 5 gauge bars 🟣)
/pvp desperation — Emergency move (≤15% HP only 💀)
/pvp surrender  — Forfeit the match

📊 *INFO*
/pvp status     — Check current board & HP bars
/pvp skill      — View your skills & cooldowns
/pvp rank       — Your ELO rank & stats
/pvp history    — Last 10 match results
/pvp watch [@name] — Spectate an active battle
/pvp bet [amt] [name] — Bet Nexus on a fighter

🏆 *RANKINGS*
/leaderboard pvp — Top ELO fighters

💡 *TIPS*
• Arenas are random each fight — 8 unique zones
• Pets give passive ATK/DEF/SPD bonus in battle
• Chain same actions for combo bonuses
• At ≤20% HP you enter RAGE MODE (+30% ATK)
• Death = lose 5% of your Nexus
━━━━━━━━━━━━━━━━━━━━━━━━━━━` }, { quoted: msg });
    }

    if (category === 'guild') {
      return sock.sendMessage(chatId, { text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏰 *GUILD HELP*
━━━━━━━━━━━━━━━━━━━━━━━━━━━

🏰 *GUILD BASICS*
/guild create [name] — Create a guild (costs crystals)
/guild join [name]   — Join an existing guild
/guild leave         — Leave your current guild
/guild info          — View your guild's info
/guild members       — List all members

👑 *GUILD MANAGEMENT* (Leader only)
/guild kick @user    — Remove a member
/guild promote @user — Promote to officer
/guild demote @user  — Demote officer

⚔️ *GUILD WAR*
/guildwar declare [guild] — Declare war (48 hours)
/guildwar status          — Time left + scores
/guildwar score           — Per-member War Points
/guildwar history         — Past war results

🗡️ *GUILD RAID*
/guild raid          — Start a raid boss (3+ members)
/guild raid attack   — Attack the raid boss
/guild raid skill    — Use skill on raid boss
/guild raid status   — Check boss HP

💡 *WAR POINTS earned by:*
• 🏰 Dungeon floors (+1/floor)
• ⚔️ PvP wins (+5/win)
• 👹 Boss kills (+10/kill)
• 🌍 World Boss kills (+50)
━━━━━━━━━━━━━━━━━━━━━━━━━━━` }, { quoted: msg });
    }

    if (category === 'economy' || category === 'eco') {
      return sock.sendMessage(chatId, { text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
💠 *ECONOMY HELP*
━━━━━━━━━━━━━━━━━━━━━━━━━━━

💸 *SENDING RESOURCES*
/send Nexus @user [amt]     — Send Nexus (5% fee)
/send crystals @user [amt] — Send crystals (5% fee)
/history                   — Your last 10 transactions

🔄 *TRADING*
/trade offer @user [amt] [gold/crystals] — Make offer
/trade accept  — Accept incoming offer
/trade reject  — Reject incoming offer
/trade cancel  — Cancel your outgoing offer

🏪 *MARKET*
/market              — Browse listings
/market buy [#]      — Buy an item
/market sell [item] [price] — List item for sale
/market search [name] — Search listings
/market mine         — Your active listings

🎰 *CASINO* (opens when admin runs /casino open)
/casino slots [bet]              — 30s cooldown
/casino blackjack [bet]          — 15s cooldown
/casino roulette [bet] [choice]  — 20s cooldown
/casino dice [bet] [over/under] [#] — 10s cooldown

🏦 *BANK*
/bank deposit [amt]  — Store Nexus safely
/bank withdraw [amt] — Take Nexus out
/bank balance        — Check balance

💡 *GOLD SINKS*
• PvP death = lose 5% Nexus (winner gets half)
• Casino fees, market fees, guild costs

🌐 *COMMUNITY*
/community — View all ✦ 𝐀𝐬𝐭𝐫𝐚™ group links
/support   — Get support group link
━━━━━━━━━━━━━━━━━━━━━━━━━━━` }, { quoted: msg });
    }

    if (category === 'dungeon' || category === 'gate') {
      return sock.sendMessage(chatId, { text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏰 *DUNGEON HELP*
━━━━━━━━━━━━━━━━━━━━━━━━━━━

🏃 *FORMING A PARTY*
/dungeon party create       — Create party (you're leader)
/dungeon party join [ID]    — Join with party code
/dungeon party info         — Check party & readiness
/dungeon party leave        — Leave party
/dungeon shop               — Buy potions before run

⚔️ *RUNNING A DUNGEON*
/dungeon ready              — Mark yourself ready
/dungeon start [1-8]        — Leader picks dungeon type
/dungeon types              — See all 8 dungeon types
/dungeon advance            — Move to next floor
/dungeon leave              — Exit (keep rewards so far)
/dungeon status             — Party HP & floor info

🗡️ *IN BATTLE*
/dungeon attack             — Basic attack
/<classcmd> [skill]         — Use a class skill (e.g. /heal, /cast, /rage)
/dungeon item [hp/energy/revive] — Use consumable

🌍 *WORLD BOSS RAIDS*
/worldboss list             — All available bosses
/worldboss create [#]       — Form raid (2-5 hunters)
/worldboss join [ID]        — Join a raid
/worldboss ready            — Mark ready
/worldboss start            — Leader starts
/worldboss attack / skill / defend / status

💡 *TIPS*
• Bosses every 5 floors (F5, F10, F15, F20)
• 8 dungeon types — each with unique enemies
• /wb works as shortcut for all worldboss commands
━━━━━━━━━━━━━━━━━━━━━━━━━━━` }, { quoted: msg });
    }

    // 🔹 Utility help page
    if (category === 'utility') {
      return sock.sendMessage(chatId, { text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🛠️ *UTILITY HELP*
━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎨 *IMAGE GENERATION*
/imagine <prompt>   — Generate AI image (Pollinations.ai)

🎵 *MUSIC*
/ytmp3 <url/search> — Download YouTube audio as MP3
/lyrics <song name> — Fetch song lyrics (Genius)

📌 *IMAGES*
/pinterest <query>  — Search Pinterest images

🤖 *BOT PERSONALITIES*
/bots               — List all 11 personalities
/start <name>       — Activate a bot in this group
/switch <name>      — Switch active bot
/hi                 — All present bots greet
/stopbot            — Deactivate all bots here
/setserf @bot       — Choose your bot serf (mod-approved)
/approveserf --CODE — Mod: confirm a serf request

📋 *CCTV MODE* (owner/co-owner)
/cctv on/off        — Toggle activity logging
/cctv log           — View recent activity
/cctv stats         — Command usage breakdown
/cctv top           — Most active members
/cctv clear         — Wipe log

📊 *STATUS* (owner/co-owner)
/status             — Full bot health report
━━━━━━━━━━━━━━━━━━━━━━━━━━━` }, { quoted: msg });
    }

    if (category === 'bots') {
      return sock.sendMessage(chatId, { text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━
🤖 *BOT PERSONALITIES*
━━━━━━━━━━━━━━━━━━━━━━━━━━━

11 unique personalities — each from a different anime universe.

*Hinata* (Naruto) — shy, devoted, flustered easily
*Lunar* (Dr. Stone) — bright, curious, warm
*Aria* (Final Fantasy) — calm, elegant, refined
*Kira* (Death Note) — sharp, calculating, sarcastic
*Zephyr* (One Piece) — chill, free-spirited, homie vibes
*Nova* (MHA) — energetic, hype, enthusiastic
*Void* (Solo Leveling) — cold, cryptic, System energy
*Seraph* (SAO) — wise, poetic, mystical
*Echo* (Steins;Gate) — playful, asks questions back
*Raven* (Tokyo Ghoul) — dark, dramatic, theatrical
*Jinx* (Arcane) — chaotic, unpredictable, wildcard

━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 *COMMANDS*
/bots               — List all + current status
/start <name>       — Activate in this group
/switch <name>      — Switch active bot
/hi [message]       — All present bots respond
/setainame <p> <n>  — Rename a personality
/stopbot            — Deactivate all bots
━━━━━━━━━━━━━━━━━━━━━━━━━━━` }, { quoted: msg });
    }
    const message = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ *SYSTEM NOTIFICATION* ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━━

*The world has changed.*

On December 16th, 2025, reality fractured. Gates emerged from the void, monsters roamed the streets, and humanity faced extinction.

But you... you have been chosen.

A mysterious force has granted you a *SYSTEM* - a power to grow stronger, to level up, to survive. You are not alone. Others have awakened across the world.

*Your mission:* Grow stronger. Clear gates. Defeat bosses. Reach the apex of power... and face the Creator who started it all.

━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 *SYSTEM COMMANDS*
━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎮 *BASIC COMMANDS*
/register [name] - Awaken your system
/stats - View your status window
/me    - Quick stats snapshot
/top   - Instant leaderboard
/ranking - Your rank across all categories
/profile [@user] - View player profile
/inventory - Check your inventory
/skills - View your skill list
/help - Display this message
/sticker - Create sticker from image

⚔️ *TOWER DUNGEON SYSTEM*
/dungeon types         — View all 8 dungeon types
/dungeon party create  — Form a party (min 2 hunters)
/dungeon party join [ID] — Join a party
/dungeon party info    — Check party status
/dungeon party leave   — Leave party
/dungeon shop          — Buy potions & items
/dungeon ready         — Mark yourself ready
/dungeon start [#]     — Leader picks dungeon (20 floors!)
/dungeon advance       — Go deeper after clearing a floor
/dungeon leave         — Exit and keep your rewards
/dungeon attack        — Basic attack
/<classcmd> [skill]    — Use a class skill (e.g. /heal, /cast, /rage)
/dungeon item [hp/energy/revive] — Use item
/dungeon status        — Check floor & party HP
💡 Boss every 5 floors (F5, F10, F15, F20)!

🌍 *WORLD BOSS RAIDS*
/worldboss list        — View all world bosses
/worldboss create [#]  — Form a raid party (2-5 hunters)
/worldboss join [ID]   — Join a raid party
/worldboss ready       — Mark yourself ready
/worldboss start       — Leader starts the raid
/worldboss attack      — Attack the boss
/worldboss skill [name] — Use a skill on the boss
/worldboss defend      — Brace for telegraphed attacks ⚠️
/worldboss status      — Check boss HP & party status
💡 Short alias: /wb works for all worldboss commands!

⚔️ *PVP SYSTEM*
/pvp challenge @user   — Challenge a player
/pvp accept            — Accept a challenge
/pvp decline           — Decline a challenge
/pvp attack            — Basic attack (build momentum)
/pvp guard             — Block incoming damage
/pvp taunt             — Force enemy to attack you
/pvp focus             — Charge up for 1.8×-2.4× hit
/pvp feint             — Break enemy guard, steal momentum
/pvp burst             — 35 energy → 1.6× instant hit
/pvp predict [action]  — Guess enemy move (+50% if correct)
/pvp special           — Class special (3 momentum)
/pvp ultimate          — Limit Break (5 gauge bars)
/<classcmd> [skill]   — Use a class skill by name (e.g. /heal, /cast, /rage)
/pvp skill             — View your skills & energy
/pvp status            — Check battle board
/pvp surrender         — Forfeit the match
/pvp rank              — View your PvP rank & ELO
/pvp history          — Last 10 match results
/pvp leaderboard       — Top PvP players
💡 Arenas are random each fight! 8 unique zones.

🔧 *PROGRESSION*
/upgrade          — Spend upgrade points on stats
/awaken           — Prestige system (Lv50/75/100) — HUGE boosts!
/daily            — Claim daily rewards (streak bonuses!)
/challenges        — View & claim 3 daily challenges
/summon x1/x10     — Gacha pulls (weapons, artifacts, pet eggs)
/duel @user        — Quick instant PvP (no setup needed)
/<classcmd> <skill>  — Use a class skill (e.g. /heal, /cast, /rage)
/use              — Use a potion or item

🌍 *SEASONAL EVENTS*
/event            — View current active event & bonuses
/event list       — See all 8 rotating seasonal events
💡 Events auto-start monthly! XP/Nexus multipliers, exclusive drops.

🏪 *PLAYER MARKET*
/market           — Browse player listings
/market buy [#]   — Buy an item
/market sell [item] [price] — Sell from your inventory
/market search [name] — Find specific items
/market mine      — Your active listings

⚔️ *GUILD WARS*
/guildwar declare [guild] — Declare war on a rival guild!
/guildwar status  — Current war score
/guildwar score   — Per-member War Points
/guildwar history — Past war results
💡 War Points earned from dungeons, PvP wins, and boss kills!

🌟 *SOCIAL & ECONOMY*
/send Nexus @user [amt]  — Send Nexus to a player
/trade                  — Trading system
/history                — Your last 10 transactions
/rob @user              — Try to steal Nexus (risky!)
/leaderboard [level/pvp/gate/boss/wealth] — Rankings
/stats @user            — Compare stats side-by-side
/afk [reason]           — Set AFK status (auto-expires 8h)
/cooldowns              — Check all your active cooldowns
/community              — View all ✦ 𝐀𝐬𝐭𝐫𝐚™ group links
/support                — Get support group link in your DM

👑 *GROUP ADMIN COMMANDS* (Group admin + bot admin)
/kick @user | /remove @user  - Kick a user from the group
/promote @user               - Promote a user to group admin
/demote @user                - Demote a user from group admin
/delete | /del               - Delete a message (reply to it)
/open                        - Open the group (everyone can chat)
/close                       - Close the group (admin-only chat)

🔧 *MODERATION* (Mods / Owners)
/mute @user [minutes]        - Group-restricted mute (deletes their messages)
/unmute @user                - Unmute in this group
/ban @user [reason]          - Ban player from the bot
/unban @user                 - Unban player
/admin                       - Admin control panel
/broadcast [message]         - Broadcast to all

💠 *ECONOMY* (Owner/Co-Owner)
/addpc <amount> @user        - Grant Procoins to a player
/pc                          - Check Procoin balance

🌐 *COMMUNITY GROUP SETUP* (Owner Only)
/setgroup                    — View all configured groups
/setgroup <type>             — Register this group (support|pvp|dungeon|casino|guild)
/setgroup <type> --main      — Register as MAIN group (never expires)
/setgroup <type> <link>      — Register + set invite link
/ssub | <name>               — Start 30-day subscription (non-main group)
/renew                       — Extend subscription by 30 days
/allowgc <pvp|dungeon>       — Add a feature to this group
💡 Run each command *inside* the target group. Link auto-fetched!
💡 /setgc is an alias for /setgroup.

━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 *BEGINNER GUIDE*
━━━━━━━━━━━━━━━━━━━━━━━━━━━

1️⃣ Register: /register YourName
2️⃣ Check stats: /stats | profile: /profile
3️⃣ View skills: /skills
4️⃣ Daily rewards: /daily (streak = more rewards!)
5️⃣ Form a party: /dungeon party create
6️⃣ Enter dungeon: /dungeon start [#] (20 floors!)
7️⃣ World boss raid: /worldboss create [#] (need 2-5 hunters)
8️⃣ PvP battles: /pvp challenge @user
9️⃣ Upgrade stats: /upgrade
🔟 Claim group artifacts: /claim (spawns every 2-3 hrs!)

━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 *DETAILED HELP PAGES*
━━━━━━━━━━━━━━━━━━━━━━━━━━━
/help pvp      — Full PvP guide
/help guild    — Guild & Guild War guide
/help economy  — Nexus, trading, casino guide
/help dungeon  — Dungeon & World Boss guide
/help utility  — Image gen, music, Pinterest
/help bots     — All 11 bot personalities
/help [cmd]    — Info on any specific command
━━━━━━━━━━━━━━━━━━━━━━━━━━━

*The system awaits your command.*  
*Will you rise... or fall?*
━━━━━━━━━━━━━━━━━━━━━━━━━━━
`.trim();

    // Send help banner image with caption
    try {
      const fs = require('fs');
      const path = require('path');
      const bannerPath = path.join(__dirname, '..', '..', 'assets', 'help_banner.jpg');
      if (fs.existsSync(bannerPath)) {
        await sock.sendMessage(chatId, { image: fs.readFileSync(bannerPath), caption: message }, { quoted: msg });
      } else {
        await sock.sendMessage(chatId, { text: message }, { quoted: msg });
      }
    } catch (e) {
      await sock.sendMessage(chatId, { text: message }, { quoted: msg });
    }
  }
};