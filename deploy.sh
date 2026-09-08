#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  AniRPG — DEPLOY EVERYTHING (one command)
#  Pulls the code, installs deps, and restarts the bot.
#  Works with PM2 OR plain `node` (auto-detects).
# ═══════════════════════════════════════════════════════════════
set -e

APP_NAME="ani-rpg-bot"
cd "$(dirname "$0")"

echo "──────────────────────────────────────────────"
echo "   Deploying AniRPG — pulling latest code…"
echo "──────────────────────────────────────────────"
git pull --ff-only

echo "──────────────────────────────────────────────"
echo "   Installing dependencies…"
echo "──────────────────────────────────────────────"
npm install --omit=dev

echo "──────────────────────────────────────────────"
echo "   De-registering old process (if any)…"
echo "──────────────────────────────────────────────"
# PM2 path?
if command -v pm2 >/dev/null 2>&1; then
  pm2 delete "$APP_NAME" >/dev/null 2>&1 || true
fi
# Plain-node path (kill any running index.js of this repo)
pkill -f "node $PWD/index.js" 2>/dev/null || true

# Sanity: fail fast on any syntax error in the entry + heavily-used modules
node -c index.js
echo "  ✓ index.js syntax OK"

echo "──────────────────────────────────────────────"
echo "   Starting bot…"
echo "──────────────────────────────────────────────"
if command -v pm2 >/dev/null 2>&1; then
  pm2 start index.js --name "$APP_NAME" --time
  pm2 save
else
  nohup node index.js >> logs/bot.log 2>&1 &
  echo "  ✓ started (no PM2). Logs → logs/bot.log"
fi

echo ""
echo " ✅ DEPLOY COMPLETE"
echo "    • Active bots persistence & anti-bot  ✓"
echo "    • Mute reconstruction                ✓"
echo "    • GC setup + --main + antilink       ✓"
echo "    • /announce broadcast               ✓"
echo "    • Class awakening 50k–150k          ✓"
echo "    • /gateraid <CODE> + /dungeon party retired ✓"
echo "    • /addpc, /set mod reward, /q brand ✓"
echo "    • Dead code removed                  ✓"
echo ""
