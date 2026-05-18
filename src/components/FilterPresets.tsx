import { useState } from "react";
import { Bookmark, BookmarkPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { FilterPreset } from "@/hooks/use-filter-presets";

export function FilterPresets<T>({
  presets,
  onApply,
  onSave,
  onDelete,
}: {
  presets: FilterPreset<T>[];
  onApply: (values: T) => void;
  onSave: (name: string) => void;
  onDelete: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="text-xs">
          <Bookmark className="h-3 w-3 mr-1" />
          Presets{presets.length ? ` (${presets.length})` : ""}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3 space-y-3">
        <div className="flex gap-2">
          <Input
            placeholder="Preset name…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-8 text-xs"
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim()) {
                onSave(name);
                setName("");
              }
            }}
          />
          <Button
            size="sm"
            className="h-8"
            disabled={!name.trim()}
            onClick={() => {
              onSave(name);
              setName("");
            }}
          >
            <BookmarkPlus className="h-3 w-3" />
          </Button>
        </div>
        <div className="space-y-1 max-h-60 overflow-y-auto">
          {presets.length === 0 && (
            <div className="text-[11px] text-muted-foreground text-center py-3">
              No saved presets yet.
            </div>
          )}
          {presets.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-white/[0.04]"
            >
              <button
                className="text-xs text-left flex-1 truncate hover:text-cyan"
                onClick={() => {
                  onApply(p.values);
                  setOpen(false);
                }}
              >
                {p.name}
              </button>
              <button
                onClick={() => onDelete(p.id)}
                className="text-muted-foreground hover:text-destructive"
                aria-label="Delete preset"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
