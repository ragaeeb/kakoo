"use client";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { GeneratePanel } from "@/components/GeneratePanel";
import { ScriptEditor } from "@/components/ScriptEditor";
import { SettingsModal } from "@/components/SettingsModal";
import { SpeakerCard } from "@/components/SpeakerCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { KeyStore } from "@/lib/key-store";
import { PLATFORMS } from "@/lib/platforms";
import { MAX_SPEAKERS } from "@/lib/types";
import type { Speaker } from "@/lib/types";
import { Mic, Plus, Radio } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Default speaker factory
// ---------------------------------------------------------------------------
function createDefaultSpeaker(index: number): Speaker {
  // Use friendly names for the first two speakers; generic labels beyond that
  const friendlyLabels = ["ALICE", "BOB"];
  const friendlyNames = ["Alice", "Bob"];

  const label = index < friendlyLabels.length ? friendlyLabels[index] : `SPEAKER${index + 1}`;
  const displayName =
    index < friendlyNames.length ? friendlyNames[index] : `Speaker ${index + 1}`;

  const defaultPlatform = PLATFORMS.find((p) => p.available);
  const defaultVoice = defaultPlatform?.voices[index % (defaultPlatform?.voices.length ?? 1)];

  return {
    id: `speaker-${index}`,
    label,
    displayName,
    color: ["violet", "emerald", "amber", "sky", "rose", "teal"][index] ?? "slate",
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
  // Track which speakers the user has manually edited (by id) so we don't
  // auto-sync their labels when the script changes.
  const userEditedSpeakers = useRef<Set<string>>(new Set());

  // Load API keys from KeyStore on mount
  useEffect(() => {
    KeyStore.load().then((saved) => {
      if (Object.keys(saved).length > 0) {
        setApiKeys(saved);
      }
    });
  }, []);

  // Sync detected speaker labels into speaker configs automatically.
  // Only syncs speakers that the user has NOT manually edited.
  const handleSpeakersDetected = useCallback((detected: string[]) => {
    setDetectedSpeakers(detected);

    setSpeakers((prev) => {
      const capped = detected.slice(0, MAX_SPEAKERS);
      const next = [...prev];

      capped.forEach((label, i) => {
        if (!next[i]) {
          // New speaker slot — create with defaults
          next[i] = createDefaultSpeaker(i);
        }

        // Only auto-sync label if the user hasn't manually edited this speaker
        if (!userEditedSpeakers.current.has(next[i].id)) {
          // Only update the label field — preserve all other settings
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
    // If the label changed, mark this speaker as user-edited
    const current = speakers[index];
    if (current && updated.label !== current.label) {
      userEditedSpeakers.current.add(updated.id);
    }
    setSpeakers((prev) => prev.map((s, i) => (i === index ? updated : s)));
  }

  const hasApiKeys = Object.values(apiKeys).some((v) => v.trim().length > 0);

  const isReady =
    script.trim().length > 0 &&
    speakers.length > 0 &&
    speakers.every((s) => s.voiceId.length > 0 && s.label.length > 0);

  return (
    <div className="min-h-screen bg-background">
      {/* ------------------------------------------------------------------ */}
      {/* Header */}
      {/* ------------------------------------------------------------------ */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md overflow-hidden">
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
          <div className="flex items-center gap-3">
            <p className="hidden md:block text-xs text-muted-foreground">
              Multi-speaker TTS Podcast Generator
            </p>
            <SettingsModal onKeysChange={setApiKeys} hasKeys={hasApiKeys} />
          </div>
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
            <ErrorBoundary label="Script Editor">
              <ScriptEditor
                value={script}
                onChange={setScript}
                detectedSpeakers={detectedSpeakers}
                onSpeakersDetected={handleSpeakersDetected}
              />
            </ErrorBoundary>

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

              <ErrorBoundary label="Speaker Grid">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {speakers.map((speaker, index) => (
                    <SpeakerCard
                      key={speaker.id}
                      speaker={speaker}
                      index={index}
                      onChange={(updated) => updateSpeaker(index, updated)}
                      onDelete={() => removeSpeaker(index)}
                      canDelete={speakers.length > 1}
                    />
                  ))}
                </div>
              </ErrorBoundary>

              {/* API Keys note */}
              <p className="text-xs text-muted-foreground">
                Manage API keys in{" "}
                <button
                  type="button"
                  onClick={() => {
                    // Trigger settings modal — find the gear button and click it
                    const btn = document.querySelector<HTMLButtonElement>(
                      '[aria-label="Open settings"]',
                    );
                    btn?.click();
                  }}
                  className="text-primary hover:underline"
                >
                  ⚙ Settings
                </button>
              </p>
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

            <ErrorBoundary label="Generate Panel">
              <GeneratePanel
                script={script}
                speakers={speakers}
                apiKeys={apiKeys}
                isReady={isReady}
              />
            </ErrorBoundary>
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
