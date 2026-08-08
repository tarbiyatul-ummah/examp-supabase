import { Link, Navigate, Route, Routes } from "react-router-dom";
import { Brand } from "./components/ui";
import { RequireAuth } from "./components/auth/RequireAuth";
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
  ResultPage,
  SessionConflictPage,
  StudentHomePage,
  WaitingReviewPage,
} from "./features/student";

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

export default function App() {
  const admin = (element: React.ReactNode) => <RequireAuth role="admin">{element}</RequireAuth>;
  const student = (element: React.ReactNode) => <RequireAuth role="student">{element}</RequireAuth>;
  return (
    <Routes>
      <Route path="/" element={<ParticipantLoginPage />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />
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
      <Route path="/student/result/:id" element={student(<ResultPage />)} />
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
