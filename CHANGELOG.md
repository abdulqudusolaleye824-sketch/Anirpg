## 1.0.92 — Push #88b (2026-09-23)
- FIX: every /<classcmd> skill replied "on cooldown (15s)" — dispatcher pre-set the cooldown, then the engine checked it. Dispatcher now only gates; engines set.
- %-HP contract: skills that heal/drain/cost a % of HP apply EXACTLY the stated % (drains capped at 50% of target max HP, half-heal drains honoured, conditional "<30% HP" lines are not drains). Applied in gate raids, tower dungeons and PvP. Miracle heals 50% (living), Healing Light 25%, Arcane Blast drains 10%, etc.
- /setgc dungeon: also registers in GateKeyManager (persisted) and any AstralGroups 'dungeon' group is auto-adopted; /setgc reset clears both.
- Wages: guild master now gets a DM for PAID weeks (with treasury after), SKIPPED weeks (inactive member / reason), treasury short and approval requests; DMs fall back to any live socket when the GM has no serf. Stray contract buckets (guild-name / '[object Object]') merged before paying; hourly sweep logs [SALARY] lines.
- test_push88: 54/54.

## 1.0.91 — Push #88 (2026-09-23)
- Gate raids: 50% accumulated loot goes to GUILD treasury only on full party wipe (never to a player).
- /recon now re-provisions weapon ladder + passives for the new class (SNAP_KEYS include weapon/passives for undo).
- Healers: heal/buff teammates via support cast; teammate heals don't consume the turn; boss / high-severity monsters may retarget the healer afterwards (gates + tower dungeons).
- Monsters calibrate to total party accumulated stats + hunter level (severity 1–10×), scale per floor; tower DungeonManager.partySeverity.
- Buffs are real: tempBuffs feed UnifiedCombat, GateRaid.playerDamage and ImprovedCombat; buff skills strike at full damagePct AND apply the buff (no more 0-damage "+100% ATK").
- EffectParser: "Boosts ATK by 30%" phrasing parsed → Battle Cry etc. now apply.
- Dispatcher cooldowns use SkillCatalog key (were never enforced).
- Class provisioning: passives for Shaman/Assassin/Necromancer/Chronomancer; poison/burn skills for Shaman/Warlord/Chronomancer/Phantom; Monster class weapon ladder. All 25 classes: weapon+passive+DoT+20 skills.
- Durability: passive +1/hour (Pro 30 min) now ONLY mends slot #1 of the weapons bag and slot #1 of the gear bag; global 10-min tick in index.js so it restores even offline (stale-stamp bug fixed). NEW /swap <#a> <#b> (and /swap gear …) to reorder bag slots; /weapons marks the mending slot.
- Profile: pets count + active pet read from PetManager (always showed 0).
- Guild info: totalRaids (cleared/wiped) now incremented on gate clear/wipe; totalWars/wins incremented on weekly war resolution.
- Blank bubble: utils/outgoingGuard inspects every outgoing proto (relayMessage override blocks non-renderable payloads); /api/sends ops log.
- test_push88: 29/29.

# AniRPG — Patch Drop (features + bug fixes + UI restyle)

## Push #87 — v1.0.90 (2026-09-22) — WEEKLY TRACKING, RAID HP/CRIT FIX, SEARCH CARDS, SHARED CATCH

- **Weekly challenges now actually track**: `pvp_win`, `pvp_streak`, `dungeon_clear`, `boss_kill` hooked (pvp.js, SilentXP.js, gateraid.js). Previously only casino/send/daily/summon progressed.
- **Class/gear/title HP applied in raids & dungeons** (Kelvin-chan 729 vs 470 bug): every heal-clamp / HP display in gateraid.js, dungeon.js, pvp.js, ClassPower.js, GateRaid.js roster, party.js now uses `GearSystem.effectiveMaxHp`. Fixes hex soul-drain "resetting" HP to base max.
- **Crit fixed**: gear `crit`/`critDmg` and title `crit` now feed UnifiedCombat and GateRaid damage; `/stats` breakdown includes title crit.
- **`/search`** returns a cover image + summary card (Wikipedia → DDG instant answer), 1–3 links in footer instead of a link dump. Alias `/wiki`.
- **Scrapped 2x EXP & Nexus potions**: XP Booster and Nexus Multiplier removed from `/shop` and bundles (replaced with Luck Potions); existing stock is inert.
- **AstraPass currency scales with tier** (BP untouched): Free 1,000→25,500 💠 / 50→295 💎; Premium 3,000→76,500 💠 / 150→885 💎.
- **`/mods`**: co-owner hidden from the list (both identities); receives a silent mention tag only.
- **`/switch`** is now strictly bot owner/mod (Pro players & group admins no longer pass).
- **`/guild assign @user`**: transfer Guild Master; the old GM is removed from the guild and must be re-hired via `/guild hire`. Roster (`/guild members`) never shows a stale 👑 for the old GM (memberData mirrored + only the real leader renders as GM).
- **Treasury short**: when a wage can't be covered, BOTH the member and the Guild Master get a DM (contract defaulted, refill + re-hire).
- **Salary auto-pay fixed**: pro-GM approval was re-asked every 6h (askedAt reset → 24h auto-pay never fired) and a resolved approval could spin the loop. Now: ask once, 24h → auto-pay, next week asks again. Payroll runs hourly + 90s after boot.
- **Pro GM wage buttons**: legacy `list` message replaced with native quick-reply buttons on the GM's serf socket, typed `/wageyes`/`/wageno` commands in the body as fallback.
- **`/catch` in raids**: ONE roll per `/catch`; each wild pet has **3 attempts shared by all raid players**. First success owns it; 3 fails → it flees.
- **Pet evolution fixed** ("Evolution data missing"): 8 evolved forms were referenced but never defined — added Metal Slime, Alpha Shadow Wolf, Storm Dragon, Bloom Guardian, Storm Sylph, Divine Phoenix, Void Dragon Bat, Mana Stone Golem.
- **PvP turn order** now uses effective speed (base + gear + weapon + title + pet). Lock-in order never decides who moves first.
- **Pro GC** (`/setgc pro --main`): members-only group for PRO or Battle Pass Premium hunters (staff always allowed). Non-eligible joiners are DM'd + removed; their commands are refused with the how-to-join card. **Epic item spawn every 5h** (Mending Stone 25% of the roster) on top of the global daily spawn. **B/A/S gates only** (E/D/C rerolled). **/rob banned** inside. Never listed by `/support`. Added to `/profaq`.
- **Mending Stone is now EPIC** (spawns, daily); **removed from dungeon loot**.
- **Spawned items go to the real inventory**, wired to their category (Mending Stone → `/mend`; materials → `/craft` + `/inv`) — no longer dumped into the `/artifact` relic bucket.
- **Pro GC /rob ban applies to staff too** (owner bypass removed for the rob rule; access exemption stays).
- **Rest-mending**: unequipped gear & weapons in the inventory silently regain +1 durability per hour (Pro: every 30 min).
- **`/raid` in the wrong GC** now sends invite links for every `--main` dungeon GC instead of a raw group id.
- **Birthdays 🎂**: on a player's registered D.O.B. (WAT day) they receive +24h PRO (extends a running sub) and a ~10-line birthday message via their serf bot; no serf/DM dropped → posted in the `--main` support GC with a mention. Players who were already Pro get a spotlight in the announcements GC (`/setspace`). Hourly, once per year. `/birthday` shows status; owners: `/birthday run|test`.
- **`/recon` is now OWNER-ONLY** (like `/bleep`).
- **`/recon` customization (owner)**: `/recon @p <Class>|<quality>` pins the class and/or quality (1–100); `/recon @p Mage` keeps current quality, `/recon @p |80` re-rolls class at 80%. **`/recon undo @p`** restores the exact pre-recon class/stats/skills. Invalid input never strips the player.
- Birthday greetings go out at 00:00 WAT; `/birthday list` (mods → mods GC only) shows every player's birthday + age, soonest first.
- **Empty-message kill switch**: every outgoing text (and button body) must contain at least one letter or digit — frame/emoji-only or blank bubbles are blocked at the socket wrapper.
- **`/weekly` tracking fixed**: progress bucket now uses the same week key as the challenge set (players with a non-Lagos timezone lost all progress); surrenders now count as PvP wins/streaks; footer shows *Completed x/3 · Ready to claim*.
- **`/contract`**: ended (completed/defaulted/inactive) contracts no longer shown as the current contract.

## Push #86 — v1.0.89 (2026-09-21) — SILENT BOTS: ROOT CAUSE + DEAF-SOCKET DETECTOR

Live trace showed three different "connected but silent" modes at once: hinata/mikasa `received:0` (every inbound "Bad MAC"), seraph `received:659 handled:0` (all inbound arriving 20–35 min late → stale-dropped), killua fine.

- **Root cause of Bad MAC never healing:** `retryRequestDelayMs: 3000` is awaited *inside* Baileys' retry mutex. One failed decrypt blocked every other retry receipt for 3s; under a storm the queue never drained and Baileys' own per-contact session recreation (needs retry #2) never ran. Now `250ms` (library default), `enableAutoSessionRecreation` + `enableRecentMessageCache` explicit.
- **Push #85 storm watchdog removed** — it bulk-purged *all* Signal sessions of the "quietest" bot on a global error count, which throws away good sessions and can hit the wrong bot.
- **Deaf-socket detector:** a connected bot with no fresh (≤5 min old) inbound for 4 min *while another bot is hearing* is recycled (socket only — creds kept, never a re-scan). Lagging sockets (only stale replay) count as deaf. One recycle per scan, 4-min cooldown per bot. After 3 recycles with no recovery → Signal session files purged as last resort (creds still intact).
- libsignal `SessionEntry` dumps / "Closing session" noise silenced; decrypt failures summarised 1 line per 100.
- `/restart health` now shows 🙉 *deaf — last heard N min ago* vs ✅ *replying (heard Ns ago)*.

## Push #85 — v1.0.88 (2026-09-21) — MEND · PET PERMADEATH · COMBAT FAIRNESS · BOT UPTIME

- `/mend <inv#>` — one Mending Stone fixes ONE weapon/gear piece to 100% (equipped items included). `/mend` lists durability; `/mend all` = old whole-bag repair.
- `/inv` now lists your **equipped** weapon and gear too (✅), numbered like everything else.
- **Pet permadeath**: a pet that dies in battle is gone (graveyard, cap 20). No pet is auto-promoted — `/pet active <#>`. Its **Last Gift**: +level% to all stats + HP regen for `level` turns (dungeon, gate raid, PvP).
- Pet roles enforced: only SUPPORT pets heal; support pets never strike.
- Gear/title HP counts as real max HP everywhere (regen cap, potions, revive, stat allocation, pet heals). Title ATK/DEF and Last Gift now apply in PvP/unified combat too.
- Gate monsters scale to your **total** stats (base + gear + weapon + title + buffs), clamp 0.90–3.50×. DEF soaks ≤60% of a hit; a landed hit is ≥4% max HP.
- PvP: winner/loser no longer get a free full-HP catch-up regen at battle end.
- Cooldown/blocked attacks no longer spend your turn or give the monster a free hit (dungeon + gate raid).
- Dungeon turn lock: one move at a time; no double-turn spam.
- `/restart` messages no longer mention GitHub.
- After `/restart hard`, EVERY registered bot session on disk boots (BOT_BOOT_KEYS is now a minimum, not a ceiling).
- **Bad MAC watchdog**: bots that are "connected" but decrypt nothing get their corrupt Signal session files purged (creds kept, no re-scan) and auto-reconnect. libsignal stack-trace spam is collapsed to one line per 50.

## Push #84 — v1.0.87 (2026-09-20) — WEAPONS · GUARD · PASS UP · CRAFT FIX

- `/class weapons [class]` — class weapon progression (Lv.1→50) moved here; ✅/🔒 for your own class.
- Astra Pass **Premium tiers 1–15: +2 UP each**; **Premium tier 50: 🏆 legendary "Season N Astra Champion"** (season-based, +40 ATK/+30 DEF/+25 SPD/+250 HP/+5% crit). `/bp` premium tiers 1–15: +2 UP.
- **Crafting inventory detection fixed** — `RewardInventory.countMaterial/consumeMaterial` now match case/punctuation-insensitively across `inventory.items` (any type), legacy `inventory.materials`, and `player.materials` counters, honouring stack counts. Scroll read shows real "have" numbers.
- `/gates` is read-only: reports the active gate or "no active gate"; never spawns.
- New `/weapons` · `/weapon equip <#|name>` · `/weapon unequip` · `/weapon info` — durability bars; unequip falls back to class weapon; broken weapons can't be equipped.
- Pro `/daily`: 80% chance 🛠️ Mending Stone (not guaranteed).
- New `/guard [@teammate]` in party raids — next monster/boss hit aimed at the teammate is redirected to you and resolved against **your** DEF/HP (no mitigation); if you can't tank it, you fall. 3-min TTL, `/guard off`.
- `/pet mate`: 5-scene courtship sequence (approach → dance → bond → nest → egg reveal) before the result.

## Push #83 — v1.0.86 (2026-09-20) — LINKED BOTS OBEY COMMANDS + RAID/GUILD/FIND FIXES

- **Bots linked via /link (or resurrected by heartbeat) ignored every command but still chatted** — they were started without `rpgCommandHandler`. `setBootOptionsFactory` now gives every socket the same boot options (`buildBotOptions` in index.js).
- **One hunter, one raid**: `GateRaid.findOtherRaid` blocks `/party join` and `/gateraid enter` while you are alive in another recruiting/active raid.
- `/guild demote @user` → back to Member (GM demotes anyone; Vice demotes Officers only; GM can't be demoted).
- `/affiliate strip @user` (aliases revoke/remove) — GM/Vice revoke a granted affiliate (also withdraws a pending grant offer).
- `/find` now numbers and counts from the SAME serial list as `/inventory` (Sovereign Steel ×20 shows ×20; `#88` == `/inv 88`; gear shows `/equip <#>`).

## Push #82 — v1.0.85 (2026-09-20) — BOOT CONTROL

- `BOT_BOOT_KEYS=hinata,mikasa` (.env) boots exactly those bots (empty folder → QR). `BOT_NO_AUTH_RESTORE=1` disables session restore and purges `db.authBackups` + `auth-backups/` — fixes corrupt Bad-MAC sessions resurrecting from Mongo after a wipe.

## Push #81 — v1.0.84 (2026-09-20) — OPS ENDPOINTS (no SSH, no commands needed)

- `GET /version` — VERSION + process uptime/boot time/pid/memory.
- `GET /api/logs?key=<link password>[&n=200]` — last 400 console lines.
- `GET /api/trace?key=…` — per-bot: connected, ws state, messages received / commands / handled, drop reasons, last events.
- `GET /api/restart?key=…` — graceful shutdown; the container restarts the process.

## Push #80 — v1.0.83 (2026-09-20) — GATE SEVERITY = MONSTER STATS + INBOUND TRACE

- Gate severity is now the number that actually scales monsters: at launch (party AND solo — solo was never calibrated) the party's total power vs the rank's expected power sets severity 70–160%; every monster's HP/ATK/DEF/SPD and the boss scale from base stats; the % + label shown on every gate/party/raid screen is that applied severity with the "party power vs expected" reason. Labels: Mild <85, Standard 85–99, Hard 100–119, Severe 120–139, NIGHTMARE 140+.
- `/botstats` now prints an INBOUND TRACE per bot: messages received, commands seen, handled, and the top drop reasons (fromMe / ownEcho / stale / spam / notActive(active=…,present=…)) with the last 6 events — to pin down "silent bot" reports from the phone.

## Push #79 — v1.0.82 (2026-09-20) — HOTFIX: spam limiter too strict + GroupGuard left the community

- **Silent bots root cause #2**: the #75 limiter blocked the SAME command within 4s and (after #78) every block counted as a strike → normal players got muted, and since all 3 sockets evaluate each GC message the "same command" rule tripped constantly. Now: same command only within 2s, only real rapid-fire (<1.2s) counts as a strike, mute 15s after 8 strikes.
- **GroupGuard is community-aware and OPT-IN**: it did not know about WhatsApp communities, so it left the Astra community + announcement group while staying in sub-groups. Community shells are never auto-left; sub-groups of a community containing any allowed GC are kept. Auto-sweep on connect is OFF unless `/gcsweep auto on`; `/gcsweep` previews, `/gcsweep confirm` leaves.

## Push #78 — v1.0.81 (2026-09-20) — SILENT-BOT + SPAM ROOT CAUSE

- **Inbound dispatch rewritten**: every message in an upsert batch is handled (only `messages[0]` was — batches under load lost the rest); each chat has its own serial queue, chats run in parallel, and a command is cut off after 90s. One slow/hung command can no longer wedge every other chat behind it (the real "silent to commands while spawns still arrive" cause).
- **Group responder**: the socket that received a group command is present+online by definition — if the resolver picked an absent bot, the lowest present usable bot answers. No more silent groups on fresh boots.
- **Buttons/interactive relay** now goes through pacing + rate-overlimit backoff + empty guard (relayMessage bypassed all three → blank bubbles under spam).
- **Spam limiter escalates**: blocked commands count as strikes → 15s mute after 5, 60s after 12.

## Push #77 — v1.0.80 (2026-09-20) — GUILD LOGOS + GROUP GUARD

- `/guild icon` now works like `/seticon`: reply to an image (or caption an image) → guild LOGO (1 Seticon Card). Logo rendered on `/guild` info and on `/guildwar` board when the guild holds #1. Emoji badge still supported.
- **GroupGuard**: every bot leaves any group NOT added via `/joingc` or `/setgroup` (sweep on connect + instantly when added). Escape hatches: `db.groupGuardAllow[gid]`, `db.groupGuardDisabled`.
- `/joingc --silent <link>` — joins & tracks but hidden from `/gclist`.
- `/help` updated (store, inv/equip serials, guild icon, joingc/gclist, group guard).

## Push #76 — v1.0.79 (2026-09-20) — THE ARMORY

- **NEW `/store`** (aliases /armory): 24 pre-crafted weapons + gear per day (4 per rank E→S), rotates 00:00 WAT. `/store <rank>`, `/store info <#>`, `/store buy <#>` with buttons. Prices follow the ladder (E 50–100k … S 1M–10M 💠 + 400k–2M 💎) and scale with the actual stat roll.
- Weapons: E/D/C 50–150 ATK no status; B ≤250 + 1 status (12–20%); A ≤550 + 1 status (35–55%); S ≤2000 + 2–3 statuses. Gear: DEF/HP by rank, boots always SPD; B/A resist a status (+ every status −1 turn); S IMMUNE to 2–3 statuses. All have lore, durability scaled to level, **break at 0** (weapon on hit, gear when hit).
- **Weapons/gear removed everywhere else**: /shop weapons, dungeon loot, artifact spawns (now materials + Mending Stone 20%). Store is the only source.
- `/inv N` == `/equip N` == `/equip use N` == `/equip gift N @p` — one serial. Inventory paged 20/page with prev/next buttons, rank + emojis on every line; /items shows item emojis.
- **Skills fixed**: stat buffs (Fortress Stance DEF+50%…), target debuffs (Hunter's Mark +40% dmg taken), multiple statuses per skill now actually apply in PvP and dungeons and tick down each turn. Parser accepts "DEF +50% for 3 turns" / "target takes 30% more damage". Every skill description now has real lore + a Mechanics line.
- Mending Stone: spawns again, one use = **100% durability on everything** (weapon, equipped gear, bag).
- Revive Token 3,000 → **20,000** (bundles repriced). `/attacks` prices now use the same ladder as the store (A/S cost Nexus + Mana Stones).
- Store gear immunity/resist also honoured by StatusEffectManager (dungeon skill path).

## Push #75 — Silence + spam hotfix

1. **Outbound pacing.** Every send is serialised per chat (≥650ms gap) and capped per socket (8/s). Bursts become a queue instead of a WhatsApp rate-limit hit — the rate-limit is what made bots "silent to commands while spawns still arrive" and produced empty bubbles. Rate-limit retries now go up to 30s and text is not dropped.
2. **Inbound spam limiter.** Per sender: 1 command / 1.2s, same command ≤ once / 4s; per group 10 commands / 5s. Excess is ignored quietly (one "🐢 slow down" notice per 30s).
3. **Stale-message guard hardened**: 5-minute window, proper Long timestamp handling, never drops on an implausible clock.

## Push #74 — class power for real, dodge, poison/fear/weaken, party-calibrated gates, +300 monsters, pet mating & eggs, /link by password, multi-bot fixes (2026-09-19)

1. **Class stats are now REALLY applied.** Every awakened hunter carries their class's stat bonuses scaled by quality % (`rpg/utils/ClassPower.js`, idempotent, recorded in `classBonusApplied`). Skill passives ("+15% ATK", "Below 30% HP: ATK +60%", "+25% crit", "reduces damage taken 20%") are live multipliers in every combat path (gate raids, PvP, /battle), also quality-scaled.
2. **`Class: [object Object]` fixed** — `PlayerMigration` ran on every command and turned `player.class` into an object; it now always writes the string back. `/class` shows the bonuses actually applied + live passives.
3. **`/globalskill`** (owner/co-owner, DM only): recalibrates every hunter — strips + re-applies class bonuses, rebuilds skill ladders, normalises legacy class objects. Safe to run repeatedly.
4. **DODGE**: defenders roll to evade based on speed difference (+0.25%/pt, cap ±20), gear evasion, passive dodge and temp dodge buffs (0–45%). Works for hunters vs monsters/bosses and in PvP. Frozen/stunned/paralyzed never dodge.
5. **Statuses**: POISON is a real ≥4-turn DoT on 80+ monsters (Kasaka, spiders, nagas, plague…), on crafted venom weapons (`onHit`, absorbed via `/equip` → on-hit poison), and Archer **Venom Arrow** / Poison Arrow. Berserker gets **Bone Breaker** (WEAKEN) + fear on War Shout/Terror Howl/Savage Roar (EffectParser now parses fear). **WEAKEN = target takes +25% damage** (weakened +15%, enfeeble +10%).
6. **Gate severity is calibrated to the party, not random.** At `/party start` monsters + boss are scaled by party power vs the rank's expected power (×0.70–1.60), minus party luck (Luck Potions, up to −15%). Shown on the raid-start card.
7. **+300 monsters**: ~50 new per rank (E→S, 96–100 each), calibrated tiers/roles, 4 new craft materials per rank, 36 new Solo Leveling recipes (incl. venom edges) — every recipe material is droppable.
8. **Pet mating**: pets have ♂️/♀️; `/pet mate <#> <#>` (own pets) or `/pet mate <♂️#> @player <♀️#>` → `/pet mate accept`. Compatible species/element families, 12h cooldown, the ♀️ owner receives the egg; hybrids possible. `/eggs`, `/egg <#>` (lineage), `/eggs give <#> @player`, `/pet give <#> @player`.
9. **`/equip use` on potions** now obeys the gate-raid 5-potion party cap (and is blocked in PvP) — it was a silent bypass.
10. **rate-overlimit is handled inside the socket wrapper** for every send: backs off 1.5→3→6→12s, then drops silently. Nothing about it ever reaches a chat, and throttles no longer mark a bot "unusable".
11. **Multi-bot**: a NON-active bot can never post in a group that has its own bot (sends are redirected to the group's bot); stand-in takeover is temporary and never persisted (this is what left Mikasa stuck in other bots' GCs); `getActiveSocket` never falls back to "any socket" in groups; /switch to a silent bot now works even when nobody is marked active.
12. **`/link <bot>` from any DM**: asks for the link password (`LINK_PASSWORD` env, default set), then sends the pairing QR **as an image into the DM** — the same QR as the terminal, refreshed every 20s for 5 min. `/link lunar <password>` works inline.
13. **403 block/backoff system scrapped** (Lunar unbanned): a 403 is a normal close with the normal short backoff, re-pairs normally; "Scanning can't fix this" message removed.

14. **Sluggish bots / replaying hours-old commands FIXED.** After a reconnect WhatsApp replays the offline queue as "new" messages; the bot answered those (slowly, in order) and ignored live ones. Every message older than 90s (`MAX_MSG_AGE_MS`) is now dropped on arrival; `/restart` also discards everything sent before it, clears takeover + send-health state. New **`/restart hard`** restarts the whole process (Docker brings it back in ~30s) for a truly fresh start.
15. **`/hi` is answered by every bot individually** — each socket greets only as itself (no chorus/orchestrator).
16. **Skill upgrade costs ×3** for all classes: 45k → 150k → 360k → 900k.
17. **Astra Pass / Battle Pass XP curve steepened**: tier cost = 1,500 × 1.09^tier (tier 1 ≈ 1.6k, tier 30 ≈ 20k, tier 49 ≈ 103k). A full free grinder tops out around tier 30 (~200k XP/season); 50 (~1.2M) needs Pro/Premium multipliers. `/pass` shows the real requirement.

18. **Class stats now actually change (#74b).** The first #74 build tagged everyone who awakened before it as "legacy — already applied" and added nothing. That assumption was wrong; legacy hunters now receive their quality-scaled class bonus once (idempotent), and stale legacy records are converted on the next command. `/stats` shows `Class bonus:` and `Passives:` lines.
19. **`/link` QR flow:** image is numbered (#seq), always sent by the bot you're talking to, and when the pairing socket drops mid-scan you get a "ignore the last QR, new one coming" notice instead of silence. New **`/stoplink`** (aliases `/linkstop`, `/stopqr`) stops QR delivery and ends the pairing socket if nobody else is watching.

20. **Class stats REALLY stick now (#74c).** Root cause of "listed but numbers didn't change": `/stats`, `/upgrade` and `/equip` recompute `stats = baseStats + allocations`, which wiped a class bonus that lived only in `stats`. Class bonuses are now mirrored into `baseStats` (existing records auto-migrate on the next command). Naruto's Berserker ATK goes 166 → 226.
21. **Two skill sets fixed.** `player.classSkills` (the full class kit, display data) was being treated as "already owned", so the entire kit was unlocked at Lv.1 alongside the ladder. Class-file skills are now strictly level-gated (Lv.5/10/15…); leaked unlocks are revoked on the next command. Skills you had *upgraded* are kept. `/stats` shows the kit as a ✅/🔒 ladder, and the active bar auto-fills from the library.
22. **Weekly Guild War never flipped.** The week key was ISO (Monday-based) while the cycle is Sun→Sat WAT, so the war ran a day late and cards were never paid on Sunday. Key now flips exactly Sat 23:59 WAT. New owner command **`/guildwar settle`** pays out the current standings immediately (GVC cards + MVP) and starts a fresh week — use it once to grant the skipped week.
23. **Pairing "Couldn't log in" after a good scan.** The bot's `_loggedOut` flag from the unlink was still set, so when WhatsApp sent 515 (restart-required, the normal post-scan step) the reconnect was refused. `/link` now clears the flag; 515 always reconnects.

24. **`/guildwar settle` now previews first** and needs `confirm`; new **`/guildwar undo`** reverts the last settlement exactly (cards removed from the members who got them, MVP −20k Nexus + title, GP restored to the board). (#74d)

## Push #73 — rate-overlimit backoff, /version, profaq price, rules 16–17 (2026-09-19)

1. **`rate-overlimit` no longer surfaces as a command error.** WhatsApp throttles OUR sends; the handler now backs off and retries (1.5s → 3s → 6s → 12s) instead of failing the command instantly, and if a throttle still slips through it is swallowed rather than shown as "❌ An error occurred… Error: rate-overlimit" (the game state had already advanced).
2. **`/version`** — prints the running build (git commit from `VERSION`, package version, uptime, and whether `/recon` `/burnkey` `/catch` exist in this container). Use it to confirm a deploy landed.
3. `/profaq`: Monthly Pro Card is **$5** equivalent (was wrongly $30).
4. `/rules`: **16.** keep the community friendly and insult-free; **17.** have fun.

## Push #72 — Pro UP bonus, Mana Stones wording, skill placeholders, multi-turn effects + status synergy, /weekly crash, auto-deploy watcher (2026-09-19)

1. **Pro cards grant Upgrade Points:** Weekly +20, Monthly +100, Yearly +1,200 (both purchase and `/prostore use weekly`); shown in the store list and activation card.
2. **"Moonstones" → "Mana Stones"** everywhere users see it (`/send` receipt, chess/tic-tac-toe stats, game knowledge).
3. **Skill ladder placeholders fixed** — `{p}` / `{p/N}` in class signature moves now show the real potency ("absorbing 60% of incoming damage"), not the template.
4. **Multi-turn status effects for players:** any status a player inflicts lasts ≥2 turns (attack patterns 2–4 turns, catalog skills min 2, freeze 2) instead of expiring on the next tick.
5. **Status synergy (players *and* monsters):** `rpg/utils/StatusSynergy.js` — 17 rules, e.g. fire vs *frozen* ×1.5, blunt vs frozen ×1.35, cutting vs *bleeding* ×1.3, drain vs bleeding ×1.4, anything vs *stunned/paralyzed* ×1.2, finishers vs *weakened* ×1.3, holy vs *cursed* ×1.35, ice vs *burning* ×0.8 (steam). Wired into `UnifiedCombat.calcMoveDamage` (PvP, dungeons, gate counters), `SkillCatalog.computeDamage`, and `GateRaid.playerDamage` (normal + boss). Turn messages print `⚡ SYNERGY …`.
6. **`/weekly claim` crash** (`reading 'pvp_s'`): older/partial `weeklyChallenges` records lacked `progress`/`claimed` → now backfilled.
7. **`scripts/autodeploy.sh`** — the 5-min git watcher (fetch → snapshot DB/auth → stash drift → ff pull/reset → npm i → restart docker/pm2/systemd/node → health probe; flock'd; logs to `/var/log/anirpg-autodeploy.log`).
8. Tests → `test_push71.js` 66 checks.

## Push #71 — 12-point fix drop: guild money, power, keys, Senku, pets, /catch, recovery, Solo Leveling bestiary, emojis (2026-09-19)

1. **Guild kick ×2 severance (regression of #70) — actually pays now.** `guild.js` passed the guild *object* into `creditKickPayout`, which keyed the contract lookup as `db.guildContracts['[object Object]']` → "no contract" → no payout. `findGuild` accepts objects, kick passes id+name, and the stray `[object Object]` bucket is purged on next `/guild`. Severance is ledgered (`kick_severance`).
2. **`/guild` info shows the live treasury.** One resolver (`resolvePlayerGuild`) now serves `/guild`, wages and every money path: matches by normalised number (lid/phone/`:device` tolerant) instead of exact JID, and duplicate same-name guild records are merged (Nexus, Mana, GP, roster summed) so the vault can no longer be split across two objects. `GateManager.purchaseGate` no longer looks guilds up by name in an id-keyed map.
3. **PRO LEDGER = balance.** Every spend path now writes to the ledger: attack-pattern buys, gate keys (personal), guild deposit/withdraw/found/shop/bio, catch attempts, awaken, enchant, skill upgrades, gifts, dungeon entry, artifacts, stat resets, pet food. Credits added for wages, guild withdrawals, kick severance. `TransactionLog.logSpend/logCredit` helpers.
4. **Power is one number everywhere.** `SoloLevelingCore.calculatePlayerPower(player)` (base + gear + weapon + title + constellation + pet) is used by `/profile`, `/stats`, `/guild members`, the intent handler and the stats card.
5. **`/wages` is live.** Settles due weeks, saves, then re-reads; target resolved by live membership (not the cached `player.guild` name); shows guild treasury now + your balance now; strays contracts filed under an old id / name / `[object Object]` are moved home.
6. **`/burnkey`** (mods): `/burnkey @player` burns every live key they own, `/burnkey <KEY>` burns one. `/reset` now burns the target's keys automatically (key marked used/expired, dungeon GC freed, gate record dropped).
7. **Senku is exclusive.** The random class roll built its pool from every class file (divine included) — `rollableClasses()` now excludes divine/owner-only. **`/recon @player`** (mods) strips the current class (stat bonuses + skills) and rolls a fresh non-exclusive one; refuses to strip Senku from its rightful holder.
8. **Pet food actually works: shop → inventory → pet.** One id-keyed bucket (`inventory.petFood`) with automatic migration of legacy `items[]`/name-keyed food; `PetManager.feedPet` consumes from the hunter's inventory (was free and ignored inventory); `/pet foods` prices in **Nexus** with owned counts; new `/pet buy <food> [qty]`; `/food` rewritten on the bucket (list + give); guild-shop sealed boxes and gate drops land in the same bucket; `/inv` + `/find` read it.
9. **`/catch` replaces `/caught <token>`.** `/catch` already auto-finds the wild pet spawned for you; all prompts now say `/catch`; `/caught` is a forwarding shim.
10. **Recovery skills heal for every class.** SkillCatalog now infers a real heal % from any "Heal/Restore/Regenerate … HP" effect line (Healer, Paladin, Shaman, Monk, Warlord, Necromancer, Chronomancer, Devourer, Dragon Knight, Berserker, Rogue…); hybrids hit *and* heal, pure heals heal only. Applied in `ImprovedCombat.executeSkill`, `GateRaid.playerDamage` (normal + boss messages show `💚 restored X HP`) and the class-command dispatcher. Runtime check: 44/44 heal-capable skills restore HP. **Dungeon monsters' 100 % status procs removed** — counters roll per-move chances (burn 40 / stun 25 / bleed 40 / fear 30 / weaken 35), Doom 100→60.
11. **Solo Leveling bestiary + gate strength %.** `rpg/data/SoloLevelingMonsters.js`: 50 monsters per rank E→S (Steel-Fanged Lycan, Blue Venom-Fanged Kasaka, Cerberus, Igris Shade, Baruka, Kargalgan, Beru, Kamish, Baran, Bellion, Rakan, Legia, Querehsha, Antares…), each with a role (brute/assassin/caster/tank/swarm → stat spread), a tier 1–5, counter-skills with real chances and 3 craft drops + the rank's Mana Essence. Every gate rolls a **strength 60–100 %** of the strongest gate of its rank: it gates which tiers can appear, scales monster + boss HP, and is printed on gate spawn, purchase, key DM, every party-create/status screen and raid start as e.g. `E rank gate 100% — ☠️ MAXIMUM (strongest possible E-rank gate)` / `A rank gate 80% — 🟠 Hard`. Monster counters use the monster's own moves. **Crafting:** 288 new recipes (`recipes_sololeveling.js`, 6 per slot per rarity) built only from bestiary drops + Mana Essence, merged into the scroll pools; scroll read-outs show where each material drops and how many you hold; 25 % of drop misses give the rank's Mana Essence.
12. **Item emojis.** `rpg/utils/ItemEmoji.js` gives every item a glyph by slot/type/name (⚔️ 🪓 🏹 🪄 🔱 🪖 🛡️ 🧤 🥾 👖 💍 📿 🔮 🦷 🐚 🩸 🦴 ⛓️ 💎 🧵 🍖 📜 💠 …) next to the rarity dot; used in `/inv`, `/find`, `/food`.
13. Tests → `test_push71.js` (58 checks) + `test_push68.js` (32) green. Data safety: no player field removed; migrations are additive (pet food bucket, guild `id` backfill, contract re-homing).

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
