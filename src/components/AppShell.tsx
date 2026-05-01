import { Link, useNavigate, useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { LayoutDashboard, Building2, Users, FileText, FilePlus, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import sigmaMark from "@/assets/apoyphe-sigma.png";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/companies", label: "Companies", icon: Building2 },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/invoices", label: "Invoices", icon: FileText },
  { to: "/invoices/new", label: "New Invoice", icon: FilePlus },
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
    <div className="min-h-screen flex bg-background text-foreground">
      <aside className="w-64 shrink-0 border-r bg-card flex flex-col">
        <div className="px-5 py-5 border-b flex items-center gap-3">
          <img src={sigmaMark} alt="Apoyphe" className="h-9 w-9 shrink-0" />
          <div>
            <div className="text-lg font-semibold leading-tight">Apoyphe Billing</div>
            <div className="text-xs text-muted-foreground">Invoice Manager</div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
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
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-accent",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t">
          <div className="px-2 py-2 text-xs text-muted-foreground truncate">
            {user?.email}
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-accent"
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
