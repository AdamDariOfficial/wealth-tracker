import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function FinancialLoading() {
  return (
    <div className="grid gap-3" aria-label="Loading financial state">
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className="h-24 animate-pulse rounded-2xl bg-muted/40 motion-reduce:animate-none"
        />
      ))}
    </div>
  );
}

export function FinancialError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
        <div className="min-w-0 flex-1">
          <h2 className="font-display font-semibold">Canonical financial state unavailable</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {error instanceof Error
              ? error.message
              : "The v2 financial repository could not be loaded."}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Phase 3 expects the Phase 2 v2 schema and RPCs in the Supabase environment used for QA.
            No legacy-table fallback is used.
          </p>
          <Button type="button" variant="outline" size="sm" className="mt-4" onClick={retry}>
            <RefreshCw className="mr-1.5 h-4 w-4" /> Retry
          </Button>
        </div>
      </div>
    </div>
  );
}
