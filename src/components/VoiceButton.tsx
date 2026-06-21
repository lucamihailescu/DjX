"use client";

import {
  IconMicrophone,
  IconPlayerStopFilled,
  IconLoader2,
} from "@tabler/icons-react";
import { useVoiceCapture } from "@/hooks/useVoiceCapture";
import { cn } from "@/lib/utils";

/**
 * Mic button: click to record a spoken request, click again to stop. The
 * transcript (via ElevenLabs STT) is handed to `onTranscript`. Renders nothing
 * if the browser can't record audio.
 */
export function VoiceButton({
  onTranscript,
  disabled,
  title = "Speak your request",
}: {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  title?: string;
}) {
  const { recording, busy, error, supported, start, stop } =
    useVoiceCapture(onTranscript);

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={() => (recording ? stop() : start())}
      disabled={disabled || busy}
      title={error ?? (recording ? "Stop & transcribe" : title)}
      aria-label={recording ? "Stop recording" : "Record a spoken request"}
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition disabled:opacity-40",
        recording
          ? "border-red-500/50 bg-red-500/15 text-red-300"
          : "border-white/10 bg-white/5 text-neutral-300 hover:border-white/20 hover:text-white",
      )}
    >
      {busy ? (
        <IconLoader2 size={18} className="animate-spin" />
      ) : recording ? (
        <IconPlayerStopFilled size={16} className="animate-pulse" />
      ) : (
        <IconMicrophone size={18} />
      )}
    </button>
  );
}
