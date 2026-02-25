import { ServerConfig, PulseMetrics } from './types.js';
import { SSHClient } from './ssh/client.js';

export async function getPulse(server: ServerConfig): Promise<PulseMetrics> {
    const client = new SSHClient(server);

    try {
        await client.connect();

        // Single command execution to gather all metrics in JSON format
        const cmd = `echo "{ 
      \\"cpu\\": $(grep 'cpu ' /proc/stat | awk '{usage=($2+$4)*100/($2+$4+$5)} END {print usage}'),
      \\"memory\\": $(free | grep Mem | awk '{print int($3/$2 * 100)}'),
      \\"disk\\": $(df -h / | tail -1 | awk '{print $5}' | sed 's/%//'),
      \\"uptime\\": $(awk '{print int($1)}' /proc/uptime)
    }"`;

        const { stdout } = await client.exec(cmd);

        try {
            const metrics = JSON.parse(stdout);
            // Normalize
            return {
                cpu: parseFloat(metrics.cpu) || 0,
                memory: parseFloat(metrics.memory) || 0,
                disk: parseFloat(metrics.disk) || 0,
                uptime: parseFloat(metrics.uptime) || 0
            };
        } catch (parseErr) {
            throw new Error(`Failed to parse Pulse metrics: ${parseErr}, raw: ${stdout}`);
        }

    } catch (err: any) {
        throw new Error(`Pulse check failed: ${err.message}`);
    } finally {
        client.end();
    }
}
