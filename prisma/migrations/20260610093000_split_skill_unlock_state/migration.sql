-- Split knowledge node progress from unlock eligibility.
-- Existing status values are mapped as follows:
-- locked -> not_started + locked, except root nodes become unlocked by the new root rule
-- available -> not_started + unlocked
-- in_progress -> learning + unlocked
-- mastered -> mastered + unlocked

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_KnowledgeNode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "parentId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "learningState" TEXT NOT NULL DEFAULT 'not_started',
    "isUnlocked" BOOLEAN NOT NULL DEFAULT false,
    "unlockedAt" DATETIME,
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

INSERT INTO "new_KnowledgeNode" (
    "id",
    "projectId",
    "parentId",
    "title",
    "description",
    "learningState",
    "isUnlocked",
    "unlockedAt",
    "selfMastery",
    "systemMastery",
    "confidence",
    "mastery",
    "order",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "projectId",
    "parentId",
    "title",
    "description",
    CASE "status"
        WHEN 'in_progress' THEN 'learning'
        WHEN 'mastered' THEN 'mastered'
        ELSE 'not_started'
    END,
    CASE
        WHEN "status" != 'locked' THEN true
        WHEN NOT EXISTS (
            SELECT 1
            FROM "KnowledgeNodePrerequisite"
            WHERE "KnowledgeNodePrerequisite"."nodeId" = "KnowledgeNode"."id"
        ) THEN true
        ELSE false
    END,
    CASE
        WHEN "status" != 'locked' THEN "updatedAt"
        WHEN NOT EXISTS (
            SELECT 1
            FROM "KnowledgeNodePrerequisite"
            WHERE "KnowledgeNodePrerequisite"."nodeId" = "KnowledgeNode"."id"
        ) THEN "updatedAt"
        ELSE NULL
    END,
    "selfMastery",
    "systemMastery",
    "confidence",
    "mastery",
    "order",
    "createdAt",
    "updatedAt"
FROM "KnowledgeNode";

DROP TABLE "KnowledgeNode";
ALTER TABLE "new_KnowledgeNode" RENAME TO "KnowledgeNode";

CREATE INDEX "KnowledgeNode_projectId_parentId_idx" ON "KnowledgeNode"("projectId", "parentId");

CREATE TABLE "new_SummarySuggestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "summaryId" TEXT NOT NULL,
    "knowledgeNodeId" TEXT,
    "studyTaskId" TEXT,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "proposedLearningState" TEXT,
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

INSERT INTO "new_SummarySuggestion" (
    "id",
    "summaryId",
    "knowledgeNodeId",
    "studyTaskId",
    "type",
    "content",
    "proposedLearningState",
    "proposedMastery",
    "modifiedContent",
    "status",
    "decidedAt",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "summaryId",
    "knowledgeNodeId",
    "studyTaskId",
    "type",
    "content",
    CASE "proposedStatus"
        WHEN 'in_progress' THEN 'learning'
        WHEN 'mastered' THEN 'mastered'
        WHEN 'locked' THEN 'not_started'
        WHEN 'available' THEN 'not_started'
        ELSE NULL
    END,
    "proposedMastery",
    "modifiedContent",
    "status",
    "decidedAt",
    "createdAt",
    "updatedAt"
FROM "SummarySuggestion";

DROP TABLE "SummarySuggestion";
ALTER TABLE "new_SummarySuggestion" RENAME TO "SummarySuggestion";

CREATE INDEX "SummarySuggestion_summaryId_status_idx" ON "SummarySuggestion"("summaryId", "status");
CREATE INDEX "SummarySuggestion_knowledgeNodeId_idx" ON "SummarySuggestion"("knowledgeNodeId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
