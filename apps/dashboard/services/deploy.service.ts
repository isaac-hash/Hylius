import { deploy as coreDeploy, DeployOptions, DeployResult } from '@hylius/core';

export class DeployService {
    static async deployProject(options: DeployOptions): Promise<DeployResult> {
        return coreDeploy(options);
    }
}
