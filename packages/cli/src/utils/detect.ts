import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export interface RailpackPlan {
  providers?: string[];
  buildPlanned?: boolean;
  error?: string;
  [key: string]: any;
}

/**
 * Executes 'railpack plan --json' to get detailed project information.
 */
export function getRailpackPlan(): RailpackPlan {
  try {
    const output = execSync('railpack plan --json', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    });
    return JSON.parse(output) as RailpackPlan;
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Detects project type using Railpack providers.
 * Maps Railpack providers to Hylius supported internal types.
 */
export function detectProjectType(): string {
  const plan = getRailpackPlan();

  if (plan.error || !plan.providers || plan.providers.length === 0) {
    // Fallback to basic manual checks if railpack fails or detects nothing
    return manualFallbackDetection();
  }

  // Map Railpack providers to Hylius types
  const providers = plan.providers.map(p => p.toLowerCase());

  if (providers.includes('nextjs')) return 'next';
  if (providers.includes('node')) {
    // Check for Vite specifically if possible, else generic node
    if (fs.existsSync(path.join(process.cwd(), 'vite.config.ts')) ||
      fs.existsSync(path.join(process.cwd(), 'vite.config.js'))) {
      return 'vite';
    }
    return 'node';
  }
  if (providers.includes('python')) {
    if (plan.variables?.RAILPACK_PYTHON_APP_MODULE?.includes('main:app')) return 'fastapi';
    return 'python';
  }
  if (providers.includes('php')) {
    if (fs.existsSync(path.join(process.cwd(), 'artisan'))) return 'laravel';
    return 'php';
  }
  if (providers.includes('go')) return 'go';
  if (providers.includes('java')) return 'java';

  return providers[0] || 'unknown';
}

function manualFallbackDetection(): string {
  if (fs.existsSync('package.json')) return 'node';
  if (fs.existsSync('requirements.txt') || fs.existsSync('pyproject.toml')) return 'python';
  if (fs.existsSync('composer.json')) return 'php';
  if (fs.existsSync('go.mod')) return 'go';
  return 'unknown';
}

export function checkFileExists(filename: string): boolean {
  try {
    fs.statSync(filename);
    return true;
  } catch {
    return false;
  }
}
