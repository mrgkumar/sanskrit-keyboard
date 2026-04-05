import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const versionFilePath = path.resolve(__dirname, '../src/lib/version.ts');

try {
  const content = fs.readFileSync(versionFilePath, 'utf8');
  const versionMatch = content.match(/BUILD_VERSION = '([^']+)'/);
  
  if (!versionMatch) {
    console.error('Could not find BUILD_VERSION in src/lib/version.ts');
    process.exit(1);
  }

  const version = versionMatch[1];
  const tagName = `v${version}`;

  console.log(`Applying git tag: ${tagName}`);
  
  // Create the tag
  execSync(`git tag -a ${tagName} -m "Release ${version}"`, { stdio: 'inherit' });
  
  // Push the tag
  console.log(`Pushing tag ${tagName} to origin...`);
  execSync(`git push origin ${tagName}`, { stdio: 'inherit' });

  console.log(`Successfully tagged and pushed ${tagName}`);
} catch (error) {
  console.error('Error during tagging:', error.message);
  // We don't want to fail the whole build if tagging fails (e.g. tag already exists)
  // but we should report it.
}
