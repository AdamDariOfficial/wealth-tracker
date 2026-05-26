import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { User, Globe, Bell, Database, Download, LogOut, Upload, Save, ShieldCheck, Sliders, Palette } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth-store";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({ component: Settings });

function Section({ icon: Icon, title, desc, children }: any) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-6">
      <div className="flex items-start gap-3 mb-5">
        <div className="h-10 w-10 rounded-xl glass-strong flex items-center justify-center text-cyan">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <h3 className="font-display font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </motion.div>
  );
}

const NOTIF_KEYS = [
  { key: "weekly_email", label: "Weekly performance email" },
  { key: "goal_alerts", label: "Goal milestone alerts" },
  { key: "drawdown_warnings", label: "Drawdown warnings" },
  { key: "dca_reminders", label: "DCA reminders" },
] as const;

function Settings() {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [profileForm, setProfileForm] = useState({ display_name: "", currency: "USD", locale: "en-US", avatar_url: "" });
  const [notifs, setNotifs] = useState<Record<string, boolean>>({});
  const [onboarding, setOnboarding] = useState<any>({ financial: {}, investment: {}, trading: {} });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setProfileForm({
      display_name: profile.display_name ?? "",
      currency: profile.currency ?? "USD",
      locale: (profile as any).locale ?? "en-US",
      avatar_url: profile.avatar_url ?? "",
    });
    setNotifs((profile as any).notifications ?? {});
  }, [profile]);

  // Load onboarding_data with realtime
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase.from("onboarding_data").select("*").eq("user_id", user.id).maybeSingle();
      if (data) setOnboarding(data);
    };
    load();
    const ch = supabase.channel(`onb-${user.id}`)
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "onboarding_data", filter: `user_id=eq.${user.id}` },
        (payload: any) => {
          // Don't override unsaved local edits if user is currently typing — only refresh when no changes pending
          if (!saving) setOnboarding(payload.new);
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, saving]);

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("profiles").update({
        display_name: profileForm.display_name,
        currency: profileForm.currency,
        locale: profileForm.locale,
        avatar_url: profileForm.avatar_url,
        notifications: notifs,
      }).eq("id", user.id);
      if (error) throw error;
      await refreshProfile();
      toast.success("Profile saved");
    } catch (e: any) { toast.error(e.message ?? "Save failed"); }
    finally { setSaving(false); }
  };

  const saveOnboarding = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("onboarding_data").update({
        financial: onboarding.financial ?? {},
        investment: onboarding.investment ?? {},
        trading: onboarding.trading ?? {},
      }).eq("user_id", user.id);
      if (error) throw error;
      toast.success("Investor profile saved");
    } catch (e: any) { toast.error(e.message ?? "Save failed"); }
    finally { setSaving(false); }
  };

  const onAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = pub.publicUrl;
      setProfileForm((f) => ({ ...f, avatar_url: url }));
      await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
      await refreshProfile();
      toast.success("Avatar updated");
    } catch (err: any) { toast.error(err.message ?? "Upload failed"); }
    finally { setUploading(false); }
  };

  const exportAll = async () => {
    if (!user) return;
    const tables = ["profiles", "onboarding_data", "trading_account", "investments", "etfs", "crypto_holdings", "cash_reserves", "goals", "weekly_reports", "trades", "performance_snapshots"];
    const dump: Record<string, any> = {};
    for (const t of tables) {
      const { data } = await (supabase as any).from(t).select("*");
      dump[t] = data ?? [];
    }
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `wealth-tracker-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click(); URL.revokeObjectURL(url);
  };

  const setFin = (k: string, v: any) => setOnboarding((o: any) => ({ ...o, financial: { ...(o.financial ?? {}), [k]: v } }));
  const setInv = (k: string, v: any) => setOnboarding((o: any) => ({ ...o, investment: { ...(o.investment ?? {}), [k]: v } }));
  const setTra = (k: string, v: any) => setOnboarding((o: any) => ({ ...o, trading: { ...(o.trading ?? {}), [k]: v } }));

  return (
    <div className="space-y-6">
      <PageHeader title="Workspace Settings" subtitle="Profile, preferences, trading defaults and data management."
        action={<Button variant="outline" onClick={signOut}><LogOut className="h-4 w-4 mr-2" /> Sign out</Button>} />

      <Tabs defaultValue="profile">
        <TabsList className="bg-muted/40 border border-border/40 h-10 flex-wrap">
          <TabsTrigger value="profile" className="px-4">Profile</TabsTrigger>
          <TabsTrigger value="preferences" className="px-4">Currency & Locale</TabsTrigger>
          <TabsTrigger value="trading" className="px-4">Trading</TabsTrigger>
          <TabsTrigger value="notifications" className="px-4">Notifications</TabsTrigger>
          <TabsTrigger value="data" className="px-4">Data</TabsTrigger>
          <TabsTrigger value="security" className="px-4">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-6">
          <Section icon={User} title="Profile" desc="Your personal information">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full glass-strong overflow-hidden flex items-center justify-center text-cyan font-display text-xl">
                {profileForm.avatar_url
                  ? <img src={profileForm.avatar_url} alt="" className="h-full w-full object-cover" />
                  : (profileForm.display_name?.[0]?.toUpperCase() ?? "?")}
              </div>
              <div>
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={onAvatarChange} />
                <Button variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
                  <Upload className="h-3 w-3 mr-2" /> {uploading ? "Uploading…" : "Change avatar"}
                </Button>
              </div>
            </div>
            <div>
              <Label className="text-xs">Display name</Label>
              <Input value={profileForm.display_name} onChange={(e) => setProfileForm({ ...profileForm, display_name: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Email</Label>
              <Input value={user?.email ?? ""} disabled className="mt-1" />
            </div>
            <Button onClick={saveProfile} disabled={saving} className="bg-cyan text-background hover:bg-cyan/90"><Save className="h-4 w-4 mr-2" /> Save profile</Button>
          </Section>
        </TabsContent>

        <TabsContent value="preferences" className="mt-6 space-y-4">
          <Section icon={Globe} title="Currency & Locale" desc="Base currency propagates across every view; locale controls number formatting.">
            <div>
              <Label className="text-xs">Base currency</Label>
              <select value={profileForm.currency} onChange={(e) => setProfileForm({ ...profileForm, currency: e.target.value })}
                className="mt-1 w-full bg-background border border-border rounded-md px-3 py-2 text-sm">
                {["USD", "EUR", "GBP", "CHF", "JPY", "AUD", "CAD", "SEK", "NOK", "DKK", "CNY", "INR"].map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs">Locale</Label>
              <Input value={profileForm.locale} onChange={(e) => setProfileForm({ ...profileForm, locale: e.target.value })} className="mt-1" placeholder="en-US, fr-FR, de-DE…" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Monthly income</Label>
                <Input type="number" value={onboarding.financial?.monthly_income ?? 0} onChange={(e) => setFin("monthly_income", +e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Weekly contribution</Label>
                <Input type="number" value={onboarding.financial?.weekly_income ?? 0} onChange={(e) => setFin("weekly_income", +e.target.value)} className="mt-1" />
              </div>
            </div>
            <Button onClick={async () => { await saveProfile(); await saveOnboarding(); }} disabled={saving} className="bg-cyan text-background hover:bg-cyan/90"><Save className="h-4 w-4 mr-2" /> Save preferences</Button>
          </Section>
          <Section icon={Palette} title="Appearance" desc="Theme is fixed to charcoal/cyan dark for the institutional aesthetic.">
            <div className="text-xs text-muted-foreground">Light themes intentionally disabled to preserve chart contrast and depth.</div>
          </Section>
        </TabsContent>

        <TabsContent value="trading" className="mt-6">
          <Section icon={Sliders} title="Trading defaults" desc="Used to pre-fill weekly reviews and risk calculators.">
            <div>
              <Label className="text-xs">Risk profile</Label>
              <Input value={onboarding.financial?.risk_profile ?? ""} onChange={(e) => setFin("risk_profile", e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Trading style</Label>
              <Input value={onboarding.investment?.trading_style ?? ""} onChange={(e) => setInv("trading_style", e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Primary trading asset</Label>
              <Input value={onboarding.trading?.primary_asset ?? ""} onChange={(e) => setTra("primary_asset", e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Average risk per trade (%)</Label>
              <Input type="number" step="0.1" value={onboarding.trading?.avg_risk_pct ?? 1} onChange={(e) => setTra("avg_risk_pct", +e.target.value)} className="mt-1" />
            </div>
            <Button onClick={saveOnboarding} disabled={saving} className="bg-cyan text-background hover:bg-cyan/90"><Save className="h-4 w-4 mr-2" /> Save trading defaults</Button>
          </Section>
        </TabsContent>

        <TabsContent value="notifications" className="mt-6">
          <Section icon={Bell} title="Notifications" desc="Alerts and weekly digests">
            {NOTIF_KEYS.map((n) => (
              <div key={n.key} className="flex items-center justify-between">
                <span className="text-sm">{n.label}</span>
                <Switch checked={!!notifs[n.key]} onCheckedChange={(v) => setNotifs((p) => ({ ...p, [n.key]: v }))} />
              </div>
            ))}
            <Button onClick={saveProfile} disabled={saving} className="bg-cyan text-background hover:bg-cyan/90"><Save className="h-4 w-4 mr-2" /> Save notifications</Button>
          </Section>
        </TabsContent>

        <TabsContent value="data" className="mt-6">
          <Section icon={Database} title="Export & backup" desc="Download a full JSON snapshot of your workspace.">
            <Button variant="outline" className="w-full justify-start" onClick={exportAll}><Download className="h-4 w-4 mr-2" /> Export all data (JSON)</Button>
            <div className="text-[11px] text-muted-foreground">
              Includes ledger transactions, accounts, assets, goals, weekly reports and snapshots. Ledger remains the source of truth.
            </div>
          </Section>
        </TabsContent>

        <TabsContent value="security" className="mt-6">
          <Section icon={ShieldCheck} title="Privacy & Security" desc="Account session and data integrity.">
            <div className="text-xs text-muted-foreground">
              All financial history uses soft-delete (voided) flags — nothing is permanently removed.
              An immutable audit trail records every account, transaction, goal and weekly-report change.
            </div>
            <Button variant="outline" onClick={signOut}><LogOut className="h-4 w-4 mr-2" /> Sign out of this device</Button>
          </Section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
