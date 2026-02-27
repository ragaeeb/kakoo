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

  // Format seconds as mm:ss
  function formatTime(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  // Initialise WaveSurfer once the container is mounted
  useEffect(() => {
    if (!containerRef.current) return;

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
      url: audioUrl,
    });

    wavesurferRef.current = ws;

    ws.on("ready", (dur) => {
      setDuration(dur);
      setIsReady(true);
      setIsLoading(false);
      if (autoPlay) {
        ws.play();
      }
    });

    ws.on("play", () => setIsPlaying(true));
    ws.on("pause", () => setIsPlaying(false));
    ws.on("finish", () => setIsPlaying(false));

    ws.on("timeupdate", (time) => setCurrentTime(time));

    ws.on("loading", () => setIsLoading(true));

    ws.on("error", (err) => {
      console.error("[WavePlayer] WaveSurfer error:", err);
      setIsLoading(false);
    });

    return () => {
      ws.destroy();
      wavesurferRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload when audioUrl changes after initial mount
  useEffect(() => {
    const ws = wavesurferRef.current;
    if (!ws) return;
    setIsReady(false);
    setIsLoading(true);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    ws.load(audioUrl);
  }, [audioUrl]);

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
        <p className="text-center text-xs text-muted-foreground animate-pulse">
          Loading audio…
        </p>
      )}
    </div>
  );
}
