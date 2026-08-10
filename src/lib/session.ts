import { useEffect, useState } from "react";
import type { ApiStudent, TokenPair } from "../domain/api";
import type { UserProfile } from "../domain/models";

export type AuthRole = "admin" | "super_admin" | "student";

export type AuthSession = {
  role: AuthRole;
  tokens: TokenPair;
  profile: UserProfile;
  student?: ApiStudent;
};

const SESSION_KEY = "ruanguji.session";

function storageForSession() {
  return localStorage;
}

export function getSession(): AuthSession | null {
  const persistent = localStorage.getItem(SESSION_KEY);
  const transient = sessionStorage.getItem(SESSION_KEY);
  const raw = persistent ?? transient;
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as AuthSession;
    if (!persistent && transient) {
      localStorage.setItem(SESSION_KEY, transient);
      sessionStorage.removeItem(SESSION_KEY);
    }
    return session;
  } catch {
    clearSession();
    return null;
  }
}

export function saveSession(session: AuthSession) {
  clearSession();
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  window.dispatchEvent(new Event("ruanguji:session"));
}

export function updateTokens(tokens: TokenPair) {
  const session = getSession();
  if (!session) return;
  session.tokens = tokens;
  storageForSession().setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new Event("ruanguji:session"));
}

export function useSession() {
  const [session, setSession] = useState<AuthSession | null>(() => getSession());

  useEffect(() => {
    const refresh = () => setSession(getSession());
    window.addEventListener("ruanguji:session", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("ruanguji:session", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return session;
}
