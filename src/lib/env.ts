// ---------------------------------------------------------------------------
// Kakoo – Environment variable validation
//
// Call `validateEnv()` at the top of every API route to get a typed,
// validated env object. Fails with a readable message if required keys
// are missing at request time.
// ---------------------------------------------------------------------------

export interface KakooEnv {
  GOOGLE_AI_API_KEY: string | undefined;
  NODE_ENV: string;
}

/**
 * Returns a validated snapshot of the environment variables Kakoo needs.
 * Throws a descriptive error if any *required* variable is missing.
 *
 * Currently all TTS keys are optional at the env level (they can be supplied
 * per-request from the client's KeyStore). Only NODE_ENV is always present.
 */
export function getEnv(): KakooEnv {
  return {
    GOOGLE_AI_API_KEY: process.env.GOOGLE_AI_API_KEY,
    NODE_ENV: process.env.NODE_ENV ?? "development",
  };
}

/**
 * Resolve the API key for a given platform.
 * Priority: server-side env var > client-supplied key.
 */
export function resolveApiKey(
  platformId: string,
  clientKey: string | undefined,
): string {
  const env = getEnv();
  const envVarName = platformEnvVar(platformId);
  const envKey = envVarName ? env[envVarName] : undefined;
  return (envKey ?? clientKey ?? "").trim();
}

function platformEnvVar(platformId: string): keyof KakooEnv | null {
  switch (platformId) {
    case "google-gemini":
      return "GOOGLE_AI_API_KEY";
    default:
      return null;
  }
}
