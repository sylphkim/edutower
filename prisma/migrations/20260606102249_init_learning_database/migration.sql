-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "displayName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "sourceType" TEXT,
    "origin" TEXT NOT NULL DEFAULT 'manual',
    "status" TEXT NOT NULL DEFAULT 'ready',
    "summary" TEXT,
    "extractedText" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Material_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudyProject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "targetScore" TEXT,
    "startDate" DATETIME,
    "deadline" DATETIME,
    "dailyMinutes" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'planning',
    "goalConfirmedAt" DATETIME,
    "planConfirmedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StudyProject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectMaterial" (
    "projectId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("projectId", "materialId"),
    CONSTRAINT "ProjectMaterial_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "StudyProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectMaterial_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KnowledgeNode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "parentId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'available',
    "selfMastery" INTEGER,
    "systemMastery" INTEGER,
    "confidence" REAL,
    "mastery" INTEGER NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "KnowledgeNode_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "StudyProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "KnowledgeNode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "KnowledgeNode" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudyTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "knowledgeNodeId" TEXT,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "day" INTEGER,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isRecommended" BOOLEAN NOT NULL DEFAULT true,
    "isSelected" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'todo',
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StudyTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "StudyProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudyTask_knowledgeNodeId_fkey" FOREIGN KEY ("knowledgeNodeId") REFERENCES "KnowledgeNode" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'free_qa',
    "title" TEXT,
    "externalSessionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Conversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Conversation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "StudyProject" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudySession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "knowledgeNodeId" TEXT,
    "studyTaskId" TEXT,
    "conversationId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StudySession_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "StudyProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudySession_knowledgeNodeId_fkey" FOREIGN KEY ("knowledgeNodeId") REFERENCES "KnowledgeNode" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StudySession_studyTaskId_fkey" FOREIGN KEY ("studyTaskId") REFERENCES "StudyTask" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StudySession_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Quiz" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "knowledgeNodeId" TEXT NOT NULL,
    "studySessionId" TEXT,
    "title" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL DEFAULT 'pass',
    "round" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Quiz_knowledgeNodeId_fkey" FOREIGN KEY ("knowledgeNodeId") REFERENCES "KnowledgeNode" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Quiz_studySessionId_fkey" FOREIGN KEY ("studySessionId") REFERENCES "StudySession" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuizQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quizId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "explanation" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "QuizQuestion_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuizOption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionId" TEXT NOT NULL,
    "label" TEXT,
    "text" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "QuizOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "QuizQuestion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuizAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionId" TEXT NOT NULL,
    "userAnswer" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "answeredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "timeSpentSeconds" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuizAttempt_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "QuizQuestion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WrongbookItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "knowledgeNodeId" TEXT,
    "quizQuestionId" TEXT,
    "quizAttemptId" TEXT,
    "questionType" TEXT NOT NULL,
    "questionPrompt" TEXT NOT NULL,
    "correctAnswer" TEXT NOT NULL,
    "explanation" TEXT,
    "wrongAnswer" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'uncorrected',
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "lastReviewedAt" DATETIME,
    "correctedAt" DATETIME,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WrongbookItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WrongbookItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "StudyProject" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "WrongbookItem_knowledgeNodeId_fkey" FOREIGN KEY ("knowledgeNodeId") REFERENCES "KnowledgeNode" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "WrongbookItem_quizQuestionId_fkey" FOREIGN KEY ("quizQuestionId") REFERENCES "QuizQuestion" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "WrongbookItem_quizAttemptId_fkey" FOREIGN KEY ("quizAttemptId") REFERENCES "QuizAttempt" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DailySummary" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "studySessionId" TEXT,
    "summaryDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aiDraft" TEXT NOT NULL,
    "confirmedContent" TEXT,
    "weaknesses" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "confirmedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DailySummary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DailySummary_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "StudyProject" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DailySummary_studySessionId_fkey" FOREIGN KEY ("studySessionId") REFERENCES "StudySession" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SummarySuggestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "summaryId" TEXT NOT NULL,
    "knowledgeNodeId" TEXT,
    "studyTaskId" TEXT,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "proposedStatus" TEXT,
    "proposedMastery" INTEGER,
    "modifiedContent" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "decidedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SummarySuggestion_summaryId_fkey" FOREIGN KEY ("summaryId") REFERENCES "DailySummary" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SummarySuggestion_knowledgeNodeId_fkey" FOREIGN KEY ("knowledgeNodeId") REFERENCES "KnowledgeNode" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SummarySuggestion_studyTaskId_fkey" FOREIGN KEY ("studyTaskId") REFERENCES "StudyTask" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Material_userId_idx" ON "Material"("userId");

-- CreateIndex
CREATE INDEX "StudyProject_userId_idx" ON "StudyProject"("userId");

-- CreateIndex
CREATE INDEX "ProjectMaterial_materialId_idx" ON "ProjectMaterial"("materialId");

-- CreateIndex
CREATE INDEX "KnowledgeNode_projectId_parentId_idx" ON "KnowledgeNode"("projectId", "parentId");

-- CreateIndex
CREATE INDEX "StudyTask_projectId_idx" ON "StudyTask"("projectId");

-- CreateIndex
CREATE INDEX "StudyTask_knowledgeNodeId_idx" ON "StudyTask"("knowledgeNodeId");

-- CreateIndex
CREATE INDEX "Conversation_userId_idx" ON "Conversation"("userId");

-- CreateIndex
CREATE INDEX "Conversation_projectId_idx" ON "Conversation"("projectId");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StudySession_conversationId_key" ON "StudySession"("conversationId");

-- CreateIndex
CREATE INDEX "StudySession_projectId_status_idx" ON "StudySession"("projectId", "status");

-- CreateIndex
CREATE INDEX "StudySession_knowledgeNodeId_idx" ON "StudySession"("knowledgeNodeId");

-- CreateIndex
CREATE INDEX "StudySession_studyTaskId_idx" ON "StudySession"("studyTaskId");

-- CreateIndex
CREATE INDEX "Quiz_knowledgeNodeId_idx" ON "Quiz"("knowledgeNodeId");

-- CreateIndex
CREATE INDEX "Quiz_studySessionId_idx" ON "Quiz"("studySessionId");

-- CreateIndex
CREATE INDEX "QuizQuestion_quizId_idx" ON "QuizQuestion"("quizId");

-- CreateIndex
CREATE INDEX "QuizOption_questionId_idx" ON "QuizOption"("questionId");

-- CreateIndex
CREATE INDEX "QuizAttempt_questionId_idx" ON "QuizAttempt"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "WrongbookItem_quizAttemptId_key" ON "WrongbookItem"("quizAttemptId");

-- CreateIndex
CREATE INDEX "WrongbookItem_userId_status_idx" ON "WrongbookItem"("userId", "status");

-- CreateIndex
CREATE INDEX "WrongbookItem_projectId_idx" ON "WrongbookItem"("projectId");

-- CreateIndex
CREATE INDEX "WrongbookItem_knowledgeNodeId_idx" ON "WrongbookItem"("knowledgeNodeId");

-- CreateIndex
CREATE UNIQUE INDEX "DailySummary_studySessionId_key" ON "DailySummary"("studySessionId");

-- CreateIndex
CREATE INDEX "DailySummary_userId_summaryDate_idx" ON "DailySummary"("userId", "summaryDate");

-- CreateIndex
CREATE INDEX "DailySummary_projectId_idx" ON "DailySummary"("projectId");

-- CreateIndex
CREATE INDEX "SummarySuggestion_summaryId_status_idx" ON "SummarySuggestion"("summaryId", "status");

-- CreateIndex
CREATE INDEX "SummarySuggestion_knowledgeNodeId_idx" ON "SummarySuggestion"("knowledgeNodeId");
