# AniRPG — Patch Drop (features + bug fixes + UI restyle)

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
