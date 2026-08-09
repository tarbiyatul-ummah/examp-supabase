import {
  ChevronDown,
  ChevronRight,
  Clock3,
  ListChecks,
  MoreHorizontal,
  Plus,
  SlidersHorizontal,
  Sparkles,
  ClipboardCheck,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AdminShell } from "../../../components/layout";
import { PageToolbar, StatusPill } from "../../../components/ui";
import type { Exam, ExamStatus } from "../../../domain/models";
import { ApiError } from "../../../lib/api";
import { examRepository } from "../../../repositories";

export function ExamsPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState<"Semua" | ExamStatus>("Semua");
  const [statusFilterOpen, setStatusFilterOpen] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    examRepository
      .list()
      .then(setExams)
      .catch((cause) => setError(cause instanceof ApiError ? cause.message : "Gagal memuat daftar ujian"))
      .finally(() => setLoading(false));
  }, []);
  const summary = useMemo(
    () => ({
      total: exams.length,
      draft: exams.filter((exam) => exam.status === "Draf").length,
      published: exams.filter((exam) => exam.status === "Terbit").length,
      running: exams.filter((exam) => exam.status === "Berlangsung").length,
      completed: exams.filter((exam) => exam.status === "Selesai").length,
      totalAttempts: exams.reduce((sum, exam) => sum + exam.participants, 0),
      averageScore: (() => {
        const scores = exams.flatMap((exam) => typeof exam.averageScore === "number" ? [exam.averageScore] : []);
        return scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length * 100) / 100 : 0;
      })(),
    }),
    [exams],
  );
  const [search, setSearch] = useState("");
  const filtered = exams.filter((exam) =>
    exam.title.toLowerCase().includes(search.toLowerCase()) &&
    (activeStatus === "Semua" || exam.status === activeStatus),
  );
  const tabs: Array<{ label: "Semua" | ExamStatus; count: number }> = [
    { label: "Semua", count: summary.total },
    { label: "Draf", count: summary.draft },
    { label: "Terbit", count: summary.published },
    { label: "Berlangsung", count: summary.running },
    { label: "Selesai", count: summary.completed },
  ];
  return (
    <AdminShell
      title="Ujian"
      subtitle="Buat, terbitkan, dan kelola seluruh ujian."
      action={
        <Link to="/admin/exams/new" className="button primary desktop-action">
          <Plus /> Buat ujian
        </Link>
      }
    >
      <div className="exam-overview-grid">
        <div className="overview-copy">
          <span>SEMUA UJIAN</span>
          <strong>{exams.length}</strong>
          <p>{summary.running} berlangsung · {summary.published} siap digunakan</p>
        </div>
        <div className="overview-side">
          <div>
            <span className="dot purple" />
            <p>
              <strong>{summary.totalAttempts}</strong>
              <small>Total attempt</small>
            </p>
          </div>
          <div>
            <span className="dot green" />
            <p>
              <strong>{String(summary.averageScore).replace(".", ",")}</strong>
              <small>Rata-rata nilai</small>
            </p>
          </div>
        </div>
      </div>
      <section className="panel table-panel exams-panel">
        <PageToolbar
          search={search}
          setSearch={setSearch}
          placeholder="Cari nama ujian..."
        >
          <div className="toolbar-filter">
            <button className={`button secondary ${activeStatus !== "Semua" ? "active" : ""}`} onClick={() => setStatusFilterOpen((open) => !open)}>
              <SlidersHorizontal /> {activeStatus === "Semua" ? "Status" : activeStatus} <ChevronDown />
            </button>
            {statusFilterOpen && <div className="row-action-menu status-menu">{tabs.map((tab) => <button key={tab.label} className={activeStatus === tab.label ? "active" : ""} onClick={() => { setActiveStatus(tab.label); setStatusFilterOpen(false); }}>{tab.label} ({tab.count})</button>)}</div>}
          </div>
        </PageToolbar>
        <div className="view-tabs">
          {tabs.map((tab) => <button key={tab.label} className={activeStatus === tab.label ? "active" : ""} onClick={() => setActiveStatus(tab.label)}>{tab.label} <span>{tab.count}</span></button>)}
        </div>
        <div className="exam-card-grid">
          {loading && <p>Memuat daftar ujian...</p>}
          {!loading && error && <p>{error}</p>}
          {!loading && filtered.length === 0 && (
            <p>{search || activeStatus !== "Semua" ? "Tidak ada ujian yang sesuai filter." : "Belum ada ujian. Buat ujian pertama untuk memulai."}</p>
          )}
          {filtered.map((exam) => (
            <article className="exam-card" key={exam.id}>
              <div className="exam-card-top">
                <span
                  className="subject-icon large"
                  style={{ background: exam.color }}
                >
                  {exam.subject.slice(0, 2).toUpperCase()}
                </span>
                <StatusPill>{exam.status}</StatusPill>
                <button className="icon-button">
                  <MoreHorizontal />
                </button>
              </div>
              <p className="exam-subject">{exam.subject.toUpperCase()}</p>
              <h3>{exam.title}</h3>
              <div className="exam-meta">
                <span>
                  <Clock3 />
                  {exam.duration} menit
                </span>
                <span>
                  <ListChecks />
                  {exam.questions} soal
                </span>
                <span>
                  <Users />
                  {exam.participants} peserta
                </span>
              </div>
              <div className="mode-label">
                <span
                  className={exam.mode === "Nilai langsung" ? "auto" : "manual"}
                >
                  {exam.mode === "Nilai langsung" ? (
                    <Sparkles />
                  ) : (
                    <ClipboardCheck />
                  )}
                  {exam.mode}
                </span>
              </div>
              <div className="exam-card-footer">
                <small>Diperbarui 2 hari lalu</small>
                <Link
                  to={
                    exam.status === "Draf"
                      ? `/admin/exams/${exam.id}/edit`
                      : `/admin/exams/${exam.id}`
                  }
                >
                  {exam.status === "Draf" ? "Lanjutkan" : "Lihat detail"}{" "}
                  <ChevronRight />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </AdminShell>
  );
}
