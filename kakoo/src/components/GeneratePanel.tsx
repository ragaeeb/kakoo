"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { GeneratePodcastRequest, GenerationProgress, Speaker } from "@/lib/types";
import { Download, Play, Radio, RotateCcw, Wand2 } from "lucide-react";
import { useRef, useState } from "react";

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
};

export function GeneratePanel({ script, speakers, apiKeys, isReady }: GeneratePanelProps) {
  const [progress, setProgress] = useState<GenerationProgress>({
    status: "idle",
    message: "",
    percent: 0,
  });
  const [history, setHistory] = useState<PodcastEntry[]>([]);
  const audioRef = useRef<HTMLAudioElement>(null);

  async function generate() {
    if (!isReady) return;

    setProgress({ status: "parsing", message: "Parsing script…", percent: 5 });

    try {
      const body: GeneratePodcastRequest & { apiKeys: Record<string, string> } = {
        script,
        speakers,
        apiKeys,
      };

      setProgress({ status: "synthesising", message: "Synthesising voices…", percent: 20 });

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      setProgress({ status: "mixing", message: "Mixing audio tracks…", percent: 75 });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error ?? "Generation failed");
      }

      setProgress({
        status: "done",
        message: "Podcast ready!",
        percent: 100,
        audioUrl: data.audioUrl,
        podcastId: data.podcastId,
      });

      if (data.podcastId && data.audioUrl) {
        setHistory((prev) => [
          { id: data.podcastId, audioUrl: data.audioUrl, createdAt: new Date().toISOString() },
          ...prev,
        ]);
      }

      // Auto-play
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.src = data.audioUrl;
          audioRef.current.play().catch(() => undefined);
        }
      }, 300);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setProgress({ status: "error", message, percent: 0, error: message });
    }
  }

  function reset() {
    setProgress({ status: "idle", message: "", percent: 0 });
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
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
                <p className="text-center text-xs text-muted-foreground">
                  This may take a moment depending on script length and TTS provider…
                </p>
              </div>
            )}

            {isDone && progress.audioUrl && (
              <div className="w-full space-y-4">
                <div className="flex items-center justify-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-semibold">Podcast Generated!</span>
                </div>

                {/* Audio player */}
                <div className="rounded-xl bg-background border p-4 space-y-3">
                  <audio
                    ref={audioRef}
                    controls
                    className="w-full"
                    src={progress.audioUrl}
                    preload="metadata"
                  >
                    <track kind="captions" />
                  </audio>
                </div>

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
      {history.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Play className="h-4 w-4 text-primary" />
              Session History
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {history.map((entry, idx) => (
              <div
                key={entry.id}
                className="flex items-center justify-between gap-3 rounded-lg border p-3 bg-muted/30"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Badge variant="secondary" className="text-xs shrink-0">
                    #{history.length - idx}
                  </Badge>
                  <span className="text-xs text-muted-foreground truncate">
                    {new Date(entry.createdAt).toLocaleTimeString()}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (audioRef.current) {
                        audioRef.current.src = entry.audioUrl;
                        audioRef.current.play().catch(() => undefined);
                        setProgress((p) => ({
                          ...p,
                          status: "done",
                          audioUrl: entry.audioUrl,
                          podcastId: entry.id,
                        }));
                      }
                    }}
                    className="text-xs text-primary hover:underline"
                  >
                    Play
                  </button>
                  <a
                    href={entry.audioUrl}
                    download={`kakoo-podcast-${entry.id.slice(0, 8)}.mp3`}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
