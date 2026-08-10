import { ArrowLeftRight, Landmark, LineChart, PackagePlus, type LucideIcon } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
  { value: "transaction", label: "Transaction", icon: ArrowLeftRight },
  { value: "account", label: "Account", icon: Landmark },
  { value: "asset", label: "Asset", icon: PackagePlus },
  { value: "market-data", label: "Market data", icon: LineChart },
];

export function CoreComposer() {
  const open = useCoreUI((state) => state.composerOpen);
  const tab = useCoreUI((state) => state.composerTab);
  const openComposer = useCoreUI((state) => state.openComposer);
  const closeComposer = useCoreUI((state) => state.closeComposer);

  return (
    <Sheet open={open} onOpenChange={(next) => (next ? openComposer(tab) : closeComposer())}>
      <SheetContent
        side="bottom"
        className="h-[min(92dvh,900px)] overflow-y-auto rounded-t-3xl p-0 sm:bottom-4 sm:left-auto sm:right-4 sm:h-[min(88dvh,820px)] sm:w-[min(620px,calc(100vw-2rem))] sm:rounded-3xl sm:border"
      >
        <div className="sticky top-0 z-10 border-b border-border/60 bg-background/95 px-4 pb-4 pt-3 backdrop-blur-xl sm:px-6">
          <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-foreground/20 sm:hidden" />
          <SheetHeader className="text-left">
            <SheetTitle>Core composer</SheetTitle>
            <SheetDescription>
              Create canonical v2 records through validated application commands.
            </SheetDescription>
          </SheetHeader>
        </div>
        <div className="px-4 py-5 sm:px-6">
          <Tabs
            value={tab}
            onValueChange={(value) => openComposer(value as CoreComposerTab)}
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
            <TabsContent value="transaction">
              <TransactionForm onSaved={closeComposer} />
            </TabsContent>
            <TabsContent value="account">
              <AccountForm onSaved={closeComposer} />
            </TabsContent>
            <TabsContent value="asset">
              <AssetForm onSaved={closeComposer} />
            </TabsContent>
            <TabsContent value="market-data">
              <MarketDataForm onSaved={closeComposer} />
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
