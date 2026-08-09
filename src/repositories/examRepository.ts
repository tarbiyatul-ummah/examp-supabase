import type {
  ApiAnswer,
  ApiAttempt,
  ApiAttemptHistory,
  ApiExam,
  ApiMediaAsset,
  ApiMonitoringRow,
  ApiQuestion,
  ApiReviewQueueRow,
} from "../domain/api";
import { envelope } from "../lib/api";
import { mapExam, mapQuestion } from "./mappers";

export const examRepository = {
  async list(status?: string) {
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    const { data } = await envelope<ApiExam[]>(`/v1/admin/exams${query}`);
    return data.map(mapExam);
  },
  async listRaw(status?: string) {
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    const { data } = await envelope<ApiExam[]>(`/v1/admin/exams${query}`);
    return data;
  },
  async create(input: Record<string, unknown>) {
    const { data } = await envelope<ApiExam>("/v1/admin/exams", {
      method: "POST",
      body: JSON.stringify(input),
    });
    return data;
  },
  async update(id: string, input: Record<string, unknown>) {
    const { data } = await envelope<ApiExam>(`/v1/admin/exams/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
    return data;
  },
  async addQuestion(examId: string, input: Record<string, unknown>) {
    const { data } = await envelope<ApiQuestion>(
      `/v1/admin/exams/${examId}/questions`,
      { method: "POST", body: JSON.stringify(input) },
    );
    return mapQuestion(data);
  },
  async uploadQuestionImage(
    examId: string,
    file: File,
    input: { altText: string; width?: number; height?: number },
  ) {
    const form = new FormData();
    form.append("file", file);
    form.append("altText", input.altText);
    if (input.width) form.append("width", String(input.width));
    if (input.height) form.append("height", String(input.height));
    const { data } = await envelope<ApiMediaAsset>(
      `/v1/admin/exams/${examId}/media`,
      { method: "POST", body: form },
    );
    return data;
  },
  async publish(examId: string) {
    const { data } = await envelope<ApiExam>(
      `/v1/admin/exams/${examId}/publish`,
      { method: "POST" },
    );
    return data;
  },
  async assign(examId: string, studentIds: Array<string | number>) {
    await envelope<{ assigned: number }>(
      `/v1/admin/exams/${examId}/assignments`,
      {
        method: "POST",
        body: JSON.stringify({ studentIds: studentIds.map(String) }),
      },
    );
  },
  async studentExams() {
    const { data } = await envelope<ApiExam[]>("/v1/student/exams");
    return data.map(mapExam);
  },
  async attemptHistory() {
    const { data } = await envelope<ApiAttemptHistory[]>(
      "/v1/student/history",
    );
    return data;
  },
  async startAttempt(examId: string) {
    const { data } = await envelope<ApiAttempt>(
      `/v1/student/exams/${examId}/attempts`,
      { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() } },
    );
    return data;
  },
  async attempt(attemptId: string) {
    const { data } = await envelope<ApiAttempt>(
      `/v1/student/attempts/${attemptId}`,
    );
    return data;
  },
  async saveAnswer(
    attemptId: string,
    questionId: string,
    input: {
      selectedOptionId?: string | null;
      textRaw?: string | null;
      version: number;
    },
  ) {
    const { data } = await envelope<ApiAnswer>(
      `/v1/student/attempts/${attemptId}/answers/${questionId}`,
      { method: "PUT", body: JSON.stringify(input) },
    );
    return data;
  },
  async heartbeat(attemptId: string) {
    const { data } = await envelope<{
      status: ApiAttempt["status"];
      remainingSeconds: number;
      serverTime: string;
    }>(`/v1/student/attempts/${attemptId}/heartbeat`, { method: "POST" });
    return data;
  },
  async submit(attemptId: string) {
    const { data } = await envelope<ApiAttempt>(
      `/v1/student/attempts/${attemptId}/submit`,
      { method: "POST" },
    );
    return data;
  },
  async result(attemptId: string) {
    const { data } = await envelope<ApiAttempt>(
      `/v1/student/attempts/${attemptId}/result`,
    );
    return data;
  },
  async monitoring(examId: string) {
    const { data } = await envelope<ApiMonitoringRow[]>(
      `/v1/admin/exams/${examId}/monitoring`,
    );
    return data;
  },
  async disqualify(attemptId: string, reason: string) {
    const { data } = await envelope<ApiAttempt>(
      `/v1/admin/attempts/${attemptId}/disqualify`,
      { method: "POST", body: JSON.stringify({ reason }) },
    );
    return data;
  },
  async reviewQueue(examId: string) {
    const { data } = await envelope<ApiReviewQueueRow[]>(
      `/v1/admin/exams/${examId}/reviews`,
    );
    return data;
  },
  async reviewDetail(attemptId: string) {
    const { data } = await envelope<ApiAttempt>(
      `/v1/admin/attempts/${attemptId}/review`,
    );
    return data;
  },
  async reviewAnswer(
    answerId: string,
    verdict: "correct" | "incorrect",
    revision: number,
  ) {
    const { data } = await envelope<ApiAnswer>(
      `/v1/admin/answers/${answerId}/review`,
      { method: "PUT", body: JSON.stringify({ verdict, revision }) },
    );
    return data;
  },
  async releaseResult(attemptId: string) {
    const { data } = await envelope<ApiAttempt>(
      `/v1/admin/attempts/${attemptId}/release-result`,
      { method: "POST" },
    );
    return data;
  },
  async releaseResults(examId: string) {
    const { data } = await envelope<ApiAttempt[]>(
      `/v1/admin/exams/${examId}/release-results`,
      { method: "POST" },
    );
    return data;
  },
  async generateLeaderboard(
    examId: string,
    segmentType: string,
    segmentValue: string,
  ) {
    const { data } = await envelope<Record<string, unknown>>(
      `/v1/admin/exams/${examId}/leaderboards`,
      { method: "POST", body: JSON.stringify({ segmentType, segmentValue }) },
    );
    return data;
  },
};

export type ExamRepository = typeof examRepository;
