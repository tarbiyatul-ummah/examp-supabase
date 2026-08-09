import {
  ArrowRight,
  Check,
  ChevronLeft,
  Cloud,
  Clock3,
  Flag,
  ListChecks,
  MoreHorizontal,
  RefreshCw,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Brand, QuestionContent } from "../../../components/ui";
import type { ApiAttempt, ApiQuestion } from "../../../domain/api";
import { ApiError } from "../../../lib/api";
import { examRepository } from "../../../repositories";
import { documentText } from "../../../repositories/mappers";
import { ConnectionOverlay } from "./ConnectionOverlay";
import { SubmitExamModal } from "./SubmitExamModal";

type AttemptQuestion = {
  id: string;
  type: "Pilihan ganda" | "Isian angka" | "Isian pendek" | "Isian panjang";
  weight: number;
  contentDoc: Record<string, unknown>;
  options: Array<{ id: string; text: string }>;
};
type LocalAnswer = {
  value: string;
  selectedOptionId?: string;
  version: number;
};

const questionTypes: Record<ApiQuestion["type"], AttemptQuestion["type"]> = {
  multiple_choice: "Pilihan ganda",
  numeric: "Isian angka",
  short_text: "Isian pendek",
  long_text: "Isian panjang",
};

function toQuestions(attempt: ApiAttempt): AttemptQuestion[] {
  return [...(attempt.questions || [])]
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .flatMap((item) => {
      if (!item.question) return [];
      return [
        {
          id: item.questionId,
          type: questionTypes[item.question.type],
          weight: item.question.weight,
          contentDoc: item.question.contentDoc,
          options: (item.question.options || []).map((option) => ({
            id: option.id,
            text: documentText(option.contentDoc),
          })),
        },
      ];
    });
}

function toAnswers(attempt: ApiAttempt): Record<string, LocalAnswer> {
  return Object.fromEntries(
    (attempt.answers || []).map((answer) => [
      answer.questionId,
      {
        value: answer.selectedOptionId || answer.textRaw || "",
        selectedOptionId: answer.selectedOptionId,
        version: answer.version,
      },
    ]),
  );
}

export function ExamAttemptPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [attempt, setAttempt] = useState<ApiAttempt | null>(null);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, LocalAnswer>>({});
  const answersRef = useRef(answers);
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const saveRequests = useRef<Partial<Record<string, Promise<boolean>>>>({});
  const [remaining, setRemaining] = useState(0);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">(
    "saved",
  );
  const [showNavigator, setShowNavigator] = useState(false);
  const [showSubmit, setShowSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [offline, setOffline] = useState(!navigator.onLine);
  const [reconnecting, setReconnecting] = useState(false);
  const [error, setError] = useState("");
  const examQuestions = useMemo(
    () => (attempt ? toQuestions(attempt) : []),
    [attempt],
  );
  const question = examQuestions[current];

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const started = await examRepository.startAttempt(id);
        const snapshot = await examRepository.attempt(started.id);
        if (cancelled) return;
        if (snapshot.status === "disqualified")
          return navigate("/student/status/disqualified", { replace: true });
        if (["submitted", "time_expired"].includes(snapshot.status))
          return navigate(`/student/result/${snapshot.id}`, { replace: true });
        setAttempt(snapshot);
        setAnswers(toAnswers(snapshot));
        setRemaining(snapshot.remainingSeconds);
      } catch (cause) {
        setError(
          cause instanceof ApiError
            ? cause.message
            : "Gagal membuka attempt ujian.",
        );
      }
    })();
    return () => {
      cancelled = true;
      Object.values(saveTimers.current).forEach(clearTimeout);
    };
  }, [id, navigate]);

  useEffect(() => {
    const timer = setInterval(
      () => setRemaining((value) => (offline ? value : Math.max(0, value - 1))),
      1000,
    );
    return () => clearInterval(timer);
  }, [offline]);

  useEffect(() => {
    if (!attempt) return;
    const sync = async () => {
      try {
        const state = await examRepository.heartbeat(attempt.id);
        setRemaining(state.remainingSeconds);
        setOffline(false);
        if (state.status === "disqualified")
          navigate("/student/status/disqualified", { replace: true });
        if (state.status === "time_expired")
          navigate(`/student/result/${attempt.id}`, { replace: true });
      } catch {
        setOffline(true);
      }
    };
    const timer = setInterval(sync, 10_000);
    const online = () => void sync();
    const offlineHandler = () => setOffline(true);
    window.addEventListener("online", online);
    window.addEventListener("offline", offlineHandler);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offlineHandler);
    };
  }, [attempt, navigate]);

  const persistAnswer = async (questionId: string): Promise<boolean> => {
    if (!attempt) return false;
    if (saveRequests.current[questionId]) {
      return saveRequests.current[questionId];
    }
    const local = answersRef.current[questionId];
    if (!local) return true;
    const request = (async () => {
      try {
        const multipleChoice =
          examQuestions.find((item) => item.id === questionId)?.type ===
          "Pilihan ganda";
        const saved = await examRepository.saveAnswer(attempt.id, questionId, {
          selectedOptionId: multipleChoice ? local.selectedOptionId : null,
          textRaw: multipleChoice ? null : local.value,
          version: local.version,
        });
        const updated = {
          ...answersRef.current,
          [questionId]: {
            ...answersRef.current[questionId],
            version: saved.version,
          },
        };
        answersRef.current = updated;
        setAnswers(updated);
        setSaveState("saved");
        return true;
      } catch {
        setSaveState("error");
        return false;
      }
    })();
    saveRequests.current[questionId] = request;
    try {
      return await request;
    } finally {
      if (saveRequests.current[questionId] === request) {
        delete saveRequests.current[questionId];
      }
    }
  };

  const answerQuestion = (value: string, selectedOptionId?: string) => {
    if (!question) return;
    const next = {
      value,
      selectedOptionId,
      version: answersRef.current[question.id]?.version || 0,
    };
    answersRef.current = { ...answersRef.current, [question.id]: next };
    setAnswers(answersRef.current);
    setSaveState("saving");
    clearTimeout(saveTimers.current[question.id]);
    saveTimers.current[question.id] = setTimeout(
      () => {
        delete saveTimers.current[question.id];
        void persistAnswer(question.id);
      },
      selectedOptionId ? 0 : 500,
    );
  };

  const reconnect = async () => {
    if (!attempt) return;
    setReconnecting(true);
    try {
      const state = await examRepository.heartbeat(attempt.id);
      setRemaining(state.remainingSeconds);
      setOffline(false);
    } finally {
      setReconnecting(false);
    }
  };
  const submit = async () => {
    if (!attempt || submitting) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      Object.values(saveTimers.current).forEach(clearTimeout);
      saveTimers.current = {};

      await Promise.all(Object.values(saveRequests.current));

      const saveResults = await Promise.all(
        Object.keys(answersRef.current).map(persistAnswer),
      );
      if (saveResults.some((saved) => !saved)) {
        throw new Error(
          "Sebagian jawaban belum tersimpan. Periksa koneksi lalu coba kumpulkan lagi.",
        );
      }

      const completed = await examRepository.submit(attempt.id);
      setShowSubmit(false);
      navigate(
        completed.gradingStatus === "pending_review"
          ? "/student/status/waiting-review"
          : `/student/result/${completed.id}`,
        { replace: true },
      );
    } catch (cause) {
      setSubmitError(
        cause instanceof ApiError || cause instanceof Error
          ? cause.message
          : "Ujian belum berhasil dikumpulkan. Silakan coba lagi.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (error)
    return (
      <div className="attempt-page">
        <main className="attempt-main">
          <section className="question-area">
            <h1>{error}</h1>
            <button
              className="button primary"
              onClick={() => navigate("/student")}
            >
              Kembali
            </button>
          </section>
        </main>
      </div>
    );
  if (!attempt || !question)
    return (
      <div className="attempt-page">
        <header className="attempt-header">
          <Brand />
        </header>
        <main className="attempt-main">
          <section className="question-area">
            <h1>Menyiapkan ujian...</h1>
          </section>
        </main>
      </div>
    );
  const currentAnswer = answers[question.id];
  const time = `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`;
  return (
    <div className="attempt-page">
      <header className="attempt-header">
        <Brand />
        <div className="attempt-progress-head">
          <span>
            Soal {current + 1} dari {examQuestions.length}
          </span>
          <div>
            <i
              style={{
                width: `${((current + 1) / examQuestions.length) * 100}%`,
              }}
            />
          </div>
        </div>
        <div className="timer-box">
          <Clock3 />
          <span>
            <small>Sisa waktu</small>
            <strong>{time}</strong>
          </span>
        </div>
        <button className="attempt-menu" onClick={() => setShowNavigator(true)}>
          <MoreHorizontal />
        </button>
      </header>
      <main className="attempt-main">
        <section className="question-area">
          <div className="question-meta">
            <span>{question.type.toUpperCase()}</span>
            <strong>{question.weight} POIN</strong>
          </div>
          <QuestionContent document={question.contentDoc} />
          {question.type === "Pilihan ganda" ? (
            <div className="answer-options">
              {question.options.map((option, index) => (
                <button
                  className={
                    currentAnswer?.selectedOptionId === option.id
                      ? "selected"
                      : ""
                  }
                  key={option.id}
                  onClick={() => answerQuestion(option.id, option.id)}
                >
                  <span>
                    {currentAnswer?.selectedOptionId === option.id ? (
                      <Check />
                    ) : (
                      String.fromCharCode(65 + index)
                    )}
                  </span>
                  <strong>{option.text}</strong>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-answer">
              <label>Jawabanmu</label>
              {question.type === "Isian panjang" ? (
                <textarea
                  rows={7}
                  placeholder="Tulis jawaban lengkapmu di sini..."
                  value={currentAnswer?.value || ""}
                  onChange={(event) => answerQuestion(event.target.value)}
                />
              ) : (
                <input
                  type={question.type === "Isian angka" ? "number" : "text"}
                  placeholder="Ketik jawaban di sini..."
                  value={currentAnswer?.value || ""}
                  onChange={(event) => answerQuestion(event.target.value)}
                />
              )}
            </div>
          )}
          <div className="save-state">
            {saveState === "saving" ? (
              <>
                <RefreshCw className="spin" /> Menyimpan jawaban...
              </>
            ) : saveState === "error" ? (
              <>
                <RefreshCw /> Jawaban belum tersimpan. Coba ubah kembali.
              </>
            ) : (
              <>
                <Cloud />
                <Check /> Jawaban tersimpan
              </>
            )}
          </div>
        </section>
        <aside
          className={`question-navigator ${showNavigator ? "mobile-open" : ""}`}
        >
          <div className="nav-head">
            <div>
              <strong>Navigasi soal</strong>
              <small>
                {Object.keys(answers).length} dijawab ·{" "}
                {examQuestions.length - Object.keys(answers).length} belum
              </small>
            </div>
            <button
              className="mobile-close"
              onClick={() => setShowNavigator(false)}
            >
              <X />
            </button>
          </div>
          <div className="question-number-grid">
            {examQuestions.map((item, index) => (
              <button
                key={item.id}
                className={`${index === current ? "current" : ""} ${answers[item.id] !== undefined ? "answered" : ""}`}
                onClick={() => {
                  setCurrent(index);
                  setShowNavigator(false);
                }}
              >
                {answers[item.id] !== undefined && index !== current ? (
                  <Check />
                ) : (
                  index + 1
                )}
              </button>
            ))}
          </div>
          <div className="nav-legend">
            <span>
              <i className="current" />
              Saat ini
            </span>
            <span>
              <i className="answered" />
              Dijawab
            </span>
            <span>
              <i />
              Belum
            </span>
          </div>
          <button
            className="button secondary full"
            onClick={() => setShowSubmit(true)}
          >
            <Flag /> Selesai ujian
          </button>
        </aside>
      </main>
      <footer className="attempt-footer">
        <button
          className="button secondary"
          disabled={current === 0}
          onClick={() => setCurrent(current - 1)}
        >
          <ChevronLeft /> Sebelumnya
        </button>
        <button
          className="mobile-navigator"
          onClick={() => setShowNavigator(true)}
        >
          <ListChecks /> {current + 1}/{examQuestions.length}
        </button>
        {current < examQuestions.length - 1 ? (
          <button
            className="button primary"
            onClick={() => setCurrent(current + 1)}
          >
            Lanjut <ArrowRight />
          </button>
        ) : (
          <button
            className="button primary"
            onClick={() => setShowSubmit(true)}
          >
            Selesai <Check />
          </button>
        )}
      </footer>
      {showSubmit && (
        <SubmitExamModal
          answered={Object.keys(answers).length}
          total={examQuestions.length}
          onClose={() => {
            setShowSubmit(false);
            setSubmitError("");
          }}
          onSubmit={submit}
          submitting={submitting}
          error={submitError}
        />
      )}
      {offline && (
        <ConnectionOverlay
          reconnecting={reconnecting}
          onReconnect={() => void reconnect()}
        />
      )}
    </div>
  );
}
