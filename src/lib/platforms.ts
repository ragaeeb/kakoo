import type { TTSPlatform } from "./types";

// ---------------------------------------------------------------------------
// Platform registry
// Keep voices in alphabetical order per platform.
// ---------------------------------------------------------------------------

export const PLATFORMS: TTSPlatform[] = [
  // -------------------------------------------------------------------------
  // Google AI Studio – Gemini 2.5 TTS (Preview)
  // -------------------------------------------------------------------------
  {
    id: "google-gemini",
    name: "Google Gemini 2.5 TTS",
    description: "Google AI Studio – Gemini 2.5 Flash TTS Preview",
    requiresApiKey: true,
    apiKeyLabel: "Google AI Studio API Key",
    apiKeyEnvVar: "GOOGLE_AI_API_KEY",
    available: true,
    voices: [
      { id: "Aoede", name: "Aoede", gender: "female" },
      { id: "Charon", name: "Charon", gender: "male" },
      { id: "Fenrir", name: "Fenrir", gender: "male" },
      { id: "Kore", name: "Kore", gender: "female" },
      { id: "Leda", name: "Leda", gender: "female" },
      { id: "Orus", name: "Orus", gender: "male" },
      { id: "Puck", name: "Puck", gender: "male" },
      { id: "Schedar", name: "Schedar", gender: "male" },
      { id: "Zephyr", name: "Zephyr", gender: "female" },
    ],
  },

  // -------------------------------------------------------------------------
  // ElevenLabs
  // -------------------------------------------------------------------------
  {
    id: "elevenlabs",
    name: "ElevenLabs",
    description: "High-quality neural TTS with expressive voices",
    requiresApiKey: true,
    apiKeyLabel: "ElevenLabs API Key",
    apiKeyEnvVar: "ELEVENLABS_API_KEY",
    available: true,
    voices: [
      { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", gender: "female" },
      { id: "AZnzlk1XvdvUeBnXmlld", name: "Domi", gender: "female" },
      { id: "EXAVITQu4vr4xnSDxMaL", name: "Bella", gender: "female" },
      { id: "ErXwobaYiN019PkySvjV", name: "Antoni", gender: "male" },
      { id: "MF3mGyEYCl7XYWbV9V6O", name: "Elli", gender: "female" },
      { id: "TxGEqnHWrfWFTfGW9XjX", name: "Josh", gender: "male" },
      { id: "VR6AewLTigWG4xSOukaG", name: "Arnold", gender: "male" },
      { id: "pNInz6obpgDQGcFmaJgB", name: "Adam", gender: "male" },
      { id: "yoZ06aMxZJJ28mfd3POQ", name: "Sam", gender: "male" },
    ],
  },

  // -------------------------------------------------------------------------
  // macOS native TTS (say command)
  // -------------------------------------------------------------------------
  {
    id: "macos-say",
    name: "macOS Say (Local)",
    description: "Built-in macOS speech synthesis – no API key required",
    requiresApiKey: false,
    available: process.platform === "darwin",
    voices: [
      { id: "Alex", name: "Alex", gender: "male", language: "en-US" },
      { id: "Allison", name: "Allison", gender: "female", language: "en-US" },
      { id: "Ava", name: "Ava", gender: "female", language: "en-US" },
      { id: "Daniel", name: "Daniel", gender: "male", language: "en-GB" },
      { id: "Fred", name: "Fred", gender: "male", language: "en-US" },
      { id: "Karen", name: "Karen", gender: "female", language: "en-AU" },
      { id: "Moira", name: "Moira", gender: "female", language: "en-IE" },
      { id: "Rishi", name: "Rishi", gender: "male", language: "en-IN" },
      { id: "Samantha", name: "Samantha", gender: "female", language: "en-US" },
      { id: "Tessa", name: "Tessa", gender: "female", language: "en-ZA" },
      { id: "Tom", name: "Tom", gender: "male", language: "en-US" },
      { id: "Veena", name: "Veena", gender: "female", language: "en-IN" },
      { id: "Victoria", name: "Victoria", gender: "female", language: "en-US" },
    ],
  },

  // -------------------------------------------------------------------------
  // Local Python TTS – placeholder for future support
  // -------------------------------------------------------------------------
  {
    id: "local-python",
    name: "Local Python TTS",
    description: "Run a local Python TTS server (coming soon)",
    requiresApiKey: false,
    available: false,
    voices: [],
  },
];

export function getPlatform(id: string): TTSPlatform | undefined {
  return PLATFORMS.find((p) => p.id === id);
}

export function getAvailablePlatforms(): TTSPlatform[] {
  return PLATFORMS.filter((p) => p.available);
}
