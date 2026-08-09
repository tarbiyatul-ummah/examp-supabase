import {
  ArrowLeft,
  ClipboardCheck,
  Clock3,
  ListChecks,
  Play,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { StudentHeader } from "../../../components/layout";
import type { Exam } from "../../../domain/models";
import { examRepository } from "../../../repositories";

export function ExamOverviewPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [confirmed, setConfirmed] = useState(false);
  const [exam, setExam] = useState<Exam | null>(null);
  useEffect(() => {
    examRepository
      .studentExams()
      .then((items) =>
        setExam(items.find((item) => String(item.id) === id) || null),
      );
  }, [id]);
  if (!exam)
    return (
      <div className="student-app soft-bg">
        <StudentHeader />
        <main className="exam-overview-page">
          <p>Memuat detail ujian...</p>
        </main>
      </div>
    );
  const manual = exam.mode === "Koreksi admin";
  return (
    <div className="student-app soft-bg">
      <StudentHeader />
      <main className="exam-overview-page">
        <Link to="/student" className="back-link">
          <ArrowLeft /> Kembali ke beranda
        </Link>
        <div className="exam-overview-card">
          <div
            className={`exam-overview-cover ${manual ? "orange-cover" : "purple-cover"}`}
          >
            <div className="cover-symbol">{manual ? "Aa" : "∑"}</div>
            <div className="cover-dots">{manual ? "“ ”" : "÷ × +"}</div>
          </div>
          <div className="exam-overview-copy">
            <p>
              {exam.subject.toUpperCase()} · KELAS {exam.grades.join(", ")}
            </p>
            <h1>{exam.shortTitle}</h1>
            <span>{exam.description}</span>
            <div className="overview-info-grid">
              <div>
                <Clock3 />
                <span>
                  <small>Durasi</small>
                  <strong>{exam.duration} menit</strong>
                </span>
              </div>
              <div>
                <ListChecks />
                <span>
                  <small>Jumlah soal</small>
                  <strong>{exam.questions} soal</strong>
                </span>
              </div>
              <div>
                <ClipboardCheck />
                <span>
                  <small>Penilaian</small>
                  <strong>{exam.mode}</strong>
                </span>
              </div>
            </div>
            <div className="instruction-box">
              <h3>
                <ShieldCheck /> Sebelum kamu mulai
              </h3>
              <ul>
                <li>Pastikan koneksi internet stabil.</li>
                <li>Jawaban tersimpan otomatis.</li>
                <li>Waktu dan status mengikuti server.</li>
                <li>
                  {manual
                    ? "Nilai akan tampil setelah diperiksa oleh admin."
                    : "Nilai tampil langsung setelah kamu selesai."}
                </li>
              </ul>
            </div>
            <label className="checkbox-row agreement">
              <input
                type="checkbox"
                onChange={(event) => setConfirmed(event.target.checked)}
              />
              <span>Saya sudah membaca petunjuk dan siap mengerjakan.</span>
            </label>
            <button
              className="button primary full large-button"
              disabled={!confirmed}
              onClick={() => navigate(`/student/exam/${exam.id}/attempt`)}
            >
              <Play /> Mulai mengerjakan
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
