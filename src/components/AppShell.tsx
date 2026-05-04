import { Link, useNavigate, useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { LayoutDashboard, Building2, Users, FileText, FilePlus, LogOut, UserCog } from "lucide-react";
import { cn } from "@/lib/utils";
import sigmaMark from "@/assets/apoyphe-sigma.png";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/companies", label: "Companies", icon: Building2 },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/invoices", label: "Invoices", icon: FileText },
  { to: "/invoices/new", label: "New Invoice", icon: FilePlus },
  { to: "/users", label: "Users", icon: UserCog },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate({ to: "/login" });
  };

  return (
    <div className="min-h-screen flex text-foreground">
      <aside className="w-64 shrink-0 bg-sidebar text-sidebar-foreground flex flex-col">
        <div className="px-5 py-5 border-b border-sidebar-border flex items-center gap-3">
          <img src={sigmaMark} alt="Apoyphe" className="h-9 w-9 shrink-0" />
          <div>
            <div className="text-base font-semibold leading-tight">Apoyphe</div>
            <div className="text-xs opacity-60">Invoice Suite</div>
          </div>
        </div>
        <div className="px-5 pt-5 pb-2 text-[11px] uppercase tracking-wider opacity-50">Workspace</div>
        <nav className="flex-1 px-3 space-y-1">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.to ||
              (item.to !== "/dashboard" && location.pathname.startsWith(item.to));
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                    : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <div className="px-2 py-2 text-xs opacity-60 truncate">
            {user?.email}
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-sidebar-accent"
          >
            <LogOut className="h-4 w-4" /> Logout
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto p-6">{children}</div>
      </main>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}
