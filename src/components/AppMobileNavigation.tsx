import { useRef, useState } from "react";
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
import { useI18n } from "@/lib/use-i18n";
import { cn } from "@/lib/utils";

const moreItems = [
  { label: "Accounts", to: "/accounts", icon: Wallet },
  { label: "Transactions", to: "/transactions", icon: ArrowLeftRight },
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
  const { t } = useI18n();
  const [moreOpen, setMoreOpen] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const dragStartY = useRef<number | null>(null);
  const dragOffsetRef = useRef(0);
  const moreActive = moreItems.some((item) => active(path, item.to));
  const navClass =
    "flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-medium";

  const updateDragOffset = (value: number) => {
    dragOffsetRef.current = value;
    setDragOffset(value);
  };

  const finishDrag = () => {
    dragStartY.current = null;
    if (dragOffsetRef.current >= 72) {
      setMoreOpen(false);
    }
    updateDragOffset(0);
  };

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
      <div className="grid min-h-16 grid-cols-5 px-2">
        <Link
          to="/"
          className={cn(navClass, active(path, "/") ? "text-cyan" : "text-muted-foreground")}
        >
          <LayoutDashboard className="h-5 w-5" />
          <span>{t("Dashboard")}</span>
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
          <span>{t("Portfolio")}</span>
        </Link>
        <button
          type="button"
          onClick={() => openComposer("transaction", "general")}
          className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold text-cyan"
          aria-label={t("Add financial record")}
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan text-background shadow-[0_0_24px_-8px_var(--cyan)]">
            <Plus className="h-5 w-5" />
          </span>
          <span>{t("Add")}</span>
        </button>
        <Link
          to="/calendar"
          className={cn(
            navClass,
            active(path, "/calendar") ? "text-cyan" : "text-muted-foreground",
          )}
        >
          <CalendarDays className="h-5 w-5" />
          <span>{t("Calendar")}</span>
        </Link>
        <Sheet
          open={moreOpen}
          onOpenChange={(open) => {
            setMoreOpen(open);
            if (!open) updateDragOffset(0);
          }}
        >
          <SheetTrigger asChild>
            <button
              type="button"
              className={cn(navClass, moreActive ? "text-cyan" : "text-muted-foreground")}
            >
              <MoreHorizontal className="h-5 w-5" />
              <span>{t("More")}</span>
            </button>
          </SheetTrigger>
          <SheetContent
            side="bottom"
            className={cn(
              "rounded-t-3xl pb-[calc(1.5rem+env(safe-area-inset-bottom))]",
              dragOffset === 0 && "transition-transform motion-reduce:transition-none",
            )}
            style={dragOffset > 0 ? { transform: `translateY(${dragOffset}px)` } : undefined}
          >
            <button
              type="button"
              className="mx-auto -mt-2 mb-2 flex h-11 w-20 touch-none items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
              aria-label={t("Drag down to close menu")}
              onPointerDown={(event) => {
                dragStartY.current = event.clientY;
                updateDragOffset(0);
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={(event) => {
                if (dragStartY.current === null) return;
                updateDragOffset(Math.max(0, event.clientY - dragStartY.current));
              }}
              onPointerUp={finishDrag}
              onPointerCancel={finishDrag}
              onWheel={(event) => {
                if (event.deltaY > 16) {
                  event.preventDefault();
                  setMoreOpen(false);
                }
              }}
            >
              <span className="h-1 w-9 rounded-full bg-white/20" aria-hidden="true" />
            </button>
            <SheetHeader className="text-left">
              <SheetTitle>More</SheetTitle>
              <SheetDescription>{t("Your accounts, goals and settings.")}</SheetDescription>
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
                    <span>{t(item.label)}</span>
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
