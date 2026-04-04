import { SSHClient } from './ssh/client.js';
import { ProjectConfig } from './types.js';

/**
 * Post-start configuration for Laravel containers behind a reverse proxy.
 * Injects $_SERVER['HTTPS']='on' directly into public/index.php,
 * updates .env APP_URL, and clears all caches.
 */
export async function configureLaravelContainer(
    client: SSHClient,
    containerName: string,
    project: ProjectConfig,
    log: (msg: string) => void,
): Promise<void> {
    log('Detected Laravel - configuring for reverse proxy HTTPS...');
    try {
        // Find the Laravel project root inside the container
        const { stdout: artisanPath } = await client.exec(
            `docker exec ${containerName} find / -maxdepth 3 -name artisan -type f 2>/dev/null | head -1`
        );
        const artisan = artisanPath.trim();
        if (!artisan) {
            log('Warning: Could not find artisan inside container, skipping Laravel config.');
            return;
        }
        const workdir = artisan.replace(/\/artisan$/, '');
        log(`Found Laravel project at ${workdir}`);

        const indexFile = `${workdir}/public/index.php`;

        // 1. Check if already injected
        const { code: alreadyInjected } = await client.exec(
            `docker exec ${containerName} grep -q HYLIUS_HTTPS ${indexFile}`
        );

        if (alreadyInjected !== 0) {
            // 2. Inject $_SERVER['HTTPS'] = 'on' as line 2 of public/index.php
            //    Uses a heredoc approach for reliable multi-layer escaping
            await client.exec(
                `docker exec ${containerName} sed -i '1a\\/* HYLIUS_HTTPS */ \\$_SERVER["HTTPS"] = "on"; \\$_SERVER["SERVER_PORT"] = 443;' ${indexFile}`
            );
            log('Injected HTTPS enforcement into public/index.php');
        } else {
            log('HTTPS enforcement already present in public/index.php');
        }

        // 3. Update .env APP_URL
        const appUrl = project.env?.APP_URL || '';
        if (appUrl) {
            const envFile = `${workdir}/.env`;
            await client.exec(
                `docker exec ${containerName} sed -i 's|^APP_URL=.*|APP_URL=${appUrl}|' ${envFile}`
            );
            log(`Updated .env APP_URL to ${appUrl}`);
        }

        // 4. Clear all Laravel caches
        await client.exec(
            `docker exec -w ${workdir} ${containerName} php artisan config:clear 2>/dev/null || true`
        );
        await client.exec(
            `docker exec -w ${workdir} ${containerName} php artisan route:clear 2>/dev/null || true`
        );
        await client.exec(
            `docker exec -w ${workdir} ${containerName} php artisan view:clear 2>/dev/null || true`
        );
        log('Laravel caches cleared. Reverse proxy configuration complete.');
    } catch (e: any) {
        log(`Warning: Could not configure Laravel for HTTPS: ${e.message}`);
    }
}
