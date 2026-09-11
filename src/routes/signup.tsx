import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AlertCircle, ArrowRight, MailCheck, Mail, User } from "lucide-react";
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

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Create your account — Nebula Wealth Hub" },
      {
        name: "description",
        content:
          "Create a Nebula Wealth Hub account to track accounts, investments, goals and net worth in one place.",
      },
      { property: "og:title", content: "Create your account — Nebula Wealth Hub" },
      {
        property: "og:description",
        content: "Track accounts, investments, goals and net worth in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    try {
      const { requiresEmailConfirmation } = await signUp(email, password, name);
      if (requiresEmailConfirmation) {
        // No session exists yet, so onboarding is genuinely not reachable.
        setAwaitingConfirmation(true);
        toast.success("Account created. Confirm your email to continue.");
        return;
      }
      toast.success("Account created — let's set you up.");
      void navigate({ to: "/onboarding" });
    } catch (error: unknown) {
      const failure = classifyAuthFailure(
        error,
        "We couldn't create your account. Please try again.",
      );
      setErrorMsg(failure.message);
      toast.error(failure.message);
    } finally {
      setLoading(false);
    }
  };

  if (awaitingConfirmation) {
    return (
      <AuthShell
        title="Confirm your email"
        subtitle="One step left before you can sign in."
        glowPosition="70% 30%"
        footer={
          <>
            Already confirmed?{" "}
            <Link to="/login" className="font-medium text-cyan hover:underline">
              Sign in
            </Link>
          </>
        }
      >
        <div className="surface-quiet mt-7 flex items-start gap-3 p-4">
          <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-cyan" aria-hidden="true" />
          <div className="min-w-0 text-sm leading-6">
            <p className="font-medium text-foreground">We sent a confirmation link to {email}.</p>
            <p className="mt-1 text-muted-foreground">
              Open that link to activate your account, then come back and sign in. Setup starts
              right after your first sign-in.
            </p>
          </div>
        </div>
        <Button asChild size="lg" className="mt-5 w-full bg-cyan text-background hover:bg-cyan/90">
          <Link to="/login">
            Go to sign in <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Track your accounts, investments and goals in one clear place."
      glowPosition="70% 30%"
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-cyan hover:underline">
            Sign in
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
          <Label htmlFor="signup-name">Display name</Label>
          <div className="relative">
            <User
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="signup-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              required
              className="pl-9"
              placeholder="Alex Morgan"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="signup-email">Email</Label>
          <div className="relative">
            <Mail
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="signup-email"
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
          <Label htmlFor="signup-password">Password</Label>
          <div className="relative">
            <Lock
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="signup-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              className="pl-9"
              placeholder="At least 6 characters"
              aria-describedby="signup-password-hint"
            />
          </div>
          <p id="signup-password-hint" className="text-xs text-muted-foreground">
            Use at least 6 characters.
          </p>
        </div>

        <Button
          type="submit"
          disabled={loading}
          size="lg"
          className="mt-2 w-full bg-cyan text-background hover:bg-cyan/90"
        >
          {loading ? (
            "Creating…"
          ) : (
            <>
              Create account <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
            </>
          )}
        </Button>
      </form>
    </AuthShell>
  );
}
