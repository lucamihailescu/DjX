"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function BentoGrid({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto grid max-w-7xl grid-cols-1 gap-4 md:auto-rows-[18rem] md:grid-cols-3",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function BentoGridItem({
  className,
  header,
  title,
  description,
}: {
  className?: string;
  header?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "group/bento row-span-1 flex flex-col justify-between space-y-4 overflow-hidden rounded-2xl border border-white/10 bg-neutral-950/60 p-4 backdrop-blur-sm transition duration-200 hover:border-white/20 hover:shadow-[0_0_30px_-5px_rgba(29,185,84,0.4)]",
        className,
      )}
    >
      {header}
      <div className="transition duration-200 group-hover/bento:translate-x-1">
        {title && (
          <div className="mt-2 mb-1 font-semibold text-neutral-100">{title}</div>
        )}
        {description && (
          <div className="text-xs font-normal text-neutral-400">
            {description}
          </div>
        )}
      </div>
    </div>
  );
}
