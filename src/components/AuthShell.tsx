import { motion, useReducedMotion } from "framer-motion";
import { Sparkles } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Shared frame for the signed-out surfaces (sign in, create account).
 * Keeps product identity and layout identical across both.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  glowPosition = "30% 20%",
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
  glowPosition?: string;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[max(2.5rem,env(safe-area-inset-top))]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(circle at ${glowPosition}, oklch(0.82 0.15 210 / 0.12), transparent 60%)`,
        }}
      />
      <motion.main
        initial={reduceMotion ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.28, ease: "easeOut" }}
        className="surface-elevated relative w-full max-w-md rounded-3xl p-6 sm:p-8"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan to-cyan-glow">
            <Sparkles className="h-4 w-4 text-background" aria-hidden="true" />
          </div>
          <span className="font-display font-semibold tracking-tight">Nebula Wealth Hub</span>
        </div>

        <h1 className="mt-7 font-display text-3xl font-semibold tracking-tight text-balance">
          {title}
        </h1>
        <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{subtitle}</p>

        {children}

        <p className="mt-7 text-center text-sm text-muted-foreground">{footer}</p>
      </motion.main>
    </div>
  );
}
