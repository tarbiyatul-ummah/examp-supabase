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
  return localStorage.getItem(SESSION_KEY) ? localStorage : sessionStorage;
}

export function getSession(): AuthSession | null {
  const raw =
    localStorage.getItem(SESSION_KEY) ?? sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    clearSession();
    return null;
  }
}

export function saveSession(session: AuthSession, remember = false) {
  clearSession();
  (remember ? localStorage : sessionStorage).setItem(
    SESSION_KEY,
    JSON.stringify(session),
  );
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
