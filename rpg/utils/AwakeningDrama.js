// ═══════════════════════════════════════════════════════════════
// Push #56 — Awakening lore drama.
//
// Awakening used to print numbers and nothing else: two stat lines, a
// passive name, done. Every class now gets its own written rite, delivered as
// SEPARATE messages (the "monster awakened lore should be its own message"
// request folded in here for good): the rite, the class trial, the change,
// then the mechanical card.
//
// Structure per class: trial (First Awakening) · mantle (Second, the class
// evolves) · apex (True Awakening). Unknown or future classes (including every
// Monster variant) fall back to the element/base-class text so nobody gets an
// empty message.
// ═══════════════════════════════════════════════════════════════
'use strict';

const RITE = {
  1: {
    head: '📜 *THE FIRST SEAL* — the rite begins',
    body: 'The mana in the room turns to standing water. Something older than your class name notices you, and decides to see what you are made of. Hunters who survive this describe it the same way: not pain — *attention*.',
  },
  2: {
    head: '📜 *THE SECOND SEAL* — the class itself changes shape',
    body: 'The technique you have been calling yours for fifty levels is stripped out of you and handed back larger. This is where classes stop being things you chose and start being things you are. Guilds record the second awakening; the Association does not forget the ones who did not wake up.',
  },
  3: {
    head: '📜 *THE FINAL SEAL* — what is left after the limit is gone',
    body: 'There is no ceremony for this one. The gates simply behave differently around you — they open wider, monsters reconsider, and the mana reads you before you read it. What you become from here is not a rank. It is weather.',
  },
};

// ── Per-class drama ─────────────────────────────────────────────
const CLASS_DRAMA = {
  Warrior: {
    trial: 'A Warrior\'s first seal breaks like a shield wall: everything you were taught to hold, you now have to hold *without bracing*. Your blade gains weight and your arm stops minding it.',
    mantle: 'War God is not a promotion, it is an accumulation — every fight you refused to leave stacks up behind you. The swing that used to need a winding-up now only needs a decision.',
    apex: 'At the apex, a Warrior stops being tired. That is the frightening part. Enemies have spent their whole lives betting on the moment you slow down, and that moment has quietly stopped existing.',
  },
  Mage: {
    trial: 'Your mana pool cracks its banks. Every spell you know re-rehearses itself in your head at once, and you come out the other side able to hold two thoughts in the same hand.',
    mantle: 'An Archmage does not cast louder — the world simply agrees sooner. You feel the agreement now: a half-thought is already a spell, and the pause between them is where amateurs die.',
    apex: 'At the apex the arithmetic leaves. You stop paying for magic and start *authorising* it, which is why the Association lists True Awakened Mages under "hazards", not "personnel".',
  },
  Archer: {
    trial: 'The first seal takes your doubt, not your draw. The shot you have been "about to miss" for years leaves your hand exactly where your eye put it.',
    mantle: 'A Hawkeye sees the shot before the target moves. You feel the difference now: you are no longer predicting, you are remembering something that has not happened.',
    apex: 'At the apex distance becomes a rumour. You will still measure it out of habit — the arrow will have arrived before the measurement finishes.',
  },
  Knight: {
    trial: 'A Knight\'s rite is a burden test: the seal asks what you have been defending and refuses to let you answer with a title. What survives that question becomes your armour.',
    mantle: 'The Holy Paladin\'s oath is not spoken, it is *stood in*. Shields you raise now carry weight that has nothing to do with metal, and monsters can feel the difference before they hit it.',
    apex: 'At the apex you become the thing the line is drawn with. Bodies behind you stop dying in the first minute, and that is the entire legend.',
  },
  Monk: {
    trial: 'Your body is disassembled and returned to you with the useless parts removed. The first thing you notice is breathing; the second is that you no longer need to.',
    mantle: 'A Grand Master hits with the ground under them, the air in front of them, and the fight itself. Your strikes stopped being events and became consequences.',
    apex: 'At the apex your hands do not move first — the opponent\'s guard does. Every form you learned has folded back into one, and that one has no name.',
  },
  Rogue: {
    trial: 'The seal takes your reflection. It is a small theft, and it teaches you the only thing a Rogue needs: the difference between being unseen and being *unremembered*.',
    mantle: 'A Phantom Thief steals outcomes now. A lock, a line of sight, a safe second — you take the thing the target needed and they spend the fight missing it.',
    apex: 'At the apex you can stand in front of someone and be read as furniture. Killers who trained for this call it luck, because the alternative is that they were never fast, only unimportant.',
  },
  Assassin: {
    trial: 'The first seal asks you to hold your breath in a room full of dying and stay still. Your hands learn the exact weight of a life leaving.',
    mantle: 'The Silent Reaper does not arrive after the killing; it arrives as the killing. Your footsteps stopped being a warning.',
    apex: 'At the apex the knife is a formality. You have become the gap in a target\'s awareness that they only find when they try to look through it.',
  },
  Shaman: {
    trial: 'Your spirits get louder at the first seal — because they stopped being petitioned and started being consulted. The drum in your chest is not yours and it approves.',
    mantle: 'A Nature Deity does not ask the wild for a favour. The wild is already moving your way, and the weather has begun to agree out loud.',
    apex: 'At the apex you are the season something is having. Crops, curses, storms and recoveries all route through you now, whether they were invited or not.',
  },
  Warlord: {
    trial: 'The seal weighs your voice. Everything you have commanded with noise is taken away, and what still obeys you is what you actually earned.',
    mantle: 'A Supreme Warlord\'s battlefield bends toward judgement, not chaos: formations you did not call change shape when you look at them.',
    apex: 'At the apex you no longer need the army to win, which is precisely why armies arrive. Command stopped being a role and became a property of your presence.',
  },
  Necromancer: {
    trial: 'The first seal opens your throat to something that has been waiting politely behind it. The dead do not obey you yet — they *recognise* you, and they tell the others.',
    mantle: 'A Death Sovereign counts bodies the way a knight counts armour. Every fallen thing within earshot becomes furniture in your army with a moment\'s notice.',
    apex: 'At the apex the line between borrowing and owning a corpse stops mattering to anyone but the churches. You stopped paying for the dead; they pay you.',
  },
  Paladin: {
    trial: 'A Paladin\'s rite is an interrogation by their own light: it shows you every rescue you did not make and asks you to carry the list. You do, and it strengthens you for it.',
    mantle: 'The Divine Crusader\'s aura stops being kind. It judges the room, and the room reorganises itself around who can withstand the judgement.',
    apex: 'At the apex your word over a wound is law. Healers file reports about it; monsters learn not to be in the same sentence as you.',
  },
  Ranger: {
    trial: 'The seal takes you off-path. Everything you knew about tracking is stripped until only the instinct remains, and the instinct is what walks you home.',
    mantle: 'A Forest Sovereign does not scout an area — the area starts telling you things unprompted: what passed, what fed, what is hiding and where it means to be in a minute.',
    apex: 'At the apex no gate is deeper than your knowledge of what lives in it. Hunters follow your footprints out, and they never ask how you knew.',
  },
  Elementalist: {
    trial: 'Every element you can hold presses against the seal at once. You are allowed to keep the ones that do not have to be held — the rest burn off.',
    mantle: 'An Elemental God does not switch elements; the field switches for you. Fire is a decision, lightning a punctuation mark.',
    apex: 'At the apex weather is a dialect you speak. Raid reports describe it as a natural disaster with a name attached.',
  },
  SpellBlade: {
    trial: 'The seal engraves itself on your weapon. Your steel now remembers a spell the way a blade remembers an edge, and you can feel both at once.',
    mantle: 'A Runic Sovereign cuts in two languages. Every strike delivers the metal and the rune, and defenders can only ever block one of them.',
    apex: 'At the apex your runes fire on intent. There is no casting motion left to read — the mark, the swing and the effect are one event.',
  },
  DragonKnight: {
    trial: 'The first seal puts your spine on fire and hands it back reinforced. Something scaled looks out of your eyes for a second, and everyone present decides not to mention it.',
    mantle: 'A Dragon Emperor does not borrow a dragon\'s authority; they hold it. Wings of pressure, breath of heat, and an armour that stopped being metal some time ago.',
    apex: 'At the apex gates do not contain monsters from you — they contain you from the monsters, and that reversal rewrites tactics manuals.',
  },
  BloodKnight: {
    trial: 'Your blood is asked what it thinks of you. The answer arrives as a strength increase and a debt at the same time, which is the entire class in one sentence.',
    mantle: 'A Blood God spends themselves like currency and gets better exchange rates than anyone. Wounds stop being setbacks and start being ammunition.',
    apex: 'At the apex you can lose an amount of blood that ends fights for other people, and stay standing. Doctors refuse to write it down.',
  },
  Healer: {
    evolved: 'Life Saint',
    trial: 'The rite does not give a Healer power — it removes the part of them that flinches. You feel every wound in the room now, and you no longer look away from any of them.',
    mantle: 'A Life Saint pulls people back from a line most mages cannot see. You can hear it when someone crosses it, and the crossing reverses.',
    apex: 'At the apex your presence is the buff. Parties hold floors that were previously unwinnable, and the report reads "no cause found" next to every survivor.',
  },
  Berserker: {
    trial: 'The seal takes the governor out of you and, to everyone\'s surprise, hands the wheel to something with better reflexes. The first thing you do afterwards is stop shaking.',
    mantle: 'A Chaos God does not lose control; they stop needing it. Every enemy attack becomes fuel, and the maths of fighting you turns against the person swinging.',
    apex: 'At the apex the fight decides how much of you survives it, and it has stopped betting in your favour. Monsters now try to end you before you are angry, which is too late by definition.',
  },
  Summoner: {
    trial: 'Your contract list is read out loud by something that is not you, and every summon answers. You learn which of them actually liked you.',
    mantle: 'A Grand Summoner does not call one at a time any more. The other side hands you what you asked for and starts queuing the rest.',
    apex: 'At the apex you are outnumbered on both sides and it is still a problem for them. Gate scouts have taken to reporting your summons as the raid itself.',
  },
  Chronomancer: {
    trial: 'The seal teaches your body that a second is negotiable. The first time you do it on purpose you say a swear word, then a prayer.',
    mantle: 'A Time God spends moments they never had. Enemies experience your fights as a series of things that already happened.',
    apex: 'At the apex you stop rewinding; you simply arrive after you have already won. Records of your fights are famously boring to read and terrible to be in.',
  },
  ShadowDancer: {
    trial: 'Darkness is measured against you now, not the other way round. The rite takes your shadow and gives you back the space it used to occupy.',
    mantle: 'A Void Dancer steps between light sources like a person crossing a room. Defenders start swinging at where you were being reasonable about.',
    apex: 'At the apex the void blinks you wherever it has room. You have killed things in bright noon and no one found a body in a shadow.',
  },
  Devourer: {
    trial: 'The seal opens an appetite with an owner. You feel the mana of everyone in the room the way a starving person feels a kitchen, and you close your hand.',
    mantle: 'A Void God eats effects, buffs and momentum. A caster finishes a spell and finds it never arrived, and never learns where it went.',
    apex: 'At the apex fights feed you and you are polite enough not to say so. Guilds now ban you from sparring, not for safety — for fairness.',
  },
  Phantom: {
    trial: 'You are asked to be nowhere for a moment and to survive being believed. Part of you does not come back, and the part that does is colder and better at its job.',
    mantle: 'A Death God haunts a battlefield with intent. Things that touch you remember being afraid of something else.',
    apex: 'At the apex you are a rumour that kills. Gates close themselves when your name is on the raid sheet, and the Association calls that "logistics".',
  },
  Senku: {
    trial: 'The rite for your class is an argument, and you win it with facts nobody else has. The mana concedes, which is not a word anyone expected to use about an awakening.',
    mantle: 'Overdriven means every deduction you make arrives pre-cast. You are not solving the fight, you are editing it.',
    apex: 'At the apex, science outruns prophecy. The Monarch-adjacent rank exists because there was no other word for a human who made the world agree on purpose.',
  },
  Monster: {
    trial: 'The seal does not break — it *moults*. Your shell, your den-magic and the thing your kind hunt all come off the animal at once, and the animal walks out larger.',
    mantle: 'An Apex Form stops being a monster found in a gate and becomes a monster a gate was built around. Territory, dread and hunger get organised under one owner: you.',
    apex: 'At the apex the classification on your file becomes fiction. Hunters are briefed not to engage what you are, and the briefing includes your name now.',
  },
};

const FALLBACK = {
  trial: 'The first seal reads your technique back to you and edits it. What survives the edit is the class you actually have.',
  mantle: 'The second seal folds your limitations into the technique itself — the art stops being something you perform and starts being something you are.',
  apex: 'At the apex, records describe you as a condition of the battlefield rather than a participant in it.',
};

function classKey(player) {
  const SC = require('./SkillCatalog');
  let key = null;
  try { key = SC.canonicalClassName(player); } catch (e) {}
  return key || String((player && (typeof player.class === 'string' ? player.class : player.class?.name)) || '').trim();
}

/** Evolution name for tier 2, with the drama module as the authority. */
function evolvedName(player, className) {
  const key = classKey(player) || className;
  if (CLASS_DRAMA[key]?.evolved) return CLASS_DRAMA[key].evolved;
  const EVO = {
    Warrior: 'War God', Mage: 'Archmage', Archer: 'Hawkeye', Rogue: 'Phantom Thief',
    Knight: 'Holy Paladin', Monk: 'Grand Master', Shaman: 'Nature Deity', Warlord: 'Supreme Warlord',
    Paladin: 'Divine Crusader', Necromancer: 'Death Sovereign', Assassin: 'Silent Reaper',
    Elementalist: 'Elemental God', Ranger: 'Forest Sovereign', BloodKnight: 'Blood God',
    SpellBlade: 'Runic Sovereign', DragonKnight: 'Dragon Emperor', Summoner: 'Grand Summoner',
    ShadowDancer: 'Void Dancer', Devourer: 'Void God', Chronomancer: 'Time God',
    // Push #56: Berserker was the one class this table forgot — its second
    // awakening had no form to name, so the metamorphosis message was skipped
    // while /awaken still granted the (differently named) Chaos God boost.
    Berserker: 'Chaos God',
    Phantom: 'Death God', Senku: 'Senku Overdriven', Monster: 'Apex Form', Healer: 'Life Saint',
  };
  if (EVO[key]) return EVO[key];
  // Never return nothing: an unknown or newly added class still gets a form so
  // the second awakening always reads as a real, named metamorphosis.
  let d = null;
  try { d = require('./ClassSystem').CLASS_DATA?.[key]?.evolvedName; } catch (e) {}
  if (typeof d === 'string' && d) return d;
  return key ? `${key} Ascendant` : null;
}

/**
 * The drama, as an array of message bodies (never joined — each one is its own
 * message so the lore lands like a cutscene, not a wall of text).
 */
function buildDrama({ player, tier, className, pro = false, UI = null }) {
  const key = classKey(player) || className;
  const drama = CLASS_DRAMA[key] || FALLBACK;
  const rite = RITE[tier] || RITE[1];
  const frame = (pro && UI) ? UI.PRO_BAR : (UI ? UI.FREE_BAR : '━━━━━━━━━━━━━━━━━━━━━');
  const name = player?.name || 'Hunter';
  const variant = (tier === 2) ? evolvedName(player, className) : null;

  const out = [
    `${frame}\n${rite.head}\n${frame}\n\n${rite.body}\n\n👤 *${name}* — *${className}* · ${tier === 1 ? 'First' : tier === 2 ? 'Second' : 'True'} Awakening\n${frame}`,
  ];

  const which = tier === 1 ? 'trial' : tier === 2 ? 'mantle' : 'apex';
  out.push(`${frame}\n📖 *THE TRIAL OF ${String(className).toUpperCase()}*\n${frame}\n\n${drama[which] || drama.trial}\n${frame}`);

  if (tier === 2 && variant) {
    out.push(`${frame}\n🔥 *METAMORPHOSIS*\n${frame}\n\n*${className}* is gone. What stands up from the rite answers to *${variant}*.\n\nGuilds will file you under the new name by morning; the old one stays on your weapons.\n${frame}`);
  }
  if (tier === 3) {
    out.push(`${frame}\n👑 *AFTERWARDS*\n${frame}\n\nThe next report you file will be read by people who cannot help you and are required to try.\n\n*${name}* — ${variant ? `${variant}` : className} · *True Awakened*\n${frame}`);
  }
  return out;
}

module.exports = { buildDrama, CLASS_DRAMA, RITE, classKey, evolvedName, FALLBACK };
