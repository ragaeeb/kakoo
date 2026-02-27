import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// Audio mixer using ffmpeg
//
// Strategy:
//   1. For each ScriptLine we have a synthesised audio clip.
//   2. We compute a timeline:
//      • Non-overlapping lines are concatenated with optional silence padding.
//      • Lines annotated with [overlaps] are placed starting N seconds before
//        the end of the previous line (simulating talking over each other).
//   3. We use ffmpeg's `amix` + `adelay` filters to layer all clips at the
//      correct timestamps, then normalise and export as MP3.
//
// Security: All exec calls use execFile with argument arrays — never string
// interpolation — to prevent shell injection from user-supplied file paths.
// ---------------------------------------------------------------------------

export interface MixClip {
  filePath: string;
  /** Start time in the output timeline (seconds) */
  startTime: number;
  /** Volume multiplier 0.1 – 2.0 */
  volume: number;
}

/**
 * Build the mix timeline from synthesised clips.
 * Returns an array of MixClip with computed startTimes.
 *
 * Duration results are cached in a Map to avoid probing the same file twice.
 */
export async function buildTimeline(
  clips: Array<{
    filePath: string;
    overlaps: boolean;
    overlapOffset: number;
    volume: number;
  }>,
): Promise<MixClip[]> {
  const timeline: MixClip[] = [];
  let cursor = 0; // current end of timeline in seconds
  const durationCache = new Map<string, number>();

  async function cachedDuration(filePath: string): Promise<number> {
    const cached = durationCache.get(filePath);
    if (cached !== undefined) return cached;
    const dur = await getAudioDuration(filePath);
    durationCache.set(filePath, dur);
    return dur;
  }

  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    const duration = await cachedDuration(clip.filePath);

    let startTime: number;

    if (clip.overlaps && timeline.length > 0) {
      // Use the LAST entry in the timeline (not clips[i-1]) so indices stay
      // in sync even when some clips were skipped (speaker not found).
      const prevEntry = timeline[timeline.length - 1];
      const prevDuration = await cachedDuration(prevEntry.filePath);
      startTime = Math.max(0, prevEntry.startTime + prevDuration - clip.overlapOffset);
    } else {
      startTime = cursor;
    }

    timeline.push({
      filePath: clip.filePath,
      startTime,
      volume: clip.volume,
    });

    cursor = Math.max(cursor, startTime + duration);
  }

  return timeline;
}

/**
 * Mix all clips into a single output MP3 file using ffmpeg.
 * The output directory must already exist (created by the route handler).
 */
export async function mixAudio(clips: MixClip[], outputPath: string): Promise<void> {
  if (clips.length === 0) throw new Error("No clips to mix");

  // NOTE: mkdir is intentionally NOT called here — the route handler creates
  // the job directory with { recursive: true } before calling mixAudio.

  if (clips.length === 1) {
    // Single clip – just convert/copy
    await execFileAsync("ffmpeg", [
      "-y",
      "-i",
      clips[0].filePath,
      "-ar",
      "44100",
      "-ac",
      "2",
      "-b:a",
      "192k",
      outputPath,
    ]);
    return;
  }

  // Build ffmpeg filtergraph:
  //   [0:a]adelay=Xms|Xms,volume=V[a0];
  //   [1:a]adelay=Yms|Yms,volume=V[a1];
  //   ...
  //   [a0][a1]...amix=inputs=N:normalize=0[out]

  const inputArgs: string[] = [];
  for (const c of clips) {
    inputArgs.push("-i", c.filePath);
  }

  const filterParts: string[] = [];
  const labels: string[] = [];

  for (let i = 0; i < clips.length; i++) {
    const delayMs = Math.round(clips[i].startTime * 1000);
    const vol = clips[i].volume.toFixed(3);
    const label = `a${i}`;
    // The filter string is a single argument — not shell-interpreted
    filterParts.push(`[${i}:a]adelay=${delayMs}|${delayMs},volume=${vol}[${label}]`);
    labels.push(`[${label}]`);
  }

  const mixLabel = "[out]";
  filterParts.push(
    `${labels.join("")}amix=inputs=${clips.length}:normalize=0:dropout_transition=0${mixLabel}`,
  );

  const filterGraph = filterParts.join(";");

  await execFileAsync("ffmpeg", [
    "-y",
    ...inputArgs,
    "-filter_complex",
    filterGraph,
    "-map",
    mixLabel,
    "-ar",
    "44100",
    "-ac",
    "2",
    "-b:a",
    "192k",
    outputPath,
  ]);
}

/**
 * Delete individual clip files after a successful mix.
 * Uses allSettled so a single failure doesn't abort the rest.
 */
export async function cleanupClips(clipPaths: string[]): Promise<void> {
  await Promise.allSettled(clipPaths.map((p) => fs.unlink(p)));
}

/**
 * Get the duration of an audio file in seconds using ffprobe.
 */
export async function getAudioDuration(filePath: string): Promise<number> {
  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v",
      "quiet",
      "-show_entries",
      "format=duration",
      "-of",
      "csv=p=0",
      filePath,
    ]);
    const duration = Number.parseFloat(stdout.trim());
    if (Number.isNaN(duration)) throw new Error("Could not parse duration");
    return duration;
  } catch {
    // Fallback: estimate from file size (rough approximation for WAV/MP3)
    const stat = await fs.stat(filePath);
    // Assume 44100 Hz stereo 16-bit PCM as worst-case fallback
    return stat.size / (44100 * 2 * 2);
  }
}
