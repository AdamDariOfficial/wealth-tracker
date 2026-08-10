import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  useNavigate,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { LogOut, Search } from "lucide-react";
import { AppMobileNavigation } from "@/components/AppMobileNavigation";
import { AppSidebar } from "@/components/AppSidebar";
import { CommandPalette } from "@/components/CommandPalette";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { financialV2Keys } from "@/data/query-keys";
import { CoreComposer } from "@/features/wealth-v2/CoreComposer";
import { useAuth } from "@/lib/auth-store";
import { useCoreUI } from "@/lib/core-ui-store";
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
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn&apos;t load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {error.message || "Something went wrong while loading this page."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="min-h-11 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            Try again
          </button>
          <Link
            to="/"
            className="inline-flex min-h-11 items-center rounded-xl border border-input px-4 text-sm font-medium"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
      { title: "Nebula Wealth Hub" },
      {
        name: "description",
        content: "Private wealth, portfolio and trading intelligence.",
      },
      { name: "author", content: "Nebula Wealth Hub" },
      { property: "og:title", content: "Nebula Wealth Hub" },
      {
        property: "og:description",
        content: "Private wealth, portfolio and trading intelligence.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=Manrope:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap",
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
  const path = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const { user, profile, loading, init, signOut } = useAuth();
  const [mounted, setMounted] = useState(false);

  const handleSignOut = useCallback(async () => {
    await signOut();
    queryClient.removeQueries({ queryKey: financialV2Keys.all });
  }, [queryClient, signOut]);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (mounted) {
      void init().catch((error) => console.error("Auth initialization failed", error));
    }
  }, [mounted, init]);
  useEffect(() => {
    if (!mounted) return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [mounted, path]);

  useEffect(() => {
    if (!mounted || loading) return;
    const isPublic = PUBLIC_ROUTES.includes(path);
    const isOnboarding = path === ONBOARDING_ROUTE;
    if (!user && !isPublic) {
      void navigate({ to: "/login", replace: true });
    } else if (user && !profile && !isOnboarding) {
      void navigate({ to: "/onboarding", replace: true });
    } else if (user && profile && !profile.onboarded && !isOnboarding) {
      void navigate({ to: "/onboarding", replace: true });
    } else if (user && profile?.onboarded && (isPublic || isOnboarding)) {
      void navigate({ to: "/", replace: true });
    }
  }, [mounted, user, profile, loading, path, navigate]);

  if (!mounted) {
    return <div className="min-h-screen bg-background" suppressHydrationWarning />;
  }

  const isPublic = PUBLIC_ROUTES.includes(path);
  const isOnboarding = path === ONBOARDING_ROUTE;
  const bare = isPublic || isOnboarding || !user;
  const protectedWaiting = !!user && !profile && !isOnboarding;

  return (
    <QueryClientProvider client={queryClient}>
      <Toaster />
      {loading || protectedWaiting ? (
        <div className="min-h-screen bg-background" />
      ) : bare ? (
        <Outlet />
      ) : (
        <SidebarProvider>
          <div className="flex min-h-screen w-full">
            <AppSidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <AppHeader
                userInitials={(profile?.displayName ?? user.email ?? "U").slice(0, 2).toUpperCase()}
                onSignOut={() => void handleSignOut()}
              />
              <main className="safe-x mx-auto w-full max-w-[1600px] flex-1 px-3 py-4 pb-24 sm:px-5 sm:py-6 md:pb-6 lg:px-8 lg:py-8">
                <Outlet />
              </main>
            </div>
          </div>
          <AppMobileNavigation />
          <CommandPalette />
          <CoreComposer />
        </SidebarProvider>
      )}
    </QueryClientProvider>
  );
}

function AppHeader({ userInitials, onSignOut }: { userInitials: string; onSignOut: () => void }) {
  const togglePalette = useCoreUI((state) => state.togglePalette);

  return (
    <header className="safe-top sticky top-0 z-30 flex min-h-14 items-center gap-2 border-b border-border/50 bg-background/70 px-3 backdrop-blur-xl sm:px-4">
      <SidebarTrigger className="touch-target hidden md:inline-flex" />
      <button
        onClick={() => togglePalette(true)}
        className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-border/50 bg-card/40 px-3 text-xs text-muted-foreground transition-colors hover:text-foreground md:ml-2 md:max-w-sm"
        aria-label="Open command palette"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="truncate">Search or run a command…</span>
        <kbd className="ml-auto hidden rounded border border-border/50 bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] md:inline">
          ⌘K
        </kbd>
      </button>
      <button
        onClick={onSignOut}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted/50 text-muted-foreground hover:text-foreground"
        title="Sign out"
        aria-label="Sign out"
      >
        <LogOut className="h-4 w-4" />
      </button>
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan to-cyan-glow text-xs font-semibold text-background"
        aria-label="User profile"
      >
        {userInitials}
      </div>
    </header>
  );
}
