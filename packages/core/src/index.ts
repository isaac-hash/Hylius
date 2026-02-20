export interface HyliusConfig {
    host: string;
    username: string;
    path: string;
}

export function deploy(config: HyliusConfig) {
    console.log(`Deploying to ${config.host}...`);
    // Core deploy logic will be moved here from the CLI
}
