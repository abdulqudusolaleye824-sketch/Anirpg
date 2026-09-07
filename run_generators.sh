#!/bin/bash
# ╔══════════════════════════════════════════════════════════════╗
# ║          AniRPG — Master Prompt Generator Script             ║
# ║                                                              ║
# ║  Runs all three generators in sequence:                      ║
# ║    1. Rig spritesheets  → rig_prompts.json                   ║
# ║    2. Skins (230)       → skin_prompts.json                  ║
# ║    3. All game assets   → asset_prompts.json                 ║
# ║                           asset_prompts_summary.txt          ║
# ╚══════════════════════════════════════════════════════════════╝

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║        AniRPG — Running All Prompt Generators        ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# 1. Rig animation spritesheets (12 states)
echo "── Step 1/3: Rig Spritesheet Prompts ──"
node rpg/skins/RigPromptGenerator.js
echo ""

# 2. Player skins (230 skins)
echo "── Step 2/3: Skin Prompts ──"
node rpg/skins/SkinPromptGenerator.js
echo ""

# 3. All game assets (weapons, armor, monsters, potions, materials, currency, artifacts)
echo "── Step 3/3: Game Asset Prompts ──"
node rpg/skins/AssetPromptGenerator.js
echo ""

echo "╔══════════════════════════════════════════════════════╗"
echo "║                    ALL DONE                          ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║  rig_prompts.json         — 12 spritesheet prompts   ║"
echo "║  skin_prompts.json        — 230 skin prompts         ║"
echo "║  asset_prompts.json       — all game asset prompts   ║"
echo "║  asset_prompts_summary.txt — human-readable list     ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║  NEXT STEPS:                                         ║"
echo "║  1. Open asset_prompts_summary.txt for a full list   ║"
echo "║  2. Feed prompts into Midjourney / DALL-E            ║"
echo "║  3. Save each PNG to the filename shown              ║"
echo "║  4. Drop gate videos:                                ║"
echo "║     assets/videos/blue_gate.mp4                      ║"
echo "║     assets/videos/red_gate.mp4                       ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
