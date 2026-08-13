import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { completeValidatedOnboarding } from "@/application/services";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { financialV2Keys } from "@/data/query-keys";
import { useAuth } from "@/lib/auth-store";
import { financialV2Repository } from "@/lib/v2-runtime";
import { describeActionError } from "@/features/wealth-v2/user-message";

export const Route = createFileRoute("/onboarding")({ component: OnboardingPage });

function OnboardingPage() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState(
    () => profile?.displayName ?? (user?.user_metadata?.display_name as string | undefined) ?? "",
  );
  const [baseCurrency, setBaseCurrency] = useState(
    () => profile?.baseCurrency?.toString() ?? "EUR",
  );
  const [locale, setLocale] = useState(
    () => profile?.locale ?? (typeof navigator !== "undefined" ? navigator.language : "it-IT"),
  );
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
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
      toast.success("Wealth profile ready");
      await navigate({ to: "/", replace: true });
    } catch (error) {
      toast.error(describeActionError(error, "Could not complete onboarding"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,oklch(0.82_0.15_210_/_0.1),transparent_60%)]" />
      <form
        onSubmit={submit}
        className="surface-elevated relative w-full max-w-xl space-y-6 p-6 sm:p-8"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan to-cyan-glow">
            <Sparkles className="h-4 w-4 text-background" />
          </div>
          <div>
            <div className="font-display font-semibold">Nebula Wealth Hub</div>
            <div className="text-xs text-muted-foreground">Set up your profile</div>
          </div>
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Set your wealth baseline</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Just two details to get started. You can change them at any time in Settings, and add
            planning and trading preferences later.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="display-name">Display name</Label>
          <Input
            id="display-name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Adam"
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="base-currency">Base currency</Label>
            <Input
              id="base-currency"
              value={baseCurrency}
              onChange={(event) => setBaseCurrency(event.target.value.toUpperCase())}
              maxLength={3}
              placeholder="EUR"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="locale">Locale</Label>
            <Input
              id="locale"
              value={locale}
              onChange={(event) => setLocale(event.target.value)}
              placeholder="it-IT"
              required
            />
          </div>
        </div>
        <div className="rounded-xl border border-cyan/20 bg-cyan/5 p-4 text-xs text-muted-foreground">
          Your net worth, account values and portfolio totals are calculated from the activity you
          record. Missing prices or FX rates remain unknown rather than being silently treated as
          zero.
        </div>
        <Button
          type="submit"
          disabled={saving || baseCurrency.trim().length !== 3 || !locale.trim()}
          className="min-h-11 w-full bg-cyan text-background hover:bg-cyan/90"
        >
          {saving ? (
            "Saving…"
          ) : (
            <>
              Continue <ArrowRight className="ml-1 h-4 w-4" />
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
