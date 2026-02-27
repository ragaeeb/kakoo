import { exec } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execAsync = promisify(exec);

// ---------------------------------------------------------------------------
// macOS native TTS via the `say` command
// Output is AIFF then converted to WAV via `afconvert`
// ---------------------------------------------------------------------------

export async function synthesiseMacOSSay(opts: {
  text: string;
  voiceId: string;
  outputPath: string;
  speed?: number; // words per minute, default ~180
  pitch?: number; // not directly supported by say; kept for interface compat
}): Promise<void> {
  if (process.platform !== "darwin") {
    throw new Error("macOS Say TTS is only available on macOS");
  }

  const { text, voiceId, outputPath, speed = 1.0 } = opts;

  // `say` uses words-per-minute; default ≈ 175 wpm → scale by speed multiplier
  const wpm = Math.round(175 * speed);

  // say writes AIFF, we write to a temp path then convert
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  const aiffPath = outputPath.replace(/\.[^.]+$/, ".aiff");

  // Escape text for shell
  const escaped = text.replace(/'/g, "'\\''");
  const cmd = `say -v "${voiceId}" -r ${wpm} -o "${aiffPath}" '${escaped}'`;

  await execAsync(cmd);

  // Convert AIFF → WAV using afconvert (macOS built-in)
  await execAsync(`afconvert -f WAVE -d LEI16@44100 "${aiffPath}" "${outputPath}"`);

  // Clean up the temporary AIFF
  await fs.unlink(aiffPath).catch(() => undefined);
}
