import fs from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { getAutocompleteDataRoot } from '@/lib/server/autocompleteDataRoot';

const AUTOCOMPLETE_ROOT = getAutocompleteDataRoot();

const isAllowedAsset = (assetPath: string) =>
  assetPath === 'runtime-lexicon-shards-manifest.json' ||
  assetPath === 'runtime-lexicon-summary.json' ||
  assetPath === 'runtime-lexicon.json' ||
  assetPath === 'swara-lexicon.json' ||
  (assetPath.startsWith('runtime-lexicon-shards/') && assetPath.endsWith('.json'));

export async function GET(
  _request: Request,
  context: { params: Promise<{ asset?: string[] }> }
) {
  const { asset = [] } = await context.params;
  if (asset.length === 0) {
    return NextResponse.json({ error: 'Missing autocomplete asset path' }, { status: 404 });
  }

  if (asset.some((segment) => segment.includes('..'))) {
    return NextResponse.json({ error: 'Invalid autocomplete asset path' }, { status: 400 });
  }

  const relativeAssetPath = asset.join('/');
  if (!isAllowedAsset(relativeAssetPath)) {
    return NextResponse.json({ error: 'Unsupported autocomplete asset' }, { status: 404 });
  }

  const absoluteAssetPath = path.resolve(AUTOCOMPLETE_ROOT, relativeAssetPath);
  if (!absoluteAssetPath.startsWith(AUTOCOMPLETE_ROOT)) {
    return NextResponse.json({ error: 'Invalid autocomplete asset path' }, { status: 400 });
  }

  try {
    const contents = await fs.readFile(absoluteAssetPath, 'utf8');
    return new NextResponse(contents, {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'public, max-age=3600',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Autocomplete asset not found' }, { status: 404 });
  }
}
