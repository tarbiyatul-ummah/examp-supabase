import { Eye, RefreshCw, Trophy, X } from "lucide-react";
import { useEffect, useState } from "react";
import { AdminShell } from "../../../components/layout";
import { Avatar, ToastMessage } from "../../../components/ui";
import type { Toast } from "../../../components/ui";
import type { ApiLeaderboardSnapshot } from "../../../domain/api";
import type { Exam, LeaderboardEntry } from "../../../domain/models";
import { ApiError } from "../../../lib/api";
import { authRepository, examRepository } from "../../../repositories";

function duration(seconds: number) {
  return `${Math.floor(seconds / 60)}m ${seconds % 60}d`;
}

function mapSnapshot(snapshot: ApiLeaderboardSnapshot | null): LeaderboardEntry[] {
  return (snapshot?.entries ?? []).map((item) => ({
    rank: item.rank,
    studentId: item.studentId,
    name: item.studentName,
    score: item.score,
    duration: duration(item.durationSeconds),
    avatar: "",
  }));
}

function Board({
  exam,
  entries,
  loading,
  fullscreen,
  onClose,
}: {
  exam: Exam | null;
  entries: LeaderboardEntry[];
  loading: boolean;
  fullscreen: boolean;
  onClose: () => void;
}) {
  return (
    <div className={`leaderboard-board ${fullscreen ? "fullscreen-board" : ""}`}>
      <div className="leaderboard-title">
        <span><Trophy /></span>
        <p>LEADERBOARD</p>
        <h2>{exam?.title || "Belum ada ujian dipilih"}</h2>
        <small>{entries.length} hasil final</small>
        {fullscreen && <button type="button" aria-label="Tutup layar penuh" onClick={onClose}><X /></button>}
      </div>
      {entries.length >= 3 && (
        <div className="podium">
          <div className="podium-item second"><Avatar name={entries[1].name} size="lg" /><span>2</span><strong>{entries[1].name}</strong><b>{entries[1].score}</b></div>
          <div className="podium-item first"><Avatar name={entries[0].name} size="lg" /><span>1</span><strong>{entries[0].name}</strong><b>{entries[0].score}</b></div>
          <div className="podium-item third"><Avatar name={entries[2].name} size="lg" /><span>3</span><strong>{entries[2].name}</strong><b>{entries[2].score}</b></div>
        </div>
      )}
      <div className="leaderboard-list">
        {entries.slice(entries.length >= 3 ? 3 : 0).map((item) => (
          <div key={`${item.rank}-${item.studentId}`}><span>{item.rank}</span><Avatar name={item.name} /><strong>{item.name}</strong><small>{item.duration}</small><b>{item.score}</b></div>
        ))}
      </div>
      {!entries.length && (
        <div className="leaderboard-empty-board">
          <strong>{loading ? "Memuat leaderboard..." : exam ? "Leaderboard belum dibuat" : "Pilih ujian selesai"}</strong>
          <p>{loading ? "Mengambil snapshot terbaru dari server." : exam ? "Klik Generate leaderboard untuk mengambil hasil final dari server." : "Leaderboard tersedia setelah ujian selesai dan nilai peserta sudah final."}</p>
        </div>
      )}
    </div>
  );
}

export function LeaderboardPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [examId, setExamId] = useState("");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [fullscreen, setFullscreen] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [loadingExams, setLoadingExams] = useState(true);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const [loading, setLoading] = useState(false);
  const currentAdmin = authRepository.session()?.profile;

  useEffect(() => {
    examRepository.list().then((items) => {
      const available = items.filter((item) => item.status === "Selesai");
      setExams(available);
      setExamId(String(available[0]?.id || ""));
    }).catch((cause) => {
      setToast({ message: cause instanceof ApiError ? cause.message : "Gagal memuat ujian" });
    }).finally(() => setLoadingExams(false));
  }, []);

  useEffect(() => {
    if (!examId) {
      setEntries([]);
      setLoadingSnapshot(false);
      return;
    }
    let cancelled = false;
    setEntries([]);
    setLoadingSnapshot(true);
    examRepository.latestLeaderboard(examId)
      .then((snapshot) => {
        if (!cancelled) setEntries(mapSnapshot(snapshot));
      })
      .catch((cause) => {
        if (!cancelled) {
          setToast({ message: cause instanceof ApiError ? cause.message : "Gagal memuat leaderboard" });
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingSnapshot(false);
      });
    return () => { cancelled = true; };
  }, [examId]);

  const exam = exams.find((item) => String(item.id) === examId) || null;
  const generate = async () => {
    if (!examId) return;
    setLoading(true);
    try {
      const snapshot = await examRepository.generateLeaderboard(examId, "all", "all");
      setEntries(mapSnapshot(snapshot));
      setToast({ message: "Snapshot leaderboard berhasil dibuat" });
    } catch (cause) {
      setToast({ message: cause instanceof ApiError ? cause.message : "Gagal membuat leaderboard" });
    } finally {
      setLoading(false);
    }
  };

  const busy = loading || loadingSnapshot;

  if (fullscreen) return <Board exam={exam} entries={entries} loading={false} fullscreen onClose={() => setFullscreen(false)} />;

  return (
    <AdminShell
      title="Leaderboard"
      subtitle="Buat dan tampilkan peringkat dari hasil ujian final."
      action={<button className="button primary desktop-action" disabled={!examId || busy} onClick={() => void generate()}><RefreshCw className={busy ? "spin" : ""} /> {loading ? "Memproses..." : loadingSnapshot ? "Memuat..." : "Generate leaderboard"}</button>}
    >
      {toast && <ToastMessage toast={toast} onClose={() => setToast(null)} />}
      <section className={`leaderboard-selection panel ${!exam ? "empty" : ""}`}>
        <span className="subject-icon" style={{ background: exam?.color }}>{exam?.subject.slice(0, 2).toUpperCase() || <Trophy />}</span>
        <div>
          <small>SUMBER LEADERBOARD</small>
          <strong>{loadingExams ? "Memuat ujian..." : exam?.title || "Belum ada ujian selesai"}</strong>
          <p>{exam ? `${entries.length} hasil final pada snapshot saat ini` : "Selesaikan ujian dan finalkan nilai sebelum membuat peringkat."}</p>
        </div>
        {exams.length > 0 && (
          <label className="leaderboard-exam-select">
            <span>Pilih ujian selesai</span>
            <select value={examId} onChange={(event) => setExamId(event.target.value)}>
              {exams.map((item) => <option value={String(item.id)} key={item.id}>{item.title}</option>)}
            </select>
          </label>
        )}
      </section>
      <div className="leaderboard-layout">
        <Board exam={exam} entries={entries} loading={loadingSnapshot} fullscreen={false} onClose={() => {}} />
        <aside className="leaderboard-side">
          <section className="panel">
            <h3>Publikasi</h3>
            <p>Snapshot berisi nilai otomatis yang final atau nilai manual yang sudah diterbitkan oleh {currentAdmin?.name || "Admin"}.</p>
            <button className="button primary full" disabled={!entries.length} onClick={() => setFullscreen(true)}><Eye /> Tampilkan layar penuh</button>
          </section>
          <button className="button primary mobile-leaderboard-generate" disabled={!examId || busy} onClick={() => void generate()}><RefreshCw className={busy ? "spin" : ""} /> {loading ? "Memproses..." : loadingSnapshot ? "Memuat..." : "Generate leaderboard"}</button>
        </aside>
      </div>
    </AdminShell>
  );
}
