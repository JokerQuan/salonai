import { existsSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { config } from 'dotenv';

const cwd = process.cwd();
const rootEnvPath = cwd.endsWith(`${sep}apps${sep}api`)
  ? resolve(cwd, '..', '..', '.env')
  : resolve(cwd, '.env');

export const ENV_FILE_PATHS = [rootEnvPath];

export function loadRootEnv(): string | undefined {
  const envPath = ENV_FILE_PATHS.find((candidate) => existsSync(candidate));

  if (!envPath) {
    return undefined;
  }

  config({ path: envPath, override: false });
  return envPath;
}
