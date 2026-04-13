import fs from "node:fs/promises";
import path from "node:path";
import { buildTimeline, cleanupClips, mixAudio } from "@/lib/audio-mixer";
import { getEnv, resolveApiKey } from "@/lib/env";
import { parseScript } from "@/lib/script-parser";
import { synthesise } from "@/lib/tts";
import type { Speaker, TTSPlatformId } from "@/lib/types";
import { MAX_SPEAKERS } from "@/lib/types";
import type { NextRequest } from "next/server";
import { v4 as uuidv4 } from "uuid";

// ---------------------------------------------------------------------------
// POST /api/generate
// Returns a Server-Sent Events stream with real-time progress.
//
// SSE event types:
//   progress  – { step, message, percent }
//   done      – { audioUrl, podcastId }
//   error     – { message }
//
// Headers required for SSE to work through Vercel/nginx:
//   Cache-Control: no-cache
//   Connection: keep-alive
//   X-Accel-Buffering: no
// ---------------------------------------------------------------------------

const OUTPUT_DIR = path.join(process.cwd(), "public", "output");
const MAX_SCRIPT_LENGTH = 50_000;
const MAX_VOICE_ID_LENGTH = 128;
const MAX_API_KEY_LENGTH = 512;
const TTS_TIMEOUT_MS = 30_000;
const MAX_OUTPUT_BYTES = 200 * 1024 * 1024; // 200 MB

const VALID_PLATFORM_IDS: TTSPlatformId[] = ["google-gemini", "macos-say"];

function sseEvent(type: string, data: Record<string, unknown>): string {
  return `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: NextRequest) {
  getEnv(); // validate env on every request

  // -------------------------------------------------------------------------
  // Parse and validate request body
  // -------------------------------------------------------------------------
  let body: {
    script?: unknown;
    speakers?: unknown;
    apiKeys?: unknown;
  };

  try {
    body = (await req.json()) as typeof body;
  } catch {
    return new Response(sseEvent("error", { message: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "text/event-stream" },
    });
  }

  const { script, speakers: rawSpeakers, apiKeys: rawApiKeys } = body;

  // Validate script
  if (typeof script !== "string" || !script.trim()) {
    return new Response(
      JSON.stringify({ error: "Script is required", field: "script" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }
  if (script.length > MAX_SCRIPT_LENGTH) {
    return new Response(
      JSON.stringify({ error: `Script exceeds ${MAX_SCRIPT_LENGTH} characters`, field: "script" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // Validate speakers
  if (!Array.isArray(rawSpeakers) || rawSpeakers.length === 0) {
    return new Response(
      JSON.stringify({ error: "At least one speaker is required", field: "speakers" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }
  if (rawSpeakers.length > MAX_SPEAKERS) {
    return new Response(
      JSON.stringify({ error: `Too many speakers (max ${MAX_SPEAKERS})`, field: "speakers" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // Validate each speaker
  for (let i = 0; i < rawSpeakers.length; i++) {
    const s = rawSpeakers[i] as Record<string, unknown>;
    if (!VALID_PLATFORM_IDS.includes(s.platformId as TTSPlatformId)) {
      return new Response(
        JSON.stringify({ error: `Invalid platformId for speaker ${i}`, field: `speakers[${i}].platformId` }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
    if (typeof s.voiceId !== "string" || !s.voiceId || s.voiceId.length > MAX_VOICE_ID_LENGTH) {
      return new Response(
        JSON.stringify({ error: `Invalid voiceId for speaker ${i}`, field: `speakers[${i}].voiceId` }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
    const speed = Number(s.speed ?? 1.0);
    if (speed < 0.5 || speed > 2.0) {
      return new Response(
        JSON.stringify({ error: `Speed out of range [0.5, 2.0] for speaker ${i}`, field: `speakers[${i}].speed` }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
    const volume = Number(s.volume ?? 1.0);
    if (volume < 0.1 || volume > 2.0) {
      return new Response(
        JSON.stringify({ error: `Volume out of range [0.1, 2.0] for speaker ${i}`, field: `speakers[${i}].volume` }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
  }

  const speakers = rawSpeakers as Speaker[];
  const apiKeys = (rawApiKeys as Record<string, string> | undefined) ?? {};

  // Sanitise apiKeys
  for (const [k, v] of Object.entries(apiKeys)) {
    if (typeof v === "string" && v.length > MAX_API_KEY_LENGTH) {
      apiKeys[k] = v.slice(0, MAX_API_KEY_LENGTH);
    }
  }

  // -------------------------------------------------------------------------
  // Set up SSE stream
  // -------------------------------------------------------------------------
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function emit(type: string, data: Record<string, unknown>) {
        controller.enqueue(encoder.encode(sseEvent(type, data)));
      }

      const jobId = uuidv4();
      const jobDir = path.join(OUTPUT_DIR, jobId);

      try {
        // Parse script
        emit("progress", { step: "parsing", message: "Parsing script…", percent: 5 });
        const { lines } = parseScript(script);

        if (lines.length === 0) {
          emit("error", { message: "No valid script lines found" });
          controller.close();
          return;
        }

        // Create job directory
        await fs.mkdir(jobDir, { recursive: true });

        // Build speaker lookup
        const speakerMap = new Map<string, Speaker>(
          speakers.map((s) => [s.label.toUpperCase(), s]),
        );

        const clipPaths: Array<{
          filePath: string;
          overlaps: boolean;
          overlapOffset: number;
          volume: number;
        }> = [];

        // Synthesise each line
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const speaker = speakerMap.get(line.speakerLabel.toUpperCase());

          if (!speaker) {
            console.warn(`Speaker "${line.speakerLabel}" not found – skipping line ${i}`);
            continue;
          }

          const percent = Math.round(10 + (i / lines.length) * 70);
          emit("progress", {
            step: "synthesising",
            message: `Synthesising line ${i + 1}/${lines.length} (${speaker.label})…`,
            percent,
            lineIndex: i,
            totalLines: lines.length,
            speakerLabel: speaker.label,
            lineText: line.text.slice(0, 80),
          });

          const clipPath = path.join(jobDir, `clip_${String(i).padStart(3, "0")}.wav`);

          const apiKey = resolveApiKey(speaker.platformId, apiKeys[speaker.platformId]);

          // Per-line TTS timeout
          await Promise.race([
            synthesise({
              text: line.text,
              platformId: speaker.platformId,
              voiceId: speaker.voiceId,
              outputPath: clipPath,
              apiKey,
              speed: speaker.speed,
              pitch: speaker.pitch,
              volume: speaker.volume,
            }),
            new Promise<never>((_, reject) =>
              setTimeout(
                () =>
                  reject(
                    new Error(
                      `TTS timeout for line ${i} (speaker: ${speaker.label})`,
                    ),
                  ),
                TTS_TIMEOUT_MS,
              ),
            ),
          ]);

          clipPaths.push({
            filePath: clipPath,
            overlaps: line.overlaps,
            overlapOffset: line.overlapOffset,
            volume: speaker.volume,
          });
        }

        if (clipPaths.length === 0) {
          emit("error", { message: "No audio clips were generated" });
          controller.close();
          return;
        }

        // Mix
        emit("progress", {
          step: "mixing",
          message: `Mixing ${clipPaths.length} clips…`,
          percent: 85,
        });

        const timeline = await buildTimeline(clipPaths);
        const outputFile = path.join(jobDir, "podcast.mp3");
        await mixAudio(timeline, outputFile);

        // Cleanup individual clips
        await cleanupClips(clipPaths.map((c) => c.filePath));

        // File size check
        const stat = await fs.stat(outputFile);
        if (stat.size > MAX_OUTPUT_BYTES) {
          await fs.rm(jobDir, { recursive: true, force: true });
          emit("error", { message: "Generated podcast is too large (> 200 MB)" });
          controller.close();
          return;
        }

        const audioUrl = `/output/${jobId}/podcast.mp3`;

        emit("progress", { step: "done", message: "Finalising…", percent: 99 });
        emit("done", { audioUrl, podcastId: jobId });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error("[/api/generate]", err);
        // Clean up job directory on failure
        await fs.rm(jobDir, { recursive: true, force: true }).catch(() => undefined);
        emit("error", { message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
