import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AlertCircle, ArrowRight, Mail } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AuthShell } from "@/components/AuthShell";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { PasswordInput } from "@/components/PasswordInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { classifyAuthFailure } from "@/lib/auth-messages";
import { useAuth } from "@/lib/auth-store";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — Nebula Wealth Hub" },
      {
        name: "description",
        content: "Sign in to Nebula Wealth Hub to track your accounts, portfolio and net worth.",
      },
      { property: "og:title", content: "Sign in — Nebula Wealth Hub" },
      {
        property: "og:description",
        content: "Sign in to track your accounts, portfolio and net worth.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    try {
      await signIn(email, password);
      toast.success("Welcome back");
      void navigate({ to: "/" });
    } catch (error: unknown) {
      const failure = classifyAuthFailure(error, "We couldn't sign you in. Please try again.");
      setErrorMsg(failure.message);
      toast.error(failure.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to pick up where you left off."
      footer={
        <>
          New here?{" "}
          <Link to="/signup" className="font-medium text-cyan hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      {errorMsg && (
        <div
          role="alert"
          className="mt-6 flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="leading-6">{errorMsg}</span>
        </div>
      )}

      <form onSubmit={onSubmit} className="mt-7 space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="login-email">Email</Label>
          <div className="relative">
            <Mail
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="login-email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              autoComplete="email"
              required
              className="pl-9"
              placeholder="you@example.com"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="login-password">Password</Label>
          <div className="relative">
            <Lock
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="login-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete="current-password"
              required
              minLength={6}
              className="pl-9"
              placeholder="••••••••"
            />
          </div>
        </div>

        <Button
          type="submit"
          disabled={loading}
          size="lg"
          className="mt-2 w-full bg-cyan text-background hover:bg-cyan/90"
        >
          {loading ? (
            "Signing in…"
          ) : (
            <>
              Sign in <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
            </>
          )}
        </Button>
      </form>
    </AuthShell>
  );
}
