import type { CellValue } from "read-excel-file/browser";
import type { QuestionType } from "../domain/models";

type SpreadsheetCell = CellValue | null;

export type ImportedExamQuestion = {
  type: QuestionType;
  contentHtml: string;
  options: string[];
  correct: number;
  acceptedAnswer: string;
  weight: number;
};

export type ExamImportResult = {
  questions: ImportedExamQuestion[];
  errors: string[];
};

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_QUESTION_ROWS = 500;
const optionHeaders = Array.from({ length: 8 }, (_, index) =>
  `pilihan ${String.fromCharCode(97 + index)}`,
);

function normalized(value: SpreadsheetCell | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function text(value: SpreadsheetCell | undefined) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value ?? "").trim();
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function questionHtml(value: string) {
  return value
    .split(/\r?\n/)
    .map((paragraph) => `<p>${escapeHtml(paragraph) || "<br>"}</p>`)
    .join("");
}

function questionType(value: SpreadsheetCell | undefined): QuestionType | undefined {
  const type = normalized(value);
  if (["pilihan ganda", "multiple choice", "multiple choice question", "pg", "multiple_choice"].includes(type))
    return "Pilihan ganda";
  if (["isian angka", "numeric", "angka"].includes(type)) return "Isian angka";
  if (["isian pendek", "short text", "short_text"].includes(type)) return "Isian pendek";
  if (["isian panjang", "long text", "long_text", "esai", "essay"].includes(type)) return "Isian panjang";
  return undefined;
}

function columnMap(header: SpreadsheetCell[]) {
  return new Map(header.map((value, index) => [normalized(value), index]));
}

function at(row: SpreadsheetCell[], columns: Map<string, number>, name: string) {
  const index = columns.get(name);
  return index === undefined ? undefined : row[index];
}

export async function importExamQuestions(
  file: File,
  gradingMode: "instant" | "manual",
): Promise<ExamImportResult> {
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return { questions: [], errors: ["Gunakan file Excel dengan ekstensi .xlsx."] };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { questions: [], errors: ["Ukuran file Excel maksimal 5 MB."] };
  }

  let rows: SpreadsheetCell[][];
  try {
    const { readSheet } = await import("read-excel-file/browser");
    rows = await readSheet(file, "Soal").catch(() => readSheet(file, 1));
  } catch {
    return { questions: [], errors: ["File Excel tidak dapat dibaca atau formatnya rusak."] };
  }
  if (rows.length < 2) {
    return { questions: [], errors: ["Sheet Soal belum berisi data."] };
  }

  const columns = columnMap(rows[0]);
  const requiredHeaders = ["tipe soal", "pertanyaan", "jawaban benar", "bobot"];
  const missing = requiredHeaders.filter((header) => !columns.has(header));
  if (missing.length) {
    return {
      questions: [],
      errors: [`Header tidak lengkap: ${missing.join(", ")}. Gunakan template yang disediakan.`],
    };
  }

  const dataRows = rows.slice(1).filter((row) => row.some((cell) => text(cell)));
  if (!dataRows.length) return { questions: [], errors: ["Belum ada soal yang diisi pada sheet Soal."] };
  if (dataRows.length > MAX_QUESTION_ROWS) {
    return { questions: [], errors: [`Maksimal ${MAX_QUESTION_ROWS} soal dalam satu file.`] };
  }

  const questions: ImportedExamQuestion[] = [];
  const errors: string[] = [];
  for (const [index, row] of dataRows.entries()) {
    const rowNumber = rows.indexOf(row) + 1;
    const rowErrors: string[] = [];
    const type = questionType(at(row, columns, "tipe soal"));
    const prompt = text(at(row, columns, "pertanyaan"));
    const rawWeight = text(at(row, columns, "bobot"));
    const weight = rawWeight ? Number(rawWeight.replace(",", ".")) : 1;
    const answer = text(at(row, columns, "jawaban benar"));

    if (!type) rowErrors.push("tipe soal tidak dikenali");
    if (!prompt) rowErrors.push("pertanyaan wajib diisi");
    if (!Number.isFinite(weight) || weight <= 0) rowErrors.push("bobot harus berupa angka lebih dari 0");
    if (type === "Isian panjang" && gradingMode === "instant")
      rowErrors.push("isian panjang hanya tersedia pada mode Koreksi admin");

    let options: string[] = [];
    let correct = 0;
    if (type === "Pilihan ganda") {
      const allOptions = optionHeaders.map((header) => text(at(row, columns, header)));
      const lastOption = allOptions.reduce((last, option, optionIndex) => option ? optionIndex : last, -1);
      options = allOptions.slice(0, lastOption + 1);
      if (options.length < 2) rowErrors.push("pilihan ganda membutuhkan minimal Pilihan A dan B");
      if (options.some((option) => !option)) rowErrors.push("pilihan jawaban tidak boleh memiliki celah");
      const answerLetter = answer.toUpperCase();
      if (/^[A-H]$/.test(answerLetter)) correct = answerLetter.charCodeAt(0) - 65;
      else if (/^[1-8]$/.test(answer)) correct = Number(answer) - 1;
      else correct = options.findIndex((option) => normalized(option) === normalized(answer));
      if (!answer || correct < 0 || correct >= options.length)
        rowErrors.push("jawaban benar harus berupa huruf A–H atau sama dengan isi pilihan");
    } else if (type && type !== "Isian panjang" && gradingMode === "instant" && !answer) {
      rowErrors.push("jawaban benar wajib diisi untuk mode Nilai langsung");
    }

    if (rowErrors.length) {
      errors.push(`Baris ${rowNumber || index + 2}: ${rowErrors.join("; ")}.`);
      continue;
    }
    if (!type) continue;
    questions.push({
      type,
      contentHtml: questionHtml(prompt),
      options,
      correct,
      acceptedAnswer: type === "Isian panjang" ? "" : answer,
      weight,
    });
  }
  return { questions, errors };
}
