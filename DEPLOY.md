# 🚀 Ani R.P.G Bot — fly.io Deployment Guide

## Prerequisites
- A fly.io account (free at fly.io)
- flyctl CLI installed on your PC

## Install flyctl (one time)

**Windows (PowerShell):**
```
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"
```

**Mac/Linux:**
```
curl -L https://fly.io/install.sh | sh
```

---

## Step 1 — Login to fly.io
```
fly auth login
```
Opens browser, sign in with your account.

---

## Step 2 — Go to your bot folder
```
cd path/to/your/bot
```

---

## Step 3 — Launch the app (first time only)
```
fly launch --name ani-rpg-bot --no-deploy
```
- When asked "Would you like to copy its configuration?" → **Yes**
- When asked about Postgres/Redis → **No**
- This creates the app on fly.io without deploying yet

---

## Step 4 — Create the persistent volume (first time only)
This is where ALL your data lives — auth session, database, pets.
```
fly volumes create ani_rpg_data --size 1 --region iad
```
> Change `iad` to your preferred region (lhr = London, sin = Singapore)

---

## Step 5 — Deploy
```
fly deploy
```
This builds and deploys the bot. Takes ~2 minutes first time.

---

## Step 6 — Scan the QR Code (IMPORTANT)
The bot needs to be linked to your WhatsApp. After deploy:

```
fly logs
```

Watch the logs — you'll see a QR code in ASCII art. **Scan it with your WhatsApp:**
- Open WhatsApp → Settings → Linked Devices → Link a Device
- Scan the QR code from the terminal

Once scanned, the session is saved to the volume and you'll **never need to scan again** unless you explicitly delete it.

---

## After the first scan — the bot runs forever ✅
fly.io keeps 1 machine running 24/7. Even if it crashes, it auto-restarts.

---

## Useful commands

```bash
# View live logs
fly logs

# Check status
fly status

# SSH into the machine (advanced)
fly ssh console

# Restart the bot
fly machine restart

# Check how much memory/CPU it's using
fly machine list
```

---

## If the QR code expires before you scan it
Just restart and scan the new one:
```
fly machine restart
fly logs
```

---

## If you need to reset the WhatsApp session
```
fly ssh console
rm -rf /data/auth
exit
fly machine restart
```
Then scan the new QR code.

---

## Updating the bot
Whenever you make changes:
```
fly deploy
```
Your database and auth session are on the volume — they're safe during redeploys.

---

## Free tier limits
fly.io free tier gives you:
- 3 shared-cpu-1x VMs (you only need 1)
- 3GB persistent storage
- 160GB outbound data transfer

That's more than enough for the bot. You only pay if you scale up.
