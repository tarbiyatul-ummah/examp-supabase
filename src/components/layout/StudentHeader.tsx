import { ChevronDown, Home, LogOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Avatar, Brand } from "../ui";
import { authRepository } from "../../repositories";

export function StudentHeader({ minimal = false }: { minimal?: boolean }) {
  const currentStudent = authRepository.session()?.profile || { id: "student", name: "Peserta", shortName: "Peserta", role: "Peserta", className: "" };
  const navigate = useNavigate();
  const accountRef = useRef<HTMLDivElement>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (!accountOpen) return;
    const closeOutside = (event: MouseEvent) => {
      if (!accountRef.current?.contains(event.target as Node)) {
        setAccountOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAccountOpen(false);
    };
    document.addEventListener("mousedown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [accountOpen]);

  const logout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await authRepository.logout();
    } finally {
      navigate("/", { replace: true });
    }
  };

  return (
    <header className={`student-header ${minimal ? "minimal" : ""}`}>
      <Brand />
      {!minimal && (
        <nav>
          <Link to="/student" className="active">
            <Home /> Beranda
          </Link>
          <div className="student-profile-wrap" ref={accountRef}>
            <button
              type="button"
              className={`student-profile-trigger ${accountOpen ? "open" : ""}`}
              aria-haspopup="menu"
              aria-expanded={accountOpen}
              onClick={() => setAccountOpen((open) => !open)}
            >
              <Avatar name={currentStudent.name} size="sm" />
              <span>
                <strong>{currentStudent.shortName}</strong>
                <small>{currentStudent.className}</small>
              </span>
              <ChevronDown />
            </button>
            {accountOpen && (
              <div className="student-profile-menu" role="menu">
                <div className="student-profile-account">
                  <Avatar name={currentStudent.name} />
                  <div>
                    <strong>{currentStudent.name}</strong>
                    <small>
                      {currentStudent.className || currentStudent.role}
                    </small>
                  </div>
                </div>
                <button
                  type="button"
                  role="menuitem"
                  disabled={loggingOut}
                  onClick={() => void logout()}
                >
                  <LogOut />
                  {loggingOut ? "Sedang keluar..." : "Keluar dari akun"}
                </button>
              </div>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
