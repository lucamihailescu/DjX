"use client";

import { motion } from "motion/react";
import { IconBrandSpotify } from "@tabler/icons-react";
import { Spotlight } from "./ui/spotlight";
import { HoverBorderGradient } from "./ui/hover-border-gradient";

export function Login({
  onLogin,
  error,
  entraUser,
}: {
  onLogin: () => void;
  error?: string | null;
  entraUser?: { name: string | null; email: string | null } | null;
}) {
  const entraLabel = entraUser?.email || entraUser?.name;
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-black/[0.96] antialiased">
      <Spotlight className="-top-40 left-0 md:-top-20 md:left-60" fill="#1db954" />

      {/* grid backdrop */}
      <div className="pointer-events-none absolute inset-0 [background-size:40px_40px] [background-image:linear-gradient(to_right,#171717_1px,transparent_1px),linear-gradient(to_bottom,#171717_1px,transparent_1px)]" />
      <div className="pointer-events-none absolute inset-0 bg-black [mask-image:radial-gradient(ellipse_at_center,transparent_10%,black)]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative z-10 mx-auto max-w-2xl px-6 text-center"
      >
        <div className="mb-6 flex justify-center">
          <span className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-neutral-300">
            <IconBrandSpotify size={16} className="text-[#1db954]" /> Powered by the
            Spotify Web API
          </span>
        </div>

        <h1 className="bg-gradient-to-b from-neutral-50 to-neutral-400 bg-clip-text text-5xl font-bold text-transparent md:text-7xl">
          DjX
        </h1>
        <p className="mx-auto mt-5 max-w-lg text-base text-neutral-400 md:text-lg">
          A modern console for your Spotify. Browse your top tracks and artists,
          search the catalog, and control playback in real time.
        </p>

        <div className="mt-10 flex justify-center">
          <HoverBorderGradient
            as="button"
            onClick={onLogin}
            className="flex items-center gap-2 text-sm font-semibold"
          >
            <IconBrandSpotify size={20} className="text-[#1db954]" />
            Connect with Spotify
          </HoverBorderGradient>
        </div>

        {entraLabel && (
          <p className="mx-auto mt-6 text-xs text-neutral-500">
            Signed in as{" "}
            <span className="text-neutral-300">{entraLabel}</span>
            {" · "}
            <a
              href="/api/auth/signout"
              className="underline underline-offset-2 transition hover:text-neutral-300"
            >
              Sign out
            </a>
          </p>
        )}

        {error && (
          <p className="mx-auto mt-6 max-w-md rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </p>
        )}
      </motion.div>
    </div>
  );
}
