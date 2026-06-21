"use client";

import { useCallback, useEffect, useState } from "react";
import {
  IconServer,
  IconLoader2,
  IconCircleCheckFilled,
  IconAlertTriangleFilled,
  IconDeviceFloppy,
  IconRefresh,
  IconBrandYoutubeFilled,
  IconMicrophoneFilled,
} from "@tabler/icons-react";
import {
  getOllamaSettings,
  saveOllamaSettings,
  clearOllamaSettings,
  getYouTubeKey,
  saveYouTubeKey,
  clearYouTubeKey,
  getElevenLabsKey,
  saveElevenLabsKey,
  clearElevenLabsKey,
  getElevenLabsVoice,
  setElevenLabsVoice,
} from "@/lib/settings";
import {
  youTubeServerHasKey,
  testYouTubeKey,
  getQuotaUsage,
  type QuotaUsage,
} from "@/lib/youtube";
import { elevenLabsServerHasKey } from "@/lib/dj";

interface OllamaStatus {
  provider?: "ollama" | "gateway";
  baseUrl: string;
  model: string;
  defaultBaseUrl: string;
  defaultModel: string;
  reachable: boolean;
  models: string[];
  error?: string;
}

export function SettingsPanel() {
  const saved = getOllamaSettings();
  const [model, setModel] = useState(saved.model);
  const [status, setStatus] = useState<OllamaStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const check = useCallback(async (m: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (m.trim()) params.set("model", m.trim());
      const res = await fetch(`/api/ollama?${params.toString()}`);
      setStatus(await res.json());
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    check(saved.model);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // On the gateway, the model is env-controlled. Drop any stale local Ollama
  // model so the client doesn't send an Ollama model id to it.
  useEffect(() => {
    if (status?.provider === "gateway" && saved.model) {
      clearOllamaSettings();
      setModel("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.provider]);

  const onSave = () => {
    saveOllamaSettings({ model: model.trim() });
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
    check(model);
  };

  const onReset = () => {
    clearOllamaSettings();
    setModel("");
    check("");
  };

  const usingDefaultModel = !model.trim();
  const isGateway = status?.provider === "gateway";

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center gap-2">
        <IconServer size={22} className="text-[#1ed760]" />
        <h2 className="text-xl font-bold tracking-tight">AI model</h2>
        {status && (
          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs text-neutral-400">
            {isGateway ? "Vercel AI Gateway" : "Ollama (local)"}
          </span>
        )}
      </div>

      {/* Live status */}
      <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-neutral-300">
            Connection
          </span>
          {loading ? (
            <span className="flex items-center gap-1.5 text-xs text-neutral-400">
              <IconLoader2 size={14} className="animate-spin" /> Checking…
            </span>
          ) : status?.reachable ? (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400">
              <IconCircleCheckFilled size={15} /> Connected
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-amber-400">
              <IconAlertTriangleFilled size={15} /> Not reachable
            </span>
          )}
        </div>

        {status && (
          <dl className="mt-4 space-y-2 text-sm">
            <Row label="Base URL in use" value={status.baseUrl} />
            <Row label="Model in use" value={status.model} />
            {!status.reachable && status.error && (
              <p className="pt-1 text-xs text-amber-300">{status.error}</p>
            )}
          </dl>
        )}
      </div>

      {/* Editor */}
      <div className="space-y-5 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        {isGateway ? (
          <p className="text-sm text-neutral-400">
            Model is configured server-side via{" "}
            <code className="text-neutral-300">LLM_MODEL</code> (currently{" "}
            <code className="text-neutral-300">{status?.model}</code>). Set it in
            your deployment&apos;s environment variables.
          </p>
        ) : (
          <Field
            label="Model"
            hint={
              usingDefaultModel
                ? `Using server default (${status?.defaultModel ?? "…"})`
                : "Custom value"
            }
          >
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={status?.defaultModel ?? "qwen2.5:7b-instruct"}
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-neutral-100 outline-none transition placeholder:text-neutral-600 focus:border-[#1db954]/60"
            />
            {status?.models && status.models.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="self-center text-xs text-neutral-500">
                  Installed:
                </span>
                {status.models.map((m) => (
                  <button
                    key={m}
                    onClick={() => setModel(m)}
                    className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs text-neutral-300 transition hover:border-[#1db954]/50 hover:text-white"
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
          </Field>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-1">
          {!isGateway && (
            <button
              onClick={onSave}
              className="flex items-center gap-2 rounded-full bg-[#1db954] px-5 py-2 text-sm font-semibold text-black transition hover:scale-[1.03] hover:bg-[#1ed760]"
            >
              <IconDeviceFloppy size={16} />
              {savedFlash ? "Saved ✓" : "Save"}
            </button>
          )}
          <button
            onClick={() => check(model)}
            disabled={loading}
            className="flex items-center gap-2 rounded-full border border-white/15 px-5 py-2 text-sm font-medium text-neutral-200 transition hover:bg-white/10 disabled:opacity-50"
          >
            {loading ? (
              <IconLoader2 size={16} className="animate-spin" />
            ) : (
              <IconRefresh size={16} />
            )}
            Test connection
          </button>
          {!isGateway && (
            <button
              onClick={onReset}
              className="text-xs text-neutral-500 transition hover:text-neutral-300"
            >
              Reset to defaults
            </button>
          )}
        </div>

        {!isGateway && (
          <p className="text-xs text-neutral-500">
            Settings are stored in this browser and sent with each playlist
            generation. Leave a field blank to use the server&apos;s env default.
          </p>
        )}
      </div>

      <YouTubeSettings />
      <ElevenLabsSettings />
    </div>
  );
}

function YouTubeSettings() {
  const [apiKey, setApiKey] = useState("");
  const [hasServerKey, setHasServerKey] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(
    null,
  );
  const [usage, setUsage] = useState<QuotaUsage | null>(null);

  useEffect(() => {
    setApiKey(getYouTubeKey());
    youTubeServerHasKey().then(setHasServerKey);
    setUsage(getQuotaUsage());
  }, []);

  const onSave = async () => {
    if (apiKey.trim()) await saveYouTubeKey(apiKey.trim());
    else clearYouTubeKey();
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
  };

  const onTest = async () => {
    setTesting(true);
    setTestResult(null);
    const err = await testYouTubeKey(apiKey.trim() || undefined);
    setTesting(false);
    setTestResult(err ? { ok: false, msg: err } : { ok: true, msg: "Key works ✓" });
    setUsage(getQuotaUsage());
  };

  const onReset = () => {
    clearYouTubeKey();
    setApiKey("");
    setTestResult(null);
  };

  const source = apiKey.trim()
    ? "Using a key saved in this browser"
    : hasServerKey
      ? "Using the server's env key"
      : "No key configured — the YouTube tab won't work";

  return (
    <div className="mt-8">
      <div className="mb-6 flex items-center gap-2">
        <IconBrandYoutubeFilled size={22} className="text-[#ff0033]" />
        <h2 className="text-xl font-bold tracking-tight">YouTube integration</h2>
      </div>

      <div className="space-y-5 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <Field label="YouTube Data API key" hint={source}>
          <div className="flex gap-2">
            <input
              type={reveal ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={hasServerKey ? "•••••• (server key in use)" : "AIza…"}
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-mono text-sm text-neutral-100 outline-none transition placeholder:font-sans placeholder:text-neutral-600 focus:border-[#ff0033]/50"
            />
            <button
              onClick={() => setReveal((r) => !r)}
              className="shrink-0 rounded-lg border border-white/10 px-3 text-xs text-neutral-300 transition hover:bg-white/10"
            >
              {reveal ? "Hide" : "Show"}
            </button>
          </div>
        </Field>

        {testResult && (
          <p
            className={
              testResult.ok
                ? "text-xs text-emerald-400"
                : "text-xs text-amber-300"
            }
          >
            {testResult.msg}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={onSave}
            className="flex items-center gap-2 rounded-full bg-[#ff0033] px-5 py-2 text-sm font-semibold text-white transition hover:scale-[1.03] hover:bg-[#ff1a47]"
          >
            <IconDeviceFloppy size={16} />
            {savedFlash ? "Saved ✓" : "Save"}
          </button>
          <button
            onClick={onTest}
            disabled={testing}
            className="flex items-center gap-2 rounded-full border border-white/15 px-5 py-2 text-sm font-medium text-neutral-200 transition hover:bg-white/10 disabled:opacity-50"
          >
            {testing ? (
              <IconLoader2 size={16} className="animate-spin" />
            ) : (
              <IconRefresh size={16} />
            )}
            Test key
          </button>
          <button
            onClick={onReset}
            className="text-xs text-neutral-500 transition hover:text-neutral-300"
          >
            Clear
          </button>
        </div>

        <p className="text-xs text-neutral-500">
          Stored in this browser and sent only to DjX&apos;s own server route
          (never to third parties). Get a key from Google Cloud Console with the{" "}
          <span className="text-neutral-400">YouTube Data API v3</span> enabled.
          Testing a key uses ~100 units of daily quota.
        </p>

        {(apiKey.trim() || hasServerKey) && usage && (
          <QuotaMeter usage={usage} onRefresh={() => setUsage(getQuotaUsage())} />
        )}
      </div>
    </div>
  );
}

function QuotaMeter({
  usage,
  onRefresh,
}: {
  usage: QuotaUsage;
  onRefresh: () => void;
}) {
  const pct = Math.min(100, Math.round((usage.used / usage.limit) * 100));
  const bar =
    pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-400" : "bg-[#1ed760]";

  return (
    <div className="border-t border-white/10 pt-4">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-sm font-medium text-neutral-200">
          Estimated quota used today
        </span>
        <button
          onClick={onRefresh}
          className="text-xs text-neutral-500 transition hover:text-neutral-300"
        >
          Refresh
        </button>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full transition-all ${bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1.5 text-xs text-neutral-500">
        ~{usage.used.toLocaleString()} / {usage.limit.toLocaleString()} units
        ({pct}%) · estimate from this browser, resets midnight PT. The exact
        figure is in{" "}
        <a
          href="https://console.cloud.google.com/apis/api/youtube.googleapis.com/quotas"
          target="_blank"
          rel="noreferrer"
          className="text-neutral-400 underline transition hover:text-neutral-200"
        >
          Google Cloud Console
        </a>
        .
      </p>
    </div>
  );
}

function ElevenLabsSettings() {
  const [apiKey, setApiKey] = useState("");
  const [voice, setVoice] = useState("");
  const [hasServerKey, setHasServerKey] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    getElevenLabsKey().then(setApiKey);
    setVoice(getElevenLabsVoice());
    elevenLabsServerHasKey().then(setHasServerKey);
  }, []);

  const onSave = async () => {
    if (apiKey.trim()) await saveElevenLabsKey(apiKey.trim());
    else clearElevenLabsKey();
    setElevenLabsVoice(voice.trim());
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
  };

  const onReset = () => {
    clearElevenLabsKey();
    setElevenLabsVoice("");
    setApiKey("");
    setVoice("");
  };

  const source = apiKey.trim()
    ? "Using a key saved in this browser"
    : hasServerKey
      ? "Using the server's env key"
      : "No key configured — the AI DJ stays silent";

  return (
    <div className="mt-8">
      <div className="mb-6 flex items-center gap-2">
        <IconMicrophoneFilled size={20} className="text-[#1ed760]" />
        <h2 className="text-xl font-bold tracking-tight">AI DJ voice (ElevenLabs)</h2>
      </div>

      <div className="space-y-5 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <Field label="ElevenLabs API key" hint={source}>
          <div className="flex gap-2">
            <input
              type={reveal ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={hasServerKey ? "•••••• (server key in use)" : "sk_…"}
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-mono text-sm text-neutral-100 outline-none transition placeholder:font-sans placeholder:text-neutral-600 focus:border-[#1db954]/60"
            />
            <button
              onClick={() => setReveal((r) => !r)}
              className="shrink-0 rounded-lg border border-white/10 px-3 text-xs text-neutral-300 transition hover:bg-white/10"
            >
              {reveal ? "Hide" : "Show"}
            </button>
          </div>
        </Field>

        <Field
          label="Voice ID"
          hint="Optional — defaults to the server's voice"
        >
          <input
            value={voice}
            onChange={(e) => setVoice(e.target.value)}
            placeholder="e.g. 9BWtsMINqrJLrRacOk9x (Aria)"
            spellCheck={false}
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-mono text-sm text-neutral-100 outline-none transition placeholder:font-sans placeholder:text-neutral-600 focus:border-[#1db954]/60"
          />
        </Field>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={onSave}
            className="flex items-center gap-2 rounded-full bg-[#1db954] px-5 py-2 text-sm font-semibold text-black transition hover:scale-[1.03] hover:bg-[#1ed760]"
          >
            <IconDeviceFloppy size={16} />
            {savedFlash ? "Saved ✓" : "Save"}
          </button>
          <button
            onClick={onReset}
            className="text-xs text-neutral-500 transition hover:text-neutral-300"
          >
            Clear
          </button>
        </div>

        <p className="text-xs text-neutral-500">
          Powers the <span className="text-neutral-400">AI DJ</span> toggle on the
          YouTube player — spoken intros between queued tracks. Stored in this
          browser and sent only to DjX&apos;s own server route. Get a key from{" "}
          <a
            href="https://elevenlabs.io/app/settings/api-keys"
            target="_blank"
            rel="noreferrer"
            className="text-neutral-400 underline transition hover:text-neutral-200"
          >
            elevenlabs.io
          </a>
          . Each intro spends a small amount of TTS credits.
        </p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-neutral-400">{label}</dt>
      <dd className="truncate font-mono text-xs text-neutral-200">{value}</dd>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <label className="text-sm font-medium text-neutral-200">{label}</label>
        {hint && <span className="text-xs text-neutral-500">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
