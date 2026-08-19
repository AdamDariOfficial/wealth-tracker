import { ArrowLeftRight, Landmark, LineChart, PackagePlus, type LucideIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCoreUI, type CoreComposerTab } from "@/lib/core-ui-store";
import { AccountForm } from "./forms/AccountForm";
import { AssetForm } from "./forms/AssetForm";
import { MarketDataForm } from "./forms/MarketDataForm";
import { TransactionForm } from "./forms/TransactionForm";

const tabs: readonly Readonly<{
  value: CoreComposerTab;
  label: string;
  icon: LucideIcon;
}>[] = [
  { value: "transaction", label: "Activity", icon: ArrowLeftRight },
  { value: "account", label: "Account", icon: Landmark },
  { value: "asset", label: "Asset", icon: PackagePlus },
  { value: "market-data", label: "Prices", icon: LineChart },
];

const dedicatedCopy: Record<CoreComposerTab, Readonly<{ title: string; description: string }>> = {
  transaction: {
    title: "Add activity",
    description: "Record income, an expense or a transfer between your accounts.",
  },
  account: {
    title: "Add account",
    description: "Add a bank, wallet, broker or other place where your money is held.",
  },
  asset: {
    title: "Add asset",
    description: "Add an asset to your registry without changing recorded history.",
  },
  "market-data": {
    title: "Add price",
    description: "Record a market observation used to value your holdings.",
  },
};

export function CoreComposer() {
  const open = useCoreUI((state) => state.composerOpen);
  const tab = useCoreUI((state) => state.composerTab);
  const mode = useCoreUI((state) => state.composerMode);
  const openComposer = useCoreUI((state) => state.openComposer);
  const closeComposer = useCoreUI((state) => state.closeComposer);

  const renderForm = (value: CoreComposerTab) => {
    if (value === "account") return <AccountForm onSaved={closeComposer} />;
    if (value === "asset") return <AssetForm onSaved={closeComposer} />;
    if (value === "market-data") return <MarketDataForm onSaved={closeComposer} />;
    return <TransactionForm onSaved={closeComposer} />;
  };

  const copy = dedicatedCopy[tab];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) closeComposer();
      }}
    >
      <DialogContent className="max-h-[min(90dvh,860px)] w-[min(720px,calc(100vw-2rem))] overflow-y-auto p-0 sm:max-w-2xl">
        <div className="sticky top-0 z-10 border-b border-border/60 bg-background/95 px-5 py-4 backdrop-blur-xl sm:px-6">
          <DialogHeader className="text-left">
            <DialogTitle>{mode === "general" ? "Add record" : copy.title}</DialogTitle>
            <DialogDescription>
              {mode === "general"
                ? "Choose what you want to add. Each workflow stays focused on one task."
                : copy.description}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-5 py-5 sm:px-6">
          {mode === "general" ? (
            <Tabs
              value={tab}
              onValueChange={(value) => openComposer(value as CoreComposerTab, "general")}
              className="space-y-5"
            >
              <TabsList className="grid h-auto grid-cols-4 gap-1 p-1">
                {tabs.map((item) => (
                  <TabsTrigger
                    key={item.value}
                    value={item.value}
                    className="min-h-11 flex-col gap-1 px-2 text-[11px] sm:flex-row sm:gap-2 sm:text-xs"
                  >
                    <item.icon className="h-4 w-4" />
                    <span className="max-w-full truncate">{item.label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
              {tabs.map((item) => (
                <TabsContent key={item.value} value={item.value}>
                  {renderForm(item.value)}
                </TabsContent>
              ))}
            </Tabs>
          ) : (
            renderForm(tab)
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
