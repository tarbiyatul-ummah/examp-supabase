import {
  ArrowRight,
  Award,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  FileText,
  ListChecks,
  Plus,
  Radio,
  UserPlus,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "../../../components/layout";
import { StatusPill } from "../../../components/ui";
import type { Exam, Student } from "../../../domain/models";
import {
  authRepository,
  examRepository,
  studentRepository,
} from "../../../repositories";

function StatCard({
  icon: Icon,
  label,
  value,
  meta,
  tone,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  meta: string;
  tone: string;
}) {
  return (
    <div className="stat-card">
      <span className={`stat-icon ${tone}`}>
        <Icon />
      </span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <small>{meta}</small>
      </div>
    </div>
  );
}

function ExamListRow({ exam }: { exam: Exam }) {
  return (
    <div className="exam-list-row">
      <span className="subject-icon" style={{ background: exam.color }}>
        {exam.subject.slice(0, 2).toUpperCase()}
      </span>
      <div className="exam-main">
        <strong>{exam.title}</strong>
        <p>
          <Clock3 /> {exam.duration} menit <span>•</span> <ListChecks />{" "}
          {exam.questions} soal <span>•</span> <Users /> {exam.participants}{" "}
          peserta
        </p>
      </div>
      <StatusPill>{exam.status}</StatusPill>
      <Link className="icon-button" to={`/admin/exams/${exam.id}`}>
        <ChevronRight />
      </Link>
    </div>
  );
}

export function DashboardPage() {
  const currentAdmin = authRepository.session()?.profile || {
    shortName: "Admin",
  };
  const [exams, setExams] = useState<Exam[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  useEffect(() => {
    Promise.all([examRepository.list(), studentRepository.list()]).then(
      ([exams, response]) => {
        setExams(exams);
        setStudents(response.students);
      },
    );
  }, []);
  const summary = useMemo(
    () => ({
      totalStudents: students.length,
      activeStudents: students.filter((student) => student.status === "Aktif")
        .length,
      activeExams: exams.filter(
        (exam) => exam.status === "Terbit" || exam.status === "Berlangsung",
      ).length,
      runningExams: exams.filter((exam) => exam.status === "Berlangsung")
        .length,
      pendingReviews: 0,
      reviewExamCount: exams.filter((exam) => exam.mode === "Koreksi admin")
        .length,
    }),
    [exams, students],
  );
  return (
    <AdminShell
      title={`Selamat pagi, ${currentAdmin.shortName}! 👋`}
      subtitle="Berikut ringkasan aktivitas ujian hari ini."
    >
      <div className="stats-grid">
        <StatCard
          icon={Users}
          label="Total peserta"
          value={String(summary.totalStudents)}
          meta={`${summary.activeStudents} akun aktif`}
          tone="teal"
        />
        <StatCard
          icon={FileText}
          label="Ujian aktif"
          value={String(summary.activeExams)}
          meta={`${summary.runningExams} sedang berlangsung`}
          tone="purple"
        />
        <StatCard
          icon={ClipboardCheck}
          label="Perlu dikoreksi"
          value={String(summary.pendingReviews)}
          meta={`Dari ${summary.reviewExamCount} ujian`}
          tone="orange"
        />
      </div>
      <div className="dashboard-grid">
        <section className="panel span-2">
          <div className="panel-header">
            <div>
              <h2>Ujian terbaru</h2>
              <p>Pantau ujian yang baru dibuat atau sedang berjalan.</p>
            </div>
            <Link to="/admin/exams">
              Lihat semua <ArrowRight />
            </Link>
          </div>
          <div className="exam-list compact">
            {exams.slice(0, 3).map((exam) => (
              <ExamListRow key={exam.id} exam={exam} />
            ))}
          </div>
        </section>
        <section className="panel quick-panel">
          <div className="panel-header">
            <div>
              <h2>Aksi cepat</h2>
              <p>Mulai dari sini.</p>
            </div>
          </div>
          <Link to="/admin/exams/new" className="quick-action primary-quick">
            <span>
              <Plus />
            </span>
            <div>
              <strong>Buat ujian baru</strong>
              <small>Wizard di halaman terpisah</small>
            </div>
            <ChevronRight />
          </Link>
          <Link to="/admin/students?create=1" className="quick-action">
            <span>
              <UserPlus />
            </span>
            <div>
              <strong>Tambah peserta</strong>
              <small>Dibuka dalam modal fokus</small>
            </div>
            <ChevronRight />
          </Link>
          <Link to="/admin/monitoring" className="quick-action">
            <span>
              <Radio />
            </span>
            <div>
              <strong>Buka monitoring</strong>
              <small>Pantau secara real-time</small>
            </div>
            <ChevronRight />
          </Link>
        </section>
      </div>
      <section className="panel activity-panel">
        <div className="panel-header">
          <div>
            <h2>Aktivitas terkini</h2>
            <p>
              Audit log tersedia di backend dan belum memiliki endpoint daftar
              publik.
            </p>
          </div>
        </div>
      </section>
    </AdminShell>
  );
}
