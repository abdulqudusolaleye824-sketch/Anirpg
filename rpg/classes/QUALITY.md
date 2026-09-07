# Class Quality — Official Specification

> Version 1.0 · 2026-07-24
> Owner: AniRPG core team
> Applies to: All classes in `rpg/classes/*` (24 total + 50 monster variants)

---

## 1. What is Class Quality?

**Class Quality** is a permanent integer from **1 to 100** that represents how
"pure" or "lucky" a hunter's class awakening was. It is the **single multiplier
applied to every benefit a class grants** — stat bonuses, skill potency, and
narrative flavor — scaling them linearly from 1% (almost no benefit) to 100%
(full benefit from the class definition).

| Quality | What it means                                    | Example (Senku, max ATK = 75) |
| ------- | ------------------------------------------------ | ----------------------------- |
| 1       | Almost a failed awakening. Barely any bonus.     | +1 ATK                        |
| 25      | A weak manifestation. Notable gaps remain.       | +19 ATK                       |
| 50      | The baseline. Half the class's potential.        | +38 ATK                       |
| 75      | A strong awakening. Above the average.           | +56 ATK                       |
| 100     | Perfect. The full power of the class.             | +75 ATK                       |

**Quality is rolled ONCE at class awakening** and is **permanent for the
character**. It cannot be re-rolled, increased, or decreased through any
in-game mechanic (this is by design — see §6 for future plans).

---

## 2. The Formula

For any numeric bonus `max` in a class definition (e.g. `maxBonuses.atk`):

```
finalBonus = floor(max × quality / 100)
```

The same formula applies to skill `maxPotency`:

```
finalPotency = floor(maxPotency × quality / 100)
```

The resulting value is used in skill descriptions too. For example, a skill
with `desc: "Deals {p}% ATK"` and `maxPotency: 200` at quality 75 would
show the player **"Deals 150% ATK"** (since `floor(200 × 75 / 100) = 150`).

---

## 3. How is Quality Rolled?

At class awakening, exactly one roll:

```js
const quality = 1 + Math.floor(Math.random() * 100);  // ∈ [1, 100]
```

**Distribution is uniform** — every value from 1 to 100 has a 1% chance.

> Note: future variants may add weighted distributions (e.g. pity system
> guaranteeing ≥50 after N awakenings). See §6.

---

## 4. Display Conventions

Class quality is shown to players in three ways:

### 4.1 Stars (compact)
Every 10 quality points = 1 star, displayed as filled (★) or empty (☆):

| Quality | Display              |
| ------- | -------------------- |
| 100     | ★★★★★               |
| 90      | ★★★★☆               |
| 75      | ★★★★☆  (rounded up)  |
| 50      | ★★★☆☆               |
| 25      | ★★☆☆☆               |
| 1       | ☆☆☆☆☆               |

> Implementation hint: round to nearest 10, clamp to [0, 5].

### 4.2 Tier label (descriptive)
Used for menus, achievements, and `/profile`:

| Range    | Label      | Emoji |
| -------- | ---------- | ----- |
| 1–29     | Common     | ⚪    |
| 30–49    | Uncommon   | 🟢    |
| 50–69    | Rare       | 🔵    |
| 70–84    | Epic       | 🟣    |
| 85–94    | Legendary  | 💎    |
| 95–100   | Mythic     | ✨    |

### 4.3 Numeric (always)
Show the exact percentage alongside the label:

```
Senku  ·  Quality 87%  ·  Legendary 💎
```

---

## 5. What Quality Does NOT Affect

To keep the system simple and balanced, quality does **not** affect:

- **Class identity** (you still get Senku's skills, not Mage's)
- **Class rarity** (a Common-quality Senku is still divine-tier)
- **Number of skills** (you always get all of the class's skills)
- **Skill names or effects** (only their potency scales)
- **Awakening XP threshold** (unrelated)
- **Player level** (unrelated)

---

## 6. Future Considerations (Out of Scope Today)

These are **not** implemented yet, but the spec leaves room for them:

1. **Pity system** — guarantee ≥50 quality after a configurable number of
   re-awakenings. Would require a `/reawaken` command and `reawakenCount` field.
2. **Quality improvement items** — e.g. "Tome of Mastery" +5 quality, capped
   at 100. Would require an items system extension.
3. **Visual flair for high quality** — e.g. glow effect on profile card at
   85%+. Would require a `quality` parameter in `ProfileCard.js`.
4. **PvP stat cap** — high-quality players may be ranked higher in PvP
   matchmaking. Out of scope for now.

Any future change to quality mechanics should update this document.

---

## 7. Implementation Reference

The canonical implementation lives in `rpg/utils/ClassSystem.js`:

- `MIN_AWAKEN_QUALITY` and `MAX_AWAKEN_QUALITY` — bounds (both 1, 100)
- `rollQuality()` — returns an int in [1, 100]
- `applyQuality(max, quality)` — applies the formula
- `getQualityLabel(quality)` — returns the tier label
- `formatQualityStars(quality)` — returns the star string (e.g. `"★★★★☆"`)

All other code reads `player.classQuality` and passes it to these helpers
rather than computing its own interpretation.

---

## 8. Changelog

- **1.0 (2026-07-24)** — Initial spec. Quality is 1-100, uniform roll, scales
  stat bonuses and skill potency linearly. Replaces the previous unclear
  comment "1% quality = ~10% of max bonus" (which was wrong — it was always
  1% = 1% of max).
