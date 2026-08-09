import { Check, Circle, Clock3, Home } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { StudentHeader } from "../../../components/layout";
import type { ApiAttempt } from "../../../domain/api";
import type { Exam } from "../../../domain/models";
import { authRepository, examRepository } from "../../../repositories";

export function ResultPage() {
  const { id } = useParams();
  const [result, setResult] = useState<ApiAttempt | null>(null);
  const [exam, setExam] = useState<Exam | null>(null);
  const [error, setError] = useState("");
  const currentStudent = authRepository.session()?.profile || {
    shortName: "Peserta",
  };
  useEffect(() => {
    if (!id) return;
    Promise.all([examRepository.result(id), examRepository.studentExams()])
      .then(([attempt, exams]) => {
        setResult(attempt);
        setExam(
          exams.find((item) => String(item.id) === attempt.examId) || null,
        );
      })
      .catch((cause: Error) => setError(cause.message));
  }, [id]);
  if (error)
    return (
      <div className="result-page">
        <StudentHeader minimal />
        <main className="result-content">
          <section className="panel">
            <h2>{error}</h2>
            <Link to="/student" className="button primary">
              <Home /> Kembali
            </Link>
          </section>
        </main>
      </div>
    );
  if (!result)
    return (
      <div className="result-page">
        <StudentHeader minimal />
        <main className="result-content">
          <p>Memuat hasil...</p>
        </main>
      </div>
    );
  const released = typeof result.score === "number";
  const answered = result.answers?.length || 0;
  const total = result.questions?.length || answered;
  const duration = Math.max(0, result.activeElapsedSeconds);
  const durationText = `${Math.floor(duration / 60)}m ${duration % 60}d`;
  return (
    <div className="result-page">
      <StudentHeader minimal />
      <main className="result-content">
        <section className="result-hero">
          <span className="result-check">
            <Check />
          </span>
          <p>{released ? "UJIAN SELESAI" : "MENUNGGU HASIL"}</p>
          <h1>
            {released
              ? `Kerja bagus, ${currentStudent.shortName}! 🎉`
              : "Jawabanmu sudah tersimpan."}
          </h1>
          <small>{exam?.title || "Ujian"}</small>
          {released ? (
            <>
              <div className="score-ring">
                <svg viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="52" />
                  <circle className="score" cx="60" cy="60" r="52" />
                </svg>
                <div>
                  <strong>{result.score}</strong>
                  <span>/ 100</span>
                </div>
              </div>
              <span className="score-message">Nilai dihitung oleh server.</span>
            </>
          ) : (
            <span className="manual-release-meta">
              Hasil akan terlihat setelah koreksi diterbitkan admin.
            </span>
          )}
        </section>
        <section className="result-summary">
          <div>
            <span className="green">
              <Check />
            </span>
            <p>
              <strong>{answered}</strong>
              <small>Sudah dijawab</small>
            </p>
          </div>
          <div>
            <span className="gray">
              <Circle />
            </span>
            <p>
              <strong>{Math.max(0, total - answered)}</strong>
              <small>Tidak dijawab</small>
            </p>
          </div>
          <div>
            <span className="purple">
              <Clock3 />
            </span>
            <p>
              <strong>{durationText}</strong>
              <small>Durasi aktif</small>
            </p>
          </div>
        </section>
        <div className="result-actions">
          <Link to="/student" className="button primary">
            <Home /> Kembali ke beranda
          </Link>
        </div>
      </main>
    </div>
  );
}
