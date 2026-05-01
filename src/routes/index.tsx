import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    navigate({ to: isAuthenticated ? "/dashboard" : "/login" });
  }, [isAuthenticated, navigate]);
  return null;
}
