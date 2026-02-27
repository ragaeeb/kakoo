import type { ScriptLine } from "./types";

// ---------------------------------------------------------------------------
// Script parser
//
// Supported format:
//   SPEAKER_LABEL: dialogue text here
//   SPEAKER_LABEL: [overlaps] dialogue text here
//   SPEAKER_LABEL: [overlap 1.5s] dialogue text here  (custom offset)
//
// Rules:
//   • Speaker labels are UPPERCASE words (letters, digits, hyphens, underscores)
//     followed by a colon and a space.
//   • [overlaps] / [overlap] / [overlap Xs] annotation appears right after the
//     colon+space and before the actual text.
//   • Lines starting with # or // are comments and are ignored.
//   • Empty lines are ignored.
// ---------------------------------------------------------------------------

const SPEAKER_RE = /^([A-Z][A-Z0-9_\-]*):\s+(.+)$/;
const OVERLAP_RE = /^\[overlap(?:s)?(?:\s+([\d.]+)s?)?\]\s*/i;

export function parseScript(raw: string): ScriptLine[] {
  const lines = raw.split("\n");
  const result: ScriptLine[] = [];
  let index = 0;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) {
      continue;
    }

    const match = SPEAKER_RE.exec(trimmed);
    if (!match) {
      // Not a speaker line – skip silently (could be stage directions etc.)
      continue;
    }

    const speakerLabel = match[1];
    let rest = match[2];

    // Detect overlap annotation
    let overlaps = false;
    let overlapOffset = 0.5; // default overlap offset in seconds

    const overlapMatch = OVERLAP_RE.exec(rest);
    if (overlapMatch) {
      overlaps = true;
      if (overlapMatch[1]) {
        overlapOffset = Number.parseFloat(overlapMatch[1]);
      }
      rest = rest.slice(overlapMatch[0].length).trim();
    }

    if (rest) {
      result.push({
        index: index++,
        speakerLabel,
        text: rest,
        overlaps,
        overlapOffset,
      });
    }
  }

  return result;
}

/**
 * Extract all unique speaker labels from a raw script string.
 * Returns them in the order they first appear.
 */
export function extractSpeakers(raw: string): string[] {
  const lines = raw.split("\n");
  const seen = new Set<string>();
  const order: string[] = [];

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) continue;
    const match = SPEAKER_RE.exec(trimmed);
    if (match && !seen.has(match[1])) {
      seen.add(match[1]);
      order.push(match[1]);
    }
  }

  return order;
}
