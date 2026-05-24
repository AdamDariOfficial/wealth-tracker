import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, X, CalendarRange, Filter } from "lucide-react";
import { z } from "zod";

import { PageHeader } from "@/components/PageHeader";
import { ActivityFeed } from "@/components/ActivityFeed";
import { RealtimeStatus } from "@/components/RealtimeStatus";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FilterPresets } from "@/components/FilterPresets";
import { useFilterPresets } from "@/hooks/use-filter-presets";
import { useActivityTags, type ActivityFilters, type ActivityKind } from "@/hooks/use-activity-feed";
import { useAccounts, useAssets } from "@/hooks/use-ledger";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  k: z.string().optional(),
  acct: z.string().optional(),
  asset: z.string().optional(),
  tag: z.string().optional(),
  tg: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  q: z.string().optional(),
});

export const Route = createFileRoute("/activity")({
  component: ActivityPage,
  validateSearch: (s) => searchSchema.parse(s),
});

const QUICK: { label: string; kinds?: ActivityKind[] }[] = [
  { label: "Everything" },
  { label: "Money movement", kinds: ["transaction", "transfer"] },
  { label: "Trading", kinds: ["weekly_report"] },
  { label: "Goals", kinds: ["goal"] },
  { label: "Reconciliation", kinds: ["reconciliation", "audit"] },
];

type StoredPreset = {
  k?: string; acct?: string; asset?: string; tag?: string;
  tg?: string; from?: string; to?: string; q?: string;
};

function ActivityPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { rows: accounts } = useAccounts();
  const { rows: assets } = useAssets();
  const tags = useActivityTags();
  const { presets, save, remove } = useFilterPresets<StoredPreset>("activity");
  const [showAdvanced, setShowAdvanced] = useState(
    !!(search.acct || search.asset || search.tag || search.tg || search.from || search.to || search.q),
  );

  const quickIdx = useMemo(() => {
    if (!search.k) return 0;
    const set = new Set(search.k.split(","));
    return QUICK.findIndex((q) => {
      if (!q.kinds) return false;
      if (q.kinds.length !== set.size) return false;
      return q.kinds.every((k) => set.has(k));
    });
  }, [search.k]);

  const update = (patch: Partial<typeof search>) =>
    navigate({ search: (prev: typeof search) => ({ ...prev, ...patch }), replace: true });

  const reset = () => navigate({ search: {}, replace: true });

  const filters: ActivityFilters = useMemo(() => ({
    kinds: search.k ? (search.k.split(",") as ActivityKind[]) : undefined,
    accountId: search.acct ?? null,
    assetId: search.asset ?? null,
    transferGroupId: search.tg ?? null,
    tag: search.tag ?? null,
    dateFrom: search.from ?? null,
    dateTo: search.to ?? null,
    q: search.q ?? null,
  }), [search]);

  const activeCount = [
    search.acct, search.asset, search.tag, search.tg, search.from, search.to, search.q,
  ].filter(Boolean).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity"
        subtitle="Every event across treasury, trading, goals and reconciliation — in one stream."
        action={<RealtimeStatus />}
      />

      {/* Quick filter pills */}
      <div className="flex flex-wrap items-center gap-1.5">
        {QUICK.map((opt, i) => {
          const active = i === quickIdx || (i === 0 && quickIdx === -1 && !search.k);
          return (
            <button
              key={opt.label}
              onClick={() => update({ k: opt.kinds?.join(",") || undefined })}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs glass border transition-colors",
                active
                  ? "border-cyan/50 text-cyan bg-cyan/5"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {opt.label}
            </button>
          );
        })}

        <div className="ml-auto flex items-center gap-1.5">
          <FilterPresets<StoredPreset>
            presets={presets}
            onApply={(v) => navigate({ search: v as any, replace: true })}
            onSave={(name) => save(name, search as StoredPreset)}
            onDelete={remove}
          />
          <Button
            variant="ghost" size="sm" className="text-xs h-8"
            onClick={() => setShowAdvanced((s) => !s)}
          >
            <Filter className="h-3 w-3 mr-1" />
            Advanced{activeCount ? ` (${activeCount})` : ""}
          </Button>
          {activeCount > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-8 text-muted-foreground" onClick={reset}>
              <X className="h-3 w-3 mr-1" /> Clear
            </Button>
          )}
        </div>
      </div>

      {showAdvanced && (
        <div className="glass rounded-2xl p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="relative col-span-full md:col-span-2 lg:col-span-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search title, note, tag…"
              value={search.q ?? ""}
              onChange={(e) => update({ q: e.target.value || undefined })}
              className="h-9 text-xs pl-8"
            />
          </div>

          <Select value={search.acct ?? "all"} onValueChange={(v) => update({ acct: v === "all" ? undefined : v })}>
            <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Account" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All accounts</SelectItem>
              {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={search.asset ?? "all"} onValueChange={(v) => update({ asset: v === "all" ? undefined : v })}>
            <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Asset" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All assets</SelectItem>
              {assets.map((a) => <SelectItem key={a.id} value={a.id}>{a.symbol} · {a.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={search.tag ?? "all"} onValueChange={(v) => update({ tag: v === "all" ? undefined : v })}>
            <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Tag" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tags</SelectItem>
              {tags.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1.5">
            <CalendarRange className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <Input
              type="date" value={search.from ?? ""}
              onChange={(e) => update({ from: e.target.value || undefined })}
              className="h-9 text-xs"
            />
            <span className="text-xs text-muted-foreground">→</span>
            <Input
              type="date" value={search.to ?? ""}
              onChange={(e) => update({ to: e.target.value || undefined })}
              className="h-9 text-xs"
            />
          </div>

          <Input
            placeholder="Transfer group id (uuid)…"
            value={search.tg ?? ""}
            onChange={(e) => update({ tg: e.target.value || undefined })}
            className="h-9 text-xs font-mono"
          />
        </div>
      )}

      <ActivityFeed filters={filters} compact={false} />
    </div>
  );
}
