import { getPulse, ServerConfig, PulseMetrics } from '@hylius/core';
import { agentGateway } from './agent-gateway.service';

export class MonitoringService {
    static async getSystemPulse(
        server: ServerConfig & { id: string; connectionMode?: string },
    ): Promise<PulseMetrics> {
        // Use agent if connected — avoids opening a new SSH connection for each poll
        if (server.connectionMode === 'AGENT' && agentGateway.isConnected(server.id)) {
            return getPulse(server, agentGateway.getAgentConfig(server.id));
        }
        return getPulse(server);
    }
}

