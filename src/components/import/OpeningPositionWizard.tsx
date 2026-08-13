import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Wallet, Coins, Target } from "lucide-react";

export type WizardTab = "account" | "asset" | "goal";

/**
 * Opening Position Wizard.
 * Generates valid import syntax → inserts into the textarea.
 * NEVER bypasses the import engine; single ingestion path preserved.
 */
export function OpeningPositionWizard({
  open,
  onClose,
  defaultTab = "account",
  onInsert,
}: {
  open: boolean;
  onClose: () => void;
  defaultTab?: WizardTab;
  onInsert: (snippet: string) => void;
}) {
  const [tab, setTab] = useState<WizardTab>(defaultTab);

  // Account form
  const [acctName, setAcctName] = useState("");
  const [acctBalance, setAcctBalance] = useState("");

  // Asset form
  const [assetSymbol, setAssetSymbol] = useState("");
  const [assetQty, setAssetQty] = useState("");
  const [assetAvg, setAssetAvg] = useState("");

  // Goal form
  const [goalName, setGoalName] = useState("");
  const [goalTarget, setGoalTarget] = useState("");

  function reset() {
    setAcctName("");
    setAcctBalance("");
    setAssetSymbol("");
    setAssetQty("");
    setAssetAvg("");
    setGoalName("");
    setGoalTarget("");
  }

  function buildSnippet(): string | null {
    if (tab === "account") {
      if (!acctName.trim() || !acctBalance.trim()) return null;
      return `ACCOUNT ${acctName.trim()} balance ${acctBalance.trim()}`;
    }
    if (tab === "asset") {
      if (!assetSymbol.trim() || !assetQty.trim()) return null;
      let s = `ASSET ${assetSymbol.trim().toUpperCase()} qty ${assetQty.trim()}`;
      if (assetAvg.trim()) s += ` avg ${assetAvg.trim()}`;
      return s;
    }
    if (tab === "goal") {
      if (!goalName.trim() || !goalTarget.trim()) return null;
      return `GOAL ${goalName.trim()} target ${goalTarget.trim()}`;
    }
    return null;
  }

  const snippet = buildSnippet();

  function handleInsert() {
    if (!snippet) return;
    onInsert(snippet);
    reset();
    onClose();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Opening position wizard</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as WizardTab)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="account">
              <Wallet className="h-3.5 w-3.5 mr-1.5" />
              Account
            </TabsTrigger>
            <TabsTrigger value="asset">
              <Coins className="h-3.5 w-3.5 mr-1.5" />
              Asset
            </TabsTrigger>
            <TabsTrigger value="goal">
              <Target className="h-3.5 w-3.5 mr-1.5" />
              Goal
            </TabsTrigger>
          </TabsList>

          <TabsContent value="account" className="space-y-3 mt-4">
            <Field label="Account name">
              <Input
                value={acctName}
                onChange={(e) => setAcctName(e.target.value)}
                placeholder="Isy Bank"
              />
            </Field>
            <Field label="Opening balance">
              <Input
                type="number"
                inputMode="decimal"
                value={acctBalance}
                onChange={(e) => setAcctBalance(e.target.value)}
                placeholder="1500"
              />
            </Field>
            <Hint>Creates a manual_adjustment to set the account to this balance.</Hint>
          </TabsContent>

          <TabsContent value="asset" className="space-y-3 mt-4">
            <Field label="Symbol / ticker">
              <Input
                value={assetSymbol}
                onChange={(e) => setAssetSymbol(e.target.value)}
                placeholder="BTC"
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Quantity">
                <Input
                  type="number"
                  inputMode="decimal"
                  value={assetQty}
                  onChange={(e) => setAssetQty(e.target.value)}
                  placeholder="0.25"
                />
              </Field>
              <Field label="Avg cost (optional)">
                <Input
                  type="number"
                  inputMode="decimal"
                  value={assetAvg}
                  onChange={(e) => setAssetAvg(e.target.value)}
                  placeholder="50000"
                />
              </Field>
            </div>
            <Hint>Recorded as an opening BUY at the given avg cost basis.</Hint>
          </TabsContent>

          <TabsContent value="goal" className="space-y-3 mt-4">
            <Field label="Goal name">
              <Input
                value={goalName}
                onChange={(e) => setGoalName(e.target.value)}
                placeholder="Emergency Fund"
              />
            </Field>
            <Field label="Target amount">
              <Input
                type="number"
                inputMode="decimal"
                value={goalTarget}
                onChange={(e) => setGoalTarget(e.target.value)}
                placeholder="10000"
              />
            </Field>
            <Hint>Creates a custom goal. Add a contribution row separately to fund it.</Hint>
          </TabsContent>
        </Tabs>

        {snippet && (
          <div className="rounded-md bg-muted/40 border border-border/40 p-2 mt-3">
            <div className="label-muted mb-1">Generated syntax</div>
            <pre className="font-mono text-xs whitespace-pre-wrap break-all">{snippet}</pre>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleInsert} disabled={!snippet}>
            Insert into import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="label-muted">{label}</label>
      {children}
    </div>
  );
}
function Hint({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] text-muted-foreground">{children}</div>;
}
