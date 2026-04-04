/**
 * Unit Tests for packages/core/src/database.ts
 *
 * Run: cd packages/core && npx vitest run src/database.test.ts
 * Or:  cd packages/core && npx vitest --reporter=verbose
 *
 * These tests mock SSHClient so no real VPS is needed.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock SSHClient ──────────────────────────────────────────────────────────

const mockExec = vi.fn();
const mockExecStream = vi.fn();
const mockConnect = vi.fn();
const mockEnd = vi.fn();

vi.mock('./ssh/client.js', () => ({
    SSHClient: function (this: any) {
        this.connect = mockConnect;
        this.exec = mockExec;
        this.execStream = mockExecStream;
        this.end = mockEnd;
    },
}));

// Import after mocking
import {
    provisionDatabase,
    destroyDatabase,
    getDatabaseStatus,
    backupDatabase,
    getDatabaseLogs,
    buildDbConnectionString,
} from './database.js';

const mockServer = {
    host: '1.2.3.4',
    username: 'root',
    privateKey: '-----BEGIN OPENSSH PRIVATE KEY-----\nfake\n-----END OPENSSH PRIVATE KEY-----',
};

beforeEach(() => {
    vi.clearAllMocks();
    mockConnect.mockResolvedValue(undefined);
    mockEnd.mockReturnValue(undefined);
});

// ─── buildDbConnectionString ──────────────────────────────────────────────────

describe('buildDbConnectionString', () => {
    it('builds correct Postgres URL', () => {
        const url = buildDbConnectionString('POSTGRES', 'myuser', 'secret', 5432, 'mydb');
        expect(url).toBe('postgresql://myuser:secret@localhost:5432/mydb');
    });

    it('builds correct MySQL URL', () => {
        const url = buildDbConnectionString('MYSQL', 'myuser', 'secret', 3306, 'mydb');
        expect(url).toBe('mysql://myuser:secret@localhost:3306/mydb');
    });

    it('builds correct Redis URL (no dbName needed)', () => {
        const url = buildDbConnectionString('REDIS', '', 'secret', 6379, '');
        expect(url).toBe('redis://:secret@localhost:6379');
    });

    it('URL-encodes special characters in password', () => {
        const url = buildDbConnectionString('POSTGRES', 'u', 'p@ss:word/x', 5432, 'db');
        expect(url).toContain('p%40ss%3Aword%2Fx');
    });
});

// ─── provisionDatabase ────────────────────────────────────────────────────────

describe('provisionDatabase', () => {
    const baseOptions = {
        server: mockServer,
        name: 'test-db',
        engine: 'POSTGRES' as const,
        password: 'supersecret',
    };

    beforeEach(() => {
        // Mock: no used ports (port finder returns empty)
        mockExec.mockImplementation(async (cmd: string) => {
            if (cmd.includes('docker ps --format')) return { stdout: '', stderr: '', code: 0 };
            if (cmd.includes('docker rm -f')) return { stdout: '', stderr: '', code: 0 };
            if (cmd.includes('docker run')) return { stdout: 'abc123', stderr: '', code: 0 };
            return { stdout: '', stderr: '', code: 0 };
        });
        mockExecStream.mockImplementation(async (_cmd: string, onOut: any) => {
            onOut?.('Pulling...\n');
            return 0;
        });
    });

    it('returns success with correct containerName', async () => {
        const result = await provisionDatabase(baseOptions);
        expect(result.success).toBe(true);
        expect(result.containerName).toBe('hylius-db-test-db');
    });

    it('assigns port from POSTGRES range (5432-5532)', async () => {
        const result = await provisionDatabase(baseOptions);
        expect(result.port).toBeGreaterThanOrEqual(5432);
        expect(result.port).toBeLessThanOrEqual(5532);
    });

    it('returns correct Postgres connection string', async () => {
        const result = await provisionDatabase(baseOptions);
        expect(result.connectionString).toMatch(/^postgresql:\/\//);
        expect(result.connectionString).toContain('localhost');
        expect(result.connectionString).toContain('test_db_db');
    });

    it('assigns port from MYSQL range (3306-3406) for MySQL', async () => {
        const result = await provisionDatabase({ ...baseOptions, engine: 'MYSQL' });
        expect(result.success).toBe(true);
        expect(result.port).toBeGreaterThanOrEqual(3306);
        expect(result.port).toBeLessThanOrEqual(3406);
        expect(result.connectionString).toMatch(/^mysql:\/\//);
    });

    it('uses correct Redis range (6379-6479)', async () => {
        const result = await provisionDatabase({ ...baseOptions, engine: 'REDIS' });
        expect(result.success).toBe(true);
        expect(result.port).toBeGreaterThanOrEqual(6379);
        expect(result.port).toBeLessThanOrEqual(6479);
        expect(result.connectionString).toMatch(/^redis:\/\//);
    });

    it('skips already-used ports', async () => {
        // Simulate port 5432 being occupied
        mockExec.mockImplementation(async (cmd: string) => {
            if (cmd.includes('docker ps --format')) {
                return { stdout: '0.0.0.0:5432->5432/tcp\n', stderr: '', code: 0 };
            }
            if (cmd.includes('docker rm -f')) return { stdout: '', stderr: '', code: 0 };
            if (cmd.includes('docker run')) return { stdout: 'abc123', stderr: '', code: 0 };
            return { stdout: '', stderr: '', code: 0 };
        });

        const result = await provisionDatabase(baseOptions);
        expect(result.port).toBe(5433); // Next free port
    });

    it('returns success: false when docker run fails', async () => {
        mockExec.mockImplementation(async (cmd: string) => {
            if (cmd.includes('docker ps --format')) return { stdout: '', stderr: '', code: 0 };
            if (cmd.includes('docker rm -f')) return { stdout: '', stderr: '', code: 0 };
            if (cmd.includes('docker run')) return { stdout: '', stderr: 'port already allocated', code: 1 };
            return { stdout: '', stderr: '', code: 0 };
        });

        const result = await provisionDatabase(baseOptions);
        expect(result.success).toBe(false);
        expect(result.error).toContain('port already allocated');
    });

    it('calls onLog with progress messages', async () => {
        const logs: string[] = [];
        await provisionDatabase({ ...baseOptions, onLog: (chunk) => logs.push(chunk) });
        const allLogs = logs.join('');
        expect(allLogs).toContain('Assigned port');
        expect(allLogs).toContain('container started');
    });
});

// ─── destroyDatabase ──────────────────────────────────────────────────────────

describe('destroyDatabase', () => {
    it('runs docker rm -f for the container', async () => {
        mockExec.mockResolvedValue({ stdout: '', stderr: '', code: 0 });
        const result = await destroyDatabase({
            server: mockServer,
            containerName: 'hylius-db-test-db',
        });
        expect(result.success).toBe(true);
        const execCalls = mockExec.mock.calls.map((c: any[]) => c[0]);
        expect(execCalls.some((c: string) => c.includes('docker rm -f hylius-db-test-db'))).toBe(true);
    });

    it('also removes volume when removeVolume=true', async () => {
        mockExec.mockResolvedValue({ stdout: '', stderr: '', code: 0 });
        await destroyDatabase({
            server: mockServer,
            containerName: 'hylius-db-test-db',
            removeVolume: true,
        });
        const execCalls = mockExec.mock.calls.map((c: any[]) => c[0]);
        expect(execCalls.some((c: string) => c.includes('docker volume rm hylius-db-test-db-data'))).toBe(true);
    });

    it('does NOT remove volume when removeVolume=false (default)', async () => {
        mockExec.mockResolvedValue({ stdout: '', stderr: '', code: 0 });
        await destroyDatabase({
            server: mockServer,
            containerName: 'hylius-db-test-db',
        });
        const execCalls = mockExec.mock.calls.map((c: any[]) => c[0]);
        expect(execCalls.some((c: string) => c.includes('docker volume rm'))).toBe(false);
    });
});

// ─── getDatabaseStatus ────────────────────────────────────────────────────────

describe('getDatabaseStatus', () => {
    it('returns running: true when container is running', async () => {
        mockExec.mockImplementation(async (cmd: string) => {
            if (cmd.includes('docker inspect')) return { stdout: 'true|2026-04-04T12:00:00Z|{}', stderr: '', code: 0 };
            if (cmd.includes('docker port')) return { stdout: '5432', stderr: '', code: 0 };
            return { stdout: '', stderr: '', code: 0 };
        });

        const result = await getDatabaseStatus({ server: mockServer, containerName: 'hylius-db-test' });
        expect(result.running).toBe(true);
        expect(result.port).toBe(5432);
        expect(result.uptime).toBeDefined();
    });

    it('returns running: false when container is not found', async () => {
        mockExec.mockResolvedValue({ stdout: '', stderr: 'No such container', code: 1 });
        const result = await getDatabaseStatus({ server: mockServer, containerName: 'hylius-db-ghost' });
        expect(result.running).toBe(false);
    });
});

// ─── backupDatabase ───────────────────────────────────────────────────────────

describe('backupDatabase', () => {
    const baseOpts = {
        server: mockServer,
        containerName: 'hylius-db-test',
        engine: 'POSTGRES' as const,
        dbName: 'test_db',
        dbUser: 'test_user',
        password: 'secret',
    };

    it('runs pg_dump for POSTGRES', async () => {
        mockExec.mockResolvedValue({ stdout: '102400', stderr: '', code: 0 });
        const result = await backupDatabase(baseOpts);
        expect(result.success).toBe(true);
        expect(result.backupPath).toContain('/opt/hylius/backups/hylius-db-test-');
        expect(result.backupPath).toContain('.sql.gz');
        const calls = mockExec.mock.calls.map((c: any[]) => c[0]);
        expect(calls.some((c: string) => c.includes('pg_dump'))).toBe(true);
    });

    it('runs mysqldump for MYSQL', async () => {
        mockExec.mockResolvedValue({ stdout: '51200', stderr: '', code: 0 });
        const result = await backupDatabase({ ...baseOpts, engine: 'MYSQL' });
        expect(result.success).toBe(true);
        const calls = mockExec.mock.calls.map((c: any[]) => c[0]);
        expect(calls.some((c: string) => c.includes('mysqldump'))).toBe(true);
    });

    it('uses BGSAVE for REDIS', async () => {
        mockExec.mockResolvedValue({ stdout: '4096', stderr: '', code: 0 });
        const result = await backupDatabase({ ...baseOpts, engine: 'REDIS' });
        expect(result.success).toBe(true);
        const calls = mockExec.mock.calls.map((c: any[]) => c[0]);
        expect(calls.some((c: string) => c.includes('BGSAVE'))).toBe(true);
    });

    it('returns success: false when backup command fails', async () => {
        mockExec.mockImplementation(async (cmd: string) => {
            if (cmd.includes('mkdir')) return { stdout: '', stderr: '', code: 0 };
            if (cmd.includes('pg_dump')) return { stdout: '', stderr: 'Authentication failed', code: 1 };
            return { stdout: '', stderr: '', code: 0 };
        });
        const result = await backupDatabase(baseOpts);
        expect(result.success).toBe(false);
        expect(result.error).toContain('Authentication failed');
    });
});

// ─── getDatabaseLogs ──────────────────────────────────────────────────────────

describe('getDatabaseLogs', () => {
    it('returns logs from docker logs command', async () => {
        mockExec.mockResolvedValue({
            stdout: '2026-01-01 LOG: database system is ready',
            stderr: '',
            code: 0,
        });
        const result = await getDatabaseLogs({ server: mockServer, containerName: 'hylius-db-test' });
        expect(result.success).toBe(true);
        expect(result.logs).toContain('database system is ready');
    });

    it('returns success: false when container not found', async () => {
        mockExec.mockResolvedValue({ stdout: '', stderr: '', code: 1 });
        const result = await getDatabaseLogs({ server: mockServer, containerName: 'does-not-exist' });
        expect(result.success).toBe(false);
    });
});
