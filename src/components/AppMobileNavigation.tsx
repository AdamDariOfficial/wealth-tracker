import { Link, useRouterState } from "@tanstack/react-router";
import {
  ArrowLeftRight,
  Briefcase,
  CalendarDays,
  LayoutDashboard,
  MoreHorizontal,
  PieChart,
  Plus,
  Settings,
  Target,
  Upload,
  Wallet,
} from "lucide-react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useCoreUI } from "@/lib/core-ui-store";
import { cn } from "@/lib/utils";

const moreItems = [
  { label: "Accounts", to: "/accounts", icon: Wallet },
  { label: "Transactions", to: "/transactions", icon: ArrowLeftRight },
  { label: "Import", to: "/import", icon: Upload },
  { label: "Trading", to: "/trading", icon: Briefcase },
  { label: "Goals", to: "/goals", icon: Target },
  { label: "Settings", to: "/settings", icon: Settings },
] as const;

function active(path: string, target: string) {
  return target === "/" ? path === "/" : path === target || path.startsWith(`${target}/`);
}

export function AppMobileNavigation() {
  const path = useRouterState({ select: (state) => state.location.pathname });
  const openComposer = useCoreUI((state) => state.openComposer);
  const moreActive = moreItems.some((item) => active(path, item.to));
  const navClass =
    "flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-medium";

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
      <div className="grid min-h-16 grid-cols-5 px-2">
        <Link
          to="/"
          className={cn(navClass, active(path, "/") ? "text-cyan" : "text-muted-foreground")}
        >
          <LayoutDashboard className="h-5 w-5" />
          <span>Dashboard</span>
        </Link>
        <Link
          to="/investments"
          search={{ view: "all", q: "", asset: "" }}
          className={cn(
            navClass,
            active(path, "/investments") ? "text-cyan" : "text-muted-foreground",
          )}
        >
          <PieChart className="h-5 w-5" />
          <span>Portfolio</span>
        </Link>
        <button
          type="button"
          onClick={() => openComposer("transaction", "general")}
          className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold text-cyan"
          aria-label="Add financial record"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan text-background shadow-[0_0_24px_-8px_var(--cyan)]">
            <Plus className="h-5 w-5" />
          </span>
          <span>Add</span>
        </button>
        <Link
          to="/calendar"
          className={cn(
            navClass,
            active(path, "/calendar") ? "text-cyan" : "text-muted-foreground",
          )}
        >
          <CalendarDays className="h-5 w-5" />
          <span>Calendar</span>
        </Link>
        <Sheet>
          <SheetTrigger asChild>
            <button
              type="button"
              className={cn(navClass, moreActive ? "text-cyan" : "text-muted-foreground")}
            >
              <MoreHorizontal className="h-5 w-5" />
              <span>More</span>
            </button>
          </SheetTrigger>
          <SheetContent
            side="bottom"
            className="rounded-t-3xl pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
          >
            <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-white/15" />
            <SheetHeader className="text-left">
              <SheetTitle>More</SheetTitle>
              <SheetDescription>Core and advanced wealth workflows.</SheetDescription>
            </SheetHeader>
            <div className="mt-5 grid grid-cols-2 gap-2">
              {moreItems.map((item) => (
                <SheetClose asChild key={item.to}>
                  <Link
                    to={item.to}
                    className={cn(
                      "flex min-h-14 items-center gap-3 rounded-xl border border-border/60 bg-card/50 p-3 text-sm text-foreground",
                      active(path, item.to) && "border-cyan/25 bg-cyan/10 text-cyan",
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                </SheetClose>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
