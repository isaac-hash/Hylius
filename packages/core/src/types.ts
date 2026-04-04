export interface ServerConfig {
    host: string;
    username: string;
    privateKeyPath?: string; // Local path to private key
    privateKey?: string;     // Raw private key string (encrypted in DB)
    password?: string;       // SSH password (Alternative to key)
    port?: number;
}

export interface ProjectConfig {
    name: string;
    repoUrl: string;
    localBundlePath?: string; // Local path to the uploaded tarball on the server
    branch?: string;
    buildCommand?: string;
    startCommand?: string;
    env?: Record<string, string>;
    deployPath: string; // e.g. /var/www/my-app
    deployStrategy?: 'auto' | 'pm2' | 'docker-compose' | 'dockerfile' | 'railpack' | 'nixpacks' | 'ghcr-pull' | 'compose-registry' | 'compose-server' | 'dagger';
    dockerComposeFile?: string;
    dockerImage?: string;
    containerName?: string;
    dockerRunCommand?: string;
    ghcrImage?: string;
    environment?: 'PRODUCTION' | 'PREVIEW';
    previewId?: string; // e.g. "pr-12"
}

export type TriggerSource = 'cli' | 'dashboard' | 'webhook';

export interface DeployOptions {
    server: ServerConfig;
    project: ProjectConfig;
    trigger: TriggerSource;
    /**
     * Optional callback for real-time log streaming.
     * Logic: CLI uses console.log, Dashboard uses socket.emit.
     */
    onLog?: (chunk: string) => void;
    /**
     * Optional: domains configured for this project.
     * If present, Caddy will be updated post-deploy.
     */
    domains?: DomainConfig[];
    /**
     * TLS mode for Caddy: 'production' (Let's Encrypt) or 'internal' (self-signed).
     */
    tlsMode?: 'production' | 'internal';
}

export interface DeployResult {
    success: boolean;
    releaseId: string;   // Timestamp-based ID, e.g., '20260220-153000'
    commitHash?: string;
    durationMs: number;
    error?: string;
    url?: string;        // Live URL where the app is accessible
}

export interface PulseMetrics {
    cpu: number;    // Percentage (0-100)
    memory: number; // Percentage (0-100)
    disk: number;   // Percentage (0-100)
    uptime: number; // Seconds
}

export interface RollbackOptions {
    server: ServerConfig;
    project: ProjectConfig;
    releaseId: string;
}

export interface SetupOptions {
    server: ServerConfig;
    /**
     * Optional callback for real-time log streaming of the setup process.
     */
    onLog?: (chunk: string) => void;
}

export interface SetupResult {
    success: boolean;
    durationMs: number;
    error?: string;
}

export interface DomainConfig {
    hostname: string;
    upstreamPort?: string; // e.g. "3000"
}

export interface DomainResult {
    success: boolean;
    hostname: string;
    sslProvisioned: boolean;
    error?: string;
}

export interface ConfigureCaddyOptions {
    domains: DomainConfig[];
    tlsMode?: 'production' | 'internal'; // Default: 'production'
}

// ─── Database Management ─────────────────────────────────────────────────────

export type DatabaseEngine = 'POSTGRES' | 'MYSQL' | 'REDIS';

export interface DatabaseProvisionOptions {
    server: ServerConfig;
    /** User-friendly name → Docker container name: hylius-db-{name} */
    name: string;
    engine: DatabaseEngine;
    /** Docker image tag. Defaults: POSTGRES→'16', MYSQL→'8', REDIS→'7' */
    version?: string;
    /** Database name inside the engine. Default: "{name}_db" */
    dbName?: string;
    /** DB username. Default: "{name}_user". Ignored for Redis. */
    dbUser?: string;
    /** Pre-generated password (caller is responsible for generating + encrypting) */
    password: string;
    onLog?: (chunk: string) => void;
}

export interface DatabaseProvisionResult {
    success: boolean;
    containerName: string;
    port: number;
    dbName: string;
    dbUser: string;
    /** Full connection string, e.g. postgres://user:pass@localhost:5432/db */
    connectionString: string;
    error?: string;
    durationMs: number;
}

export interface DatabaseDestroyOptions {
    server: ServerConfig;
    containerName: string;
    /** If true, removes the Docker volume (data loss). Default: false */
    removeVolume?: boolean;
    onLog?: (chunk: string) => void;
}

export interface DatabaseDestroyResult {
    success: boolean;
    error?: string;
    durationMs: number;
}

export interface DatabaseStatusOptions {
    server: ServerConfig;
    containerName: string;
}

export interface DatabaseStatusResult {
    running: boolean;
    containerName: string;
    port?: number;
    uptime?: string;
    error?: string;
}

export interface DatabaseBackupOptions {
    server: ServerConfig;
    containerName: string;
    engine: DatabaseEngine;
    dbName: string;
    dbUser: string;
    password: string;
    onLog?: (chunk: string) => void;
}

export interface DatabaseBackupResult {
    success: boolean;
    /** Path on VPS: /opt/hylius/backups/{containerName}-{timestamp}.sql.gz */
    backupPath: string;
    sizeBytes?: number;
    error?: string;
    durationMs: number;
}

export interface DatabaseLogsOptions {
    server: ServerConfig;
    containerName: string;
    /** Number of tail lines to fetch. Default: 100 */
    tailLines?: number;
}

export interface DatabaseLogsResult {
    success: boolean;
    logs: string;
    error?: string;
}
