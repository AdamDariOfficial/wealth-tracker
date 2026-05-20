import { useMemo, useState, KeyboardEvent } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { X, Plus } from "lucide-react";
import { useTransactions } from "@/hooks/use-ledger";

/**
 * Free-form tag input — tags live as a text[] on `transactions`, so the
 * "vocabulary" is derived from every tag the user has ever used. New tags
 * are created implicitly on save (just by being in the array), which matches
 * the inline-create-in-place pattern for entity pickers.
 */
export function TagPicker({
  value, onChange, label = "Tags",
}: {
  value: string[];
  onChange: (next: string[]) => void;
  label?: string;
}) {
  const { rows: txs } = useTransactions();
  const [draft, setDraft] = useState("");

  const vocab = useMemo(() => {
    const s = new Set<string>();
    for (const t of txs) for (const tag of t.tags ?? []) if (tag) s.add(tag);
    return Array.from(s).sort();
  }, [txs]);

  const suggestions = useMemo(() => {
    const d = draft.trim().toLowerCase();
    if (!d) return [];
    return vocab.filter((t) => t.toLowerCase().includes(d) && !value.includes(t)).slice(0, 5);
  }, [draft, vocab, value]);

  const add = (tag: string) => {
    const t = tag.trim().toLowerCase();
    if (!t || value.includes(t)) return;
    onChange([...value, t]);
    setDraft("");
  };
  const remove = (tag: string) => onChange(value.filter((t) => t !== tag));

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(draft); }
    if (e.key === "Backspace" && !draft && value.length) remove(value[value.length - 1]);
  };

  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="mt-1 flex flex-wrap items-center gap-1 glass rounded-lg px-2 py-1.5 min-h-[2.25rem]">
        {value.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded bg-cyan/10 text-cyan text-[11px] px-2 py-0.5">
            {t}
            <button type="button" onClick={() => remove(t)} className="hover:text-destructive">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          className="flex-1 min-w-[120px] bg-transparent outline-none text-xs"
          placeholder={value.length ? "" : "Add tag and press Enter"}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
        />
      </div>
      {suggestions.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="text-[10px] text-muted-foreground hover:text-cyan flex items-center gap-1"
            >
              <Plus className="h-2.5 w-2.5" /> {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
