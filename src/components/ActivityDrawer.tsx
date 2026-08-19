import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  ArrowLeftRight,
  ShieldCheck,
  BarChart3,
  Target,
  Wallet,
  AlertTriangle,
  Activity as ActivityIcon,
  ChevronRight,
  ExternalLink,
  Eye,
  EyeOff,
  Hash,
  GitBranch,
  Upload,
} from "lucide-react";
import type { ActivityEvent, ActivityKind } from "@/hooks/use-activity-feed";
import { useActivityFeed } from "@/hooks/use-activity-feed";
import { useAccounts, useAssets } from "@/hooks/use-ledger";
import { formatMoney } from "@/lib/format-currency";

const ICON: Record<ActivityKind, typeof ActivityIcon> = {
  transaction: ArrowLeftRight,
  transfer: ArrowLeftRight,
  reconciliation: ShieldCheck,
  audit: AlertTriangle,
  weekly_report: BarChart3,
  goal: Target,
  account: Wallet,
  import: Upload,
};

const TONE_RING: Record<string, string> = {
  positive: "ring-success/40 text-success",
  negative: "ring-destructive/40 text-destructive",
  warning: "ring-amber-400/40 text-amber-400",
  neutral: "ring-border/40 text-muted-foreground",
};

function Field({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex justify-between items-start gap-3 py-1.5 text-xs">
      <span className="text-muted-foreground/80 uppercase tracking-wider text-[10px]">{label}</span>
      <span className={cn("text-right max-w-[60%] break-words", mono && "font-mono")}>{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl glass p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground/80 mb-2">
        {title}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function LinkRow({ to, label, hint }: { to: string; label: string; hint?: string }) {
  return (
    <Link
      to={to}
      className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-white/[0.04] group"
    >
      <span className="flex items-center gap-2 min-w-0">
        <ExternalLink className="h-3 w-3 text-cyan shrink-0" />
        <span className="truncate">{label}</span>
        {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
      </span>
      <ChevronRight className="h-3 w-3 text-muted-foreground group-hover:text-cyan transition-colors" />
    </Link>
  );
}

export function ActivityDrawer({
  event,
  onClose,
  onSelect,
}: {
  event: ActivityEvent | null;
  onClose: () => void;
  onSelect: (e: ActivityEvent) => void;
}) {
  const open = !!event;
  const [advanced, setAdvanced] = useState(false);
  const { rows: accounts } = useAccounts();
  const { rows: assets } = useAssets();
  const all = useActivityFeed();

  const links = useMemo(() => {
    if (!event) return [] as ActivityEvent[];
    const set = new Map<string, ActivityEvent>();
    for (const e of all) {
      if (e.id === event.id) continue;
      if (event.refs.transferGroupId && e.refs.transferGroupId === event.refs.transferGroupId)
        set.set(e.id, e);
      if (event.refs.txId && e.refs.txId === event.refs.txId) set.set(e.id, e);
      if (event.refs.reportId && e.refs.txId === event.refs.txId && event.refs.txId)
        set.set(e.id, e);
    }
    return Array.from(set.values()).slice(0, 8);
  }, [event, all]);

  if (!event) return null;
  const Icon = ICON[event.kind] ?? ActivityIcon;
  const accName = (id?: string | null) =>
    id ? (accounts.find((a) => a.id === id)?.name ?? id.slice(0, 8)) : null;
  const assName = (id?: string | null) =>
    id ? (assets.find((a) => a.id === id)?.symbol ?? "") : null;
  const m = (event.meta ?? {}) as Record<string, string | number | boolean | null | undefined>;
  const r = event.refs;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto bg-background/95 backdrop-blur-xl border-l-border/60">
        <SheetHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "h-10 w-10 rounded-xl glass-strong flex items-center justify-center ring-1",
                TONE_RING[event.tone ?? "neutral"],
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <SheetTitle className="capitalize text-base text-left">{event.title}</SheetTitle>
              <SheetDescription className="text-xs text-left">
                {new Date(event.at).toLocaleString(undefined, {
                  dateStyle: "full",
                  timeStyle: "medium",
                })}
              </SheetDescription>
            </div>
          </div>

          {event.amount != null && (
            <div
              className={cn(
                "text-2xl font-display font-bold",
                TONE_RING[event.tone ?? "neutral"].split(" ").pop(),
              )}
            >
              {event.amount >= 0 ? "+" : ""}
              {formatMoney(event.amount, { currency: event.currency ?? undefined })}
            </div>
          )}

          {event.subtitle && <div className="text-sm text-muted-foreground">{event.subtitle}</div>}

          {event.tags?.length ? (
            <div className="flex flex-wrap gap-1">
              {event.tags.map((t) => (
                <Badge key={t} variant="outline" className="text-[10px]">
                  {t}
                </Badge>
              ))}
            </div>
          ) : null}

          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="text-[10px] uppercase tracking-wider h-7"
              onClick={() => setAdvanced((s) => !s)}
            >
              {advanced ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
              {advanced ? "Friendly" : "Raw"}
            </Button>
          </div>
        </SheetHeader>

        <Separator className="my-4" />

        <div className="space-y-3">
          {/* Money movement details */}
          {(event.kind === "transaction" || event.kind === "transfer") && (
            <Section title="Movement">
              {r.sourceAccountId && <Field label="From" value={accName(r.sourceAccountId)} />}
              {r.destinationAccountId && (
                <Field label="To" value={accName(r.destinationAccountId)} />
              )}
              {r.assetId && <Field label="Asset" value={assName(r.assetId)} />}
              {m.quantity != null && (
                <Field
                  label="Quantity"
                  value={Number(m.quantity).toLocaleString(undefined, { maximumFractionDigits: 8 })}
                  mono
                />
              )}
              {m.asset_price != null && (
                <Field
                  label="Price"
                  value={`${Number(m.asset_price).toLocaleString(undefined, { maximumFractionDigits: 6 })} ${m.asset_currency ?? ""}`}
                  mono
                />
              )}
              {m.fiat_value != null && (
                <Field label="Fiat value" value={formatMoney(Number(m.fiat_value))} mono />
              )}
              {m.fee_amount != null && Number(m.fee_amount) !== 0 && (
                <Field label="Fee" value={formatMoney(Number(m.fee_amount))} mono />
              )}
            </Section>
          )}

          {/* FX normalization */}
          {(event.kind === "transaction" || event.kind === "transfer") &&
            (m.base_value != null || m.exchange_rate != null) && (
              <Section title="FX normalization">
                {m.base_value != null && (
                  <Field
                    label="Base value"
                    value={`${formatMoney(Number(m.base_value))} ${m.base_currency ?? ""}`}
                    mono
                  />
                )}
                {m.exchange_rate != null && (
                  <Field
                    label="Rate"
                    value={Number(m.exchange_rate).toLocaleString(undefined, {
                      maximumFractionDigits: 6,
                    })}
                    mono
                  />
                )}
                {m.asset_currency && m.base_currency && (
                  <Field label="Chain" value={`${m.asset_currency} → ${m.base_currency}`} mono />
                )}
              </Section>
            )}

          {/* Reconciliation balance impact */}
          {(event.kind === "reconciliation" || event.kind === "audit") &&
            (m.before_balance != null || m.after_balance != null || m.delta != null) && (
              <Section title="Balance impact">
                {m.before_balance != null && (
                  <Field label="Before" value={formatMoney(Number(m.before_balance))} mono />
                )}
                {m.after_balance != null && (
                  <Field label="After" value={formatMoney(Number(m.after_balance))} mono />
                )}
                {m.delta != null && (
                  <Field label="Delta" value={formatMoney(Number(m.delta))} mono />
                )}
              </Section>
            )}

          {/* Weekly report */}
          {event.kind === "weekly_report" && (
            <Section title="Trading week">
              <Field label="Week" value={m.week_start} />
              <Field label="Trades" value={m.num_trades} mono />
              <Field
                label="Win rate"
                value={`${Math.round((Number(m.winrate) || 0) * 100)}%`}
                mono
              />
              <Field label="Avg RR" value={Number(m.avg_rr || 0).toFixed(2)} mono />
              <Field label="State" value={m.finalized ? "Finalized" : "Draft"} />
            </Section>
          )}

          {/* Goal */}
          {event.kind === "goal" && (
            <Section title="Goal progress">
              <Field label="Current" value={formatMoney(Number(m.current_amount))} mono />
              <Field label="Target" value={formatMoney(Number(m.target_amount))} mono />
              <Field label="Progress" value={`${Math.round(Number(m.pct) * 100)}%`} mono />
            </Section>
          )}

          {/* Voided / archived warnings */}
          {m.voided_at && (
            <div className="rounded-xl glass border border-amber-400/30 p-3 text-xs text-amber-300">
              <div className="font-semibold mb-1">This transaction has been voided.</div>
              {m.voided_reason && <div className="opacity-80">{m.voided_reason}</div>}
            </div>
          )}

          {/* Linked events */}
          {links.length > 0 && (
            <Section title="Linked events">
              <div className="space-y-1">
                {links.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => onSelect(l)}
                    className="w-full flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-white/[0.04] group text-left"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <GitBranch className="h-3 w-3 text-cyan shrink-0" />
                      <span className="truncate capitalize">{l.title}</span>
                      <span className="text-[10px] text-muted-foreground/70">
                        {l.kind.replace("_", " ")}
                      </span>
                    </span>
                    <ChevronRight className="h-3 w-3 text-muted-foreground group-hover:text-cyan" />
                  </button>
                ))}
              </div>
            </Section>
          )}

          {/* Linked navigation */}
          <Section title="Open">
            {r.sourceAccountId && (
              <LinkRow
                to={`/accounts/${r.sourceAccountId}`}
                label={`Account · ${accName(r.sourceAccountId)}`}
                hint="source"
              />
            )}
            {r.destinationAccountId && r.destinationAccountId !== r.sourceAccountId && (
              <LinkRow
                to={`/accounts/${r.destinationAccountId}`}
                label={`Account · ${accName(r.destinationAccountId)}`}
                hint="dest"
              />
            )}
            {r.accountId &&
              r.accountId !== r.sourceAccountId &&
              r.accountId !== r.destinationAccountId && (
                <LinkRow
                  to={`/accounts/${r.accountId}`}
                  label={`Account · ${accName(r.accountId)}`}
                />
              )}
            {r.assetId && <LinkRow to="/crypto" label={`Asset · ${assName(r.assetId)}`} />}
            {(event.kind === "transaction" || event.kind === "transfer") && (
              <LinkRow to="/transactions" label="All transactions" />
            )}
            {event.kind === "weekly_report" && <LinkRow to="/trading" label="Trading workspace" />}
            {event.kind === "goal" && <LinkRow to="/goals" label="All goals" />}
            {(event.kind === "audit" || event.kind === "reconciliation") && (
              <LinkRow to="/audit" label="Audit log" />
            )}
          </Section>

          {/* Raw / advanced mode */}
          {advanced && (
            <Section title="Raw payload">
              <div className="space-y-2">
                <Field label="Event ID" value={<span className="font-mono">{event.id}</span>} />
                {r.txId && (
                  <Field
                    label="Transaction ID"
                    value={<span className="font-mono">{r.txId}</span>}
                    mono
                  />
                )}
                {r.transferGroupId && (
                  <Field
                    label="Transfer group"
                    value={
                      <span className="font-mono flex items-center gap-1">
                        <Hash className="h-3 w-3" />
                        {r.transferGroupId.slice(0, 8)}
                      </span>
                    }
                    mono
                  />
                )}
                {r.auditId && (
                  <Field
                    label="Audit ID"
                    value={<span className="font-mono">{r.auditId}</span>}
                    mono
                  />
                )}
                <pre className="mt-2 text-[10px] font-mono text-muted-foreground/80 whitespace-pre-wrap break-all bg-black/30 rounded-lg p-2 max-h-72 overflow-y-auto">
                  {JSON.stringify({ refs: event.refs, meta: event.meta }, null, 2)}
                </pre>
              </div>
            </Section>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
