import fs from "node:fs/promises";
import path from "node:path";
import { getEnv } from "@/lib/env";
import { NextResponse } from "next/server";

const OUTPUT_DIR = path.join(process.cwd(), "public", "output");

// PRIVACY WARNING: This endpoint exposes all job IDs to any client that can
// reach it. In a multi-tenant scenario this is a privacy issue — all users
// would see each other's podcasts. For a production multi-user deployment,
// add authentication and filter by user ID.
const MAX_PODCASTS = 50;

// ---------------------------------------------------------------------------
// GET /api/podcasts
// Returns a list of previously generated podcasts (most recent first, capped).
// ---------------------------------------------------------------------------
export async function GET() {
  getEnv();

  try {
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    const entries = await fs.readdir(OUTPUT_DIR, { withFileTypes: true });

    const podcasts = await Promise.all(
      entries
        .filter((e) => e.isDirectory())
        .map(async (dir) => {
          const mp3 = path.join(OUTPUT_DIR, dir.name, "podcast.mp3");
          try {
            const stat = await fs.stat(mp3);
            return {
              id: dir.name,
              audioUrl: `/output/${dir.name}/podcast.mp3`,
              createdAt: stat.mtime.toISOString(),
              sizeBytes: stat.size,
            };
          } catch {
            return null;
          }
        }),
    );

    // Filter nulls with proper typing, sort, and cap
    const valid = (podcasts.filter(Boolean) as NonNullable<(typeof podcasts)[number]>[]).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return NextResponse.json({ podcasts: valid.slice(0, MAX_PODCASTS) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/podcasts?id=<podcastId>
// ---------------------------------------------------------------------------
export async function DELETE(req: Request) {
  getEnv();

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  // Prevent path traversal
  const safe = path.basename(id);
  if (safe !== id || id.includes("..")) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const dir = path.join(OUTPUT_DIR, safe);
  try {
    await fs.rm(dir, { recursive: true, force: true });
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
