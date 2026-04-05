import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const now = new Date();

// Format: YYYYMMDD.HHMM
const buildId = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}.${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;

const content = `// This file is auto-generated during build
export const BUILD_VERSION = '${buildId}';
export const BUILD_TIME = '${now.toISOString()}';
`;

const targetPath = path.resolve(__dirname, '../src/lib/version.ts');
fs.writeFileSync(targetPath, content);
console.log(`Generated version: ${buildId} at ${targetPath}`);
