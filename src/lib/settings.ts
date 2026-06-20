"use client";

export interface OllamaSettings {
  baseUrl: string;
  model: string;
}

const KEY = "djx.ollama";

// Empty strings mean "use the server's env default".
export function getOllamaSettings(): OllamaSettings {
  if (typeof window === "undefined") return { baseUrl: "", model: "" };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        baseUrl: typeof parsed?.baseUrl === "string" ? parsed.baseUrl : "",
        model: typeof parsed?.model === "string" ? parsed.model : "",
      };
    }
  } catch {
    /* ignore malformed storage */
  }
  return { baseUrl: "", model: "" };
}

export function saveOllamaSettings(s: OllamaSettings) {
  window.localStorage.setItem(KEY, JSON.stringify(s));
}

export function clearOllamaSettings() {
  window.localStorage.removeItem(KEY);
}

const YT_KEY = "djx.youtube";

/** YouTube Data API key stored in this browser ("" means use the server env). */
export function getYouTubeKey(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(YT_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveYouTubeKey(key: string) {
  window.localStorage.setItem(YT_KEY, key);
}

export function clearYouTubeKey() {
  window.localStorage.removeItem(YT_KEY);
}
