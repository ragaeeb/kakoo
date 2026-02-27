"use client";

import { GeneratePanel } from "@/components/GeneratePanel";
import { ScriptEditor } from "@/components/ScriptEditor";
import { SpeakerCard } from "@/components/SpeakerCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { PLATFORMS } from "@/lib/platforms";
import { MAX_SPEAKERS } from "@/lib/types";
import type { Speaker } from "@/lib/types";
import { Mic, Plus, Radio } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// Default speaker factory
// ---------------------------------------------------------------------------
function createDefaultSpeaker(index: number): Speaker {
  const labels = ["ALICE", "BOB", "CAROL"];
  const names = ["Alice", "Bob", "Carol"];
  const defaultPlatform = PLATFORMS.find((p) => p.available);
  const defaultVoice = defaultPlatform?.voices[index % (defaultPlatform?.voices.length ?? 1)];

  return {
    id: `speaker-${index}`,
    label: labels[index] ?? `SPEAKER${index + 1}`,
    displayName: names[index] ?? `Speaker ${index + 1}`,
    color: ["violet", "emerald", "amber"][index] ?? "slate",
    platformId: defaultPlatform?.id ?? "google-gemini",
    voiceId: defaultVoice?.id ?? "",
    speed: 1.0,
    pitch: 0,
    volume: 1.0,
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function Home() {
  const [script, setScript] = useState("");
  const [detectedSpeakers, setDetectedSpeakers] = useState<string[]>([]);
  const [speakers, setSpeakers] = useState<Speaker[]>([createDefaultSpeaker(0)]);
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});

  // Sync detected speaker labels into speaker configs automatically
  const handleSpeakersDetected = useCallback((detected: string[]) => {
    setDetectedSpeakers(detected);

    setSpeakers((prev) => {
      const capped = detected.slice(0, MAX_SPEAKERS);
      const next = [...prev];

      capped.forEach((label, i) => {
        if (!next[i]) {
          next[i] = createDefaultSpeaker(i);
        }
        // Sync label if it's still the default or matches positionally
        if (next[i].label === ["ALICE", "BOB", "CAROL"][i] || next[i].label === `SPEAKER${i + 1}`) {
          next[i] = { ...next[i], label };
        }
      });

      // Trim to detected count (up to MAX_SPEAKERS)
      return next.slice(0, Math.max(1, capped.length));
    });
  }, []);

  function addSpeaker() {
    if (speakers.length >= MAX_SPEAKERS) return;
    setSpeakers((prev) => [...prev, createDefaultSpeaker(prev.length)]);
  }

  function removeSpeaker(index: number) {
    if (speakers.length <= 1) return;
    setSpeakers((prev) => prev.filter((_, i) => i !== index));
  }

  function updateSpeaker(index: number, updated: Speaker) {
    setSpeakers((prev) => prev.map((s, i) => (i === index ? updated : s)));
  }

  function updateApiKey(platformId: string, key: string) {
    setApiKeys((prev) => ({ ...prev, [platformId]: key }));
  }

  const isReady =
    script.trim().length > 0 &&
    speakers.length > 0 &&
    speakers.every((s) => s.voiceId.length > 0 && s.label.length > 0);

  return (
    <div className="min-h-screen bg-background">
      {/* ------------------------------------------------------------------ */}
      {/* Header */}
      {/* ------------------------------------------------------------------ */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-7xl flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary text-primary-foreground">
              <Radio className="h-4 w-4" />
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight">Kakoo</span>
              <Badge variant="secondary" className="ml-2 text-[10px]">
                Beta
              </Badge>
            </div>
          </div>
          <p className="hidden md:block text-xs text-muted-foreground">
            Multi-speaker TTS Podcast Generator
          </p>
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* Main layout: 2-col on large screens */}
      {/* ------------------------------------------------------------------ */}
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8 items-start">
          {/* ---------------------------------------------------------------- */}
          {/* Left column: Script editor + Speakers */}
          {/* ---------------------------------------------------------------- */}
          <div className="space-y-8">
            {/* Script editor */}
            <ScriptEditor
              value={script}
              onChange={setScript}
              detectedSpeakers={detectedSpeakers}
              onSpeakersDetected={handleSpeakersDetected}
            />

            {/* Speakers section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mic className="h-5 w-5 text-primary" />
                  <h2 className="text-lg font-semibold">Speakers</h2>
                  <Badge variant="secondary">
                    {speakers.length} / {MAX_SPEAKERS}
                  </Badge>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addSpeaker}
                  disabled={speakers.length >= MAX_SPEAKERS}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Speaker
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {speakers.map((speaker, index) => (
                  <SpeakerCard
                    key={speaker.id}
                    speaker={speaker}
                    apiKeys={apiKeys}
                    onChange={(updated) => updateSpeaker(index, updated)}
                    onDelete={() => removeSpeaker(index)}
                    onApiKeyChange={updateApiKey}
                    canDelete={speakers.length > 1}
                  />
                ))}
              </div>

              {/* Platform note */}
              <div className="rounded-lg border bg-muted/30 p-4 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">API Keys</p>
                <p>
                  API keys entered above are sent only to your own Next.js backend and used
                  server-side to call the TTS provider. They are never stored permanently.
                  Alternatively, set them in{" "}
                  <code className="font-mono bg-muted px-1 rounded">.env.local</code>:
                </p>
                <ul className="list-disc list-inside space-y-0.5 font-mono">
                  <li>GOOGLE_AI_API_KEY</li>
                  <li>ELEVENLABS_API_KEY</li>
                </ul>
              </div>
            </div>
          </div>

          {/* ---------------------------------------------------------------- */}
          {/* Right column: Generate panel */}
          {/* ---------------------------------------------------------------- */}
          <div className="lg:sticky lg:top-20 space-y-4">
            <div className="space-y-2">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Radio className="h-5 w-5 text-primary" />
                Generate
              </h2>
              <p className="text-xs text-muted-foreground">
                Synthesise each line with the configured voices, then mix everything into a single
                podcast MP3.
              </p>
            </div>

            <Separator />

            <GeneratePanel
              script={script}
              speakers={speakers}
              apiKeys={apiKeys}
              isReady={isReady}
            />
          </div>
        </div>
      </main>

      {/* ------------------------------------------------------------------ */}
      {/* Footer */}
      {/* ------------------------------------------------------------------ */}
      <footer className="border-t mt-16 py-6">
        <div className="mx-auto max-w-7xl px-4 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            <strong>Kakoo</strong> — Built with Next.js 16 + Tailwind CSS + shadcn/ui + ffmpeg
          </span>
          <span>Audio is processed server-side and saved to /public/output</span>
        </div>
      </footer>
    </div>
  );
}
