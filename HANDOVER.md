# AniRPG — HANDOVER GUIDE (no secrets)

Written 2026-10-09 for the new maintainer. Read this top to bottom once; then `CHANGELOG.md` for the history of every push.

> **Secrets are NOT in this file on purpose** — GitHub access, SSH key, server IP, `/link` password and `.env` values must be handed over person-to-person by the previous owner (Naruto). Everything else you need is here.

---

## 1. What this is

A WhatsApp RPG bot (Solo-Leveling style: gates, dungeons, guilds, classes, PvP, pets, events) built on **Node.js + Baileys** (`@whiskeysockets/baileys`). One Node process runs **many bot numbers at once** ("personalities": hinata, lunar, aria, kira, zephyr, nova, void, seraph, echo, raven, jinx, mikasa, nezuko, gojo, killua, rukia, winry, rem, power, mob). Each WhatsApp number = one socket; all share one database.

Current version: `package.json` → `"version"`. `/version` (owner only, in WhatsApp) prints the version + git commit the server is actually running.

---

## 2. Where things live

| Thing | Where |
|---|---|
| Source code | GitHub repo **`Anirpg`** (owner: Naruto's account `abdulqudusolaleye824-sketch`), branch **`main`** |
| Server | An **Oracle Cloud** Ubuntu VM. Code checked out at `/home/ubuntu/Anirpg`. Runs as a Docker container named **`anirpg`** |
| Database | JSON file `database/database.json` inside the data dir (plus `.1` rotating copy and hourly/boot snapshots). SQLite mirror via `better-sqlite3` |
| WhatsApp sessions | `auth/<botname>/` per bot. Deleting a folder = that bot must be re-linked |
| Backups | `deploy-snapshots/` (last 20 pre-deploy copies of DB + auth) and `backups/` (30-day reset backups) |
| Config | `config.json` (`ownerNumber`, `coOwnerNumber`, prefix `/`), `.env` on the server (not in git) |

---

## 3. How a change reaches the players (deploy flow)

1. Edit code → **push to `main`** on GitHub.
2. The server has a **cron job every 5 minutes** that runs `deploy.sh`: snapshots DB + auth, `git pull --ff-only`, `npm install`, restarts the process in the `anirpg` container.
3. Within ~5 min, run `/version` in WhatsApp (owner DM) — it must show the new commit hash. If not, the pull failed (see §7).

Rules we always followed:
- **Never force-push, never rewrite history** — `--ff-only` will refuse and the bot keeps running old code.
- **Never commit `database/` or `auth/`** — they are runtime data.
- Bump `package.json` version + add a `CHANGELOG.md` entry with every push.
- Run the test file before pushing (see §6).

How Naruto/I pushed: a small Python script using the GitHub **Git Data API** with a Personal Access Token (push a list of files without cloning the whole repo). You can simply use normal `git clone` / `git push` from your PC instead — same result.

---

## 4. Server operations (needs SSH access from Naruto)

```bash
ssh -i <key> ubuntu@<server-ip>
cd /home/ubuntu/Anirpg

sudo docker ps -a                       # is container "anirpg" Up?
sudo docker logs --tail 200 anirpg      # what is it saying
sudo docker restart anirpg              # restart bot
df -h                                   # DISK FULL is the #1 cause of "all bots dead"
./deploy.sh                             # manual deploy (same as the cron)
```

### Linking a bot number (QR)
- **If at least one bot is alive:** DM that bot (as owner) `/link <botname>` → it asks for the ops password → a QR prints in the **server console/logs** (`docker logs -f anirpg`). Scan it from the phone of the number you want to link. QR rotates; always scan the newest one.
- **If NO bot is alive** (your current situation): on the server run
  ```bash
  sudo docker exec -it anirpg node link.js lunar
  ```
  The QR prints in that terminal. Scan with Luna's phone. Then restart the container. Repeat per bot.
- Bot names are lower-case (`lunar`, not Luna). `node link.js` with no name lists them.

### Why "all bots off but not banned" happens (seen before)
1. **Disk full** → session files can't be written → Baileys "Bad MAC"/deaf sockets → every bot silent. Fix: `df -h`, delete old `deploy-snapshots`/logs, restart, re-link the worst ones.
2. **Container stopped / crash-looping** after a failed deploy → `docker logs`, fix, restart.
3. **WhatsApp logged the devices out** (phone offline too long / linked-devices removed) → re-link.
4. Server rebooted and Docker didn't auto-start → `sudo docker start anirpg`.

---

## 5. Code map (where to change what)

```
index.js                      boot: loads DB, starts MultiSocketManager, tickers (gates, regen, events, sweeps)
link.js                       console QR pairing CLI
config.json                   owner / co-owner numbers, prefix
bots/
  MultiSocketManager.js       THE core: one socket per bot, message intake, replay/stale guards,
                              which bot answers in which group, anti-link / anti-mention, /link flow
  PersonalityManager.js       bot personalities, which bot is "active" per group, presence
  AIHandler.js                AI chat replies (non-command messages)
handlers/
  rpgCommandHandler.js        command router: alias table, DM rules, Events-GC rules, admin nag
  gateSpawner.js              automatic gate spawns per group (single message + Buy button)
  itemSpawner.js              item spawns (/claim)
commands/                     general + moderation commands (one file per command)
commands/rpg/                 ~255 RPG commands (one file per command; `name`, `aliases`, `execute`)
rpg/classes/<tier>/*.js       class definitions (stats bonuses, skills text, lore). Tier folders: common/rare/legendary/...
rpg/utils/                    game systems:
  SkillCatalog.js             skill rosters, parsing skill text into numbers, lifesteal/drain contracts
  ClassSystem.js / ClassPower.js   class stats, passives (parsed from skill text), awakenings
  UnifiedCombat.js            shared combat maths (dodge, crit, status ticks, generic playTurn)
  LevelUpManager.js           XP → level, skill unlocks (rune stones), level-up card
  JobSystem.js / JobSkills.js jobs (Brawler, Wolf Assassin, …), job XP, job skills
  InstanceDungeon.js          job-change instances, keys, daily boxes (regular / blessed / cursed)
  GuildContractManager.js / GuildSack.js   guild membership resolution, contracts, wages, sacking
  DomainSystem.js, Transformation.js, Necromancy.js, ShadowArmy.js   special class mechanics
  EventSystem.js              Jeju Island event
  BattleRewards.js            XP/aura/pass rewards per win; loot multipliers
  RegenManager.js, CombatReset.js, StatusEffectManager.js
  PetManager.js, PetDatabase.js
  PlayerKey.js                canonical player id (phone vs @lid identities) — use it when looking up players
  RuneStones.js               soulbound skill items
rpg/dungeons/
  GateManager.js              gate creation, prices, loot pools, drop chances (47% / 48% Pro)
  GateRaid.js                 raid engine: monster scaling, damage, clear + loot split, double dungeon/red gate
rpg/data/MonsterDrops.js      monster/boss drop tables
utils/buttons.js              WhatsApp interactive buttons with text-menu fallback
utils/permissions.js          owner / co-owner / mod tiers
```

### Adding a command
1. Create `commands/rpg/<name>.js` exporting `{ name, aliases, description, async execute(sock, msg, args, getDatabase, saveDatabase, sender) }`.
2. Register it in `handlers/rpgCommandHandler.js` alias table (search for an existing command like `attack:` to see the pattern).
3. Add it to `commands/rpg/help.js` (owner commands stay hidden).
4. Reply with `sock.sendMessage(chatId, { text }, { quoted: msg })`. Never send an empty message.

### Important conventions
- 💠 **Nexus** = `player.gold`; 💎 **Mana Stones** = `player.manaCrystals`.
- Player ids come in two forms (`123@s.whatsapp.net` and `456@lid`). Always resolve through `PlayerKey` / `findUserInDb`, never compare raw strings.
- Owner & co-owner: `config.json` → `ownerNumber`, `coOwnerNumber`. Owner-only commands check `Perms.isBotOwner`.
- Skill behaviour is **parsed from the skill description text** (ClassPower/SkillCatalog). If you write "heals 30% of damage dealt" in a class file, it becomes real lifesteal. Keep descriptions truthful.
- Pro = `player.isPro && proExpiresAt > now`. Many systems double rewards for Pro.
- Battle buffs must be cleared at the end of every fight (`CombatReset`).

---

## 6. Testing

The regression file used for every push is `test_push88.js` (kept outside the repo by the previous workflow; ask Naruto for it, or re-create as needed — older `test_push*.js` files are in the repo root). Run from the repo root:

```bash
node test_push88.js      # prints ✅/❌ per case and "N/N passed"
```
A few tests are randomness-flaky (event shop, boss artifact, retaliation) — re-run once before worrying. Also run `node --check <file>` on anything you edit.

---

## 7. Troubleshooting cheat-sheet

| Symptom | Check |
|---|---|
| `/version` still shows old commit | `docker logs anirpg` for `git pull failed`; server has local changes → `git stash` then `./deploy.sh` |
| All bots silent | `df -h` (disk), `docker ps`, re-link |
| One bot silent, others fine | that bot's session is stale → `/link <bot>` from a live bot |
| Bot replies to old messages / twice | stale-message guards in `MultiSocketManager.js` (`MAX_MSG_AGE_MS`, `_seenInbound`, `_handledInbound`) |
| Bot says "make me admin" | it is not a group admin; promote it (non-admin bots are silent by design) |
| Player "already in a guild" but isn't | fixed in 1.0.177 (`GuildContractManager.resolvePlayerGuild`); `/guild leave` as them or clear `player.guild` in DB |
| Database looks wiped | restore from `deploy-snapshots/` or `backups/` (stop container first, copy file back, start) |

---

## 8. Things that are deliberately the way they are (don't "fix")
- Non-admin bots are silent except to owner/co-owner.
- Owner & co-owner are excluded from leaderboards.
- Keys, rune stones, artifacts are **non-transferable**.
- Inventory is **not capped**.
- Gate spawn is one message with a Buy button (no numbered menus).
- Only one bot answers per group (the "active" bot; `/switch <bot>` changes it).

Good luck — and bump the version on every push.
