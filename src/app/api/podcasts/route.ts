import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

const OUTPUT_DIR = path.join(process.cwd(), "public", "output");

// ---------------------------------------------------------------------------
// GET /api/podcasts
// Returns a list of previously generated podcasts.
// ---------------------------------------------------------------------------
export async function GET() {
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

    return NextResponse.json({
      podcasts: podcasts.filter(Boolean).sort((a, b) => {
        if (!a || !b) return 0;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/podcasts?id=<podcastId>
// ---------------------------------------------------------------------------
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const dir = path.join(OUTPUT_DIR, id);
  try {
    await fs.rm(dir, { recursive: true, force: true });
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
