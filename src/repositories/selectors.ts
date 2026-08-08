import {
  exams,
  monitoring,
  results,
  reviewQueue,
  students,
} from "../mocks/database";

export const selectDashboardSummary = () => ({
  totalStudents: students.length,
  activeStudents: students.filter((student) => student.status === "Aktif")
    .length,
  activeExams: exams.filter((exam) =>
    ["Terbit", "Berlangsung"].includes(exam.status),
  ).length,
  runningExams: exams.filter((exam) => exam.status === "Berlangsung").length,
  pendingReviews: reviewQueue.filter(
    (item) => item.status === "Belum dikoreksi",
  ).length,
  reviewExamCount: exams.filter((exam) => exam.mode === "Koreksi admin").length,
  averageScore:
    Math.round(
      (results.reduce((sum, result) => sum + result.score, 0) /
        Math.max(results.length, 1)) *
        10,
    ) / 10,
});

export const selectExamSummary = () => ({
  total: exams.length,
  draft: exams.filter((exam) => exam.status === "Draf").length,
  published: exams.filter((exam) => exam.status === "Terbit").length,
  running: exams.filter((exam) => exam.status === "Berlangsung").length,
  completed: exams.filter((exam) => exam.status === "Selesai").length,
  totalAttempts: exams.reduce((sum, exam) => sum + exam.participants, 0),
  averageScore:
    Math.round(
      (results.reduce((sum, result) => sum + result.score, 0) /
        Math.max(results.length, 1)) *
        10,
    ) / 10,
});

export const selectMonitoringSummary = () => ({
  total: monitoring.length,
  inProgress: monitoring.filter((row) => row.status === "Mengerjakan").length,
  disconnected: monitoring.filter((row) => row.connection === "Terputus")
    .length,
  completed: monitoring.filter((row) => row.status === "Selesai").length,
});

export const selectReviewSummary = () => ({
  total: reviewQueue.length,
  pending: reviewQueue.filter((item) => item.status === "Belum dikoreksi")
    .length,
  inReview: reviewQueue.filter((item) => item.status === "Sedang dikoreksi")
    .length,
  completed: reviewQueue.filter((item) =>
    ["Siap diterbitkan", "Sudah terbit"].includes(item.status),
  ).length,
});
