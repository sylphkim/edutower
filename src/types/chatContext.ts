export interface DemoSubject {
  id: string;
  name: string;
  gradeLevel: string;
  learningGoal: string;
}

export interface DemoMaterial {
  id: string;
  subjectId: string;
  title: string;
  type: "pdf" | "doc" | "text" | "link";
  summary: string;
  knowledgePointIds: string[];
}

export interface DemoKnowledgePoint {
  id: string;
  subjectId: string;
  title: string;
  description: string;
  mastery: number;
  prerequisiteIds: string[];
}

export interface DemoWeakPoint {
  id: string;
  knowledgePointId: string;
  title: string;
  reason: string;
  severity: "low" | "medium" | "high";
  suggestedAction: string;
}

export interface DemoSessionMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface ChatContext {
  subject: DemoSubject;
  materials: DemoMaterial[];
  knowledgePoints: DemoKnowledgePoint[];
  weakPoints: DemoWeakPoint[];
  sessionHistory: DemoSessionMessage[];
  generatedAt: string;
}
