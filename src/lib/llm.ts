// Server-side LLM access. Two providers, selected by LLM_PROVIDER:
//   - "ollama"  (default): local Ollama at OLLAMA_BASE_URL — free, offline dev.
//   - "gateway": Vercel AI Gateway (OpenAI-compatible) — works on Vercel.
// Both return the model's reply as a JSON string; callers parse + validate it.

const PROVIDER = (process.env.LLM_PROVIDER ?? "ollama").toLowerCase();

export const DEFAULT_OLLAMA_BASE_URL =
  process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
export const DEFAULT_OLLAMA_MODEL =
  process.env.OLLAMA_MODEL ?? "qwen2.5:7b-instruct";

const GATEWAY_BASE_URL =
  process.env.AI_GATEWAY_BASE_URL ?? "https://ai-gateway.vercel.sh/v1";
const GATEWAY_MODEL = process.env.LLM_MODEL ?? "openai/gpt-4o-mini";

const TIMEOUT_MS = Number(
  process.env.LLM_TIMEOUT_MS ?? process.env.OLLAMA_TIMEOUT_MS ?? 90_000,
);

export function llmProvider(): "ollama" | "gateway" {
  return PROVIDER === "gateway" ? "gateway" : "ollama";
}

export function defaultModel(): string {
  return llmProvider() === "gateway" ? GATEWAY_MODEL : DEFAULT_OLLAMA_MODEL;
}

/** A model from Settings (per request) wins; otherwise the env default. */
export function resolveModel(fromSettings?: unknown): string {
  return typeof fromSettings === "string" && fromSettings.trim()
    ? fromSettings.trim()
    : defaultModel();
}

/** Ollama base URL from Settings (per request) or env. */
export function resolveOllamaBaseUrl(fromSettings?: unknown): string {
  return typeof fromSettings === "string" && fromSettings.trim()
    ? fromSettings.trim().replace(/\/+$/, "")
    : DEFAULT_OLLAMA_BASE_URL;
}

export interface ChatResult {
  ok: boolean;
  content?: string;
  status?: number;
  error?: string;
}

export interface ChatArgs {
  system: string;
  user: string;
  temperature?: number;
  baseUrl?: unknown; // Ollama only (from Settings)
  model?: unknown; // from Settings
}

export async function chatJSON(args: ChatArgs): Promise<ChatResult> {
  const model = resolveModel(args.model);
  const temperature = args.temperature ?? 0.7;
  return llmProvider() === "gateway"
    ? gatewayChat(model, args.system, args.user, temperature)
    : ollamaChat(
        resolveOllamaBaseUrl(args.baseUrl),
        model,
        args.system,
        args.user,
        temperature,
      );
}

/** Parse the model's reply as JSON, tolerating stray text around the object. */
export function extractJSON(content: string): unknown | null {
  try {
    return JSON.parse(content);
  } catch {
    const m = content.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]);
    } catch {
      return null;
    }
  }
}

async function gatewayChat(
  model: string,
  system: string,
  user: string,
  temperature: number,
): Promise<ChatResult> {
  const key = process.env.AI_GATEWAY_API_KEY;
  if (!key) {
    return {
      ok: false,
      status: 503,
      error:
        "Missing AI_GATEWAY_API_KEY. Add a Vercel AI Gateway key, or set LLM_PROVIDER=ollama.",
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${GATEWAY_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return {
      ok: false,
      status: 502,
      error: aborted
        ? `The AI Gateway timed out after ${Math.round(TIMEOUT_MS / 1000)}s.`
        : "Couldn't reach the Vercel AI Gateway.",
    };
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    let detail: string = raw;
    try {
      const j = JSON.parse(raw);
      detail = j?.error?.message ?? j?.error ?? raw;
    } catch {
      /* keep raw */
    }
    return {
      ok: false,
      status: 502,
      error: `AI Gateway error (${res.status}): ${String(detail).slice(0, 200)}`,
    };
  }

  const data = await res.json().catch(() => null);
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content) {
    return { ok: false, status: 502, error: "Empty response from the AI Gateway." };
  }
  return { ok: true, content };
}

async function ollamaChat(
  baseUrl: string,
  model: string,
  system: string,
  user: string,
  temperature: number,
): Promise<ChatResult> {
  const call = async (includeThink: boolean): Promise<Response> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      return await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          stream: false,
          format: "json",
          // Reasoning models otherwise spend a long time before emitting JSON.
          ...(includeThink ? { think: false } : {}),
          options: { temperature },
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
      });
    } finally {
      clearTimeout(timer);
    }
  };

  let res: Response;
  try {
    res = await call(true);
    if (res.status === 400) {
      const peek = await res.clone().text().catch(() => "");
      if (/think|thinking/i.test(peek)) res = await call(false);
    }
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return {
      ok: false,
      status: 502,
      error: aborted
        ? `Ollama timed out after ${Math.round(TIMEOUT_MS / 1000)}s with model "${model}".`
        : `Couldn't reach Ollama at ${baseUrl}. Is it running? (ollama serve)`,
    };
  }

  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    let detail: string = raw;
    try {
      const j = JSON.parse(raw);
      if (typeof j?.error === "string") detail = j.error;
    } catch {
      /* keep raw */
    }
    const notPulled = res.status === 404 || /not found/i.test(detail);
    return {
      ok: false,
      status: 502,
      error: notPulled
        ? `Model "${model}" isn't available in Ollama. Pull it with: ollama pull ${model}.`
        : `Ollama error (${res.status}): ${detail}`,
    };
  }

  const data = await res.json().catch(() => null);
  const content = data?.message?.content;
  if (typeof content !== "string" || !content) {
    return { ok: false, status: 502, error: "Empty response from Ollama." };
  }
  return { ok: true, content };
}
