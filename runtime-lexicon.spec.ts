import { expect, test } from '@playwright/test';

import {
  applyLearnedSwaraVariants,
  getLexicalSuggestions,
  mergeLexicalSuggestionsWithSessionCounts,
  normalizeForLexicalLookup,
  resetRuntimeLexiconCacheForTests,
  shouldLookupLexicalSuggestions,
} from './src/lib/vedic/runtimeLexicon';
import { detransliterate } from './src/lib/vedic/utils';
import { loadCorpusSamples } from './test-support/transliterationCorpus';
import {
  accumulateSessionExactFormUsageFromText,
  accumulateSessionLexicalUsageFromText,
} from './src/store/useFlowStore';

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

  test('promotes session-used words above raw corpus ordering and includes session-only words', () => {
    const merged = mergeLexicalSuggestionsWithSessionCounts({
      prefix: 'sa',
      baseSuggestions: [
        { itrans: 'sarvaj~no', devanagari: 'सर्वज्ञो', count: 5 },
        { itrans: 'saagarasya', devanagari: 'सागरस्य', count: 4 },
      ],
      sessionUsageCounts: {
        saagarasya: 1,
        saccidaananda: 2,
      },
      userUsageCounts: {
        'sarvaj~no': 1,
      },
      limit: 5,
    });

    expect(merged.map((entry) => entry.itrans)).toEqual([
      'saccidaananda',
      'saagarasya',
      'sarvaj~no',
    ]);
    expect(merged[0].count).toBe(2);
    expect(merged[1]).toEqual({ itrans: 'saagarasya', devanagari: 'सागरस्य', count: 4, normalizedItrans: 'saagarasya' });
    expect(merged[2]).toEqual({ itrans: 'sarvaj~no', devanagari: 'सर्वज्ञो', count: 5, normalizedItrans: 'sarvaj~no' });
  });

  test('promotes a real corpus token from archive/example.txt after session reuse', () => {
    const simpleSamples = loadCorpusSamples()
      .filter((sample) => sample.difficulty === 'simple')
      .map((sample) => ({
        token: sample.token,
        itrans: normalizeForLexicalLookup(detransliterate(sample.token)),
      }))
      .filter((sample) => sample.itrans.length >= 3);

    let pair:
      | {
          first: { token: string; itrans: string };
          second: { token: string; itrans: string };
        }
      | undefined;

    for (let index = 0; index < simpleSamples.length; index += 1) {
      const first = simpleSamples[index];
      for (let candidateIndex = index + 1; candidateIndex < simpleSamples.length; candidateIndex += 1) {
        const second = simpleSamples[candidateIndex];
        if (
          first.itrans !== second.itrans &&
          first.itrans.slice(0, 2) === second.itrans.slice(0, 2)
        ) {
          pair = { first, second };
          break;
        }
      }

      if (pair) {
        break;
      }
    }

    expect(pair).toBeDefined();

    const baseSuggestions = [
      { itrans: pair!.first.itrans, devanagari: pair!.first.token, count: 5 },
      { itrans: pair!.second.itrans, devanagari: pair!.second.token, count: 4 },
    ];

    const merged = mergeLexicalSuggestionsWithSessionCounts({
      prefix: pair!.first.itrans.slice(0, 2),
      baseSuggestions,
      sessionUsageCounts: {
        [pair!.second.itrans]: 1,
      },
      limit: 5,
    });

    expect(merged[0]).toEqual({
      itrans: pair!.second.itrans,
      devanagari: pair!.second.token,
      count: 4,
      normalizedItrans: pair!.second.itrans,
    });
    expect(merged[1]).toEqual({
      itrans: pair!.first.itrans,
      devanagari: pair!.first.token,
      count: 5,
      normalizedItrans: pair!.first.itrans,
    });
  });

  test('extracts session lexical usage from a pasted Vedic line with svara markers', () => {
    const counts = accumulateSessionLexicalUsageFromText(
      {},
      "bhadraM karNebhiH shRuNuyaama devaaH | bhadraM pashyemaakShabhiryajatraaH |"
    );

    expect(counts.bhadraM).toBe(2);
    expect(counts.karNebhiH).toBe(1);
    expect(counts.shRuNuyaama).toBe(1);
    expect(counts.devaaH).toBe(1);
  });

  test('extracts exact swara-marked forms separately from normalized lexical counts', () => {
    const counts = accumulateSessionExactFormUsageFromText(
      {},
      "bha_draM karNe'bhiH shR^iNu_yaama' devaa: | bhadraM |"
    );

    expect(counts.bhadraM).toEqual({ bha_draM: 1 });
    expect(counts.karNebhiH).toEqual({ "karNe'bhiH": 1 });
    expect(counts.shRiNuyaama).toEqual({ "shR^iNu_yaama'": 1 });
    expect(counts.devaa).toBeUndefined();
  });

  test('applies learned swara variants from corpus and user overlays when enabled', async () => {
    const responses = new Map<string, unknown>([
      [
        '/api/autocomplete/swara-lexicon.json',
        {
          version: 1,
          entryCount: 1,
          entries: [
            {
              normalized: 'bhadraM',
              variants: [
                { itrans: 'bha_draM', devanagari: 'भ॒द्रं', count: 2 },
              ],
            },
          ],
        },
      ],
    ]);

    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const payload = responses.get(url);
      if (!payload) {
        return new Response('not found', { status: 404 });
      }

      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as typeof fetch;

    await expect(
      applyLearnedSwaraVariants({
        suggestions: [{ itrans: 'bhadraM', devanagari: 'भद्रं', count: 10, normalizedItrans: 'bhadraM' }],
        typedPrefix: 'bha',
        enabled: true,
        sessionExactForms: {},
        userExactForms: {},
      })
    ).resolves.toEqual([
      { itrans: 'bha_draM', devanagari: 'भ॒द्रं', count: 10, normalizedItrans: 'bhadraM' },
    ]);
  });

  test('prefers session-learned swara variants over corpus forms', async () => {
    const responses = new Map<string, unknown>([
      [
        '/api/autocomplete/swara-lexicon.json',
        {
          version: 1,
          entryCount: 1,
          entries: [
            {
              normalized: 'agni',
              variants: [
                { itrans: 'a_gni', devanagari: 'अ॒ग्नि', count: 2 },
              ],
            },
          ],
        },
      ],
    ]);

    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const payload = responses.get(url);
      if (!payload) {
        return new Response('not found', { status: 404 });
      }

      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as typeof fetch;

    const resolved = await applyLearnedSwaraVariants({
      suggestions: [{ itrans: 'agni', devanagari: 'अग्नि', count: 10, normalizedItrans: 'agni' }],
      typedPrefix: 'ag',
      enabled: true,
      sessionExactForms: {
        agni: {
          "a'gni": 1,
        },
      },
      userExactForms: {},
    });

    expect(resolved).toHaveLength(1);
    expect(resolved[0].itrans).toBe("a'gni");
    expect(resolved[0].normalizedItrans).toBe('agni');
    expect(resolved[0].count).toBe(10);
  });
});
