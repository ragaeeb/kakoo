import fs from "node:fs/promises";
import path from "node:path";

// ---------------------------------------------------------------------------
// ElevenLabs TTS
// Docs: https://elevenlabs.io/docs/api-reference/text-to-speech
// ---------------------------------------------------------------------------

export async function synthesiseElevenLabs(opts: {
  text: string;
  voiceId: string;
  outputPath: string;
  apiKey: string;
  speed?: number;
}): Promise<void> {
  const { text, voiceId, outputPath, apiKey, speed = 1.0 } = opts;

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

  const body = {
    text,
    model_id: "eleven_turbo_v2_5",
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.75,
      style: 0.0,
      use_speaker_boost: true,
      speed: Math.max(0.7, Math.min(1.2, speed)), // ElevenLabs clamps speed
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
    const errText = await response.text();
    throw new Error(`ElevenLabs TTS API error ${response.status}: ${errText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, buffer);
}
