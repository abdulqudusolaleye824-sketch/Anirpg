# AniRPG — Anime WhatsApp RPG Bot & AstraLink Multi-Bot System 🗡️

An extensive, anime-themed **WhatsApp RPG Bot** powered by Node.js and `@whiskeysockets/baileys` (v7.0.0-rc14). Featuring a **Multi-Socket architecture** with 20+ anime character personalities, a live web management dashboard (**AstraLink**), and over **170+ RPG & admin commands**.

---

## 🌟 Core Features

- 🎭 **Multi-Bot Personality System**: Connect multiple WhatsApp bot accounts simultaneously. Assign distinct anime character personalities (*Gojo, Mikasa, Nezuko, Killua, Hinata, Rem, Power, Mob, Jinx, etc.*) to individual groups using `/switch`.
- 🌐 **AstraLink Web Dashboard**: Built-in HTTP server (`port 3000`) for visual QR pairing, phone pairing codes, group bot mapping, and real-time telemetry monitoring.
- ⚔️ **Extensive RPG Engine**:
  - **Classes & Awakening**: Class selection, skill trees, and 50k–150k gold awakening tiers.
  - **Dungeons & Gate Raids**: Cooperative multi-player gate raids (`/gateraid <CODE>`), solo dungeons, and boss raids.
  - **Social & Economy**: Banking system, item theft mechanics (`/steal`), trading market, guilds & guild contracts, casino, and party combo mechanics.
  - **Skins & Gear**: Artifacts, gear enchanting, crafting, pets, and profile cards with customizable banners.
- 📹 **CCTV & Group Moderation**: Anti-bot protections, group moderation (`/promote`, `/demote`, `/allowgc`), and chat logging.
- 🎵 **Media Utilities**: YouTube audio/video downloading (`yt-dlp`), quote sticker generator, TikTok/Pinterest downloaders.

---

## 🛠️ Required Dependencies

AniRPG requires **Node.js (>=20.0.0)**, **Python 3**, **Pillow**, **yt-dlp**, and **ffmpeg**.

### 1. Node.js Dependencies (`package.json`)
Installed automatically via `npm install`:
- `@whiskeysockets/baileys` (WhatsApp Web API socket)
- `sharp` & `canvas` (Dynamic image generation)
- `imagemin-webp` (Sticker conversion)
- `mongodb` (Primary database driver)
- `pino`, `dotenv`, `qrcode`

### 2. Python Dependencies (`requirements.txt`)
Installed via `pip`:
```bash
pip install -r requirements.txt
```
Includes:
- `pillow` (Quote sticker generator & canvas manipulations)
- `yt-dlp` (YouTube and social media downloads)

### 3. System Binary Dependencies
- **`ffmpeg`**: Required for media conversion, audio extraction (`/ytmp3`), and video remuxing (`/ytmp4`).
  - **Ubuntu/Debian**: `sudo apt-get install -y ffmpeg python3-pip`
  - **Windows**: `winget install Gyan.FFmpeg` or set `FFMPEG_PATH` in `.env`
  - **macOS**: `brew install ffmpeg`

---

## 🚀 Quick Start

### 1. Clone the repository
```bash
git clone https://github.com/abdulqudusolaleye824-sketch/Anirpg.git
cd Anirpg
```

### 2. Install Dependencies
```bash
# Install Node.js packages
npm install

# Install Python packages
pip install -r requirements.txt
```

### 3. Configure Environment
Copy `.env.example` to `.env` and fill in your configuration:
```bash
cp .env.example .env
```

### 4. Start the Bot & AstraLink UI
```bash
npm start
```
Or run the automated deployment script:
```bash
chmod +x deploy.sh
./deploy.sh
```

Access the **AstraLink Control Panel** in your browser at `http://localhost:3000`.

---

## 🐳 Docker & Cloud Deployment

### Docker
```bash
docker build -t anirpg .
docker run -p 3000:3000 anirpg
```

### Nixpacks / Railway / Render / Fly.io
The repository includes pre-configured deployment manifests (`nixpacks.toml`, `fly.toml`, `Dockerfile`) that automatically provision `Node.js 20`, `ffmpeg`, `yt-dlp`, and `Pillow`.

---

## 📜 License

ISC License. Built with ❤️ for the anime & gaming community.
