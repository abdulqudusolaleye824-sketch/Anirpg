// Push #96f: /aura farm reaction lines — 50 flops, 50 successes. Just the line.
'use strict';
const FLOPS = [
  '💀 The aura saw you coming and vanished.', '😭 Bro farmed absolutely NOTHING.', '🗿 You really thought that was gonna work.',
  '💀 Aura detected. Unfortunately, not yours.', '😭 The grind just got violated.', '🤡 You farmed aura and lost aura somehow.',
  '💀 Even the system felt bad for you.', '🥀 The aura simply said “no.”', '😭 Bro got rejected by an invisible stat.',
  '💀 Your aura application was denied.', '🗿 Standing there was NOT enough this time.', '😭 The aura left you on read.',
  '💀 Bro got aura-farmed instead.', '🤡 That was NOT the harvest you imagined.', '🥀 Your aura is currently experiencing technical difficulties.',
  '💀 The universe checked your aura and closed the tab.', '😭 Bro pulled up with confidence and left with nothing.', '🗿 Aura farming privileges revoked.',
  "💀 You just got ratio'd by the aura.", '😭 The aura said “maybe next lifetime.”', '🤡 Bro really pressed the button for THIS.',
  '💀 The harvest has been respectfully declined.', '🥀 Your aura is on unpaid leave.', '😭 Even the aura has standards.',
  '🗿 You tried. The aura disagreed.', '💀 Aura.exe has stopped responding.', '😭 The grind took one look at you and clocked out.',
  '🤡 You entered the aura farm as a farmer and left as the crop.', '💀 Zero aura behavior detected.', '🗿 The aura economy just crashed around you.',
  "😭 Bro's aura got nerfed mid-harvest.", '💀 The aura was NOT feeling generous today.', '🥀 You reached for greatness and grabbed air.',
  '🤡 Certified aura farming L.', '💀 Your harvest got intercepted by the NPCs.', "😭 Bro's aura subscription expired.",
  '🗿 The aura looked at your stats and went “who invited bro?”', '💀 Nothing was harvested. Everything was embarrassing.', '😭 You got absolutely scammed by your own aura.',
  '🤡 Farming attempt sponsored by bad decisions.', '💀 The aura is currently unavailable. Permanently, apparently.', '🥀 Your presence generated negative productivity.',
  '😭 Bro came for aura and found character development.', '💀 That harvest was so dry even the desert felt bad.', '🗿 Aura said “respectfully, get out.”',
  '🤡 You just lost an argument with a stat.', '💀 The farm has officially rejected your application.', "😭 Bro's aura got sent back to the sender.",
  '🥀 No aura. No harvest. Just vibes.', '💀 Absolutely catastrophic aura farming performance.',
];
const WINS = [
  '🗿 Bro just casually generated aura.', '🔥 The aura farm is FEEDING today.', '👑 Certified aura acquisition.',
  "💀 Bro didn't farm aura. Aura farmed itself.", '🗿 Main character behavior detected.', '🔥 The presence is getting disrespectful.',
  "😭 Bro's aura is doing overtime.", '👁️ Everyone felt that one.', '💎 Aura secured. Dignity maintained.',
  '🗿 Bro pressed the button and became HIM.', '🔥 The grind just paid rent.', '👑 Another harvest for the aura archives.',
  "💀 Bro's presence got an update.", '😭 Why is bro farming this efficiently?', '🗿 Aura levels looking criminal.',
  '🔥 The farm is absolutely COOKING.', '👁️ Something changed in the atmosphere.', '💎 The aura has officially entered the chat.',
  '🗿 Bro is farming like rent is due.', '🔥 Zero hesitation. Maximum aura.', '👑 The aura economy just received another investor.',
  '💀 Bro is NOT beating the aura allegations.', '😭 At this point, the aura is farming itself.', '🗿 Another W for the aura department.',
  '🔥 Bro just increased the difficulty of being around him.', '👁️ That presence is getting suspicious.', '💎 Aura secured with absolutely zero shame.',
  '🗿 The farm has found its final boss.', '🔥 Bro walked in and the atmosphere folded.', '👑 The aura has chosen its champion.',
  "💀 Bro's presence got patch notes.", '😭 This much aura should require a license.', '🗿 Farming like the leaderboard owes him money.',
  '🔥 The aura machine refuses to stop.', '👁️ Bro entered the room and the stats changed.', '💎 Another clean harvest. Absolutely shameless.',
  '🗿 The aura is aura-ing.', '🔥 Bro just cooked without turning on the stove.', '👑 The grind remains undefeated.',
  '💀 Aura farming with villainous efficiency.', '😭 Bro has officially become an aura landlord.', '🗿 The atmosphere just got buffed.',
  "🔥 Somebody nerf this man's presence.", '👁️ The aura detector is working overtime.', '💎 Bro collected aura like it was overdue rent.',
  '🗿 Another harvest. Another reason to be unbearable.', '🔥 The aura farm just hit generational form.', '👑 Bro is farming presence, not resources.',
  '💀 The aura is now legally too strong.', '🗿 Harvest complete. The room has been spiritually violated.',
];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
module.exports = { FLOPS, WINS, flop: () => pick(FLOPS), win: () => pick(WINS) };
