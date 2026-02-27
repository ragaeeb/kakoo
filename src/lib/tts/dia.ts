import fs from "node:fs/promises";
import path from "node:path";

// ---------------------------------------------------------------------------
// Dia TTS – Local Gradio server integration
//
// Dia is an open-source multi-speaker TTS model by Nari Labs.
// This implementation POSTs to a local Gradio endpoint (default port 7860).
//
// To use:
//   1. Run the Dia server: `python -m dia.server`
//      OR use the HuggingFace Space: https://huggingface.co/spaces/nari-labs/Dia-1.6B
//   2. Set DIA_API_URL env var if using a non-default URL (e.g. ngrok tunnel).
// ---------------------------------------------------------------------------

const DEFAULT_DIA_URL = "http://localhost:7860";

export async function synthesiseDia(opts: {
  text: string;
  voiceId: string; // "S1" or "S2"
  outputPath: string;
  speed?: number;
}): Promise<void> {
  const { text, voiceId, outputPath, speed = 1.0 } = opts;

  const baseUrl = process.env.DIA_API_URL ?? DEFAULT_DIA_URL;

  // Map voiceId to speaker index (S1 → 0, S2 → 1)
  const speakerIndex = voiceId === "S2" ? 1 : 0;

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fn_index: 0,
        data: [text, speakerIndex, speed],
      }),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Dia TTS requires a local Dia server. Run: \`python -m dia.server\` or use the HuggingFace Space. (Connection error: ${msg})`,
    );
  }

  if (!response.ok) {
    let errBody: string;
    try {
      const errJson = (await response.json()) as { error?: string };
      errBody = errJson.error ?? `HTTP ${response.status}`;
    } catch {
      errBody = await response.text().catch(() => `HTTP ${response.status}`);
    }
    throw new Error(`Dia TTS API error ${response.status}: ${errBody}`);
  }

  const result = (await response.json()) as {
    data?: Array<{ name?: string; data?: string; is_file?: boolean }>;
  };

  const audioData = result.data?.[0];
  if (!audioData) {
    throw new Error("Dia TTS: no audio data in response");
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  if (audioData.is_file && audioData.name) {
    // Gradio returned a file path — fetch it
    const fileRes = await fetch(`${baseUrl}/file=${audioData.name}`);
    if (!fileRes.ok) {
      throw new Error(`Dia TTS: failed to fetch audio file: HTTP ${fileRes.status}`);
    }
    const buf = Buffer.from(await fileRes.arrayBuffer());
    await fs.writeFile(outputPath, buf);
  } else if (audioData.data) {
    // Inline base64 data
    const buf = Buffer.from(audioData.data.replace(/^data:[^;]+;base64,/, ""), "base64");
    await fs.writeFile(outputPath, buf);
  } else {
    throw new Error("Dia TTS: unrecognised audio response format");
  }
}
