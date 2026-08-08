import { Bell, ChevronDown, Home } from "lucide-react";
import { Link } from "react-router-dom";
import { Avatar, Brand } from "../ui";
import { authRepository } from "../../repositories";

export function StudentHeader({ minimal = false }: { minimal?: boolean }) {
  const currentStudent = authRepository.session()?.profile || { id: "student", name: "Peserta", shortName: "Peserta", role: "Peserta", className: "" };
  return (
    <header className={`student-header ${minimal ? "minimal" : ""}`}>
      <Brand />
      {!minimal && (
        <nav>
          <Link to="/student" className="active">
            <Home /> Beranda
          </Link>
          <button>
            <Bell />
            <i />
          </button>
          <div>
            <Avatar name={currentStudent.name} size="sm" />
            <span>
              <strong>{currentStudent.shortName}</strong>
              <small>{currentStudent.className}</small>
            </span>
            <ChevronDown />
          </div>
        </nav>
      )}
    </header>
  );
}
