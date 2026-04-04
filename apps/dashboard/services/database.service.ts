/* eslint-disable no-console, @typescript-eslint/ban-ts-comment, @typescript-eslint/no-explicit-any */
import crypto from 'crypto';
// @ts-ignore - Local workspace package
import {
    provisionDatabase,
    destroyDatabase,
    getDatabaseStatus,
    backupDatabase,
    getDatabaseLogs,
    buildDbConnectionString,
    DatabaseEngine,
    ServerConfig,
} from '@hylius/core';
import { decrypt, encrypt } from './crypto.service';
import { prisma } from './prisma';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateDatabaseOptions {
    serverId: string;
    organizationId: string;
    engine: DatabaseEngine;
    name: string;
    version?: string;
    projectId?: string;
    onLog?: (chunk: string) => void;
}

export interface DatabaseRecord {
    id: string;
    name: string;
    engine: string;
    version: string;
    status: string;
    containerName: string | null;
    port: number | null;
    dbName: string | null;
    dbUser: string | null;
    errorMessage: string | null;
    projectId: string | null;
    serverId: string;
    organizationId: string;
    createdAt: Date;
    updatedAt: Date;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generatePassword(): string {
    return crypto.randomBytes(24).toString('base64url');
}

async function getServerConfig(serverId: string): Promise<ServerConfig & { privateKey?: string; password?: string }> {
    const server = await prisma.server.findUnique({ where: { id: serverId } });
    if (!server) throw new Error('Server not found');

    let privateKey = '';
    if (server.privateKeyEncrypted && server.keyIv) {
        try { privateKey = decrypt(server.privateKeyEncrypted, server.keyIv); } catch {}
    }

    return {
        host: server.ip,
        port: server.port,
        username: server.username,
        privateKey: privateKey.includes('BEGIN') ? privateKey : undefined,
        password: privateKey && !privateKey.includes('BEGIN') ? privateKey : undefined,
    };
}

/**
 * Build connection string from a Database record (decrypts password on-the-fly).
 */
export function buildConnectionStringFromRecord(db: any): string {
    if (!db.passwordEncrypted || !db.passwordIv) return '';
    try {
        const password = decrypt(db.passwordEncrypted, db.passwordIv);
        return buildDbConnectionString(
            db.engine as DatabaseEngine,
            db.dbUser || '',
            password,
            db.port || 0,
            db.dbName || '',
        );
    } catch {
        return '';
    }
}

// ─── createDatabase ───────────────────────────────────────────────────────────

/**
 * Provisions a new managed database container on a VPS.
 * Creates the Prisma record first, then SSHes to the VPS to start the container.
 */
export async function createDatabase(options: CreateDatabaseOptions): Promise<{ id: string; error?: string }> {
    const { serverId, organizationId, engine, name, version, projectId, onLog } = options;
    const log = (msg: string) => { if (onLog) onLog(msg); };

    const password = generatePassword();
    const { encrypted, iv } = encrypt(password);

    // Create the DB record in PROVISIONING state
    // @ts-ignore
    const dbRecord = await prisma.database.create({
        data: {
            name,
            engine,
            version: version || { POSTGRES: '16', MYSQL: '8', REDIS: '7' }[engine] || 'latest',
            status: 'PROVISIONING',
            passwordEncrypted: encrypted,
            passwordIv: iv,
            serverId,
            organizationId,
            projectId: projectId || null,
        },
    });

    try {
        const serverConfig = await getServerConfig(serverId);
        const result = await provisionDatabase({
            server: serverConfig,
            name,
            engine,
            version,
            password,
            onLog,
        });

        if (!result.success) {
            // @ts-ignore
            await prisma.database.update({
                where: { id: dbRecord.id },
                data: { status: 'ERROR', errorMessage: result.error || 'Provisioning failed' },
            });
            return { id: dbRecord.id, error: result.error };
        }

        // @ts-ignore
        await prisma.database.update({
            where: { id: dbRecord.id },
            data: {
                status: 'RUNNING',
                containerName: result.containerName,
                port: result.port,
                dbName: result.dbName,
                dbUser: result.dbUser,
                errorMessage: null,
            },
        });

        // If linked to a project, auto-inject DATABASE_URL / REDIS_URL into project envVars
        if (projectId) {
            await injectDatabaseUrlIntoProject(dbRecord.id, projectId, result.connectionString, engine);
            log(`\x1b[32m✅ DATABASE_URL injected into project environment\x1b[0m\n`);
        }

        await prisma.auditLog.create({
            data: {
                action: 'DATABASE_PROVISIONED',
                organizationId,
                metadata: JSON.stringify({ databaseId: dbRecord.id, engine, name, port: result.port }),
            },
        });

        return { id: dbRecord.id };
    } catch (err: any) {
        // @ts-ignore
        await prisma.database.update({
            where: { id: dbRecord.id },
            data: { status: 'ERROR', errorMessage: err.message },
        });
        log(`\x1b[31mDatabase provisioning error: ${err.message}\x1b[0m\n`);
        return { id: dbRecord.id, error: err.message };
    }
}

// ─── deleteDatabase ───────────────────────────────────────────────────────────

/**
 * Destroys a managed database container and removes the DB record.
 * By default, the Docker volume (data) is retained on the VPS.
 */
export async function deleteDatabase(databaseId: string, removeVolume = false): Promise<{ success: boolean; error?: string }> {
    // @ts-ignore
    const db = await prisma.database.findUnique({
        where: { id: databaseId },
        include: { server: true },
    });
    if (!db) throw new Error('Database not found');

    // Remove DATABASE_URL from linked project if linked
    if (db.projectId) {
        await removeDatabaseUrlFromProject(db.projectId, db.engine as DatabaseEngine);
    }

    if (db.containerName) {
        try {
            const serverConfig = await getServerConfig(db.serverId);
            await destroyDatabase({
                server: serverConfig,
                containerName: db.containerName,
                removeVolume,
            });
        } catch (err: any) {
            console.error(`[db-service] destroyDatabase SSH failed: ${err.message}. Removing DB record anyway.`);
        }
    }

    // @ts-ignore
    await prisma.database.delete({ where: { id: databaseId } });

    await prisma.auditLog.create({
        data: {
            action: 'DATABASE_DESTROYED',
            organizationId: db.organizationId,
            metadata: JSON.stringify({ databaseId, engine: db.engine, name: db.name, removeVolume }),
        },
    });

    return { success: true };
}

// ─── refreshDatabaseStatus ────────────────────────────────────────────────────

/**
 * Checks live container status via SSH and syncs it to the database record.
 */
export async function refreshDatabaseStatus(databaseId: string): Promise<{ running: boolean; port?: number; uptime?: string }> {
    // @ts-ignore
    const db = await prisma.database.findUnique({ where: { id: databaseId } });
    if (!db || !db.containerName) return { running: false };

    const serverConfig = await getServerConfig(db.serverId);
    const statusResult = await getDatabaseStatus({ server: serverConfig, containerName: db.containerName });

    const newStatus = statusResult.running ? 'RUNNING' : 'STOPPED';
    if (db.status !== newStatus) {
        // @ts-ignore
        await prisma.database.update({
            where: { id: databaseId },
            data: { status: newStatus },
        });
    }

    return {
        running: statusResult.running,
        port: statusResult.port,
        uptime: statusResult.uptime,
    };
}

// ─── runDatabaseBackup ────────────────────────────────────────────────────────

/**
 * Triggers a pg_dump/mysqldump/RDB backup and stores the file on the VPS.
 */
export async function runDatabaseBackup(databaseId: string, onLog?: (chunk: string) => void): Promise<{ backupPath: string; sizeBytes?: number; error?: string }> {
    // @ts-ignore
    const db = await prisma.database.findUnique({ where: { id: databaseId } });
    if (!db || !db.containerName) throw new Error('Database not found or has no container');

    let password = '';
    if (db.passwordEncrypted && db.passwordIv) {
        password = decrypt(db.passwordEncrypted, db.passwordIv);
    }

    const serverConfig = await getServerConfig(db.serverId);
    const result = await backupDatabase({
        server: serverConfig,
        containerName: db.containerName,
        engine: db.engine as DatabaseEngine,
        dbName: db.dbName || '',
        dbUser: db.dbUser || '',
        password,
        onLog,
    });

    if (result.success) {
        await prisma.auditLog.create({
            data: {
                action: 'DATABASE_BACKUP_CREATED',
                organizationId: db.organizationId,
                metadata: JSON.stringify({ databaseId, backupPath: result.backupPath, sizeBytes: result.sizeBytes }),
            },
        });
    }

    return { backupPath: result.backupPath, sizeBytes: result.sizeBytes, error: result.error };
}

// ─── fetchDatabaseLogs ────────────────────────────────────────────────────────

export async function fetchDatabaseLogs(databaseId: string, tailLines = 100): Promise<string> {
    // @ts-ignore
    const db = await prisma.database.findUnique({ where: { id: databaseId } });
    if (!db || !db.containerName) throw new Error('Database not found or has no container');

    const serverConfig = await getServerConfig(db.serverId);
    const result = await getDatabaseLogs({ server: serverConfig, containerName: db.containerName, tailLines });
    return result.logs;
}

// ─── linkDatabaseToProject ────────────────────────────────────────────────────

/**
 * Links a database to a project and automatically injects DATABASE_URL/REDIS_URL
 * into the project's envVars JSON field.
 */
export async function linkDatabaseToProject(databaseId: string, projectId: string): Promise<void> {
    // @ts-ignore
    const db = await prisma.database.findUnique({ where: { id: databaseId } });
    if (!db) throw new Error('Database not found');

    const connectionString = buildConnectionStringFromRecord(db);

    // @ts-ignore
    await prisma.database.update({
        where: { id: databaseId },
        data: { projectId },
    });

    await injectDatabaseUrlIntoProject(databaseId, projectId, connectionString, db.engine as DatabaseEngine);
}

// ─── unlinkDatabaseFromProject ────────────────────────────────────────────────

export async function unlinkDatabaseFromProject(databaseId: string): Promise<void> {
    // @ts-ignore
    const db = await prisma.database.findUnique({ where: { id: databaseId } });
    if (!db || !db.projectId) return;

    // @ts-ignore
    await prisma.database.update({
        where: { id: databaseId },
        data: { projectId: null },
    });

    await removeDatabaseUrlFromProject(db.projectId, db.engine as DatabaseEngine);
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

async function injectDatabaseUrlIntoProject(
    _databaseId: string,
    projectId: string,
    connectionString: string,
    engine: DatabaseEngine,
): Promise<void> {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return;

    let envVars: Record<string, string> = {};
    if (project.envVars) {
        try { envVars = JSON.parse(project.envVars as string); } catch {}
    }

    const envKey = engine === 'REDIS' ? 'REDIS_URL' : 'DATABASE_URL';
    envVars[envKey] = connectionString;

    await prisma.project.update({
        where: { id: projectId },
        data: { envVars: JSON.stringify(envVars) },
    });
}

async function removeDatabaseUrlFromProject(projectId: string, engine: DatabaseEngine): Promise<void> {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return;

    let envVars: Record<string, string> = {};
    if (project.envVars) {
        try { envVars = JSON.parse(project.envVars as string); } catch {}
    }

    const envKey = engine === 'REDIS' ? 'REDIS_URL' : 'DATABASE_URL';
    delete envVars[envKey];

    await prisma.project.update({
        where: { id: projectId },
        data: { envVars: JSON.stringify(envVars) },
    });
}
