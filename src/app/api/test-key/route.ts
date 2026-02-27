import { getEnv } from "@/lib/env";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// GET /api/test-key?platform=google-gemini&key=xxx
// Validates an API key by making a minimal call to the provider.
// Returns { valid: boolean, error?: string }
// NEVER logs the key value.
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  getEnv(); // validate env on every request

  const { searchParams } = new URL(req.url);
  const platform = searchParams.get("platform");
  const key = searchParams.get("key")?.trim();

  if (!platform) {
    return NextResponse.json({ valid: false, error: "platform parameter is required" }, { status: 400 });
  }

  if (!key) {
    return NextResponse.json({ valid: false, error: "key parameter is required" }, { status: 400 });
  }

  try {
    switch (platform) {
      case "google-gemini": {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`,
          { method: "GET" },
        );
        if (res.ok) {
          return NextResponse.json({ valid: true });
        }
        let errMsg = `HTTP ${res.status}`;
        try {
          const errJson = (await res.json()) as { error?: { message?: string } };
          errMsg = errJson.error?.message ?? errMsg;
        } catch {
          errMsg = await res.text().catch(() => errMsg);
        }
        return NextResponse.json({ valid: false, error: errMsg });
      }

      case "elevenlabs": {
        const res = await fetch("https://api.elevenlabs.io/v1/user", {
          method: "GET",
          headers: { "xi-api-key": key },
        });
        if (res.ok) {
          return NextResponse.json({ valid: true });
        }
        let errMsg = `HTTP ${res.status}`;
        try {
          const errJson = (await res.json()) as { detail?: { message?: string } | string };
          if (typeof errJson.detail === "string") {
            errMsg = errJson.detail;
          } else {
            errMsg = errJson.detail?.message ?? errMsg;
          }
        } catch {
          errMsg = await res.text().catch(() => errMsg);
        }
        return NextResponse.json({ valid: false, error: errMsg });
      }

      default:
        return NextResponse.json(
          { valid: false, error: `Unknown platform: ${platform}` },
          { status: 400 },
        );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Network error";
    return NextResponse.json({ valid: false, error: message }, { status: 500 });
  }
}
