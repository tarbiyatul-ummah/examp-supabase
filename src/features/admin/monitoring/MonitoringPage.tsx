import { AlertTriangle, Clock3, Flag, Radio, RefreshCw, Users, Wifi, WifiOff, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminShell } from "../../../components/layout";
import { Avatar, PageToolbar, StatusPill, Toast, ToastMessage } from "../../../components/ui";
import type { Exam, MonitoringRow } from "../../../domain/models";
import { ApiError } from "../../../lib/api";
import { examRepository } from "../../../repositories";

function DisqualifyModal({ name, onClose, onConfirm }: { name: string; onClose: () => void; onConfirm: (reason: string) => Promise<void> }) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  return (
    <div className="modal-backdrop"><div className="modal-card small">
      <div className="modal-header"><div><span className="danger-modal-icon"><AlertTriangle /></span><div><h2>Diskualifikasi peserta?</h2><p><strong>{name}</strong> tidak dapat melanjutkan ujian.</p></div></div><button className="icon-button" onClick={onClose}><X /></button></div>
      <div className="modal-body"><label>Alasan diskualifikasi *</label><textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} /></div>
      <div className="modal-footer"><button className="button secondary" onClick={onClose}>Batal</button><button className="button danger" disabled={!reason.trim() || loading} onClick={async () => { setLoading(true); try { await onConfirm(reason); } finally { setLoading(false); } }}><Flag /> {loading ? "Memproses..." : "Diskualifikasi"}</button></div>
    </div></div>
  );
}

function mapRows(rows: Awaited<ReturnType<typeof examRepository.monitoring>>): MonitoringRow[] {
  return rows.map((row) => {
    const attempt = row.attempt;
    const status: MonitoringRow["status"] = !attempt
      ? "Belum mulai"
      : attempt.status === "in_progress"
        ? "Mengerjakan"
        : attempt.status === "paused_disconnected"
          ? "Terjeda"
          : ["submitted", "time_expired"].includes(attempt.status)
            ? "Selesai"
            : attempt.status === "disqualified" || attempt.status === "cancelled"
              ? "Selesai"
              : "Belum mulai";
    const connection: MonitoringRow["connection"] = !attempt
      ? "Offline"
      : attempt.status === "paused_disconnected"
        ? "Terputus"
        : attempt.status === "in_progress"
          ? "Terhubung"
          : "Offline";
    const remaining = attempt?.remainingSeconds ?? 0;
    return {
      id: attempt?.id ?? row.assignmentId,
      studentId: row.student.id,
      name: row.student.name,
      class: String(row.student.grade),
      phase: row.student.phase,
      progress: row.answeredCount,
      total: row.questionCount,
      status,
      connection,
      time: attempt ? `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}` : "--:--",
      activity: row.lastActivity ? new Intl.DateTimeFormat("id-ID", { timeStyle: "short" }).format(new Date(row.lastActivity)) : "-",
      score: attempt?.score,
    };
  });
}

export function MonitoringPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [examId, setExamId] = useState("");
  const [monitoring, setMonitoring] = useState<MonitoringRow[]>([]);
  const [search, setSearch] = useState("");
  const [candidate, setCandidate] = useState<MonitoringRow | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const exam = exams.find((item) => String(item.id) === examId) || null;

  useEffect(() => {
    examRepository.list().then((items) => {
      const available = items.filter((item) => item.status !== "Draf");
      setExams(available);
      setExamId(String(available.find((item) => item.status === "Berlangsung")?.id ?? available[0]?.id ?? ""));
    }).catch((cause) => setToast({ message: cause instanceof ApiError ? cause.message : "Gagal memuat ujian" }));
  }, []);

  const load = useCallback(async (silent = false) => {
    if (!examId) { setMonitoring([]); setLoading(false); return; }
    if (!silent) setLoading(true);
    try {
      setMonitoring(mapRows(await examRepository.monitoring(examId)));
      setUpdatedAt(new Date());
    } catch (cause) {
      setToast({ message: cause instanceof ApiError ? cause.message : "Gagal memuat monitoring" });
    } finally { if (!silent) setLoading(false); }
  }, [examId]);

  useEffect(() => {
    void load();
    if (!examId) return;
    const timer = setInterval(() => void load(true), 5000);
    return () => clearInterval(timer);
  }, [examId, load]);

  const summary = useMemo(() => ({
    total: monitoring.length,
    inProgress: monitoring.filter((row) => row.status === "Mengerjakan").length,
    disconnected: monitoring.filter((row) => row.connection === "Terputus").length,
    completed: monitoring.filter((row) => row.status === "Selesai").length,
  }), [monitoring]);
  const filtered = monitoring.filter((row) => row.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <AdminShell title="Monitoring ujian" subtitle={exam?.title || "Belum ada ujian diterbitkan"} action={
      <select className="page-action-select" value={examId} onChange={(event) => setExamId(event.target.value)} disabled={!exams.length}>
        {!exams.length && <option value="">Belum ada ujian</option>}
        {exams.map((item) => <option value={String(item.id)} key={item.id}>{item.title}</option>)}
      </select>
    }>
      {toast && <ToastMessage toast={toast} onClose={() => setToast(null)} />}
      <div className="monitor-hero"><div><span className="live-badge"><i /> DATA LANGSUNG</span><h2>{exam?.title || "Belum ada ujian"}</h2><p>{exam ? `Kelas ${exam.grades.join(", ")} · ${exam.questions} soal` : "Terbitkan ujian untuk mulai monitoring."}</p></div><div className="monitor-clock"><small>Durasi ujian</small><strong>{exam?.duration || 0}:00</strong><span><Clock3 /> Timer mengikuti setiap peserta</span></div></div>
      <div className="monitor-stats"><div><span className="cyan"><Users /></span><p><strong>{summary.total}</strong><small>Total peserta</small></p></div><div><span className="green"><Wifi /></span><p><strong>{summary.inProgress}</strong><small>Sedang mengerjakan</small></p></div><div><span className="orange"><WifiOff /></span><p><strong>{summary.disconnected}</strong><small>Koneksi terputus</small></p></div><div><span className="purple"><Radio /></span><p><strong>{summary.completed}</strong><small>Sudah selesai</small></p></div></div>
      <section className="panel table-panel monitor-table">
        <PageToolbar search={search} setSearch={setSearch} placeholder="Cari peserta..."><button className="auto-refresh" disabled={loading || !examId} onClick={() => void load()}><RefreshCw className={loading ? "spin" : ""} /> {updatedAt ? `Diperbarui ${updatedAt.toLocaleTimeString("id-ID")}` : loading ? "Menghubungkan..." : "Muat ulang"}</button></PageToolbar>
        <div className="table-scroll"><table><thead><tr><th>Peserta</th><th>Kelas</th><th>Status</th><th>Progres</th><th>Sisa waktu</th><th>Koneksi</th><th>Aktivitas</th><th /></tr></thead><tbody>
          {loading && <tr><td colSpan={8}>Memuat data monitoring...</td></tr>}
          {!loading && !filtered.length && <tr><td colSpan={8}>Belum ada peserta untuk ditampilkan.</td></tr>}
          {!loading && filtered.map((person) => <tr key={person.id}><td><div className="person-cell"><Avatar name={person.name} /><strong>{person.name}</strong></div></td><td>{person.class}<small className="block">Fase {person.phase}</small></td><td><StatusPill tone={person.status === "Mengerjakan" ? "aktif" : person.status === "Terjeda" ? "warning" : person.status === "Selesai" ? "terbit" : "nonaktif"}>{person.status}</StatusPill></td><td><div className="progress-cell"><div><i style={{ width: `${person.total ? person.progress / person.total * 100 : 0}%` }} /></div><span>{person.progress}/{person.total}</span></div></td><td><strong>{person.time}</strong></td><td><span className={`connection ${person.connection.toLowerCase()}`}>{person.connection === "Terhubung" ? <Wifi /> : <WifiOff />}{person.connection}</span></td><td>{person.activity}</td><td>{!["Selesai", "Belum mulai"].includes(person.status) && <button className="icon-button destructive" onClick={() => setCandidate(person)}><Flag /></button>}</td></tr>)}
        </tbody></table></div><div className="table-footer"><p>Menampilkan {filtered.length} dari {monitoring.length} peserta</p></div>
      </section>
      {candidate && <DisqualifyModal name={candidate.name} onClose={() => setCandidate(null)} onConfirm={async (reason) => { try { await examRepository.disqualify(String(candidate.id), reason); await load(); setToast({ message: `${candidate.name} telah didiskualifikasi`, kind: "info" }); setCandidate(null); } catch (cause) { setToast({ message: cause instanceof ApiError ? cause.message : "Gagal mendiskualifikasi peserta" }); } }} />}
    </AdminShell>
  );
}
