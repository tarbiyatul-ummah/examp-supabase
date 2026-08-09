import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ClipboardCheck,
  FileText,
  Plus,
  Send,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AdminShell } from "../../../components/layout";
import {
  Avatar,
  RichTextEditor,
  Toast,
  ToastMessage,
} from "../../../components/ui";
import type { RichTextDraftImage } from "../../../components/ui";
import type {
  AcademicLevel,
  EntityId,
  QuestionType,
  Student,
} from "../../../domain/models";
import { ApiError } from "../../../lib/api";
import { examRepository, studentRepository } from "../../../repositories";
import {
  documentText,
  htmlText,
  richTextDocument,
  textDocument,
} from "../../../repositories/mappers";

type Mode = "instant" | "manual";
type DraftQuestion = {
  clientId: string;
  type: QuestionType;
  contentHtml: string;
  images: RichTextDraftImage[];
  options: string[];
  correct: number;
  acceptedAnswer: string;
  weight: number;
};

const gradesForLevel: Record<AcademicLevel, number[]> = {
  SD: [1, 2, 3, 4, 5, 6],
  SMP: [7, 8, 9],
  SMA: [10, 11, 12],
};

const newQuestion = (): DraftQuestion => ({
  clientId: crypto.randomUUID(),
  type: "Pilihan ganda",
  contentHtml: "",
  images: [],
  options: ["", "", "", ""],
  correct: 0,
  acceptedAnswer: "",
  weight: 1,
});

const typeMap: Record<QuestionType, string> = {
  "Pilihan ganda": "multiple_choice",
  "Isian angka": "numeric",
  "Isian pendek": "short_text",
  "Isian panjang": "long_text",
};

export function ExamEditorPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState(45);
  const [level, setLevel] = useState<AcademicLevel>("SMP");
  const [grades, setGrades] = useState<number[]>([8]);
  const [gradeMenuOpen, setGradeMenuOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("instant");
  const [questions, setQuestions] = useState<DraftQuestion[]>([newQuestion()]);
  const [activeId, setActiveId] = useState(questions[0].clientId);
  const [students, setStudents] = useState<Student[]>([]);
  const [selected, setSelected] = useState<EntityId[]>([]);
  const [serverExamId, setServerExamId] = useState(id || "");
  const uploaded = useRef(new Set<string>());
  const uploadedMedia = useRef(
    new Map<
      string,
      Awaited<ReturnType<typeof examRepository.uploadQuestionImage>>
    >(),
  );
  const previewUrls = useRef(new Set<string>());
  const gradeMenuRef = useRef<HTMLDivElement>(null);
  const [publishing, setPublishing] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [error, setError] = useState("");

  const availableGrades = gradesForLevel[level];
  const active =
    questions.find((question) => question.clientId === activeId) ||
    questions[0];
  const targetStudents = useMemo(
    () =>
      students.filter(
        (student) => student.level === level && grades.includes(student.grade),
      ),
    [grades, level, students],
  );

  useEffect(() => {
    studentRepository.list().then((response) => setStudents(response.students));
  }, []);

  useEffect(() => {
    if (!gradeMenuOpen) return;
    const closeOutside = (event: MouseEvent) => {
      if (!gradeMenuRef.current?.contains(event.target as Node))
        setGradeMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setGradeMenuOpen(false);
    };
    document.addEventListener("mousedown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [gradeMenuOpen]);

  useEffect(() => {
    if (!id) return;
    examRepository.listRaw().then((items) => {
      const exam = items.find((item) => item.id === id);
      if (!exam) return;
      const nextLevel = exam.targetLevel || "SMP";
      setName(exam.name);
      setDescription(documentText(exam.descriptionDoc));
      setDuration(Math.round(exam.durationSeconds / 60));
      setLevel(nextLevel);
      setGrades(
        exam.targetGrades.length
          ? [...exam.targetGrades].sort((a, b) => a - b)
          : [gradesForLevel[nextLevel][0]],
      );
      setMode(exam.gradingMode === "manual_review" ? "manual" : "instant");
    });
  }, [id]);

  useEffect(
    () => () => {
      previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
      previewUrls.current.clear();
    },
    [],
  );

  const updateActive = (changes: Partial<DraftQuestion>) => {
    setQuestions((items) =>
      items.map((item) =>
        item.clientId === active.clientId ? { ...item, ...changes } : item,
      ),
    );
  };

  const addQuestion = () => {
    const question = newQuestion();
    setQuestions((items) => [...items, question]);
    setActiveId(question.clientId);
  };

  const changeLevel = (nextLevel: AcademicLevel) => {
    setLevel(nextLevel);
    setGrades([gradesForLevel[nextLevel][0]]);
    setSelected([]);
    setGradeMenuOpen(false);
  };

  const toggleGrade = (grade: number) => {
    setGrades((current) =>
      current.includes(grade)
        ? current.filter((value) => value !== grade)
        : [...current, grade].sort((a, b) => a - b),
    );
  };

  const metadata = {
    name: name.trim(),
    descriptionDoc: textDocument(description),
    durationSeconds: duration * 60,
    targetLevel: level,
    targetGrades: grades,
    gradingMode: mode === "manual" ? "manual_review" : "instant_result",
    shuffleOptions: true,
  };

  const validateInformation = () => {
    if (!name.trim()) return "Nama ujian wajib diisi.";
    if (duration <= 0) return "Durasi harus lebih dari nol.";
    if (!grades.length) return "Pilih minimal satu kelas target.";
    return "";
  };

  const validateQuestions = () => {
    if (!questions.length) return "Minimal satu soal diperlukan.";
    for (const [index, question] of questions.entries()) {
      if (!htmlText(question.contentHtml) && !question.images.length)
        return `Pertanyaan soal ${index + 1} belum diisi.`;
      if (question.weight <= 0)
        return `Bobot soal ${index + 1} harus lebih dari nol.`;
      if (question.images.some((image) => !image.altText.trim()))
        return `Teks alternatif gambar soal ${index + 1} wajib diisi.`;
      if (
        question.type === "Pilihan ganda" &&
        (question.options.length < 2 ||
          question.options.some((option) => !option.trim()))
      ) {
        return `Pilihan jawaban soal ${index + 1} belum lengkap.`;
      }
      if (
        mode === "instant" &&
        ["Isian angka", "Isian pendek"].includes(question.type) &&
        !question.acceptedAnswer.trim()
      ) {
        return `Kunci soal ${index + 1} wajib diisi.`;
      }
      if (mode === "instant" && question.type === "Isian panjang") {
        return "Isian panjang hanya tersedia untuk koreksi admin.";
      }
    }
    return "";
  };

  const validateParticipants = () =>
    selected.length ? "" : "Pilih minimal satu peserta untuk ujian ini.";

  const validationForStep = (stepNumber: number) => {
    if (stepNumber === 1) return validateInformation();
    if (stepNumber === 2) return validateQuestions();
    if (stepNumber === 3) return validateParticipants();
    return "";
  };

  const firstInvalidStep = (lastStep = 3) => {
    for (let stepNumber = 1; stepNumber <= lastStep; stepNumber += 1) {
      const message = validationForStep(stepNumber);
      if (message) return { stepNumber, message };
    }
    return null;
  };

  const goToStep = (nextStep: number) => {
    if (nextStep <= step) {
      setError("");
      setStep(nextStep);
      return;
    }
    const invalid = firstInvalidStep(Math.min(nextStep - 1, 3));
    if (invalid) {
      setError(invalid.message);
      setStep(invalid.stepNumber);
      return;
    }
    setError("");
    setStep(nextStep);
  };

  const publish = async () => {
    const invalid = firstInvalidStep();
    if (invalid) {
      setError(invalid.message);
      setStep(invalid.stepNumber);
      return;
    }
    setPublishing(true);
    setError("");
    try {
      let examId = serverExamId;
      if (examId) {
        await examRepository.update(examId, metadata);
      } else {
        const created = await examRepository.create(metadata);
        examId = created.id;
        setServerExamId(examId);
      }

      for (const [index, question] of questions.entries()) {
        if (uploaded.current.has(question.clientId)) continue;
        const mediaById: Record<
          string,
          Awaited<ReturnType<typeof examRepository.uploadQuestionImage>>
        > = {};
        for (const image of question.images) {
          let media = uploadedMedia.current.get(image.id);
          if (!media) {
            media = await examRepository.uploadQuestionImage(
              examId,
              image.file,
              {
                altText: image.altText.trim(),
                width: image.width,
                height: image.height,
              },
            );
            uploadedMedia.current.set(image.id, media);
          }
          mediaById[image.id] = media;
        }
        await examRepository.addQuestion(examId, {
          type: typeMap[question.type],
          contentDoc: richTextDocument(question.contentHtml, mediaById),
          weight: question.weight,
          position: index + 1,
          shuffleOptions: question.type === "Pilihan ganda",
          options:
            question.type === "Pilihan ganda"
              ? question.options.map((option, optionIndex) => ({
                  id: "",
                  contentDoc: textDocument(option),
                  position: optionIndex + 1,
                  isCorrect: optionIndex === question.correct,
                }))
              : [],
          acceptedAnswers:
            ["Isian angka", "Isian pendek"].includes(question.type) &&
            question.acceptedAnswer.trim()
              ? [{ id: "", raw: question.acceptedAnswer.trim() }]
              : [],
        });
        uploaded.current.add(question.clientId);
      }

      if (selected.length) await examRepository.assign(examId, selected);
      await examRepository.publish(examId);
      setToast({ message: "Ujian berhasil diterbitkan" });
      setTimeout(() => navigate(`/admin/exams/${examId}`), 700);
    } catch (cause) {
      setError(
        cause instanceof ApiError ? cause.message : "Gagal menyimpan ujian.",
      );
    } finally {
      setPublishing(false);
    }
  };

  return (
    <AdminShell
      title={id ? "Edit ujian" : "Buat ujian baru"}
      subtitle="Data pada alur ini disimpan ke backend saat diterbitkan."
    >
      {toast && <ToastMessage toast={toast} onClose={() => setToast(null)} />}

      <div className="stepper">
        {[
          "Informasi ujian",
          "Susun soal",
          "Pilih peserta",
          "Tinjau & terbitkan",
        ].map((label, index) => (
          <button
            type="button"
            key={label}
            className={`${index + 1 === step ? "active" : ""} ${index + 1 < step ? "done" : ""}`}
            aria-current={index + 1 === step ? "step" : undefined}
            onClick={() => goToStep(index + 1)}
          >
            <span>{index + 1 < step ? <Check /> : index + 1}</span>
            <small>{label}</small>
            {index < 3 && <i />}
          </button>
        ))}
      </div>

      {error && (
        <div className="review-alert">
          <span>
            <ClipboardCheck />
          </span>
          <div>
            <strong>Tidak dapat melanjutkan</strong>
            <p>{error}</p>
          </div>
        </div>
      )}

      {step === 1 && (
        <section className="editor-section form-section">
          <div className="section-title">
            <span>
              <FileText />
            </span>
            <div>
              <h2>Informasi ujian</h2>
              <p>Atur informasi dasar yang dilihat peserta.</p>
            </div>
          </div>
          <div className="form-card">
            <label>Nama ujian *</label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Matematika — PTS"
            />
            <label>Deskripsi</label>
            <textarea
              rows={4}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
            <div className="form-grid three">
              <div>
                <label>Durasi (Dalam menit)</label>
                <input
                  type="number"
                  min={1}
                  value={duration}
                  onChange={(event) => setDuration(Number(event.target.value))}
                />
              </div>
              <div>
                <label>Jenjang</label>
                <select
                  value={level}
                  onChange={(event) =>
                    changeLevel(event.target.value as AcademicLevel)
                  }
                >
                  <option>SD</option>
                  <option>SMP</option>
                  <option>SMA</option>
                </select>
              </div>
              <div>
                <label>Kelas target</label>
                <div className="grade-multiselect" ref={gradeMenuRef}>
                  <button
                    type="button"
                    className={`grade-multiselect-trigger ${gradeMenuOpen ? "open" : ""} ${!grades.length ? "invalid" : ""}`}
                    aria-haspopup="true"
                    aria-expanded={gradeMenuOpen}
                    onClick={() => setGradeMenuOpen((open) => !open)}
                  >
                    <span>{grades.length ? `Kelas ${grades.join(", ")}` : "Pilih kelas"}</span>
                    <ChevronDown />
                  </button>
                  {gradeMenuOpen && (
                    <div className="grade-multiselect-menu" role="group" aria-label="Pilih kelas target">
                      <div className="grade-multiselect-head"><strong>Pilih kelas</strong><small>{grades.length} dipilih</small></div>
                      {availableGrades.map((grade) => (
                        <label className="grade-multiselect-option" key={grade}>
                          <input type="checkbox" checked={grades.includes(grade)} onChange={() => toggleGrade(grade)} />
                          <span>Kelas {grade}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                <small
                  className={`grade-helper ${grades.length ? "" : "error"}`}
                >
                  {grades.length
                    ? `${grades.length} kelas dipilih`
                    : "Pilih minimal satu kelas"}
                </small>
              </div>
            </div>
            <label>Mode penilaian</label>
            <div className="mode-cards">
              <button
                type="button"
                className={mode === "instant" ? "active" : ""}
                onClick={() => setMode("instant")}
              >
                <span>
                  <Sparkles />
                </span>
                <div>
                  <strong>Nilai langsung</strong>
                  <p>Dinilai otomatis setelah submit.</p>
                </div>
              </button>
              <button
                type="button"
                className={mode === "manual" ? "active" : ""}
                onClick={() => setMode("manual")}
              >
                <span>
                  <ClipboardCheck />
                </span>
                <div>
                  <strong>Koreksi admin</strong>
                  <p>Hasil ditahan hingga diterbitkan.</p>
                </div>
              </button>
            </div>
          </div>
          <div className="editor-actions">
            <Link to="/admin/exams" className="button secondary">
              Batal
            </Link>
            <button
              type="button"
              className="button primary"
              onClick={() => goToStep(2)}
            >
              Lanjut susun soal <ArrowRight />
            </button>
          </div>
        </section>
      )}

      {step === 2 && (
        <>
          <div className="question-builder">
            <aside className="question-sidebar">
              <div className="question-sidebar-head">
                <div>
                  <strong>Daftar soal</strong>
                  <small>{questions.length} soal</small>
                </div>
                <button
                  type="button"
                  className="icon-button"
                  onClick={addQuestion}
                >
                  <Plus />
                </button>
              </div>
              <div className="question-items">
                {questions.map((question, index) => (
                  <button
                    type="button"
                    key={question.clientId}
                    className={question.clientId === activeId ? "active" : ""}
                    onClick={() => setActiveId(question.clientId)}
                  >
                    <span>{index + 1}</span>
                    <div>
                      <strong>
                        {htmlText(question.contentHtml) ||
                          (question.images.length
                            ? `Soal dengan ${question.images.length} gambar`
                            : "Soal belum diisi")}
                      </strong>
                      <small>{question.type}</small>
                    </div>
                  </button>
                ))}
              </div>
            </aside>

            <section className="question-editor">
              <div className="builder-toolbar">
                <select
                  value={active.type}
                  onChange={(event) =>
                    updateActive({
                      type: event.target.value as QuestionType,
                      options:
                        event.target.value === "Pilihan ganda"
                          ? ["", "", "", ""]
                          : [],
                    })
                  }
                >
                  <option>Pilihan ganda</option>
                  <option>Isian angka</option>
                  <option>Isian pendek</option>
                  {mode === "manual" && <option>Isian panjang</option>}
                </select>
                <div>
                  <label>Bobot</label>
                  <input
                    type="number"
                    min={1}
                    value={active.weight}
                    onChange={(event) =>
                      updateActive({ weight: Number(event.target.value) })
                    }
                  />
                  <button
                    type="button"
                    className="icon-button destructive"
                    onClick={() => {
                      if (questions.length === 1) return;
                      active.images.forEach((image) => {
                        URL.revokeObjectURL(image.previewUrl);
                        previewUrls.current.delete(image.previewUrl);
                        uploadedMedia.current.delete(image.id);
                      });
                      const next = questions.filter(
                        (item) => item.clientId !== active.clientId,
                      );
                      setQuestions(next);
                      setActiveId(next[0].clientId);
                    }}
                  >
                    <Trash2 />
                  </button>
                </div>
              </div>

              <RichTextEditor
                key={active.clientId}
                value={active.contentHtml}
                images={active.images}
                onChange={(contentHtml, images) =>
                  updateActive({ contentHtml, images })
                }
                onToast={(message) => setToast({ message, kind: "info" })}
                onPreviewCreated={(url) => previewUrls.current.add(url)}
                onPreviewRemoved={(image) => {
                  URL.revokeObjectURL(image.previewUrl);
                  previewUrls.current.delete(image.previewUrl);
                  uploadedMedia.current.delete(image.id);
                }}
              />

              {active.type === "Pilihan ganda" ? (
                <div className="option-editor">
                  {active.options.map((option, index) => (
                    <div
                      className={`edit-option ${active.correct === index ? "correct" : ""}`}
                      key={index}
                    >
                      <button
                        type="button"
                        onClick={() => updateActive({ correct: index })}
                      >
                        {active.correct === index ? (
                          <Check />
                        ) : (
                          String.fromCharCode(65 + index)
                        )}
                      </button>
                      <input
                        value={option}
                        onChange={(event) => {
                          const options = [...active.options];
                          options[index] = event.target.value;
                          updateActive({ options });
                        }}
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    className="text-button add-option"
                    disabled={active.options.length >= 8}
                    onClick={() =>
                      updateActive({ options: [...active.options, ""] })
                    }
                  >
                    <Plus /> Tambah pilihan
                  </button>
                </div>
              ) : ["Isian angka", "Isian pendek"].includes(active.type) ? (
                <div className="answer-key-box">
                  <label>Jawaban yang diterima</label>
                  <input
                    value={active.acceptedAnswer}
                    onChange={(event) =>
                      updateActive({ acceptedAnswer: event.target.value })
                    }
                  />
                </div>
              ) : (
                <div className="manual-note">
                  <ClipboardCheck />
                  <div>
                    <strong>Dikoreksi manual</strong>
                  </div>
                </div>
              )}
            </section>
          </div>
          <div className="sticky-builder-footer">
            <button
              type="button"
              className="button secondary"
              onClick={() => goToStep(1)}
            >
              <ChevronLeft /> Kembali
            </button>
            <button
              type="button"
              className="button primary"
              onClick={() => goToStep(3)}
            >
              Pilih peserta <ArrowRight />
            </button>
          </div>
        </>
      )}

      {step === 3 && (
        <section className="editor-section assignment-section">
          <div className="section-title">
            <span>
              <Users />
            </span>
            <div>
              <h2>Pilih peserta</h2>
              <p>
                Target {level} kelas {grades.join(", ") || "belum dipilih"}:{" "}
                {targetStudents.length} peserta sesuai.
              </p>
            </div>
          </div>
          <div className="assignment-layout">
            <div className="panel">
              <div className="select-all-row">
                <label>
                  <input
                    type="checkbox"
                    checked={
                      targetStudents.length > 0 &&
                      targetStudents.every((student) =>
                        selected.includes(student.id),
                      )
                    }
                    onChange={() => {
                      const targetIds = targetStudents.map(
                        (student) => student.id,
                      );
                      const allSelected = targetIds.every((studentId) =>
                        selected.includes(studentId),
                      );
                      setSelected((current) =>
                        allSelected
                          ? current.filter(
                              (studentId) => !targetIds.includes(studentId),
                            )
                          : [...new Set([...current, ...targetIds])],
                      );
                    }}
                  />
                  Pilih semua sesuai target
                </label>
                <strong>{selected.length} dipilih</strong>
              </div>
              {students.map((student) => {
                const matchesTarget =
                  student.level === level && grades.includes(student.grade);
                return (
                  <label
                    className={`assignment-person ${matchesTarget ? "" : "outside-target"}`}
                    key={student.id}
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(student.id)}
                      onChange={() =>
                        setSelected(
                          selected.includes(student.id)
                            ? selected.filter((value) => value !== student.id)
                            : [...selected, student.id],
                        )
                      }
                    />
                    <Avatar name={student.name} />
                    <div>
                      <strong>{student.name}</strong>
                      <small>
                        {student.level} · Kelas {student.grade} · Fase{" "}
                        {student.phase}
                        {!matchesTarget && " · Di luar target"}
                      </small>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
          <div className="sticky-builder-footer assignment-sticky-footer">
            <button
              type="button"
              className="button secondary"
              onClick={() => goToStep(2)}
            >
              Kembali
            </button>
            <button
              type="button"
              className="button primary"
              onClick={() => goToStep(4)}
            >
              Tinjau ujian <ArrowRight />
            </button>
          </div>
        </section>
      )}

      {step === 4 && (
        <section className="editor-section">
          <div className="section-title">
            <span>
              <CheckCircle2 />
            </span>
            <div>
              <h2>Tinjau & terbitkan</h2>
              <p>
                {name} · {questions.length} soal · {selected.length} peserta
              </p>
            </div>
          </div>
          <div className="review-publish-grid">
            <div className="panel publish-summary">
              <div className="publish-cover">
                <span>
                  {level} · KELAS {grades.join(", ") || "-"}
                </span>
                <h2>{name}</h2>
                <p>
                  {duration} menit ·{" "}
                  {mode === "manual" ? "Koreksi admin" : "Nilai langsung"}
                </p>
              </div>
            </div>
            <aside className="panel validation-panel">
              <h3>Pemeriksaan akhir</h3>
              <div className="validation-item">
                <CheckCircle2 />
                <div>
                  <strong>{grades.length} kelas target</strong>
                  <small>Kelas {grades.join(", ") || "belum dipilih"}</small>
                </div>
              </div>
              <div className="validation-item">
                <CheckCircle2 />
                <div>
                  <strong>{questions.length} soal</strong>
                  <small>Konten akan dikirim ke server.</small>
                </div>
              </div>
              <div className="validation-item">
                <CheckCircle2 />
                <div>
                  <strong>{selected.length} peserta</strong>
                  <small>Akan menerima assignment ujian.</small>
                </div>
              </div>
              <button
                type="button"
                className="button primary full"
                disabled={publishing}
                onClick={() => void publish()}
              >
                <Send /> {publishing ? "Menyimpan..." : "Terbitkan ujian"}
              </button>
              <button
                type="button"
                className="button secondary full"
                onClick={() => goToStep(3)}
              >
                Kembali
              </button>
            </aside>
          </div>
        </section>
      )}
    </AdminShell>
  );
}
