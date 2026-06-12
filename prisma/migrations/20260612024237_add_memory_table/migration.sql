-- CreateTable
CREATE TABLE "Memory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "importance" TEXT NOT NULL DEFAULT 'medium',
    "relatedMaterialIds" TEXT NOT NULL DEFAULT '[]',
    "relatedSkillIds" TEXT NOT NULL DEFAULT '[]',
    "relatedQuizIds" TEXT NOT NULL DEFAULT '[]',
    "relatedWrongbookIds" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
