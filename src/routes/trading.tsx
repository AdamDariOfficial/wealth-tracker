import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { OverviewTab } from "@/components/trading/OverviewTab";
import { CapitalTab } from "@/components/trading/CapitalTab";
import { WeeklyTab } from "@/components/trading/WeeklyTab";
import { InsightsTab } from "@/components/trading/InsightsTab";

type Tab = "overview" | "capital" | "weekly" | "insights";
const TABS: Tab[] = ["overview", "capital", "weekly", "insights"];

export const Route = createFileRoute("/trading")({
  component: TradingWorkspace,
  validateSearch: (s: Record<string, unknown>): { tab?: Tab } => {
    const raw = typeof s.tab === "string" ? s.tab : "";
    if (raw === "trades") return { tab: "insights" }; // back-compat
    return (TABS as string[]).includes(raw) ? { tab: raw as Tab } : {};
  },
});

function TradingWorkspace() {
  const navigate = useNavigate({ from: "/trading" });
  const { tab = "overview" } = useSearch({ from: "/trading" }) as { tab?: Tab };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Trading Workspace"
        subtitle="Capital allocation, risk parameters, weekly reviews and performance insights — derived from the canonical ledger."
      />

      <Tabs value={tab} onValueChange={(v) => navigate({ search: { tab: v as Tab } })}>
        <TabsList className="bg-muted/40 border border-border/40 h-10">
          <TabsTrigger value="overview" className="px-4">Overview</TabsTrigger>
          <TabsTrigger value="capital"  className="px-4">Capital</TabsTrigger>
          <TabsTrigger value="weekly"   className="px-4">Weekly</TabsTrigger>
          <TabsTrigger value="insights" className="px-4">Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6"><OverviewTab /></TabsContent>
        <TabsContent value="capital"  className="mt-6"><CapitalTab /></TabsContent>
        <TabsContent value="weekly"   className="mt-6"><WeeklyTab /></TabsContent>
        <TabsContent value="insights" className="mt-6"><InsightsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
