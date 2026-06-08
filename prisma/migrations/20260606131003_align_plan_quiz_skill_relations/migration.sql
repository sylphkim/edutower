-- CreateTable
CREATE TABLE "KnowledgeNodePrerequisite" (
    "nodeId" TEXT NOT NULL,
    "prerequisiteId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("nodeId", "prerequisiteId"),
    CONSTRAINT "KnowledgeNodePrerequisite_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "KnowledgeNode" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "KnowledgeNodePrerequisite_prerequisiteId_fkey" FOREIGN KEY ("prerequisiteId") REFERENCES "KnowledgeNode" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Quiz" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "knowledgeNodeId" TEXT NOT NULL,
    "studySessionId" TEXT,
    "studyTaskId" TEXT,
    "title" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL DEFAULT 'pass',
    "round" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Quiz_knowledgeNodeId_fkey" FOREIGN KEY ("knowledgeNodeId") REFERENCES "KnowledgeNode" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Quiz_studySessionId_fkey" FOREIGN KEY ("studySessionId") REFERENCES "StudySession" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Quiz_studyTaskId_fkey" FOREIGN KEY ("studyTaskId") REFERENCES "StudyTask" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Quiz" ("createdAt", "difficulty", "id", "knowledgeNodeId", "round", "studySessionId", "title", "updatedAt") SELECT "createdAt", "difficulty", "id", "knowledgeNodeId", "round", "studySessionId", "title", "updatedAt" FROM "Quiz";
DROP TABLE "Quiz";
ALTER TABLE "new_Quiz" RENAME TO "Quiz";
CREATE INDEX "Quiz_knowledgeNodeId_idx" ON "Quiz"("knowledgeNodeId");
CREATE INDEX "Quiz_studySessionId_idx" ON "Quiz"("studySessionId");
CREATE INDEX "Quiz_studyTaskId_idx" ON "Quiz"("studyTaskId");
CREATE TABLE "new_StudyTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "knowledgeNodeId" TEXT,
    "materialId" TEXT,
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
    CONSTRAINT "StudyTask_knowledgeNodeId_fkey" FOREIGN KEY ("knowledgeNodeId") REFERENCES "KnowledgeNode" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StudyTask_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_StudyTask" ("completedAt", "createdAt", "day", "id", "isRecommended", "isSelected", "knowledgeNodeId", "order", "projectId", "status", "title", "type", "updatedAt") SELECT "completedAt", "createdAt", "day", "id", "isRecommended", "isSelected", "knowledgeNodeId", "order", "projectId", "status", "title", "type", "updatedAt" FROM "StudyTask";
DROP TABLE "StudyTask";
ALTER TABLE "new_StudyTask" RENAME TO "StudyTask";
CREATE INDEX "StudyTask_projectId_idx" ON "StudyTask"("projectId");
CREATE INDEX "StudyTask_knowledgeNodeId_idx" ON "StudyTask"("knowledgeNodeId");
CREATE INDEX "StudyTask_materialId_idx" ON "StudyTask"("materialId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "KnowledgeNodePrerequisite_prerequisiteId_idx" ON "KnowledgeNodePrerequisite"("prerequisiteId");
