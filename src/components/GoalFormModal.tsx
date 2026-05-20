import { useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AccountPicker } from "@/components/AccountPicker";
import { AssetPicker } from "@/components/AssetPicker";
import { useUserTable } from "@/hooks/use-user-table";
import { toast } from "sonner";

export type GoalKind = "net_worth" | "liquid" | "account_balance" | "asset_quantity" | "asset_value" | "custom";
export type Goal = {
  id: string; name: string; category: string | null; target_amount: number;
  current_amount: number; target_date: string | null;
  kind: GoalKind; target_account_id?: string | null;
  target_asset_id?: string | null; target_quantity?: number | null;
};

const EMPTY = {
  name: "", category: "general", kind: "net_worth" as GoalKind,
  target_amount: 0, target_quantity: 0,
  target_account_id: "", target_asset_id: "", target_date: "",
};

export function GoalFormModal({
  open, onClose, edit,
}: { open: boolean; onClose: () => void; edit?: Goal | null }) {
  const { insert, update } = useUserTable<Goal>("goals");
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    if (!open) return;
    if (edit) {
      setForm({
        name: edit.name,
        category: edit.category ?? "general",
        kind: edit.kind,
        target_amount: Number(edit.target_amount ?? 0),
        target_quantity: Number(edit.target_quantity ?? 0),
        target_account_id: edit.target_account_id ?? "",
        target_asset_id: edit.target_asset_id ?? "",
        target_date: edit.target_date ?? "",
      });
    } else {
      setForm(EMPTY);
    }
  }, [open, edit]);

  const submit = async () => {
    if (!form.name.trim()) return toast.error("Name required");
    try {
      const payload = {
        name: form.name,
        category: form.category,
        kind: form.kind,
        target_amount: form.target_amount,
        target_quantity: form.target_quantity || null,
        target_account_id: form.target_account_id || null,
        target_asset_id: form.target_asset_id || null,
        target_date: form.target_date || null,
      };
      if (edit) {
        await update(edit.id, payload);
        toast.success("Goal updated");
      } else {
        await insert({ ...payload, current_amount: 0 });
        toast.success("Goal created");
      }
      onClose();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <Modal open={open} onClose={onClose} title={edit ? "Edit goal" : "New goal"}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button>
      <Button className="bg-cyan text-background hover:bg-cyan/90" onClick={submit}>{edit ? "Save" : "Create"}</Button></>}>
      <div><Label className="text-xs">Name</Label><Input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} className="mt-1" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Goal type</Label>
          <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v as GoalKind })}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="net_worth">Net worth target</SelectItem>
              <SelectItem value="liquid">Liquid cash reserve</SelectItem>
              <SelectItem value="account_balance">Specific account balance</SelectItem>
              <SelectItem value="asset_quantity">Asset quantity (e.g. 1 BTC)</SelectItem>
              <SelectItem value="asset_value">Asset market value ($)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">Target date</Label><Input type="date" value={form.target_date} onChange={(e) => setForm({...form, target_date: e.target.value})} className="mt-1" /></div>
      </div>
      {form.kind === "account_balance" && (
        <AccountPicker value={form.target_account_id} onChange={(v) => setForm({...form, target_account_id: v})} label="Account" />
      )}
      {(form.kind === "asset_quantity" || form.kind === "asset_value") && (
        <AssetPicker value={form.target_asset_id} onChange={(v) => setForm({...form, target_asset_id: v})} assetClass="crypto" />
      )}
      {form.kind === "asset_quantity" ? (
        <div><Label className="text-xs">Target quantity</Label><Input type="number" step="any" value={form.target_quantity || ""} onChange={(e) => setForm({...form, target_quantity: +e.target.value})} className="mt-1" /></div>
      ) : (
        <div><Label className="text-xs">Target amount ($)</Label><Input type="number" value={form.target_amount || ""} onChange={(e) => setForm({...form, target_amount: +e.target.value})} className="mt-1" /></div>
      )}
    </Modal>
  );
}
