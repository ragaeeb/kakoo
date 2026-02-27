"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { KeyStore } from "@/lib/key-store";
import { PLATFORMS } from "@/lib/platforms";
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2, Settings } from "lucide-react";
import { useEffect, useState } from "react";

interface SettingsModalProps {
  onKeysChange: (keys: Record<string, string>) => void;
  hasKeys: boolean;
}

type TestStatus = "idle" | "testing" | "valid" | "invalid";

interface PlatformKeyState {
  value: string;
  show: boolean;
  testStatus: TestStatus;
  testError?: string;
}

const API_PLATFORMS = PLATFORMS.filter((p) => p.requiresApiKey);

export function SettingsModal({ onKeysChange, hasKeys }: SettingsModalProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [keyStates, setKeyStates] = useState<Record<string, PlatformKeyState>>(() =>
    Object.fromEntries(
      API_PLATFORMS.map((p) => [
        p.id,
        { value: "", show: false, testStatus: "idle" as TestStatus },
      ]),
    ),
  );
  const { toast } = useToast();

  // Load saved keys when modal opens
  useEffect(() => {
    if (!open) return;
    KeyStore.load().then((saved) => {
      setKeyStates((prev) => {
        const next = { ...prev };
        for (const p of API_PLATFORMS) {
          next[p.id] = {
            ...next[p.id],
            value: saved[p.id] ?? "",
            testStatus: "idle",
          };
        }
        return next;
      });
    });
  }, [open]);

  function updateKey(platformId: string, value: string) {
    setKeyStates((prev) => ({
      ...prev,
      [platformId]: { ...prev[platformId], value, testStatus: "idle" },
    }));
  }

  function toggleShow(platformId: string) {
    setKeyStates((prev) => ({
      ...prev,
      [platformId]: { ...prev[platformId], show: !prev[platformId].show },
    }));
  }

  async function testKey(platformId: string) {
    const key = keyStates[platformId]?.value?.trim();
    if (!key) return;

    setKeyStates((prev) => ({
      ...prev,
      [platformId]: { ...prev[platformId], testStatus: "testing", testError: undefined },
    }));

    try {
      const res = await fetch(
        `/api/test-key?platform=${encodeURIComponent(platformId)}&key=${encodeURIComponent(key)}`,
      );
      const data = (await res.json()) as { valid: boolean; error?: string };

      setKeyStates((prev) => ({
        ...prev,
        [platformId]: {
          ...prev[platformId],
          testStatus: data.valid ? "valid" : "invalid",
          testError: data.error,
        },
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      setKeyStates((prev) => ({
        ...prev,
        [platformId]: { ...prev[platformId], testStatus: "invalid", testError: msg },
      }));
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const keys: Record<string, string> = {};
      for (const p of API_PLATFORMS) {
        const val = keyStates[p.id]?.value?.trim();
        if (val) keys[p.id] = val;
      }
      await KeyStore.save(keys);
      onKeysChange(keys);
      toast({ title: "Keys saved", description: "API keys encrypted and saved to browser storage." });
      setOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Save failed";
      toast({ title: "Save failed", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleClear() {
    setClearing(true);
    try {
      KeyStore.clear();
      onKeysChange({});
      setKeyStates((prev) => {
        const next = { ...prev };
        for (const p of API_PLATFORMS) {
          next[p.id] = { ...next[p.id], value: "", testStatus: "idle" };
        }
        return next;
      });
      toast({ title: "Keys cleared", description: "All saved API keys have been removed." });
    } finally {
      setClearing(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="relative flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          aria-label="Open settings"
        >
          <Settings className="h-4 w-4" />
          {!hasKeys && (
            <span
              className="absolute top-1 right-1 h-2 w-2 rounded-full bg-amber-500"
              aria-label="API keys not configured"
            />
          )}
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>API Key Settings</DialogTitle>
          <DialogDescription>
            Configure API keys for TTS providers. Keys are encrypted and stored in your browser.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Production callout */}
          <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-3 text-xs text-blue-700 dark:text-blue-300 space-y-1">
            <p className="font-semibold">Production deployments (Vercel, Cloudflare Workers)</p>
            <p>
              Set keys as environment variables instead:{" "}
              <code className="font-mono bg-blue-100 dark:bg-blue-900/50 px-1 rounded">
                GOOGLE_AI_API_KEY
              </code>
              ,{" "}
              <code className="font-mono bg-blue-100 dark:bg-blue-900/50 px-1 rounded">
                ELEVENLABS_API_KEY
              </code>
              . Server-side env vars take priority over stored keys.
            </p>
          </div>

          {/* Per-platform key inputs */}
          {API_PLATFORMS.map((platform) => {
            const state = keyStates[platform.id];
            if (!state) return null;
            return (
              <div key={platform.id} className="space-y-2">
                <Label className="text-sm font-medium">
                  {platform.name}
                  {platform.apiKeyLabel && (
                    <span className="text-muted-foreground font-normal ml-1">
                      ({platform.apiKeyLabel})
                    </span>
                  )}
                </Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={state.show ? "text" : "password"}
                      value={state.value}
                      onChange={(e) => updateKey(platform.id, e.target.value)}
                      placeholder={`${platform.apiKeyEnvVar ?? "API_KEY"} or paste here`}
                      autoComplete="off"
                      className="pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShow(platform.id)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={state.show ? "Hide key" : "Show key"}
                    >
                      {state.show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => testKey(platform.id)}
                    disabled={!state.value.trim() || state.testStatus === "testing"}
                    className="shrink-0"
                  >
                    {state.testStatus === "testing" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : state.testStatus === "valid" ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    ) : state.testStatus === "invalid" ? (
                      <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                    ) : null}
                    Test
                  </Button>
                </div>
                {state.testStatus === "valid" && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">
                    ✓ Key is valid
                  </p>
                )}
                {state.testStatus === "invalid" && state.testError && (
                  <p className="text-xs text-destructive">{state.testError}</p>
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClear}
            disabled={clearing}
            className="text-destructive hover:text-destructive border-destructive/30 hover:border-destructive/60"
          >
            {clearing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Clear saved keys
          </Button>
          <div className="flex-1" />
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save keys
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
