# AniRPG — Bug Fix & Stability Improvement Plan

**Date:** 2026-07-24
**Scope:** Bugs, crash safety, security, and stability only. No new features.
**Approach:** Plan first, implement after approval. Each phase is reviewable.

---

## Summary of Codebase Health

| Metric | Value |
|---|---|
| Total JS lines (core) | ~20,000 |
| Files | 268 |
| `console.log` calls | 243 |
| Empty `catch {}` blocks | 10 (silent failure points) |
| `process.exit` calls | 2 (in `index.js`) |
| MongoDB write inside debounce | ⚠️ YES (race condition risk) |
| Hardcoded credentials in source | ⚠️ YES (MongoDB URI + JIDs) |
| Duplicate files (case mismatch) | ⚠️ `AuraSystem.js` + `Aurasystem.js` |
| Deprecated Baileys dep | None in source (only in `package.json` as `@adiwajshing/baileys` ^5.0.0 — unused but listed) |
| Mixed-casing files | Multiple (Linux/Fly.io risk) |

---

## Critical Bugs (P0 — can crash or lose data)

### 🔴 B1. Hardcoded MongoDB credentials in source
**File:** `index.js:37`
```js
const MONGO_URI = process.env.MONGODB_URI || 'mongodb+srv://Botuser1234:test1234@cluster0.xxx.mongodb.net/...';
```
**Risk:** Real-looking credentials committed to source. Even if the cluster is gone, this pattern sets a bad example and the URI is a public leak.
**Fix:** Remove the fallback URI. Fail fast if `MONGODB_URI` is missing. (If this is your real production cluster, rotate the password first.)

---

### 🔴 B2. MongoDB write inside `setTimeout` closure — race on process exit
**File:** `index.js:80-92`
```js
saveTimeout = setTimeout(async () => {
  try {
    await mongoCollection.replaceOne({ _id: 'main' }, ...);
  } catch (err) { ... }
}, 2000);
```
**Risk:** On `SIGINT` or crash, the pending 2-second write is **dropped on the floor** — DB may be lost. Also, every `saveToMongo()` call clears the previous timer and reschedules, but the JSON write in `saveDatabase()` is **synchronous and unconditional** on every call → can write the same multi-MB file hundreds of times under heavy activity.
**Fix:**
- Track the pending save as a `Promise` and `await` it during `SIGINT` cleanup
- Debounce the JSON write too, not just the Mongo write
- Persist a "dirty" flag and flush it during shutdown

---

### 🔴 B3. Unhandled rejections silently swallowed in command path
**File:** `index.js:487-491`
```js
process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ UNHANDLED PROMISE REJECTION:', reason);
  // Don't exit — log and continue
});
```
**Risk:** Many commands do `await sock.sendMessage(...)` without `await`/try-catch, and the global handler only logs. Hard to trace which command caused a silent failure.
**Fix:** Add a tagged logger (chatId, sender, command) and emit a daily summary. Optional: add `--strict` mode to exit on unhandled.

---

### 🔴 B4. 10 silent `catch (e) {}` blocks mask errors
**Files:**
- `rpg/utils/ProfileCard.js:390`
- `rpg/utils/TitleSystem.js:177`
- `rpg/utils/LevelUpManager.js:149`
- `rpg/utils/ImprovedCombat.js:4-5` (artifact/buff lazy-load)
- `rpg/utils/StatsCard.js:153`
- `rpg/dungeons/GateManager.js:81`
- `rpg/skins/GateVideoEngine.js:58`
- `rpg/skins/AssetPromptGenerator.js:302`
- `bots/MultiSocketManager.js:196`

**Risk:** Real bugs become invisible. E.g. if `ArtifactSystem` fails to load, the `ImprovedCombat` will silently fall back to nothing.
**Fix:** Add a minimal `console.warn` in each with a `[SILENT]` tag so they're searchable but not noisy in success cases.

---

## High Priority (P1 — bugs that bite users)

### 🟠 B5. Duplicated file: `AuraSystem.js` (re-export shim) and `Aurasystem.js` (real impl)
**Risk:** This works on macOS/Windows (case-insensitive FS) but **breaks on Linux/Fly.io** (case-sensitive). One of these files is invisible to the other OS.
**Fix:** Delete `rpg/utils/AuraSystem.js` (the 1-line shim), make all `require('./AuraSystem')` callers use the proper file, and either rename `Aurasystem.js` → `AuraSystem.js` OR keep the lowercase name and update callers. The right answer is **proper PascalCase** with a single file.

**Files using `AuraSystem` (need updating if we rename):**
- `rpg/utils/LevelUpManager.js`
- `commands/rpg/aura.js`
- `commands/rpg/duel.js`
- `commands/rpg/guild.js`
- `rpg/utils/AuraSystem.js` (delete)

---

### 🟠 B6. Multiple Baileys versions in `package.json`
```json
"@adiwajshing/baileys": "^5.0.0",    // ⚠️ deprecated, not used in source
"@whiskeysockets/baileys": "^7.0.0-rc.9", // used in 2 files
"baileys": "^7.0.0-rc.9"              // used in 3 files (incl. index.js)
```
**Risk:** Two non-deprecated versions of the **same package** with different names. Source mixes them (`utility.js` tries `@whiskeysockets/baileys` first, falls back to `baileys`). Larger install, possible API drift, version confusion.
**Fix:** Pick one. `@whiskeysockets/baileys` is the actively-maintained community fork; remove `baileys` and the deprecated `@adiwajshing/baileys`. Update `index.js` import. This is a security improvement too — fewer deps = smaller attack surface.

---

### 🟠 B7. 3-second global command cooldown also blocks admins
**File:** `index.js:949-957`
```js
if (timeSinceLastCommand < 3000) { return sock.sendMessage(...) }
```
**Risk:** Owner can't run quick debug/admin commands back-to-back. Combined with `MAX_MESSAGES_PER_MINUTE = 20`, owner can also get rate-limited.
**Fix:** Skip the global cooldown for `OWNER_JID` and `COOWNER_JID`. The per-command cooldown is still in effect.

---

### 🟠 B8. `process.exit(0)` on SIGINT skips Mongo flush
**File:** `index.js:1080-1084`
```js
process.on('SIGINT', () => {
  console.log('\n💾 Saving database before exit...');
  saveDatabase();       // ← fire-and-forget, returns immediately
  sock.end();
  process.exit(0);      // ← exits before Mongo write finishes
});
```
**Risk:** `saveToMongo()` is debounced (2s); the JSON write is sync. But if Mongo is the **primary** store, we never wait for the in-flight `replaceOne`. Worst case: data loss on graceful shutdown.
**Fix:** Await the pending Mongo write before exiting. Track the in-flight `Promise` in a module-level variable and `await` it here.

---

## Medium Priority (P2 — code-quality bugs)

### 🟡 B9. `database` is a shared mutable global with no protection
**File:** `index.js:91, 110, everywhere`
**Risk:** Two concurrent `messages.upsert` events can both `delete db.users[uid]; saveDatabase()` in a race. JSON.stringify on a 50MB object during peak traffic can block the event loop for seconds.
**Fix:**
- Wrap `database` access in a simple async mutex (one writer at a time)
- Or schedule writes through a single queue
- Document the contract: "no other module mutates the database object directly"

---

### 🟡 B10. `setInterval(saveDatabase, 2 min)` writes 50MB+ JSON synchronously every 2 min
**File:** `index.js:493`
**Risk:** Even with 100 players, the JSON grows fast. A sync `fs.writeFileSync` of multi-MB data blocks the event loop. If combined with the silent Mongo write failure, you can have 30+ second freezes.
**Fix:**
- Use `fs.promises.writeFile` (async)
- Or rotate to a write-stream (`fs.createWriteStream` + write chunks)
- Or only save deltas (hard, but big win)

---

### 🟡 B11. `RegenManager.initAllPlayers` called once on connect — but new players never get a regen ticker
**File:** `index.js:707-714`
**Risk:** Looking at this, the regen system is started for the *initial* player set, but any new player who registers after connect may not be ticked. Need to verify (depends on `RegenManager` internals).
**Fix:** Audit `rpg/utils/RegenManager.js` and ensure `addPlayer` is called inside `register.js`. **(Verify before fixing.)**

---

### 🟡 B12. AI chat fires on every group message that mentions the bot name
**File:** `index.js:1021-1051`
**Risk:** If a user says "thanks Hinata" in a 50-person group, the bot calls an LLM ($$ or rate-limited). No per-group rate limit on AI responses.
**Fix:** Add a per-group AI cooldown (e.g., 1 response per 5s per group) and an opt-in flag in `groupSettings`.

---

### 🟡 B13. `cachedConfig` is read once at startup, not refreshed
**File:** `index.js:4`
```js
let cachedConfig = JSON.parse(fs.readFileSync('./config.json', 'utf-8'));
```
**Risk:** Admin edits `config.json` (e.g. changes prefix) → bot keeps using the old one until restart. `dailyResetHour` is the only dynamic-ish field and it IS read fresh inside the interval — but other fields aren't.
**Fix:** `fs.watch` on `config.json` and re-parse, or just document the "restart to change config" rule.

---

### 🟡 B14. `CREATOR_ID` and `COOWNER_ID` are hardcoded in `index.js` and re-hardcoded in many commands
**Files:** 8+ files have a local `const BOT_OWNER = '221951679328499@lid'`
**Risk:** If the JID changes (e.g. owner gets a new SIM), you have to grep-and-replace everywhere.
**Fix:** Export a single `OWNER` constant from `config.json` and re-export from `utils/constants.js`. Replace all hardcoded JIDs with `require('../utils/constants').OWNER`. Low-risk grep-and-replace.

---

## Low Priority (P3 — nice to have)

### 🟢 B15. `startGateAutoSpawn` uses recursive `setTimeout` with hardcoded `MAIN_GROUP_ID` fallback
Minor: fallback uses env but `groupSettings[chatId]?.spawnEnabled` is the real switch. If `MAIN_GROUP_ID` is set AND `spawnEnabled = false` for that group, the fallback still spawns. **Verify intent; document or fix.**

### 🟢 B16. No graceful disconnect for secondary bots
`MultiSocketManager` handles reconnect for primary, but secondary bots' close events may not be wired to a central "all bots online" log. **Verify.**

### 🟢 B17. `astralink.html` is ~38KB — served where?
**File:** `astralink.html` (38KB)
**Risk:** The HTTP server only serves `/` and `/api/*`. `astralink.html` is a static file with no route. If it's meant to be served, it's not.
**Fix:** Either serve it as a static file, or document that it's a separate deployment.

---

## Implementation Plan (proposed phases)

I'm proposing **3 reviewable phases** so you can stop after any one:

### **Phase 1 — Critical Safety (1-2 hours, low risk)**
- B1: Remove hardcoded Mongo credentials
- B2: Track pending Mongo write, await on shutdown
- B3: Tagged unhandled-rejection logger
- B4: Add `[SILENT]` tag to 10 empty catch blocks
- B7: Skip global cooldown for owner/co-owner
- B8: Graceful SIGINT with await

### **Phase 2 — Cross-platform & Deps (30 min, low risk)**
- B5: Fix `AuraSystem`/`Aurasystem` duplicate (one canonical file)
- B6: Remove `baileys` and `@adiwajshing/baileys` from `package.json`, consolidate on `@whiskeysockets/baileys`
- B14: Centralize owner JID constant

### **Phase 3 — Concurrency & Perf (2-3 hours, needs care)**
- B9: Async mutex around `database` mutation
- B10: Async JSON writes
- B12: Per-group AI cooldown
- B13: `fs.watch` on `config.json`
- (B11, B15-B17: verify intent, fix or document)

---

## Risk & Rollback

- **All Phase 1 + 2 changes are additive/safe** — they don't change game behavior
- **Phase 3 changes the write path** — recommend testing with a copy of production DB first
- I can commit each phase as a separate logical change so you can `git diff` between them

---

## What I'd like from you

1. ✅ Approve the plan? (or change scope)
2. Do all 3 phases, or stop after Phase 1 / 2?
3. Any of B1-B17 you'd like to **prioritize** or **skip**?
4. (B1 specifically) Is the Mongo URI in source a **real production credential** that I should treat as already-leaked (i.e. tell you to rotate)?
