"use client";

import { useState } from "react";
import {
  IconPlayerPlayFilled,
  IconExternalLink,
  IconTrash,
  IconCheck,
  IconX,
  IconLoader2,
  IconHeart,
  IconHeartFilled,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";

export function MediaCard({
  image,
  title,
  subtitle,
  href,
  round = false,
  onPlay,
  onDelete,
  saved,
  onToggleSave,
}: {
  image?: string;
  title: string;
  subtitle?: string;
  href?: string;
  round?: boolean;
  onPlay?: () => void;
  onDelete?: () => void | Promise<void>;
  saved?: boolean;
  onToggleSave?: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete?.();
    } finally {
      setDeleting(false);
      setConfirming(false);
    }
  };

  return (
    <div className="group relative flex flex-col gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3 transition duration-200 hover:border-white/15 hover:bg-white/[0.05]">
      <div
        className={cn(
          "relative aspect-square w-full overflow-hidden bg-white/5 shadow-lg",
          round ? "rounded-full" : "rounded-lg",
        )}
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt=""
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-neutral-800 to-neutral-900" />
        )}

        {onDelete && !confirming && (
          <button
            onClick={() => setConfirming(true)}
            aria-label={`Delete ${title}`}
            className="absolute left-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-neutral-200 opacity-0 backdrop-blur transition hover:bg-red-500 hover:text-white group-hover:opacity-100"
          >
            <IconTrash size={15} />
          </button>
        )}

        {onDelete && confirming && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/80 p-3 text-center backdrop-blur-sm">
            <span className="text-xs font-medium text-neutral-100">
              Delete this playlist?
            </span>
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={deleting}
                aria-label="Confirm delete"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-red-500 text-white transition hover:bg-red-400 disabled:opacity-50"
              >
                {deleting ? (
                  <IconLoader2 size={16} className="animate-spin" />
                ) : (
                  <IconCheck size={16} />
                )}
              </button>
              <button
                onClick={() => setConfirming(false)}
                disabled={deleting}
                aria-label="Cancel"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25 disabled:opacity-50"
              >
                <IconX size={16} />
              </button>
            </div>
          </div>
        )}

        {onToggleSave && (
          <button
            onClick={onToggleSave}
            aria-label={saved ? `Remove ${title} from Liked Songs` : `Save ${title} to Liked Songs`}
            className={cn(
              "absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 backdrop-blur transition hover:scale-110",
              saved
                ? "text-[#1ed760] opacity-100"
                : "text-neutral-200 opacity-0 hover:text-white group-hover:opacity-100",
            )}
          >
            {saved ? <IconHeartFilled size={16} /> : <IconHeart size={16} />}
          </button>
        )}

        {onPlay && (
          <button
            onClick={onPlay}
            aria-label={`Play ${title}`}
            className="absolute bottom-2 right-2 flex h-11 w-11 translate-y-2 items-center justify-center rounded-full bg-[#1db954] text-black opacity-0 shadow-xl transition duration-200 hover:scale-105 group-hover:translate-y-0 group-hover:opacity-100"
          >
            <IconPlayerPlayFilled size={20} />
          </button>
        )}
      </div>

      <div className="min-w-0">
        <div className="flex items-center gap-1">
          <span className="truncate text-sm font-semibold text-neutral-100">
            {title}
          </span>
          {href && (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 text-neutral-500 opacity-0 transition hover:text-white group-hover:opacity-100"
              aria-label="Open in Spotify"
            >
              <IconExternalLink size={14} />
            </a>
          )}
        </div>
        {subtitle && (
          <div className="truncate text-xs text-neutral-400">{subtitle}</div>
        )}
      </div>
    </div>
  );
}

export function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between">
      <h2 className="text-lg font-bold tracking-tight text-neutral-100">
        {title}
      </h2>
      {action}
    </div>
  );
}
