import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

export interface Config {
  project_name: string;
  type?: string;
}

export function loadConfig(): Config | null {
  try {
    const data = fs.readFileSync('anvil.yaml', 'utf8');
    return yaml.load(data) as Config;
  } catch (error) {
    return null;
  }
}

export function writeConfig(config: Config): void {
  const yamlStr = yaml.dump(config);
  fs.writeFileSync('anvil.yaml', yamlStr, 'utf8');
}

export function getProjectName(): string {
  return path.basename(process.cwd());
}
