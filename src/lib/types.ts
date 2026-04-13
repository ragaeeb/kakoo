// ---------------------------------------------------------------------------
// Kakoo – Multi-speaker TTS Podcast Generator
// Core type definitions
// ---------------------------------------------------------------------------

/** Maximum number of speakers configurable at once */
export const MAX_SPEAKERS = 6;

// ---------------------------------------------------------------------------
// TTS Platforms
// ---------------------------------------------------------------------------

export type TTSPlatformId = "google-gemini" | "macos-say";

export interface TTSPlatform {
  id: TTSPlatformId;
  name: string;
  description: string;
  requiresApiKey: boolean;
  apiKeyLabel?: string;
  apiKeyEnvVar?: string;
  voices: TTSVoice[];
  /** Whether this platform is available in the current environment */
  available: boolean;
}

export interface TTSVoice {
  id: string;
  name: string;
  gender?: "male" | "female" | "neutral";
  preview?: string; // optional preview URL
  language?: string;
}

// ---------------------------------------------------------------------------
// Speaker
// ---------------------------------------------------------------------------

export interface Speaker {
  id: string; // e.g. "speaker-0"
  label: string; // The label used in the script, e.g. "ALICE"
  displayName: string; // User-friendly name shown in UI
  color: string; // Tailwind color class for visual identification
  platformId: TTSPlatformId;
  voiceId: string;
  /** Speed multiplier 0.5 – 2.0 */
  speed: number;
  /** Pitch adjustment -20 to +20 semitones (where supported) */
  pitch: number;
  /** Volume 0.1 – 2.0 */
  volume: number;
}

// ---------------------------------------------------------------------------
// Script parsing
// ---------------------------------------------------------------------------

/**
 * A single utterance parsed from the raw script text.
 *
 * Script format:
 *   ALICE: Hello there!
 *   BOB: [overlaps] Oh hi!
 *   ALICE: How are you doing today?
 *
 * [overlaps] or [overlap] annotation means this line starts while the
 * previous speaker's line is still playing.
 */
export interface ScriptLine {
  index: number;
  speakerLabel: string; // uppercase label matched against Speaker.label
  text: string; // the text to synthesise
  /** When true this line overlaps with the previous one */
  overlaps: boolean;
  /** Overlap offset in seconds (how many seconds into the previous audio this starts) */
  overlapOffset: number;
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

export type GenerationStatus = "idle" | "parsing" | "synthesising" | "mixing" | "done" | "error";

export interface GenerationProgress {
  status: GenerationStatus;
  message: string;
  /** 0–100 */
  percent: number;
  audioUrl?: string;
  error?: string;
  podcastId?: string;
}

// ---------------------------------------------------------------------------
// API request / response shapes
// ---------------------------------------------------------------------------

export interface GeneratePodcastRequest {
  script: string;
  speakers: Speaker[];
}

export interface GeneratePodcastResponse {
  success: boolean;
  podcastId?: string;
  audioUrl?: string;
  error?: string;
}

/** Sent to the individual TTS synthesise route */
export interface SynthesisRequest {
  text: string;
  platformId: TTSPlatformId;
  voiceId: string;
  speed?: number;
  pitch?: number;
  volume?: number;
  apiKey?: string; // passed from client env field
}

export interface SynthesisResponse {
  success: boolean;
  filePath?: string;
  error?: string;
}
