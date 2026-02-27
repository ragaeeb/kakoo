"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { WavePlayer } from "@/components/WavePlayer";
import { useToast } from "@/hooks/use-toast";
import type { Speaker } from "@/lib/types";
import { Download, Play, Radio, RotateCcw, Trash2, Wand2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface GeneratePanelProps {
  script: string;
  speakers: Speaker[];
  apiKeys: Record<string, string>;
  isReady: boolean;
}

type PodcastEntry = {
  id: string;
  audioUrl: string;
  createdAt: string;
  sizeBytes?: number;
};

type ProgressState = {
  status: "idle" | "parsing" | "synthesising" | "mixing" | "done" | "error";
  message: string;
  percent: number;
  audioUrl?: string;
  podcastId?: string;
  error?: string;
  recentMessages: string[];
};

export function GeneratePanel({ script, speakers, apiKeys, isReady }: GeneratePanelProps) {
  const [progress, setProgress] = useState<ProgressState>({
    status: "idle",
    message: "",
    percent: 0,
    recentMessages: [],
  });
  const [history, setHistory] = useState<PodcastEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [activeHistoryUrl, setActiveHistoryUrl] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const { toast } = useToast();

  // Load history from server on mount
  useEffect(() => {
    setHistoryLoading(true);
    fetch("/api/podcasts")
      .then((r) => r.json())
      .then((data: { podcasts?: PodcastEntry[] }) => {
        if (data.podcasts) {
          setHistory(data.podcasts);
        }
      })
      .catch(() => {
        // Non-fatal — history just won't be pre-populated
      })
      .finally(() => setHistoryLoading(false));
  }, []);

  async function generate() {
    if (!isReady) return;

    // Abort any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setProgress({
      status: "parsing",
      message: "Parsing script…",
      percent: 5,
      recentMessages: ["Parsing script…"],
    });

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script, speakers, apiKeys }),
        signal: controller.signal,
      });

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE chunks
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";

        for (const chunk of chunks) {
          if (!chunk.trim()) continue;

          const lines = chunk.split("\n");
          let eventType = "message";
          let dataStr = "";

          for (const line of lines) {
            if (line.startsWith("event: ")) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith("data: ")) {
              dataStr = line.slice(6).trim();
            }
          }

          if (!dataStr) continue;

          try {
            const data = JSON.parse(dataStr) as Record<string, unknown>;

            if (eventType === "progress") {
              const msg = String(data.message ?? "");
              setProgress((prev) => ({
                ...prev,
                status: (data.step as ProgressState["status"]) ?? prev.status,
                message: msg,
                percent: Number(data.percent ?? prev.percent),
                recentMessages: [msg, ...prev.recentMessages].slice(0, 3),
              }));
            } else if (eventType === "done") {
              const audioUrl = String(data.audioUrl ?? "");
              const podcastId = String(data.podcastId ?? "");
              setProgress((prev) => ({
                ...prev,
                status: "done",
                message: "Podcast ready!",
                percent: 100,
                audioUrl,
                podcastId,
              }));
              if (podcastId && audioUrl) {
                const entry: PodcastEntry = {
                  id: podcastId,
                  audioUrl,
                  createdAt: new Date().toISOString(),
                };
                setHistory((prev) => {
                  // Deduplicate by id
                  const filtered = prev.filter((e) => e.id !== podcastId);
                  return [entry, ...filtered];
                });
              }
            } else if (eventType === "error") {
              const message = String(data.message ?? "Unknown error");
              setProgress((prev) => ({
                ...prev,
                status: "error",
                message,
                error: message,
              }));
              toast({ title: "Generation failed", description: message, variant: "destructive" });
            }
          } catch {
            // Ignore malformed SSE data
          }
        }
      }
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      const message = err instanceof Error ? err.message : "Unknown error";
      setProgress((prev) => ({ ...prev, status: "error", message, error: message }));
      toast({ title: "Generation failed", description: message, variant: "destructive" });
    }
  }

  function reset() {
    abortRef.current?.abort();
    setProgress({ status: "idle", message: "", percent: 0, recentMessages: [] });
    setActiveHistoryUrl(null);
  }

  async function deleteEntry(id: string) {
    try {
      await fetch(`/api/podcasts?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      setHistory((prev) => prev.filter((e) => e.id !== id));
      if (activeHistoryUrl?.includes(id)) setActiveHistoryUrl(null);
      toast({ title: "Podcast deleted" });
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    }
  }

  const isGenerating = ["parsing", "synthesising", "mixing"].includes(progress.status);
  const isDone = progress.status === "done";
  const isError = progress.status === "error";

  return (
    <div className="space-y-6">
      {/* Generate button */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-4">
            {!isGenerating && !isDone && (
              <>
                <div className="flex items-center gap-2 text-center">
                  <Radio className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold text-primary">Ready to Generate</h3>
                </div>
                <Button
                  size="lg"
                  onClick={generate}
                  disabled={!isReady || isGenerating}
                  className="w-full max-w-xs gap-2"
                >
                  <Wand2 className="h-5 w-5" />
                  Generate Podcast
                </Button>
                {!isReady && (
                  <p className="text-xs text-muted-foreground text-center">
                    Add a script and configure at least one speaker to continue.
                  </p>
                )}
              </>
            )}

            {isGenerating && (
              <div className="w-full space-y-4">
                <div className="flex items-center justify-center gap-3">
                  {/* Waveform animation */}
                  <div className="flex items-end gap-0.5 h-8">
                    {["b1", "b2", "b3", "b4", "b5", "b6", "b7"].map((barId) => (
                      <div
                        key={barId}
                        className="waveform-bar w-1.5 rounded-full bg-primary"
                        style={{ height: "100%" }}
                      />
                    ))}
                  </div>
                  <span className="text-sm font-medium text-primary">{progress.message}</span>
                </div>
                <Progress value={progress.percent} className="h-2" />
                {/* Mini log of recent messages */}
                {progress.recentMessages.length > 0 && (
                  <div className="space-y-0.5">
                    {progress.recentMessages.map((msg, i) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: stable log list
                      <p
                        key={i}
                        className={`text-xs font-mono ${i === 0 ? "text-muted-foreground" : "text-muted-foreground/50"}`}
                      >
                        {msg}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {isDone && progress.audioUrl && (
              <div className="w-full space-y-4">
                <div className="flex items-center justify-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-semibold">Podcast Generated!</span>
                </div>

                {/* Audio player */}
                <WavePlayer audioUrl={progress.audioUrl} autoPlay />

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={reset} className="flex-1">
                    <RotateCcw className="h-4 w-4" />
                    New Generation
                  </Button>
                  <a
                    href={progress.audioUrl}
                    download={`kakoo-podcast-${progress.podcastId?.slice(0, 8) ?? "output"}.mp3`}
                    className="flex-1"
                  >
                    <Button variant="default" size="sm" className="w-full">
                      <Download className="h-4 w-4" />
                      Download MP3
                    </Button>
                  </a>
                </div>
              </div>
            )}

            {isError && (
              <div className="w-full space-y-3">
                <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-4 text-sm text-destructive">
                  <p className="font-semibold mb-1">Generation Failed</p>
                  <p className="font-mono text-xs break-all">{progress.error}</p>
                </div>
                <Button variant="outline" size="sm" onClick={reset} className="w-full">
                  <RotateCcw className="h-4 w-4" />
                  Try Again
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Play className="h-4 w-4 text-primary" />
            Podcast History
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {/* Skeleton loading */}
          {historyLoading && (
            <>
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-12 rounded-lg bg-muted animate-pulse"
                  aria-hidden="true"
                />
              ))}
            </>
          )}

          {!historyLoading && history.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">
              No podcasts yet. Generate one above!
            </p>
          )}

          {!historyLoading &&
            history.map((entry, idx) => (
              <div key={entry.id} className="space-y-2">
                <div className="flex items-center justify-between gap-3 rounded-lg border p-3 bg-muted/30">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant="secondary" className="text-xs shrink-0">
                      #{history.length - idx}
                    </Badge>
                    <span className="text-xs text-muted-foreground truncate">
                      {new Date(entry.createdAt).toLocaleTimeString()}
                    </span>
                    {entry.sizeBytes && (
                      <span className="text-xs text-muted-foreground/60 shrink-0">
                        {(entry.sizeBytes / 1024 / 1024).toFixed(1)} MB
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        setActiveHistoryUrl((prev) =>
                          prev === entry.audioUrl ? null : entry.audioUrl,
                        )
                      }
                      className="text-xs text-primary hover:underline"
                    >
                      {activeHistoryUrl === entry.audioUrl ? "Close" : "Play"}
                    </button>
                    <a
                      href={entry.audioUrl}
                      download={`kakoo-podcast-${entry.id.slice(0, 8)}.mp3`}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </a>
                    <button
                      type="button"
                      onClick={() => deleteEntry(entry.id)}
                      className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                      aria-label="Delete podcast"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                {activeHistoryUrl === entry.audioUrl && (
                  <WavePlayer audioUrl={entry.audioUrl} autoPlay />
                )}
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}
