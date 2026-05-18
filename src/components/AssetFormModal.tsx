import { useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAssets, type Asset } from "@/hooks/use-ledger";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type AssetClass = Asset["asset_class"];
const CLASSES: AssetClass[] = ["fiat","crypto","stablecoin","etf","stock","commodity","forex","custom"];

export function AssetFormModal({
  open, onClose, edit, presetClass, presetSymbol, onCreated,
}: {
  open: boolean;
  onClose: () => void;
  edit?: Asset | null;
  presetClass?: AssetClass;
  presetSymbol?: string;
  onCreated?: (id: string) => void;
}) {
  const { update, refresh } = useAssets();
  const [form, setForm] = useState({
    symbol: "", name: "", asset_class: (presetClass ?? "crypto") as AssetClass,
    current_price: 0, color: "#22d3ee",
  });

  useEffect(() => {
    if (open) {
      if (edit) setForm({
        symbol: edit.symbol, name: edit.name, asset_class: edit.asset_class,
        current_price: Number(edit.current_price), color: edit.color ?? "#22d3ee",
      });
      else setForm({
        symbol: (presetSymbol ?? "").toUpperCase(), name: "", asset_class: presetClass ?? "crypto",
        current_price: 0, color: "#22d3ee",
      });
    }
  }, [open, edit, presetClass, presetSymbol]);

  const submit = async () => {
    const sym = form.symbol.trim().toUpperCase();
    if (!sym) return toast.error("Symbol required");
    if (!form.name.trim()) return toast.error("Name required");
    try {
      if (edit) {
        await update(edit.id, { ...form, symbol: sym });
        toast.success("Asset updated");
      } else {
        const { data: u } = await supabase.auth.getUser();
        const { data, error } = await (supabase as any).from("assets").insert({
          ...form, symbol: sym, user_id: u.user!.id, custom_asset: true,
        }).select("id").single();
        if (error) throw error;
        await refresh();
        toast.success("Asset created");
        onCreated?.(data.id);
      }
      onClose();
    } catch (e: any) { toast.error(e.message ?? "Failed"); }
  };

  return (
    <Modal open={open} onClose={onClose} title={edit ? "Edit asset" : "New asset"}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button>
      <Button className="bg-cyan text-background hover:bg-cyan/90" onClick={submit}>{edit ? "Save" : "Create"}</Button></>}>
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs">Symbol</Label><Input value={form.symbol} onChange={(e)=>setForm({...form,symbol:e.target.value})} className="mt-1 font-mono" placeholder="BTC, AAPL…" /></div>
        <div>
          <Label className="text-xs">Class</Label>
          <Select value={form.asset_class} onValueChange={(v)=>setForm({...form,asset_class:v as AssetClass})}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>{CLASSES.map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div><Label className="text-xs">Name</Label><Input value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} className="mt-1" placeholder="Bitcoin, Apple Inc." /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs">Current price</Label><Input type="number" step="any" value={form.current_price || ""} onChange={(e)=>setForm({...form,current_price:+e.target.value})} className="mt-1" /></div>
        <div><Label className="text-xs">Color</Label><Input type="color" value={form.color} onChange={(e)=>setForm({...form,color:e.target.value})} className="mt-1 h-10 p-1" /></div>
      </div>
    </Modal>
  );
}
