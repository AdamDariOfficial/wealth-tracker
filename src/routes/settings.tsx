import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Database, Globe2, LogOut, Save, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";
import { completeValidatedOnboarding } from "@/application/services";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { financialV2Keys } from "@/data/query-keys";
import { useFinancialState } from "@/features/wealth-v2/use-financial-state";
import { useAuth } from "@/lib/auth-store";
import { financialV2Repository } from "@/lib/v2-runtime";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

function SettingsCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof UserRound;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="glass rounded-2xl p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan/10 text-cyan">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h2 className="font-display font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function SettingsPage() {
  const { profile, signOut, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const financial = useFinancialState();
  const [displayName, setDisplayName] = useState("");
  const [baseCurrency, setBaseCurrency] = useState("EUR");
  const [locale, setLocale] = useState("it-IT");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.displayName ?? "");
    setBaseCurrency(profile.baseCurrency?.toString() ?? "EUR");
    setLocale(profile.locale ?? "it-IT");
  }, [profile]);

  const handleSignOut = async () => {
    try {
      await signOut();
      queryClient.removeQueries({ queryKey: financialV2Keys.all });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not sign out");
    }
  };

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await completeValidatedOnboarding(financialV2Repository, {
        displayName: displayName.trim() || null,
        baseCurrency: baseCurrency.trim().toUpperCase(),
        locale: locale.trim(),
      });
      await refreshProfile();
      await queryClient.invalidateQueries({ queryKey: financialV2Keys.all });
      toast.success("Profile saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Settings"
        subtitle="Canonical profile and workspace safety for the rebuilt financial core."
        action={
          <Button variant="outline" onClick={() => void handleSignOut()} className="min-h-11">
            <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
            Sign out
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SettingsCard
          icon={UserRound}
          title="Profile"
          description="These values are stored in v2_profiles and drive the canonical financial view."
        >
          <form onSubmit={saveProfile} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="settings-display-name">Display name</Label>
              <Input
                id="settings-display-name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                maxLength={120}
                placeholder="Adam"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="settings-base-currency">Base currency</Label>
                <Input
                  id="settings-base-currency"
                  value={baseCurrency}
                  onChange={(event) => setBaseCurrency(event.target.value.toUpperCase())}
                  minLength={3}
                  maxLength={3}
                  required
                  placeholder="EUR"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="settings-locale">Locale</Label>
                <Input
                  id="settings-locale"
                  value={locale}
                  onChange={(event) => setLocale(event.target.value)}
                  required
                  placeholder="it-IT"
                />
              </div>
            </div>
            <Button
              type="submit"
              disabled={saving || baseCurrency.trim().length !== 3 || !locale.trim()}
              className="min-h-11 bg-cyan text-background hover:bg-cyan/90"
            >
              <Save className="mr-2 h-4 w-4" aria-hidden="true" />
              {saving ? "Saving…" : "Save profile"}
            </Button>
          </form>
        </SettingsCard>

        <SettingsCard
          icon={Globe2}
          title="Valuation context"
          description="Unknown market data remains visible instead of being converted to a false zero."
        >
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Base currency
              </div>
              <div className="mt-2 font-mono text-lg font-semibold">
                {financial.data?.baseCurrency ?? profile?.baseCurrency?.toString() ?? "—"}
              </div>
            </div>
            <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Completeness
              </div>
              <div className="mt-2 font-mono text-lg font-semibold">
                {financial.data
                  ? `${financial.data.knownPositionCount}/${financial.data.totalPositionCount}`
                  : "—"}
              </div>
            </div>
          </div>
        </SettingsCard>

        <SettingsCard
          icon={Database}
          title="Data management"
          description="Import, backup, restore and reset are advanced Phase 4 workflows."
        >
          <p className="text-sm leading-6 text-muted-foreground">
            The rebuilt core intentionally does not reuse the legacy export/reset paths. Those
            workflows will return only after schema validation, atomic restore invariants and
            rollback behavior are implemented against the canonical ledger.
          </p>
        </SettingsCard>

        <SettingsCard
          icon={ShieldCheck}
          title="Safety boundary"
          description="Phase 3 does not authorize remote database changes or production data migration."
        >
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Financial writes use reviewed v2 RPCs and preserve immutable posted history.</p>
            <p>
              Remote migration, deployment and legacy-data migration remain separate explicit gates.
            </p>
          </div>
        </SettingsCard>
      </div>
    </div>
  );
}
