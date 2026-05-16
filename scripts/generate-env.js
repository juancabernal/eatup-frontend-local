const { mkdirSync, readFileSync, writeFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');

const root = process.cwd();
const envFiles = ['.env.development', '.env', '.env.production'];

function readEnvFile(filePath) {
  if (!existsSync(filePath)) return {};

  return readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .reduce((acc, line) => {
      const separatorIndex = line.indexOf('=');
      if (separatorIndex === -1) return acc;

      const key = line.slice(0, separatorIndex).trim();
      const rawValue = line.slice(separatorIndex + 1).trim();
      acc[key] = rawValue.replace(/^['"]|['"]$/g, '');
      return acc;
    }, {});
}

const fileEnv = envFiles.reduce(
  (acc, fileName) => ({
    ...acc,
    ...readEnvFile(join(root, fileName)),
  }),
  {},
);

const env = {
  apiUrl: process.env.API_URL || fileEnv.API_URL || 'http://localhost:8080/api/v1',
  userToken: process.env.USER_TOKEN || fileEnv.USER_TOKEN || '',
  locationId: process.env.LOCATION_ID || fileEnv.LOCATION_ID || '',
};

const configDir = join(root, 'src', 'app', 'core', 'config');
mkdirSync(configDir, { recursive: true });
writeFileSync(
  join(configDir, 'env.config.ts'),
  `export const ENV = ${JSON.stringify(env, null, 2)} as const;\n`,
);

console.log(`Generated env.config.ts with API_URL=${env.apiUrl}`);
