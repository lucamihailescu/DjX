"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function BackgroundGradient({
  children,
  className,
  containerClassName,
  animate = true,
}: {
  children?: ReactNode;
  className?: string;
  containerClassName?: string;
  animate?: boolean;
}) {
  const variants = {
    initial: { backgroundPosition: "0 50%" },
    animate: { backgroundPosition: ["0, 50%", "100% 50%", "0 50%"] },
  };
  return (
    <div className={cn("relative p-[2px] group", containerClassName)}>
      <motion.div
        variants={animate ? variants : undefined}
        initial={animate ? "initial" : undefined}
        animate={animate ? "animate" : undefined}
        transition={
          animate
            ? { duration: 6, repeat: Infinity, repeatType: "reverse" }
            : undefined
        }
        style={{ backgroundSize: animate ? "400% 400%" : undefined }}
        className={cn(
          "absolute inset-0 rounded-3xl z-[1] opacity-60 group-hover:opacity-100 blur-xl transition duration-500 will-change-transform",
          "bg-[radial-gradient(circle_farthest-side_at_0_100%,#1db954,transparent),radial-gradient(circle_farthest-side_at_100%_0,#1ed760,transparent),radial-gradient(circle_farthest-side_at_100%_100%,#0ea5e9,transparent),radial-gradient(circle_farthest-side_at_0_0,#22d3ee,#141316)]",
        )}
      />
      <motion.div
        variants={animate ? variants : undefined}
        initial={animate ? "initial" : undefined}
        animate={animate ? "animate" : undefined}
        transition={
          animate
            ? { duration: 6, repeat: Infinity, repeatType: "reverse" }
            : undefined
        }
        style={{ backgroundSize: animate ? "400% 400%" : undefined }}
        className={cn(
          "absolute inset-0 rounded-3xl z-[1] will-change-transform",
          "bg-[radial-gradient(circle_farthest-side_at_0_100%,#1db954,transparent),radial-gradient(circle_farthest-side_at_100%_0,#1ed760,transparent),radial-gradient(circle_farthest-side_at_100%_100%,#0ea5e9,transparent),radial-gradient(circle_farthest-side_at_0_0,#22d3ee,#141316)]",
        )}
      />
      <div className={cn("relative z-10", className)}>{children}</div>
    </div>
  );
}
