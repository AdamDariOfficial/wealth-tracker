import { motion } from "framer-motion";
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
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end sm:justify-between gap-3 sm:gap-4"
    >
      <div className="min-w-0">
        <h1 className="font-display text-display-lg font-bold tracking-tight truncate">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm text-muted-foreground max-w-xl">{subtitle}</p>
        )}
      </div>
      {action && (
        <div className="flex items-center gap-2 flex-wrap [&>*]:shrink-0">
          {action}
        </div>
      )}
    </motion.div>
  );
}
