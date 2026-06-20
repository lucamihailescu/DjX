// Effective Ollama target = optional per-request value, else env default.
export const DEFAULT_OLLAMA_BASE_URL =
  process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
export const DEFAULT_OLLAMA_MODEL =
  process.env.OLLAMA_MODEL ?? "qwen2.5:7b-instruct";

const LOCAL_OLLAMA_ORIGINS = new Set([
  "http://localhost:11434",
  "http://127.0.0.1:11434",
]);

function toOriginOrNull(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

function resolveBaseUrl(baseUrl?: unknown): string {
  const defaultOrigin = toOriginOrNull(DEFAULT_OLLAMA_BASE_URL) ?? "http://localhost:11434";
  const allowedOrigins = new Set<string>([defaultOrigin, ...LOCAL_OLLAMA_ORIGINS]);

  if (typeof baseUrl !== "string" || !baseUrl.trim()) return defaultOrigin;

  const requestedOrigin = toOriginOrNull(baseUrl.trim());
  if (!requestedOrigin) return defaultOrigin;

  return allowedOrigins.has(requestedOrigin) ? requestedOrigin : defaultOrigin;
}

export function resolveOllama(baseUrl?: unknown, model?: unknown) {
  const u = resolveBaseUrl(baseUrl);
  const m =
    typeof model === "string" && model.trim() ? model.trim() : DEFAULT_OLLAMA_MODEL;
  return { baseUrl: u, model: m };
}
