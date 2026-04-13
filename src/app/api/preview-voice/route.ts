import os from "node:os";
import path from "node:path";
import { getEnv, resolveApiKey } from "@/lib/env";
import { synthesise } from "@/lib/tts";
import type { TTSPlatformId } from "@/lib/types";
import type { NextRequest } from "next/server";
import fs from "node:fs/promises";

// ---------------------------------------------------------------------------
// GET /api/preview-voice?platform=X&voiceId=Y&text=Hello
// Synthesises a short clip and streams back the audio bytes.
// Results are cached in-process to avoid repeated API calls.
// ---------------------------------------------------------------------------

const DEFAULT_TEXT = "Hello, I'm your podcast host";
const MAX_TEXT_LENGTH = 100;

// In-process cache: key → audio buffer
const previewCache = new Map<string, Buffer>();

function toResponseBody(buffer: Buffer): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(buffer);
}

export async function GET(req: NextRequest) {
  getEnv();

  const { searchParams } = new URL(req.url);
  const platform = searchParams.get("platform") as TTSPlatformId | null;
  const voiceId = searchParams.get("voiceId");
  const rawText = searchParams.get("text") ?? DEFAULT_TEXT;
  const text = rawText.slice(0, MAX_TEXT_LENGTH);

  if (!platform || !voiceId) {
    return new Response(JSON.stringify({ error: "platform and voiceId are required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const cacheKey = `${platform}:${voiceId}:${text}`;
  const cached = previewCache.get(cacheKey);
  if (cached) {
    const mimeType = "audio/wav";
    return new Response(toResponseBody(cached), {
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  // Synthesise to a temp file
  const tmpDir = os.tmpdir();
  const tmpFile = path.join(tmpDir, `kakoo-preview-${Date.now()}.wav`);

  try {
    // Resolve API key from env (no client key for preview)
    const apiKey = resolveApiKey(platform, undefined);

    await synthesise({
      text,
      platformId: platform,
      voiceId,
      outputPath: tmpFile,
      apiKey,
      speed: 1.0,
    });

    const buf = await fs.readFile(tmpFile);
    previewCache.set(cacheKey, buf);

    const mimeType = "audio/wav";
    return new Response(toResponseBody(buf), {
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Preview failed";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  } finally {
    await fs.unlink(tmpFile).catch(() => undefined);
  }
}
