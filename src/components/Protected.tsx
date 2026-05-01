import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { AppShell } from "./AppShell";

export function Protected({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) navigate({ to: "/login" });
  }, [isAuthenticated, navigate]);

  if (!isAuthenticated) return null;
  return <AppShell>{children}</AppShell>;
}
