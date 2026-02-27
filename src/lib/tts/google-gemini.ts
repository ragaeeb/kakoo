import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// Google AI Studio – Gemini 2.5 Flash TTS
// API: https://ai.google.dev/api/generate-content#v1beta.models.generateContent
// ---------------------------------------------------------------------------

// Update this when the model graduates from preview.
const GEMINI_TTS_MODEL = "gemini-2.5-flash-preview-tts";

export async function synthesiseGemini(opts: {
  text: string;
  voiceId: string;
  outputPath: string;
  apiKey: string;
  speed?: number;
}): Promise<void> {
  const { text, voiceId, outputPath, apiKey, speed = 1.0 } = opts;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TTS_MODEL}:generateContent?key=${apiKey}`;

  const body = {
    contents: [
      {
        parts: [{ text }],
      },
    ],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: voiceId,
          },
        },
      },
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini TTS API error ${response.status}: ${errText}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          inlineData?: { mimeType?: string; data?: string };
        }>;
      };
    }>;
  };

  const inlineData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData;
  if (!inlineData?.data) {
    throw new Error("Gemini TTS: no audio data in response");
  }

  // Parse PCM format from the mimeType field (e.g. "audio/L16;rate=24000;channels=1").
  // Fall back to known defaults if parsing fails.
  const { sampleRate, channels, bitDepth } = parsePcmMimeType(inlineData.mimeType ?? "");

  // The API returns raw PCM (L16 24kHz mono) encoded as base64.
  // We need to wrap it in a WAV container.
  const pcmBuffer = Buffer.from(inlineData.data, "base64");
  const wavBuffer = pcmToWav(pcmBuffer, sampleRate, channels, bitDepth);

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, wavBuffer);

  // Apply speed via ffmpeg atempo if speed !== 1.0.
  // Gemini TTS has no native speed parameter, so we post-process.
  if (Math.abs(speed - 1.0) > 0.001) {
    await applyAtempo(outputPath, speed);
  }
}

// ---------------------------------------------------------------------------
// Parse PCM MIME type
// ---------------------------------------------------------------------------

interface PcmFormat {
  sampleRate: number;
  channels: number;
  bitDepth: number;
}

/**
 * Parse a MIME type like "audio/L16;rate=24000;channels=1" into PCM params.
 * Falls back to 24000 Hz mono 16-bit if parsing fails.
 */
function parsePcmMimeType(mimeType: string): PcmFormat {
  const defaults: PcmFormat = { sampleRate: 24000, channels: 1, bitDepth: 16 };

  if (!mimeType) return defaults;

  const rateMatch = /rate=(\d+)/i.exec(mimeType);
  const channelsMatch = /channels=(\d+)/i.exec(mimeType);
  // L16 = 16-bit, L8 = 8-bit
  const bitDepthMatch = /audio\/L(\d+)/i.exec(mimeType);

  return {
    sampleRate: rateMatch ? Number.parseInt(rateMatch[1], 10) : defaults.sampleRate,
    channels: channelsMatch ? Number.parseInt(channelsMatch[1], 10) : defaults.channels,
    bitDepth: bitDepthMatch ? Number.parseInt(bitDepthMatch[1], 10) : defaults.bitDepth,
  };
}

// ---------------------------------------------------------------------------
// Apply speed via ffmpeg atempo filter
// atempo requires values in [0.5, 2.0]; chain filters for values outside that.
// ---------------------------------------------------------------------------

async function applyAtempo(wavPath: string, speed: number): Promise<void> {
  // Clamp to [0.5, 2.0] range (atempo hard limits)
  const clampedSpeed = Math.max(0.5, Math.min(2.0, speed));

  // Build atempo filter chain. For speed outside [0.5, 2.0] we chain:
  //   speed=0.25 → atempo=0.5,atempo=0.5
  //   speed=4.0  → atempo=2.0,atempo=2.0
  const filters: string[] = [];
  let remaining = speed;

  if (speed < 0.5) {
    // Chain multiple atempo=0.5 filters
    while (remaining < 0.5) {
      filters.push("atempo=0.5");
      remaining /= 0.5;
    }
    if (Math.abs(remaining - 1.0) > 0.001) {
      filters.push(`atempo=${remaining.toFixed(4)}`);
    }
  } else if (speed > 2.0) {
    // Chain multiple atempo=2.0 filters
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

  const filterStr = filters.join(",");
  const tmpPath = `${wavPath}.tmp.wav`;

  await execFileAsync("ffmpeg", ["-y", "-i", wavPath, "-filter:a", filterStr, tmpPath]);

  // Overwrite original with speed-adjusted version
  await fs.rename(tmpPath, wavPath);
}

// ---------------------------------------------------------------------------
// Minimal PCM → WAV wrapper (little-endian RIFF)
// ---------------------------------------------------------------------------
function pcmToWav(pcm: Buffer, sampleRate: number, channels: number, bitDepth: number): Buffer {
  const byteRate = (sampleRate * channels * bitDepth) / 8;
  const blockAlign = (channels * bitDepth) / 8;
  const dataSize = pcm.length;
  const fileSize = 44 + dataSize;

  const wav = Buffer.alloc(fileSize);

  // RIFF header
  wav.write("RIFF", 0, "ascii");
  wav.writeUInt32LE(fileSize - 8, 4);
  wav.write("WAVE", 8, "ascii");

  // fmt chunk
  wav.write("fmt ", 12, "ascii");
  wav.writeUInt32LE(16, 16); // chunk size
  wav.writeUInt16LE(1, 20); // PCM
  wav.writeUInt16LE(channels, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(byteRate, 28);
  wav.writeUInt16LE(blockAlign, 32);
  wav.writeUInt16LE(bitDepth, 34);

  // data chunk
  wav.write("data", 36, "ascii");
  wav.writeUInt32LE(dataSize, 40);
  pcm.copy(wav, 44);

  return wav;
}
