import type { YouTubeResult } from "@/lib/youtube";
import {
  getElevenLabsKey,
  getElevenLabsVoice,
  getOllamaSettings,
} from "@/lib/settings";

/** Ask the LLM for a short DJ intro line for the upcoming track. */
export async function fetchDjLine(
  track: YouTubeResult,
  prev?: YouTubeResult | null,
): Promise<string> {
  const { model } = getOllamaSettings();
  const res = await fetch("/api/dj-intro", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      track: `${track.title} — ${track.channel}`,
      prev: prev ? `${prev.title} — ${prev.channel}` : undefined,
      model: model || undefined,
    }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? "DJ line failed.");
  return typeof data?.line === "string" ? data.line : "";
}

/** Synthesize speech for `text` via the ElevenLabs proxy; returns an audio Blob. */
export async function synthesizeSpeech(text: string): Promise<Blob> {
  const key = await getElevenLabsKey();
  const voiceId = getElevenLabsVoice();
  const res = await fetch("/api/elevenlabs/tts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(key ? { "x-elevenlabs-key": key } : {}),
    },
    body: JSON.stringify({ text, voiceId: voiceId || undefined }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error ?? "Speech synthesis failed.");
  }
  return res.blob();
}

/** Whether the server has an ELEVENLABS_API_KEY configured (no cost). */
export async function elevenLabsServerHasKey(): Promise<boolean> {
  try {
    const res = await fetch("/api/elevenlabs/tts");
    const data = await res.json().catch(() => null);
    return Boolean(data?.hasServerKey);
  } catch {
    return false;
  }
}
