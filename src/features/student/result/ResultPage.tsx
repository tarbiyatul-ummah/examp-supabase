import {
  Check,
  ChevronDown,
  Circle,
  Clock3,
  Home,
  ListChecks,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { StudentHeader } from "../../../components/layout";
import { documentText } from "../../../repositories/mappers";
import type { ApiAttempt } from "../../../domain/api";
import type { Exam } from "../../../domain/models";
import { authRepository, examRepository } from "../../../repositories";

const SCORE_RADIUS = 52;
const SCORE_CIRCUMFERENCE = 2 * Math.PI * SCORE_RADIUS;

function AnimatedScoreRing({ score }: { score: number }) {
  const target = Math.min(100, Math.max(0, score));
  const [displayedScore, setDisplayedScore] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplayedScore(target);
      return;
    }

    setDisplayedScore(0);
    let animationFrame = 0;
    let startedAt: number | null = null;
    const animate = (timestamp: number) => {
      startedAt ??= timestamp;
      const progress = Math.min(1, (timestamp - startedAt) / 1400);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayedScore(target * eased);
      if (progress < 1) animationFrame = requestAnimationFrame(animate);
    };
    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [target]);

  const label = Number.isInteger(target)
    ? String(Math.round(displayedScore))
    : displayedScore.toFixed(2);
  const dashOffset = SCORE_CIRCUMFERENCE * (1 - displayedScore / 100);

  return (
    <div
      className="score-ring"
      role="meter"
      aria-label={`Nilai ${score} dari 100`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={score}
    >
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r={SCORE_RADIUS} />
        <circle
          className="score"
          cx="60"
          cy="60"
          r={SCORE_RADIUS}
          style={{
            strokeDasharray: SCORE_CIRCUMFERENCE,
            strokeDashoffset: dashOffset,
          }}
        />
      </svg>
      <div>
        <strong>{label}</strong>
        <span>/ 100</span>
      </div>
    </div>
  );
}

function ResultLoadingState() {
  return (
    <main className="result-content result-loading-state" aria-live="polite">
      <div className="result-loading-animation" aria-hidden="true">
        <span className="result-loading-fallback" />
      </div>
      <h1>Menyiapkan hasil ujianmu</h1>
      <p>Nilai dan detail jawaban sedang diambil dari server.</p>
    </main>
  );
}

export function ResultPage() {
  const { id } = useParams();
  const [result, setResult] = useState<ApiAttempt | null>(null);
  const [exam, setExam] = useState<Exam | null>(null);
  const [error, setError] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(true);
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
        <ResultLoadingState />
      </div>
    );
  const released = typeof result.score === "number";
  const hasAnswer = (answer: NonNullable<ApiAttempt["answers"]>[number]) =>
    Boolean(answer.selectedOptionId || answer.textRaw?.trim());
  const answers = result.answers || [];
  const answered = answers.filter(hasAnswer).length;
  const correct = answers.filter(
    (answer) => hasAnswer(answer) && answer.verdict === "correct",
  ).length;
  const incorrect = answers.filter(
    (answer) => hasAnswer(answer) && answer.verdict === "incorrect",
  ).length;
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
              <AnimatedScoreRing score={result.score!} />
              <span className="score-message">Nilai dihitung oleh server.</span>
            </>
          ) : (
            <span className="manual-release-meta">
              Hasil akan terlihat setelah koreksi diterbitkan admin.
            </span>
          )}
        </section>
        <section className={`result-summary ${released ? "released" : ""}`}>
          {released ? (
            <>
              <div>
                <span className="green">
                  <Check />
                </span>
                <p>
                  <strong>{correct}</strong>
                  <small>Jawaban benar</small>
                </p>
              </div>
              <div>
                <span className="orange">
                  <X />
                </span>
                <p>
                  <strong>{incorrect}</strong>
                  <small>Jawaban salah</small>
                </p>
              </div>
            </>
          ) : (
            <div>
              <span className="green">
                <Check />
              </span>
              <p>
                <strong>{answered}</strong>
                <small>Sudah dijawab</small>
              </p>
            </div>
          )}
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
        <section className="result-details">
          <button
            type="button"
            className="result-details-head"
            aria-expanded={detailsOpen}
            onClick={() => setDetailsOpen((open) => !open)}
          >
            <div>
              <span>
                <ListChecks />
              </span>
              <div>
                <h2>Detail pengerjaan attempt {result.attemptNo}</h2>
                <p>Lihat jawaban dan hasil penilaian setiap soal.</p>
              </div>
            </div>
            <ChevronDown className={detailsOpen ? "rotated" : ""} />
          </button>
          {detailsOpen && (
            <div className="result-answer-list">
              {(result.questions || []).map((item, index) => {
                const answer = (result.answers || []).find(
                  (candidate) => candidate.questionId === item.questionId,
                );
                const option = item.question?.options?.find(
                  (candidate) => candidate.id === answer?.selectedOptionId,
                );
                const answerText = option
                  ? documentText(option.contentDoc)
                  : answer?.textRaw?.trim() || "Tidak dijawab";
                const verdict = answer?.verdict;
                const answeredQuestion = answer ? hasAnswer(answer) : false;
                return (
                  <div key={item.questionId}>
                    <span
                      className={
                        !answeredQuestion
                          ? "gray"
                          : verdict === "correct"
                          ? "green"
                          : verdict === "incorrect"
                            ? "orange"
                            : "gray"
                      }
                    >
                      {!answeredQuestion ? (
                        <Circle />
                      ) : verdict === "correct" ? (
                        <Check />
                      ) : verdict === "incorrect" ? (
                        <X />
                      ) : (
                        <Circle />
                      )}
                    </span>
                    <p>
                      <strong>
                        Soal {index + 1} ·{" "}
                        {documentText(item.question?.contentDoc || {}) ||
                          "Pertanyaan"}
                      </strong>
                      <small>
                        Jawabanmu: {answerText} ·{" "}
                        {!answeredQuestion
                          ? "Tidak dijawab"
                          : verdict === "correct"
                          ? "Benar"
                          : verdict === "incorrect"
                            ? "Salah"
                            : "Menunggu koreksi"}
                      </small>
                    </p>
                  </div>
                );
              })}
            </div>
          )}
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
