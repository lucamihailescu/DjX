import { NextResponse } from "next/server";
import {
  llmProvider,
  defaultModel,
  resolveModel,
  resolveOllamaBaseUrl,
  DEFAULT_OLLAMA_BASE_URL,
} from "@/lib/llm";

// Reports the active LLM provider and its status for the Settings page.
// - gateway: configured-or-not based on AI_GATEWAY_API_KEY (no model list).
// - ollama: reachability + installed models (via /api/tags). ?baseUrl= lets
//   the user test a value they're typing before saving.
export async function GET(req: Request) {
  const provider = llmProvider();
  const { searchParams } = new URL(req.url);
  const model = resolveModel(searchParams.get("model"));

  if (provider === "gateway") {
    const hasKey = Boolean(process.env.AI_GATEWAY_API_KEY);
    return NextResponse.json({
      provider,
      baseUrl: "Vercel AI Gateway",
      model,
      defaultBaseUrl: "Vercel AI Gateway",
      defaultModel: defaultModel(),
      reachable: hasKey,
      models: [],
      error: hasKey ? undefined : "Missing AI_GATEWAY_API_KEY.",
    });
  }

  const baseUrl = resolveOllamaBaseUrl(searchParams.get("baseUrl"));
  const base = {
    provider,
    baseUrl,
    model,
    defaultBaseUrl: DEFAULT_OLLAMA_BASE_URL,
    defaultModel: defaultModel(),
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
