import { getElevenLabsKey } from "@/lib/settings";

/** Transcribe recorded audio to text via the ElevenLabs STT proxy. */
export async function transcribeAudio(blob: Blob): Promise<string> {
  const key = await getElevenLabsKey();
  const form = new FormData();
  form.append("file", blob, "audio.webm");
  const res = await fetch("/api/elevenlabs/stt", {
    method: "POST",
    headers: key ? { "x-elevenlabs-key": key } : undefined,
    body: form,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? "Transcription failed.");
  return typeof data?.text === "string" ? data.text : "";
}
