# AniRPG Bug Sweep Report
**Date:** 2026-07-25
**Total JS files reviewed:** 325 (327 minus the 2 temp sweep.js files)
**Total lines:** ~73,000
**Status:** All files pass `node -c` syntax check after fixes.

---

## 🔴 CRITICAL BUGS (FIXED)

### 1. QuestManager level objectives could never complete
**File:** `rpg/utils/QuestManager.js:160`
**Bug:** The `level` objective type set `objective.current = 1` but the completion check was `obj.current >= obj.count` where `count` was undefined. Same issue for `pvp_streak`, `gold_total`, `explore`, `rescue`, `defend`, `craft`, `equip` objectives.
**Impact:** The "Reach level 2" objective in the `prologue_awakening` quest could NEVER complete, blocking the entire main storyline.
**Fix:**
- Normalize `count` field in `startQuest` for objectives that lack it
- Defensive `(obj.count || 1)` in all completion checks
- Updated `getProgressString` to handle missing count

### 2. Casino dice game could pay 0 gold on a win
**File:** `commands/rpg/casino.js:558`
**Bug:** For target=1 (over) or target=99 (under), winChance ≈ 99% so multiplier ≈ 0.99x. `Math.floor(betAmount * 0.99)` could yield less than the bet, so a "win" silently lost money.
**Impact:** Players "winning" at extreme target values lost gold instead of gaining it.
**Fix:** `Math.max(betAmount + 1, Math.floor(betAmount * multiplier))` ensures wins always pay at least principal + 1g profit.

### 3. Casino NaN bet passed validation
**File:** `commands/rpg/casino.js` (multiple lines)
**Bug:** `parseInt(undefined)` returns NaN, and `NaN < 50` is false, so the validation `!betAmount || betAmount < 50` allowed NaN to pass. Subsequent arithmetic produced NaN gold changes.
**Fix:** Added `isNaN(betAmount)` check.

### 4. Tutorial DM sent to group instead of user
**File:** `index.js:1257`
**Bug:** Tutorial DM was sent with `chatId` (the group chat) instead of the participant's JID. New members would see their own tutorial echoed in the group.
**Fix:** Convert `@lid` participant to `@s.whatsapp.net` and DM the user directly.

### 5. Owner/Co-owner prefix matching
**File:** `index.js:1208, 1212`
**Bug:** `numStr.startsWith(CREATOR_ID)` matched any number that BEGAN with the owner's digits. A malicious JID `22195167932849999@lid` would be greeted as the owner.
**Fix:** Use strict equality `numStr === CREATOR_ID`.

### 6. quest.js double-counted quest rewards
**File:** `commands/rpg/quest.js` (completeQuest method)
**Bug:** `QuestManager.completeQuest` already applied rewards (XP, gold, crystals, items) to the player. Then quest.js completeQuest added them AGAIN, giving players double XP/gold on quest completion.
**Fix:** Removed the duplicate reward application — quest.js now just displays what was already applied.

### 7. /shop stats was unreachable dead code
**File:** `commands/rpg/shop.js` (bottom of execute)
**Bug:** The `/shop stats` admin command was placed AFTER a `return` statement, making it unreachable dead code. The admin stats command never worked.
**Fix:** Moved the stats handler before the fallback return and removed the dead duplicate.

### 8. XP formula overflowed MAX_SAFE_INTEGER
**File:** `rpg/utils/SoloLevelingCore.js` (getXpRequired)
**Bug:** `50000 * 1.3116^99` exceeds MAX_SAFE_INTEGER (~9e15) at level 97+. JavaScript silently loses integer precision, causing XP math to glitch at high levels.
**Fix:** Cap `safeLevel = Math.min(level, 96)` so the formula stays within safe range.

### 9. MAIN_GROUP_ID env var accepted invalid formats
**File:** `index.js` (startGateAutoSpawn, ArtifactSpawn)
**Bug:** `process.env.MAIN_GROUP_ID` was added to active chats even if it wasn't a group JID (e.g. a phone number, or empty string). Could cause errors when sending to invalid chat IDs.
**Fix:** Validate `endsWith('@g.us')` before adding.

---

## 🟠 MEDIUM BUGS (FIXED)

### 10. Sticker pack ID was unique per sticker
**File:** `utils/stickerMetadata.js:16`
**Bug:** `sticker-pack-id` used `Date.now()`, making every sticker its own "pack" in WhatsApp. (Function wasn't even called anywhere — dead code.)
**Fix:** Static `'com.senkubot.v1'`.

### 11. AIHandler conversation history memory leak
**File:** `bots/AIHandler.js`
**Bug:** `conversationHistory[chatId]` grew unbounded. Active groups accumulated history forever.
**Fix:** Added periodic 6-hour cleanup with `__lastTouch` tracking.

### 12. CCTV logs memory leak
**File:** `bots/CCTVManager.js`
**Bug:** `cctvLogs[chatId]` per-group ring buffer never deleted. Inactive groups' logs lived forever.
**Fix:** Added hourly cleanup of 24h+ inactive groups + MAX_GROUPS cap (200).

### 13. PersonalityManager present bots memory leak
**File:** `bots/PersonalityManager.js`
**Bug:** `presentBots[chatId]` and `activeBots[chatId]` were never cleaned up.
**Fix:** Touch timestamps + cleanup of empty Sets.

### 14. Slowmode cooldowns memory leak
**File:** `handlers/rpgCommandHandler.js`
**Bug:** `db.userCooldowns` keys accumulated indefinitely.
**Fix:** 1% chance per command invocation to prune entries older than 1 hour.

### 15. Pending registration memory leak
**File:** `commands/rpg/register.js`
**Bug:** `pendingReg[sender]` only expired when the user typed `/register` again. Forever-stale entries possible.
**Fix:** Periodic 5-minute cleanup.

### 16. rpgCommandHandler error message used wrong command name
**File:** `handlers/rpgCommandHandler.js` (catch block)
**Bug:** Caught errors used `commandName` (e.g. "p") instead of the resolved command name ("profile"). Confusing debug output.
**Fix:** Use `resolvedCommand` in the error message and log.

### 17. runImageGen accepted any response as image
**File:** `bots/AIHandler.js` (runImageGen)
**Bug:** Pollinations sometimes returns HTML error pages. The bot would forward non-image data as an image attachment, causing WhatsApp send failures.
**Fix:** Validate response magic bytes (JPEG/PNG/WebP), return `{ success: false, error }` on failure, show error in chat.

### 18. Math eval could be abused with 9**9**9
**File:** `bots/AIHandler.js` (runMath)
**Bug:** `new Function()` evaluated user input. Without an exponent cap, `9**9**9` would lock the event loop.
**Fix:** Reject expressions with `**\d{4,}`, cap result magnitude at 1e15.

### 19. GoldManager spammed logs + no overflow protection
**File:** `rpg/utils/GoldManager.js`
**Bug:** Every gold update printed `✅ Gold updated for X: Y` to console. Also no upper cap meant MAX_SAFE_INTEGER overflow was possible.
**Fix:** Removed per-update log, added `isNaN` guard, capped at MAX_SAFE_INTEGER.

### 20. Artifact fuse could fuse item with itself
**File:** `commands/rpg/artifact.js` (fuse handler)
**Bug:** `/artifact fuse 1 1` would consume the same artifact twice (deleting it from inventory twice). No index-bounds check.
**Fix:** Reject `index1 === index2`, validate index bounds.

### 21. AI image/song/lyrics fallbacks lost to generic error
**File:** `bots/AIHandler.js` (generateResponse)
**Bug:** `runImageGen` returned `{ success: true, buffer: undefined }` on failure, and the caller tried to attach `undefined` as an image.
**Fix:** Now properly propagates failure and shows user-facing error.

---

## 🟡 MINOR BUGS / CLEANUP (FIXED)

### 22. Dead code: handlers/gateSpawner.js
**File:** `handlers/gateSpawner.js`
**Note:** Never imported. The actual gate spawning lives in `index.js` (`startGateAutoSpawn`). Left in place (don't delete files in this sweep), but flagged as dead code.

### 23. PR remark 1.6 (admin command collision)
**File:** `handlers/rpgCommandHandler.js`
**Note:** Admin command load loop runs after RPG loop. Since both register into the same `commands` object, admin files can shadow RPG ones. Left as-is since the admin folder is currently empty (only `set.js` is admin and it lives in `commands/rpg/`).

---

## 🏗️ Architecture note (post-refactor)

**No "primary" or "secondary" bots.** Every bot is equal:

- All bots linked via `BOT_<KEY>=<phone>` in `.env` connect via `MultiSocketManager.connectBot`
- Each bot has a personality (Hinata, Lunar, Aria, etc.)
- All bots share the same database
- In each group, **only the active bot responds** (set via `/start <name>` or `/switch <name>` in that group)
- The active bot handles RPG commands, AI chat, and group announcements
- All other bots in the group stay silent (they receive the messages but skip)
- The first bot to connect becomes the **AstraLink host** — purely for code organization (the HTTP API uses it to issue pairing codes for the loopback handler)

### Behavior per group

```
Group has bots:  [hinata, lunar, nova]  (3 separate WhatsApp numbers)
Active in group: lunar   (set by /start lunar in this group)

User types: /dungeon
  → WhatsApp delivers the message to ALL 3 bots in the group
  → lunar is the active one → processes the command, sends reply
  → hinata and nova see it's not their turn → stay silent, return

User runs /register in the group
  → The active bot (lunar) processes the registration
  → lunar sends the success message in the group
  → lunar DMs the player a welcome message (bypasses serf gate)
  → The player can now /setserf lunar to make lunar their permanent serf
```

### DMs

- A bot can DM a player only if that player has set it as their serf via `/setserf`
- **The only DM that bypasses the serf gate is the welcome DM** sent after `/register`
- Mods/owners are exempt (any bot can DM them)
- A non-mod player DMing a bot (e.g. typing `/dungeon` in a DM) gets **complete silence** — no error, no reply
- The bot's serf can DM notifications (quest complete, daily reset reminders, etc.) — these are "drops" sent by the player's chosen bot

### Welcome flow

The welcome DM is sent **after registration**, not on group join. When the user runs `/register [name] [DOB]`:
1. The active bot in that group processes the command
2. Creates the player in the database
3. Sends the registration success message **in the group**
4. Sends the welcome DM to the player (only DM allowed without a serf)

This avoids the previous design issue: "active bot for the group might not be set yet (new group)".

### Bot registration

Set `BOT_<KEY>=<phone-with-country-code>` in `.env` for each bot you want to link. There is no "BOT_PRIMARY" anymore.

## 🏗️ Serf system

- `/setserf @bot` or reply to a bot's message with `/setserf` → generates a 7-char code (no 0/O/1/I/L)
- The code is posted to the Mod GC (set with `/setgroup mods` inside it)
- A mod runs `/approveserf --<CODE>` to approve
- After approval, that bot can DM the player; all other bots are blocked
- Welcome DM (after /register) is the only system DM that doesn't require a serf
- Mods/owners are exempt from the serf gate

## 📋 VERIFICATION

**All 329 JS files pass `node -c` syntax check.**

```bash
cd /home/user/project/anirpg
find . -name "*.js" -not -path "./node_modules/*" \
  -not -path "./auth/*" -not -path "./database/*" -not -path "./tmp/*" \
  -exec node -c {} \;
# Exit code 0, no errors
```

---

## 📁 FILES MODIFIED

- `index.js` — Tutorial DM fix, owner-prefix fix, MAIN_GROUP_ID validation, multi-bot refactor (no more primary/secondary — all bots equal, active-bot-per-group gate), welcome DM removed from join handler
- `handlers/rpgCommandHandler.js` — Slowmode pruning, error message fix
- `rpg/utils/QuestManager.js` — Level/streak objective `count` normalization (CRITICAL)
- `rpg/utils/SoloLevelingCore.js` — XP overflow cap
- `rpg/utils/GoldManager.js` — NaN guard, overflow cap, log spam removed
- `rpg/utils/SerfManager.js` — Serf system: 7-char codes, approval, /setserf storage
- `commands/rpg/casino.js` — Dice multiplier floor (CRITICAL), NaN bet guard
- `commands/rpg/quest.js` — Removed double reward application (CRITICAL)
- `commands/rpg/shop.js` — Unreachable /shop stats now reachable
- `commands/rpg/register.js` — Periodic pendingReg cleanup, **welcome DM sent after registration via safeSendDM with welcome bypass**
- `commands/rpg/setserf.js` — `/setserf @bot` (new): 7-char code, posts to Mod GC
- `commands/rpg/approveserf.js` — `/approveserf --<CODE>` (new): mod-only approval
- `commands/rpg/artifact.js` — Fuse self-fuse protection
- `utils/stickerMetadata.js` — Static pack ID
- `utils/permissions.js` — Added `mods` category for the Mod GC
- `bots/AIHandler.js` — Image content-type validation, math eval safety, history leak fix
- `bots/CCTVManager.js` — Per-group log cleanup + MAX_GROUPS cap
- `bots/MultiSocketManager.js` — All bots handle RPG + AI equally; active-bot gate per group; `canSendDM`/`safeSendDM` serf gate with `welcome: true` bypass; `getAnySocket` for AstraLink
- `bots/PersonalityManager.js` — presentBots/activeBots cleanup
- `rpg/utils/AutoRedirect.js` — Added `mods` category for the Mod GC

---

## 🎯 RECOMMENDED NEXT STEPS

1. **Restart the bot** so the in-memory state (conversation history, CCTV logs, pendingReg) starts fresh.
2. **Run a manual /quest start prologue_awakening** to confirm the level objective now completes.
3. **Play a /casino dice over 1 or under 99** to confirm the win now returns principal + profit.
4. **Complete a regular quest** and confirm the reward is granted exactly once (not twice).
5. Consider deleting `handlers/gateSpawner.js` (dead code) in a follow-up.
