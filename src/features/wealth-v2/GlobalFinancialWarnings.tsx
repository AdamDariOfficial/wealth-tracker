import { Link } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCoreUI } from "@/lib/core-ui-store";
import { useI18n } from "@/lib/use-i18n";
import { useFinancialState } from "./use-financial-state";

export function GlobalFinancialWarnings() {
  const financial = useFinancialState();
  const openComposer = useCoreUI((state) => state.openComposer);
  const { t } = useI18n();
  const overview = financial.data;

  if (!overview || financial.isLoading || financial.isError) return null;

  const missingBaseCurrency = overview.baseCurrency === null;
  const missingValues = overview.totalPositionCount > 0 && !overview.valuationComplete;
  if (!missingBaseCurrency && !missingValues) return null;

  return (
    <section className="mb-4 space-y-2 sm:mb-5" aria-label={t("Workspace warnings")}>
      {missingBaseCurrency ? (
        <div className="rounded-2xl border border-warning/25 bg-warning/5 p-4" role="status">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-warning">
                  {t("Base currency needed")}
                </div>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {t(
                    "Choose your base currency before relying on workspace totals and comparisons.",
                  )}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" asChild className="shrink-0">
              <Link to="/settings">{t("Open Settings")}</Link>
            </Button>
          </div>
        </div>
      ) : null}

      {missingValues ? (
        <div className="rounded-2xl border border-warning/25 bg-warning/5 p-4" role="status">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-warning">
                  {t("Some values are missing")}
                </div>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {overview.knownPositionCount} {t("of")} {overview.totalPositionCount}{" "}
                  {t(
                    "positions have a known value. Missing values stay unknown rather than being counted as zero.",
                  )}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => openComposer("market-data")}
            >
              {t("Add missing prices")}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
