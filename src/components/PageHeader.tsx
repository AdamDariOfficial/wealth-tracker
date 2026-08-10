import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.3 }}
      className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-4"
    >
      <div className="min-w-0">
        <h1 className="font-display text-display-lg truncate font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 max-w-xl text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action && <div className="flex flex-wrap items-center gap-2 [&>*]:shrink-0">{action}</div>}
    </motion.div>
  );
}
