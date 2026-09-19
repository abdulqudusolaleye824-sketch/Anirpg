#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  AniRPG auto-deploy watcher (Push #71)
#  Runs every 5 min from cron. If origin/main moved, pull + restart.
#  Safe by design: no change → exit silently; dirty tree → stash;
#  DB/auth snapshotted before restart; index.js local edits preserved.
#  Log: /var/log/anirpg-autodeploy.log  (or ~/anirpg-autodeploy.log)
# ═══════════════════════════════════════════════════════════════
set -u
LOG=/var/log/anirpg-autodeploy.log; [ -w /var/log ] || LOG=$HOME/anirpg-autodeploy.log
log(){ echo "$(date -u +%FT%TZ) $*" >> "$LOG"; }
exec 9>/tmp/anirpg-autodeploy.lock; flock -n 9 || exit 0   # never overlap

# ── locate the repo (env, common dirs, then search) ─────────────
REPO="${ANIRPG_DIR:-}"
for d in "$REPO" "$HOME/Anirpg" "$HOME/anirpg" "$HOME/AniRPG" /opt/anirpg /app /srv/anirpg; do
  [ -n "$d" ] && [ -d "$d/.git" ] && [ -f "$d/package.json" ] && REPO="$d" && break
done
[ -d "${REPO:-/nonexistent}/.git" ] || REPO="$(find "$HOME" /opt /srv -maxdepth 3 -name package.json -path '*nirpg*' 2>/dev/null | head -1 | xargs -r dirname)"
[ -d "${REPO:-/nonexistent}/.git" ] || { log "repo not found — set ANIRPG_DIR in crontab"; exit 1; }
cd "$REPO"

# ── did main move? ──────────────────────────────────────────────
git fetch -q origin main 2>>"$LOG" || { log "fetch failed"; exit 1; }
LOCAL=$(git rev-parse HEAD); REMOTE=$(git rev-parse origin/main)
[ "$LOCAL" = "$REMOTE" ] && exit 0
log "update: ${LOCAL:0:8} → ${REMOTE:0:8}"

# ── snapshot data before touching anything ──────────────────────
STAMP=$(date -u +%Y%m%d-%H%M%SZ); SNAP="$REPO/deploy-snapshots"; mkdir -p "$SNAP"
for f in database/database.json database/database.json.1 database/anirpg.sqlite; do
  [ -f "$f" ] && cp -a "$f" "$SNAP/$(basename "$f").auto-$STAMP"
done
[ -d auth ] && tar czf "$SNAP/auth.auto-$STAMP.tgz" auth 2>/dev/null
ls -1t "$SNAP" | tail -n +31 | while read -r F; do rm -f "$SNAP/$F"; done

# ── pull (stash local drift so ff-only can never silently no-op) ─
STASHED=0
if ! git diff --quiet || ! git diff --cached --quiet; then
  git stash push -q -m "autodeploy-$STAMP" && STASHED=1 && log "stashed local changes"
fi
if ! git pull -q --ff-only origin main 2>>"$LOG"; then
  log "ff pull failed — hard resetting to origin/main (local drift kept in stash)"
  git reset -q --hard origin/main || { log "reset failed; abort"; exit 1; }
fi
# keep a locally-patched index.js if the stash had one (live box carries hotfixes)
if [ $STASHED = 1 ] && git stash show -p stash@{0} -- index.js 2>/dev/null | grep -q .; then
  git checkout -q stash@{0} -- index.js && log "re-applied local index.js hotfix"
fi
npm install --omit=dev --no-audit --no-fund >>"$LOG" 2>&1 || log "npm install warnings (continuing)"

# ── restart whichever runtime is in use ─────────────────────────
if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -qi anirpg; then
  C=$(docker ps --format '{{.Names}}' | grep -i anirpg | head -1)
  if [ -f docker-compose.yml ] || [ -f compose.yml ]; then
    (docker compose up -d --build >>"$LOG" 2>&1 || docker-compose up -d --build >>"$LOG" 2>&1) && log "compose rebuilt"
  else
    docker build -t anirpg:patched . >>"$LOG" 2>&1 && docker restart "$C" >>"$LOG" 2>&1 && log "docker image rebuilt + $C restarted"
  fi
elif command -v pm2 >/dev/null 2>&1 && pm2 describe ani-rpg-bot >/dev/null 2>&1; then
  pm2 restart ani-rpg-bot >>"$LOG" 2>&1 && log "pm2 restarted"
elif systemctl list-units --type=service 2>/dev/null | grep -qi anirpg; then
  S=$(systemctl list-units --type=service --no-legend | grep -i anirpg | awk '{print $1}' | head -1)
  sudo systemctl restart "$S" && log "systemd $S restarted"
else
  pkill -f "node.*index\.js" 2>/dev/null; sleep 2
  nohup node index.js >> "$REPO/bot.log" 2>&1 &
  log "plain node restarted (pid $!)"
fi

sleep 25
curl -s -m 8 http://127.0.0.1:3000/health >>"$LOG" 2>&1; echo >>"$LOG"
log "deployed ${REMOTE:0:8}"
