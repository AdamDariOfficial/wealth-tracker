import { useState } from "react";
import { ChevronDown, BookOpen, Copy, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Section = { title: string; examples: { label: string; code: string }[] };

const SECTIONS: Section[] = [
  {
    title: "Treasury",
    examples: [
      { label: "Deposit", code: "+240 Cash Wallet, salary" },
      { label: "Expense", code: "-50 Isy Bank, groceries" },
      { label: "Payroll", code: "+1500 Bank Account, salary" },
    ],
  },
  {
    title: "Transfers",
    examples: [
      { label: "Cash → Bank", code: "250 Cash Wallet -> Isy Bank" },
      { label: "Bank → Broker", code: "500 Isy Bank -> Trading Account" },
      { label: "Exchange → Cold", code: "1000 Broker -> Cold Wallet" },
    ],
  },
  {
    title: "Buy assets",
    examples: [
      { label: "With price (@)", code: "BUY 2 BTC @ 42000 from Isy Bank" },
      { label: "With price (at)", code: "BUY 10 VWCE at 128.45 from Broker" },
      { label: "Keyword form", code: "BUY BTC qty 0.5 price 65000 from Isy Bank" },
      { label: "Capital-only", code: "BUY 1000 BTC from Isy Bank" },
    ],
  },
  {
    title: "Sell assets",
    examples: [
      { label: "With price", code: "SELL 0.5 BTC @ 65000 to Isy Bank" },
      { label: "Partial", code: "SELL 3 VWCE @ 140.50 to Cash Wallet" },
    ],
  },
  {
    title: "Goals",
    examples: [
      { label: "Create", code: "GOAL Emergency Fund target 10000" },
      { label: "Contribute", code: "500 -> GOAL Emergency Fund" },
    ],
  },
  {
    title: "Opening balances / positions",
    examples: [
      { label: "Account balance", code: "ACCOUNT Cash Wallet balance 1375" },
      { label: "Asset position", code: "ASSET BTC qty 0.125 avg 42000" },
    ],
  },
  {
    title: "Natural language",
    examples: [
      { label: "Bought", code: "Bought 2 BTC at 42000 from Isy Bank" },
      { label: "Invested", code: "Invested 500 into VWCE" },
      { label: "Transferred", code: "Transferred 100 from Cash Wallet to Isy Bank" },
      { label: "Added to goal", code: "Added 300 to Emergency Fund" },
    ],
  },
  {
    title: "Dates",
    examples: [
      { label: "ISO", code: "2026-05-11" },
      { label: "EU", code: "11/05/26 00:00" },
      { label: "Named", code: "11 May 2026" },
    ],
  },
];

export function SyntaxGuide({ onInsert }: { onInsert?: (code: string) => void }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied((c) => (c === code ? null : c)), 1200);
    } catch {
      /* no-op */
    }
  }

  return (
    <Card className="glass p-0 overflow-hidden">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full px-4 py-3 flex items-center justify-between text-sm font-semibold hover:bg-muted/20 transition-colors">
            <span className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-cyan" />
              Syntax guide
              <span className="text-[11px] font-normal text-muted-foreground ml-1">
                — every supported operation, with copy-paste examples
              </span>
            </span>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform",
                open && "rotate-180",
              )}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-border/40 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border/30">
            {SECTIONS.map((sec) => (
              <div key={sec.title} className="p-3 space-y-2">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {sec.title}
                </div>
                <div className="space-y-1.5">
                  {sec.examples.map((ex) => (
                    <div key={ex.code} className="group flex items-center gap-1.5">
                      <code
                        className="flex-1 text-[11px] font-mono px-2 py-1.5 rounded bg-card/60 border border-border/40 truncate"
                        title={ex.code}
                      >
                        {ex.code}
                      </code>
                      {onInsert && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-[10px] opacity-0 group-hover:opacity-100 transition"
                          onClick={() => onInsert(ex.code)}
                        >
                          insert
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2"
                        onClick={() => copy(ex.code)}
                        title="Copy"
                      >
                        {copied === ex.code ? (
                          <Check className="h-3 w-3 text-success" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
