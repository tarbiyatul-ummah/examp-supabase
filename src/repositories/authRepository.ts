import type { ApiStudent, TokenPair } from "../domain/api";
import type { UserProfile } from "../domain/models";
import { envelope } from "../lib/api";
import {
  clearSession,
  getSession,
  saveSession,
  type AuthRole,
} from "../lib/session";

function jwtPayload(token: string): { sub?: string; role?: AuthRole } {
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(payload)) as { sub?: string; role?: AuthRole };
  } catch {
    return {};
  }
}

export const authRepository = {
  session: getSession,
  async loginAdmin(login: string, password: string, remember = false) {
    const { data: tokens } = await envelope<TokenPair>(
      "/v1/admin/auth/login",
      { method: "POST", body: JSON.stringify({ login, password }) },
      false,
    );
    const claims = jwtPayload(tokens.accessToken);
    const role = claims.role === "super_admin" ? "super_admin" : "admin";
    const displayName = login.includes("@") ? login.split("@")[0] : login;
    const profile: UserProfile = {
      id: claims.sub || "admin",
      name: displayName,
      shortName: displayName.split(/[._\s-]/)[0] || "Admin",
      role: role === "super_admin" ? "Super Admin" : "Administrator",
    };
    saveSession({ role, tokens, profile }, remember);
    return profile;
  },
  async loginStudent(code: string) {
    const { data } = await envelope<{
      student: ApiStudent;
      tokens: TokenPair;
    }>(
      "/v1/student/auth/login",
      { method: "POST", body: JSON.stringify({ code }) },
      false,
    );
    const profile: UserProfile = {
      id: data.student.id,
      name: data.student.name,
      shortName: data.student.name.split(" ")[0],
      role: "Peserta",
      className: `Kelas ${data.student.grade}`,
    };
    saveSession({
      role: "student",
      tokens: data.tokens,
      profile,
      student: data.student,
    });
    return profile;
  },
  async logout() {
    try {
      await envelope<void>("/v1/auth/logout", { method: "POST" });
    } finally {
      clearSession();
    }
  },
};
