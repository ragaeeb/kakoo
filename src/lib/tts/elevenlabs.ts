import fs from "node:fs/promises";
import path from "node:path";

// ---------------------------------------------------------------------------
// ElevenLabs TTS
// Docs: https://elevenlabs.io/docs/api-reference/text-to-speech
// ---------------------------------------------------------------------------

// Update this when a newer turbo model is released.
const ELEVENLABS_MODEL = "eleven_turbo_v2_5";

export async function synthesiseElevenLabs(opts: {
  text: string;
  voiceId: string;
  outputPath: string;
  apiKey: string;
  speed?: number;
}): Promise<void> {
  const { text, voiceId, outputPath, apiKey, speed = 1.0 } = opts;

  // ElevenLabs clamps speed to [0.7, 1.2].
  // The speaker config allows [0.5, 2.0] — values outside ElevenLabs' range
  // will be silently clamped. Use Gemini TTS or macOS Say for wider speed range.
  const clampedSpeed = Math.max(0.7, Math.min(1.2, speed));
  if (speed < 0.7 || speed > 1.2) {
    console.warn(
      `[ElevenLabs] Requested speed ${speed} is outside the supported range [0.7, 1.2]. Clamping to ${clampedSpeed}.`,
    );
  }

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

  const body = {
    text,
    model_id: ELEVENLABS_MODEL,
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.75,
      style: 0.0,
      use_speaker_boost: true,
      speed: clampedSpeed,
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": apiKey,
      Accept: "audio/mpeg",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    // ElevenLabs returns JSON errors; fall back to text if JSON parsing fails.
    let errBody: string;
    try {
      const errJson = (await response.json()) as {
        detail?: { message?: string } | string;
      };
      if (typeof errJson.detail === "string") {
        errBody = errJson.detail;
      } else {
        errBody = errJson.detail?.message ?? JSON.stringify(errJson);
      }
    } catch {
      errBody = await response.text();
    }
    throw new Error(`ElevenLabs TTS API error ${response.status}: ${errBody}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, buffer);
}
