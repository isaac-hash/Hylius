import * as fs from 'fs';

export function checkFileExists(filename: string): boolean {
  try {
    fs.statSync(filename);
    return true;
  } catch {
    return false;
  }
}

export function detectProjectType(): string {
  if (checkFileExists('composer.json')) {
    if (isLaravelApp()) {
      return 'laravel';
    }
    if (isLaravelPackage()) {
      return 'laravel-package';
    }
    return 'php';
  }

  if (checkFileExists('package.json')) {
    // Differentiate between JS frameworks based on build tools
    if (isNextApp()) {
      return 'next'; // Next.js (SSR, Port 3000)
    }
    if (isViteApp()) {
      return 'vite'; // React/Vue/Svelte + Vite (CSR, Port 5173)
    }
    return 'node'; // Generic Node.js (Express/Nest, Port 3000)
  }
  if (checkFileExists('requirements.txt') || checkFileExists('pyproject.toml')) {
    return 'python';
  }
  if (checkFileExists('go.mod')) {
    return 'go';
  }
  if (checkFileExists('pom.xml') || checkFileExists('build.gradle')) {
    return 'java';
  }
  return 'unknown';
}

function isNextApp(): boolean {
  return checkDependency('next');
}

function isViteApp(): boolean {
  return checkDependency('vite');
}

function isLaravelApp(): boolean {
  return checkFileExists('artisan');
}

function isLaravelPackage(): boolean {
  try {
    const data = fs.readFileSync('composer.json', 'utf8');
    const composer = JSON.parse(data);
    return !!(composer.extra && composer.extra.laravel);
  } catch {
    return false;
  }
}

function checkDependency(depName: string): boolean {
  try {
    const data = fs.readFileSync('package.json', 'utf8');
    const pkg = JSON.parse(data) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    if (pkg.dependencies) {
      for (const key in pkg.dependencies) {
        if (key.includes(depName)) {
          return true;
        }
      }
    }

    if (pkg.devDependencies) {
      for (const key in pkg.devDependencies) {
        if (key.includes(depName)) {
          return true;
        }
      }
    }

    return false;
  } catch {
    return false;
  }
}
