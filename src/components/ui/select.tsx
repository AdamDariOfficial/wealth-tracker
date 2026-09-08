"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/use-i18n";

type NativeOption = Readonly<{
  value: string;
  label: string;
  disabled: boolean;
}>;

type SelectContextValue = Readonly<{
  value: string;
  disabled: boolean;
  options: readonly NativeOption[];
  setValue: (value: string) => void;
}>;

const SelectContext = React.createContext<SelectContextValue | null>(null);

function useSelectContext(): SelectContextValue {
  const context = React.useContext(SelectContext);
  if (!context) throw new Error("Select components must be rendered inside <Select>.");
  return context;
}

function nodeText(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).filter(Boolean).join(" ");
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return nodeText(node.props.children);
  }
  return "";
}

type SelectItemProps = Omit<React.OptionHTMLAttributes<HTMLOptionElement>, "value"> & {
  value: string;
};

function collectOptions(
  children: React.ReactNode,
  translate: (text: string) => string,
): NativeOption[] {
  const options: NativeOption[] = [];

  const visit = (nodes: React.ReactNode) => {
    React.Children.forEach(nodes, (child) => {
      if (!React.isValidElement(child)) return;
      if (child.type === SelectItem) {
        const props = child.props as SelectItemProps;
        const rawLabel = nodeText(props.children).replace(/\s+/g, " ").trim();
        options.push({
          value: props.value,
          label: rawLabel ? translate(rawLabel) : props.value,
          disabled: Boolean(props.disabled),
        });
        return;
      }
      const nested = (child.props as { children?: React.ReactNode }).children;
      if (nested) visit(nested);
    });
  };

  visit(children);
  return options;
}

type SelectProps = Readonly<{
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
}>;

function Select({
  value,
  defaultValue = "",
  onValueChange,
  disabled = false,
  children,
}: SelectProps) {
  const { t } = useI18n();
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  const controlled = value !== undefined;
  const currentValue = controlled ? value : internalValue;
  const options = React.useMemo(() => collectOptions(children, t), [children, t]);

  const setValue = React.useCallback(
    (next: string) => {
      if (!controlled) setInternalValue(next);
      onValueChange?.(next);
    },
    [controlled, onValueChange],
  );

  return (
    <SelectContext.Provider value={{ value: currentValue, disabled, options, setValue }}>
      {children}
    </SelectContext.Provider>
  );
}

function SelectGroup({ children }: { children?: React.ReactNode }) {
  return <>{children}</>;
}

type SelectValueProps = Readonly<{
  placeholder?: string;
  children?: React.ReactNode;
}>;

function SelectValue(_: SelectValueProps) {
  return null;
}

function findPlaceholder(children: React.ReactNode): string | undefined {
  let placeholder: string | undefined;
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child) || child.type !== SelectValue) return;
    const props = child.props as SelectValueProps;
    placeholder = props.placeholder;
  });
  return placeholder;
}

type SelectTriggerProps = Omit<
  React.SelectHTMLAttributes<HTMLSelectElement>,
  "value" | "defaultValue" | "onChange" | "disabled"
> & {
  children?: React.ReactNode;
};

const SelectTrigger = React.forwardRef<HTMLSelectElement, SelectTriggerProps>(
  ({ className, children, id, ...props }, ref) => {
    const { value, disabled, options, setValue } = useSelectContext();
    const { t } = useI18n();
    const placeholder = findPlaceholder(children);

    return (
      <div className={cn("relative w-full", className)}>
        <select
          ref={ref}
          id={id}
          value={value}
          disabled={disabled}
          onChange={(event) => setValue(event.target.value)}
          className={cn(
            "h-11 w-full appearance-none rounded-lg border border-input bg-background pl-3 pr-9 text-base text-foreground shadow-sm ring-offset-background outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:h-9 md:text-sm [color-scheme:dark]",
            !value && "text-muted-foreground",
          )}
          {...props}
        >
          {placeholder ? (
            <option value="" disabled>
              {t(placeholder)}
            </option>
          ) : null}
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute inset-y-0 right-3 my-auto h-4 w-4 text-muted-foreground"
          aria-hidden="true"
        />

      </div>
    );
  },
);
SelectTrigger.displayName = "SelectTrigger";

function SelectContent(_: React.HTMLAttributes<HTMLDivElement>) {
  return null;
}

function SelectLabel({ children }: React.HTMLAttributes<HTMLDivElement>) {
  return <>{children}</>;
}

function SelectItem(_: SelectItemProps) {
  return null;
}

function SelectSeparator(_: React.HTMLAttributes<HTMLDivElement>) {
  return null;
}

function SelectScrollUpButton(_: React.HTMLAttributes<HTMLDivElement>) {
  return null;
}

function SelectScrollDownButton(_: React.HTMLAttributes<HTMLDivElement>) {
  return null;
}

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
};
