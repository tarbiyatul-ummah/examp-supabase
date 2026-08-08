import { AlertTriangle, Clock3, Flag, Radio, RefreshCw, Users, Wifi, WifiOff, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "../../../components/layout";
import { Avatar, PageToolbar, StatusPill, Toast, ToastMessage } from "../../../components/ui";
import type { Exam, MonitoringRow } from "../../../domain/models";
import { examRepository } from "../../../repositories";

function DisqualifyModal({ name, onClose, onConfirm }: { name: string; onClose: () => void; onConfirm: (reason: string) => Promise<void> }) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  return <div className="modal-backdrop"><div className="modal-card small"><div className="modal-header"><div><span className="danger-modal-icon"><AlertTriangle /></span><div><h2>Diskualifikasi peserta?</h2><p><strong>{name}</strong> tidak dapat melanjutkan ujian.</p></div></div><button className="icon-button" onClick={onClose}><X /></button></div><div className="modal-body"><label>Alasan diskualifikasi *</label><textarea rows={3} value={reason} onChange={event => setReason(event.target.value)} /></div><div className="modal-footer"><button className="button secondary" onClick={onClose}>Batal</button><button className="button danger" disabled={!reason.trim() || loading} onClick={async () => { setLoading(true); try { await onConfirm(reason); } finally { setLoading(false); } }}><Flag /> {loading ? "Memproses..." : "Diskualifikasi"}</button></div></div></div>;
}

function mapRows(rows: Awaited<ReturnType<typeof examRepository.monitoring>>): MonitoringRow[] {
  return rows.map(row => ({ id: row.attempt.id, studentId: row.student.id, name: row.student.name, class: String(row.student.grade), phase: row.student.phase, progress: row.answeredCount, total: row.questionCount, status: row.attempt.status === "in_progress" ? "Mengerjakan" : row.attempt.status === "paused_disconnected" ? "Terjeda" : ["submitted", "time_expired"].includes(row.attempt.status) ? "Selesai" : "Belum mulai", connection: row.attempt.status === "paused_disconnected" ? "Terputus" : row.attempt.status === "in_progress" ? "Terhubung" : "Offline", time: `${String(Math.floor(row.attempt.remainingSeconds / 60)).padStart(2, "0")}:${String(row.attempt.remainingSeconds % 60).padStart(2, "0")}`, activity: row.lastActivity ? new Intl.DateTimeFormat("id-ID", { timeStyle: "short" }).format(new Date(row.lastActivity)) : "-", score: row.attempt.score }));
}

export function MonitoringPage() {
  const [exam, setExam] = useState<Exam | null>(null);
  const [monitoring, setMonitoring] = useState<MonitoringRow[]>([]);
  const [search, setSearch] = useState("");
  const [candidate, setCandidate] = useState<MonitoringRow | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    examRepository.list().then(exams => {
      const selected = exams.find(item => item.status === "Terbit") || exams[0];
      if (!selected) return;
      setExam(selected);
      const load = () => examRepository.monitoring(String(selected.id)).then(rows => { setMonitoring(mapRows(rows)); setUpdatedAt(new Date()); });
      void load(); timer = setInterval(load, 5000);
    });
    return () => clearInterval(timer);
  }, []);
  const summary = useMemo(() => ({ total: monitoring.length, inProgress: monitoring.filter(row => row.status === "Mengerjakan").length, disconnected: monitoring.filter(row => row.connection === "Terputus").length, completed: monitoring.filter(row => row.status === "Selesai").length }), [monitoring]);
  const filtered = monitoring.filter(row => row.name.toLowerCase().includes(search.toLowerCase()));
  return <AdminShell title="Monitoring ujian" subtitle={exam?.title || "Belum ada ujian diterbitkan"}>{toast && <ToastMessage toast={toast} onClose={() => setToast(null)} />}<div className="monitor-hero"><div><span className="live-badge"><i /> DATA LANGSUNG</span><h2>{exam?.title || "Belum ada ujian"}</h2><p>{exam ? `Kelas ${exam.grades.join(", ")} · ${exam.questions} soal` : "Terbitkan ujian untuk mulai monitoring."}</p></div><div className="monitor-clock"><small>Durasi ujian</small><strong>{exam?.duration || 0}:00</strong><span><Clock3 /> Timer mengikuti setiap peserta</span></div></div><div className="monitor-stats"><div><span className="cyan"><Users /></span><p><strong>{summary.total}</strong><small>Total peserta</small></p></div><div><span className="green"><Wifi /></span><p><strong>{summary.inProgress}</strong><small>Sedang mengerjakan</small></p></div><div><span className="orange"><WifiOff /></span><p><strong>{summary.disconnected}</strong><small>Koneksi terputus</small></p></div><div><span className="purple"><Radio /></span><p><strong>{summary.completed}</strong><small>Sudah selesai</small></p></div></div><section className="panel table-panel monitor-table"><PageToolbar search={search} setSearch={setSearch} placeholder="Cari peserta..."><span className="auto-refresh"><RefreshCw /> {updatedAt ? `Diperbarui ${updatedAt.toLocaleTimeString("id-ID")}` : "Menghubungkan..."}</span></PageToolbar><div className="table-scroll"><table><thead><tr><th>Peserta</th><th>Kelas</th><th>Status</th><th>Progres</th><th>Sisa waktu</th><th>Koneksi</th><th>Aktivitas</th><th /></tr></thead><tbody>{filtered.map(person => <tr key={person.id}><td><div className="person-cell"><Avatar name={person.name} /><strong>{person.name}</strong></div></td><td>{person.class}<small className="block">Fase {person.phase}</small></td><td><StatusPill tone={person.status === "Mengerjakan" ? "aktif" : person.status === "Terjeda" ? "warning" : person.status === "Selesai" ? "terbit" : "nonaktif"}>{person.status}</StatusPill></td><td><div className="progress-cell"><div><i style={{ width: `${person.total ? person.progress / person.total * 100 : 0}%` }} /></div><span>{person.progress}/{person.total}</span></div></td><td><strong>{person.time}</strong></td><td><span className={`connection ${person.connection.toLowerCase()}`}>{person.connection === "Terhubung" ? <Wifi /> : <WifiOff />}{person.connection}</span></td><td>{person.activity}</td><td>{!["Selesai", "Belum mulai"].includes(person.status) && <button className="icon-button destructive" onClick={() => setCandidate(person)}><Flag /></button>}</td></tr>)}</tbody></table></div><div className="table-footer"><p>Menampilkan {filtered.length} dari {monitoring.length} peserta</p></div></section>{candidate && <DisqualifyModal name={candidate.name} onClose={() => setCandidate(null)} onConfirm={async reason => { await examRepository.disqualify(String(candidate.id), reason); setMonitoring(rows => rows.filter(row => row.id !== candidate.id)); setToast({ message: `${candidate.name} telah didiskualifikasi`, kind: "info" }); setCandidate(null); }} />}</AdminShell>;
}
