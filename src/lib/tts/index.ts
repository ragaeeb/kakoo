import type { TTSPlatformId } from "../types";
import { synthesiseGemini } from "./google-gemini";
import { synthesiseMacOSSay } from "./macos-say";

// ---------------------------------------------------------------------------
// Unified synthesis entry-point
// ---------------------------------------------------------------------------

export interface SynthesisOptions {
  text: string;
  platformId: TTSPlatformId;
  voiceId: string;
  outputPath: string;
  apiKey?: string;
  speed?: number;
  pitch?: number;
  volume?: number;
}

export async function synthesise(opts: SynthesisOptions): Promise<void> {
  switch (opts.platformId) {
    case "google-gemini":
      if (!opts.apiKey) throw new Error("Google Gemini TTS requires an API key");
      await synthesiseGemini({
        text: opts.text,
        voiceId: opts.voiceId,
        outputPath: opts.outputPath,
        apiKey: opts.apiKey,
        speed: opts.speed,
      });
      break;

    case "macos-say":
      await synthesiseMacOSSay({
        text: opts.text,
        voiceId: opts.voiceId,
        outputPath: opts.outputPath,
        speed: opts.speed,
        pitch: opts.pitch,
      });
      break;

    default:
      throw new Error(`Unknown TTS platform: ${opts.platformId}`);
  }
}
