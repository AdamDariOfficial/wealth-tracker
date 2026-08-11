import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Route-shaped loading skeleton. Mirrors the common page rhythm
 * (header → metric row → content sections) so content does not jump
 * when it arrives. Animation is suppressed under reduced motion.
 */
export function FinancialLoading({ className }: { className?: string }) {
  return (
    <div
      className={cn("space-y-5 sm:space-y-6", className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">Loading your financial data</span>

      {/* Page header */}
      <div className="space-y-2">
        <div className="h-8 w-56 max-w-full animate-pulse rounded-lg bg-muted/40 motion-reduce:animate-none" />
        <div className="h-4 w-72 max-w-full animate-pulse rounded bg-muted/25 motion-reduce:animate-none" />
      </div>

      {/* Metric row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="surface-section p-4 sm:p-5">
            <div className="h-3 w-20 max-w-full animate-pulse rounded bg-muted/30 motion-reduce:animate-none" />
            <div className="mt-3 h-6 w-28 max-w-full animate-pulse rounded bg-muted/40 motion-reduce:animate-none" />
          </div>
        ))}
      </div>

      {/* Content sections */}
      <div className="grid gap-4 lg:grid-cols-2">
        {[0, 1].map((section) => (
          <div key={section} className="surface-section space-y-3 p-4 sm:p-5">
            <div className="h-4 w-36 max-w-full animate-pulse rounded bg-muted/35 motion-reduce:animate-none" />
            {[0, 1, 2].map((row) => (
              <div
                key={row}
                className="h-12 animate-pulse rounded-xl bg-muted/20 motion-reduce:animate-none"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Human-language error state with a local retry. Deliberately free of
 * implementation detail — people need to know what to do, not how the
 * data layer is wired.
 */
export function FinancialError({ error, retry }: { error: unknown; retry: () => void }) {
  const detail = error instanceof Error ? error.message : null;

  return (
    <div
      className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 sm:p-6"
      role="alert"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-base font-semibold">We couldn&apos;t load your data</h2>
          <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
            Something went wrong while loading your accounts and balances. Your records are safe —
            nothing has been changed.
          </p>
          {detail && (
            <p className="mt-2 break-words text-xs leading-5 text-muted-foreground/80">{detail}</p>
          )}
          <Button type="button" variant="outline" size="sm" className="mt-4" onClick={retry}>
            <RefreshCw className="mr-1.5 h-4 w-4" aria-hidden="true" /> Try again
          </Button>
        </div>
      </div>
    </div>
  );
}
