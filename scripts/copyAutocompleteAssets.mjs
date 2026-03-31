import fs from 'node:fs/promises';
import path from 'node:path';

const sourceRoot = path.resolve(process.cwd(), '..', 'generated', 'autocomplete');
const destinationRoot = path.resolve(process.cwd(), 'public', 'autocomplete');
const runtimeFiles = [
  'runtime-lexicon-shards-manifest.json',
  'swara-lexicon.json',
];

const copyRuntimeAssets = async () => {
  await fs.rm(destinationRoot, { recursive: true, force: true });
  await fs.mkdir(path.join(destinationRoot, 'runtime-lexicon-shards'), { recursive: true });

  for (const file of runtimeFiles) {
    await fs.copyFile(path.join(sourceRoot, file), path.join(destinationRoot, file));
  }

  const shardSourceRoot = path.join(sourceRoot, 'runtime-lexicon-shards');
  const shardDestinationRoot = path.join(destinationRoot, 'runtime-lexicon-shards');
  const shardFiles = await fs.readdir(shardSourceRoot, { withFileTypes: true });

  for (const shardFile of shardFiles) {
    if (!shardFile.isFile() || !shardFile.name.endsWith('.json')) {
      continue;
    }

    await fs.copyFile(
      path.join(shardSourceRoot, shardFile.name),
      path.join(shardDestinationRoot, shardFile.name)
    );
  }
};

try {
  await copyRuntimeAssets();
  console.log(`Copied runtime autocomplete assets to ${destinationRoot}`);
} catch (error) {
  console.error('Failed to copy autocomplete assets for static export.');
  throw error;
}
