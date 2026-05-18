import { useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAccounts, type Account } from "@/hooks/use-ledger";
import { toast } from "sonner";

type AccountType = Account["type"];
const TYPES: { value: AccountType; label: string }[] = [
  { value: "bank", label: "Bank" },
  { value: "cash", label: "Cash" },
  { value: "savings", label: "Savings" },
  { value: "broker", label: "Broker" },
  { value: "investment", label: "Investment" },
  { value: "exchange", label: "Exchange" },
  { value: "crypto_wallet", label: "Crypto Wallet" },
  { value: "cold_wallet", label: "Cold Wallet" },
  { value: "external", label: "External" },
];

export function AccountFormModal({
  open, onClose, edit, onCreated,
}: {
  open: boolean;
  onClose: () => void;
  edit?: Account | null;
  onCreated?: (id: string) => void;
}) {
  const { update, refresh } = useAccounts();
  const [form, setForm] = useState({
    name: "", type: "bank" as AccountType, provider: "", currency: "USD",
    description: "", color: "#22d3ee",
  });

  useEffect(() => {
    if (open) {
      if (edit) setForm({
        name: edit.name, type: edit.type, provider: edit.provider ?? "",
        currency: edit.currency, description: edit.description ?? "", color: edit.color ?? "#22d3ee",
      });
      else setForm({ name: "", type: "bank", provider: "", currency: "USD", description: "", color: "#22d3ee" });
    }
  }, [open, edit]);

  const submit = async () => {
    if (!form.name.trim()) return toast.error("Name required");
    try {
      if (edit) {
        await update(edit.id, form);
        toast.success("Account updated");
      } else {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data: u } = await supabase.auth.getUser();
        const { data, error } = await (supabase as any)
          .from("accounts").insert({ ...form, user_id: u.user!.id }).select("id").single();
        if (error) throw error;
        await refresh();
        toast.success("Account created");
        onCreated?.(data.id);
      }
      onClose();
    } catch (e: any) { toast.error(e.message ?? "Failed"); }
  };

  return (
    <Modal open={open} onClose={onClose} title={edit ? "Edit account" : "New account"}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button>
      <Button className="bg-cyan text-background hover:bg-cyan/90" onClick={submit}>{edit ? "Save" : "Create"}</Button></>}>
      <div><Label className="text-xs">Name</Label><Input value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} className="mt-1" placeholder="Revolut, Binance, IBKR…" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Type</Label>
          <Select value={form.type} onValueChange={(v)=>setForm({...form,type:v as AccountType})}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>{TYPES.map(t=><SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">Currency</Label><Input value={form.currency} onChange={(e)=>setForm({...form,currency:e.target.value.toUpperCase()})} className="mt-1" /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs">Provider</Label><Input value={form.provider} onChange={(e)=>setForm({...form,provider:e.target.value})} className="mt-1" /></div>
        <div><Label className="text-xs">Color</Label><Input type="color" value={form.color} onChange={(e)=>setForm({...form,color:e.target.value})} className="mt-1 h-10 p-1" /></div>
      </div>
      <div><Label className="text-xs">Description</Label><Input value={form.description} onChange={(e)=>setForm({...form,description:e.target.value})} className="mt-1" /></div>
    </Modal>
  );
}
