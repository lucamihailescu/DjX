// Effective Ollama target = optional per-request value, else env default.
export const DEFAULT_OLLAMA_BASE_URL =
  process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
export const DEFAULT_OLLAMA_MODEL =
  process.env.OLLAMA_MODEL ?? "qwen2.5:7b-instruct";

export function resolveOllama(baseUrl?: unknown, model?: unknown) {
  const u =
    typeof baseUrl === "string" && baseUrl.trim()
      ? baseUrl.trim().replace(/\/+$/, "")
      : DEFAULT_OLLAMA_BASE_URL;
  const m =
    typeof model === "string" && model.trim() ? model.trim() : DEFAULT_OLLAMA_MODEL;
  return { baseUrl: u, model: m };
}
