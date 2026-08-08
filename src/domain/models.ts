export type AcademicLevel = "SD" | "SMP" | "SMA";
export type EntityId = string | number;
export type ExamStatus = "Berlangsung" | "Terbit" | "Draf" | "Selesai";
export type GradingMode = "Nilai langsung" | "Koreksi admin";
export type QuestionType =
  | "Pilihan ganda"
  | "Isian angka"
  | "Isian pendek"
  | "Isian panjang";

export type UserProfile = {
  id: string;
  name: string;
  shortName: string;
  role: string;
  className?: string;
};

export type Student = {
  id: EntityId;
  name: string;
  code: string;
  level: AcademicLevel;
  grade: number;
  className: string;
  phase: string;
  status: "Aktif" | "Nonaktif";
  assigned: number;
};

export type Exam = {
  id: string;
  title: string;
  shortTitle: string;
  subject: string;
  description: string;
  duration: number;
  questions: number;
  participants: number;
  status: ExamStatus;
  mode: GradingMode;
  color: string;
  level: AcademicLevel;
  grades: number[];
  phase: string;
  version: number;
  publishedAt?: string;
};

export type Question = {
  id: EntityId;
  examId: string;
  type: QuestionType;
  weight: number;
  prompt: string;
  options: string[];
  answer?: string | number;
};

export type MonitoringRow = {
  id: EntityId;
  studentId: EntityId;
  name: string;
  class: string;
  phase: string;
  progress: number;
  total: number;
  status: "Mengerjakan" | "Terjeda" | "Selesai" | "Belum mulai";
  connection: "Terhubung" | "Terputus" | "Offline";
  time: string;
  activity: string;
  score?: number;
};

export type ReviewQueueItem = {
  id: EntityId;
  studentId: EntityId;
  name: string;
  class: string;
  status:
    | "Belum dikoreksi"
    | "Sedang dikoreksi"
    | "Siap diterbitkan"
    | "Sudah terbit";
  reviewedCount: number;
  totalQuestions: number;
  progress: string;
  submittedAt: string;
};

export type Result = {
  id: string;
  examId: string;
  studentId: EntityId;
  score: number;
  correct: number;
  wrong: number;
  unanswered: number;
  duration: string;
  mode: GradingMode;
  releasedBy?: string;
  releasedAt?: string;
  wrongQuestionNumbers: number[];
};

export type LeaderboardEntry = {
  rank: number;
  studentId: EntityId;
  name: string;
  score: number;
  duration: string;
  avatar: string;
};
