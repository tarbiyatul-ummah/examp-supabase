import { ArrowLeft, BarChart3, CheckCircle2, ClipboardCheck, Clock3, FileText, ListChecks, Pencil, Sparkles, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AdminShell } from "../../../components/layout";
import { StatusPill, Toast, ToastMessage } from "../../../components/ui";
import type { Exam, Student } from "../../../domain/models";
import { examRepository, studentRepository } from "../../../repositories";
import { AssignmentDrawer } from "./AssignmentDrawer";

export function ExamDetailsPage() {
  const { id } = useParams();
  const [exam, setExam] = useState<Exam | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  useEffect(() => { Promise.all([examRepository.list(), studentRepository.list()]).then(([exams, response]) => { setExam(exams.find(item => String(item.id) === id) || null); setStudents(response.students); }); }, [id]);
  if (!exam) return <AdminShell title="Detail ujian"><p>Memuat detail ujian...</p></AdminShell>;
  const isManual = exam.mode === "Koreksi admin";
  return <AdminShell title="Detail ujian" subtitle={exam.title}>{toast && <ToastMessage toast={toast} onClose={() => setToast(null)} />}<Link to="/admin/exams" className="back-link exam-detail-back"><ArrowLeft /> Kembali ke daftar ujian</Link><section className="exam-detail-hero"><div className="exam-detail-title"><span className="subject-icon large" style={{ background: exam.color }}>{exam.subject.slice(0, 2).toUpperCase()}</span><div><div><StatusPill>{exam.status}</StatusPill><span className="detail-mode">{isManual ? <ClipboardCheck /> : <Sparkles />}{exam.mode}</span></div><h2>{exam.title}</h2><p>{exam.subject} · Kelas {exam.grades.join(", ")} · Fase {exam.phase}</p></div></div><div className="exam-detail-actions">{exam.status === "Draf" && <Link to={`/admin/exams/${exam.id}/edit`} className="button secondary"><Pencil /> Edit metadata</Link>}<button className="button primary" onClick={() => setAssignmentOpen(true)}><Users /> Atur assignment</button></div></section><div className="exam-detail-grid"><div><div className="detail-metrics"><div><Clock3 /><p><small>Durasi</small><strong>{exam.duration} menit</strong></p></div><div><ListChecks /><p><small>Jumlah soal</small><strong>{exam.questions} soal</strong></p></div><div><FileText /><p><small>Versi aktif</small><strong>Versi {exam.version}</strong></p></div><div><BarChart3 /><p><small>Status</small><strong>{exam.status}</strong></p></div></div><section className="panel detail-description"><h3>Deskripsi ujian</h3><p>{exam.description || "Belum ada deskripsi."}</p><h3>Target akademik</h3><div className="academic-tags"><span>{exam.level}</span><span>Kelas {exam.grades.join(", ") || "Semua"}</span><span>Fase {exam.phase}</span></div></section></div><aside className="panel detail-side-card"><h3>Status data</h3><div className="validation-item"><CheckCircle2 /><div><strong>Metadata dari server</strong><small>Durasi, target, mode, dan versi tersinkron.</small></div></div><div className="validation-item"><CheckCircle2 /><div><strong>{exam.questions} soal tersimpan</strong><small>Backend belum menyediakan endpoint baca isi soal admin.</small></div></div></aside></div><AssignmentDrawer open={assignmentOpen} students={students} onClose={() => setAssignmentOpen(false)} onSave={async ids => { await examRepository.assign(String(exam.id), ids); setAssignmentOpen(false); setToast({ message: `${ids.length} assignment berhasil disimpan` }); }} /></AdminShell>;
}
