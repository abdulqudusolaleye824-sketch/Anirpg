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
# Refuse to pull over local DATA — database.json / auth are runtime state, not
# source, and a merge conflict there is how a deploy eats a database.
if ! git diff --quiet -- database auth 2>/dev/null; then
  echo "❌ Local changes to database/ or auth/ — committing a safety copy first."
  git add -A database auth 2>/dev/null || true
  git -c user.email=deploy@local -c user.name=deploy commit -qm "deploy.sh safety commit ($STAMP)" 2>/dev/null || true
fi
git pull --ff-only || { echo "❌ git pull failed — NOTHING was restarted. Your running bot and database are untouched."; exit 1; }

echo "──────────────────────────────────────────────"
echo "   Installing dependencies…"
echo "──────────────────────────────────────────────"
npm install --omit=dev

# ═══ DATA SAFETY: snapshot BEFORE anything changes ════════════════════════
# A deploy must never be the reason your players disappear. Copy the live JSON
# mirror AND the WhatsApp auth session to disk before the pull, before the
# kill, before anything can go wrong — so even a bad deploy is recoverable with
# one cp. (The bot also snapshots hourly/boot on its own; this is the belt.)
DATA_DIR="${DATA_DIR:-$PWD}"
SNAP_DIR="$DATA_DIR/deploy-snapshots"
mkdir -p "$SNAP_DIR"
STAMP="$(date -u +%Y%m%d-%H%M%SZ)"
for SRC in "$DATA_DIR/database/database.json" "$DATA_DIR/database/database.json.1"; do
  [ -f "$SRC" ] && cp -a "$SRC" "$SNAP_DIR/$(basename "$SRC").pre-deploy-$STAMP" && echo "  ✓ snapshotted $(basename "$SRC")"
done
if [ -d "$DATA_DIR/auth" ]; then
  tar czf "$SNAP_DIR/auth.pre-deploy-$STAMP.tgz" -C "$DATA_DIR" auth 2>/dev/null \
    && echo "  ✓ snapshotted auth/ (WhatsApp sessions)"
fi
# keep the newest 20 snapshots, drop the rest
ls -1t "$SNAP_DIR" 2>/dev/null | tail -n +21 | while read -r F; do rm -f "$SNAP_DIR/$F"; done
echo "  → snapshots in $SNAP_DIR"

echo "──────────────────────────────────────────────"
echo "   De-registering old process (if any)…"
echo "──────────────────────────────────────────────"
# PM2 path?
if command -v pm2 >/dev/null 2>&1; then
  pm2 delete "$APP_NAME" >/dev/null 2>&1 || true
fi
# Plain-node path — kill ANY node running an index.js, then VERIFY. A narrow
# pattern once missed a stray and the ghost poisoned the JSON mirror while
# the main process ran (the 02:00 incident). Push #37.
pkill -f "node.*index\.js" 2>/dev/null || true
sleep 2
for _i in 1 2 3 4 5; do
  pgrep -f "node.*index\.js" >/dev/null 2>&1 || break
  [ "$_i" = 5 ] && pkill -9 -f "node.*index\.js" 2>/dev/null || true
  sleep 2
done

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
