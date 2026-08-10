import { lazy, Suspense } from "react";
import { Link, Navigate, Route, Routes } from "react-router-dom";
import { Brand } from "./components/ui";
import { RequireAuth } from "./components/auth/RequireAuth";
import { useSession } from "./lib/session";
import { AdminLoginPage, ParticipantLoginPage } from "./features/auth";
import { DashboardPage } from "./features/admin/dashboard/DashboardPage";
import {
  ExamDetailsPage,
  ExamEditorPage,
  ExamsPage,
} from "./features/admin/exams";
import { LeaderboardPage } from "./features/admin/leaderboard/LeaderboardPage";
import { MonitoringPage } from "./features/admin/monitoring/MonitoringPage";
import { ReviewDetailPage, ReviewsPage } from "./features/admin/reviews";
import { StudentsPage } from "./features/admin/students/StudentsPage";
import {
  DisqualifiedPage,
  ExamAttemptPage,
  ExamOverviewPage,
  SessionConflictPage,
  StudentHomePage,
  WaitingReviewPage,
} from "./features/student";

const ResultPage = lazy(() =>
  import("./features/student/result/ResultPage").then((module) => ({
    default: module.ResultPage,
  })),
);

function ResultPageFallback() {
  return (
    <div className="result-page">
      <main
        className="result-content result-loading-state"
        aria-live="polite"
      >
        <span className="result-loading-fallback" aria-hidden="true" />
        <p>Menyiapkan halaman hasil...</p>
      </main>
    </div>
  );
}

function NotFoundPage() {
  return (
    <div className="not-found">
      <Brand />
      <h1>404</h1>
      <h2>Halaman tidak ditemukan</h2>
      <p>Sepertinya kamu tersesat di luar ruang ujian.</p>
      <Link to="/" className="button primary">
        Kembali ke awal
      </Link>
    </div>
  );
}

function LoginEntry({ children }: { children: React.ReactNode }) {
  const session = useSession();
  if (session?.role === "student") {
    return <Navigate to="/student" replace />;
  }
  if (session && ["admin", "super_admin"].includes(session.role)) {
    return <Navigate to="/admin" replace />;
  }
  return children;
}

export default function App() {
  const admin = (element: React.ReactNode) => <RequireAuth role="admin">{element}</RequireAuth>;
  const student = (element: React.ReactNode) => <RequireAuth role="student">{element}</RequireAuth>;
  return (
    <Routes>
      <Route path="/" element={<LoginEntry><ParticipantLoginPage /></LoginEntry>} />
      <Route path="/admin/login" element={<LoginEntry><AdminLoginPage /></LoginEntry>} />
      <Route path="/admin" element={admin(<DashboardPage />)} />
      <Route path="/admin/students" element={admin(<StudentsPage />)} />
      <Route path="/admin/exams" element={admin(<ExamsPage />)} />
      <Route path="/admin/exams/new" element={admin(<ExamEditorPage />)} />
      <Route path="/admin/exams/:id/edit" element={admin(<ExamEditorPage />)} />
      <Route path="/admin/exams/:id" element={admin(<ExamDetailsPage />)} />
      <Route path="/admin/monitoring" element={admin(<MonitoringPage />)} />
      <Route path="/admin/reviews" element={admin(<ReviewsPage />)} />
      <Route path="/admin/reviews/:id" element={admin(<ReviewDetailPage />)} />
      <Route path="/admin/leaderboard" element={admin(<LeaderboardPage />)} />
      <Route path="/student" element={student(<StudentHomePage />)} />
      <Route path="/student/exam/:id" element={student(<ExamOverviewPage />)} />
      <Route path="/student/exam/:id/attempt" element={student(<ExamAttemptPage />)} />
      <Route
        path="/student/result/:id"
        element={student(
          <Suspense fallback={<ResultPageFallback />}>
            <ResultPage />
          </Suspense>,
        )}
      />
      <Route
        path="/student/status/waiting-review"
        element={student(<WaitingReviewPage />)}
      />
      <Route
        path="/student/status/disqualified"
        element={student(<DisqualifiedPage />)}
      />
      <Route
        path="/student/status/session-conflict"
        element={student(<SessionConflictPage />)}
      />
      <Route path="/404" element={<NotFoundPage />} />
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
  );
}
