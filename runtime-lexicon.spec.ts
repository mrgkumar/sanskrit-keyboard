import { expect, test } from '@playwright/test';

import {
  getLexicalSuggestions,
  normalizeForLexicalLookup,
  resetRuntimeLexiconCacheForTests,
  shouldLookupLexicalSuggestions,
} from './src/lib/vedic/runtimeLexicon';

const originalFetch = globalThis.fetch;

test.afterEach(() => {
  resetRuntimeLexiconCacheForTests();
  globalThis.fetch = originalFetch;
});

test.describe('runtime lexical lookup normalization', () => {
  test('strips svara-only markers but preserves canonical phonemic separators', () => {
    expect(normalizeForLexicalLookup("a'gni")).toBe('agni');
    expect(normalizeForLexicalLookup('ag"ni')).toBe('agni');
    expect(normalizeForLexicalLookup('ag^ni')).toBe('agni');
    expect(normalizeForLexicalLookup("ag\\'ni")).toBe('agni');
    expect(normalizeForLexicalLookup('ag\\_ni')).toBe('agni');
    expect(normalizeForLexicalLookup("ag''ni")).toBe('agni');
    expect(normalizeForLexicalLookup('a/i')).toBe('a/i');
    expect(normalizeForLexicalLookup('RRi')).toBe('RRi');
  });

  test('allows lexical lookup after stripping svara markers', () => {
    expect(shouldLookupLexicalSuggestions("a'g")).toBe(true);
    expect(shouldLookupLexicalSuggestions('a\\_g')).toBe(true);
    expect(shouldLookupLexicalSuggestions('a^g')).toBe(true);
    expect(shouldLookupLexicalSuggestions("a'")).toBe(false);
  });

  test('uses the normalized prefix when retrieving shard suggestions', async () => {
    const fetchCalls: string[] = [];
    const responses = new Map<string, unknown>([
      [
        '/api/autocomplete/runtime-lexicon-shards-manifest.json',
        {
          version: 1,
          shards: [
            {
              prefix: 'ag',
              file: 'runtime-lexicon-shards/0061-0067.json',
              entryCount: 2,
              bytes: 128,
            },
          ],
        },
      ],
      [
        '/api/autocomplete/runtime-lexicon-shards/0061-0067.json',
        {
          version: 1,
          prefix: 'ag',
          entries: [
            { itrans: 'agni', devanagari: 'अग्नि', count: 11 },
            { itrans: 'agnim', devanagari: 'अग्निम्', count: 7 },
          ],
        },
      ],
    ]);

    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      fetchCalls.push(url);
      const payload = responses.get(url);
      if (!payload) {
        return new Response('not found', { status: 404 });
      }

      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as typeof fetch;

    await expect(getLexicalSuggestions("a'g", 5)).resolves.toEqual([
      { itrans: 'agni', devanagari: 'अग्नि', count: 11 },
      { itrans: 'agnim', devanagari: 'अग्निम्', count: 7 },
    ]);

    expect(fetchCalls).toEqual([
      '/api/autocomplete/runtime-lexicon-shards-manifest.json',
      '/api/autocomplete/runtime-lexicon-shards/0061-0067.json',
    ]);
  });
});
