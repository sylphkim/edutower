-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_WrongbookItem" (
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
    "subject" TEXT NOT NULL DEFAULT 'uncategorized',
    "category" TEXT NOT NULL DEFAULT 'uncategorized',
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
INSERT INTO "new_WrongbookItem" ("correctAnswer", "correctedAt", "createdAt", "deletedAt", "explanation", "id", "knowledgeNodeId", "lastReviewedAt", "projectId", "questionPrompt", "questionType", "quizAttemptId", "quizQuestionId", "reviewCount", "status", "updatedAt", "userId", "wrongAnswer") SELECT "correctAnswer", "correctedAt", "createdAt", "deletedAt", "explanation", "id", "knowledgeNodeId", "lastReviewedAt", "projectId", "questionPrompt", "questionType", "quizAttemptId", "quizQuestionId", "reviewCount", "status", "updatedAt", "userId", "wrongAnswer" FROM "WrongbookItem";
DROP TABLE "WrongbookItem";
ALTER TABLE "new_WrongbookItem" RENAME TO "WrongbookItem";
CREATE UNIQUE INDEX "WrongbookItem_quizAttemptId_key" ON "WrongbookItem"("quizAttemptId");
CREATE INDEX "WrongbookItem_userId_status_idx" ON "WrongbookItem"("userId", "status");
CREATE INDEX "WrongbookItem_userId_subject_idx" ON "WrongbookItem"("userId", "subject");
CREATE INDEX "WrongbookItem_userId_category_idx" ON "WrongbookItem"("userId", "category");
CREATE INDEX "WrongbookItem_projectId_idx" ON "WrongbookItem"("projectId");
CREATE INDEX "WrongbookItem_knowledgeNodeId_idx" ON "WrongbookItem"("knowledgeNodeId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
