import { Client, ClientChannel, ConnectConfig } from 'ssh2';
import { ServerConfig } from '../types.js';
import * as fs from 'fs';

export class SSHClient {
    private client: Client;
    private config: ServerConfig;

    constructor(config: ServerConfig) {
        this.config = config;
        this.client = new Client();
    }

    public async connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            const connectConfig: ConnectConfig = {
                host: this.config.host,
                port: this.config.port || 22,
                username: this.config.username,
                password: this.config.password,
            };

            if (this.config.privateKey) {
                connectConfig.privateKey = this.config.privateKey;
            } else if (this.config.privateKeyPath) {
                try {
                    connectConfig.privateKey = fs.readFileSync(this.config.privateKeyPath);
                } catch (err) {
                    return reject(new Error(`Failed to read private key at ${this.config.privateKeyPath}: ${err}`));
                }
            }

            this.client.on('ready', () => {
                resolve();
            }).on('error', (err) => {
                reject(err);
            }).connect(connectConfig);
        });
    }

    public async exec(command: string): Promise<{ stdout: string; stderr: string; code: number }> {
        return new Promise((resolve, reject) => {
            this.client.exec(command, (err, stream) => {
                if (err) return reject(err);

                let stdout = '';
                let stderr = '';

                stream.on('close', (code: number, signal: any) => {
                    resolve({ stdout, stderr, code });
                }).on('data', (data: any) => {
                    stdout += data;
                }).stderr.on('data', (data: any) => {
                    stderr += data;
                });
            });
        });
    }

    public async execStream(command: string, onStdout?: (chunk: string) => void, onStderr?: (chunk: string) => void): Promise<number> {
        return new Promise((resolve, reject) => {
            this.client.exec(command, (err, stream) => {
                if (err) return reject(err);

                stream.on('close', (code: number) => {
                    resolve(code);
                });

                stream.on('data', (data: any) => {
                    if (onStdout) onStdout(data.toString());
                });

                stream.stderr.on('data', (data: any) => {
                    if (onStderr) onStderr(data.toString());
                });
            });
        });
    }

    public async uploadFile(localPath: string, remotePath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.client.sftp((err: any, sftp) => {
                if (err) return reject(err);
                sftp.fastPut(localPath, remotePath, (err: any) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        });
    }

    public async putBuffer(buffer: Buffer, remotePath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.client.sftp((err: any, sftp) => {
                if (err) return reject(err);
                const stream = sftp.createWriteStream(remotePath);
                stream.on('close', () => resolve());
                stream.on('error', (err: any) => reject(err));
                stream.end(buffer);
            });
        });
    }

    public end() {
        this.client.end();
    }
}
