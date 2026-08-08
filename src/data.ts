// Compatibility barrel. New code should consume repositories/selectors instead.
export type {
  Exam,
  LeaderboardEntry,
  MonitoringRow,
  Question,
  Result,
  ReviewQueueItem,
  Student,
  UserProfile,
} from "./domain/models";
export {
  appConfig,
  attemptStatusFixture,
  currentAdmin,
  currentStudent,
  dashboardActivities,
  exams,
  leaderboard,
  monitoring,
  questions,
  results,
  reviewQueue,
  students,
} from "./mocks/database";
