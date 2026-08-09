import {
  ArrowRight,
  CalendarDays,
  ClipboardCheck,
  Clock3,
  Divide,
  FileText,
  History,
  ListChecks,
  Plus,
  Quote,
  Sigma,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { StudentHeader } from "../../../components/layout";
import { Brand } from "../../../components/ui";
import type { Exam } from "../../../domain/models";
import type { ApiAttemptHistory } from "../../../domain/api";
import { appConfig } from "../../../config/appConfig";
import { authRepository, examRepository } from "../../../repositories";

export function StudentHomePage() {
  const currentStudent = authRepository.session()?.profile || {
    shortName: "Peserta",
  };
  const [exams, setExams] = useState<Exam[]>([]);
  const [history, setHistory] = useState<ApiAttemptHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    Promise.all([
      examRepository.studentExams(),
      examRepository.attemptHistory(),
    ])
      .then(([examItems, historyItems]) => {
        setExams(examItems);
        setHistory(historyItems);
      })
      .catch((cause: Error) => setError(cause.message))
      .finally(() => setLoading(false));
  }, []);
  return (
    <div className="student-app">
      <StudentHeader />
      <main className="student-home-content">
        <section className="welcome-banner">
          <div>
            <p>SELAMAT DATANG KEMBALI</p>
            <h1>Hai, {currentStudent.shortName}! Siap belajar hari ini? 👋</h1>
            <span>Kamu punya {exams.length} ujian yang tersedia.</span>
          </div>
          <div className="welcome-art">
            ✏️<span>📚</span>
            <i>★</i>
          </div>
        </section>
        <div className="student-section-title">
          <div>
            <h2>Ujianmu</h2>
            <p>Pilih ujian untuk melihat detail dan mulai mengerjakan.</p>
          </div>
          <span>{exams.length} ujian</span>
        </div>
        {loading && (
          <section className="panel">
            <p>Memuat ujianmu...</p>
          </section>
        )}
        {error && (
          <section className="panel">
            <p>{error}</p>
          </section>
        )}
        <div className="student-exam-grid">
          {exams.map((exam) => {
            const manual = exam.mode === "Koreksi admin";
            return (
              <article className="student-exam-card" key={exam.id}>
                <div
                  className={`student-exam-cover ${manual ? "orange-cover" : "purple-cover"}`}
                >
                  <span className="date-badge">
                    <CalendarDays /> Tersedia sekarang
                  </span>
                  <div className="cover-symbol" aria-hidden="true">
                    {manual ? <FileText /> : <Sigma />}
                  </div>
                  <div className="cover-dots" aria-hidden="true">
                    {manual ? (
                      <Quote />
                    ) : (
                      <>
                        <Divide />
                        <X />
                        <Plus />
                      </>
                    )}
                  </div>
                </div>
                <div className="student-exam-body">
                  <p>{exam.subject.toUpperCase()}</p>
                  <h3>{exam.shortTitle}</h3>
                  <div className="student-exam-meta">
                    <span>
                      <Clock3 />
                      {exam.duration} menit
                    </span>
                    <span>
                      <ListChecks />
                      {exam.questions} soal
                    </span>
                  </div>
                  {manual && (
                    <div className="mode-student-note">
                      <ClipboardCheck />
                      <span>
                        <strong>{exam.mode}</strong>
                        <small>Nilai tampil setelah diperiksa</small>
                      </span>
                    </div>
                  )}
                  <Link
                    to={`/student/exam/${exam.id}`}
                    className="button secondary full"
                  >
                    Lihat detail <ArrowRight />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
        {!loading && !error && exams.length === 0 && (
          <section className="panel">
            <p>Belum ada ujian yang ditugaskan untukmu.</p>
          </section>
        )}
        {!loading && !error && history.length > 0 && (
          <section className="student-history-section">
            <div className="student-section-title">
              <div>
                <h2>Histori pengerjaan</h2>
                <p>Nilai dan detail jawaban dari setiap attempt yang selesai.</p>
              </div>
              <span>{history.length} attempt</span>
            </div>
            <div className="past-exams">
              {history.map((attempt) => (
                <article className="past-exam-row" key={attempt.id}>
                  <span className="past-icon purple">
                    <History />
                  </span>
                  <div>
                    <strong>{attempt.examName}</strong>
                    <small>
                      Attempt {attempt.attemptNo} ·{" "}
                      {new Intl.DateTimeFormat("id-ID", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(attempt.submittedAt))}
                    </small>
                  </div>
                  <span className="score-pill">
                    {typeof attempt.score === "number"
                      ? attempt.score
                      : "Menunggu"}
                  </span>
                  <Link
                    to={`/student/result/${attempt.id}`}
                    aria-label={`Lihat hasil ${attempt.examName} attempt ${attempt.attemptNo}`}
                  >
                    <ArrowRight />
                  </Link>
                </article>
              ))}
            </div>
          </section>
        )}
        <section className="student-tip">
          <span>💡</span>
          <div>
            <strong>Tips sebelum mulai</strong>
            <p>
              Pastikan koneksi internetmu stabil. Waktumu dijeda otomatis jika
              koneksi terputus.
            </p>
          </div>
          <button>
            <X />
          </button>
        </section>
      </main>
      <footer className="student-footer">
        <Brand />
        <p>Belajar, berusaha, dan percaya pada dirimu.</p>
        <span>
          © {appConfig.year} {appConfig.name}
        </span>
      </footer>
    </div>
  );
}
