interface Image {
  url: string;
  height?: number | null;
  width?: number | null;
}

/**
 * Pick an image URL. Spotify returns images largest-first (typically
 * 640 → 300 → 64). Default to "large" so cards stay crisp; pass "small" only
 * for genuinely tiny spots (avatars, the playback bar thumbnail) where the
 * 64px image is enough and saves bandwidth.
 */
export function pickImage(images?: Image[], prefer: "small" | "large" = "large") {
  if (!images || images.length === 0) return undefined;
  if (prefer === "small") return images[images.length - 1].url;
  return images[0].url;
}
