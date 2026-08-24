import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { useI18n } from "@/lib/use-i18n";

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
  const { t } = useI18n();
  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.2, ease: "easeOut" }}
      className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-4"
    >
      <div className="min-w-0">
        <h1 className="font-display text-display-lg font-bold tracking-tight text-balance">
          {t(title)}
        </h1>
        {subtitle && (
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">{t(subtitle)}</p>
        )}
      </div>
      {action && <div className="flex flex-wrap items-center gap-2 [&>*]:shrink-0">{action}</div>}
    </motion.div>
  );
}
