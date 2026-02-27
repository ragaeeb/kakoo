"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { extractSpeakersFromLines, parseScript } from "@/lib/script-parser";
import type { ScriptLine } from "@/lib/types";
import { AlertCircle, ChevronRight, FileText, Info } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getSpeakerColorClasses } from "./SpeakerCard";

interface ScriptEditorProps {
  value: string;
  onChange: (val: string) => void;
  detectedSpeakers: string[];
  onSpeakersDetected: (speakers: string[]) => void;
}

const EXAMPLE_SCRIPT = `ALICE: Welcome to Kakoo! Today we're talking about AI voice technology.
BOB: I've been really excited about this. The quality of synthetic voices has improved so much.
ALICE: Absolutely. And the ability to have multiple speakers makes podcasts feel so much more natural.
BOB: [overlaps] And they can even talk over each other!
ALICE: [overlaps 1.0s] Exactly! Just like real conversations.
BOB: So how does Kakoo actually work?
ALICE: Great question. You write a script with speaker labels, pick a voice for each speaker, and Kakoo handles all the synthesis and mixing.
BOB: That's pretty impressive. Does it support different TTS engines?
ALICE: Yes — Google Gemini, ElevenLabs, and even the built-in macOS voices. More coming soon.`;

export function ScriptEditor({
  value,
  onChange,
  detectedSpeakers,
  onSpeakersDetected,
}: ScriptEditorProps) {
  const [parsedLines, setParsedLines] = useState<ScriptLine[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [lineCount, setLineCount] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      // Parse once and derive speakers from the result — no double-parse
      const { lines, warnings: w } = parseScript(value);
      const speakers = extractSpeakersFromLines(lines);
      setParsedLines(lines);
      setWarnings(w);
      setLineCount(lines.length);
      onSpeakersDetected(speakers);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, onSpeakersDetected]);

  const overlapCount = parsedLines.filter((l) => l.overlaps).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Podcast Script</h2>
        </div>
        <div className="flex items-center gap-2">
          {lineCount > 0 && (
            <>
              <Badge variant="secondary">{lineCount} lines</Badge>
              {overlapCount > 0 && (
                <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700">
                  {overlapCount} overlap{overlapCount !== 1 ? "s" : ""}
                </Badge>
              )}
            </>
          )}
          <button
            type="button"
            onClick={() => setShowPreview((p) => !p)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded border border-transparent hover:border-border"
          >
            {showPreview ? "Hide" : "Preview"}
            <ChevronRight
              className={`h-3 w-3 transition-transform ${showPreview ? "rotate-90" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* Format guide */}
      <div className="flex items-start gap-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3">
        <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
        <div className="text-xs text-blue-700 dark:text-blue-300 space-y-0.5">
          <p className="font-medium">Script Format</p>
          <p>
            <code className="font-mono bg-blue-100 dark:bg-blue-900/50 px-1 rounded">
              SPEAKER: dialogue text
            </code>
          </p>
          <p>
            For overlaps:{" "}
            <code className="font-mono bg-blue-100 dark:bg-blue-900/50 px-1 rounded">
              SPEAKER: [overlaps] text
            </code>{" "}
            or{" "}
            <code className="font-mono bg-blue-100 dark:bg-blue-900/50 px-1 rounded">
              [overlap 1.5s]
            </code>
          </p>
        </div>
      </div>

      {/* Textarea */}
      <div className="relative">
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={EXAMPLE_SCRIPT}
          className="min-h-[300px] font-mono text-sm leading-relaxed resize-y"
          spellCheck={false}
        />
        {!value && (
          <button
            type="button"
            onClick={() => onChange(EXAMPLE_SCRIPT)}
            className="absolute bottom-3 right-3 text-xs text-muted-foreground hover:text-foreground transition-colors bg-background border rounded px-2 py-1"
          >
            Load example
          </button>
        )}
      </div>

      {/* Detected speakers */}
      {detectedSpeakers.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Detected speakers:</span>
          {detectedSpeakers.map((s, i) => {
            const colors = getSpeakerColorClasses(i);
            return (
              <span
                key={s}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-bold ${colors.bg} ${colors.text} border ${colors.border}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${colors.dot}`} />
                {s}
              </span>
            );
          })}
        </div>
      )}

      {/* Unknown speaker warning */}
      {detectedSpeakers.length > 6 && (
        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-xs">
          <AlertCircle className="h-4 w-4" />
          <span>
            More than 6 speakers detected. Currently only the first 6 can be configured.
          </span>
        </div>
      )}

      {/* Parser warnings for unrecognised lines */}
      {warnings.length > 0 && (
        <div className="flex items-start gap-2 text-amber-600 dark:text-amber-400 text-xs rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-3">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-medium">
              {warnings.length} unrecognised line{warnings.length !== 1 ? "s" : ""} (will be
              skipped):
            </p>
            <ul className="list-disc list-inside space-y-0.5 font-mono">
              {warnings.slice(0, 5).map((w, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: stable warning list
                <li key={i} className="truncate max-w-xs">
                  {w}
                </li>
              ))}
              {warnings.length > 5 && <li>…and {warnings.length - 5} more</li>}
            </ul>
            <p className="text-[11px] opacity-75">
              Tip: Speaker labels must be UPPERCASE. Use # for comments.
            </p>
          </div>
        </div>
      )}

      {/* Live preview */}
      {showPreview && parsedLines.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Parsed Preview</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-64">
              <div className="p-4 space-y-2">
                {parsedLines.map((line) => {
                  const idx = detectedSpeakers.indexOf(line.speakerLabel);
                  const colors = getSpeakerColorClasses(idx >= 0 ? idx : 0);
                  return (
                    <div key={line.index} className="flex gap-3 items-start">
                      <span
                        className={`shrink-0 font-mono text-xs font-bold px-2 py-0.5 rounded ${colors.bg} ${colors.text}`}
                      >
                        {line.speakerLabel}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">{line.text}</p>
                        {line.overlaps && (
                          <span className="text-[10px] text-amber-600 dark:text-amber-400">
                            ↳ overlaps by {line.overlapOffset}s
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      <Separator />
    </div>
  );
}
