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
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import { AdminShell } from "../../../components/layout";
import { Avatar, PageToolbar, StatusPill, Toast, ToastMessage } from "../../../components/ui";
import type { EntityId, Student } from "../../../domain/models";
import { ApiError } from "../../../lib/api";
import { downloadTablePdf } from "../../../lib/pdf";
import { studentRepository } from "../../../repositories";

type NewStudent = { name: string; level: "SD" | "SMP" | "SMA"; grade: number; notes?: string };
type StatusTab = "all" | "active" | "inactive";
const PAGE_SIZE = 10;

function StudentModal({ onClose, onSave }: { onClose: () => void; onSave: (student: NewStudent) => Promise<void> }) {
  const [name, setName] = useState("");
  const [level, setLevel] = useState<NewStudent["level"]>("SMP");
  const [grade, setGrade] = useState(8);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const phase = grade <= 2 ? "A" : grade <= 4 ? "B" : grade <= 6 ? "C" : grade <= 9 ? "D" : grade === 10 ? "E" : "F";
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try { await onSave({ name: name.trim(), level, grade, notes: notes.trim() || undefined }); }
    finally { setSaving(false); }
  };
  const gradeOptions = level === "SD" ? [1, 2, 3, 4, 5, 6] : level === "SMP" ? [7, 8, 9] : [10, 11, 12];
  return (
    <div className="modal-backdrop">
      <form className="modal-card" onSubmit={save}>
        <div className="modal-header">
          <div><span className="modal-icon"><UserPlus /></span><div><h2>Tambah peserta</h2><p>Peserta akan mendapat kode login otomatis.</p></div></div>
          <button type="button" className="icon-button" onClick={onClose}><X /></button>
        </div>
        <div className="modal-body">
          <label>Nama lengkap <em>*</em></label>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Contoh: Nara Ayuningtyas" autoFocus />
          <div className="form-grid">
            <div>
              <label>Jenjang <em>*</em></label>
              <select value={level} onChange={(event) => { const next = event.target.value as NewStudent["level"]; setLevel(next); setGrade(next === "SD" ? 1 : next === "SMP" ? 7 : 10); }}>
                <option>SD</option><option>SMP</option><option>SMA</option>
              </select>
            </div>
            <div><label>Kelas <em>*</em></label><select value={grade} onChange={(event) => setGrade(Number(event.target.value))}>{gradeOptions.map((value) => <option key={value}>{value}</option>)}</select></div>
          </div>
          <div className="phase-info"><Sparkles /><div><span>Fase otomatis</span><strong>Fase {phase}</strong></div><small>Disesuaikan dari kelas</small></div>
          <label>Keterangan <span>(opsional)</span></label>
          <textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Catatan tambahan tentang peserta..." />
        </div>
        <div className="modal-footer">
          <button type="button" className="button secondary" onClick={onClose}>Batal</button>
          <button className="button primary" type="submit" disabled={saving}><Save /> {saving ? "Menyimpan..." : "Simpan peserta"}</button>
        </div>
      </form>
    </div>
  );
}

export function StudentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [students, setStudents] = useState<Student[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState<StatusTab>("all");
  const [levelFilter, setLevelFilter] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<EntityId>>(new Set());
  const [openMenuId, setOpenMenuId] = useState<EntityId | null>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const rowMenuRef = useRef<HTMLDivElement>(null);
  const rowMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const [showModal, setShowModal] = useState(searchParams.get("create") === "1");
  const [toast, setToast] = useState<Toast | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const apiFilters = useMemo(() => ({
    search: search.trim() || undefined,
    level: levelFilter || undefined,
    grade: gradeFilter ? Number(gradeFilter) : undefined,
    status: statusTab === "all" ? undefined : statusTab,
  }), [gradeFilter, levelFilter, search, statusTab]);

  const loadStudents = useCallback(async () => {
    setLoading(true);
    try {
      const response = await studentRepository.list({ ...apiFilters, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });
      setStudents(response.students);
      setTotal(response.page?.total ?? response.students.length);
    } catch (cause) {
      setToast({ message: cause instanceof ApiError ? cause.message : "Gagal memuat peserta" });
    } finally { setLoading(false); }
  }, [apiFilters, page]);

  const loadSummary = useCallback(async () => {
    try { setAllStudents((await studentRepository.list({ limit: 200, offset: 0 })).students); } catch { /* tabel utama menampilkan error */ }
  }, []);

  useEffect(() => { const timer = setTimeout(() => void loadStudents(), search ? 300 : 0); return () => clearTimeout(timer); }, [loadStudents, search]);
  useEffect(() => { void loadSummary(); }, [loadSummary]);
  useEffect(() => { setPage(1); }, [gradeFilter, levelFilter, search, statusTab]);
  useEffect(() => {
    if (openMenuId === null) return;
    const close = () => setOpenMenuId(null);
    const closeOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !rowMenuRef.current?.contains(target) &&
        !rowMenuTriggerRef.current?.contains(target)
      ) close();
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("mousedown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("mousedown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [openMenuId]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);
  const allOnPageSelected = students.length > 0 && students.every((student) => selectedIds.has(student.id));
  const statusCounts = {
    all: allStudents.length,
    active: allStudents.filter((student) => student.status === "Aktif").length,
    inactive: allStudents.filter((student) => student.status === "Nonaktif").length,
  };

  const addStudent = async (input: NewStudent) => {
    const { loginCode } = await studentRepository.create(input);
    setShowModal(false);
    if (page === 1) await loadStudents();
    else setPage(1);
    await loadSummary();
    setToast({ message: `Peserta ditambahkan. Kode login: ${loginCode}` });
  };

  const closeModal = () => {
    setShowModal(false);
    if (searchParams.has("create")) { searchParams.delete("create"); setSearchParams(searchParams, { replace: true }); }
  };

  const exportPdf = async () => {
    setExporting(true);
    try {
      const source = (await studentRepository.list({ ...apiFilters, limit: 200, offset: 0 })).students
        .filter((student) => !selectedIds.size || selectedIds.has(student.id));
      downloadTablePdf({
        filename: `peserta-${new Date().toISOString().slice(0, 10)}.pdf`,
        title: "Daftar Peserta RuangUji",
        headers: ["No", "Nama", "Kode", "Jenjang", "Kelas", "Fase", "Status"],
        widths: [4, 27, 12, 8, 7, 6, 10],
        rows: source.map((student, index) => [index + 1, student.name, student.code, student.level, student.grade, student.phase, student.status]),
      });
      setToast({ message: `${source.length} peserta diekspor ke PDF` });
    } catch (cause) {
      setToast({ message: cause instanceof ApiError ? cause.message : "Gagal mengekspor PDF" });
    } finally { setExporting(false); }
  };

  const pageNumbers = Array.from({ length: pageCount }, (_, index) => index + 1).filter((value) => Math.abs(value - page) <= 2);
  const menuStudent = students.find((student) => student.id === openMenuId);
  const toggleRowMenu = (studentId: EntityId, trigger: HTMLButtonElement) => {
    if (openMenuId === studentId) {
      setOpenMenuId(null);
      return;
    }
    const rect = trigger.getBoundingClientRect();
    const menuWidth = 210;
    const menuHeight = 108;
    const gap = 7;
    const left = Math.min(
      window.innerWidth - menuWidth - 10,
      Math.max(10, rect.right - menuWidth),
    );
    const top = rect.bottom + gap + menuHeight <= window.innerHeight
      ? rect.bottom + gap
      : Math.max(10, rect.top - menuHeight - gap);
    rowMenuTriggerRef.current = trigger;
    setMenuPosition({ top, left });
    setOpenMenuId(studentId);
  };
  return (
    <AdminShell title="Peserta" subtitle="Kelola data dan kode akses peserta." action={<button className="button primary desktop-action" onClick={() => setShowModal(true)}><Plus /> Tambah peserta</button>}>
      {toast && <ToastMessage toast={toast} onClose={() => setToast(null)} />}
      <div className="summary-strip">
        <div><span className="summary-icon teal"><Users /></span><p><strong>{statusCounts.all}</strong><small>Total peserta</small></p></div>
        <div><span className="summary-icon green"><CheckCircle2 /></span><p><strong>{statusCounts.active}</strong><small>Akun aktif</small></p></div>
        <div><span className="summary-icon purple"><GraduationCap /></span><p><strong>{new Set(allStudents.map((student) => `${student.level}-${student.grade}`)).size}</strong><small>Kelas terdaftar</small></p></div>
      </div>
      <section className="panel table-panel">
        <PageToolbar search={search} setSearch={setSearch} placeholder="Cari nama atau kode peserta...">
          <div className="toolbar-filter">
            <button className={`button secondary ${levelFilter || gradeFilter ? "active" : ""}`} onClick={() => setFiltersOpen((open) => !open)}><Filter /> Filter <ChevronDown /></button>
            {filtersOpen && (
              <div className="filter-popover">
                <label>Jenjang</label>
                <select value={levelFilter} onChange={(event) => { setLevelFilter(event.target.value); setGradeFilter(""); }}><option value="">Semua jenjang</option><option value="SD">SD</option><option value="SMP">SMP</option><option value="SMA">SMA</option></select>
                <label>Kelas</label>
                <select value={gradeFilter} onChange={(event) => setGradeFilter(event.target.value)}><option value="">Semua kelas</option>{(levelFilter === "SD" ? [1, 2, 3, 4, 5, 6] : levelFilter === "SMP" ? [7, 8, 9] : levelFilter === "SMA" ? [10, 11, 12] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]).map((grade) => <option key={grade}>{grade}</option>)}</select>
                <button className="text-button" onClick={() => { setLevelFilter(""); setGradeFilter(""); setFiltersOpen(false); }}>Reset filter</button>
              </div>
            )}
          </div>
          <button className="button secondary" disabled={exporting} onClick={() => void exportPdf()}><Download /> {exporting ? "Menyiapkan..." : selectedIds.size ? `Ekspor ${selectedIds.size} dipilih` : "Ekspor PDF"}</button>
        </PageToolbar>
        <div className="filter-chips">
          {(["all", "active", "inactive"] as StatusTab[]).map((status) => <button key={status} className={`filter-chip ${statusTab === status ? "active" : ""}`} onClick={() => setStatusTab(status)}>{status === "all" ? "Semua" : status === "active" ? "Aktif" : "Nonaktif"} <span>{statusCounts[status]}</span></button>)}
        </div>
        <div className="table-scroll">
          <table>
            <thead><tr><th><input type="checkbox" checked={allOnPageSelected} aria-label="Pilih semua peserta di halaman ini" onChange={() => setSelectedIds((current) => { const next = new Set(current); students.forEach((student) => allOnPageSelected ? next.delete(student.id) : next.add(student.id)); return next; })} /></th><th>Nama peserta</th><th>Kode login</th><th>Jenjang / Kelas</th><th>Ujian</th><th>Status</th><th /></tr></thead>
            <tbody>
              {loading && <tr><td colSpan={7}>Memuat data peserta...</td></tr>}
              {!loading && !students.length && <tr><td colSpan={7}>Tidak ada peserta yang sesuai filter.</td></tr>}
              {!loading && students.map((student) => (
                <tr key={student.id}>
                  <td><input type="checkbox" checked={selectedIds.has(student.id)} aria-label={`Pilih ${student.name}`} onChange={() => setSelectedIds((current) => { const next = new Set(current); next.has(student.id) ? next.delete(student.id) : next.add(student.id); return next; })} /></td>
                  <td><div className="person-cell"><Avatar name={student.name} /><div><strong>{student.name}</strong></div></div></td>
                  <td><button className="code-badge" onClick={() => { void navigator.clipboard?.writeText(student.code); setToast({ message: `Kode ${student.code} disalin` }); }}>{student.code}<Copy /></button></td>
                  <td><strong>{student.level}</strong><small className="block">Kelas {student.grade}</small></td>
                  <td>{student.assigned} ujian</td><td><StatusPill>{student.status}</StatusPill></td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="icon-button"
                        title="Aksi peserta"
                        aria-haspopup="menu"
                        aria-expanded={openMenuId === student.id}
                        onClick={(event) => toggleRowMenu(student.id, event.currentTarget)}
                      ><MoreHorizontal /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-footer">
          <p>Menampilkan <strong>{students.length}</strong> dari {total} peserta</p>
          <div className="pagination">
            <button disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft /></button>
            {pageNumbers.map((number) => <button key={number} className={number === page ? "active" : ""} onClick={() => setPage(number)}>{number}</button>)}
            <button disabled={page === pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}><ChevronRight /></button>
          </div>
        </div>
      </section>
      <button className="fab" onClick={() => setShowModal(true)}><Plus /></button>
      {showModal && <StudentModal onClose={closeModal} onSave={addStudent} />}
      {menuStudent && createPortal(
        <div
          ref={rowMenuRef}
          className="row-action-menu row-action-menu-portal"
          role="menu"
          style={menuPosition}
        >
          <button role="menuitem" onClick={async () => { try { const code = await studentRepository.regenerateCode(String(menuStudent.id)); setStudents((current) => current.map((item) => item.id === menuStudent.id ? { ...item, code } : item)); setToast({ message: `Kode baru ${code} — simpan sekarang.` }); } catch (cause) { setToast({ message: cause instanceof ApiError ? cause.message : "Gagal membuat kode baru" }); } finally { setOpenMenuId(null); } }}>Buat kode login baru</button>
          <button role="menuitem" onClick={async () => { try { const nextStatus = menuStudent.status === "Aktif" ? "inactive" : "active"; await studentRepository.update(String(menuStudent.id), { status: nextStatus }); await Promise.all([loadStudents(), loadSummary()]); setToast({ message: `${menuStudent.name} ${nextStatus === "active" ? "diaktifkan" : "dinonaktifkan"}` }); } catch (cause) { setToast({ message: cause instanceof ApiError ? cause.message : "Gagal mengubah status" }); } finally { setOpenMenuId(null); } }}>{menuStudent.status === "Aktif" ? "Nonaktifkan akun" : "Aktifkan akun"}</button>
        </div>,
        document.body,
      )}
    </AdminShell>
  );
}
