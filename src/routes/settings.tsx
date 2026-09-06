import { useEffect, useMemo, useRef, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
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

type SettingsSectionProps = Readonly<{
  id: string;
  icon: typeof UserRound;
  title: string;
  description: string;
  children: React.ReactNode;
  destructive?: boolean;
}>;

function SettingsSection({
  id,
  icon: Icon,
  title,
  description,
  children,
  destructive = false,
}: SettingsSectionProps) {
  const { t } = useI18n();
  return (
    <section id={id} className="scroll-mt-28 py-7 first:pt-0 sm:py-9">
      <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10">
        <header>
          <div
            className={
              destructive
                ? "flex items-center gap-2 text-destructive"
                : "flex items-center gap-2 text-foreground"
            }
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            <h2 className="font-display text-base font-semibold">{t(title)}</h2>
          </div>
          <p className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">{t(description)}</p>
        </header>
        <div className="min-w-0">{children}</div>
      </div>
    </section>
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
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Settings"
        subtitle="Your profile, backups and data controls."
        action={
          <Button variant="outline" onClick={() => void handleSignOut()} className="min-h-11">
            <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
            {t("Sign out")}
          </Button>
        }
      />




      <div className="divide-y divide-border/60 border-b border-border/60">
        <SettingsSection
          id="profile"
          icon={UserRound}
          title="Profile"
          description="Your name, base currency and display preferences."
        >
          <form onSubmit={saveProfile} className="max-w-3xl space-y-5">
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
                  <SelectTrigger id="settings-base-currency" className="min-h-11">
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
                  <SelectTrigger id="settings-locale" className="min-h-11">
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
              disabled={
                saving || !selectedCurrencyAvailable || !["it-IT", "en-US"].includes(locale)
              }
              className="min-h-11 bg-cyan text-background hover:bg-cyan/90"
            >
              <Save className="mr-2 h-4 w-4" aria-hidden="true" />
              {saving ? t("Saving…") : t("Save profile")}
            </Button>
          </form>
        </SettingsSection>

        <SettingsSection
          id="data"
          icon={Database}
          title="Data & portability"
          description="Import, export and restore your financial data from one place."
        >
          <div className="max-w-3xl divide-y divide-border/50">
            <div className="flex flex-col gap-4 pb-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h3 className="font-medium">{t("Import data")}</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {t("Bring transactions in from a CSV file when you need it.")}
                </p>
              </div>
              <Button asChild variant="outline" className="min-h-11 shrink-0">
                <Link to="/import">
                  {t("Open import")}
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
            </div>

            <div className="space-y-4 py-6">
              <div>
                <h3 className="font-medium">{t("Backup and restore")}</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {t(
                    "Download a complete copy of your data, or restore it in full from an earlier backup.",
                  )}
                </p>
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
                  {exporting ? t("Exporting…") : t("Export backup")}
                </Button>
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
              </div>
              <p className="text-xs leading-5 text-muted-foreground">
                {t(
                  "The backup is checked before anything is replaced. If the file is not valid, your current data stays unchanged.",
                )}
              </p>
            </div>
          </div>
        </SettingsSection>

        <SettingsSection
          id="danger"
          icon={Trash2}
          title="Reset workspace"
          description="Permanently removes your financial data. Your account and sign-in stay intact."
          destructive
        >
          <div className="max-w-3xl space-y-4">
            <p className="text-sm leading-6 text-muted-foreground">
              {t(
                "This removes accounts, transactions, assets, market data, goals, trading reviews and import history. Export a backup first if you may need the data later.",
              )}
            </p>
            <div className="max-w-md space-y-2">
              <Label htmlFor="reset-confirmation">
                {t("Type")} <span className="font-mono text-foreground">RESET WORKSPACE</span>
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
              {t("Review reset")}
            </Button>
          </div>
        </SettingsSection>
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
