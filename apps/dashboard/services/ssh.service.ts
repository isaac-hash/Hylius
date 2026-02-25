import { SSHClient, ServerConfig } from '@hylius/core';

export class SSHService {
    static async exec(server: ServerConfig, command: string) {
        const client = new SSHClient(server);
        try {
            await client.connect();
            const result = await client.exec(command);
            return result;
        } finally {
            client.end();
        }
    }

    static async execStream(
        server: ServerConfig,
        command: string,
        onStdout?: (chunk: string) => void,
        onStderr?: (chunk: string) => void
    ) {
        const client = new SSHClient(server);
        try {
            await client.connect();
            await client.execStream(command, onStdout, onStderr);
        } finally {
            client.end();
        }
    }
}
