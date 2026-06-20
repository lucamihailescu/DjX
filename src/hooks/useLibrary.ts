"use client";

import { useCallback, useRef, useState } from "react";
import type { SpotifyApi } from "@spotify/web-api-ts-sdk";
import { checkSaved, saveTrack, removeSavedTrack } from "@/lib/library";

/**
 * Tracks "saved" state for track ids across the app. `prime` batch-checks ids
 * it hasn't seen; `toggle` optimistically flips state and reverts on error.
 */
export function useLibrary(sdk: SpotifyApi) {
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const known = useRef<Set<string>>(new Set());

  const prime = useCallback(
    async (ids: string[]) => {
      const fresh = ids.filter((id) => id && !known.current.has(id));
      if (fresh.length === 0) return;
      fresh.forEach((id) => known.current.add(id));
      try {
        for (let i = 0; i < fresh.length; i += 50) {
          const chunk = fresh.slice(i, i + 50);
          const results = await checkSaved(sdk, chunk);
          setSaved((prev) => {
            const next = { ...prev };
            chunk.forEach((id, idx) => (next[id] = results[idx] ?? false));
            return next;
          });
        }
      } catch {
        fresh.forEach((id) => known.current.delete(id));
      }
    },
    [sdk],
  );

  const toggle = useCallback(
    async (id: string) => {
      let nextVal = false;
      setSaved((prev) => {
        nextVal = !prev[id];
        return { ...prev, [id]: nextVal };
      });
      known.current.add(id);
      try {
        if (nextVal) await saveTrack(sdk, id);
        else await removeSavedTrack(sdk, id);
      } catch {
        setSaved((prev) => ({ ...prev, [id]: !nextVal }));
      }
    },
    [sdk],
  );

  return { saved, prime, toggle };
}
