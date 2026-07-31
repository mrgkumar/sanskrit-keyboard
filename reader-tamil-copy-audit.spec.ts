import { execFile, execFileSync } from 'child_process';
import { expect, test } from '@playwright/test';
import { parseTexDocument } from '@/lib/veda-book/parseTex';
import {
  deriveDocumentTitleFromNodes,
  formatReaderNodeDisplayText,
  serializeReaderDocumentText,
} from '@/lib/veda-book/renderText';
import { DEFAULT_OUTPUT_TARGET_SETTINGS } from '@/lib/vedic/mapping';
import { normalizeTamilPrecisionDisplayText } from '@/lib/vedic/utils';
import type { MantraDocument } from '@/lib/veda-book/types';
import { promisify } from 'util';

const REPO = 'stotrasamhita/vedamantra-book';
const BRANCH = 'master';
const TREE_URL = `repos/${REPO}/git/trees/${BRANCH}?recursive=1`;
const execFileAsync = promisify(execFile);

interface RepoTexEntry {
  path: string;
  sha: string;
}

const loadTexEntries = (): RepoTexEntry[] => {
  const json = execFileSync('gh', ['api', TREE_URL], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  const tree = JSON.parse(json) as { tree?: Array<{ path?: string; sha?: string; type?: string }> };

  return (tree.tree ?? [])
    .filter((entry): entry is RepoTexEntry => Boolean(entry.path && entry.sha && entry.type === 'blob' && entry.path.endsWith('.tex')))
    .map((entry) => ({ path: entry.path, sha: entry.sha }));
};

const loadTexSource = (() => {
  const cache = new Map<string, Promise<string>>();

  return (sha: string) => {
    const cached = cache.get(sha);
    if (cached !== undefined) {
      return cached;
    }

    const promise = execFileAsync(
      'gh',
      ['api', `repos/${REPO}/git/blobs/${sha}`, '--jq', '.content'],
      {
        encoding: 'utf8',
        maxBuffer: 20 * 1024 * 1024,
      },
    ).then(({ stdout }) => Buffer.from(stdout.replace(/\s+/g, ''), 'base64').toString('utf8'));
    cache.set(sha, promise);
    return promise;
  };
})();

const loadTexSources = async (entries: RepoTexEntry[]) => {
  const chunks: RepoTexEntry[][] = [];
  const batchSize = 8;

  for (let index = 0; index < entries.length; index += batchSize) {
    chunks.push(entries.slice(index, index + batchSize));
  }

  for (const chunk of chunks) {
    await Promise.all(chunk.map((entry) => loadTexSource(entry.sha)));
  }
};

const buildTamilVisibleText = (document: MantraDocument) => {
  const lines: string[] = [];

  const appendBlock = (text: string, blankLineBefore = false) => {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }

    if (blankLineBefore && lines.length > 0 && lines[lines.length - 1] !== '') {
      lines.push('');
    }

    lines.push(trimmed);
  };

  const renderVisibleText = (text: string) =>
    normalizeTamilPrecisionDisplayText(
      formatReaderNodeDisplayText(text, 'tamil', DEFAULT_OUTPUT_TARGET_SETTINGS, {
        sanskritFontPreset: 'siddhanta',
      }),
    );

  appendBlock(renderVisibleText(document.title));

  for (const node of document.nodes) {
    switch (node.type) {
      case 'chapter':
      case 'section':
      case 'subsection':
      case 'paragraph':
      case 'center':
      case 'raw':
        appendBlock(renderVisibleText(node.text), true);
        break;
      case 'sourceRef':
        appendBlock(`${node.source}: ${renderVisibleText(node.values.join(' · '))}`, true);
        break;
      case 'warning':
        appendBlock(`Warning: ${node.message}`, true);
        break;
      case 'pageBreak':
        lines.push('');
        break;
      default:
        break;
    }
  }

  return lines.join('\n');
};

const buildCopiedText = (document: MantraDocument) =>
  serializeReaderDocumentText(document, 'tamil', DEFAULT_OUTPUT_TARGET_SETTINGS, {
    sanskritFontPreset: 'siddhanta',
  });

test('reader Tamil copy matches the rendered Tamil text for every upstream .tex source', async () => {
  const entries = loadTexEntries();
  await loadTexSources(entries);
  const mismatches: Array<{
    path: string;
    expected: string;
    actual: string;
  }> = [];

  for (const entry of entries) {
    const rawTex = await loadTexSource(entry.sha);
    const parsed = parseTexDocument(rawTex, { sourcePath: entry.path });
    const document: MantraDocument = {
      id: entry.path,
      title: deriveDocumentTitleFromNodes(parsed.nodes, entry.path),
      sourceRepo: REPO,
      sourceBranch: BRANCH,
      sourcePath: entry.path,
      rawTex,
      nodes: parsed.nodes,
      diagnostics: parsed.diagnostics,
      fetchedAt: '2026-07-31T00:00:00.000Z',
    };

    const expected = buildTamilVisibleText(document);
    const actual = buildCopiedText(document);

    if (expected !== actual) {
      mismatches.push({ path: entry.path, expected, actual });
    }
  }

  if (mismatches.length > 0) {
    const sample = mismatches.slice(0, 10).map((mismatch) => {
      const diffHeader = `FILE: ${mismatch.path}`;
      return [
        diffHeader,
        'EXPECTED:',
        mismatch.expected,
        'ACTUAL:',
        mismatch.actual,
      ].join('\n');
    }).join('\n\n---\n\n');

    throw new Error(`Tamil reader copy mismatches found in ${mismatches.length} file(s).\n\n${sample}`);
  }

  expect(mismatches).toHaveLength(0);
});
