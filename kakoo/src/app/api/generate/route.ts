import fs from "node:fs/promises";
import path from "node:path";
import { buildTimeline, mixAudio } from "@/lib/audio-mixer";
import { parseScript } from "@/lib/script-parser";
import { synthesise } from "@/lib/tts";
import type { GeneratePodcastRequest, Speaker } from "@/lib/types";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { v4 as uuidv4 } from "uuid";

// ---------------------------------------------------------------------------
// POST /api/generate
// Body: GeneratePodcastRequest
// ---------------------------------------------------------------------------

const OUTPUT_DIR = path.join(process.cwd(), "public", "output");

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as GeneratePodcastRequest & {
      apiKeys?: Record<string, string>;
    };

    const { script, speakers, apiKeys = {} } = body;

    if (!script?.trim()) {
      return NextResponse.json({ success: false, error: "Script is required" }, { status: 400 });
    }

    if (!speakers?.length) {
      return NextResponse.json(
        { success: false, error: "At least one speaker is required" },
        { status: 400 },
      );
    }

    // Parse the script into lines
    const lines = parseScript(script);
    if (lines.length === 0) {
      return NextResponse.json(
        { success: false, error: "No valid script lines found" },
        { status: 400 },
      );
    }

    // Create a job directory
    const jobId = uuidv4();
    const jobDir = path.join(OUTPUT_DIR, jobId);
    await fs.mkdir(jobDir, { recursive: true });

    // Build a lookup map for speakers by label
    const speakerMap = new Map<string, Speaker>(speakers.map((s) => [s.label.toUpperCase(), s]));

    // Synthesise each line
    const clipPaths: Array<{
      filePath: string;
      overlaps: boolean;
      overlapOffset: number;
      volume: number;
    }> = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const speaker = speakerMap.get(line.speakerLabel.toUpperCase());

      if (!speaker) {
        console.warn(`Speaker "${line.speakerLabel}" not found in config – skipping line ${i}`);
        continue;
      }

      const ext = speaker.platformId === "elevenlabs" ? "mp3" : "wav";
      const clipPath = path.join(jobDir, `clip_${String(i).padStart(3, "0")}.${ext}`);

      const apiKey =
        apiKeys[speaker.platformId] ||
        process.env[`${speaker.platformId.toUpperCase().replace(/-/g, "_")}_API_KEY`] ||
        "";

      await synthesise({
        text: line.text,
        platformId: speaker.platformId,
        voiceId: speaker.voiceId,
        outputPath: clipPath,
        apiKey,
        speed: speaker.speed,
        pitch: speaker.pitch,
        volume: speaker.volume,
      });

      clipPaths.push({
        filePath: clipPath,
        overlaps: line.overlaps,
        overlapOffset: line.overlapOffset,
        volume: speaker.volume,
      });
    }

    if (clipPaths.length === 0) {
      return NextResponse.json(
        { success: false, error: "No audio clips were generated" },
        { status: 500 },
      );
    }

    // Build timeline and mix
    const timeline = await buildTimeline(clipPaths);
    const outputFile = path.join(jobDir, "podcast.mp3");
    await mixAudio(timeline, outputFile);

    // The audio URL is served from /public/output/...
    const audioUrl = `/output/${jobId}/podcast.mp3`;

    return NextResponse.json({
      success: true,
      podcastId: jobId,
      audioUrl,
    });
  } catch (err) {
    console.error("[/api/generate]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
