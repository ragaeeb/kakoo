"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { PLATFORMS } from "@/lib/platforms";
import type { Speaker, TTSPlatformId } from "@/lib/types";
import { Mic, Trash2, Volume2 } from "lucide-react";

interface SpeakerCardProps {
  speaker: Speaker;
  index: number;
  onChange: (updated: Speaker) => void;
  onDelete?: () => void;
  canDelete: boolean;
}

const SPEAKER_COLORS = [
  {
    bg: "bg-violet-100 dark:bg-violet-900/30",
    text: "text-violet-700 dark:text-violet-300",
    border: "border-violet-300 dark:border-violet-700",
    dot: "bg-violet-500",
  },
  {
    bg: "bg-emerald-100 dark:bg-emerald-900/30",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-300 dark:border-emerald-700",
    dot: "bg-emerald-500",
  },
  {
    bg: "bg-amber-100 dark:bg-amber-900/30",
    text: "text-amber-700 dark:text-amber-300",
    border: "border-amber-300 dark:border-amber-700",
    dot: "bg-amber-500",
  },
  {
    bg: "bg-sky-100 dark:bg-sky-900/30",
    text: "text-sky-700 dark:text-sky-300",
    border: "border-sky-300 dark:border-sky-700",
    dot: "bg-sky-500",
  },
  {
    bg: "bg-rose-100 dark:bg-rose-900/30",
    text: "text-rose-700 dark:text-rose-300",
    border: "border-rose-300 dark:border-rose-700",
    dot: "bg-rose-500",
  },
  {
    bg: "bg-teal-100 dark:bg-teal-900/30",
    text: "text-teal-700 dark:text-teal-300",
    border: "border-teal-300 dark:border-teal-700",
    dot: "bg-teal-500",
  },
];

export function getSpeakerColorClasses(index: number) {
  return SPEAKER_COLORS[index % SPEAKER_COLORS.length];
}

export function SpeakerCard({ speaker, index, onChange, onDelete, canDelete }: SpeakerCardProps) {
  const platform = PLATFORMS.find((p) => p.id === speaker.platformId);
  // Use the passed index directly — no hardcoded ID lookup
  const colors = getSpeakerColorClasses(index);

  function update<K extends keyof Speaker>(key: K, value: Speaker[K]) {
    onChange({ ...speaker, [key]: value });
  }

  return (
    <Card className={`border-2 ${colors.border} transition-all`}>
      <CardHeader className={`${colors.bg} rounded-t-xl pb-3`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`h-3 w-3 rounded-full ${colors.dot}`} />
            <div className="flex items-center gap-2">
              <Mic className={`h-4 w-4 ${colors.text}`} />
              <span className={`text-sm font-semibold ${colors.text}`}>Speaker {index + 1}</span>
            </div>
          </div>
          {canDelete && onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="rounded p-1 text-muted-foreground hover:text-destructive transition-colors"
              aria-label="Remove speaker"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-4">
        {/* Label + Display Name row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Script Label
            </Label>
            <Input
              value={speaker.label}
              onChange={(e) => update("label", e.target.value.toUpperCase())}
              placeholder="ALICE"
              className="font-mono font-bold uppercase"
              maxLength={20}
            />
            <p className="text-[11px] text-muted-foreground">Used in script: LABEL: text</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Display Name
            </Label>
            <Input
              value={speaker.displayName}
              onChange={(e) => update("displayName", e.target.value)}
              placeholder="Alice"
            />
          </div>
        </div>

        {/* Platform selector */}
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            TTS Engine
          </Label>
          <Select
            value={speaker.platformId}
            onValueChange={(val) => {
              const newPlatform = PLATFORMS.find((p) => p.id === val);
              if (newPlatform) {
                onChange({
                  ...speaker,
                  platformId: val as TTSPlatformId,
                  voiceId: newPlatform.voices[0]?.id ?? "",
                });
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select engine…" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Available Engines</SelectLabel>
                {PLATFORMS.filter((p) => p.available).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="flex items-center gap-2">
                      {p.name}
                      {!p.requiresApiKey && (
                        <Badge variant="secondary" className="text-[10px] py-0">
                          Local
                        </Badge>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectGroup>
              <SelectGroup>
                <SelectLabel>Coming Soon</SelectLabel>
                {PLATFORMS.filter((p) => !p.available).map((p) => (
                  <SelectItem key={p.id} value={p.id} disabled>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        {/* Voice selector */}
        {platform && platform.voices.length > 0 && (
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Voice</Label>
            <Select value={speaker.voiceId} onValueChange={(val) => update("voiceId", val)}>
              <SelectTrigger>
                <SelectValue placeholder="Select voice…" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Voices</SelectLabel>
                  {platform.voices.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      <span className="flex items-center gap-2">
                        {v.name}
                        {v.gender && (
                          <Badge variant="outline" className="text-[10px] py-0 capitalize">
                            {v.gender}
                          </Badge>
                        )}
                        {v.language && (
                          <span className="text-muted-foreground text-[10px]">{v.language}</span>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Audio controls */}
        <div className="space-y-3 border-t pt-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Volume2 className="h-3.5 w-3.5" />
            <span>Audio Settings</span>
          </div>

          <Slider
            label="Speed"
            min={0.5}
            max={2.0}
            step={0.05}
            value={speaker.speed}
            onChange={(e) => update("speed", Number(e.target.value))}
            valueFormatter={(v) => `${v.toFixed(2)}×`}
          />

          <Slider
            label="Volume"
            min={0.1}
            max={2.0}
            step={0.05}
            value={speaker.volume}
            onChange={(e) => update("volume", Number(e.target.value))}
            valueFormatter={(v) => `${Math.round(v * 100)}%`}
          />
        </div>
      </CardContent>
    </Card>
  );
}
