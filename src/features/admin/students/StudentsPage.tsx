import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Filter,
  GraduationCap,
  MoreHorizontal,
  Plus,
  Save,
  Sparkles,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { AdminShell } from "../../../components/layout";
import {
  Avatar,
  PageToolbar,
  StatusPill,
  Toast,
  ToastMessage,
} from "../../../components/ui";
import type { Student } from "../../../domain/models";
import { studentRepository } from "../../../repositories";
import { ApiError } from "../../../lib/api";

type NewStudent = { name: string; level: "SD" | "SMP" | "SMA"; grade: number; notes?: string };

function StudentModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (student: NewStudent) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [level, setLevel] = useState<"SD" | "SMP" | "SMA">("SMP");
  const [grade, setGrade] = useState(8);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const phase =
    grade <= 2
      ? "A"
      : grade <= 4
        ? "B"
        : grade <= 6
          ? "C"
          : grade <= 9
            ? "D"
            : grade === 10
              ? "E"
              : "F";
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try { await onSave({ name, level, grade, notes: notes.trim() || undefined }); } finally { setSaving(false); }
  };
  return (
    <div className="modal-backdrop">
      <form className="modal-card" onSubmit={save}>
        <div className="modal-header">
          <div>
            <span className="modal-icon">
              <UserPlus />
            </span>
            <div>
              <h2>Tambah peserta</h2>
              <p>Peserta akan mendapat kode login otomatis.</p>
            </div>
          </div>
          <button type="button" className="icon-button" onClick={onClose}>
            <X />
          </button>
        </div>
        <div className="modal-body">
          <label>
            Nama lengkap <em>*</em>
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Contoh: Nara Ayuningtyas"
            autoFocus
          />
          <div className="form-grid">
            <div>
              <label>
                Jenjang <em>*</em>
              </label>
              <select
                value={level}
                onChange={(e) => {
                  const next = e.target.value as typeof level;
                  setLevel(next);
                  setGrade(next === "SD" ? 1 : next === "SMP" ? 7 : 10);
                }}
              >
                <option>SD</option>
                <option>SMP</option>
                <option>SMA</option>
              </select>
            </div>
            <div>
              <label>
                Kelas <em>*</em>
              </label>
              <select
                value={grade}
                onChange={(e) => setGrade(Number(e.target.value))}
              >
                {(level === "SD"
                  ? [1, 2, 3, 4, 5, 6]
                  : level === "SMP"
                    ? [7, 8, 9]
                    : [10, 11, 12]
                ).map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="phase-info">
            <Sparkles />
            <div>
              <span>Fase otomatis</span>
              <strong>Fase {phase}</strong>
            </div>
            <small>Disesuaikan dari kelas</small>
          </div>
          <label>
            Keterangan <span>(opsional)</span>
          </label>
          <textarea
            placeholder="Catatan tambahan tentang peserta..."
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>
        <div className="modal-footer">
          <button type="button" className="button secondary" onClick={onClose}>
            Batal
          </button>
          <button className="button primary" type="submit" disabled={saving}>
            <Save /> {saving ? "Menyimpan..." : "Simpan peserta"}
          </button>
        </div>
      </form>
    </div>
  );
}

export function StudentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(searchParams.get('create') === '1');
  const [toast, setToast] = useState<Toast | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    studentRepository.list().then(({ students }) => setStudents(students)).catch((cause) => setToast({ message: cause instanceof ApiError ? cause.message : "Gagal memuat peserta" })).finally(() => setLoading(false));
  }, []);
  const filtered = students.filter((student) =>
    `${student.name} ${student.code}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const addStudent = async (input: NewStudent) => {
    const { student, loginCode } = await studentRepository.create(input);
    setStudents((current) => [student, ...current]);
    setShowModal(false);
    setToast({ message: `Peserta ditambahkan. Kode login: ${loginCode}` });
  };
  const closeModal = () => {
    setShowModal(false);
    if (searchParams.has('create')) {
      searchParams.delete('create');
      setSearchParams(searchParams, { replace: true });
    }
  };
  return (
    <AdminShell
      title="Peserta"
      subtitle="Kelola data dan kode akses peserta."
      action={
        <button
          className="button primary desktop-action"
          onClick={() => setShowModal(true)}
        >
          <Plus /> Tambah peserta
        </button>
      }
    >
      {toast && <ToastMessage toast={toast} onClose={() => setToast(null)} />}
      <div className="summary-strip">
        <div>
          <span className="summary-icon teal">
            <Users />
          </span>
          <p>
            <strong>{students.length}</strong>
            <small>Total peserta</small>
          </p>
        </div>
        <div>
          <span className="summary-icon green">
            <CheckCircle2 />
          </span>
          <p>
            <strong>
              {students.filter((s) => s.status === "Aktif").length}
            </strong>
            <small>Akun aktif</small>
          </p>
        </div>
        <div>
          <span className="summary-icon purple">
            <GraduationCap />
          </span>
          <p>
            <strong>3</strong>
            <small>Kelas terdaftar</small>
          </p>
        </div>
      </div>
      <section className="panel table-panel">
        <PageToolbar
          search={search}
          setSearch={setSearch}
          placeholder="Cari nama atau kode peserta..."
        >
          <button className="button secondary">
            <Filter /> Filter <ChevronDown />
          </button>
          <button className="button secondary">
            <Download /> Ekspor PDF
          </button>
        </PageToolbar>
        <div className="filter-chips">
          <button className="filter-chip active">
            Semua <span>{students.length}</span>
          </button>
          <button className="filter-chip">
            Aktif{" "}
            <span>{students.filter((s) => s.status === "Aktif").length}</span>
          </button>
          <button className="filter-chip">
            Nonaktif{" "}
            <span>
              {students.filter((s) => s.status === "Nonaktif").length}
            </span>
          </button>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>
                  <input type="checkbox" />
                </th>
                <th>Nama peserta</th>
                <th>Kode login</th>
                <th>Jenjang / Kelas</th>
                <th>Fase</th>
                <th>Ujian</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={8}>Memuat data peserta...</td></tr>}
              {!loading && filtered.map((student) => (
                <tr key={student.id}>
                  <td>
                    <input type="checkbox" />
                  </td>
                  <td>
                    <div className="person-cell">
                      <Avatar name={student.name} />
                      <div>
                        <strong>{student.name}</strong>
                        <small>
                          ID · RU-{String(student.id).padStart(4, "0")}
                        </small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <button
                      className="code-badge"
                      onClick={() => {
                        navigator.clipboard?.writeText(student.code);
                        setToast({ message: `Kode ${student.code} disalin` });
                      }}
                    >
                      {student.code}
                      <Copy />
                    </button>
                  </td>
                  <td>
                    <strong>{student.level}</strong>
                    <small className="block">Kelas {student.grade}</small>
                  </td>
                  <td>
                    <span className="phase-badge">{student.phase}</span>
                  </td>
                  <td>{student.assigned} ujian</td>
                  <td>
                    <StatusPill>{student.status}</StatusPill>
                  </td>
                  <td>
                    <button className="icon-button" title="Buat kode login baru" onClick={async () => { const code = await studentRepository.regenerateCode(String(student.id)); setStudents(current => current.map(item => item.id === student.id ? { ...item, code } : item)); setToast({ message: `Kode baru ${code}—simpan sekarang, kode hanya ditampilkan sekali.` }); }}>
                      <MoreHorizontal />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-footer">
          <p>
            Menampilkan <strong>{filtered.length}</strong> dari{" "}
            {students.length} peserta
          </p>
          <div className="pagination">
            <button disabled>
              <ChevronLeft />
            </button>
            <button className="active">1</button>
            <button>2</button>
            <button>3</button>
            <button>
              <ChevronRight />
            </button>
          </div>
        </div>
      </section>
      <button className="fab" onClick={() => setShowModal(true)}>
        <Plus />
      </button>
      {showModal && (
        <StudentModal onClose={closeModal} onSave={addStudent} />
      )}
    </AdminShell>
  );
}
