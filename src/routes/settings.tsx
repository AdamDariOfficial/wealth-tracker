import { useEffect, useMemo, useRef, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Database,
  Download,
  LogOut,
  RotateCcw,
  Save,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { advancedV2Keys, financialV2Keys } from "@/data/query-keys";
import { useFinancialState } from "@/features/wealth-v2/use-financial-state";
import { describeActionError } from "@/features/wealth-v2/user-message";
import { useAuth } from "@/lib/auth-store";
import { useI18n } from "@/lib/use-i18n";
import { advancedV2Repository, financialV2Repository } from "@/lib/v2-runtime";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

function SettingRow({
  title,
  description,
  children,
}: Readonly<{ title: string; description: string; children: React.ReactNode }>) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col gap-3 py-5 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
      <div className="min-w-0">
        <h3 className="text-sm font-medium">{t(title)}</h3>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{t(description)}</p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">{children}</div>
    </div>
  );
}

function SettingsPage() {
  const { profile, signOut, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const financial = useFinancialState();
  const { t } = useI18n();
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

  const availableCurrencies = useMemo(
    () =>
      Array.from(
        new Set(
          (financial.data?.state.assets ?? [])
            .filter((asset) => asset.kind === "fiat" && asset.fiatCurrency !== null)
            .map((asset) => asset.fiatCurrency?.toString())
            .filter((currency): currency is string => Boolean(currency)),
        ),
      ).sort(),
    [financial.data?.state.assets],
  );
  const selectedCurrencyAvailable = availableCurrencies.includes(baseCurrency);

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.displayName ?? "");
    setBaseCurrency(profile.baseCurrency?.toString() ?? "");
    setLocale(profile.locale === "it-IT" ? "it-IT" : "en-US");
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
      toast.error(describeActionError(error, t("Could not sign out")));
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
      toast.success(t("Profile saved"));
    } catch (error) {
      toast.error(describeActionError(error, t("Could not save profile")));
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
      toast.success(t("Versioned backup exported"));
    } catch (error) {
      toast.error(describeActionError(error, t("Backup export failed")));
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
      toast.error(describeActionError(error, t("Invalid backup file")));
    }
  };

  const restoreBackup = async () => {
    if (!restoreCandidate) return;
    setRestoring(true);
    try {
      await advancedV2Repository.restoreBackup(restoreCandidate);
      await refreshProfile();
      await invalidateCanonicalCaches();
      toast.success(t("Backup restored"));
      setRestoreCandidate(null);
      setRestoreFilename(null);
    } catch (error) {
      toast.error(describeActionError(error, t("Restore failed")));
    } finally {
      setRestoring(false);
    }
  };

  const resetWorkspace = async () => {
    setResetting(true);
    try {
      await advancedV2Repository.resetWorkspace(resetConfirmation);
      await invalidateCanonicalCaches();
      toast.success(t("Workspace reset. Your account was preserved."));
      setResetConfirmation("");
      setResetDialogOpen(false);
    } catch (error) {
      toast.error(describeActionError(error, t("Reset failed")));
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl pb-8">
      <PageHeader
        title="Settings"
        subtitle="Your profile, your data and your account, in one place."
      />

      <section className="border-b border-border/60 py-7 first:pt-2 sm:py-9" aria-labelledby="settings-profile">
        <div className="mb-6 flex items-start gap-3">
          <UserRound className="mt-0.5 h-5 w-5 shrink-0 text-cyan" aria-hidden="true" />
          <div>
            <h2 id="settings-profile" className="font-display text-lg font-semibold">{t("Profile")}</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{t("Your name, base currency and display preferences.")}</p>
          </div>
        </div>
        <form onSubmit={saveProfile} className="space-y-5 sm:pl-8">
          <div className="space-y-2">
            <Label htmlFor="settings-display-name">{t("Display name")}</Label>
            <Input
              id="settings-display-name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              maxLength={120}
              placeholder="Adam"
            />
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="settings-base-currency">{t("Base currency")}</Label>
              <Select
                value={selectedCurrencyAvailable ? baseCurrency : ""}
                onValueChange={setBaseCurrency}
                disabled={availableCurrencies.length === 0}
              >
                <SelectTrigger id="settings-base-currency">
                  <SelectValue
                    placeholder={t(
                      availableCurrencies.length === 0
                        ? "No fiat currencies found"
                        : "Choose a currency",
                    )}
                  />
                </SelectTrigger>
                <SelectContent>
                  {availableCurrencies.map((currency) => (
                    <SelectItem key={currency} value={currency}>
                      {currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs leading-5 text-muted-foreground">
                {t("Only fiat currencies that already exist in your tracker are available.")}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-locale">{t("Language & format")}</Label>
              <Select value={locale} onValueChange={setLocale}>
                <SelectTrigger id="settings-locale">
                  <SelectValue>{locale === "it-IT" ? "Italiano" : "English"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="it-IT">{t("Italiano")}</SelectItem>
                  <SelectItem value="en-US">{t("English")}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs leading-5 text-muted-foreground">
                {t("Changes interface language, dates and numbers.")}
              </p>
            </div>
          </div>
          <Button
            type="submit"
            disabled={saving || !selectedCurrencyAvailable || !["it-IT", "en-US"].includes(locale)}
            className="min-h-11 w-full bg-cyan text-background hover:bg-cyan/90 sm:w-auto"
          >
            <Save className="mr-2 h-4 w-4" aria-hidden="true" />
            {saving ? t("Saving…") : t("Save profile")}
          </Button>
        </form>
      </section>

      <section className="border-b border-border/60 py-7 sm:py-9" aria-labelledby="settings-data">
        <div className="mb-6 flex items-start gap-3">
          <Database className="mt-0.5 h-5 w-5 shrink-0 text-cyan" aria-hidden="true" />
          <div>
            <h2 id="settings-data" className="font-display text-lg font-semibold">{t("Your data")}</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{t("Bring data in, take a full copy out, or restore an earlier copy.")}</p>
          </div>
        </div>
        <div className="sm:pl-8">
          <div className="border-b border-border/50 pb-6">
            <h3 className="text-sm font-medium">{t("Import data")}</h3>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{t("Bring transactions in from a CSV file when you need it.")}</p>
            <Button asChild className="mt-4 min-h-11 w-full bg-cyan text-background hover:bg-cyan/90 sm:w-auto">
            <Link to="/import">
              <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
              {t("Open import")}
            </Link>
            </Button>
          </div>

          <div className="divide-y divide-border/50 pt-1">
          <SettingRow
          title="Export backup"
          description="Download a complete copy of everything you have recorded."
        >
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={exporting}
            onClick={() => void exportBackup()}
          >
            <Download className="mr-2 h-4 w-4" aria-hidden="true" />
            {exporting ? t("Exporting…") : t("Export backup")}
          </Button>
        </SettingRow>

          <SettingRow
          title="Restore backup"
          description="The file is checked first. If anything is invalid, your current data stays unchanged."
        >
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => restoreInputRef.current?.click()}
          >
            <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
            {t("Choose backup")}
          </Button>
          <input
            ref={restoreInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => void chooseRestore(event)}
          />
          </SettingRow>
          </div>
        </div>
      </section>

      <section className="border-b border-border/60 py-7 sm:py-9" aria-labelledby="settings-account">
        <div className="mb-6 flex items-start gap-3">
          <LogOut className="mt-0.5 h-5 w-5 shrink-0 text-cyan" aria-hidden="true" />
          <div>
            <h2 id="settings-account" className="font-display text-lg font-semibold">{t("Account")}</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{t("End your session on this device.")}</p>
          </div>
        </div>
        <div className="sm:pl-8">
          <SettingRow title="Sign out" description="You can sign back in at any time.">
          <Button variant="outline" className="min-h-11" onClick={() => void handleSignOut()}>
            <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
            {t("Sign out")}
          </Button>
          </SettingRow>
        </div>
      </section>

      <section className="py-7 sm:py-9" aria-labelledby="settings-reset">
        <div className="mb-6 flex items-start gap-3">
          <Trash2 className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
          <div>
            <h2 id="settings-reset" className="font-display text-lg font-semibold">{t("Reset workspace")}</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{t("Permanently removes accounts, transactions, assets, prices, goals, trading reviews and import history. Your account and sign-in stay intact.")}</p>
          </div>
        </div>
        <div className="space-y-4 sm:pl-8">
          <div className="space-y-2">
            <Label htmlFor="reset-confirmation">
              {t("Type")} <span className="font-mono text-foreground">RESET WORKSPACE</span>
            </Label>
            <Input
              id="reset-confirmation"
              value={resetConfirmation}
              onChange={(event) => setResetConfirmation(event.target.value)}
              autoComplete="off"
              className="max-w-sm"
            />
          </div>
          <Button
            type="button"
            variant="destructive"
            className="min-h-11 w-full sm:w-auto"
            disabled={resetConfirmation !== "RESET WORKSPACE"}
            onClick={() => setResetDialogOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
            {t("Review reset")}
          </Button>
        </div>
      </section>

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
            <AlertDialogTitle>{t("Restore this backup?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {`${restoreFilename ?? t("Selected backup")} ${t("will replace your current financial data. The file is checked first; if anything is invalid, your current data stays unchanged.")}`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoring}>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={restoring}
              onClick={(event) => {
                event.preventDefault();
                void restoreBackup();
              }}
            >
              <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
              {restoring ? t("Restoring…") : t("Restore backup")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Reset your workspace?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "This destructive action cannot be undone without a valid backup. Your profile remains, but every account, transaction, asset and goal will be permanently removed.",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetting}>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={resetting || resetConfirmation !== "RESET WORKSPACE"}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void resetWorkspace();
              }}
            >
              {resetting ? t("Resetting…") : t("Reset workspace")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
