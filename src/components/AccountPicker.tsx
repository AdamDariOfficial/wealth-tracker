import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAccounts, type Account } from "@/hooks/use-ledger";
import { AccountFormModal } from "@/components/AccountFormModal";
import { Plus, Pencil } from "lucide-react";

export function AccountPicker({
  value, onChange, label = "Account", filter, allowCreate = true,
}: {
  value: string;
  onChange: (id: string) => void;
  label?: string;
  filter?: (a: Account) => boolean;
  allowCreate?: boolean;
}) {
  const { rows } = useAccounts();
  const list = filter ? rows.filter(filter) : rows;
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const selected = rows.find((a) => a.id === value);

  return (
    <div>
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        {allowCreate && (
          <div className="flex gap-1">
            {selected && (
              <button type="button" onClick={() => { setEditing(selected); setFormOpen(true); }} className="text-[10px] text-muted-foreground hover:text-cyan flex items-center gap-1">
                <Pencil className="h-2.5 w-2.5" /> edit
              </button>
            )}
            <button type="button" onClick={() => { setEditing(null); setFormOpen(true); }} className="text-[10px] text-cyan hover:underline flex items-center gap-1">
              <Plus className="h-2.5 w-2.5" /> new
            </button>
          </div>
        )}
      </div>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="mt-1"><SelectValue placeholder="Select account" /></SelectTrigger>
        <SelectContent>
          {list.map((a) => (
            <SelectItem key={a.id} value={a.id}>
              {a.name} <span className="text-muted-foreground ml-2 text-xs">{a.type}</span>
            </SelectItem>
          ))}
          {list.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">No matching accounts</div>}
        </SelectContent>
      </Select>
      <AccountFormModal open={formOpen} onClose={() => setFormOpen(false)} edit={editing} onCreated={(id) => onChange(id)} />
    </div>
  );
}
