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
//     followed by a colon and optional whitespace.
//   • [overlaps] / [overlap] / [overlap Xs] annotation appears right after the
//     colon+space and before the actual text.
//   • Lines starting with # or // are comments and are ignored.
//   • Empty lines are ignored.
//   • Unrecognised non-empty lines are collected as warnings.
// ---------------------------------------------------------------------------

// \s* (zero or more spaces) so `BOB:text` and `BOB: text` both match.
const SPEAKER_RE = /^([A-Z][A-Z0-9_\-]*):\s*(.+)$/;
const OVERLAP_RE = /^\[overlap(?:s)?(?:\s+([\d.]+)s?)?\]\s*/i;

export interface ParseScriptResult {
  lines: ScriptLine[];
  warnings: string[];
}

export function parseScript(raw: string): ParseScriptResult {
  const rawLines = raw.split("\n");
  const result: ScriptLine[] = [];
  const warnings: string[] = [];
  let index = 0;

  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) {
      continue;
    }

    const match = SPEAKER_RE.exec(trimmed);
    if (!match) {
      // Collect unrecognised non-empty lines as warnings so callers can
      // surface them to the user (e.g. `bob: hello` with lowercase label).
      warnings.push(trimmed);
      continue;
    }

    const speakerLabel = match[1];
    let rest = match[2].trim();

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

  return { lines: result, warnings };
}

/**
 * Extract all unique speaker labels from already-parsed ScriptLines.
 * Returns them in the order they first appear.
 */
export function extractSpeakersFromLines(lines: ScriptLine[]): string[] {
  const seen = new Set<string>();
  const order: string[] = [];
  for (const line of lines) {
    if (!seen.has(line.speakerLabel)) {
      seen.add(line.speakerLabel);
      order.push(line.speakerLabel);
    }
  }
  return order;
}

/**
 * @deprecated Use parseScript + extractSpeakersFromLines instead.
 * Kept for backwards compatibility.
 */
export function extractSpeakers(raw: string): string[] {
  const { lines } = parseScript(raw);
  return extractSpeakersFromLines(lines);
}
