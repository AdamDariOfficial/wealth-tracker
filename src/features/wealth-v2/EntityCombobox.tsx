import { useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/use-i18n";

export type EntityComboboxOption = Readonly<{
  value: string;
  label: string;
  keywords?: string;
}>;

export function EntityCombobox({
  value,
  onValueChange,
  options,
  placeholder,
  searchPlaceholder,
  emptyText,
  createLabel,
  onCreate,
  disabled = false,
  className,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly EntityComboboxOption[];
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  createLabel?: string;
  onCreate?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [commandValue, setCommandValue] = useState("");
  const selected = options.find((option) => option.value === value);

  const startCreate = () => {
    if (!onCreate) return;
    setOpen(false);
    setCommandValue("");
    onCreate();
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setCommandValue("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={t(placeholder)}
          disabled={disabled}
          className={cn("min-h-11 w-full justify-between font-normal", className)}
        >
          <span className={cn("min-w-0 truncate", !selected && "text-muted-foreground")}>
            {selected?.label ?? t(placeholder)}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[min(420px,calc(100vw-2rem))] p-0"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <Command value={commandValue} onValueChange={setCommandValue}>
          <CommandInput
            placeholder={t(searchPlaceholder)}
            trailing={
              onCreate && createLabel ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 text-cyan hover:bg-cyan/10 hover:text-cyan"
                  aria-label={t(createLabel)}
                  title={t(createLabel)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={startCreate}
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                </Button>
              ) : null
            }
          />
          <CommandList>
            <CommandEmpty>{t(emptyText)}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={`${option.label} ${option.keywords ?? ""}`}
                  onPointerLeave={() => setCommandValue("")}
                  onSelect={() => {
                    onValueChange(option.value);
                    setOpen(false);
                    setCommandValue("");
                  }}
                  className="min-h-11"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option.value ? "opacity-100" : "opacity-0",
                    )}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 truncate">{option.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
