import { ArrowRight, CheckCircle2, ChevronRight, ClipboardCheck, ClipboardList, Clock3, Pencil, Send } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AdminShell } from "../../../components/layout";
import { Avatar, PageToolbar, StatusPill, Toast, ToastMessage } from "../../../components/ui";
import type { Exam, ReviewQueueItem } from "../../../domain/models";
import { ApiError } from "../../../lib/api";
import { examRepository } from "../../../repositories";

function mapQueue(rows: Awaited<ReturnType<typeof examRepository.reviewQueue>>): ReviewQueueItem[] {
  return rows.map((row) => ({
    id: row.attempt.id,
    studentId: row.student.id,
    name: row.student.name,
    class: String(row.student.grade),
    status: row.attempt.gradingStatus === "released"
      ? "Sudah terbit"
      : row.attempt.gradingStatus === "reviewed"
        ? "Siap diterbitkan"
        : row.attempt.gradingStatus === "in_review"
          ? "Sedang dikoreksi"
          : "Belum dikoreksi",
    reviewedCount: row.reviewedCount,
    totalQuestions: row.questionCount,
    progress: `${row.reviewedCount}/${row.questionCount}`,
    submittedAt: row.attempt.submittedAt
      ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(row.attempt.submittedAt))
      : "-",
  }));
}

export function ReviewsPage() {
  const [search, setSearch] = useState("");
  const [exams, setExams] = useState<Exam[]>([]);
  const [examId, setExamId] = useState("");
  const [queue, setQueue] = useState<ReviewQueueItem[]>([]);
  const [toast, setToast] = useState<Toast | null>(null);
  const [loading, setLoading] = useState(true);
  const [releasing, setReleasing] = useState(false);
  const exam = exams.find((item) => String(item.id) === examId) || null;

  useEffect(() => {
    examRepository.list().then((items) => {
      const manual = items.filter((item) => item.mode === "Koreksi admin" && item.status !== "Draf");
      setExams(manual);
      setExamId(String(manual[0]?.id ?? ""));
      if (!manual.length) setLoading(false);
    }).catch((cause) => { setLoading(false); setToast({ message: cause instanceof ApiError ? cause.message : "Gagal memuat ujian" }); });
  }, []);

  const loadQueue = useCallback(async () => {
    if (!examId) { setQueue([]); setLoading(false); return; }
    setLoading(true);
    try { setQueue(mapQueue(await examRepository.reviewQueue(examId))); }
    catch (cause) { setToast({ message: cause instanceof ApiError ? cause.message : "Gagal memuat antrean koreksi" }); }
    finally { setLoading(false); }
  }, [examId]);

  useEffect(() => { void loadQueue(); }, [loadQueue]);
  const summary = useMemo(() => ({
    total: queue.length,
    pending: queue.filter((item) => item.status === "Belum dikoreksi").length,
    inReview: queue.filter((item) => item.status === "Sedang dikoreksi").length,
    completed: queue.filter((item) => ["Siap diterbitkan", "Sudah terbit"].includes(item.status)).length,
  }), [queue]);
  const filtered = queue.filter((item) => item.name.toLowerCase().includes(search.toLowerCase()));
  const nextReview = queue.find((item) => item.status !== "Sudah terbit");

  return (
    <AdminShell title="Koreksi jawaban" subtitle="Periksa jawaban peserta dan terbitkan nilai." action={
      <select className="page-action-select" value={examId} onChange={(event) => setExamId(event.target.value)} disabled={!exams.length}>
        {!exams.length && <option value="">Belum ada ujian manual</option>}
        {exams.map((item) => <option value={String(item.id)} key={item.id}>{item.title}</option>)}
      </select>
    }>
      {toast && <ToastMessage toast={toast} onClose={() => setToast(null)} />}
      <div className="review-alert"><span><ClipboardCheck /></span><div><strong>{summary.pending} peserta menunggu koreksi</strong><p>{exam?.title || "Belum ada ujian koreksi admin yang diterbitkan."}</p></div>{nextReview && <Link className="button secondary" to={`/admin/reviews/${nextReview.id}`}>Mulai koreksi <ArrowRight /></Link>}</div>
      <div className="review-summary-grid"><div><span className="gray"><ClipboardList /></span><p><strong>{summary.total}</strong><small>Total antrean</small></p></div><div><span className="orange"><Clock3 /></span><p><strong>{summary.pending}</strong><small>Belum dikoreksi</small></p></div><div><span className="purple"><Pencil /></span><p><strong>{summary.inReview}</strong><small>Sedang dikoreksi</small></p></div><div><span className="green"><CheckCircle2 /></span><p><strong>{summary.completed}</strong><small>Selesai dikoreksi</small></p></div></div>
      <section className="panel table-panel">
        <PageToolbar search={search} setSearch={setSearch} placeholder="Cari nama peserta..."><button className="button secondary" disabled={!exam || releasing || !queue.some((item) => item.status === "Siap diterbitkan")} onClick={async () => { if (!exam) return; setReleasing(true); try { const released = await examRepository.releaseResults(String(exam.id)); await loadQueue(); setToast({ message: `${released.length} hasil diterbitkan` }); } catch (cause) { setToast({ message: cause instanceof ApiError ? cause.message : "Gagal menerbitkan hasil" }); } finally { setReleasing(false); } }}><Send /> {releasing ? "Menerbitkan..." : "Terbitkan batch"}</button></PageToolbar>
        <div className="table-scroll"><table><thead><tr><th>Peserta</th><th>Kelas</th><th>Waktu submit</th><th>Progres koreksi</th><th>Status</th><th /></tr></thead><tbody>
          {loading && <tr><td colSpan={6}>Memuat antrean koreksi...</td></tr>}
          {!loading && !filtered.length && <tr><td colSpan={6}>Belum ada jawaban yang menunggu koreksi.</td></tr>}
          {!loading && filtered.map((item) => <tr key={item.id}><td><div className="person-cell"><Avatar name={item.name} /><strong>{item.name}</strong></div></td><td>{item.class}</td><td>{item.submittedAt}</td><td><div className="review-progress"><span>{item.reviewedCount}/{item.totalQuestions}</span><div><i style={{ width: `${item.totalQuestions ? item.reviewedCount / item.totalQuestions * 100 : 0}%` }} /></div></div></td><td><StatusPill tone={item.status === "Belum dikoreksi" ? "nonaktif" : item.status === "Sedang dikoreksi" ? "warning" : item.status === "Sudah terbit" ? "terbit" : "aktif"}>{item.status}</StatusPill></td><td><Link to={`/admin/reviews/${item.id}`} className="button small secondary">Buka <ChevronRight /></Link></td></tr>)}
        </tbody></table></div>
      </section>
    </AdminShell>
  );
}
