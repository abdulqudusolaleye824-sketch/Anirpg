# Multi-Message System — Implementation Report

## What was built

A drop-in multi-message system that lets commands fan their output out into
N individual WhatsApp messages with human-like stagger, while leaving every
existing command untouched.

### New files
- `utils/multiMessage.js` — core helper (`sendMulti`, `chunkText`, `sectionToPayload`)

### Modified files
- `handlers/rpgCommandHandler.js` — `chunkedSock` proxy now auto-detects
  `content.sections` and routes through `sendMulti`
- `commands/rpg/duel.js` — battle log fans out as one message per round
- `commands/rpg/casino.js` — dice / slots / roulette / blackjack all
  refactored to fan out as: header → suspense → result → verdict
- `commands/rpg/dungeon.js` — `/dungeon attack <pattern>` fans out as:
  intro → crit/damage → effect → quest notes → monster counter-attack
  → status snapshot

## API

```js
const { sendMulti } = require('./utils/multiMessage');

// Direct call
await sendMulti(sock, jid, [
  { text: 'header' },
  { text: 'round 1' },
  { text: 'round 2' },
  { text: 'verdict' },
], { stagger: [350, 900], quoted: msg });

// Or via the chunkedSock proxy (auto-detected)
await sock.sendMessage(jid, { sections: [...] }, { quoted: msg });
```

### Section shape
```js
{ text: '...' }                              // text-only
{ text: '...', image: { url } }              // image + caption
{ video: { url }, caption: '...' }           // video
{ document: { url }, mimetype, fileName }    // file
{ audio: { ... }, ptt: true }                // voice note
```

### Options
| key | default | meaning |
|---|---|---|
| `stagger` | `[350, 900]` | min/max ms between sections |
| `chunkText` | `true` | auto-split any text section > 3500 chars |
| `quoted` | `null` | reply-quote the FIRST section to this msg |
| `firstDelay` | `0` | ms to wait before sending the first section |
| `stopOnError` | `false` | stop the whole fan-out on first error |

## How it integrates

The `chunkedSock` proxy in `rpgCommandHandler.js` (line 718) now has three
behaviours for `sendMessage`:

1. **Auto fan-out** if `content.sections` is an array → `sendMulti`
2. **Auto chunk** if `content.text.length > 3500` → existing behaviour
3. **Pass-through** otherwise

This means:
- Every existing command keeps working unchanged
- New commands can opt in with `sock.sendMessage(jid, { sections: [...] })`
- No command file needs to be modified for the system to take effect

## Tests verified

### Unit tests on `sendMulti` (8/8 pass)
1. Array of 3 sections → 3 sends
2. String shorthand → 1 send
3. `{ sections: [...] }` object → fans out
4. Long text (8000 chars) auto-chunks into 3 messages
5. Image section preserves media
6. `quoted` opt attaches to first section only
7. Empty array returns null silently
8. `chunkText` produces right-size chunks

### End-to-end tests on the proxy
- Regular `{ text: 'hello' }` → 1 raw send
- `{ sections: [...] }` → N raw sends (one per section)
- Casino dice 5-section send → 5 distinct WhatsApp messages
- Duel with 3 rounds + header + outcome → 5 distinct messages, first
  one reply-quoted, subsequent ones not

### Bot boot test
- 329 JS files, all pass `node -c`
- Bot boots clean, MongoDB connects, all 152 commands load
- Zero unhandled exceptions in 1-minute smoke run
- All 20 personalities available via `/api/personalities`

## What still works the same
- `/help` and `/menu` are still single chunky messages (they're text
  reference docs — chunking them was the right call)
- All non-combat commands (craft, shop, summon, profile, etc.) still
  send one message
- The `chunkedSock` proxy still auto-splits long text for back-compat

## Next steps (if you want them)
- Refactor `commands/rpg/arena.js` if you add a real arena system
- Refactor `commands/rpg/worldboss.js` for multi-phase boss fights
- Refactor `commands/rpg/duel.js`'s skill descriptions to a `help` section
- Add a `BATCH` mode where the player can `/duel @user auto` and the
  whole fight gets played out at high speed with extra-low stagger
