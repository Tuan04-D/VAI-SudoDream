"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { logoutSession, restoreSession } from "./api";
import type { AdminUser, AuthUser, Official, Resident } from "@/lib/types";


interface AuthContextValue {
  user: AuthUser | null;
  resident: Resident | null;
  official: Official | null;
  admin: AdminUser | null;
  loading: boolean;
  setUser: (user: AuthUser | null) => void;
  setResident: (user: Resident | null) => void;
  setOfficial: (user: Official | null) => void;
  setAdmin: (user: AdminUser | null) => void;
  logout: () => Promise<void>;
}


const AuthContext = createContext<AuthContextValue | null>(null);


export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    restoreSession()
      .then(setUserState)
      .catch(() => setUserState(null))
      .finally(() => setLoading(false));
  }, []);

  const logout = useCallback(async () => {
    setUserState(null);
    await logoutSession();
  }, []);

  const setUser = useCallback((next: AuthUser | null) => {
    setUserState(next);
    if (!next) void logoutSession();
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    resident: user?.role === "resident" ? user : null,
    official: user?.role === "official" ? user : null,
    admin: user?.role === "admin" ? user : null,
    loading,
    setUser,
    setResident: (next) => setUser(next),
    setOfficial: (next) => setUser(next),
    setAdmin: (next) => setUser(next),
    logout,
  }), [loading, logout, setUser, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}


export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
