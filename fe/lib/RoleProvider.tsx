"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { fetchOfficial, fetchResident } from "./api";
import type { Official, Resident } from "./types";

const RESIDENT_KEY = "tramban_resident_id";
const OFFICIAL_KEY = "tramban_official_id";

interface RoleContextValue {
  resident: Resident | null;
  official: Official | null;
  loading: boolean;
  setResident: (r: Resident | null) => void;
  setOfficial: (o: Official | null) => void;
}

const RoleContext = createContext<RoleContextValue | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [resident, setResidentState] = useState<Resident | null>(null);
  const [official, setOfficialState] = useState<Official | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const residentId = window.localStorage.getItem(RESIDENT_KEY);
    const officialId = window.localStorage.getItem(OFFICIAL_KEY);
    Promise.all([
      residentId ? fetchResident(residentId).catch(() => null) : Promise.resolve(null),
      officialId ? fetchOfficial(officialId).catch(() => null) : Promise.resolve(null),
    ]).then(([r, o]) => {
      setResidentState(r);
      setOfficialState(o);
      setLoading(false);
    });
  }, []);

  const setResident = useCallback((r: Resident | null) => {
    setResidentState(r);
    if (r) window.localStorage.setItem(RESIDENT_KEY, r.id);
    else window.localStorage.removeItem(RESIDENT_KEY);
  }, []);

  const setOfficial = useCallback((o: Official | null) => {
    setOfficialState(o);
    if (o) window.localStorage.setItem(OFFICIAL_KEY, o.id);
    else window.localStorage.removeItem(OFFICIAL_KEY);
  }, []);

  return (
    <RoleContext.Provider value={{ resident, official, loading, setResident, setOfficial }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole(): RoleContextValue {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within RoleProvider");
  return ctx;
}
