/*
  Warnings:

  - You are about to drop the column `isPublished` on the `Frame` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Frame" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "breakpointWidth" INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "designEvents" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Frame_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Frame" ("breakpointWidth", "createdAt", "designEvents", "id", "name", "order", "pageId", "updatedAt") SELECT "breakpointWidth", "createdAt", "designEvents", "id", "name", "order", "pageId", "updatedAt" FROM "Frame";
DROP TABLE "Frame";
ALTER TABLE "new_Frame" RENAME TO "Frame";
CREATE INDEX "Frame_pageId_idx" ON "Frame"("pageId");
CREATE INDEX "Frame_breakpointWidth_idx" ON "Frame"("breakpointWidth");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
