"use client";

import { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import { Button } from "@/components/ui/button";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";

interface WavePlayerProps {
  audioUrl: string;
  autoPlay?: boolean;
}

export function WavePlayer({ audioUrl, autoPlay = false }: WavePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  function isExpectedMediaError(err: unknown): boolean {
    if (!(err instanceof Error)) return false;
    return err.name === "AbortError" || err.name === "NotAllowedError";
  }

  // Format seconds as mm:ss
  function formatTime(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  // Create a fresh WaveSurfer instance whenever audioUrl changes.
  // This avoids the AbortError caused by React StrictMode double-invoking
  // effects: we never pass `url` to WaveSurfer.create (which would start
  // fetching immediately), and we always destroy before recreating.
  useEffect(() => {
    if (!containerRef.current) return;

    let destroyed = false;

    // Reset state for the new URL
    setIsReady(false);
    setIsLoading(true);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);

    // Destroy any existing instance first
    if (wavesurferRef.current) {
      try {
        wavesurferRef.current.destroy();
      } catch (err) {
        const e = err as Error | null;
        if (e?.name !== "AbortError") {
          console.warn("[WavePlayer] destroy error:", e);
        }
      }
      wavesurferRef.current = null;
    }

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: "hsl(var(--muted-foreground) / 0.4)",
      progressColor: "hsl(var(--primary))",
      cursorColor: "hsl(var(--primary))",
      cursorWidth: 2,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      height: 56,
      normalize: true,
      interact: true,
      // Do NOT pass `url` here — load it explicitly below to avoid
      // AbortError when the component unmounts during the initial fetch.
    });

    wavesurferRef.current = ws;

    ws.on("ready", (dur) => {
      if (destroyed) return;
      setDuration(dur);
      setIsReady(true);
      setIsLoading(false);
      if (autoPlay) {
        void ws.play().catch((err) => {
          if (!isExpectedMediaError(err)) {
            console.warn("[WavePlayer] autoplay error:", err);
          }
        });
      }
    });

    ws.on("play", () => {
      if (!destroyed) setIsPlaying(true);
    });
    ws.on("pause", () => {
      if (!destroyed) setIsPlaying(false);
    });
    ws.on("finish", () => {
      if (!destroyed) setIsPlaying(false);
    });
    ws.on("timeupdate", (time) => {
      if (!destroyed) setCurrentTime(time);
    });
    ws.on("loading", () => {
      if (!destroyed) setIsLoading(true);
    });
    ws.on("error", (err) => {
      const e = err as Error | null;
      if (e?.name === "AbortError") return; // suppress expected abort on unmount
      console.error("[WavePlayer] WaveSurfer error:", err);
      if (!destroyed) setIsLoading(false);
    });

    // Load the audio after attaching all event listeners
    void Promise.resolve(ws.load(audioUrl)).catch((err) => {
      if (isExpectedMediaError(err)) return;
      console.error("[WavePlayer] load error:", err);
      if (!destroyed) setIsLoading(false);
    });

    return () => {
      destroyed = true;
      try {
        ws.destroy();
      } catch (err) {
        const e = err as Error | null;
        if (e?.name !== "AbortError") {
          console.warn("[WavePlayer] cleanup destroy error:", e);
        }
      }
      if (wavesurferRef.current === ws) {
        wavesurferRef.current = null;
      }
    };
  }, [audioUrl, autoPlay]);

  function togglePlay() {
    wavesurferRef.current?.playPause();
  }

  function toggleMute() {
    const ws = wavesurferRef.current;
    if (!ws) return;
    const next = !isMuted;
    ws.setMuted(next);
    setIsMuted(next);
  }

  return (
    <div className="rounded-xl bg-background border p-4 space-y-3">
      {/* Waveform */}
      <div
        ref={containerRef}
        className={`w-full transition-opacity duration-300 ${isLoading ? "opacity-40" : "opacity-100"}`}
      />

      {/* Controls row */}
      <div className="flex items-center gap-3">
        {/* Play / Pause */}
        <Button
          variant="default"
          size="icon"
          className="h-9 w-9 shrink-0 rounded-full"
          onClick={togglePlay}
          disabled={!isReady}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>

        {/* Time */}
        <span className="text-xs tabular-nums text-muted-foreground min-w-[72px]">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Mute */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={toggleMute}
          disabled={!isReady}
          aria-label={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </Button>
      </div>

      {/* Loading indicator */}
      {isLoading && (
        <p className="text-center text-xs text-muted-foreground animate-pulse">Loading audio…</p>
      )}
    </div>
  );
}
