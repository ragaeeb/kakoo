// ---------------------------------------------------------------------------
// Kakoo – Client-side API key storage with AES-GCM encryption
//
// SECURITY NOTE: This protects against casual shoulder-surfing and browser
// history inspection (keys are never stored in plaintext). It is NOT suitable
// for multi-user or shared-machine contexts — anyone with access to the
// browser's DevTools can extract the keys. For production deployments on
// Vercel/Cloudflare, set keys as server-side environment variables instead:
//   GOOGLE_AI_API_KEY
// Server-side env vars take priority over keys stored here.
// ---------------------------------------------------------------------------

const STORAGE_KEY = "kakoo_api_keys";
const KEY_MATERIAL = "kakoo-key-v1";

/** Derive an AES-GCM CryptoKey from the app secret + origin. */
async function deriveKey(): Promise<CryptoKey> {
  const origin = typeof window !== "undefined" ? window.location.origin : "localhost";
  const raw = new TextEncoder().encode(`${KEY_MATERIAL}:${origin}`);

  // Import as raw key material for PBKDF2-style derivation
  const baseKey = await window.crypto.subtle.importKey("raw", raw, "PBKDF2", false, [
    "deriveKey",
  ]);

  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode("kakoo-salt-v1"),
      iterations: 100_000,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function bufferToBase64(buf: ArrayBuffer | Uint8Array<ArrayBuffer>): string {
  const bytes = buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf;
  return btoa(String.fromCharCode(...bytes));
}

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return new Uint8Array(bytes);
}

export class KeyStore {
  /** Encrypt and persist keys to localStorage. */
  static async save(keys: Record<string, string>): Promise<void> {
    if (typeof window === "undefined") return;

    const cryptoKey = await deriveKey();
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const plaintext = new TextEncoder().encode(JSON.stringify(keys));

    const ciphertext = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      cryptoKey,
      plaintext,
    );

    const payload = JSON.stringify({
      iv: bufferToBase64(iv),
      ct: bufferToBase64(ciphertext),
    });

    localStorage.setItem(STORAGE_KEY, payload);
  }

  /** Decrypt and return stored keys. Returns {} on any error or missing key. */
  static async load(): Promise<Record<string, string>> {
    if (typeof window === "undefined") return {};

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};

      const { iv, ct } = JSON.parse(raw) as { iv: string; ct: string };
      const cryptoKey = await deriveKey();

      const plaintext = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: base64ToBytes(iv) },
        cryptoKey,
        base64ToBytes(ct),
      );

      return JSON.parse(new TextDecoder().decode(plaintext)) as Record<string, string>;
    } catch {
      // Decryption failure (wrong origin, corrupted data, etc.) — return empty
      return {};
    }
  }

  /** Remove stored keys from localStorage. */
  static clear(): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem(STORAGE_KEY);
  }
}
