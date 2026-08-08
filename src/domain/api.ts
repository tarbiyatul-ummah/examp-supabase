import type { AcademicLevel } from "./models";

export type ApiEnvelope<T, M = unknown> = { data: T; meta?: M };

export type ApiErrorEnvelope = {
  error: { code: string; message: string; details?: unknown };
};

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

export type ApiStudent = {
  id: string;
  name: string;
  birthPlace?: string;
  birthDate?: string;
  level: AcademicLevel;
  grade: number;
  phase: string;
  notes?: string;
  status: "active" | "inactive";
  codeHint?: string;
  createdAt: string;
  updatedAt: string;
};

export type ApiExam = {
  id: string;
  name: string;
  descriptionDoc: Record<string, unknown>;
  durationSeconds: number;
  targetLevel?: AcademicLevel;
  targetGrades: number[];
  gradingMode: "instant_result" | "manual_review";
  shuffleOptions: boolean;
  status: "draft" | "published" | "archived";
  currentVersion: number;
  questionCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ApiQuestionOption = {
  id: string;
  contentDoc: Record<string, unknown>;
  position: number;
  isCorrect?: boolean;
};

export type ApiQuestion = {
  id: string;
  examId: string;
  type: "multiple_choice" | "numeric" | "short_text" | "long_text";
  contentDoc: Record<string, unknown>;
  weight: number;
  position: number;
  shuffleOptions: boolean;
  options?: ApiQuestionOption[];
};

export type ApiAnswer = {
  id: string;
  attemptId: string;
  questionId: string;
  selectedOptionId?: string;
  textRaw?: string;
  version: number;
  verdict?: "correct" | "incorrect";
  reviewRevision?: number;
  updatedAt: string;
};

export type ApiAttempt = {
  id: string;
  examId: string;
  examVersionId: string;
  studentId: string;
  status:
    | "in_progress"
    | "paused_disconnected"
    | "submitted"
    | "time_expired"
    | "disqualified"
    | "cancelled";
  gradingStatus?:
    | "auto_scored"
    | "pending_review"
    | "in_review"
    | "reviewed"
    | "released";
  activeElapsedSeconds: number;
  durationSeconds: number;
  remainingSeconds: number;
  startedAt: string;
  submittedAt?: string;
  score?: number;
  disqualificationReason?: string;
  questions?: Array<{
    questionId: string;
    displayOrder: number;
    optionOrder: string[];
    question?: ApiQuestion;
  }>;
  answers?: ApiAnswer[];
};

export type ApiMonitoringRow = {
  attempt: ApiAttempt;
  student: ApiStudent;
  answeredCount: number;
  questionCount: number;
  lastActivity?: string;
};

export type ApiReviewQueueRow = {
  attempt: ApiAttempt;
  student: ApiStudent;
  reviewedCount: number;
  questionCount: number;
};
