# AniRPG — Patch Drop (features + bug fixes + UI restyle)

## Push #70 — Kick severance fix + profile via tag/reply (2026-09-18)

1. **`/guild kick` now pays the ×2 severance it was always supposed to.** The spec in `GuildContractManager.js` ("Kicking a contracted member pays the hunter ×2 of the REMAINING balance of their contract") was dead code — the kick branch never called it, so kicked members got nothing. New `creditKickPayout()` terminates the contract, credits the hunter with `2 × (weekly Nexus + weekly Mana) × weeks remaining` (Nexus → `gold`, Mana → `manaCrystals`), clears any pending wage approval for them, and the kick announcement now shows the severance line. **Voluntary `/guild leave` is untouched** — normal leave gets no severance, by design.
2. **Profile by tag or reply.** `/profile` now resolves its target in this order: explicit @-tag → replied-to message author → yourself. Lookup is JID-form tolerant (lid vs phone, ±`:device` suffix), so a reply/tag delivered in a different form than the stored key no longer says "not registered". Bare `/profile` still shows your own card; locked-profile DM flow unchanged.
3. `GuildContractManager` now exports `findUserInDb` + `creditKickPayout`. Tests → 32 checks (kick severance math 3000 N + 60 M on a 4w/1w-paid contract; leave branch verified untouched; profile via reply/tag/device-suffix/own/unknown-target).

## Push #69 — Co-owner dual-identity fix + repo/live sync (2026-09-18)

**Co-owner identity**
1. The co-owner was silently stripped of ALL owner rights (owner commands, `/link`, super-user bank deposit) — the recognized identity was a single legacy `@lid` JID, but WhatsApp delivers the co-owner's messages in different JID forms (legacy `@lid` vs `@s.whatsapp.net` phone number, ±`:device` suffix), and the `.env` on the box pinned the stale lid form.
2. Fix: the co-owner is now recognized in **both** forms — `utils/constants.js` adds `COOWNER_PHONE` (personal number, env-overridable via `COOWNER_PHONE`) and `isCoownerJid()` (bare-number match across every JID form). Wired into every authority gate: `permissions.getBotOwners` built-ins (owner tier → all owner commands + `/link`), `register.js` co-owner S-rank, `RPGIntentHandler.getRole`, `approveserf.js` mod/owner check, `bank.js` super-user deposit. A stale `.env` `COOWNER_JID` no longer matters — the phone number is always recognized regardless of env, and a real `.env` change still works.

**Live sync**
3. `bots/MultiSocketManager.js` in the repo now matches the LIVE container file (includes the 09-18 QR pairing hotfix: wa.me `#fragment` extraction, base64url charset guard, variable reference-field count, `small:true` terminal QRs). The repo no longer carries a stale MSM that would regress QR pairing if ever copied into the box.

**Tests**
4. `test_push68.js` → 29 checks: co-owner accepted in lid/phone/device-suffixed forms → owner tier; strangers rejected; identity wiring verified across register/intent/serf/bank.

## Push #68 — Bug patches + gameplay improv (2026-09-18)

**Crash fixes**
1. `/party boss` → "boss is not defined" — `finishBossDefeat` now binds the boss from `gate.boss` (it referenced a block-scoped local from the `/party boss` branch, so EVERY boss settlement crashed — via `/party boss` or the general `/attack` flow).
2. `/attack` → "_petLines is not defined" — `_petLines` was declared inside the `if (canAct)` block but read in the counter-attack epilogue; every STUNNED player's attack crashed. Declaration hoisted to execute scope.
3. Combat self-lock — the combat lock exempted the holder, so a player could re-run `/attack`/`/party boss` before their own 5-message flow finished (others were locked out, the actor wasn't). `tryCombatLock` now blocks everyone, including the holder, with a tailored "your last move is still resolving" message.

**Wage system (guild salaries)**
4. Activity gate — members with fewer than **3 /daily claims in the current WAT week** are auto-skipped at pay time (week advances, no payout, DM explains what's needed). Counter maintained by `/daily` (`player.dailyWeek`).
5. Pro guildmaster approval — when the guild master is a PRO player, each member's due wage goes to the master as a DM with **✅ Pay / ❌ Skip** list buttons (`/wageyes` `/wageno`, resolved in `handlers/rpgCommandHandler.js` before the DM command gate). Unanswered approvals auto-PAY after 24h; if the master can't receive DMs (no serf / serf offline) the week auto-pays too — earned wages aren't held hostage. Non-pro masters keep auto-pay.
6. New **`/wages`** (`/wage`) — the payroll pipeline: due date, processing (awaiting master), paid, skipped history, this week's daily gate. Separate from `/contract` (terms).
7. **`/profile`** now carries a one-line wage status (active / due / processing / paid / defaulted).
8. `GuildContractManager` — `weekKey`, `weeklyDailyClaims`, `getSalaryStatus`, `tryResolveApprovalBySender`, `payOneWeek`/`skipWeek` (payHistory kept per contract, last 12 weeks).

**Owner tools**
9. New owner command **`/bleep <E|D|C|B|A|S> @player`** — changes a player's awakening rank and applies the rank's stat floor as a PURE IMPROVEMENT (stats raised to at least the new rank's base, never lowered) + the upgrade-point/mana-stone bonus delta. Level, class and XP untouched.
10. Co-owner recognition — `utils/constants.js` COOWNER_JID updated to the co-owner's live number (the stale `@lid` identity no longer matched, silently stripping the co-owner of ALL owner commands + `/link`).

**Balance**
11. Registration S-rank: **3% → 0.1%** (freed 2.9% to A: 17% → 19.9%).
12. Gate S-rank: **5% → 9.9% (+4.9%)**, funded by C gates (35% → 30.1%).

**World pacing**
13. Gate spawns: exactly **one gate per 2-hour WAT window** (midnight–2am → 1, 2am–4am → 1, …), dropping at a RANDOM moment inside the window. Countdown still persists across restarts (`gateSpawnMeta.nextSpawnAt`); each spawn stamps `lastSpawnWindow`.
14. Quiz: the Games-lobby button now starts an explicit **10-question** round (`/quiz 10`); `/quiz 3` still works, max 20 per round (default was already 10).

**Tests:** `test_push68.js` — 27/27 (crash-structure checks, combat-lock behavior, full wage-engine matrix, Monte-Carlo rank odds, 2h-window scheduling, /wages + /bleep execution).

> NOTE: the container's `/app/index.js` carries the `/api/db-restore` runtime endpoint (Push #67 era) which is NOT in this repo — the #68 deploy must not clobber `index.js`.

---


121 files: 7 brand-new, 114 modified. `patches/` mirrors repo layout — copy over repo root, review, commit, push (Railway auto-deploys).

## 🆕 NEW FILES (7)
- `commands/rpg/cashout.js` — /cashout for live Aviator flights
- `commands/rpg/retrieve.js` — /retrieve view-once saver
- `rpg/utils/Aviator.js` — Aviator crash-game engine
- `rpg/utils/AstraPass.js` — Astra Pass engine
- `rpg/utils/RewardInventory.js` — shared reward→inventory normalizer + legacy migration
- `rpg/utils/UI.js` — shared Free/Pro output-styling system
- `utils/messageEdit.js` — bot message-edit utility (Baileys MESSAGE_EDIT)

## ✨ NEW FEATURES
1. **Message-edit util** (`utils/messageEdit.js`) — edit sent bot messages in place.
2. **Button system config** (`utils/buttonHelper.js`) — buttons for everyone, never Pro-gated.
3. **`/casino open <mins>`** — opens commands + unmutes group, re-locks after N mins.
4. **`/casino aviator <bet>`** — animated crash game + **`/cashout`** command & button.
5. **`/retrieve`** — view-once photo/video/voice saver; 1/day free (WAT), unlimited Pro.
6. **`/steal`** — full sticker-pack support (custom `Pack | Author`).
7. **`/guild kick`** — new guild subcommand.
8. **`/duel` retired** — instant auto-duel scrapped; stub redirects to turn-by-turn `/pvp` (`/pvp duel` kept).

## ⚔️ PvP REWARD REWORK (latest correction)
- Winner aura: **+[20–35]**, Pro winners get **2×** (→ [40–70]).
- Loser aura: **−[10–15] flat** (never doubled, even for Pro losers).
- Winner's guild: **+15 GP**, Pro winners **2× (+30)**; loser's guild −10 flat.
- Pass XP (+50), BP XP (+100), Nexus, XP: Pro winners 2× (unchanged).
- Victory message now shows real numbers (aura line previously displayed a 2× it didn't grant).

## 📦 INVENTORY UNIFICATION — all rewards commit (latest fix)
- Root cause: rewards scattered across legacy buckets (`weapons/armor/accessories/materials`) that `/gear` + `/equip` can't see, while `/pass` materials went to `items` where crafting couldn't see them. Crafted + BP gear was display-only and unequippable.
- New shared module `rpg/utils/RewardInventory.js`: `inventory.items` is the single live bucket; everything is normalized on grant (gear gets `isGear/slot/stats/durability`); legacy buckets auto-migrate on claim/craft (idempotent, persisted).
- Rewired: `/bp claim`, `/pass claim`, crafting (reads/consumes from `items`, outputs normalized gear), gate monster drops, gateraid boss drops, daily item-spawn claims (also fixes double-push duplicates in `/inv`).
- Untouched by design: `artifacts`/`scrolls`/`potions`/`cards`/`keyStones` (separate systems).

## 🐛 BUG FIXES
**AI (Astra/Kira):**
9. Removed stray `Kira:` prefix from AI replies.
10. Stopped Astra-first personality hijack.
11. Full game-knowledge audit (`bots/GameKnowledge.js`).
12. Intent manager rebuilt (`bots/RPGIntentHandler.js`).
13. Per-player memory: last 50 msgs (was 20, shared across chat).
14. Lewd content → gentle in-character deflection (never complies, never preaches).

**Combat / PvP / Guild war:**
15. `/rob` Pro cooldown: 15 min (free 30 min).
16. PvP aura swing fixed at ±[10–15] (not level-scaled, not Pro-doubled); winner's guild +15 GP, loser's −10 GP.
17. GVC EXP buffs (gold/silver/bronze) grant to inventory, usable via `/use GVC --<tier>`.
18. Freeze = skip turn + damage-over-time (`StatusEffectManager`).
19. Unowned/unequipped attack patterns blocked (`AttackPatternDB`).
20. `/attack` + `/attacks` statusSummary fix.

**Quests / Passes / Rewards:**
21. Quest pool audit: Guild Pillar counting fixed, Abyss Walker floor 20→4, PvP quest miscount fixed.
22. Pass/Battle-Pass rewards go to inventory; `/inv` tier display corrected.

**Guilds / Party / Dungeons:**
23. Ban card shows player name, not UID.
24. `/q` (quote): WA pushName fallback + reply-beats-tag.
25. Party UI stripped of stale join/fight text; `/party join` + working buttons; `/attack`/`/skill` routing fixed.
26. Gate keys single-use + 100-day recycle sweep (`GateKeyManager`).
27. One party per dungeon group chat.
28. `/support` lists `--main` GCs by name only (URL buttons, links via DM).

**Crash fixes found during testing:**
29. `/groupinfo` crashed when `group.commands` undefined — guarded.
30. `/timezone set` rejected every real IANA zone (lowercase bug) — fixed.
31. `/rank`, artifacts, skills crashed for classless players — null-class guards.
32. `CraftingSystem` crashed (missing UI require) — fixed.
33. **PvP victory message crashed every battle** (`FRAME` undefined in resolver — rewards saved, message never sent) — fixed.
34. **`GateRaid.js` had a duplicated export block** (stray `};` = total module load failure) — fixed.

## 🎨 UI RESTYLE (output only — no logic changes)
- 82 commands restyled in 8 tested batches (rt12→rt15 harnesses, all green).
- Base UI for everyone; Pro deluxe frames + a data-driven PRO line per surface (PRO STATS, PRO WARDROBE, PRO GAVEL, PRO ORACLE…).
- Buttons kept general; image cards untouched.
- 13 batch-8 commands: upgrade, skin, set, status, botstats, find, sticker, imagine, ai, quiz, pvp_additions, ban, mute (+StatAllocationSystem, anime_quiz_200 engines).
- Deferred to a later batch: `utility.js` web-tools bundle, `/summon` gacha frames.
