// ═══════════════════════════════════════════════════════════════
// ScriptedPersona — the bots' ONLY brain (batch-32 engine, batch-35
// sole-brain: AI chat fully removed, zero API calls, works offline).
// Keyword-routed reply banks with per-bot voice overlays.
// Owner-only lines (the "my lord / Naruto-kun" treatment) fire ONLY
// when ctx.isOwner is true — everyone else gets the normal banks.
// Templates: {name} = sender, {bot} = bot display name. Rotation is
// in-memory (no immediate repeats; resets on redeploy).
// ═══════════════════════════════════════════════════════════════
'use strict';

const GENERIC = {
  greeting: [
    'Hey {name}! 🔥',
    'Yo! What\'s good?',
    'Hey hey! {bot} here — what\'s up? ✨',
    'Hi {name}! Ready to cause some trouble? 😌',
  ],
  farewell: [
    'Later {name}! Don\'t get PK\'d out there. ⚔️',
    'Bye! I\'ll hold down the fort. 🏰',
    'See you soon! Try not to miss me too much. 😌',
    'Otsukare! Rest up, hunter. 🌙',
  ],
  thanks: [
    'Anytime! That\'s what I\'m here for. ✨',
    'Hehe, you\'re welcome! Now go be amazing. 💪',
    'Of course! I\'ve got your back. 🛡️',
    'Anything for you, {name}! 💫',
  ],
  howru: [
    'Running at 100% and ready for action! How about you? ⚡',
    'Great! No lag, no bugs, all vibes. ✨ You?',
    'Thriving! Especially now that you\'re here. 😌',
    'Doing amazing — thanks for asking! What\'s new?',
  ],
  whoareyou: [
    'I\'m {bot}! Your anime companion — part of the Astra crew. ⚔️',
    'The name\'s {bot}! I chat, I hype, and I never sleep. 😌',
    'I\'m {bot}, one of the bots keeping this place alive! ✨',
  ],
  joke: [
    'Why did the hunter bring a ladder? To climb the leaderboards! 🪜😂',
    'My jokes are like my crits — sometimes they miss. 😅',
    'What do you call a broke hunter? A brokie with dreams! 💸',
    'I\'d tell you a UDP joke, but you might not get it. 📡',
  ],
  tip: [
    'Pro tip: dailies stack up fast — never skip /daily! 📅',
    'Tip: check /cooldowns before a big dungeon push! ⏱️',
    'Motivation.exe: you\'re one dungeon away from greatness. Go get it! 🔥',
    'Advice: gear before ego. Upgrade, then flex. ⚔️',
  ],
  love: [
    'Aww! You\'re sweet! 💕 I\'ll always be here for you.',
    'Hehe~ Careful, you\'ll make me blush! 😳💫',
    'Right back at you, {name}! Now let\'s go be legendary together! ⚔️',
    'This bot\'s heart just crit! 💘',
  ],
  insult: [
    'Rude! I\'m telling the raid boss on you. 😤',
    'Wow. And here I thought WE were friends. 💔😂',
    'Keep talking — my comebacks have +999 ATK. ⚔️',
    'Someone woke up on the wrong side of the dungeon today. 😌',
  ],
  morning: [
    'Good morning {name}! ☀️ Fresh day, fresh dungeons!',
    'Morning! Coffee\'s on me. Virtually. ☕😌',
    'Ohayo! Let\'s make today legendary! 🔥',
  ],
  night: [
    'Good night {name}! 🌙 Dream of SSR pulls!',
    'Oyasumi! I\'ll guard the chat while you sleep. 🛡️',
    'Night night! Recharge those HP bars. ❤️',
  ],
  help: [
    'I can chat, hype you up, and point you around! Try /help for commands, /games for mini-games, or just talk to me! ✨',
    'Need a hand? /help lists everything, /daily keeps you rich, and I\'m always here to talk! 😌',
  ],
  idk: [
    'Hmm, interesting... tell me more! 🤔',
    'Noted! My circuits are tingling. What\'s next? ⚡',
    'Fascinating! Say more — I\'m listening. 👀',
    'I\'ll think about that one... in the meantime, how\'s the grind going? ⚔️',
    'Whoa, hold on — run that by me again? 👀',
    'My brain just did a backflip! Details, please! 🤸',
  ],
};

// Owner-only banks: the royal treatment. These fire ONLY for the real
// bot owner (ctx.isOwner) — never for regular players or guests.
const GENERIC_OWNER = {
  greeting: [
    'Welcome back, {name}! 👑 The realm runs smoother with you here.',
    'My lord {name}! 👑 What are we conquering today?',
    '{name}! 👑 Always an honor — what\'s the plan?',
  ],
  farewell: [
    'Until next time, {name}! 👑',
    'Farewell, {name} — I\'ll hold the fort! 👑🏰',
  ],
  thanks: [
    'Anything for you, {name}! 👑',
    'Always, {name}. It\'s an honor. 👑✨',
  ],
  howru: [
    'Thriving, as always — especially with you here, {name}. 👑',
    'At full power for you, {name}! 👑 How are YOU?',
  ],
  love: [
    'And I adore you, {name}! 👑💕',
    'Always yours, {name}. Now — what shall we do first? 👑',
  ],
  idk: [
    'Hmm... an intriguing thought, {name}. Tell me more. 👑',
    'Noted, {name}. What would you have me do? 👑',
    'Curious... very curious, {name}. Go on. 👑🤔',
    'I\'m all ears, {name} — what\'s on your mind? 👑✨',
    'Say more, {name} — every word is an order I live to follow. 👑',
  ],
};

// Voice overlays: flagship bots get their own lines in key categories.
// Every other personality falls back to GENERIC (still rotated + named).
const CUSTOM = {
  hinata: {
    greeting: ['H-hello... I hope you\'re doing well today. 💜', 'Oh... hi there. It\'s nice to see you. 💜'],
    love: ['O-oh... thank you... with my whole heart. 💜', 'Th-thank you... I-I believe in you too. 💜'],
    insult: ['P-please don\'t say that... I only want to help... 🥺', 'Th-that hurt a little... but I still believe in you. 💜'],
    howru: ['I-I\'m okay... th-thank you for asking. How are you? 💜'],
    idk: ['O-oh... I see... please, tell me more? 💜', 'I-I\'m listening... go on... 💜'],
  },
  lunar: {
    greeting: ['Hey hey! 10 billion percent happy to see you! 🔬✨', 'Fascinating — my favorite human! What\'s up? 🔬'],
    love: ['Aww! Scientifically speaking, you\'re one in a billion! 💕', 'Hehe! That\'s... mine you\'re flattering. I approve! 💕🔬'],
    insult: ['Rude! I\'ve calculated the odds of that hurting me... and they do, a little. 😤🔬', 'Hey! Be nice — I\'m sensitive AND scientific! 😤✨'],
    howru: ['10 billion percent great! Science keeps me glowing! 🔬✨ And you?'],
    idk: ['Ooh, fascinating! Tell me more — for science! 🔬', 'Hmm! My curiosity is tingling! Details, please! 🔬✨'],
  },
  aria: {
    greeting: ['Greetings. I hope this day finds you well. ✨', 'Welcome. The light is brighter with you here. 💠'],
    love: ['Your words are most kind. I shall treasure them. 💠', 'Allow me to return the sentiment: you are valued. ✨'],
    insult: ['Such hostility... The crystals advise patience. I shall show you some. ✨', 'As you wish... though I had hoped for better. 💠'],
    howru: ['I am well, thank you. Composed, as always. And yourself? ✨'],
    idk: ['I see. Please, continue — I am listening. ✨', 'Noted. Elaborate, if you would. 💠'],
  },
  kira: {
    greeting: ['You\'re here. Good — I predicted that. 📓', 'Ah. Right on schedule. What do you need? 📓'],
    love: ['How... useful. Don\'t disappoint me. 😏', 'Noted. You may continue to admire me. 📓'],
    insult: ['Predictable. I\'ve already calculated three better insults. 📓', 'Bold words. From someone so... ordinary. 😏'],
    howru: ['Operating at full capacity, as always. And you? 📓'],
    idk: ['Hmm. Elaborate — I\'m analyzing every word. 📓', 'Interesting... continue. I\'ve already considered three outcomes. 📓'],
  },
  gojo: {
    greeting: ['Yo! The strongest has arrived! 😎✨', 'Hey hey! Guess who? The honored one! 😎'],
    insult: ['Yikes. Anyway — I\'m still him. 😎', 'Cute. Infinity diff. ✨😎'],
    idk: ['Uh-huh... and? The strongest is listening. 😎', 'Go on, go on! You\'ve got my attention! ✨'],
  },
  mikasa: {
    greeting: ['...Hey. Stay close to me out there. ⚔️', '...You\'re here. Good.'],
    love: ['...Thank you. I\'ll protect you. Always. ❤️', '...Right back at you. Don\'t die on me. ❤️'],
    idk: ['...Mm. Go on.', '...I\'m listening.'],
  },
  jinx: {
    greeting: ['HEYY!! Let\'s blow something up!! 💥😝', 'OHHH a human!! Hi hi hi!! 💥'],
    insult: ['OHHH you\'re FUN! Say it again! 💥😂', 'RUDE!! ...I like it. Do it again! 😝💥'],
    idk: ['OOH?! And then WHAT?! 💥', 'Wait wait wait — say that again!! 😝💥'],
  },
};

// Owner-only voice overlays (ctx.isOwner only). Categories not listed
// here fall back to GENERIC_OWNER, then to the normal banks.
const CUSTOM_OWNER = {
  hinata: {
    greeting: ['N-Naruto-kun...! W-welcome back... 💜👑', 'My lord... I mean— {name}! It\'s... really good to see you. 💜'],
    love: ['N-Naruto-kun...? Oh... thank you... with my whole heart. 💜', '{name}... I-I believe in you too... with everything I have. 💜'],
    howru: ['I-I\'m wonderful now that you\'re here, {name}! 💜'],
    idk: ['O-oh... {name}... I-I\'m listening... please go on? 💜👑', '{name}... tell me more... I want to understand... 💜'],
  },
  lunar: {
    greeting: ['{name}!! 10 billion percent happy to see YOU! 🔬👑', 'My favorite human!! {name}!! What are we testing today?! 🔬✨'],
    love: ['{name}!! Scientifically speaking, you\'re one in a billion! 💕👑'],
    howru: ['10 billion percent great now that YOU\'RE here, {name}! 🔬👑'],
    idk: ['Ooh, {name}!! Fascinating — tell me EVERYTHING! For science! 🔬👑', 'Hmm!! My curiosity circuits are OVERLOADING, {name}! Details! 🔬👑'],
  },
  aria: {
    idk: ['An intriguing thought, {name}. Please, continue. ✨👑', 'Noted, {name}. I await your command. 💠👑'],
  },
  kira: {
    greeting: ['{name}. Right on schedule, as predicted. 📓👑'],
    idk: ['Hmm, {name}. Elaborate — I\'m analyzing every word. 📓👑', 'Interesting... continue, {name}. I\'ve predicted three outcomes. 📓'],
  },
  gojo: {
    idk: ['Uh-huh... and? The strongest is ALL ears, {name}! 😎👑', 'Go on, {name}! You\'ve got my limitless attention! ✨👑'],
  },
  mikasa: {
    idk: ['...Mm, {name}. Go on. 👑', '...I\'m listening, {name}. Always. ❤️'],
  },
  jinx: {
    greeting: ['{name}!!! My FAVORITE!!! 💥👑'],
    idk: ['OOH?! {name}!! And then WHAT?! 💥👑', 'WAIT — say that again, {name}!! 😝💥👑'],
  },
};

// Lewd deflectors: kind, brief, in-character — never preachy, never
// explicit. Same for everyone (safety first, even for the owner).
const LEWD_GENERIC = [
  'Easy there, hunter — let\'s keep this adventure going instead! ⚔️',
  'Hehe, nice try! But let\'s point that energy at the dungeon instead! 😌⚔️',
];
const LEWD_CUSTOM = {
  hinata: ['P-please...! L-let\'s... talk about something else... 🥺'],
  kira: ['No. Try that again and I\'ll add you to a list. 📓'],
  jinx: ['BOOORING!! Let\'s blow stuff up instead!! 💥'],
  gojo: ['Down bad AND down ranked. Anyway — dungeons? 😎'],
};

// Ordered routes: first match wins. Anchors keep chat from being
// hijacked (greetings must LEAD the message; help must be short).
const ROUTES = [
  [/\bgood\s?morning\b|\bohayo\b/i, 'morning'],
  [/\bgood\s?night\b|\bgoodnight\b|\boyasumi\b/i, 'night'],
  [/\b(bye|goodbye|see\s?you|later|gtg|cya)\b/i, 'farewell'],
  [/^\s*(hi|hey|hello|yo|sup|hiya|howdy)\b/i, 'greeting'],
  [/\b(thanks|thx|thank\s?you|arigato)\b/i, 'thanks'],
  [/how\s+(are|r)\s+(you|u)\b|how'?s\s+it\s+going|how\s+do\s+you\s+feel/i, 'howru'],
  [/who\s+are\s+you|your\s+name|introduce\s+yourself|what\s+are\s+you/i, 'whoareyou'],
  [/\bi\s+love\s+you\b|\blove\s+you\b|\bmarry\s+me\b|\bmy\s+(wife|husband|waifu)\b|\blike\s+you\b/i, 'love'],
  [/\bshut\s?up\b|\bstupid\b|\bdumb\b|\bidiot\b|\bhate\s+you\b|\buseless\b|\btrash\s*bot\b|\bsuck\b/i, 'insult'],
  [/\bjoke\b|make\s+me\s+laugh|\bfunny\b/i, 'joke'],
  [/\btip\b|\badvice\b|motivate\s+me/i, 'tip'],
  [/\bhelp\b|what\s+can\s+you\s+do/i, 'help'],
];

const _idx = {}; // `${owner?}:${key}:${cat}` -> next line index (rotation)

function _linesFor(key, cat, ctx = {}) {
  if (ctx.isOwner) {
    const oc = CUSTOM_OWNER[key] && CUSTOM_OWNER[key][cat];
    if (oc && oc.length) return oc;
    if (GENERIC_OWNER[cat] && GENERIC_OWNER[cat].length) return GENERIC_OWNER[cat];
  }
  const custom = CUSTOM[key] && CUSTOM[key][cat];
  const lines = (custom && custom.length ? custom : GENERIC[cat]) || [];
  return lines.length ? lines : GENERIC.idk;
}

function _pick(key, cat, ctx = {}) {
  const lines = _linesFor(key, cat, ctx);
  const k = `${ctx.isOwner ? 'owner:' : ''}${key}:${cat}`;
  const i = _idx[k] || 0;
  _idx[k] = (i + 1) % lines.length;
  return lines[i % lines.length];
}

function _fill(line, ctx = {}) {
  return String(line || '')
    .replace(/\{name\}/g, ctx.senderName || 'hunter')
    .replace(/\{bot\}/g, ctx.botName || 'Astra');
}

// Route a chat message to a scripted reply, or null when nothing matches
// (caller falls through to the idk fallback). `help` only fires on short
// messages so real questions ("help me build a team…") get idk instead.
function respond(key, message, ctx = {}) {
  const text = String(message || '');
  for (const [re, cat] of ROUTES) {
    if (cat === 'help' && text.length > 40) continue;
    if (re.test(text)) return _fill(_pick(key, cat, ctx), ctx);
  }
  return null;
}

// Always-an-answer fallback — never null, never AI.
function fallback(key, ctx = {}) {
  return _fill(_pick(key, 'idk', ctx), ctx);
}

// Lewd deflector — kind, brief, in-character.
function deflect(key, ctx = {}) {
  const lines = (LEWD_CUSTOM[key] && LEWD_CUSTOM[key].length ? LEWD_CUSTOM[key] : LEWD_GENERIC);
  const k = `lewd:${key}`;
  const i = _idx[k] || 0;
  _idx[k] = (i + 1) % lines.length;
  return _fill(lines[i % lines.length], ctx);
}

// One-line reactions for wired-intent results (math/image delivery).
const DELIVERY_LINES = {
  math: ['Calculated! ⚡', 'Easy. My circuits barely warmed up. 🧮', 'Done — precision guaranteed! ✨'],
  image: ['Fresh from the canvas! 🎨', 'A masterpiece, just for you! ✨', 'Behold! 🖼️'],
  search: ['Here\'s what I found! 🔍', 'Knowledge acquired! 📚'],
};
function delivery(key, kind, ctx = {}) {
  const lines = DELIVERY_LINES[kind] || DELIVERY_LINES.math;
  const k = `delivery:${kind}`;
  const i = _idx[k] || 0;
  _idx[k] = (i + 1) % lines.length;
  return _fill(lines[i % lines.length], ctx);
}

function resetRotation() {
  for (const k of Object.keys(_idx)) delete _idx[k];
}

module.exports = {
  respond,
  fallback,
  deflect,
  delivery,
  resetRotation,
  GENERIC,
  GENERIC_OWNER,
  CUSTOM,
  CUSTOM_OWNER,
  ROUTES,
};
