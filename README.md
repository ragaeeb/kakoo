# Kakoo — Multi-Speaker TTS Podcast Generator

Kakoo turns a plain-text script into a fully mixed podcast MP3. Write your script with speaker labels, assign a TTS voice to each speaker, and Kakoo synthesises every line in parallel, then mixes them into a single audio file — including overlapping dialogue.

---

## Prerequisites

| Requirement | Notes |
|---|---|
| **Node.js 20+** | Required for the Next.js 16 app |
| **ffmpeg** | Required for audio mixing and speed adjustment |
| **macOS** *(optional)* | Enables the built-in `say` TTS engine |
| **Dia server** *(optional)* | Local open-source multi-speaker TTS |

### Install ffmpeg

```bash
# macOS
brew install ffmpeg

# Ubuntu / Debian
apt install ffmpeg

# Windows (via Chocolatey)
choco install ffmpeg
```

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Create environment file
cp .env.local.example .env.local
# Edit .env.local and add your API keys

# 3. Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## .env.local Template

```env
# Google AI Studio API key (for Gemini 2.5 TTS)
GOOGLE_AI_API_KEY=your_key_here

# ElevenLabs API key
ELEVENLABS_API_KEY=your_key_here

# Dia TTS server URL (optional — for local open-source TTS)
# DIA_API_URL=http://localhost:7860
```

> **Tip**: API keys can also be entered in the ⚙ Settings modal in the UI. They are encrypted with AES-GCM and stored in your browser's `localStorage`. Server-side environment variables always take priority over browser-stored keys.

---

## Script Format

```
ALICE: Welcome to the show!
BOB: Thanks for having me.
ALICE: [overlaps] Let's dive right in.
BOB: [overlap 1.5s] Absolutely, let's go!
# This is a comment — ignored by the parser
```

**Rules:**
- Speaker labels must be **UPPERCASE** (letters, digits, hyphens, underscores).
- Labels are followed by a colon and optional whitespace: `ALICE: text` or `ALICE:text`.
- `[overlaps]` / `[overlap]` — this line starts 0.5 s before the previous clip ends.
- `[overlap 1.5s]` — custom overlap offset in seconds.
- Lines starting with `#` or `//` are comments.

---

## Deployment

### Vercel

Vercel's serverless functions do not include `ffmpeg` by default. Options:

1. Use the [`@vercel/ffmpeg`](https://vercel.com/docs/functions/runtimes/node-js/ffmpeg) layer (experimental).
2. Use a third-party ffmpeg binary package like [`ffmpeg-static`](https://www.npmjs.com/package/ffmpeg-static).

Set API keys as **environment variables** in the Vercel dashboard — do not rely on browser-stored keys in production.

### Railway / Fly.io (Recommended)

Railway and Fly.io support full filesystem access and custom Docker images, making them the easiest deployment targets for Kakoo:

```dockerfile
FROM node:20-alpine
RUN apk add --no-cache ffmpeg
WORKDIR /app
COPY . .
RUN npm ci && npm run build
CMD ["npm", "start"]
```

### Cloudflare Workers

Not supported — Cloudflare Workers have no filesystem access and cannot run `ffmpeg`.

---

## Architecture

When you click **Generate**, the browser sends a `POST /api/generate` request and opens a **Server-Sent Events** stream. The server emits `progress` events as each TTS line is synthesised (with the speaker name and line number), then a `mixing` event when ffmpeg starts, and finally a `done` event with the audio URL. The client updates the progress bar and log in real time. Individual clip files are deleted after mixing; only the final `podcast.mp3` is kept in `public/output/<jobId>/`.

---

## Development

```bash
# Type-check
npx tsc --noEmit

# Lint + format
npm run check

# Build
npm run build
```
