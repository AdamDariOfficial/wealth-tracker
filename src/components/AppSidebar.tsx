import { Link, useRouterState } from "@tanstack/react-router";
import {
  ArrowLeftRight,
  Briefcase,
  CalendarDays,
  LayoutDashboard,
  PieChart,
  Plus,
  Settings,
  Sparkles,
  Target,
  Upload,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useCoreUI } from "@/lib/core-ui-store";

const core = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Portfolio", url: "/investments", icon: PieChart },
  { title: "Accounts", url: "/accounts", icon: Wallet },
  { title: "Transactions", url: "/transactions", icon: ArrowLeftRight },
] as const;

const advanced = [
  { title: "Calendar", url: "/calendar", icon: CalendarDays },
  { title: "Import", url: "/import", icon: Upload },
  { title: "Trading", url: "/trading", icon: Briefcase },
  { title: "Goals", url: "/goals", icon: Target },
  { title: "Settings", url: "/settings", icon: Settings },
] as const;

function isActive(current: string, url: string) {
  return url === "/" ? current === "/" : current === url || current.startsWith(`${url}/`);
}

function Section({
  label,
  items,
  current,
}: {
  label: string;
  items: readonly { title: string; url: string; icon: LucideIcon }[];
  current: string;
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel className="label-muted">{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.url}>
              <SidebarMenuButton
                asChild
                isActive={isActive(current, item.url)}
                className="h-10 rounded-lg data-[active=true]:border-l-2 data-[active=true]:border-cyan data-[active=true]:bg-cyan/10 data-[active=true]:text-cyan"
              >
                <Link to={item.url} className="flex items-center gap-3">
                  <item.icon className="h-4 w-4" />
                  <span className="font-medium">{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (state) => state.location.pathname });
  const openComposer = useCoreUI((state) => state.openComposer);

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="px-4 py-5">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="glow-cyan flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan to-cyan-glow">
            <Sparkles className="h-4 w-4 text-background" />
          </div>
          {!collapsed && (
            <div className="leading-tight">
              <div className="font-display text-base font-bold">Nebula</div>
              <div className="label-muted">Wealth Hub</div>
            </div>
          )}
        </Link>
      </SidebarHeader>
      <SidebarContent className="px-2">
        <Section label="Core" items={core} current={path} />
        <Section label="Advanced" items={advanced} current={path} />
      </SidebarContent>
      <SidebarFooter className="p-3">
        <button
          type="button"
          onClick={() => openComposer("transaction")}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-cyan px-3 text-sm font-semibold text-background hover:bg-cyan/90"
        >
          <Plus className="h-4 w-4" />
          {!collapsed && <span>Add record</span>}
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
