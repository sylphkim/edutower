export type ModuleStatus = "stub" | "mock" | "ready";

export interface StubMeta {
  module: string;
  status: ModuleStatus;
  message: string;
}

export interface StubPayload<T> {
  meta: StubMeta;
  result: T;
}

export type MaterialSourceType = "pdf" | "doc" | "text" | "link";

export interface Material {
  id: string;
  title: string;
  sourceType: MaterialSourceType;
  status: "indexed" | "uploaded" | "pending";
  uploadedAt: string;
}

export interface MaterialChunk {
  id: string;
  materialId: string;
  order: number;
  text: string;
  knowledgePointIds: string[];
}

export interface KnowledgePoint {
  id: string;
  title: string;
  description: string;
  parentId?: string;
  prerequisiteIds: string[];
  mastery: number;
}

export interface StudyTask {
  id: string;
  title: string;
  type: "read" | "practice" | "review";
  estimatedMinutes: number;
  knowledgePointIds: string[];
}

export interface StudyPlanDay {
  day: number;
  title: string;
  goal: string;
  tasks: StudyTask[];
}

export interface StudyPlan {
  id: string;
  title: string;
  totalDays: number;
  days: StudyPlanDay[];
}

export type QuizQuestionType = "single_choice" | "short_answer";
export type Difficulty = "easy" | "medium" | "hard";

export interface QuizOption {
  id: string;
  text: string;
}

export interface QuizQuestion {
  id: string;
  type: QuizQuestionType;
  stem: string;
  options?: QuizOption[];
  answer: string;
  explanation: string;
  difficulty: Difficulty;
  knowledgePointId: string;
}

export interface QuizSession {
  id: string;
  title: string;
  questions: QuizQuestion[];
}

export interface QuizSubmissionResult {
  sessionId: string;
  total: number;
  correct: number;
  score: number;
  wrongQuestionIds: string[];
}

export interface WrongbookItem {
  id: string;
  question: QuizQuestion;
  wrongAnswer: string;
  reviewCount: number;
  lastReviewedAt?: string;
}

export interface MemoryProfile {
  userId: string;
  learningGoal: string;
  currentLevel: string;
  strengths: string[];
  weaknesses: string[];
  preferences: string[];
  updatedAt: string;
}
