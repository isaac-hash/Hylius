import { getPulse, ServerConfig, PulseMetrics } from '@hylius/core';

export class MonitoringService {
    static async getSystemPulse(server: ServerConfig): Promise<PulseMetrics> {
        return getPulse(server);
    }
}
