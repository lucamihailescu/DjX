import { NextResponse } from "next/server";
import {
  resolveOllama,
  DEFAULT_OLLAMA_BASE_URL,
  DEFAULT_OLLAMA_MODEL,
} from "@/lib/ollama-config";

// Reports the effective Ollama config, whether it's reachable, and the list of
// installed models (via Ollama's /api/tags). Accepts ?baseUrl= to test a value
// the user is typing in Settings before they save it.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const { baseUrl, model } = resolveOllama(
    searchParams.get("baseUrl"),
    searchParams.get("model"),
  );

  const base = {
    baseUrl,
    model,
    defaultBaseUrl: DEFAULT_OLLAMA_BASE_URL,
    defaultModel: DEFAULT_OLLAMA_MODEL,
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const r = await fetch(`${baseUrl}/api/tags`, { signal: controller.signal });
    clearTimeout(timer);
    if (!r.ok) {
      return NextResponse.json({
        ...base,
        reachable: false,
        models: [],
        error: `Ollama responded ${r.status}.`,
      });
    }
    const data = await r.json().catch(() => null);
    const models: string[] = Array.isArray(data?.models)
      ? data.models
          .map((m: { name?: string }) => m?.name)
          .filter((n: unknown): n is string => typeof n === "string")
      : [];
    return NextResponse.json({ ...base, reachable: true, models });
  } catch (e) {
    clearTimeout(timer);
    const aborted = e instanceof Error && e.name === "AbortError";
    return NextResponse.json({
      ...base,
      reachable: false,
      models: [],
      error: aborted
        ? `Timed out reaching Ollama at ${baseUrl}.`
        : `Couldn't reach Ollama at ${baseUrl}. Is it running? (ollama serve)`,
    });
  }
}
