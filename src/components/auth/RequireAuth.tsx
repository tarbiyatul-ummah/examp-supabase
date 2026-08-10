import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { type AuthRole, useSession } from "../../lib/session";

export function RequireAuth({
  role,
  children,
}: {
  role: "admin" | "student";
  children: ReactNode;
}) {
  const location = useLocation();
  const session = useSession();
  const matches =
    session &&
    (role === "student"
      ? session.role === "student"
      : (["admin", "super_admin"] as AuthRole[]).includes(session.role));
  if (!matches) {
    return (
      <Navigate
        to={role === "admin" ? "/admin/login" : "/"}
        state={{ from: location.pathname }}
        replace
      />
    );
  }
  return children;
}
