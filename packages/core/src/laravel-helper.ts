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
    isHttps: boolean,
    log: (msg: string) => void,
): Promise<boolean> {
    try {
        // Find the Laravel project root inside the container
        const { stdout: artisanPath } = await client.exec(
            `docker exec ${containerName} find / -maxdepth 5 -name artisan -type f 2>/dev/null | head -1`
        );
        const artisan = artisanPath.trim();
        if (!artisan) {
            return false; // Not a Laravel container
        }
        
        log('Detected Laravel container - configuring environment and running migrations...');
        const workdir = artisan.replace(/\/artisan$/, '');
        log(`Found Laravel project at ${workdir}`);

        const indexFile = `${workdir}/public/index.php`;

        // 1. Check if already injected
        const { code: alreadyInjected } = await client.exec(
            `docker exec ${containerName} grep -q HYLIUS_HTTPS ${indexFile}`
        );

        if (isHttps) {
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
        } else {
            if (alreadyInjected === 0) {
                // Remove the injected line if present
                await client.exec(
                    `docker exec ${containerName} sed -i '/HYLIUS_HTTPS/d' ${indexFile}`
                );
                log('Removed HTTPS enforcement from public/index.php to allow correct IP access');
            }
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

        // 4. Install required PDO database driver if missing
        const dbConnection = project.env?.DB_CONNECTION || '';
        const databaseUrl = project.env?.DATABASE_URL || '';
        const needsPgsql = dbConnection === 'pgsql' || databaseUrl.startsWith('postgresql');
        const needsMysql = dbConnection === 'mysql' || databaseUrl.startsWith('mysql');

        if (needsPgsql) {
            // Check if pdo_pgsql is already installed
            const { code: hasPgsql } = await client.exec(
                `docker exec ${containerName} php -m 2>/dev/null | grep -qi pdo_pgsql`
            );
            if (hasPgsql !== 0) {
                log('Installing pdo_pgsql extension (required for PostgreSQL)...');
                // Try install-php-extensions first (common in official PHP images), then fall back to apt
                await client.exec(
                    `docker exec ${containerName} sh -c "if command -v install-php-extensions >/dev/null 2>&1; then install-php-extensions pdo_pgsql; elif command -v docker-php-ext-install >/dev/null 2>&1; then apt-get update -qq && apt-get install -y -qq libpq-dev >/dev/null 2>&1; docker-php-ext-install pdo_pgsql; else apt-get update -qq && apt-get install -y -qq php-pgsql >/dev/null 2>&1; fi" 2>/dev/null || true`
                );
                log('pdo_pgsql extension installed.');
            }
        } else if (needsMysql) {
            const { code: hasMysql } = await client.exec(
                `docker exec ${containerName} php -m 2>/dev/null | grep -qi pdo_mysql`
            );
            if (hasMysql !== 0) {
                log('Installing pdo_mysql extension (required for MySQL)...');
                await client.exec(
                    `docker exec ${containerName} sh -c "if command -v install-php-extensions >/dev/null 2>&1; then install-php-extensions pdo_mysql; elif command -v docker-php-ext-install >/dev/null 2>&1; then docker-php-ext-install pdo_mysql; else apt-get update -qq && apt-get install -y -qq php-mysql >/dev/null 2>&1; fi" 2>/dev/null || true`
                );
                log('pdo_mysql extension installed.');
            }
        }

        // 5. Clear all Laravel caches
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
        return true;
    } catch (e: any) {
        log(`Warning: Could not configure Laravel for HTTPS: ${e.message}`);
        return false;
    }
}
