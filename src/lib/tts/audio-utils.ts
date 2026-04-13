import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function applyAtempo(audioPath: string, speed: number): Promise<void> {
  const clampedSpeed = Math.max(0.5, Math.min(2.0, speed));
  const filters: string[] = [];
  let remaining = speed;

  if (speed < 0.5) {
    while (remaining < 0.5) {
      filters.push("atempo=0.5");
      remaining /= 0.5;
    }
    if (Math.abs(remaining - 1.0) > 0.001) {
      filters.push(`atempo=${remaining.toFixed(4)}`);
    }
  } else if (speed > 2.0) {
    while (remaining > 2.0) {
      filters.push("atempo=2.0");
      remaining /= 2.0;
    }
    if (Math.abs(remaining - 1.0) > 0.001) {
      filters.push(`atempo=${remaining.toFixed(4)}`);
    }
  } else {
    filters.push(`atempo=${clampedSpeed.toFixed(4)}`);
  }

  const { dir, name, ext } = path.parse(audioPath);
  const tmpPath = path.join(dir, `${name}.tmp${ext || ".wav"}`);

  await execFileAsync("ffmpeg", ["-y", "-i", audioPath, "-filter:a", filters.join(","), tmpPath]);
  await fs.rename(tmpPath, audioPath);
}

