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
    deployStrategy?: 'auto' | 'pm2' | 'docker-compose' | 'dockerfile' | 'railpack' | 'nixpacks';
    dockerComposeFile?: string;
    dockerImage?: string;
    containerName?: string;
    dockerRunCommand?: string;
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
