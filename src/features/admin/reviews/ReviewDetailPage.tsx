import { ArrowLeft, Check, Circle, LockKeyhole, Send, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AdminShell } from "../../../components/layout";
import { StatusPill, Toast, ToastMessage } from "../../../components/ui";
import type { ApiAnswer, ApiAttempt } from "../../../domain/api";
import { examRepository } from "../../../repositories";
import { documentText } from "../../../repositories/mappers";

export function ReviewDetailPage() {
  const { id } = useParams();
  const [attempt, setAttempt] = useState<ApiAttempt | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [savingId, setSavingId] = useState("");
  useEffect(() => { if (id) examRepository.reviewDetail(id).then(setAttempt); }, [id]);
  const questions = useMemo(() => new Map((attempt?.questions || []).map(item => [item.questionId, item.question])), [attempt]);
  const answers = attempt?.answers || [];
  const reviewed = answers.filter(answer => answer.verdict).length;
  const correct = answers.filter(answer => answer.verdict === "correct").length;
  const review = async (answer: ApiAnswer, verdict: "correct" | "incorrect") => {
    setSavingId(answer.id);
    try {
      const saved = await examRepository.reviewAnswer(answer.id, verdict, answer.reviewRevision || 0);
      setAttempt(current => current ? { ...current, answers: current.answers?.map(item => item.id === saved.id ? saved : item) } : current);
    } finally { setSavingId(""); }
  };
  if (!attempt) return <AdminShell title="Koreksi jawaban"><p>Memuat lembar jawaban...</p></AdminShell>;
  return <AdminShell title="Koreksi jawaban" subtitle={`Attempt ${attempt.id.slice(0, 8)}`} fluid>{toast && <ToastMessage toast={toast} onClose={() => setToast(null)} />}<Link to="/admin/reviews" className="back-link"><ArrowLeft /> Kembali ke antrean</Link><div className="review-detail-layout"><main className="answer-sheet"><div className="review-progress-banner"><div><span>Progres koreksi</span><strong>{reviewed} dari {answers.length} jawaban dinilai</strong></div><div><i style={{ width: `${answers.length ? reviewed / answers.length * 100 : 0}%` }} /></div></div><div className="answer-cards">{answers.map((answer, index) => { const question = questions.get(answer.questionId); const options = question?.options || []; const selected = options.find(option => option.id === answer.selectedOptionId); return <article className={`answer-review-card ${answer.verdict === "incorrect" ? "wrong" : answer.verdict || ""}`} key={answer.id}><div className="answer-card-title"><span>{index + 1}</span><div><small>SOAL {index + 1} · {question?.type || "JAWABAN"}</small><strong>{question?.weight || 0} bobot</strong></div>{answer.verdict && <StatusPill tone={answer.verdict === "correct" ? "terbit" : "danger"}>{answer.verdict === "correct" ? "Benar" : "Salah"}</StatusPill>}</div><h3>{question ? documentText(question.contentDoc) : "Pertanyaan"}</h3><div className="student-answer"><label>Jawaban peserta</label><p>{answer.textRaw || (selected ? documentText(selected.contentDoc) : "Tidak dijawab")}</p></div><div className="verdict-buttons"><span>Berikan penilaian:</span><button disabled={savingId === answer.id} className={answer.verdict === "incorrect" ? "selected wrong" : ""} onClick={() => void review(answer, "incorrect")}><X /> Salah</button><button disabled={savingId === answer.id} className={answer.verdict === "correct" ? "selected correct" : ""} onClick={() => void review(answer, "correct")}><Check /> Benar</button></div></article>; })}</div></main><aside className="review-summary-side"><h3>Ringkasan koreksi</h3><div className="score-circle"><strong>{answers.length ? Math.round(correct / answers.length * 100) : 0}</strong><span>/ 100</span></div><div className="verdict-summary"><div><span className="correct"><Check /></span><p><strong>{correct}</strong><small>Benar</small></p></div><div><span className="wrong"><X /></span><p><strong>{answers.filter(answer => answer.verdict === "incorrect").length}</strong><small>Salah</small></p></div><div><span className="empty"><Circle /></span><p><strong>{answers.length - reviewed}</strong><small>Belum dinilai</small></p></div></div><div className="release-info"><LockKeyhole /><p>Nilai belum terlihat peserta sampai diterbitkan.</p></div><button className="button primary full" disabled={!answers.length || reviewed < answers.length} onClick={async () => { await examRepository.releaseResult(attempt.id); setToast({ message: "Nilai berhasil diterbitkan" }); }}><Send /> Terbitkan nilai</button></aside></div></AdminShell>;
}
