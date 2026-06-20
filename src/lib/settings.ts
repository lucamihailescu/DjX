"use client";

export interface OllamaSettings {
  baseUrl: string;
  model: string;
}

const KEY = "djx.ollama";
const YT_KEY = "djx.youtube";
const YT_KEY_ENC_PREFIX = "enc:v1:";

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

async function deriveStorageKey(): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const passphrase = `${window.location.origin}:${YT_KEY}`;
  const salt = enc.encode(`${YT_KEY}:salt:v1`);
  const material = await crypto.subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encryptForStorage(plain: string): Promise<string> {
  const key = await deriveStorageKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(plain);
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
  const packed = new Uint8Array(iv.length + cipher.byteLength);
  packed.set(iv, 0);
  packed.set(new Uint8Array(cipher), iv.length);
  return `${YT_KEY_ENC_PREFIX}${bytesToBase64(packed)}`;
}

async function decryptFromStorage(payload: string): Promise<string> {
  if (!payload.startsWith(YT_KEY_ENC_PREFIX)) return payload;
  const key = await deriveStorageKey();
  const packed = base64ToBytes(payload.slice(YT_KEY_ENC_PREFIX.length));
  if (packed.length <= 12) return "";
  const iv = packed.slice(0, 12);
  const cipher = packed.slice(12);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
  return new TextDecoder().decode(plain);
}

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

/** YouTube Data API key stored in this browser ("" means use the server env). */
export function getYouTubeKey(): string {
  if (typeof window === "undefined") return "";
  try {
    const stored = window.localStorage.getItem(YT_KEY) ?? "";
    if (!stored) return "";
    if (!stored.startsWith(YT_KEY_ENC_PREFIX)) return stored;
    void decryptFromStorage(stored).then((decrypted) => {
      if (decrypted) window.localStorage.setItem(YT_KEY, decrypted ? `${YT_KEY_ENC_PREFIX}${stored.slice(YT_KEY_ENC_PREFIX.length)}` : "");
    });
    return "";
  } catch {
    return "";
  }
}

export async function saveYouTubeKey(key: string) {
  const encrypted = await encryptForStorage(key);
  window.localStorage.setItem(YT_KEY, encrypted);
}

export function clearYouTubeKey() {
  window.localStorage.removeItem(YT_KEY);
}
