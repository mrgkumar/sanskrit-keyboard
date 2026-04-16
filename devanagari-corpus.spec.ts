import { expect, test } from '@playwright/test';
import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { classifyInventory, writeInventoryArtifacts } from './src/devanagari/classify.ts';
import { SOURCE_INVENTORY } from './src/devanagari/sourceInventory.ts';
import { buildCuratedInventories } from './src/devanagari/curatedInventories.ts';
import { validateOrthography } from './src/devanagari/validator.ts';
import { buildPartitions } from './src/devanagari/partition.ts';
import { BoundedAsyncQueue } from './src/devanagari/queue.ts';
import { createCorpusProducer } from './src/devanagari/producer.ts';
import type { BatchRequest, TemplateFamily } from './src/devanagari/types.ts';

const BASE_REQUEST: BatchRequest = {
  length: 5,
  batchSize: 10,
  templates: ['plain', 'virama'] as TemplateFamily[],
  includeVedic: false,
  includeExtendedConsonants: false,
  includeGeneralCombiningMarks: false,
  ordered: true,
  seed: 7,
};

const makeRequest = (overrides: Partial<BatchRequest> = {}): BatchRequest => ({
  ...BASE_REQUEST,
  ...overrides,
  templates: overrides.templates ?? BASE_REQUEST.templates,
});

const c = (...codePoints: number[]) => String.fromCodePoint(...codePoints);

test.describe('devenagari corpus generator', () => {
  test('classifies the supplied inventory and keeps required consonants visible', () => {
    const report = classifyInventory();

    for (const consonant of SOURCE_INVENTORY.baseConsonants) {
      expect(report.includedConsonants).toContain(consonant);
    }

    for (const consonant of SOURCE_INVENTORY.extendedConsonants) {
      expect(report.classification.some((entry) => entry.char === consonant)).toBeTruthy();
    }

    for (const vowel of SOURCE_INVENTORY.independentVowels) {
      expect(report.classification.some((entry) => entry.char === vowel)).toBeTruthy();
    }

    expect(report.classification.find((entry) => entry.char === 'क़')?.category).toBe('extendedConsonant');
    expect(report.classification.find((entry) => entry.char === '॑')?.category).toBe('vedicSign');
    expect(report.classification.find((entry) => entry.char === '।')?.category).toBe('punctuation');
    expect(report.classification.find((entry) => entry.char === 'ऽ')?.category).toBe('symbol');
    expect(report.classification.find((entry) => entry.char === '\ue001')?.category).toBe('privateUseOrFontSpecific');
  });

  test('writes deterministic inventory artifacts', () => {
    const outDir = mkdtempSync(join(tmpdir(), 'devanagari-inventory-'));
    const report = writeInventoryArtifacts(join(outDir, 'inventory'));

    expect(existsSync(join(outDir, 'inventory', 'classification.json'))).toBeTruthy();
    expect(existsSync(join(outDir, 'inventory', 'audit.json'))).toBeTruthy();

    const classification = JSON.parse(readFileSync(join(outDir, 'inventory', 'classification.json'), 'utf8')) as typeof report;
    expect(classification.includedConsonants).toEqual(report.includedConsonants);
  });

  test('builds curated inventories without punctuation, symbols, or private-use glyphs by default', () => {
    const report = classifyInventory();
    const curated = buildCuratedInventories(report, {});

    expect(curated.consonants).toContain('क');
    expect(curated.consonants).not.toContain('क़');
    expect(curated.vedicSigns).toHaveLength(0);
    expect(curated.combiningMarks).toHaveLength(0);
    expect(curated.binduSigns).toEqual(expect.arrayContaining(['ँ', 'ं', 'ः', 'ऀ']));
  });

  test('enforces virama, matra, and nukta host rules', () => {
    const report = classifyInventory();
    const curated = buildCuratedInventories(report, { includeExtendedConsonants: true });

    expect(
      validateOrthography(c(0x0915, 0x094d, 0x0915, 0x0902, 0x0903), {
        request: makeRequest(),
        inventories: curated,
      }).valid
    ).toBeTruthy();

    expect(
      validateOrthography(c(0x094d, 0x0915, 0x0902, 0x0903, 0x0901), {
        request: makeRequest(),
        inventories: curated,
      }).valid
    ).toBeFalsy();

    expect(
      validateOrthography(c(0x0915, 0x093e, 0x0902, 0x0903, 0x0901), {
        request: makeRequest(),
        inventories: curated,
      }).valid
    ).toBeTruthy();

    expect(
      validateOrthography(c(0x093e, 0x0915, 0x0902, 0x0903, 0x0901), {
        request: makeRequest(),
        inventories: curated,
      }).valid
    ).toBeFalsy();

    expect(
      validateOrthography(c(0x0915, 0x093c, 0x0902, 0x0903, 0x0901), {
        request: makeRequest(),
        inventories: curated,
      }).valid
    ).toBeTruthy();

    expect(
      validateOrthography(c(0x093c, 0x0915, 0x0902, 0x0903, 0x0901), {
        request: makeRequest(),
        inventories: curated,
      }).valid
    ).toBeFalsy();
  });

  test('produces exact code-point length entries', async () => {
    const producer = createCorpusProducer({ workers: 1, ordered: true, seed: 7 });
    const batch = await producer.getNextBatch(makeRequest());
    await producer.close();

    expect(batch.items).toHaveLength(10);
    expect(batch.items.every((item) => item.codePointLength === 5)).toBeTruthy();
  });

  test('returns deterministic entry IDs for the same config and seed', async () => {
    const firstProducer = createCorpusProducer({ workers: 1, ordered: true, seed: 7 });
    const secondProducer = createCorpusProducer({ workers: 1, ordered: true, seed: 7 });

    const firstBatch = await firstProducer.getNextBatch(makeRequest());
    const secondBatch = await secondProducer.getNextBatch(makeRequest());

    await firstProducer.close();
    await secondProducer.close();

    expect(firstBatch.items.map((item) => item.id)).toEqual(secondBatch.items.map((item) => item.id));
  });

  test('builds deterministic partitions', () => {
    const report = classifyInventory();
    const curated = buildCuratedInventories(report, {});
    const partitionsA = buildPartitions(
      {
        length: 5,
        batchSize: 10,
        templates: ['plain', 'virama'],
        includeVedic: false,
        includeExtendedConsonants: false,
        includeGeneralCombiningMarks: false,
        ordered: true,
        seed: 7,
      },
      curated
    );
    const partitionsB = buildPartitions(
      {
        length: 5,
        batchSize: 10,
        templates: ['plain', 'virama'],
        includeVedic: false,
        includeExtendedConsonants: false,
        includeGeneralCombiningMarks: false,
        ordered: true,
        seed: 7,
      },
      curated
    );

    expect(partitionsA.map((partition) => partition.id)).toEqual(partitionsB.map((partition) => partition.id));
  });

  test('supports bounded queue backpressure', async () => {
    const queue = new BoundedAsyncQueue<number>(1);
    await queue.push(1);

    let resolved = false;
    const secondPush = queue.push(2).then(() => {
      resolved = true;
    });

    await Promise.resolve();
    expect(resolved).toBeFalsy();

    expect(await queue.shift()).toBe(1);
    await secondPush;
    expect(resolved).toBeTruthy();
    expect(await queue.shift()).toBe(2);
  });

  test('getNextBatch and async iteration return matching data', async () => {
    const producer = createCorpusProducer({ workers: 1, ordered: true, seed: 7 });
    const batch = await producer.getNextBatch(makeRequest({ batchSize: 5 }));
    await producer.close();

    const iteratorProducer = createCorpusProducer({ workers: 1, ordered: true, seed: 7 });
    const entryTexts: string[] = [];
    for await (const entry of iteratorProducer.iterateEntries(makeRequest({ batchSize: 5 }))) {
      entryTexts.push(entry.text);
      if (entryTexts.length >= batch.items.length) {
        break;
      }
    }
    await iteratorProducer.close();

    expect(entryTexts).toEqual(batch.items.map((item) => item.text));
  });

  test('ordered single-thread and multi-thread modes produce identical logical output', async () => {
    const single = createCorpusProducer({ workers: 1, ordered: true, seed: 7 });
    const multi = createCorpusProducer({ workers: 2, ordered: true, seed: 7 });

    const singleBatches = [await single.getNextBatch(makeRequest()), await single.getNextBatch(makeRequest())];
    const multiBatches = [await multi.getNextBatch(makeRequest()), await multi.getNextBatch(makeRequest())];

    await single.close();
    await multi.close();

    expect(singleBatches.map((batch) => batch.items.map((item) => item.text))).toEqual(
      multiBatches.map((batch) => batch.items.map((item) => item.text))
    );
  });

  test('record and replay emit equivalent batches', async () => {
    const recordDir = mkdtempSync(join(tmpdir(), 'devanagari-record-'));
    const replayDir = recordDir;

    const recorder = createCorpusProducer({
      mode: 'record',
      workers: 1,
      ordered: true,
      seed: 7,
      recordDir,
    });
    const recorded = [await recorder.getNextBatch(makeRequest()), await recorder.getNextBatch(makeRequest())];
    await recorder.close();

    const replayProducer = createCorpusProducer({
      mode: 'replay',
      workers: 1,
      ordered: true,
      seed: 7,
      replayDir,
    });
    const replayed = [await replayProducer.getNextBatch(makeRequest()), await replayProducer.getNextBatch(makeRequest())];
    await replayProducer.close();

    expect(replayed.map((batch) => batch.items.map((item) => item.text))).toEqual(
      recorded.map((batch) => batch.items.map((item) => item.text))
    );
  });
});
