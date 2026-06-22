"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";

import { authApi, type SessionUser } from "@/lib/auth-api";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  user: SessionUser | null;
  status: AuthStatus;
  /** Call after a successful login to update session state without re-fetching. */
  login: (user: SessionUser) => void;
  /** Re-fetches the session from the server (e.g. after first-login password reset). */
  refreshSession: () => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

// Routes where a valid session should redirect the user away to the app.
const AUTH_ROUTES = new Set(["/", "/login", "/signup"]);

// Returns true for routes that are publicly accessible without a session.
function isPublicRoute(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/verify-email") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/first-login")
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<SessionUser | null>(null);
  const fetched = useRef(false);

  // Resolve session once on mount.
  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;

    authApi
      .me()
      .then((u) => {
        setUser(u);
        setStatus("authenticated");
      })
      .catch(() => {
        setStatus("unauthenticated");
      });
  }, []);

  // Apply redirect rules whenever session state or route changes.
  useEffect(() => {
    if (status === "loading") return;

    if (status === "authenticated" && user) {
      // must-reset gating: Admin-provisioned users must set a password first.
      // HTTP-only cookie per TRD auth section.
      if (user.mustResetPassword && !pathname.startsWith("/first-login")) {
        router.replace("/first-login/reset-password");
        return;
      }
      // Push authenticated users away from auth/splash pages to the app.
      if (AUTH_ROUTES.has(pathname)) {
        router.replace("/dashboard");
        return;
      }
    }

    if (status === "unauthenticated") {
      // "/" is public but has no content for unauthenticated users.
      if (pathname === "/") {
        router.replace("/login");
        return;
      }
      // Protected routes: remember destination for post-login redirect.
      if (!isPublicRoute(pathname)) {
        const params = new URLSearchParams({ redirect: pathname });
        router.replace(`/login?${params.toString()}`);
      }
    }
  }, [status, user, pathname, router]);

  const login = useCallback((u: SessionUser) => {
    setUser(u);
    setStatus("authenticated");
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const u = await authApi.me();
      setUser(u);
      setStatus("authenticated");
    } catch {
      setUser(null);
      setStatus("unauthenticated");
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setStatus("unauthenticated");
    router.replace("/login");
    void authApi.logout().catch(() => {});
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, status, login, refreshSession, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
