import fs from 'node:fs/promises';
import path from 'node:path';

const sourceRoot = path.resolve(process.cwd(), '..', 'generated', 'autocomplete');
const destinationRoot = path.resolve(process.cwd(), 'public', 'autocomplete');

const copyDirectory = async (sourceDir, destinationDir) => {
  await fs.mkdir(destinationDir, { recursive: true });
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const destinationPath = path.join(destinationDir, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, destinationPath);
      continue;
    }

    await fs.copyFile(sourcePath, destinationPath);
  }
};

try {
  await copyDirectory(sourceRoot, destinationRoot);
  console.log(`Copied autocomplete assets to ${destinationRoot}`);
} catch (error) {
  console.error('Failed to copy autocomplete assets for static export.');
  throw error;
}
