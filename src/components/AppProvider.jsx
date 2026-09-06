"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api, isUpgradeError, ERROR_TITLES } from "@/lib/api";
import { Toasts } from "./ui";
import UpgradeModal from "./UpgradeModal";

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = loading, null = signed out
  const [subscription, setSubscription] = useState(null);
  const [usage, setUsage] = useState(null);
  const [plans, setPlans] = useState(null);
  const [system, setSystem] = useState(null);
  const [upgrade, setUpgrade] = useState(null); // { reason, requiredPlan, feature }
  const [toasts, setToasts] = useState([]);
  const toastId = useRef(0);

  const refresh = useCallback(async () => {
    try {
      const me = await api("/api/auth/me");
      setUser(me.user);
      setSubscription(me.subscription);
      setUsage(me.usage);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refresh();
    api("/api/plans").then(setPlans).catch(() => {});
    api("/api/system").then(setSystem).catch(() => {});
  }, [refresh]);

  useEffect(() => {
    const theme = user?.preferences?.theme || "dark";
    document.documentElement.dataset.theme = theme === "light" ? "light" : "dark";
  }, [user]);

  const toast = useCallback((message, kind = "info", title) => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, message, kind, title }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);
  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const openUpgrade = useCallback((opts = {}) => setUpgrade({ ...opts }), []);
  const closeUpgrade = useCallback(() => setUpgrade(null), []);

  // Centralized error UX: upgrade-type errors open the upgrade modal; others toast.
  const handleError = useCallback(
    (err) => {
      if (isUpgradeError(err)) {
        openUpgrade({ reason: err.message, requiredPlan: err.body?.requiredPlan || "PRO", feature: err.body?.feature || err.body?.type, code: err.body?.code || err.code });
        return;
      }
      toast(err?.message || "Something went wrong.", "error", ERROR_TITLES[err?.code] || (err?.status === 401 ? "Please sign in" : "Error"));
    },
    [openUpgrade, toast]
  );

  const logout = useCallback(async () => {
    await api("/api/auth/logout", { method: "POST" });
    setUser(null);
    setSubscription(null);
    setUsage(null);
    window.location.href = "/";
  }, []);

  const plan = String(subscription?.plan || "FREE").toUpperCase();
  const planConfig = plans?.plans?.[plan] || subscription?.planConfig || null;

  const value = useMemo(
    () => ({ user, setUser, subscription, usage, setUsage, plans, plan, planConfig, system, refresh, openUpgrade, closeUpgrade, toast, handleError, logout }),
    [user, subscription, usage, plans, plan, planConfig, system, refresh, openUpgrade, closeUpgrade, toast, handleError, logout]
  );

  return (
    <AppContext.Provider value={value}>
      {children}
      <UpgradeModal open={Boolean(upgrade)} onClose={closeUpgrade} context={upgrade} />
      <Toasts toasts={toasts} dismiss={dismiss} />
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
