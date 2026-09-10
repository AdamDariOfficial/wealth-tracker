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
import { useEffect, useState } from "react";
import { AppMobileNavigation } from "@/components/AppMobileNavigation";
import { AppSidebar } from "@/components/AppSidebar";
import { CommandPalette } from "@/components/CommandPalette";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { CoreComposer } from "@/features/wealth-v2/CoreComposer";
import { GlobalFinancialWarnings } from "@/features/wealth-v2/GlobalFinancialWarnings";
import { useAuth } from "@/lib/auth-store";
import { useI18n } from "@/lib/use-i18n";
import appCss from "../styles.css?url";

const PUBLIC_ROUTES = ["/login", "/signup"];
const ONBOARDING_ROUTE = "/onboarding";

function NotFoundComponent() {
  const { t } = useI18n();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">{t("Page not found")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("The page you're looking for doesn't exist or has been moved.")}
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          {t("Go home")}
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  const { t } = useI18n();
  void error;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {t("This page didn't load")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t(
            "Something went wrong while loading this page. Try again, or return home if the problem continues.",
          )}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="min-h-11 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            {t("Try again")}
          </button>
          <Link
            to="/"
            className="inline-flex min-h-11 items-center rounded-xl border border-input px-4 text-sm font-medium"
          >
            {t("Go home")}
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
  const { user, profile, loading, init } = useAuth();
  const [mounted, setMounted] = useState(false);

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
        <SidebarProvider open={true}>
          <div className="flex min-h-screen w-full">
            <AppSidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <main className="safe-x mx-auto w-full max-w-[1440px] flex-1 pb-24 md:pb-6">
                <div className="min-w-0 px-4 sm:px-6 lg:px-8">
                  <div className="sticky top-0 z-40 -mx-4 mb-5 flex justify-center border-b border-border/40 bg-background/95 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-xl sm:-mx-6 sm:mb-6 sm:px-6 sm:pb-4 sm:pt-4 lg:-mx-8 lg:px-8">
                    <div className="w-full max-w-2xl">
                      <CommandPalette />
                    </div>
                  </div>
                  <GlobalFinancialWarnings />
                  <Outlet />
                </div>
              </main>
            </div>
          </div>
          <AppMobileNavigation />
          <CoreComposer />
        </SidebarProvider>
      )}
    </QueryClientProvider>
  );
}
