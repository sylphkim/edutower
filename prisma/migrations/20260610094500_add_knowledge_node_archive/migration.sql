ALTER TABLE "KnowledgeNode" ADD COLUMN "archivedAt" DATETIME;

CREATE INDEX "KnowledgeNode_projectId_archivedAt_idx" ON "KnowledgeNode"("projectId", "archivedAt");
