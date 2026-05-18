import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  useNavigate,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Toaster } from "@/components/ui/sonner";
import { useAuth } from "@/lib/auth-store";

import appCss from "../styles.css?url";

const PUBLIC_ROUTES = ["/login", "/signup"];
const ONBOARDING_ROUTE = "/onboarding";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Wealth Tracker — Modern Portfolio & Trading Intelligence" },
      { name: "description", content: "Premium dark-mode dashboard for ETFs, crypto, trading capital and long-term wealth." },
      { name: "author", content: "Wealth Tracker" },
      { property: "og:title", content: "Wealth Tracker" },
      { property: "og:description", content: "Premium dark-mode dashboard for ETFs, crypto, trading capital and long-term wealth." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const path = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();
  const { user, profile, loading, init, signOut } = useAuth();

  // React error #418 root cause: this layout's rendered HTML depends on the
  // browser-only Supabase session (zustand auth-store), framer-motion inline
  // styles, and the Sonner portal — none of which can match the SSR snapshot
  // deterministically. We gate ALL of that behind a post-mount flag so the
  // server renders a stable empty shell and the client hydrates against the
  // same shell, then swaps to the real UI.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (mounted) init(); }, [mounted, init]);

  useEffect(() => {
    if (loading) return;
    const isPublic = PUBLIC_ROUTES.includes(path);
    const isOnboarding = path === ONBOARDING_ROUTE;
    if (!user && !isPublic) {
      navigate({ to: "/login" });
    } else if (user && isPublic) {
      // Don't bounce off public routes until we know onboarding status,
      // otherwise new users briefly land on / before being sent to onboarding.
      if (!profile) return;
      navigate({ to: profile.onboarded ? "/" : "/onboarding" });
    } else if (user && profile && !profile.onboarded && !isOnboarding) {
      navigate({ to: "/onboarding" });
    } else if (user && profile?.onboarded && isOnboarding) {
      navigate({ to: "/" });
    }
  }, [user, profile, loading, path, navigate]);

  const isPublic = PUBLIC_ROUTES.includes(path);
  const bare = isPublic || path === ONBOARDING_ROUTE || !user;
  // Authenticated but profile not yet loaded — never render protected shell
  // with a null profile (prevents flashes and breaks any child code that
  // assumes profile is present after auth).
  const authedWaitingForProfile = !!user && !profile && !isPublic && path !== ONBOARDING_ROUTE;

  if (!mounted) {
    // Stable SSR shell — no auth-dependent content, no portals, no animations.
    return <div className="min-h-screen bg-background" suppressHydrationWarning />;
  }

  if (authedWaitingForProfile || loading) {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Toaster />
      {bare ? (
        <Outlet />
      ) : (
        <SidebarProvider>
          <div className="min-h-screen flex w-full">
            <AppSidebar />
            <div className="flex-1 flex flex-col min-w-0">
              <header className="h-14 sticky top-0 z-30 flex items-center gap-3 px-4 border-b border-border/50 backdrop-blur-xl bg-background/60">
                <SidebarTrigger />
                <div className="text-xs font-mono text-muted-foreground hidden sm:block">{path}</div>
                <div className="ml-auto flex items-center gap-3">
                  <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="h-1.5 w-1.5 rounded-full bg-success pulse-dot" />
                    <span className="font-mono">LIVE</span>
                  </div>
                  <button onClick={() => signOut()} className="h-8 w-8 rounded-full bg-muted/50 hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors" title="Sign out">
                    <LogOut className="h-3.5 w-3.5" />
                  </button>
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-cyan to-cyan-glow flex items-center justify-center text-background text-xs font-semibold">
                    {(profile?.display_name ?? user?.email ?? "U").slice(0, 2).toUpperCase()}
                  </div>
                </div>
              </header>
              <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-[1600px] w-full mx-auto">
                <Outlet />
              </main>
            </div>
          </div>
        </SidebarProvider>
      )}
    </QueryClientProvider>
  );
}
