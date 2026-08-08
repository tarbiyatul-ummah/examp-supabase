import type { ApiExam, ApiQuestion, ApiStudent } from "../domain/api";
import type { Exam, Question, Student } from "../domain/models";

const colors = ["#7b61d1", "#e9764a", "#19877a", "#d39b22"];

export function documentText(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  if ("text" in value && typeof value.text === "string") return value.text;
  if ("content" in value && Array.isArray(value.content)) {
    return value.content.map(documentText).filter(Boolean).join(" ").trim();
  }
  return "";
}

export function textDocument(text: string): Record<string, unknown> {
  return {
    type: "doc",
    content: text.trim()
      ? [
          {
            type: "paragraph",
            content: [{ type: "text", text: text.trim() }],
          },
        ]
      : [],
  };
}

function phaseFor(level: ApiExam["targetLevel"], grades: number[]) {
  const grade = grades[0];
  if (!level || !grade) return "-";
  if (grade <= 2) return "A";
  if (grade <= 4) return "B";
  if (grade <= 6) return "C";
  if (grade <= 9) return "D";
  if (grade === 10) return "E";
  return "F";
}

export function mapStudent(student: ApiStudent): Student {
  return {
    id: student.id,
    name: student.name,
    code: student.codeHint ? `••••${student.codeHint}` : "Tersimpan",
    level: student.level,
    grade: student.grade,
    className: String(student.grade),
    phase: student.phase,
    status: student.status === "active" ? "Aktif" : "Nonaktif",
    assigned: 0,
  };
}

export function mapExam(exam: ApiExam, index = 0): Exam {
  const parts = exam.name.split(/\s+[—–-]\s+/);
  return {
    id: exam.id,
    title: exam.name,
    shortTitle: parts.at(-1) || exam.name,
    subject: parts.length > 1 ? parts[0] : "Ujian",
    description: documentText(exam.descriptionDoc),
    duration: Math.max(1, Math.round(exam.durationSeconds / 60)),
    questions: exam.questionCount,
    participants: 0,
    status:
      exam.status === "draft"
        ? "Draf"
        : exam.status === "published"
          ? "Terbit"
          : "Selesai",
    mode:
      exam.gradingMode === "manual_review"
        ? "Koreksi admin"
        : "Nilai langsung",
    color: colors[index % colors.length],
    level: exam.targetLevel || "SMP",
    grades: exam.targetGrades || [],
    phase: phaseFor(exam.targetLevel, exam.targetGrades),
    version: exam.currentVersion,
    publishedAt:
      exam.status === "published"
        ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(
            new Date(exam.updatedAt),
          )
        : undefined,
  };
}

const questionTypes: Record<ApiQuestion["type"], Question["type"]> = {
  multiple_choice: "Pilihan ganda",
  numeric: "Isian angka",
  short_text: "Isian pendek",
  long_text: "Isian panjang",
};

export function mapQuestion(question: ApiQuestion): Question {
  const options = [...(question.options || [])].sort(
    (a, b) => a.position - b.position,
  );
  return {
    id: question.id,
    examId: question.examId,
    type: questionTypes[question.type],
    weight: question.weight,
    prompt: documentText(question.contentDoc),
    options: options.map((option) => documentText(option.contentDoc)),
    answer: options.findIndex((option) => option.isCorrect),
  };
}
