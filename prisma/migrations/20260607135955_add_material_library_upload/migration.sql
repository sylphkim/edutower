-- CreateTable
CREATE TABLE "MaterialFolder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MaterialFolder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Material" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "folderId" TEXT,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "sourceType" TEXT,
    "origin" TEXT NOT NULL DEFAULT 'manual',
    "status" TEXT NOT NULL DEFAULT 'ready',
    "originalFileName" TEXT,
    "storedFileName" TEXT,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "storagePath" TEXT,
    "summary" TEXT,
    "extractedText" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Material_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Material_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "MaterialFolder" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Material" ("category", "createdAt", "extractedText", "id", "origin", "sourceType", "status", "summary", "title", "updatedAt", "userId") SELECT "category", "createdAt", "extractedText", "id", "origin", "sourceType", "status", "summary", "title", "updatedAt", "userId" FROM "Material";
DROP TABLE "Material";
ALTER TABLE "new_Material" RENAME TO "Material";
CREATE UNIQUE INDEX "Material_storedFileName_key" ON "Material"("storedFileName");
CREATE INDEX "Material_userId_idx" ON "Material"("userId");
CREATE INDEX "Material_userId_folderId_idx" ON "Material"("userId", "folderId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "MaterialFolder_userId_idx" ON "MaterialFolder"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialFolder_userId_normalizedName_key" ON "MaterialFolder"("userId", "normalizedName");
