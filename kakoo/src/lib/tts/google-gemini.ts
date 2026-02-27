import fs from "node:fs/promises";
import path from "node:path";

// ---------------------------------------------------------------------------
// Google AI Studio – Gemini 2.5 Flash TTS
// API: https://ai.google.dev/api/generate-content#v1beta.models.generateContent
// ---------------------------------------------------------------------------

export async function synthesiseGemini(opts: {
  text: string;
  voiceId: string;
  outputPath: string;
  apiKey: string;
  speed?: number;
}): Promise<void> {
  const { text, voiceId, outputPath, apiKey } = opts;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`;

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

  // The API returns raw PCM (L16 24kHz mono) encoded as base64.
  // We need to wrap it in a WAV container.
  const pcmBuffer = Buffer.from(inlineData.data, "base64");
  const wavBuffer = pcmToWav(pcmBuffer, 24000, 1, 16);

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, wavBuffer);
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
