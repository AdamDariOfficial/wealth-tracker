import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useState } from "react";
import { Lock, Mail, ArrowRight, Sparkles, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-store";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({ component: LoginPage });

function formatAuthError(err: any): string {
  const status = err?.status;
  const msg = err?.message ?? "Sign in failed";
  if (status === 404) {
    return "Auth endpoint returned 404. This usually happens inside the Lovable preview's fetch proxy — try again, or test on the published URL.";
  }
  if (/failed to fetch|networkerror|fetch/i.test(msg)) {
    return `Network error reaching auth service: ${msg}`;
  }
  if (status) return `[${status}] ${msg}`;
  return msg;
}

function LoginPage() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    try {
      await signIn(email, password);
      toast.success("Welcome back");
      navigate({ to: "/" });
    } catch (err: any) {
      const message = formatAuthError(err);
      setErrorMsg(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,oklch(0.82_0.15_210_/_0.12),transparent_60%)] pointer-events-none" />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-3xl p-8 w-full max-w-md relative">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-cyan to-cyan-glow flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-background" />
          </div>
          <span className="font-display font-semibold tracking-tight">Wealth Tracker</span>
        </div>
        <h1 className="font-display text-3xl font-semibold mt-6">Welcome back</h1>
        <p className="text-sm text-muted-foreground mt-1">Sign in to your wealth operating system.</p>

        {errorMsg && (
          <div
            role="alert"
            className="mt-6 flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
          >
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span className="leading-snug">{errorMsg}</span>
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4 mt-8">
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Email</Label>
            <div className="relative mt-1.5">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required className="pl-9" placeholder="you@example.com" />
            </div>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Password</Label>
            <div className="relative mt-1.5">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required minLength={6} className="pl-9" placeholder="••••••••" />
            </div>
          </div>
          <Button disabled={loading} className="w-full bg-cyan text-background hover:bg-cyan/90 mt-2">
            {loading ? "Signing in…" : <>Sign in <ArrowRight className="h-4 w-4 ml-1" /></>}
          </Button>
        </form>

        <p className="text-xs text-muted-foreground mt-6 text-center">
          New here? <Link to="/signup" className="text-cyan hover:underline">Create an account</Link>
        </p>
      </motion.div>
    </div>
  );
}
