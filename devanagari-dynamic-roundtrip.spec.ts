import { expect, test } from '@playwright/test';
import { createCorpusProducer } from './src/devanagari/producer.ts';
import type { BatchRequest, CorpusEntry } from './src/devanagari/types.ts';
import { detransliterate, transliterate } from './src/lib/vedic/utils.ts';

test.describe.configure({ mode: 'parallel' });

const BASE_REQUEST: BatchRequest = {
  length: 10,
  batchSize: 1000,
  templates: ['plain', 'virama', 'matra', 'ending'],
  includeVedic: false,
  includeExtendedConsonants: false,
  includeGeneralCombiningMarks: false,
  ordered: true,
  seed: 314159,
};

const createRequest = (overrides: Partial<BatchRequest> = {}): BatchRequest => ({
  ...BASE_REQUEST,
  ...overrides,
  templates: overrides.templates ?? BASE_REQUEST.templates,
});

const verifyEntry = (entry: CorpusEntry) => {
  const codePoints = Array.from(entry.text);
  expect(codePoints).toHaveLength(entry.codePointLength);
  expect(entry.codePointLength).toBe(10);
  expect(entry.codePointLength).toBe(codePoints.length);

  const roman = detransliterate(entry.text);
  const back = transliterate(roman).unicode;
  const normalized = transliterate(detransliterate(back)).unicode;

  expect(normalized).toBe(back);
  expect(back.normalize('NFC')).toBe(entry.text.normalize('NFC'));
};

const verifyBatchRange = async (startBatchIndex: number, endBatchIndex: number) => {
  const producer = createCorpusProducer({ workers: 1, ordered: true, seed: 314159 });

  for (let batchIndex = 0; batchIndex < startBatchIndex; batchIndex++) {
    await producer.getNextBatch(createRequest());
  }

  for (let batchIndex = startBatchIndex; batchIndex <= endBatchIndex; batchIndex++) {
    const batch = await producer.getNextBatch(createRequest());
    expect(batch.items).toHaveLength(1000);
    for (const entry of batch.items) {
      verifyEntry(entry);
    }
  }

  await producer.close();
};

test.describe('dynamic devanagari corpus pipeline', () => {
  test('slice 0 through 3 stays stable', async () => {
    await verifyBatchRange(0, 3);
  });

  test('slice 4 through 6 stays stable', async () => {
    await verifyBatchRange(4, 6);
  });

  test('slice 7 through 9 stays stable', async () => {
    await verifyBatchRange(7, 9);
  });

  test('ordered single-worker and 2-worker batches match for the first batch', async () => {
    const singleWorker = createCorpusProducer({ workers: 1, ordered: true, seed: 314159 });
    const multiWorker = createCorpusProducer({ workers: 2, ordered: true, seed: 314159 });

    const [singleBatch, multiBatch] = await Promise.all([
      singleWorker.getNextBatch(createRequest()),
      multiWorker.getNextBatch(createRequest()),
    ]);

    expect(singleBatch.items).toHaveLength(1000);
    expect(multiBatch.items).toHaveLength(1000);
    expect(singleBatch.items.map((entry) => entry.text)).toEqual(multiBatch.items.map((entry) => entry.text));
    expect(singleBatch.items.map((entry) => entry.id)).toEqual(multiBatch.items.map((entry) => entry.id));

    await singleWorker.close();
    await multiWorker.close();
  });
});
