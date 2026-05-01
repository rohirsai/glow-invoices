import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { endpoints, tokenStore, userStore } from "./api";

type User = { email: string; name?: string };
type AuthCtx = {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const token = tokenStore.get();
    const u = userStore.get();
    if (token && u) setUser(u);
  }, []);

  const login = async (email: string, password: string) => {
    const res = await endpoints.login(email, password);
    tokenStore.set(res.token);
    userStore.set(res.user);
    setUser(res.user);
  };

  const logout = () => {
    tokenStore.clear();
    setUser(null);
  };

  return (
    <Ctx.Provider value={{ user, isAuthenticated: !!user, login, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}
