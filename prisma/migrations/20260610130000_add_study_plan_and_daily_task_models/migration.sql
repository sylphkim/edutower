-- Add versioned phase plans and persistent daily task sheets without migrating legacy plan tasks.

CREATE TABLE "StudyPlanVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "inputSnapshot" TEXT NOT NULL DEFAULT '{}',
    "confirmedAt" DATETIME,
    "supersededAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StudyPlanVersion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "StudyProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "PlanPhase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planVersionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "description" TEXT,
    "completionCriteria" TEXT,
    "order" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlanPhase_planVersionId_fkey" FOREIGN KEY ("planVersionId") REFERENCES "StudyPlanVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "PlanPhaseKnowledgeNode" (
    "planPhaseId" TEXT NOT NULL,
    "knowledgeNodeId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("planPhaseId", "knowledgeNodeId"),
    CONSTRAINT "PlanPhaseKnowledgeNode_planPhaseId_fkey" FOREIGN KEY ("planPhaseId") REFERENCES "PlanPhase" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlanPhaseKnowledgeNode_knowledgeNodeId_fkey" FOREIGN KEY ("knowledgeNodeId") REFERENCES "KnowledgeNode" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "DailyTaskSheet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "planVersionId" TEXT,
    "currentPhaseId" TEXT,
    "localDate" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Shanghai',
    "availableMinutes" INTEGER NOT NULL,
    "inputSnapshot" TEXT NOT NULL DEFAULT '{}',
    "generationCount" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'generating',
    "generatedAt" DATETIME,
    "closesAt" DATETIME NOT NULL,
    "endedAt" DATETIME,
    "closeReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DailyTaskSheet_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "StudyProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DailyTaskSheet_planVersionId_fkey" FOREIGN KEY ("planVersionId") REFERENCES "StudyPlanVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DailyTaskSheet_currentPhaseId_fkey" FOREIGN KEY ("currentPhaseId") REFERENCES "PlanPhase" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

ALTER TABLE "StudyTask" ADD COLUMN "dailyTaskSheetId" TEXT REFERENCES "DailyTaskSheet" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StudyTask" ADD COLUMN "planPhaseId" TEXT REFERENCES "PlanPhase" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StudyTask" ADD COLUMN "carriedFromTaskId" TEXT REFERENCES "StudyTask" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StudyTask" ADD COLUMN "estimatedMinutes" INTEGER;
ALTER TABLE "StudyTask" ADD COLUMN "sourceType" TEXT;
ALTER TABLE "StudyTask" ADD COLUMN "selectionReason" TEXT;
ALTER TABLE "StudyTask" ADD COLUMN "generationBatch" INTEGER;

ALTER TABLE "DailySummary" ADD COLUMN "dailyTaskSheetId" TEXT REFERENCES "DailyTaskSheet" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DailySummary" ADD COLUMN "confirmationSource" TEXT;

ALTER TABLE "SummarySuggestion" ADD COLUMN "decisionSource" TEXT;

CREATE TABLE "WeakPoint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "knowledgeNodeId" TEXT NOT NULL,
    "dailyTaskSheetId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "evidenceSnapshot" TEXT NOT NULL DEFAULT '{}',
    "confirmationSource" TEXT NOT NULL,
    "confirmedAt" DATETIME,
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WeakPoint_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "StudyProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WeakPoint_knowledgeNodeId_fkey" FOREIGN KEY ("knowledgeNodeId") REFERENCES "KnowledgeNode" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WeakPoint_dailyTaskSheetId_fkey" FOREIGN KEY ("dailyTaskSheetId") REFERENCES "DailyTaskSheet" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "KnowledgeStateEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "knowledgeNodeId" TEXT NOT NULL,
    "dailyTaskSheetId" TEXT,
    "summarySuggestionId" TEXT,
    "previousLearningState" TEXT,
    "newLearningState" TEXT,
    "previousMastery" INTEGER,
    "newMastery" INTEGER,
    "source" TEXT NOT NULL,
    "evidenceSnapshot" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KnowledgeStateEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "StudyProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "KnowledgeStateEvent_knowledgeNodeId_fkey" FOREIGN KEY ("knowledgeNodeId") REFERENCES "KnowledgeNode" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "KnowledgeStateEvent_dailyTaskSheetId_fkey" FOREIGN KEY ("dailyTaskSheetId") REFERENCES "DailyTaskSheet" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "KnowledgeStateEvent_summarySuggestionId_fkey" FOREIGN KEY ("summarySuggestionId") REFERENCES "SummarySuggestion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "StudyPlanVersion_projectId_version_key" ON "StudyPlanVersion"("projectId", "version");
CREATE INDEX "StudyPlanVersion_projectId_status_idx" ON "StudyPlanVersion"("projectId", "status");
CREATE UNIQUE INDEX "PlanPhase_planVersionId_order_key" ON "PlanPhase"("planVersionId", "order");
CREATE INDEX "PlanPhase_planVersionId_idx" ON "PlanPhase"("planVersionId");
CREATE INDEX "PlanPhaseKnowledgeNode_knowledgeNodeId_idx" ON "PlanPhaseKnowledgeNode"("knowledgeNodeId");
CREATE INDEX "PlanPhaseKnowledgeNode_planPhaseId_order_idx" ON "PlanPhaseKnowledgeNode"("planPhaseId", "order");
CREATE UNIQUE INDEX "DailyTaskSheet_projectId_localDate_key" ON "DailyTaskSheet"("projectId", "localDate");
CREATE INDEX "DailyTaskSheet_projectId_status_idx" ON "DailyTaskSheet"("projectId", "status");
CREATE INDEX "DailyTaskSheet_closesAt_status_idx" ON "DailyTaskSheet"("closesAt", "status");
CREATE INDEX "DailyTaskSheet_planVersionId_idx" ON "DailyTaskSheet"("planVersionId");
CREATE INDEX "DailyTaskSheet_currentPhaseId_idx" ON "DailyTaskSheet"("currentPhaseId");
CREATE INDEX "StudyTask_dailyTaskSheetId_order_idx" ON "StudyTask"("dailyTaskSheetId", "order");
CREATE INDEX "StudyTask_planPhaseId_idx" ON "StudyTask"("planPhaseId");
CREATE INDEX "StudyTask_carriedFromTaskId_idx" ON "StudyTask"("carriedFromTaskId");
CREATE UNIQUE INDEX "DailySummary_dailyTaskSheetId_key" ON "DailySummary"("dailyTaskSheetId");
CREATE INDEX "WeakPoint_projectId_status_idx" ON "WeakPoint"("projectId", "status");
CREATE INDEX "WeakPoint_knowledgeNodeId_status_idx" ON "WeakPoint"("knowledgeNodeId", "status");
CREATE INDEX "WeakPoint_dailyTaskSheetId_idx" ON "WeakPoint"("dailyTaskSheetId");
CREATE INDEX "KnowledgeStateEvent_projectId_createdAt_idx" ON "KnowledgeStateEvent"("projectId", "createdAt");
CREATE INDEX "KnowledgeStateEvent_knowledgeNodeId_createdAt_idx" ON "KnowledgeStateEvent"("knowledgeNodeId", "createdAt");
CREATE INDEX "KnowledgeStateEvent_dailyTaskSheetId_idx" ON "KnowledgeStateEvent"("dailyTaskSheetId");
CREATE INDEX "KnowledgeStateEvent_summarySuggestionId_idx" ON "KnowledgeStateEvent"("summarySuggestionId");
