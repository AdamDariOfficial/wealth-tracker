import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowLeft, Check, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-store";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/onboarding")({ component: OnboardingPage });

const steps = ["Financial", "Investing", "Trading", "Review"] as const;

type Form = {
  financial: { monthly_income: number; weekly_income: number; currency: string; risk_profile: string; investing_experience: string; trading_experience: string };
  investment: { asset_classes: string[]; brokers: string; goals: string; target_size: number; trading_style: string; preferred_markets: string };
  trading: { primary_asset: string; avg_risk_pct: number; sessions: string[]; setups: string; frequency: string };
};

const defaultForm: Form = {
  financial: { monthly_income: 0, weekly_income: 0, currency: "USD", risk_profile: "Moderate", investing_experience: "Beginner", trading_experience: "Beginner" },
  investment: { asset_classes: [], brokers: "", goals: "", target_size: 0, trading_style: "Swing", preferred_markets: "" },
  trading: { primary_asset: "", avg_risk_pct: 1, sessions: [], setups: "", frequency: "Daily" },
};

function Pills({ value, onChange, options, multi = false }: { value: string | string[]; onChange: (v: any) => void; options: string[]; multi?: boolean }) {
  const isActive = (o: string) => (multi ? (value as string[]).includes(o) : value === o);
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          type="button" key={o}
          onClick={() => {
            if (multi) {
              const arr = value as string[];
              onChange(arr.includes(o) ? arr.filter((x) => x !== o) : [...arr, o]);
            } else onChange(o);
          }}
          className={cn(
            "px-3 py-1.5 rounded-lg text-xs border transition-all",
            isActive(o) ? "bg-cyan text-background border-cyan" : "border-border/50 text-muted-foreground hover:border-cyan/40"
          )}
        >{o}</button>
      ))}
    </div>
  );
}

function OnboardingPage() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Form>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string>(profile?.avatar_url ?? "");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // autosave
  useEffect(() => {
    if (!user) return;
    const t = setTimeout(() => {
      supabase.from("onboarding_data").upsert({ user_id: user.id, financial: form.financial, investment: form.investment, trading: form.trading });
    }, 600);
    return () => clearTimeout(t);
  }, [form, user]);

  const onAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      setAvatarUrl(data.publicUrl);
      await supabase.from("profiles").update({ avatar_url: data.publicUrl }).eq("id", user.id);
      toast.success("Avatar uploaded");
    } catch (err: any) { toast.error(err.message ?? "Upload failed"); }
    finally { setUploading(false); }
  };


  const finish = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await supabase.from("onboarding_data").upsert({ user_id: user.id, financial: form.financial, investment: form.investment, trading: form.trading });
      await supabase.from("profiles").update({ onboarded: true, currency: form.financial.currency }).eq("id", user.id);
      await supabase.from("trading_account").update({
        default_risk_pct: form.trading.avg_risk_pct,
        primary_asset: form.trading.primary_asset,
      }).eq("user_id", user.id);
      await refreshProfile();
      toast.success("You're all set");
      navigate({ to: "/" });
    } catch (e: any) {
      toast.error(e.message ?? "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const pct = ((step + 1) / steps.length) * 100;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,oklch(0.82_0.15_210_/_0.1),transparent_60%)] pointer-events-none" />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-3xl p-8 w-full max-w-2xl relative">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-cyan to-cyan-glow flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-background" />
          </div>
          <span className="font-display font-semibold tracking-tight">Wealth Tracker</span>
          <span className="ml-auto text-xs font-mono text-muted-foreground">Step {step + 1} of {steps.length}</span>
        </div>
        <div className="h-1 mt-4 rounded-full bg-muted overflow-hidden">
          <motion.div className="h-full bg-gradient-to-r from-cyan to-cyan-glow" animate={{ width: `${pct}%` }} />
        </div>
        <div className="flex gap-2 mt-3">
          {steps.map((s, i) => (
            <div key={s} className={cn("text-[11px] uppercase tracking-wider", i <= step ? "text-cyan" : "text-muted-foreground")}>{s}</div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }} className="mt-8 space-y-5 min-h-[320px]">
            {step === 0 && (
              <>
                <h2 className="font-display text-2xl font-semibold">Your financial profile</h2>
                <p className="text-sm text-muted-foreground">Helps us calibrate dashboards & risk warnings.</p>
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-full glass-strong overflow-hidden flex items-center justify-center text-cyan font-display">
                    {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : "?"}
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" hidden onChange={onAvatar} />
                  <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
                    {uploading ? "Uploading…" : (avatarUrl ? "Change avatar" : "Upload avatar")}
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label className="text-xs">Monthly income</Label><Input type="number" value={form.financial.monthly_income || ""} onChange={(e) => setForm({ ...form, financial: { ...form.financial, monthly_income: +e.target.value } })} className="mt-1" /></div>
                  <div><Label className="text-xs">Weekly income</Label><Input type="number" value={form.financial.weekly_income || ""} onChange={(e) => setForm({ ...form, financial: { ...form.financial, weekly_income: +e.target.value } })} className="mt-1" /></div>
                </div>
                <div><Label className="text-xs">Currency</Label><Pills value={form.financial.currency} onChange={(v) => setForm({ ...form, financial: { ...form.financial, currency: v } })} options={["USD", "EUR", "GBP", "CHF"]} /></div>
                <div><Label className="text-xs">Risk profile</Label><Pills value={form.financial.risk_profile} onChange={(v) => setForm({ ...form, financial: { ...form.financial, risk_profile: v } })} options={["Conservative", "Moderate", "Aggressive"]} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label className="text-xs">Investing experience</Label><Pills value={form.financial.investing_experience} onChange={(v) => setForm({ ...form, financial: { ...form.financial, investing_experience: v } })} options={["Beginner", "Intermediate", "Advanced"]} /></div>
                  <div><Label className="text-xs">Trading experience</Label><Pills value={form.financial.trading_experience} onChange={(v) => setForm({ ...form, financial: { ...form.financial, trading_experience: v } })} options={["Beginner", "Intermediate", "Advanced"]} /></div>
                </div>
              </>
            )}
            {step === 1 && (
              <>
                <h2 className="font-display text-2xl font-semibold">Investment profile</h2>
                <div><Label className="text-xs">Preferred asset classes</Label><Pills multi value={form.investment.asset_classes} onChange={(v) => setForm({ ...form, investment: { ...form.investment, asset_classes: v } })} options={["Stocks", "ETFs", "Crypto", "Bonds", "Real Estate", "Commodities"]} /></div>
                <div><Label className="text-xs">Brokers used</Label><Input value={form.investment.brokers} onChange={(e) => setForm({ ...form, investment: { ...form.investment, brokers: e.target.value } })} placeholder="IBKR, Trade Republic…" className="mt-1" /></div>
                <div><Label className="text-xs">Investment goals</Label><Input value={form.investment.goals} onChange={(e) => setForm({ ...form, investment: { ...form.investment, goals: e.target.value } })} placeholder="Retirement, financial freedom…" className="mt-1" /></div>
                <div><Label className="text-xs">Target portfolio size</Label><Input type="number" value={form.investment.target_size || ""} onChange={(e) => setForm({ ...form, investment: { ...form.investment, target_size: +e.target.value } })} className="mt-1" /></div>
                <div><Label className="text-xs">Trading style</Label><Pills value={form.investment.trading_style} onChange={(v) => setForm({ ...form, investment: { ...form.investment, trading_style: v } })} options={["Scalp", "Day", "Swing", "Position", "Long-term"]} /></div>
                <div><Label className="text-xs">Preferred markets</Label><Input value={form.investment.preferred_markets} onChange={(e) => setForm({ ...form, investment: { ...form.investment, preferred_markets: e.target.value } })} placeholder="US equities, EU ETFs, BTC/ETH…" className="mt-1" /></div>
              </>
            )}
            {step === 2 && (
              <>
                <h2 className="font-display text-2xl font-semibold">Trading profile</h2>
                <div><Label className="text-xs">Primary trading asset</Label><Input value={form.trading.primary_asset} onChange={(e) => setForm({ ...form, trading: { ...form.trading, primary_asset: e.target.value } })} placeholder="ES, NQ, BTCUSD…" className="mt-1" /></div>
                <div><Label className="text-xs">Average risk per trade (%)</Label><Input type="number" step="0.1" value={form.trading.avg_risk_pct} onChange={(e) => setForm({ ...form, trading: { ...form.trading, avg_risk_pct: +e.target.value } })} className="mt-1" /></div>
                <div><Label className="text-xs">Trading sessions</Label><Pills multi value={form.trading.sessions} onChange={(v) => setForm({ ...form, trading: { ...form.trading, sessions: v } })} options={["Asia", "London", "NY AM", "NY PM"]} /></div>
                <div><Label className="text-xs">Preferred setups</Label><Input value={form.trading.setups} onChange={(e) => setForm({ ...form, trading: { ...form.trading, setups: e.target.value } })} placeholder="Breakouts, FVG, OB…" className="mt-1" /></div>
                <div><Label className="text-xs">Trading frequency</Label><Pills value={form.trading.frequency} onChange={(v) => setForm({ ...form, trading: { ...form.trading, frequency: v } })} options={["Multiple daily", "Daily", "Weekly", "Occasional"]} /></div>
              </>
            )}
            {step === 3 && (
              <>
                <h2 className="font-display text-2xl font-semibold">Review</h2>
                <p className="text-sm text-muted-foreground">You can edit any of this later in Settings.</p>
                <div className="space-y-3 text-sm">
                  <div className="glass-strong rounded-xl p-3"><div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Financial</div>{form.financial.currency} · {form.financial.risk_profile} · Inv {form.financial.investing_experience} · Trade {form.financial.trading_experience} · Income ${form.financial.monthly_income}/mo</div>
                  <div className="glass-strong rounded-xl p-3"><div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Investing</div>{form.investment.asset_classes.join(", ") || "—"} · {form.investment.trading_style} · target ${form.investment.target_size}</div>
                  <div className="glass-strong rounded-xl p-3"><div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Trading</div>{form.trading.primary_asset || "—"} · risk {form.trading.avg_risk_pct}% · {form.trading.sessions.join(", ") || "no sessions"} · {form.trading.frequency}</div>
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="flex justify-between mt-8">
          <Button variant="outline" disabled={step === 0} onClick={() => setStep(step - 1)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          {step < steps.length - 1 ? (
            <Button onClick={() => setStep(step + 1)} className="bg-cyan text-background hover:bg-cyan/90">Next <ArrowRight className="h-4 w-4 ml-1" /></Button>
          ) : (
            <Button onClick={finish} disabled={saving} className="bg-cyan text-background hover:bg-cyan/90">{saving ? "Saving…" : <>Finish <Check className="h-4 w-4 ml-1" /></>}</Button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
