import { Eye, RefreshCw, Trophy, X } from "lucide-react";
import { useEffect, useState } from "react";
import { AdminShell } from "../../../components/layout";
import { Avatar, Toast, ToastMessage } from "../../../components/ui";
import type { Exam, LeaderboardEntry } from "../../../domain/models";
import { authRepository, examRepository } from "../../../repositories";

function duration(seconds: number) { return `${Math.floor(seconds / 60)}m ${seconds % 60}d`; }

function Board({ exam, entries, fullscreen, onClose }: { exam: Exam | null; entries: LeaderboardEntry[]; fullscreen: boolean; onClose: () => void }) {
  return <div className={`leaderboard-board ${fullscreen ? "fullscreen-board" : ""}`}><div className="leaderboard-title"><span><Trophy /></span><p>LEADERBOARD</p><h2>{exam?.title || "Belum ada snapshot"}</h2><small>{entries.length} hasil final</small>{fullscreen && <button onClick={onClose}><X /></button>}</div>{entries.length >= 3 && <div className="podium"><div className="podium-item second"><Avatar name={entries[1].name} size="lg" /><span>2</span><strong>{entries[1].name}</strong><b>{entries[1].score}</b></div><div className="podium-item first"><Avatar name={entries[0].name} size="lg" /><span>1</span><strong>{entries[0].name}</strong><b>{entries[0].score}</b></div><div className="podium-item third"><Avatar name={entries[2].name} size="lg" /><span>3</span><strong>{entries[2].name}</strong><b>{entries[2].score}</b></div></div>}<div className="leaderboard-list">{entries.slice(entries.length >= 3 ? 3 : 0).map(item => <div key={item.rank}><span>{item.rank}</span><Avatar name={item.name} /><strong>{item.name}</strong><small>{item.duration}</small><b>{item.score}</b></div>)}</div>{entries.length === 0 && <p className="leaderboard-foot">Generate snapshot untuk menampilkan hasil final dari server.</p>}</div>;
}

export function LeaderboardPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [examId, setExamId] = useState("");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [fullscreen, setFullscreen] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [loading, setLoading] = useState(false);
  const currentAdmin = authRepository.session()?.profile;
  useEffect(() => { examRepository.list().then(items => { const available = items.filter(item => item.status !== "Draf"); setExams(available); setExamId(String(available[0]?.id || "")); }); }, []);
  const exam = exams.find(item => String(item.id) === examId) || null;
  const generate = async () => {
    if (!examId) return;
    setLoading(true);
    try {
      const raw = await examRepository.generateLeaderboard(examId, "all", "all");
      const source = (raw.Entries || raw.entries || []) as Array<Record<string, unknown>>;
      setEntries(source.map(item => ({ rank: Number(item.rank ?? item.Rank), studentId: String(item.studentId ?? item.StudentID), name: String(item.studentName ?? item.StudentName ?? "Peserta"), score: Number(item.score ?? item.Score), duration: duration(Number(item.durationSeconds ?? item.DurationSeconds)), avatar: "" })));
      setToast({ message: "Snapshot leaderboard berhasil dibuat" });
    } finally { setLoading(false); }
  };
  if (fullscreen) return <Board exam={exam} entries={entries} fullscreen onClose={() => setFullscreen(false)} />;
  return <AdminShell title="Leaderboard" subtitle="Buat dan tampilkan peringkat hasil ujian." action={<button className="button primary desktop-action" disabled={!examId || loading} onClick={() => void generate()}><RefreshCw /> {loading ? "Memproses..." : "Generate leaderboard"}</button>}>{toast && <ToastMessage toast={toast} onClose={() => setToast(null)} />}<div className="leaderboard-selection panel"><span className="subject-icon" style={{ background: exam?.color }}>{exam?.subject.slice(0, 2).toUpperCase() || "--"}</span><div><small>UJIAN</small><strong>{exam?.title || "Belum ada ujian selesai"}</strong><p>{entries.length} hasil final</p></div><select value={examId} onChange={event => { setExamId(event.target.value); setEntries([]); }}>{exams.map(item => <option value={String(item.id)} key={item.id}>{item.title}</option>)}</select></div><div className="leaderboard-layout"><Board exam={exam} entries={entries} fullscreen={false} onClose={() => {}} /><aside className="leaderboard-side"><section className="panel"><h3>Publikasi</h3><p>Snapshot dibuat dari hasil final oleh {currentAdmin?.name || "Admin"}.</p><button className="button primary full" disabled={!entries.length} onClick={() => setFullscreen(true)}><Eye /> Tampilkan layar penuh</button></section></aside></div></AdminShell>;
}
