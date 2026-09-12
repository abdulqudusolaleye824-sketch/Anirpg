FROM node:20-slim

RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    python3-pip \
    curl \
    unzip \
    libvips-dev \
    make \
    g++ \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    fonts-dejavu-core \
    fonts-noto-cjk \
    fontconfig \
    && rm -rf /var/lib/apt/lists/*

# Deno: JS runtime yt-dlp needs to solve YouTube's "n" signature
# challenge. Without it, YouTube extraction is deprecated/degraded and
# many videos 403 or lose formats. Installed to /usr/local (on PATH).
RUN curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY requirements.txt ./
RUN pip3 install --no-cache-dir -r requirements.txt --break-system-packages || pip3 install --no-cache-dir -r requirements.txt

COPY . .
RUN mkdir -p /data/auth /data/database logs && chmod -R 755 /data

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "index.js"]
