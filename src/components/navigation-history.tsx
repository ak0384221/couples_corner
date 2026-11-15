"use client";

import { createContext, useCallback, useContext, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

const HISTORY_KEY = "our-little-corner:navigation-history";
const MAX_TRACKED_ROUTES = 50;
const NavigationHistoryContext = createContext<((fallback: string) => void) | null>(null);

function readHistory(): string[] {
  try {
    const stored = sessionStorage.getItem(HISTORY_KEY);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) && parsed.every((path) => typeof path === "string")
      ? parsed
      : [];
  } catch {
    return [];
  }
}

function writeHistory(history: string[]) {
  try {
    sessionStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    // History navigation still works for the current page if storage is unavailable.
  }
}

export function NavigationHistoryProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const historyRef = useRef<string[]>([]);
  const initializedRef = useRef(false);
  const traversingRef = useRef(false);

  useEffect(() => {
    function onPopState() {
      traversingRef.current = true;
    }

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    let history = historyRef.current;
    if (!initializedRef.current) {
      history = readHistory();
      if (history.at(-1) !== pathname) history.push(pathname);
      initializedRef.current = true;
    } else if (history.at(-1) !== pathname) {
      if (traversingRef.current) {
        traversingRef.current = false;
        const previousIndex = history.lastIndexOf(pathname);
        history = previousIndex >= 0
          ? history.slice(0, previousIndex + 1)
          : [...history.slice(0, -1), pathname];
      } else {
        history = [...history, pathname].slice(-MAX_TRACKED_ROUTES);
      }
    }
    historyRef.current = history;
    writeHistory(history);
  }, [pathname]);

  const goBack = useCallback((fallback: string) => {
    if (historyRef.current.length > 1) {
      router.back();
    } else {
      router.push(fallback);
    }
  }, [router]);

  return (
    <NavigationHistoryContext.Provider value={goBack}>
      {children}
    </NavigationHistoryContext.Provider>
  );
}

export function useAppBack(fallback: string) {
  const goBack = useContext(NavigationHistoryContext);
  if (!goBack) throw new Error("useAppBack must be used within NavigationHistoryProvider.");
  return useCallback(() => goBack(fallback), [fallback, goBack]);
}
