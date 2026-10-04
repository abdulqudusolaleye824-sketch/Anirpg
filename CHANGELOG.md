## 1.0.169 — Push #96h-z13c: /dbstatus shows where the bytes are

- `/dbstatus` now lists the 8 biggest sections, the 3 heaviest players (and their heaviest field), and the heaviest gate — to finish shrinking the 12.7 MB document.

## 1.0.168 — Push #96h-z13b: stale gate sweep (the 19 MB database)

- **Root cause of the slow bot found:** broken / cleared / expired gates were never removed — live there were **1016 "active" gates for 134 players**, a 19 MB document, every 10-s sweeper walking a thousand dead raids, 160 ms per save, and the Mongo mirror refused (>16 MB).
- **Sweep** at boot and every 10 min: cleared/broken gates go 2 h after they end, free gates 2 h after their break time, purchased gates when their key is expired/complete (or keyless after 7 days). Never touches a gate with a raid that moved in the last 2 h.

## 1.0.167 — Push #96h-z13: find the loop blocker, fewer DB serializations

- **Slow-task attribution** — every timer and every Baileys event handler is timed; any run over 250 ms logs `🐢 SLOW TASK <ms> — <origin>` with heap/RSS, and the lag watchdog now prints the 3 most recent slow tasks. This names the thing behind the 1.5–3.7 s event-loop stalls instead of guessing.
- **DB writes coalesced harder** — min 3 s between full serializations (was 1.2 s), max wait 10 s. Each serialization blocked the loop ~160 ms, ~17×/min.

## 1.0.166 — Push #96h-z12: deaf-bot wake-up, faster group sends, honest shield lines

- **Faster commands / fewer send timeouts** — group metadata is now cached (5 min, refreshed on member changes). Before, every group message fetched the full member list from WhatsApp first → slow replies, "send timed out", rate limits.
- **Deaf bots wake instead of staying dead** — on first deaf detection the bot refreshes its pre-keys, sends a self nudge and a hearing peer DMs it; only if still deaf 90 s later is the socket recycled. Pre-keys are also re-uploaded on every clean connect and in the lonely-nudge path.
- **Gates no longer strike while the bot is deaf** — the idle-strike check now judges the bot that actually serves the group (before, a *different* bot hearing the chat counted as "healthy", so the gate attacked while your commands were ignored). A freshly reconnected bot also waits 60 s before striking.
- **Monster transformation cooldown everywhere** — 1 h (30 min Pro) between transformations in raids, instances, PvP and dungeons, same as the island. Upgrading tiers while still transformed is free.
- **Mana Shield (and every partial shield) now says what still lands** — "absorbs 120 of the hit — *180* still gets through" (Mana Shield only absorbs its % of the hit; the rest is real damage).

## 1.0.165 — Push #96h-z11: transport errors are silent

- **No more "send timed out after 20s" / rate-overlimit error cards** — any failure caused by WhatsApp throttling, spam limits, send/handler timeouts or a dropped connection is swallowed silently (logged only). Real command bugs still show the error card.

## 1.0.164 — Push #96h-z10: Admin notices, silent bot auto-admin, /starts gate, 30-day dungeon subs, no double replies

- **Admin promotions / demotions announced** — 20 promotion + 20 demotion messages; ONE bot (the dispatcher) posts it and tags the member. Bots being promoted are never announced.
- **Bots auto-promote silently** — whenever a bot lands in a GC (added by hand, connect-time main auto-join, `/joinmain`) any sibling bot already admin there promotes it, no message. `/joinmain` forces it for every bot in every main GC.
- **Group flow** — `/starts` (Owner) wakes the bot in a group; before it the group is **dead silent** (Owners excepted). `/setgc <type> [--main]` sets the type (`--main` = open to everyone, never expires). Without `--main` the group stays silent to players until `/ssub | <subscriber>` opens the **30-day** run; after it expires players see the expired notice and an Owner can `/renew`. `/sub` stays readable.
- **Dungeon GCs expire again** — the old "dungeon groups never expire" exemption is gone: a private dungeon GC started with `/ssub` shows its subscribed/expiry dates and runs 30 days. Only `--main` never expires.
- **No more double replies** — inbound dedupe per (bot, chat, message id): a message WhatsApp hands the socket twice after a re-link is handled once.

## 1.0.163 — Push #96h-z9: Events ×2.5 vs beasts, stun retaliation, domain ATK/DEF buffs, gate tuning, 10×5 instances, main-GC auto-join

- **Events** — hunter damage against mana beasts is **×2.5** (hunter-vs-hunter unchanged). A **stunned/frozen** hunter who swings at a beast is punished: the beast retaliates on the helpless hunter.
- **Event domains buff ATK and DEF** — a standing domain gives ATK +25% +1%/level and DEF +15% +0.5%/level (Lv.30 → +55% / +30%). `/eprofile` shows the buffed numbers and a `🌌 Domain Lv.N standing` line; the DEF buff is applied to beast counters and hunter hits against you.
- **Gates** — regular gates **−15%** (monsters + boss HP/ATK/DEF); **Red gates +15%**; a leaked beast a further **+15%**.
- **Instance dungeons rebuilt** — **10 floors × 5 monsters** (the 5th of each floor is its boss; floor 10's is the Overlord). Clearing floor 10 clears the Job Change Quest and the instance closes with a summary. **2 h hard limit** — it closes itself. **No auto-attacks.** Combat uses the regular dungeon commands routed into the instance while you are inside (DM): `/attack`, `/attack <id>` (equipped pattern), `/skillcmd <skill>` (also `/cast`, `/skill`) — with the same multi-message detail flow (move card, effect, result, HP bars). Beasts open a domain at most once each (boss 50%, others 15%). `/instance start [job]`, `/instance` (status with time left), `/instance leave`.
- **Bots & main GCs** — a bot that connects **auto-joins every `--main` group** it is not in yet (45 s after linking; invite link from the registry or fetched through a bot already inside). **`/joinmain`** (alias of `/joinmains`, works from any bot's DM) joins all online bots to all main groups.

## 1.0.162 — Push #96h-z7/z8: Domain owner perks, single-target domain burst, lasting beast statuses, transformation cooldown

- **Event domain lasts its turns** — turns are taken from your CURRENT real domain level at cast (Lv.30 → 16, Lv.40 → 21) and only tick on the owner's own moves; `/eprofile` and every message show the countdown.
- **Domain owner perks** — casting erases every status on you; inside a standing domain you are **immune to new statuses** (🌌 line), **regenerate 10% HP per turn** (💚 line) and your **flee is guaranteed (100%)**.
- **Single-target opening burst** — `/domain` without a tag puts the WHOLE burst on the beast you last hit (or the weakest live one), not spread over the wave. `/domain @player` lands the whole burst **plus** your domain's statuses on that hunter. No caps — a strong enough domain one-shots a boss or a hunter.
- **Beast statuses last** — stun / weaken / bleed / freeze on mana beasts now count down in time (one tick per 20 s), not once per hunter hit, so a wave of hunters no longer strips them in seconds.
- **Monster class is RARE** — 2% of awakenings (it used to share an equal slot with every other class, ~4%). Innate 100% quality unchanged.
- **Registration ranks rebalanced** — E 22% · D 32% · C 30% · B 13% · **A 2.9%** (was 19.9%) · S 0.1%.
- **Island vs raids** — `/e join` now pulls you out of any gate raid / solo dungeon / party / instance you were in, and while on the island EVERY raid or dungeon action (attack, skill, advance, boss, ready, item…) is refused — not only entering. `/eventafk` first.
- **`/pinterest` fixed** — crashed with `db is not defined` since the no-repeat history was added.
- **Monster transformation cooldown** — Quarter / Half / Full transformations (innate rampage surges included) can be used once per **1 h** on the island, **30 min for Pro**; the cast is refused with the time left.

## 1.0.161 — Push #96h-z6
- Monster-class STRAIN (weaken 10t / stun 2t / bleed 7t) fires on the island when a transformation ends; stunned/frozen turns are reported as normal messages (bleed still ticks), bleeding out is handled.

## 1.0.160 — Push #96h-z5
- Statuses name the hunter who inflicted them; a beast that dies to bleed/poison/burn is credited (points, EXP, artifact) to that hunter.
- Monster-class transformations now multiply island stats (ATK/DEF/SPD/HP) against beasts and hunters; they tick per island action. Real stats untouched.
- Events GC refuses every non-event command (owners/mods exempt). Event sends retry once on a slow socket.

## 1.0.159 — Push #96h-z4
- Hunter vs hunter: a plain number is an ATTACK PATTERN (`/attack @x 7` → pattern #7, must be owned); skills by name (`/cast @x Fireball`).
- Flee is rolled from speed + event level + luck (10–90%), never guaranteed; a failed flee lets the opener land.
- You cannot flee from a hunter whose domain stands — unless your own domain stands (break theirs first).
- Pro: domain cooldown halved (30 min).

## 1.0.158 — Push #96h-z3
- Events GC is event-only: `/attack`, `/cast`, `/hunt`, `/huntreply` → event attack; `/heal`, `/buff` → event support; `/domain` → event domain; `/lb` → `/elb`; `/eprofile`/`/stats` → event stats; `/use` potions heal EVENT HP.
- Battle flow: `/attack 24 7` (beast 24, skill 7) · `/cast 24 <skill>` · reply/tag + `/attack 7` on hunters (20 s window) · `/huntreply <skill>` · hunters can be named (`/attack Alpha 7`). Support skills ignore tags (always self). Turn goes out as THREE messages.
- Status effects really land on beasts and hunters (poison/burn/stun…), tick each turn, stunned/frozen cannot act or counter.
- Island has its OWN statuses/buffs; normal-world artifacts/auras/buffs/statuses have no effect there (energy shared).
- Event domains last normally: N turns (6 at Lv.10, more for carried domains) up to 20 min; every foe met inside is −20% ATK/DEF + domain statuses; owner cannot miss, +25% dmg. Striking a hunter whose domain is up → DOMAIN CLASH (most refined wins, loser shatters).

## 1.0.157 — Push #96h-z / #96h-z2
- Bosses CARRY their artifact (shown when the boss emerges; the killer takes it). 5 island artifact spawns per day with a 🔮 Claim button.
- `/elb` — top participants: points, event level, kills (boss), hunter kills, deaths, artifacts. `/event skills` — your usable skills + equipped patterns.
- Hunter kill: victim loses points only (event level kept); killer gets event EXP. HP artifacts also fill the pool.
- Jeju Island: **event levels** — everyone lands at Event Lv.1 with E-Rank beast stats (separate from real level/HP/gear); class skills, Monster skills, attack patterns and your real domain still come with you.
- Beast kills give event EXP (Pro ×2); level-ups raise island HP/ATK/DEF/SPD. `/event stats` shows level, EXP, HP, ATK, DEF, SPD, CRIT, artifacts.
- 🔮 Event artifacts: 15% drop from beasts, always from bosses, one surfaces on the island every 30 min (`/event grab`). 6 slots; they buff event stats only.
- Event HP pool: damage, heals (`/event buff`) and idle regen (5%/min) use island HP — real HP untouched.
- `/eventafk`: 10-min lock after joining/returning; chatter and other commands no longer break AFK (this was blocking AFK hunters from raids). Any event action auto-returns you.
- Every event message tags the hunters it names (Name @number).
- Event attack now goes out as ONE message (fixes "send timed out after 20s" command errors); event sends never throw.

## 1.0.156 — Push #96h-y
- Jeju Island: every class skill, all Monster-variant skills, equipped attack patterns (`#id`) and support buffs (`/event buff <skill>`) usable.
- Targeted hunter gets buttons: ⚔️ Counter (base ATK) · 🏃 Flee (guaranteed) · 💨 Dodge + counter (speed-based 15–85%).
- Pro respawn 30 min (free 60). Beasts stronger (HP ×1.6, ATK ×1.5, DEF ×1.3). Points: 10 per beast, 100 per wave boss.

## 1.0.155 — Push #96h-x
- Jeju Island Raid: hunters of ALL levels may join and fight (the event domain stays a Lv.10 domain).
- `/event attack` now plays the full dungeon-style battle flow (move card, effectiveness, damage, HP bars) for the strike and the beast's counter, instead of two one-liners.

## 1.0.154 — Push #96h-w
- A monster that dies to its status (bleed/burn/poison) at the start of your turn is settled as a kill — your strike no longer plays against a corpse.
- One monster at a time: a hunter's domain in a raid lands on the current target only.
- Red Gate / Double Dungeon: affiliates can neither be hired into nor accept into a sealed gate.
- Buttons: affiliate offers (Accept / Reject); attack patterns (Equip after buying, Equip on /attacks all).
- `/play`: second raw YouTube search (no "official audio" bias) and a flagged closest match before giving up.

## 1.0.153 — Push #96h-v
- Bot added to a group: says thanks (+ how to /start it). It stays only if added by an Owner (auto-tracked like `/joingc`, per-bot) or the GC is tracked for it; otherwise it leaves.
- A mod/owner leaving a non-main GC: all bots leave too unless an Owner is still inside; if an Owner left, all bots leave regardless. Tracking entries dropped, serials freed.

## 1.0.152 — Push #96h-u
- `/payroll` is read-only (never pays) and lists current guild members only.
- Group guard is PER-BOT: a `/joingc` GC counts only for the bot that joined it — a bot added by hand to that GC is swept; `/setgroup` GCs stay shared. `/leavegc` pulls every bot out of the GC.
- Left GCs free their serial; `/joingc` reuses the lowest free number. `/gchidden` lists silent GCs.
- Profile: raid record (entered / cleared / wiped / success %, deaths) + live raid status.
- Daily quest "Participate in 1 Guild War" → "Earn 500 Guild Points" (existing copies update automatically).

## 1.0.151 — Push #96h-t (Master Fix List)
- Domain: "expanded their domain against you" DM scrapped. `/domain` inside a battle = short battle card only. Domain turns in party raids now count ROUNDS (every living hunter acted once), not single attacks.
- Multi-bot: a bot removed from a group marks itself absent and hands the group to a present bot; stale presence (bot stopped hearing the group) no longer silences the new bot.
- `/sub` (anyone): subscribed date, expiry date, days remaining. `/e` alias for `/event` — `/e join` works any time while an event is active.
- Mana drain (monster domain law) hits ONE hunter only. Out-of-combat regen cap raised (30 s → 6 h of idle credit) so gear-sized HP pools actually refill. Necromancer "Summon Undead" → "Undead Summon".
- Heal descriptions show the real cost (non-Healers: doubled number). Blood Armor now does what it says (converts 40% of damage taken into HP next turn); buff notices never show a blank name.
- Energy potion wording gone from Starter Pack; `/market sell` finds counter-based potions (lower/medium/higher HP potions, revive tokens).
- Deaths to status effects are announced ("dies to BURN (Domain: …)"). Class awakening safety net (lifetime XP derived from level; checked every command). `/recon` assigns a class to hunters with none.
- Berserker **Blood Debt** passive: each 5% max HP taken = 1 stack (max 15): +3% ATK, +1% lifesteal per stack; settles when the fight ends.
- Event: hunters who own a domain keep its name/description/level on Jeju (≥ Lv10); others get the Lv10 event domain. `/payroll` settles due pay first and skips contracts of hunters who left.
- `/gates` carries BUY buttons; failed `/catch` offers a Catch-again button.

## 1.0.150 — Push #96h-s: gear HP applies instantly · domain caster moves first
- **Gear HP:** equipping a piece adds its HP bonus to your CURRENT HP immediately (2k/2k + 2k gear → 4k/4k), net of the piece it replaces; unequip/swap trims HP under the new max. No more "4k on the card, 2k in the fight".
- **Initiative:** while a hunter's own domain stands, the caster always moves first — no raid-monster initiative against them, PvP order forced (announced).

## 1.0.149 — Push #96h-r: monster domain power nerfed + variance · phantom domain fix
- **Monster domain power** (clash only — effects untouched): rank×45 + level×0.5 + boss 40 + elite 15. A Lv.2 hunter domain (~78 power at Lv.20) now beats any E-rank beast, boss included.
- **Variance:** every beast rolls a domain strength multiplier 0.70–1.30 once — some come out weaker, some stronger.
- **Phantom domain fix** (screenshot): a domain from an earlier fight that was never ticked to zero kept shielding/regenerating its owner in the next battle. Domains now expire 20 min after casting if the battle doesn't tick them out; PvP arenas drop expired domains on start.

## 1.0.148 — Push #96h-q: domain immunity fix · caster regen · battle status · one desc edit · /resetpro
- **Immunity fix:** domain owner immunity matched only on `.jid`, which raid player objects don't carry — so owners were still getting statused. Now matches jid/id/name; verified statuses are refused.
- **Caster regen:** every domain heals its caster 10% max HP per turn while it stands.
- **Burst** stays a one-time hit on expansion (not every turn) — as intended.
- **/domain** in battle: shows which domain is active (yours / teammate / beast), turns left, and whether yours is READY (energy vs cost).
- **/domain desc <text>**: one free change per hunter (≤2000 chars), permanent after.
- **/resetpro [@|reply]** (owner): wipes Pro status + perks (lock, emoji, auto-mend, tier, expiry) — Nexus, Mana Stones, items, cards, keys, boxes stay. Self when no target.

## 1.0.147 — Push #96h-p: domain duration & cost scale every 2 levels
- Domain lasts **+1 turn every 2 levels**, no cap: Lv.1 → 2 turns, Lv.10 → 6, Lv.20 → 11, Lv.100 → 51.
- Expansion costs **−5% energy every 2 levels** (floor 30%): Lv.1 350, Lv.10 280, Lv.20 192. `/domain` shows the live cost.

## 1.0.146 — Push #96h-o: DOMAIN REVAMP
- **All class domains revamped:** archetype numbers ~2.5× (e.g. Bastion: Allies DEF +50% / dmg taken −30%, Enemies ATK −25%) PLUS a per-class kit on top — extra boosts, extra debuffs, forced STATUS EFFECTS on every enemy and an opening BURST (% of caster ATK). Berserker: ATK +40%, Crit +10%, Lifesteal +10%, enemies SPD −20%, 50% STUN · 100% BLEED · 100% SLOW, 250% burst. 25 kits; statuses/burst scale with domain level.
- **No-miss:** while YOUR domain stands your moves have 100% accuracy (owner only — teammates unaffected).
- **Ally refinement:** a teammate expanding while another ally's domain is up — the more refined one (class quality, then power) occupies the space; wording no longer calls an ally "rival".
- **Name fix:** the expansion now bears the name you gave the domain (was showing the effect's archetype name).
- **Description** up to 2000 characters.
- **Leaderboards:** owner and co-owner removed from LEVEL and WEALTH boards.

## 1.0.145 — Push #96h-n: combat truth · affiliate seat · recycle · owner grants · spawn buttons
- **Blind/Fear:** accuracy is only cut by a LIVE blind/fear; expired effects no longer linger on stats; a feared hunter is told FEAR, not BLIND.
- **Held beasts:** stunned/frozen/paralyzed/asleep monsters never move first — the raid says so (`⛓️ X is PARALYZED — held in place`).
- **/guard vs initiative:** a raised guard intercepts the opening strike too.
- **Leaked beasts:** ATK −70% (5× × 0.30); HP/DEF stay 5×.
- **Affiliate hire:** accepting now seats you in a recruiting OR active raid (resolved with db) — no more "You are not in this raid" after accept.
- **Last floor never revives:** the stale-floor revive skips the final floor.
- **Monster speed recomputed:** anchored to the party's average with a per-beast spread — some beasts are faster than hunters, some slower.
- **/addxp <amount> [@|reply]**, **/addnexus <amount> [@|reply]** — owner only (self when no target).
- **Recycle fix:** bestiary drops (Void Essence, Wraith Soul …) and base materials are recognised as gate materials.
- **/spawn material <name>** (any material, any tier) · **/spawn materials <E|D|C|B|A|S|common|rare|epic|legendary>** (tier cache).
- **Buttons:** spawns carry 🎯 Claim; wild pets (spawn + raid drop) carry 🪤 Catch; gate spawns carry 🛒 Buy (`/gate buy <id>` accepted).

## 1.0.144 — Push #96h-m: /guild sack · /xp · leaks 5× · red gates −60% · GC isolation · guild shop prices · Archer/Berserker +50%
- **/guild sack <#>** (GM/Vice; serial from /guild members): 72h notice, target DM'd. Target runs **/guild active** to cancel. Expired → CLEAN removal (members, memberData, user.guild, contract row, pending record) — no payout, no penalty, no orphans. `/guild sack` lists pending; `/guild sack cancel <#>` withdraws. Clock runs on every guild command + once a minute in the handler (DM-only notices).
- **/xp** (`!xp` works too): level, current XP / needed, bar, total XP, XP to next level.
- **Floor XP:** every floor clear pays XP scaling with floor × gate rank to every living raider, committed immediately (level-ups applied).
- **Leaked beasts:** 5× HP/ATK/DEF (silent — never stated), Regenerate 90% of turns (free support step), Domain Expansion 80% per turn (always eligible).
- **Red Gate chance** 15% → 6%.
- **GC isolation:** a raid only plays out in the GC it was opened in — raid actions typed in another group are refused, and `/attack` elsewhere is no longer treated as a raid move (the cross-GC message leak). Sack notices never post into the current chat.
- **Guild shop:** Revive Token 100,000 · Starter Pack 105,000 · Dungeon Kit 500,000 (matches /shop).
- **Archer & Berserker:** all skill damage, buffs, debuffs, heals, shields ×1.5 — applied to the contract numbers so the listed Mechanics line and engines agree.

## 1.0.143 — Push #96h-l: monster support moves are free · initiative strikes explained step by step

- **Support moves cost the beast nothing**: Regenerate, Harden, Shell, "+X% DEF" style abilities (any heal/buff-only skill) now play as a *🌀 MONSTER SUPPORT MOVE* — name → description ("Costs no turn · deals no damage") → heal/buff lines → HP → "…and it still attacks!" — followed by a real attack with a real skill. No more "Regenerate dealt 13 damage" eating the turn. Gate raids (counter, initiative, boss Regenerate — now full-force hit after the free heal), dungeons and instances.
- **Faster beasts still show their work**: the initiative strike ("lunges before X can act!") now runs the same step-by-step flow as every other move — *⚡ MONSTER STRIKES FIRST* → skill name → description → effectiveness → damage → HP bar → ability effects — instead of a one-line hit.

## 1.0.142 — Push #96h-k: every skill does exactly what its text says · listed cost = charged cost

- **The text is the contract** (all 24 classes, 480 skills). A second pass over every effect line now catches what the parser missed: "25% chance to PARALYZE", "Burns everything", "STUN + SLOW + SILENCE all" (100% each), "20% BLIND per hit" over 7 hits (→ 79%), "Fears all enemies", "+100% dodge for 1 turn", "Next attack +50% DMG", "+20% crit chance", "-40% all enemy stats 3 turns", "-25% SPEED", "Terrifies enemies -10% ATK", "+20% damage taken". ~100 skills that promised a status/buff/debuff and did nothing now deliver it. Defensive mentions ("Immune to slow/freeze", "Strips poison/burn/bleed", "+40% ATK vs bleeding") are correctly NOT statuses, whichever parser guessed them.
- **Debuffs reach gate raids** (incl. bosses — stat debuffs are not statuses) and **crit-chance buffs really raise crits** in raids, dungeons, PvP.
- **Energy honesty**: a cost written in the skill text ("• 100 energy") is the cost; no active skill is free; `/skills`, `/skills locked` and your `/class` guide list the cost you are actually charged (level discount, Starforged discount, ×2 heals for non-Healers — the Mechanics line says "(×2 for non-Healers)").
- Live hunters get the new contracts automatically (sync compares statuses/buffs/debuffs).

## 1.0.141 — Push #96h-j: one accuracy model · BLIND really cuts it · blinding beast skills · skills keep their descriptions · skills shape domains

- **Accuracy fixed everywhere** (gate raids, dungeons, instances, PvP, event): `hit% = accuracy × blind/fear × (1 ± accuracy buffs) − dodge`. Accuracy is the move's own (attack patterns) or your stat (skills, 90 default) + gear accuracy. The beast's speed edge is now **capped at −8** — a 98% move lands ~90%, not a coin flip (sped-up bosses used to force a 25% dodge regardless of accuracy). Misses say why: _🎯 missed (90% accuracy)_ · _💨 dodged (8% speed edge)_ · _🌫️ BLIND — accuracy cut to 49%_. Stunned/frozen/petrified targets are auto-hit.
- **BLIND cuts beasts too**: a blinded monster's accuracy is halved by the status table in gate, dungeon and instance engines ("🌫️ it swings wide").
- **Blinding monster skills**: one per family (Spore Cloud, Acid Mist, Dust Kick, Sand Throw, Grave Mist, Mud Spray, Stone Dust, Hellsmoke, Flash Rune, Dirt Flick). 35% of spawned beasts carry one; **bosses always do**.
- **Skills follow their descriptions**: every monster skill's text is a contract — "+40% DEF", "recovers 15% HP", "amplifies", "hardens", "blinds for 3 turns", "drains mana", "pierces armour" all become real buffs / heals / statuses (multiple buffs per skill now apply). The description outranks a guess from the name. Dungeon skill-card multipliers/effects (Rage Mode ×2.8 …) are read too.
- **A beast's skills decide its domain**: the dominant theme across its abilities names the domain, writes the lore ("Born of *Fire Bolt*"), picks the law and the status — Sea of Flames, Frozen Tomb, Venomous Mire, Field of Blades, Veil of Blindness (new law: hunters are BLINDED), Thunder Cage, Crushing Quake, Cursed Expanse, Terror Dominion, Siphon Field, Undying Ground, Armour-Breaking Zone, Binding Web. Family domains remain the fallback.

## 1.0.140 — Push #96h-i: /attack in the Events GC · reply = target · the island holds you · any message breaks AFK

- **No more `/event attack`** — in the Events GC a plain `/attack [#|@hunter] [skill]`, `/skill <skill>`, `/hit`… *is* the event attack. **Replying** to a hunter's message targets them (reply to a bot card = beast attack).
- **The island holds you**: a joined, non-AFK hunter cannot enter gate raids or dungeons (`/gateraid`, `/party join`, `/dungeon …`) — `/eventafk` first.
- **Breaking AFK = saying anything in the Events GC** (any message or command except `/eventafk`): you are announced back on the island and **auto-removed** from any gate raid (leader succession applies), solo dungeon, dungeon party or instance.

## 1.0.139 — Push #96h-g: tag-in-attack duels (20s retaliation) · full stat pool in events · every pet fights

- **Event duels reworked**: tag a hunter *inside your attack* — `/event attack @hunter [skill]`. The target gets a **20-second window** to retaliate with their own `/event attack @you [skill]`; then **both moves resolve at once** from the same starting state (double KO = no points move). No retaliation → only the attacker's move lands. The plain "@mention = strike" hook is removed. Expired windows also resolve on the next event command, so a clash can never hang.
- **Event stats read the full pool**: base + gear + title + weapon + pet for ATK/DEF/SPD/crit/HP (the raid engine already did; the event's own counters/defence now match).
- **Pets**: every pet fights. Attack pets have the strongest ATK (0.45×) and use their special skills; support pets lend a small bite (0.20×) but **heal first** — they only strike while their hunter is ≥70% HP; scavengers bite lightly (0.20×) and still scavenge. All dungeon / gate / PvP pet-strike sites pass the owner so the heal-first rule works.

## 1.0.138 — Push #96h-f: tower scales with level · late affiliates raid at once · Pro tier bonuses · Unemployed vs Self-Employed

- **Tower dungeons scale with hunter level**: level multiplier 5%/level (was 3%), level weighs 40% of party severity (was 30%), severity cap 12×. A Lv.60 hunter meets a floor several times stronger than a Lv.10 on the same floor.
- **Affiliates/members hired after a raid started raid immediately**: `/gateraid <code>` seats them in the live party (ready, battle state cleared, beasts re-calibrated to the bigger party) with a "joins the raid mid-fight" card. Outsiders are still stopped by the consumed-key rule.
- **/profaq** now shows each Pro card's currency bonus (Nexus · Mana Stones · UP) under its price.
- **Profile status**: *Self-Employed* is a Pro perk — non-Pro unguilded hunters show *Unemployed*.

## 1.0.137 — Push #96h-e: silent initiative · /guildwages

- **Initiative is silent.** A faster beast still moves first, but the card no longer compares speeds — it just reads "*Beast* lunges before *Hunter* can act!" followed by the hit; the step-by-step turn continues as before.
- **/guildwages** (`/gwages`, `/payroll`) — Guild Master / Vice only: contracted members, weekly total, everything still owed over remaining weeks, paid so far, treasury and how many weeks it covers (⚠️ when the next payday would default), next payday, per-member breakdown.

## 1.0.136 — Push #96h-d: events are generic when idle · Monster class = 100% quality · Battle Pass Premium $2 · /profaq headings

- **/einfo · /event status** with no event running now speak generically ("Astra Events") — the Jeju Island Raid is one event of many; past events are listed by name.
- **Monster class quality is always 100%** — existing Monster-class hunters are normalised on their next command (migration + `ClassPower.quality`), and `/recon @p monster` / awakening always assign 100.
- **Battle Pass Premium is $2 → 2,000 PC** (same as a Weekly Pro Card); every quote in `/bp` updated.
- **/profaq** rewritten as a clean price list + 18 perk *headings* (no spiels), with Battle Pass Premium in the card list.

## 1.0.135 — Push #96h-c: /ejoin · auto-wired event combat · tag = strike · affiliates can't join guilds · every domain multi-message · monster speed +40%

- **/ejoin** — enter the Jeju Island Raid (Events GC). The bot awakens your Lv.10 event domain (class-leaning archetype shown), then asks for a **name**, then a **description** — plain replies in the GC or DM are consumed. You must have joined to fight or be struck.
- **Event combat auto-wired**: `/event attack [#] [skill]` runs through the real raid engine (gear, weapon, title, passives, buffs, class skills, cooldowns, energy). No skill named → your strongest *ready damage* skill fires; nothing ready → basic strike. Beast counters use the real monster-damage path (your DEF/dodge count).
- **Tag = strike**: in the Events GC, simply mentioning a joined hunter attacks them (no command).
- **Stats tracked**: damage dealt/taken, skills cast, crits, domain casts, join time, kills, boss kills, hunter kills, deaths, points, spent — shown in `/estats`; `/einfo` counts only joined hunters.
- **Affiliates cannot join, create or accept a guild** (3 guild entry points guarded).
- **All Domain Expansions are multi-message** — hunter (`/domain expand`, PvP, raids, dungeons, instances) and monster/boss domains send *name → description → effect* as separate messages. Done once at the socket layer (invisible break U+2063), so every call site benefits.
- **Monster speed +40%** everywhere: gate beasts (buff and party anchor), gate bosses, tower dungeon monsters/bosses, instances, dungeon-event beasts, Jeju waves.

## 1.0.134 — Push #96h: serf iron wall · monster speed fixed · family body types · Red Gate +10 · leak ×3 · Jeju Island Raid · deeper monster domains

- **One bot DMs you — your serf.** The wall now sits at the *socket* level: any DM a non-serf bot tries to send to a hunter with a serf is forwarded through the serf socket (owners/mods and replies-in-DM exempt).
- **Monster SPEED was broken, DEF was fine.** Gate beasts rolled ~10 speed → ×3.5 ≈ 35 while hunters run 150–300, so hunters had max dodge and beasts had none; gate bosses were a flat 14–38. Beasts are now anchored to the party's average speed × rank (E 55% … S 110%) × role; bosses ×1.15 — recomputed from base, no compounding.
- **Family body types (buff only, never a reduction)** — `rpg/utils/MonsterTypes.js`: construct DEF ×1.6 HP ×1.15 · reptile DEF ×1.35 · beast SPD ×1.4 +10 crit · elf SPD ×1.3 ATK ×1.1 +15 crit · goblinoid SPD/ATK ×1.15/×1.1 · insect HP ×1.5 · slime HP ×1.6 · undead HP ×1.3 DEF ×1.15 · demon ATK ×1.3 +8 crit. Applied in gate scaling (monsters, elites, boss) and event waves; monster crit chance consumes `critBonus`.
- **Red Gates run 10 floors deeper** (built from the same theme, elite guards moved to the new boss floor). **Leaked beasts are 3×** HP/ATK/DEF (SPD ×1.5) of their habitat strength.
- **Events GC**: `/setgc events --main`. **Jeju Island Raid** (`rpg/utils/EventSystem.js`): `/event start` (owner), 10 days, waves of 100 beasts + 1 boss (boss unlocks when the 100 are dead; next wave 22% harder); beasts never auto-attack — they *counter* and regenerate 5% per 30s idle; `/event attack [#]`, `/event hit @hunter` (kill = 50% of victim points + bounty, victim → 0, 1h respawn), `/eventafk` (untouchable / can't attack), `/epoints`, `/estats`, `/eshop` (Nexus 250k/1.2M, Mana Stones 30k/150k, potions, Revive Token, random C/B/A weapons & gear, Instance Key, title), `/einfo` (full briefing: progression bar, alive-by-rank, boss state, participants active/AFK/respawning, totals, top 10, rules), `/event lb`. **Lv.10 event domain**: `/event domain name|desc` then `/event domain` in the Events GC only — 350 energy, 1h cooldown, name and description sent as separate messages; 12% burst on every beast, −20% ATK/DEF on beasts and rival hunters for 10 min, +25% own damage.
- **Monster domains have depth**: each beast *family* reshapes the domain (Hunting Grounds, Grave Dominion, Iron Sanctum, Infernal Covenant, Hive Mind Field…) and imposes a **Law** — slow (SPD −), pierce (extra DEF −), regen (beast heals per turn), drain (hunters lose energy) — on top of the rank numbers.
- **Daily quest "Activate 1 buff"** now credits *any* buff skill (Bone Wall, Battle Cry…) as well as `/buff` items.

## 1.0.133 — Push #96g: full HP pool with gear · DEF is real · domain status immunity · rank-scaled monster domains

- **HP pool = base + gear + title everywhere.** 39 heal/level/cap sites that clamped HP back to *base* maxHp (so a 1825+5557 hunter sat at 1825/7382) now use `effectiveMaxHp`. Full heals (awaken, force-clear, boxes, revive-at-30%) fill the whole pool; dungeon/party status shows the real max.
- **DEF actually matters.** PvP/UnifiedCombat: `(ATK − DEF/2)` was swamped by ×3–5 patterns → now ratio mitigation `DEF / (DEF + attacker base ATK)`, capped 70%. Dungeon (ImprovedCombat ×2, dungeon.js) and gate monster hits use the same ratio and finally count **gear + title + weapon DEF**.
- **Domain status immunity**: the owner of an ACTIVE domain (hunter, monster or boss) is immune to NEW status effects inside it — existing ones keep ticking. Hooked into StatusEffectManager, UnifiedCombat, CombatSystem, EffectParser, PartyCombo. Immunity ends when the domain fades/shatters.
- **Monster domains rebuilt & rank-scaled**: one named domain per rank (E Crushing Presence → S Realm of Ruin → SS Nightmare Expanse) with descriptions; debuff 12/16/20/26/32/40/48%, monster self-buff 10–46%, HP burst 6–24%, 2–4 turns, rank-themed status (weaken → bleed → burn → poison → curse) at 40–100% — bosses ×1.25 and +1 turn. Monster domain power raised (rank ×40, boss +90).

## 1.0.132 — Push #96f: aura farm reactions + flop penalty · aura title perks actually apply

- **/aura farm**: 50 flop + 50 success reaction lines (`rpg/data/AuraFarmLines.js`). A **flop now costs aura — 3–7× what the harvest would have paid** (floored at 0; tier drops announced).
- **Aura title perks are real** — parsed from the tier card so text and numbers can never disagree: ATK% (UnifiedCombat, ImprovedCombat, gate raids), Crit% (same three), EXP% (BattleRewards, dungeon totals via BuffManager, SilentXP, PvP), Gate Loot% (gate clear payouts), HP% (`effectiveMaxHp`), Sovereign = Domain Expansion costs half energy.

## 1.0.131 — Push #96e: daily-quest bonus for regular hunters · Pro keys from boxes · B/C weapons in boxes

- **Regular hunters**: finishing all 4 daily quests rolls a hidden 50% **Daily Bonus** — one of: 📈 1–7 UP · 💠 Nexus · 💎 Mana Stones · a D/E-Rank weapon or gear (store-grade, straight into the bag) · 🗝️ Instance Key (if a job change is open). Told clearly whether they got a bonus or *none today*. No Mending Stones in that pool.
- **Pro hunters**: Instance Keys now come **only from the Blessed/Cursed boxes** (no separate roll).
- **Pro boxes** can drop weapons: Blessed → C-Rank, Cursed → B or C-Rank (`ArmoryStore.grantRandom`).
- Box payout lines say *Nexus* (💠) correctly.

## 1.0.130 — Push #96d: Red Gates · Double Dungeons · beast leaks · tougher regen monsters · job ladder · domain DM naming · /forcequest · reply targets

- **Handicap matches give no stat bonus** — `/teampvp handicap on` only allows uneven teams.
- **Dungeon & gate monsters/bosses**: SPD ×2, DEF ×2.2, and every one of them carries 💚 *Regenerate* (soft hit, heals 15% max HP). Gate bosses regenerate on 25% of counters.
- **Domain use**: bosses 70%, B/A/S monsters 40%.
- **🟥 Red Gates (15%)**: hidden until `/party raid`; then nobody can join, leave, be kicked or flee until the gate is cleared or the party falls.
- **🌀 Double Dungeons (5%)**: after the boss falls the gate stays open — leader gets *Proceed* / *Leave* buttons (`/party proceed|leave`). Proceeding evolves the gate into a hidden-rank B/A/S dungeon (independent of the first), sealed (no join, no flee), only survivors go on, loot ×2. Clearing it gives **every survivor a Blessed/Cursed box** (`/box`, no Pro needed).
- **Beast leak (17%)**: one monster from one rank higher replaces a floor monster, announced on raid start.
- **Leader succession**: when the leader falls, the next hunter on the party list takes the crown (announced).
- **Jobs unlock in order**: only the next job on the ladder is questable (`/instance`), `/job change` refuses skips, **`/job switch <job>`** moves freely between unlocked jobs (progress kept). Hunters already deep in the ladder are grandfathered.
- **Domain naming/description in DM**: when a domain awakens the system DMs the hunter and asks for a name, then a *permanent* description — plain replies, no command. `/domain rename` costs a 🃏 Rename Card; `/domain name|desc` commands removed.
- **`/forcequest [@hunter | reply]`** (owner): instantly completes today's 4 daily quests through the normal reward flow.
- **Every tag command also accepts a reply** — shared `utils/target.js` resolver (mention → replied author → number); 15 former mention-only commands migrated.
- `/help` updated.

## 1.0.129 — Push #96c: Team PvP handicap matches · /help updated

- **`/teampvp handicap on|off`** (lobby leader): uneven teams allowed (1 v 3, 2 v 5 …). The outnumbered side gets **+15% ATK & DEF per missing hunter** for the whole match (shown in the lobby and the battle board). Without handicap, `/teampvp start` requires equal team sizes.
- `/help` and `/help teampvp` list the full team-battle command set (create · join a|b · start · handicap · switch <n> · status · leave · cancel · forfeit · record).

## 1.0.128 — Push #96b: bots stop kicking each other · real /bots roster · /version owner-only

- **Sibling bots are never moderated**: `ProGC.eligibility` now recognises our own linked bot numbers (PN + LID) → the dispatcher no longer kicks a freshly-added bot personality from the Pro GC as "not registered"; anti-link / slowmode strikes also skip sibling bots (owner-only powers unchanged).
- **/bots** shows what is actually true: 🟢 Active (answers this group) · 🟡 Here (online & in this group) · 🟠 Away (online, not in this group) · 🔴 Offline (linked, disconnected) · ⚫ Dormant — from the live health report + group participants; warns when the active bot is offline/absent.
- **/version** is owner-only.

## 1.0.127 — Push #96: Team PvP · Jobs do what they say · quest pool audit · wage count · dungeon skill parity

- **Team PvP (`/teampvp`, `rpg/utils/TeamPvp.js`)**: `create` / `join a|b` (up to 5 per side) / `start`. Fought ONE-ON-ONE with the normal duel engine (`/pvp attack`, `/pvp skill`). `switch <n>` is OPTIONAL each turn (swaps the bench hunter in; it spends that side's action). A knock-out (or surrender) brings the next hunter in automatically; last team standing wins. Every member's cumulative team record (`/teampvp record`: wins, losses, KOs, streak) is kept; winners get normal PvP rewards + Job XP. Benched fighters can't start side duels.
- **Jobs sweep (×3)** — every Job level now has a real mechanic behind its lore: Brawler Lv3 *Counter Fighter* (+15–30% on the next hit after being struck/dodging, all engines); Bounty Hunter Lv3 *Hunter's Mark* (first engaged target +10–25%); Beast Tamer bond gain ×(1.1–1.5) on feeding/playing/battling and Lv4+ rare-hatch re-roll (25–50%); Treasure Hunter Nexus bonus applied to dungeon floor Nexus and gate treasure; Brawler momentum + Storm Warden on-hit STUN + prey/elite/pack/mark multipliers now fire in PvP (`UnifiedCombat.playTurn`) and dungeons (`ImprovedCombat.executeSkill`), not only gate raids. `/job info` lists the new lines.
- **Guild wages**: the weekly daily-claim count is measured over the 7-day pay period ending at payday (was the calendar week counter, which had just reset → "1/3 claimed, wages skipped" on a 5-day streak). `daily.js` keeps the previous week's count + a 30-entry claim log.
- **Daily quest pool audit**: no floor-10 quest (Deep Diver → floor 6; gates go 3–8, dungeons 20, instance endless); floor/boss/clear quests count dungeons, gates AND instance dungeons (instance floors now report kill/boss/floor/cleared); milestone labels match the rewards; live players holding an out-of-date quest copy are migrated in place (7/6 → completes).
- **Dungeon skills = PvP skills**: the dungeon skill path now applies the catalog contract exactly like the duel: structured statuses (same chance, Enchanter bonus), move buffs/debuffs/self-debuffs, WEAKEN / damage-taken debuffs, defender DEF buffs, job target multipliers, passive lifesteal.

## 1.0.126 — Push #95: Jobs · Domains · Instance dungeons · Pro boxes · /giveup · monster skills that do what they say

- **Jobs (`rpg/utils/JobSystem.js`, `/job`)**: 20 Jobs unlock at Lv.5…100 (Wolf Assassin → Shadow Monarch), each with 5 named Job Levels. Job XP from every raid / dungeon / PvP / instance win (auto level-up announced). Perks are real numbers: injected into `ClassPower.passiveMultipliers` (atk/def/spd/crit/dodge/dmg-taken/skill dmg/lifesteal/armour pierce/reflect/heal power/regen/on-hit stun/survive-lethal) and hooked where it matters — prey/elite/pack/shield-break multipliers in raids, PvP and dungeons; pet power & support heals (Beast Tamer/King); gear (Blacksmith/Enchanter) and artifact (Relic Hunter) bonuses; loot chance + rare upgrade (Treasure/Relic Hunter); XP & reward multipliers (Dungeon Delver / Bounty Hunter); potion strength & crafting discounts (Alchemist…); energy discount (Starforged); CC resist (Brawler), fear immunity (Beast King), durability saves (Blacksmith). Profile shows Class / Job Lv / Level.
- **Job Change Quests (`rpg/utils/InstanceDungeon.js`, `/instance`, DM only)**: taking or changing a job needs an *Instance Key* (10% on finishing all 4 daily quests, only if a job change is open to you, bound — not tradeable). The instance is an endless DM dungeon scaled to the hunter; every 5th floor a boss (+1 UP); reach the job's target floor (5 + job index) to clear; keep climbing for Mana Stones + Job XP. Monsters use the real ability contract, domains work inside.
- **Pro daily boxes (`/box`)**: Pro hunters choose ✨ Blessed (Mana Stones, UP, Mending Stones, potions, revive, key chance, full heal) or 🖤 Cursed (dark jackpots, rare materials, keys… or a bite) via DM buttons after all 4 dailies.
- **Domains (`rpg/utils/DomainSystem.js`, `/domain`)**: every hunter awakens ONE random, permanent domain of their class at Lv.20 (250 named effects: 25 classes × 10; DM for Pro, GC otherwise; existing Lv.20+ hunters awaken on their next command). Lv.1→100 with UP (10 → Lv.2, 15 → Lv.3, +5/level); `/domain expand` costs 350 energy, 2 turns at Lv.1 (+1 per 20 levels), buffs the whole party / debuffs every foe through `tempBuffs` so raids, dungeons, instances and PvP all honour it; `/domain name|desc|upgrade|effects`. One domain per arena — clash: monster↔hunter stronger power wins, hunter↔hunter class quality first then power. **All bosses and rank-B+ monsters** (raid, dungeon, instance) may expand devastating domains (ATK/DEF down, damage taken up, HP burst, status).
- **`/giveup @hunter <n>`**: share Upgrade Points, 20 UP per hunter per day.
- **Monster skills act per description (`rpg/utils/MonsterSkillFX.js`)**: Mana Drain really drains energy, Soul/Life Drain heals the monster, Roars buff ATK (+fear), Shells buff DEF, pierce ignores DEF, burn/poison/bleed/stun/freeze/paralyze/curse/slow/blind… apply with class/gear/job defences — in dungeon monster turns (which previously applied NO status at all), raid counter-attacks and instances. Monster `tempBuffs` (roars, domains) are now read by raid/dungeon damage maths and tick down per round; hunter `damageTaken`/DEF buffs count against monsters everywhere.
- Handler: `/instance`, `/box`, `/domain`, `/job`, `/use` allowed in DM for registered hunters. Tests: `test_push88.js` 370/370.

## 1.0.125 — Push #94b: potions respect gear-boosted max HP

- `/use` health potions: "HP already full" check and heal % now use the same gear-boosted max HP the message shows (587/1003 no longer counts as full). Same fix in `/equip` tiered potions.

## 1.0.124 — Push #94: every skill unique & honest · /recon monster · /bleep level floor

- **500 skills, 25 classes — every description unique.** New `SkillFlavour` generator: imagery drawn from the skill's name, class voice, per-type sentence structures, tier notes; deterministic and distinct for all 500 (hand-written emoji descriptions kept). Zero template stamps remain.
- **Skills do what they say.** `SkillCatalog.normalise` now parses an explicit support contract from the text — `shieldPct` (pool or per-hit rate), `immuneTurns`, `energyPct`, `regen {pct,turns}`, `damageTakenPct`, `reflectPct`, `cleanse`, `party` — and appends an exact "Mechanics:" sentence. `applySupportFields` applies it in raids (support casts + hybrid strikes), PvP, dungeons; regen ticks in `UnifiedCombat.tickStatuses`; reflect hits back in raids and duels; immunity = unbreakable shield. Party-worded BUFFS reach the whole party for any class; "+X% ATK/DEF" buffs both stats; "All stats up" = ATK/DEF/SPEED +25%.
- **Retyped:** Iron Wall, Divine Shield, Divine Protection, Blessing of Kings, Dragon Scale etc. are buffs now (no more "strike" that was supposed to shield). False immunities ("immune to BLEED/CC/elements") no longer count.
- **/recon @p monster** — no quality needed; assigns a Monster variant nobody else holds; refuses when all 50 are taken. Natural awakenings also prefer unclaimed variants.
- **/bleep** — true recalibration: pure stats (rank base + level growth, no upgrade points/class bonuses) are SET to the new rank's floor at the hunter's level, up OR down (demotion works); class bonuses + upgrade-point allocations re-applied on top. Mana/UP bonuses only on promotion.
- Live hunters' stored skills refresh when description/type changes.

## 1.0.123 — Push #93: Necromancer reforged (2026-09-29)
- Bone Wall: absorbs 60% of every monster hit for 3 turns (pool 60% max HP). Targets scale with the raid floor (1→1 … 4→4, tag with @); floor 7+ untagged = whole raid (100 energy, CD 4). Tagged: 10 energy × targets, CD 1 + 1/target. Shields now really absorb everywhere (raids, idle strikes, PvP).
- Soul Drain: on a monster 150% ATK + heals half the damage. On an @ally ("Tithe of the Fallen"): drains 25% (+3%/level) of their current HP, heals the Necromancer, STEALS all their positive buffs; ally ≤15% HP is sacrificed (falls); Bone Wall on the ally eats 60% of the drain.
- Life Drain → Curse of Ruin: 100 energy, 200% ATK, no heal; target ATK −70% and takes +70% damage for 3 rounds (works on bosses; boss statuses now tick). Existing Necromancers keep skill levels.

## 1.0.122 — Push #92c (2026-09-29)
- Speed: PvP inter-bubble delay 3–5 s → 0.7–1.2 s; a send on a dying socket times out after 20 s (was 60 s) and the inbound command timeout is 45 s (was 90 s) so one stuck message no longer stalls a player's queue.
- Bad MAC awareness: undecryptable (CIPHERTEXT) messages are remembered per sender/chat for 2 min. While a bot cannot hear a raider/duelist: no gate-raid idle strike, no berserk auto-turn, and PvP 20 s turn timers pause (up to 5 min) instead of skipping anyone.

## 1.0.121 — Push #92b (2026-09-29)
- Transformation drawbacks (weaken 10 / stun 2 / bleed 7) verified on all 50 Monster variants; they and every status/buff/cooldown are wiped at the start AND end of every raid, dungeon and PvP duel — nothing carries over.
- Affiliate: a hunter can hold official affiliate status with ONE guild at a time (grant and accept both refuse; the current guild must strip first).

## 1.0.120 — Push #92 (2026-09-29)
- Gate raids: a STUNNED/FROZEN/PARALYZED monster's idle strike is thwarted (status −1 turn); idle timer resets on /party advance, boss, heals and missed/dodged attacks; an active guard absorbs the idle strike.
- CombatReset: status effects, temp buffs, recoils and cooldowns never carry into the next battle (raids + dungeons, all hunters).
- Class weapons are BOUGHT (/class weapons buy): Lv10 25k · 20 60k · 30 150k · 40 350k · 50 750k Nexus; starter free; held weapons grandfathered.
- 50 Monster variants each get their own 20-skill roster (element procs) and natural-weapon ladder; live Monsters migrate slot-for-slot with levels kept.
- Pack rule: 2+ Monsters on a team → surge chance −50%, joint PACK RAMPAGE with +25% combo ATK.
- Dead hunters can no longer be re-affiliated into a battle.

## v1.0.119 — Push #91b
- Global spawn back to once every **24h**; Pro GC spawn stays every **3h**. Epic-material pool change from #91 kept.

## v1.0.118 — Push #91
- Spawns: EVERY epic crafting material can now drop as a single epic spawn (the whole Epic recipe pool + Dragon Scale, weighted by recipe demand) — never just Dragon Scale. Global spawn now every **3 hours** (was 24h); Pro GC spawn every 3h (was 5h). Global pick: 20% Mending Stone · 20% epic material · 60% material cache.
- Scavenger pets: hard cap **40,000 Nexus** per dig (was uncapped — 144k seen).
- Ranger Snare Trap stun chance 60% → **75%**.
- Healer `Renew` / `Mass Renewal` now really restore their stated % energy (the "15% of max energy" wording was not parsed).
- **Healer backlash:** healing ANOTHER hunter costs the Healer HP — 12% max HP for a single ally, 8% + 0.4%/heal-% for party heals (never below 1 HP). Skill level cuts it: Lv2 −20% · Lv3 −40% · Lv4 −60% · Lv5 −80%. Self-heals free. Healing a hunter under **10% HP** STUNS the Healer for 1 turn. Shown in /skills (upgrade + info now show backlash reduction instead of DMG for Healer heals), /class guide, AI knowledge. New `rpg/utils/HealerBacklash.js`.
- Energy potions scrapped everywhere: dungeon shop, dungeon loot + boss loot, /equip use, friend gifts, /inventory /items /find /cooldowns /shop inv listings, battle item menu, starter kit, party shared list.

## v1.0.117 — Push #90 (Guild War rewards ×10 + GP boosts)
- Victory cards ×10: Gold 150,000 💠 + 30,000 💎 · Silver 100,000 💠 + 20,000 💎 · Bronze 50,000 💠 + 20,000 💎. Weekly MVP 200,000 💠 (undo reverts the same).
- NEW GP BOOST on card use: Gold ×2 / Silver ×1.5 / Bronze ×1.25 GP for 3 days — applies to every positive GP gain through the central ledger (`GuildPointsSystem.addGuildGP`). Stronger boost replaces weaker; same tier extends; weaker never downgrades. Shown in `/guildwar` (⚡ line) and on the card-use receipt.
- Card use now really grants the advertised EXP buff (3 fights).
- Weekly winners card now lists the prizes and is posted to every announcements GC (announceGC, legacy announcementGC, community main, main guild GC).
- Reward text updated everywhere: /guildwar, /use menu, /inventory, history/undo, AI knowledge. New `rpg/utils/GuildWarRewards.js` is the single source of truth.

## v1.0.116 — Push #89c
- `/announce` is now MOD-level (any bot mod or owner, from DM).
- `/mute` and `/unmute` are now GROUP-ADMIN commands: any admin of the group can use them (bot mods/owners still can too). Bot must still be a group admin to delete muted messages. Removed dead duplicate `commands/rpg/admin/mute.js`.

## v1.0.115 — Push #89b
- `/recycle` is now open to EVERYONE (free hunters type `/recycle <material>` / `... confirm 1|max`); 💎 PRO hunters get tap buttons instead. Scroll-read hint updated.

## 1.0.114 — Push #89 (2026-09-28)
- NEW `/recycle` (PRO, buttons): turns 3 UNWANTED crafting materials of the same gate rank into 1 material a scroll recipe still needs. Costs Nexus per output (E 500 · D 1.5k · C 4k · B 10k · A 25k · S 60k). Bare `/recycle` lists what your un-crafted scrolls lack with tap buttons; picking one shows the plan (Make 1 / Make max / Cancel). Scroll reads mention it.
- BOSS PARTY: the 2 elite soldiers no longer gate the boss fight — they are the boss's party. `/party boss` opens once the normal floor monsters are down; every living elite strikes beside the boss each round (never lethal on its own); they fall with the boss (no rewards) or can be thinned first with `/party attack`. Status shows the boss party.
- A–E gates: monsters AND boss −25% (S+ untouched).
- Idle auto-attack window by gate rank: S 30s · A 45s · B 60s · C 90s · D 120s · E 150s.
- DEFENCE FIX: one `effectiveDef` for every monster hit (initiative, counter, guard, boss, idle strike) = base + weapon + equipped gear + equipped TITLE + pet + temp DEF buffs — guards used to be resolved without title/pet and titles were never counted. DEF now soaks 1:1 (was 0.5), still capped at 60% of the hit: vs a 500-ATK boss, 130 DEF ≈370 dmg, 200 DEF ≈300 dmg. Tower monster hits count title + weapon DEF too.

## 1.0.113 — Push #88z (2026-09-27)
- ELITE SOLDIERS on every boss floor: gate raids (last floor) AND every tower boss floor (5/10/15/20) are guarded by 2 elites before the boss. Elites have exactly 2× the stats (HP/ATK/DEF/SPD) of the monsters on the floor before them — re-pinned after every scaling pass — and use NO skills/abilities (no status effects).
- Tower boss floors now run a queue: elite → elite → boss; kills pop the next guard instead of opening the floor.
- All monsters (gates, tower, bosses): DEF +75% and SPEED +75% on top of the existing buffs.

## 1.0.112 — Push #88y (2026-09-27)
- Monsters are ALWAYS a named variant: anyone whose class was the bare word "Monster" gets a variant rolled on sight (class guide, /stats, skill roster, minute sweep). `/class` and `/stats` show "Variant: *Acid Mantis* (Monster)" with the variant's lore, never "Class: Monster".
- `/class` guide for Monsters lists the full TRANSFORMATIONS ladder (🔓/🔒 per level, ×mult and turns, variant-named), the aftermath, the innate surge (47% BERSERK below Lv.10 / 8% from Lv.10) and the cast example.
- Monster awakening is corruption-themed ("YOUR MANA IS CORRUPTED", "Corrupted Form") instead of the hunter "mana veins burst open" text; announcement mentions the transformation ladder.
- Floor revive: /party advance and /party boss stay blocked until every revived monster on the floor is down (verified + tested).

## 1.0.111 — Push #88x (2026-09-27)
- Transformation aftermath: when ANY transformation ends (cast or passive) the hunter suffers WEAKEN 10 turns, STUN 2 turns and BLEED 7 turns. Upgrading to a stronger form applies no aftermath.
- BERSERK: Monster hunters below Lv.10 surge passively with a 47%/turn chance (Lv.10+ keep the 8% controlled surge). A berserk hunter cannot command their body — in gate raids the bot plays their turns automatically every ~12 s (random equipped attack pattern or unlocked damage skill through the real /party flow, teammates locked out during the strike); in PvP and dungeons their chosen move is replaced by the beast's pick. With nothing left to attack the rage burns down one turn per tick.

## 1.0.110 — Push #88w (2026-09-27)
- Scavenger pets: loot cut by 70% (bonus Nexus and item-find chance).
- MONSTER TRANSFORMATIONS: the Lv.10/20/30/40/50/60 slots of every Monster variant are now Quarter (×5, 3t), Complete Quarter (×5, 10t), Half (×10, 3t), Complete Half (×10, 10t), Full (×15, 3t), Complete Full (×15, 10t) Transformation — named with the variant ("Half Transformation: Blood Bat"). ALL stats (ATK/DEF/SPD/HP) are multiplied for the duration; works in gate raids, dungeons and PvP. Stronger form upgrades a weaker one; equal/weaker refused. All other Monster skills are unchanged.
- Innate Monster trait: on any combat turn a Monster-class hunter may surge into a random Quarter Transformation (~8%/turn) — no skill slot, uncontrollable.
- Safety: a transformation ends after its turns, and never outlives 20 minutes (per-minute sweep).
- Floor revive: a cleared gate floor nobody advances from within 60 s REVIVES — every monster returns at +30% (stacking on each revive), and revived monsters give NO rewards (no Nexus/EXP, drops, pet XP or treasure). Engaging the boss counts as moving on.
- Fallen hunters: a hunter cut down in a raid is recorded and cannot re-enter through affiliation or /party join. Only a Revive Token (/party revive [@fallen] or /revive) or a Healer revive skill (@fallen) brings them back (50% HP, re-added to the party). Revive tokens/skills are refused on hunters who have not fallen.

## 1.0.109 — Push #88v (2026-09-27)
- Outputs never mention the co-owner: every 'Owner / Co-Owner only' style message now says 'Owner only'. `/mods` hidden co-owner tag restored.

## 1.0.108 — Push #88u (2026-09-27)
- Idle gate strikes NEVER fire from a deaf bot: before striking, the bot must have decrypted a message in that chat within 90 s (or anything within 60 s, with no Bad-MAC storm). Otherwise the idle clock simply restarts. Strike text shows the real window (30 s S / 45 s others).
- Bad-MAC storm (≥40 decrypt failures/min): the socket that has heard nothing for 60 s+ is recycled (2 min gap).
- `/spawn` (bare) now DMs the owner/co-owner the full spawn catalog (potions, pet foods, caches, epic materials, every pet by rarity). Forced random spawn is `/spawn force`.

## 1.0.107 — Push #88t (2026-09-27)
- Silent bots: FAST deaf cross-check — every bot in a group must see every group message; a connected bot that misses 2+ messages another bot decrypted (>45 s) is recycled immediately (was up to 4 min of silence; slow rule now 3 min). Max 2 fast recycles / 30 min per bot.
- Raid initiative FIX: only a genuinely FASTER monster can strike first (0% at equal/lower speed, +4%/SPD point, cap 80%); an initiative strike IS the monster's action for that turn — no second counter-attack (and no double crit).
- Support pets now heal on the kill turn too in gate raids (they only healed when the monster survived).
- `/bug` reports go to BOTH owner and co-owner; the co-owner is never @mentioned in outputs (`/mods` hidden tag removed).
- Ranger Snare Trap: stun chance 100% → 60%.
- Gate raids: every ALIVE member gets general EXP on monster/boss defeats; the last hit still takes loot + aura + Astra Pass. Gate aura gain cut by 50%.
- Idle strike: 30 s in S/SS gates, 45 s in every other rank.
- Gate monsters are THEMED per gate (insect / beast / goblinoid / undead / reptile / construct / demon / elf / slime): the theme is rolled first, the boss matches it (from the boss table or the family's apex monster is crowned), and no other family leaks in — no ants in Lycan dens. Boss floor gets 2 ELITE SOLDIERS (×1.5). Within each floor monsters are fought weakest → strongest.

## 1.0.106 — Push #88s (2026-09-26)
- `/spawn` is now owner/co-owner only. `/spawn pet <name|rarity>` picks the exact pet by name; the spawner's `/catch` is free (no Nexus/Mana Stones, no Luck Potion used) and guaranteed.

## 1.0.105 — Push #88r (2026-09-26)
- AFK: messages in the announcements GC (`/setspace` group) no longer end AFK or count as activity for auto-AFK.

## 1.0.104 — Push #88q (2026-09-26)
- Contracts/wages FIX: contracts are found across a hunter's lid/phone identities (Baileys `participantAlt` pairs are remembered in `db.lidMap`); a Guild Master can now re-offer a member (`/guild hire @member …` → member `/guild accept`) to CHANGE the wage — `/contract` and `/wages` show the current terms (pay history kept). Before, members got "already in a guild" and the first-ever terms stuck.
- Silent bots: lonely-deaf rule — a connected bot with no fresh inbound for 12 min and no peer to compare against sends a wake nudge (presence + note to its own chat); still deaf at 25 min → socket recycled (creds kept). NOTE: Kira/Seraph/Mikasa/Killua are being refused by WhatsApp with code 403 (account block) — not fixable in code.
- Raid monsters ×2: ATK ×3.4 / DEF ×2.8 (2× on top of #88n), crit chance ×2 (cap 50%), crit damage ×3.0, status-effect chance ×2 (cap 90%). Tower/dungeon monsters unchanged.
- Raid SPEED/INITIATIVE: a faster raid monster can strike before the hunter's move (35% at equal speed, ±1.5%/SPD point, 10–80%); the opening hit is 60% force and never kills outright. Bosses now carry a speed stat.
- S-rank party raids: 30 s after the last action with no attack, the monster/boss strikes the WEAKEST member (repeats every 30 s of silence; can kill → 15% stones, removed from raid; last member → wipe).
- Healer: every non-passive Healer skill is a support cast — 0 damage in PvP (World Heal / Transcendent Light were typed `damage`).
- S-rank gates in public GCs: at most one every 3 days (rerolled to A otherwise). Pro GC unaffected.
- Pro durability: warning when a piece drops below 5; AUTO-MEND (default ON, `/mend auto off`) repairs it to 100% with a Mending Stone on the spot.
- Pro GC 5-hour spawn diversified (was effectively Dragon Scale only): Mending Stone 20% · health potions 25% · pet food 15% · material caches 30% · epic material 10%.
- `/spawn` (mods): forced diversified spawn; `/spawn potion|food|materials|mending`; `/spawn pet [rarity|name]` → wild pet only the spawner can `/catch` (60 s).
- Pro daily Mending Stone chance 80% → 50%. Party-wipe salvage 50% → 10%.
- `/prousers` tags fixed (lid identities were forced to phone JIDs → dead "+1 94592…" tags). `/stats` passives rounded (no 15.3999999%).

## 1.0.103 — Push #88p (2026-09-26)
- Class shortcuts: `/cast` (Mage) and `/summon` (Summoner) are now real commands that route into the class skill system (menu, live combat). Other classes get the usual "that's the X class command, yours is /…" redirect.
- Gacha parked: the multi-banner summon moved to `rpg/legacy/summon_gacha.js` (to be refined later). Summon tickets are no longer sold (shop/guild shop/bundle 4 → 250 stones); existing tickets kept. Summon quests removed from daily/weekly pools (weekly `summon_20` → "Full-clear 6 dungeons"; ticket rewards → +60 stones). Old "/summon to pull" hints updated.
- Class skill descriptions: new `describeSkill()` — every skill of every class (107 class-file skills, full rosters) now shows its real lore + effect in `/class`, `/class <name>` and `/skills info`; the generic "A powerful combat ability" stub is gone from the guides.
- Shop: potion/bundle prices show `💠` Nexus instead of a stray "g" (also market, title shop, dungeon shop, weekly reward text). "Buy 50 crystals with gold" → Mana Stones/Nexus wording.
- Trade FIX: Mana Stone trades were written to a dead `inventory.manaCrystals` mirror, so the ledger said "+200,000 💎" but `/balance` never changed. Trades now move the real `manaCrystals`/`gold` balances (and check funds against them). Stone fees go to the owner's real stone balance.
- Trade UX: `/trade offer @user 500 nexus|stones` (aliases: nx/gold, crystals/mana/stones), @mention or reply works, amounts formatted, labels say Nexus / Mana Stones.

## 1.0.102 — Push #88o (2026-09-25)
- Monsters: HP +50% (on top of the ATK +70% / DEF +40%); level/floor scaling intact. Dungeon floors, bosses, gate raids, template monsters.
- Monsters can CRIT (10% base, +2% per rank above E, +5% bosses, ×1.5) — raids, tower counter-attacks and monster turns show 💥 CRITICAL HIT.
- Monsters can DODGE hunter strikes (4–25%, speed edge vs the hunter; stunned/frozen monsters never dodge) — basic strikes, class skills and attack patterns in raids and tower.
- A move that misses or is dodged still enters cooldown (and still costs energy).

## 1.0.101 — Push #88n (2026-09-25)
- Commands run in parallel per player: the inbound queue is now keyed per (chat, sender) instead of per chat, so one player's multi-part output no longer makes everyone else wait. Order per player is preserved.
- Party dungeons: turn lock — if two hunters act at once, one plays and the other is told immediately "X's turn is still playing out". Same player re-entering mid-flow is blocked too. (Gate raids already had this.)
- All monsters: ATK +70%, DEF +40% (dungeon floors, dungeon bosses, gate raid monsters + bosses, template monsters). Level/floor/severity scaling untouched.

## 1.0.100 — Push #88m (2026-09-25)
- Auto-AFK: the timer starts at the player's last message (so it reads 30m+ when broken); reason defaults to "AFK" or the player's own default.
- /afk default <message> (Pro): sets the message auto-AFK uses. /afk default shows it; /afk default clear removes it.
- /gtag <message>: hidden tag of every guild member (Guild Master, Vice GMs, Officers). Shows only your text; everyone is notified.

## 1.0.99 — Push #88L (2026-09-25)
- ROOT CAUSE of "players lose data on every redeploy": boot picked the store with the MOST users (count first, time second). Any deletion/reset — or stub records inflating the Mongo mirror — made a STALE mirror "fuller" than the live SQLite store, so each boot rolled everyone back to the mirror's age; the divergence guard then refused to refresh the mirror, so it repeated every boot. New rule: among healthy stores (players > 0 and ≥ 80% of the largest count) the NEWEST save wins; SQLite wins ties; the other stores are reseeded from the chosen truth. Mirror/sync guards now only refuse a gutted memory (0 users or a >25% shrink), so legit deletions no longer freeze the mirror.
- /guild force master @player (owner/co-owner): forces the tagged player to Guild Master of their own guild; previous master becomes a Member. Reflected in guild.leader, member ranks, memberData, officers and player records.

## 1.0.98 — Push #88k (2026-09-25)
- /prostore stones <pc>: PC → Mana Stones packs — 1000→500k, 2000→1M, 3000→1.7M, 4000→3M, 5000→4M (listed in the store menu).
- /silence @mod [minutes]|[reason] (owner/co-owner only): the mod can only use moderation commands until it expires or /unsilence. Non-mods and owners can't be silenced.
- /extract @player N|M <amount|all> (owner/co-owner only): pulls Nexus (N) or Mana Stones (M) out of a player's bank account into your wallet.

## 1.0.97 — Push #88j (2026-09-25)
- /rob on the Owner or Co-Owner: the thief loses 50% of their TOTAL Nexus (wallet first, then bank account) to them — with a named call-out ("You actually tried to rob Naruto?! lol").
- AFK: all durations (welcome-back, mention notice, /cooldowns) shown in hours/minutes/seconds.
- Pro auto-AFK: a Pro player who has sent nothing in any group for 30 minutes silently enters AFK (timer starts at the 30-minute mark, no entry announcement); the usual welcome-back fires when they speak. Auto-AFK never expires on its own.
- Boot safety (#88i): no DB write is possible before the boot load completes; /api/snapshots + /api/restore.

## 1.0.96 — Push #88h (2026-09-25)
- ROOT CAUSE of the blank-bubble storms (dozens of empty Mikasa messages, worst right after /restart): when a phone can't decrypt a message it sends a retry receipt and Baileys asks `getMessage()` for the original to resend — ours returned `{ conversation: '' }`, so every retry receipt shipped an EMPTY message (one blank bubble per retry per device). Baileys' own retry cache only lasts 5 min and is empty after a restart, which is why restarts triggered floods. Fix: a real sent-message store (last 3000 protos / 2h, persisted to auth/sent-protos.json across restarts) backs `getMessage`; unknown ids return nothing so Baileys skips the resend instead of inventing a blank one.

## 1.0.95 — Push #88f (2026-09-25)
- Raids/dungeons: monster aggro ONLY targets the Healer class and only after an actual heal; stale aggro on non-Healers is discarded.
- PvP: heal/buff skills are support casts in duels too (heal/buff/cleanse self, NO damage) — same as dungeons. Statuses, temp buffs and pattern/skill cooldowns are cleared when a duel ends (5-turn stuns no longer follow you into the next match; cooldowns reset). PvP can't be started while either player is in a raid/dungeon; raids can't be entered/joined mid-duel.
- Guild Shop: 1 unit of each item per player per day. Stat Orbs (Power Ring etc.) are now truly permanent — written to baseStats so the stat recompute keeps them.
- Locked profiles (Pro): /stats @, /balance @, /rank @, /transactions @ are private too (owner + staff only). Lock is ignored once Pro lapses.
- ProGuard: when a Pro sub expires ALL perks are stripped (profile lock, custom reaction emoji, pro flags) — per command and boot sweep.
- /send to an unregistered number is BLOCKED ("This player isn't registered") — no more auto-registering strangers.
- /recon carries skill progress: same number of unlocked skills and the same levels positionally (old #1 Lv5 → new #1 Lv5).
- Spawns: material caches are built from the recipe book (3 distinct materials, weighted by recipe demand; common/rare/epic tiers) — no more Dragon-Scale-only; spawn announcement is ONE message with the ping merged in; daily item spawner uses the same pool.
- /attacks sell shows ✅ Sell / ❌ Keep confirmation buttons.
- Fixes: profile "SKILLS (18 total)" now counts owned skills (bar + library) with locked shown separately; HP can never exceed the current effective max (867/811 card).
- test_push88: 121/121.
- FIX (root cause): boot normalization (potion/pet-food cap to 3, Pro-lapse sweep, player migrations, orphan cleanup) only ran for the JSON-file DB path — the live SQLite doc path skipped it entirely, so the cap never applied. All DB sources now run the same boot block; the cap applies on this deploy.
- /restart: old socket is fully torn down (listeners off, ws closed, 1.5s beat) before the new one connects, and a freshly opened socket waits 4s before its first group sends — fixes the empty bubbles seen right after `/restart <bot>`. Build SHA now read from VERSION (was `unknown`).
- /burnkey restore <KEY> | @player: undo a burn — key returns live with its remaining stability (min 30m), gate record + dungeon GC hold restored. Keys whose raid already completed can't be restored.
- Ops: /api/logs ring 3000 lines, /api/sends ring 4000 entries (was 400/600 — too short to trace issues after the fact).

## 1.0.94 — Push #88d/#88e (2026-09-24)
- Gate raids no longer drop Health Potions or Pet Food; tower dungeon floor/boss loot no longer drops Health Potions (shop-only).
- Health potions are 3 separate inventory lines: Lower (10%, common) / Medium (25%, rare) / Higher (50%, EPIC). Legacy double-counter collapsed; buy/use keep tiers in sync.
- Revive Token → 100,000 Nexus (bundles repriced so they no longer undercut it: Starter 105k, Dungeon Kit 500k, Mega Pack 1M).
- /upgrade reset → flat 200,000 Nexus.
- One-shot at boot: every player's health potions (each tier), energy potions and each pet-food type capped to 3 units.
- Healing rules: only the Healer class can heal a teammate or the party. Every other class heals SELF ONLY and pays 2x energy for it (@teammate is refused). Party/AOE heals need a Healer of quality ≥70 and cost the caster HP scaling with heal power (8% + 0.4×heal% of max HP, cap 60%; refused if it would kill). Berserker Last Breath no longer heals the party ("removes all buffs" was matching the party wording).
- /attacks sell <#> [confirm]: sell a pattern back to the attack shop for 10% of what you paid (90% loss). Purchases now record the paid price.
- PvP: FROZEN / STUNNED / PARALYZED hunters are auto-skipped at round start (no 20s wait, cannot lock a move); attack patterns on cooldown are refused at lock-in instead of silently skipping the turn; statuses now tick once per fighter per round (double tick was expiring a 2-turn freeze before the frozen player's turn).
- /skills: duplicate skills are impossible — sync collapses any duplicate across bar + library (highest level kept); equip/swap refuse an already-equipped skill.
- Knight Last Stand (shield stance) now buffs DEF +80% (was ATK). Healer buffs verified end-to-end (Blessed Shield, Sanctuary Mastery DEF, Solar Brilliance ATK).
- test_push88: 94/94.

## 1.0.93 — Push #88c (2026-09-23)
- Skill typing fix: any skill whose text states no real ATK%/damage but heals, cleanses, shields or buffs is now typed heal/buff (Purify, Dominion, Blood Frenzy, Iron Defense, Aura of Light, Solar Brilliance…). Support skills route to the free support cast in gates + tower dungeons (heal/cleanse/buff self or @teammate, no turn used, monster does not counter). "+60% ATK" is no longer mistaken for a damage multiplier. Monster 'Devour' (160% ATK) corrected to damage.
- /mend all: ONE stone is shared evenly across every damaged item (10 items → +10% durability each). /mend <#> still = one item to 100%.
- /buff: new "COMBAT STAT BOOSTS (from skills)" section — each active temp buff with % and turns left.
- Poison Arrow etc.: verified 60% roll applies in gate + tower paths (not 100% by design; description says 60%).

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
