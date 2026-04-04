-- Phase 7: Database Management — Add Database model
-- Run: npx prisma migrate dev --name add_database_model (after stopping the dashboard)
-- Or:  npx prisma db push (when dashboard is not running)

CREATE TABLE IF NOT EXISTS "Database" (
    "id"                TEXT NOT NULL PRIMARY KEY,
    "name"              TEXT NOT NULL,
    "engine"            TEXT NOT NULL,
    "version"           TEXT NOT NULL DEFAULT 'latest',
    "status"            TEXT NOT NULL DEFAULT 'PENDING',
    "containerName"     TEXT,
    "port"              INTEGER,
    "dbName"            TEXT,
    "dbUser"            TEXT,
    "passwordEncrypted" TEXT,
    "passwordIv"        TEXT,
    "errorMessage"      TEXT,
    "serverId"          TEXT NOT NULL,
    "projectId"         TEXT,
    "organizationId"    TEXT NOT NULL,
    "createdAt"         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         DATETIME NOT NULL,
    CONSTRAINT "Database_serverId_fkey"       FOREIGN KEY ("serverId")       REFERENCES "Server" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Database_projectId_fkey"      FOREIGN KEY ("projectId")      REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Database_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "Database_serverId_idx"       ON "Database"("serverId");
CREATE INDEX IF NOT EXISTS "Database_projectId_idx"      ON "Database"("projectId");
CREATE INDEX IF NOT EXISTS "Database_organizationId_idx" ON "Database"("organizationId");
