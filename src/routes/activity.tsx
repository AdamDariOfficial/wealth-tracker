import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { ActivityFeed } from "@/components/ActivityFeed";
import { RealtimeStatus } from "@/components/RealtimeStatus";
import type { ActivityKind } from "@/hooks/use-activity-feed";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/activity")({ component: ActivityPage });

const FILTERS: { label: string; kinds?: ActivityKind[] }[] = [
  { label: "Everything" },
  { label: "Money movement", kinds: ["transaction", "transfer"] },
  { label: "Trading", kinds: ["weekly_report"] },
  { label: "Goals", kinds: ["goal"] },
  { label: "Reconciliation", kinds: ["reconciliation", "audit"] },
];

function ActivityPage() {
  const [idx, setIdx] = useState(0);
  const f = FILTERS[idx];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity"
        subtitle="Every event across treasury, trading, goals and reconciliation — in one stream."
        action={<RealtimeStatus />}
      />

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((opt, i) => (
          <button
            key={opt.label}
            onClick={() => setIdx(i)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs glass border transition-colors",
              i === idx
                ? "border-cyan/50 text-cyan bg-cyan/5"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <ActivityFeed kinds={f.kinds} compact={false} />
    </div>
  );
}
