import { useCallback, useEffect, useMemo, useState } from "react";

import { api, tokenStore } from "@/api/client";
import { AuthContext } from "@/auth/context";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On first load, a stored token is only trusted after /auth/me confirms it.
  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      if (!tokenStore.access) {
        setLoading(false);
        return;
      }
      try {
        const { data } = await api.get("/auth/me");
        if (!cancelled) setUser(data.data);
      } catch {
        tokenStore.clear();
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    restoreSession();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    tokenStore.save(data.data);
    setUser(data.data.user);
    return data.data.user;
  }, []);

  const loginWithSSO = useCallback(async (code, state) => {
    const { data } = await api.post("/auth/sso/google/callback", { code, state });
    tokenStore.save(data.data);
    setUser(data.data.user);
    return data.data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // Already invalid server-side; clearing locally is enough.
    }
    tokenStore.clear();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      loginWithSSO,
      logout,
      isAuthor: user?.role === "ADMIN" || user?.role === "INSTRUCTOR",
      isAdmin: user?.role === "ADMIN",
    }),
    [user, loading, login, loginWithSSO, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
