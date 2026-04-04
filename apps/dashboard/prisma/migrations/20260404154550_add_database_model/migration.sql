-- AlterTable
ALTER TABLE "Project" ADD COLUMN "deployStrategy" TEXT;
ALTER TABLE "Project" ADD COLUMN "ghcrImage" TEXT;
ALTER TABLE "Project" ADD COLUMN "githubInstallationId" INTEGER;
ALTER TABLE "Project" ADD COLUMN "githubRepoFullName" TEXT;

-- CreateTable
CREATE TABLE "GitHubInstallation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "installationId" INTEGER NOT NULL,
    "accountLogin" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GitHubInstallation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Database" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "engine" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT 'latest',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "containerName" TEXT,
    "port" INTEGER,
    "dbName" TEXT,
    "dbUser" TEXT,
    "passwordEncrypted" TEXT,
    "passwordIv" TEXT,
    "errorMessage" TEXT,
    "serverId" TEXT NOT NULL,
    "projectId" TEXT,
    "organizationId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Database_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Database_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Database_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Deployment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "releaseId" TEXT NOT NULL,
    "commitHash" TEXT,
    "environment" TEXT NOT NULL DEFAULT 'PRODUCTION',
    "pullRequestNumber" INTEGER,
    "status" TEXT NOT NULL,
    "triggerSource" TEXT NOT NULL,
    "durationMs" INTEGER,
    "logPath" TEXT,
    "logContent" TEXT,
    "deployUrl" TEXT,
    "projectId" TEXT NOT NULL,
    "organizationId" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    CONSTRAINT "Deployment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Deployment" ("commitHash", "deployUrl", "durationMs", "finishedAt", "id", "logPath", "organizationId", "projectId", "releaseId", "startedAt", "status", "triggerSource") SELECT "commitHash", "deployUrl", "durationMs", "finishedAt", "id", "logPath", "organizationId", "projectId", "releaseId", "startedAt", "status", "triggerSource" FROM "Deployment";
DROP TABLE "Deployment";
ALTER TABLE "new_Deployment" RENAME TO "Deployment";
CREATE INDEX "Deployment_projectId_idx" ON "Deployment"("projectId");
CREATE INDEX "Deployment_organizationId_idx" ON "Deployment"("organizationId");
CREATE INDEX "Deployment_startedAt_idx" ON "Deployment"("startedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "GitHubInstallation_installationId_key" ON "GitHubInstallation"("installationId");

-- CreateIndex
CREATE INDEX "GitHubInstallation_organizationId_idx" ON "GitHubInstallation"("organizationId");

-- CreateIndex
CREATE INDEX "Database_serverId_idx" ON "Database"("serverId");

-- CreateIndex
CREATE INDEX "Database_projectId_idx" ON "Database"("projectId");

-- CreateIndex
CREATE INDEX "Database_organizationId_idx" ON "Database"("organizationId");
