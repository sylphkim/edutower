/*
  Warnings:

  - Added the required column `userId` to the `Memory` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "Concept" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT,
    "aliases" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Concept_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConceptMastery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "conceptId" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'learning',
    "mastery" INTEGER NOT NULL DEFAULT 0,
    "sources" TEXT NOT NULL DEFAULT '[]',
    "lastSeenAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ConceptMastery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ConceptMastery_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "Concept" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KnowledgeNodeConcept" (
    "knowledgeNodeId" TEXT NOT NULL,
    "conceptId" TEXT NOT NULL,
    "source" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("knowledgeNodeId", "conceptId"),
    CONSTRAINT "KnowledgeNodeConcept_knowledgeNodeId_fkey" FOREIGN KEY ("knowledgeNodeId") REFERENCES "KnowledgeNode" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "KnowledgeNodeConcept_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "Concept" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Memory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "importance" TEXT NOT NULL DEFAULT 'medium',
    "relatedMaterialIds" TEXT NOT NULL DEFAULT '[]',
    "relatedSkillIds" TEXT NOT NULL DEFAULT '[]',
    "relatedQuizIds" TEXT NOT NULL DEFAULT '[]',
    "relatedWrongbookIds" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Memory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Memory" ("content", "createdAt", "id", "importance", "relatedMaterialIds", "relatedQuizIds", "relatedSkillIds", "relatedWrongbookIds", "title", "type", "updatedAt") SELECT "content", "createdAt", "id", "importance", "relatedMaterialIds", "relatedQuizIds", "relatedSkillIds", "relatedWrongbookIds", "title", "type", "updatedAt" FROM "Memory";
DROP TABLE "Memory";
ALTER TABLE "new_Memory" RENAME TO "Memory";
CREATE INDEX "Memory_userId_idx" ON "Memory"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Concept_userId_idx" ON "Concept"("userId");

-- CreateIndex
CREATE INDEX "Concept_userId_subject_idx" ON "Concept"("userId", "subject");

-- CreateIndex
CREATE UNIQUE INDEX "Concept_userId_key_key" ON "Concept"("userId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "ConceptMastery_conceptId_key" ON "ConceptMastery"("conceptId");

-- CreateIndex
CREATE INDEX "ConceptMastery_userId_state_idx" ON "ConceptMastery"("userId", "state");

-- CreateIndex
CREATE INDEX "KnowledgeNodeConcept_conceptId_idx" ON "KnowledgeNodeConcept"("conceptId");
