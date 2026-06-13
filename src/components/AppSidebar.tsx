import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, TrendingUp, PieChart, Bitcoin, Briefcase,
  BookOpen, Wallet, Target, BarChart3, Settings, Sparkles, ArrowLeftRight, Activity, ShieldCheck, FlaskConical, Calendar, Upload, ChevronDown, MoreHorizontal,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const treasury = [
  { title: "Dashboard",            url: "/",              icon: LayoutDashboard },
  { title: "Liquidity & Accounts", url: "/accounts",      icon: Wallet },
  { title: "Transactions",         url: "/transactions",  icon: ArrowLeftRight },
];
const portfolio = [
  { title: "Investments",     url: "/investments",     icon: TrendingUp },
  { title: "ETF Tracker",     url: "/etf",             icon: PieChart },
  { title: "Crypto",          url: "/crypto",          icon: Bitcoin },
];
const trading = [
  { title: "Trading Workspace", url: "/trading", icon: Briefcase },
];
const planning = [
  { title: "Goals",           url: "/goals",           icon: Target },
  { title: "Analytics",       url: "/analytics",       icon: BarChart3 },
];
const more = [
  { title: "Activity",              url: "/activity", icon: Activity },
  { title: "Timeline",              url: "/timeline", icon: BookOpen },
  { title: "Timeline Intelligence", url: "/calendar", icon: Calendar },
  { title: "Import Data",           url: "/import",   icon: Upload },
  { title: "Audit Log",             url: "/audit",    icon: ShieldCheck },
];
const system = [
  { title: "Settings",        url: "/settings",        icon: Settings },
  { title: "Dev Tools",       url: "/dev-tools",       icon: FlaskConical },
];

type Item = { title: string; url: string; icon: any };

function isActive(current: string, url: string) {
  return current === url || (url !== "/" && current.startsWith(url));
}

function Section({ label, items, current }: { label: string; items: Item[]; current: string }) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
        {label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((it) => (
            <SidebarMenuItem key={it.title}>
              <SidebarMenuButton asChild isActive={isActive(current, it.url)}
                className="data-[active=true]:bg-cyan/10 data-[active=true]:text-cyan data-[active=true]:border-l-2 data-[active=true]:border-cyan rounded-lg h-10">
                <Link to={it.url} className="flex items-center gap-3">
                  <it.icon className="h-4 w-4" />
                  <span className="font-medium">{it.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function MoreSection({ items, current }: { items: Item[]; current: string }) {
  const childActive = items.some((it) => isActive(current, it.url));
  const [open, setOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const stored = window.localStorage.getItem("sidebar.moreOpen");
    if (stored != null) return stored === "1";
    return window.matchMedia("(min-width: 768px)").matches;
  });
  useEffect(() => {
    if (childActive) setOpen(true);
  }, [childActive]);
  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem("sidebar.moreOpen", open ? "1" : "0");
  }, [open]);

  return (
    <SidebarGroup>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="w-full">
          <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70 flex items-center justify-between cursor-pointer hover:text-foreground">
            <span className="flex items-center gap-1.5"><MoreHorizontal className="h-3 w-3" /> More</span>
            <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
          </SidebarGroupLabel>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((it) => (
                <SidebarMenuItem key={it.title}>
                  <SidebarMenuButton asChild isActive={isActive(current, it.url)}
                    className="data-[active=true]:bg-cyan/10 data-[active=true]:text-cyan data-[active=true]:border-l-2 data-[active=true]:border-cyan rounded-lg h-10">
                    <Link to={it.url} className="flex items-center gap-3">
                      <it.icon className="h-4 w-4" />
                      <span className="font-medium">{it.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </Collapsible>
    </SidebarGroup>
  );
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (r) => r.location.pathname });

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="px-4 py-5">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="relative h-9 w-9 rounded-xl bg-gradient-to-br from-cyan to-cyan-glow flex items-center justify-center glow-cyan">
            <Sparkles className="h-4 w-4 text-background" />
          </div>
          {!collapsed && (
            <div className="leading-tight">
              <div className="font-display font-bold text-base">Wealth</div>
              <div className="text-[10px] text-muted-foreground tracking-[0.2em] uppercase">Tracker</div>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <Section label="Treasury"  items={treasury}  current={path} />
        <Section label="Portfolio" items={portfolio} current={path} />
        <Section label="Trading"   items={trading}   current={path} />
        <Section label="Planning"  items={planning}  current={path} />
        <MoreSection items={more}  current={path} />
        <Section label="System"    items={system}    current={path} />
      </SidebarContent>

      {!collapsed && (
        <SidebarFooter className="p-3">
          <div className="glass rounded-xl p-3">
            <div className="flex items-center gap-2 text-xs">
              <div className="h-2 w-2 rounded-full bg-success pulse-dot" />
              <span className="text-muted-foreground">Markets open</span>
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground/70">Live data — phase 2</div>
          </div>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
