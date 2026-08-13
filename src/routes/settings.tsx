import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Database,
  Download,
  Globe2,
  LogOut,
  RotateCcw,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { completeValidatedOnboarding, validateBackupEnvelope } from "@/application/services";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { advancedV2Keys, financialV2Keys } from "@/data/query-keys";
import { useFinancialState } from "@/features/wealth-v2/use-financial-state";
import { useAuth } from "@/lib/auth-store";
import { advancedV2Repository, financialV2Repository } from "@/lib/v2-runtime";
import { describeActionError } from "@/features/wealth-v2/user-message";

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
    <section className="surface-section p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan/10 text-cyan">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h2 className="font-display font-semibold">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
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
  const restoreInputRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState("");
  const [baseCurrency, setBaseCurrency] = useState("EUR");
  const [locale, setLocale] = useState("it-IT");
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [restoreCandidate, setRestoreCandidate] = useState<ReturnType<
    typeof validateBackupEnvelope
  > | null>(null);
  const [restoreFilename, setRestoreFilename] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [resetConfirmation, setResetConfirmation] = useState("");
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.displayName ?? "");
    setBaseCurrency(profile.baseCurrency?.toString() ?? "EUR");
    setLocale(profile.locale ?? "it-IT");
  }, [profile]);

  const invalidateCanonicalCaches = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: financialV2Keys.all }),
      queryClient.invalidateQueries({ queryKey: advancedV2Keys.all }),
    ]);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      queryClient.removeQueries({ queryKey: financialV2Keys.all });
      queryClient.removeQueries({ queryKey: advancedV2Keys.all });
    } catch (error) {
      toast.error(describeActionError(error, "Could not sign out"));
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
      await invalidateCanonicalCaches();
      toast.success("Profile saved");
    } catch (error) {
      toast.error(describeActionError(error, "Could not save profile"));
    } finally {
      setSaving(false);
    }
  };

  const exportBackup = async () => {
    setExporting(true);
    try {
      const backup = await advancedV2Repository.exportBackup();
      const json = `${JSON.stringify(backup, null, 2)}\n`;
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const stamp = backup.exportedAt.slice(0, 19).replaceAll(":", "-");
      link.href = url;
      link.download = `nebula-wealth-hub-backup-v1-${stamp}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success("Versioned backup exported");
    } catch (error) {
      toast.error(describeActionError(error, "Backup export failed"));
    } finally {
      setExporting(false);
    }
  };

  const chooseRestore = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const backup = validateBackupEnvelope(parsed);
      setRestoreCandidate(backup);
      setRestoreFilename(file.name);
    } catch (error) {
      setRestoreCandidate(null);
      setRestoreFilename(null);
      toast.error(describeActionError(error, "Invalid backup file"));
    }
  };

  const restoreBackup = async () => {
    if (!restoreCandidate) return;
    setRestoring(true);
    try {
      await advancedV2Repository.restoreBackup(restoreCandidate);
      await refreshProfile();
      await invalidateCanonicalCaches();
      toast.success("Backup restored");
      setRestoreCandidate(null);
      setRestoreFilename(null);
    } catch (error) {
      toast.error(describeActionError(error, "Restore failed"));
    } finally {
      setRestoring(false);
    }
  };

  const resetWorkspace = async () => {
    setResetting(true);
    try {
      await advancedV2Repository.resetWorkspace(resetConfirmation);
      await invalidateCanonicalCaches();
      toast.success("Workspace reset. Your account was preserved.");
      setResetConfirmation("");
      setResetDialogOpen(false);
    } catch (error) {
      toast.error(describeActionError(error, "Reset failed"));
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Settings"
        subtitle="Your profile, currency, backups and workspace controls."
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
          description="Used to display every balance, total and chart across the app."
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
          description="Unknown market data stays visible instead of becoming a false zero."
        >
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
              <div className="label-muted">
                Base currency
              </div>
              <div className="mt-2 font-mono text-lg font-semibold">
                {financial.data?.baseCurrency ?? profile?.baseCurrency?.toString() ?? "—"}
              </div>
            </div>
            <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
              <div className="label-muted">
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
          title="Backup and restore"
          description="Download a complete copy of your data, or restore it in full from an earlier backup."
        >
          <div className="space-y-4">
            <div className="rounded-xl border border-border/50 bg-muted/15 p-4 text-sm text-muted-foreground">
              Restore validates the backup envelope and database invariants before commit. A
              rejected restore leaves the previous workspace intact.
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                disabled={exporting}
                onClick={() => void exportBackup()}
              >
                <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                {exporting ? "Exporting…" : "Export backup"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() => restoreInputRef.current?.click()}
              >
                <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
                Choose backup
              </Button>
              <input
                ref={restoreInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(event) => void chooseRestore(event)}
              />
            </div>
          </div>
        </SettingsCard>

        <SettingsCard
          icon={Trash2}
          title="Reset workspace"
          description="Permanently removes your financial data. Your account and sign-in stay intact."
        >
          <div className="space-y-4">
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-muted-foreground">
              This removes accounts, assets, ledger history, market observations, goals, trading
              reviews and import receipts. Export a backup first if you may need the data later.
            </div>
            <div className="space-y-2">
              <Label htmlFor="reset-confirmation">
                Type <span className="font-mono text-foreground">RESET WORKSPACE</span>
              </Label>
              <Input
                id="reset-confirmation"
                value={resetConfirmation}
                onChange={(event) => setResetConfirmation(event.target.value)}
                autoComplete="off"
              />
            </div>
            <Button
              type="button"
              variant="destructive"
              className="min-h-11"
              disabled={resetConfirmation !== "RESET WORKSPACE"}
              onClick={() => setResetDialogOpen(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
              Review reset
            </Button>
          </div>
        </SettingsCard>

        <SettingsCard
          icon={ShieldCheck}
          title="How your data is protected"
          description="The safeguards that sit behind every change you make."
        >
          <div className="space-y-2 text-sm leading-6 text-muted-foreground">
            <p>
              Recorded history is never overwritten. Corrections are added as new entries, so you
              always keep a full audit trail.
            </p>
            <p>
              Restoring a backup or resetting your workspace happens in a single step, behind an
              explicit confirmation. It either completes fully or not at all.
            </p>
            <p>Your data belongs to you. You can export a complete backup at any time.</p>
          </div>
        </SettingsCard>
      </div>

      <AlertDialog
        open={restoreCandidate !== null}
        onOpenChange={(open) => {
          if (!open && !restoring) {
            setRestoreCandidate(null);
            setRestoreFilename(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore this backup?</AlertDialogTitle>
            <AlertDialogDescription>
              {restoreFilename ?? "Selected backup"} will replace everything currently in your
              workspace in one database transaction. If any restored record violates schema or
              ledger invariants, the existing workspace remains unchanged.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoring}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={restoring}
              onClick={(event) => {
                event.preventDefault();
                void restoreBackup();
              }}
            >
              <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
              {restoring ? "Restoring…" : "Restore backup"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset your workspace?</AlertDialogTitle>
            <AlertDialogDescription>
              This destructive action cannot be undone without a valid backup. Your profile remains,
              but every account, transaction, asset and goal will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={resetting || resetConfirmation !== "RESET WORKSPACE"}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void resetWorkspace();
              }}
            >
              {resetting ? "Resetting…" : "Reset workspace"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
