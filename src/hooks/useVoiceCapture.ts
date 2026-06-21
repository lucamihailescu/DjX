"use client";

import { useCallback, useRef, useState } from "react";
import { transcribeAudio } from "@/lib/voice";

/**
 * Record from the mic with MediaRecorder, then transcribe via ElevenLabs STT.
 * `start()` opens the mic and records; `stop()` ends it and fires `onTranscript`
 * with the recognized text (empty results are ignored).
 */
export function useVoiceCapture(onTranscript: (text: string) => void) {
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const supported =
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices &&
    typeof window.MediaRecorder !== "undefined";

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, {
          type: rec.mimeType || "audio/webm",
        });
        setBusy(true);
        try {
          const text = await transcribeAudio(blob);
          if (text.trim()) onTranscript(text.trim());
          else setError("Didn't catch that — try again.");
        } catch (e) {
          setError(e instanceof Error ? e.message : "Transcription failed.");
        } finally {
          setBusy(false);
        }
      };
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
    } catch {
      setError("Microphone access was blocked.");
    }
  }, [onTranscript]);

  const stop = useCallback(() => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  }, []);

  return { recording, busy, error, supported, start, stop };
}
