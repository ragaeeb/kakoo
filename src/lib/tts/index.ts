import type { TTSPlatformId } from "../types";
import { synthesiseDia } from "./dia";
import { synthesiseElevenLabs } from "./elevenlabs";
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

    case "elevenlabs":
      if (!opts.apiKey) throw new Error("ElevenLabs TTS requires an API key");
      await synthesiseElevenLabs({
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

    case "dia":
      await synthesiseDia({
        text: opts.text,
        voiceId: opts.voiceId,
        outputPath: opts.outputPath,
        speed: opts.speed,
      });
      break;

    case "local-python":
      throw new Error(
        "Local Python TTS is not implemented. Use the Dia platform for local open-source TTS.",
      );

    default:
      throw new Error(`Unknown TTS platform: ${opts.platformId}`);
  }
}
