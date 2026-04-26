import { expect, test } from '@playwright/test';
import { transliterate } from './src/lib/vedic/utils';
import {
  readStoredSessionSnapshot,
  useFlowStore,
} from './src/store/useFlowStore';
import { createSessionId } from './src/store/flowStoreSessions';

type MockLocalStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  clear: () => void;
  key: (index: number) => string | null;
  readonly length: number;
};

const createLocalStorageMock = (): MockLocalStorage => {
  const data = new Map<string, string>();

  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, String(value));
    },
    removeItem: (key) => {
      data.delete(key);
    },
    clear: () => {
      data.clear();
    },
    key: (index) => Array.from(data.keys())[index] ?? null,
    get length() {
      return data.size;
    },
  };
};

const installDomMocks = () => {
  const localStorage = createLocalStorageMock();
  const mockWindow = { localStorage } as unknown as Window & typeof globalThis;
  const mockDocument = {
    querySelector: () => null,
  } as unknown as Document;

  (globalThis as typeof globalThis & { window?: Window; document?: Document }).window = mockWindow;
  (globalThis as typeof globalThis & { window?: Window; document?: Document }).document = mockDocument;

  return localStorage;
};

const baseSnapshot = JSON.parse(JSON.stringify(useFlowStore.getState().exportSessionSnapshot()));

const resetStore = () => {
  installDomMocks();
  useFlowStore.getState().loadSessionSnapshot(JSON.parse(JSON.stringify(baseSnapshot)));
  window.localStorage.clear();
};

const makeShortBlock = (id: string, source: string) => ({
  id,
  type: 'short' as const,
  title: 'Test Block',
  source,
  rendered: transliterate(source).unicode,
});

const waitForQueuedTimers = async () => {
  await new Promise((resolve) => setTimeout(resolve, 80));
};

test.beforeEach(() => {
  resetStore();
});

test.afterEach(() => {
  resetStore();
});

test.describe('store block operations', () => {
  test('addBlocks replaces the blank session block and activates the first pasted block', () => {
    const store = useFlowStore.getState();

    store.resetSession();
    store.addBlocks(['om namah', 'harih om']);

    const nextState = useFlowStore.getState();
    expect(nextState.blocks).toHaveLength(2);
    expect(nextState.blocks[0].title).toBe('Pasted Block 1');
    expect(nextState.editorState.activeBlockId).toBe(nextState.blocks[0].id);
    expect(nextState.blocks[0].rendered).toBe(transliterate('om namah').unicode);
  });

  test('splitBlock splits the active block into two blocks at the requested offset', async () => {
    const store = useFlowStore.getState();
    useFlowStore.setState({
      blocks: [makeShortBlock('block-a', 'abcdefghij')],
      editorState: {
        ...store.editorState,
        activeBlockId: 'block-a',
        activeAnchorSegmentIndex: 0,
      },
    });

    store.splitBlock('block-a', 4);
    await waitForQueuedTimers();

    const nextState = useFlowStore.getState();
    expect(nextState.blocks).toHaveLength(2);
    expect(nextState.blocks.map((block) => block.source)).toEqual(['abcd', 'efghij']);
    expect(nextState.editorState.activeBlockId).toBe(nextState.blocks[1].id);
  });

  test('mergeBlocks joins neighboring blocks and keeps the merged block active', async () => {
    const store = useFlowStore.getState();
    useFlowStore.setState({
      blocks: [makeShortBlock('block-a', 'abc'), makeShortBlock('block-b', 'def')],
      editorState: {
        ...store.editorState,
        activeBlockId: 'block-a',
        activeAnchorSegmentIndex: 0,
      },
    });

    store.mergeBlocks('block-a', 'next');
    await waitForQueuedTimers();

    const nextState = useFlowStore.getState();
    expect(nextState.blocks).toHaveLength(1);
    expect(nextState.blocks[0].source).toBe('abcdef');
    expect(nextState.editorState.activeBlockId).toBe(nextState.blocks[0].id);
  });

  test('deleteBlock removes the requested block and stores a restore snapshot', () => {
    const store = useFlowStore.getState();
    useFlowStore.setState({
      blocks: [makeShortBlock('block-a', 'abc'), makeShortBlock('block-b', 'def')],
      editorState: {
        ...store.editorState,
        activeBlockId: 'block-a',
        activeAnchorSegmentIndex: 0,
      },
    });

    store.deleteBlock('block-a');

    const nextState = useFlowStore.getState();
    expect(nextState.blocks).toHaveLength(1);
    expect(nextState.blocks[0].id).toBe('block-b');
    expect(nextState.editorState.activeBlockId).toBe('block-b');
    expect(nextState.recentlyDeletedBlock?.block.id).toBe('block-a');
  });

  test('restoreDeletedBlock puts the removed block back in its original position', () => {
    const store = useFlowStore.getState();
    useFlowStore.setState({
      blocks: [makeShortBlock('block-a', 'abc'), makeShortBlock('block-b', 'def')],
      editorState: {
        ...store.editorState,
        activeBlockId: 'block-a',
        activeAnchorSegmentIndex: 0,
      },
    });

    store.deleteBlock('block-a');
    store.restoreDeletedBlock();

    const nextState = useFlowStore.getState();
    expect(nextState.blocks.map((block) => block.id)).toEqual(['block-a', 'block-b']);
    expect(nextState.editorState.activeBlockId).toBe('block-a');
    expect(nextState.recentlyDeletedBlock).toBeNull();
  });
});

test.describe('store session orchestration', () => {
  test('markSessionSaved persists the snapshot and updates the session index', () => {
    const store = useFlowStore.getState();
    store.addBlocks(['om namah']);
    const sessionId = store.sessionId;

    store.markSessionSaved('2024-01-01T00:00:00.000Z');

    const snapshot = readStoredSessionSnapshot(sessionId);
    const index = JSON.parse(window.localStorage.getItem('sanskrit-keyboard.session-index.v2') ?? '[]') as Array<{
      sessionId: string;
      sessionName: string;
      updatedAt: string;
    }>;

    expect(snapshot?.sessionId).toBe(sessionId);
    expect(snapshot?.updatedAt).toBe('2024-01-01T00:00:00.000Z');
    expect(index).toHaveLength(1);
    expect(index[0].sessionId).toBe(sessionId);
  });

  test('renameSession updates the live store, index, and durable snapshot', () => {
    const store = useFlowStore.getState();
    store.addBlocks(['om namah']);
    const sessionId = store.sessionId;
    store.markSessionSaved('2024-01-01T00:00:00.000Z');

    store.renameSession(sessionId, 'Renamed Session');

    const snapshot = readStoredSessionSnapshot(sessionId);
    const index = JSON.parse(window.localStorage.getItem('sanskrit-keyboard.session-index.v2') ?? '[]') as Array<{
      sessionId: string;
      sessionName: string;
      updatedAt: string;
    }>;

    expect(useFlowStore.getState().sessionName).toBe('Renamed Session');
    expect(snapshot?.sessionName).toBe('Renamed Session');
    expect(index[0].sessionName).toBe('Renamed Session');
  });

  test('deleteSession removes the session from storage and resets the current session', () => {
    const store = useFlowStore.getState();
    store.addBlocks(['om namah']);
    const sessionId = store.sessionId;
    store.markSessionSaved('2024-01-01T00:00:00.000Z');

    store.deleteSession(sessionId);

    const nextState = useFlowStore.getState();
    const index = JSON.parse(window.localStorage.getItem('sanskrit-keyboard.session-index.v2') ?? '[]') as Array<{
      sessionId: string;
      sessionName: string;
      updatedAt: string;
    }>;

    expect(readStoredSessionSnapshot(sessionId)).toBeNull();
    expect(index.some((item) => item.sessionId === sessionId)).toBe(false);
    expect(nextState.sessionId).not.toBe(sessionId);
    expect(nextState.blocks).toHaveLength(1);
    expect(nextState.blocks[0].source).toBe('');
  });

  test('resetSession clears the runtime document and creates a fresh session id', () => {
    const store = useFlowStore.getState();
    store.addBlocks(['om namah']);
    const previousSessionId = store.sessionId;

    store.resetSession();

    const nextState = useFlowStore.getState();
    expect(nextState.sessionId).not.toBe(previousSessionId);
    expect(nextState.blocks).toHaveLength(1);
    expect(nextState.blocks[0].source).toBe('');
    expect(nextState.sessionName).not.toBe('');
  });

  test('loadSessionSnapshot restores a saved session snapshot', () => {
    const store = useFlowStore.getState();
    store.addBlocks(['om namah']);
    store.setSessionName('Reference Session');
    const snapshot = store.exportSessionSnapshot();

    store.resetSession();
    store.loadSessionSnapshot(snapshot);

    const nextState = useFlowStore.getState();
    expect(nextState.sessionId).toBe(snapshot.sessionId);
    expect(nextState.sessionName).toBe('Reference Session');
    expect(nextState.blocks.map((block) => block.source)).toEqual(snapshot.blocks.map((block) => block.source));
  });

  test('session annotations persist and clear when their source block is edited', () => {
    const store = useFlowStore.getState();
    useFlowStore.setState({
      blocks: [makeShortBlock('block-a', 'agnim ile')],
      editorState: {
        ...store.editorState,
        activeBlockId: 'block-a',
        activeAnchorSegmentIndex: 0,
      },
    });

    store.upsertAnnotation({
      blockId: 'block-a',
      startOffset: 0,
      endOffset: 5,
      sourceText: 'agnim',
      kind: 'highlight',
      color: 'yellow',
    });
    store.upsertAnnotation({
      blockId: 'block-a',
      startOffset: 6,
      endOffset: 9,
      sourceText: 'ile',
      kind: 'bookmark',
    });

    const snapshot = useFlowStore.getState().exportSessionSnapshot();
    expect(snapshot.annotations).toHaveLength(2);

    store.resetSession();
    store.loadSessionSnapshot(snapshot);
    expect(useFlowStore.getState().annotations.map((annotation) => annotation.sourceText)).toEqual(['agnim', 'ile']);

    useFlowStore.getState().updateChunkSource('agnim ile purohitam', 20, 20);

    const nextState = useFlowStore.getState();
    expect(nextState.annotations).toEqual([]);
    expect(nextState.annotationEditWarning?.clearedCount).toBe(2);
  });

  test('youtube annotations persist in snapshots and keep only one link per block', () => {
    const store = useFlowStore.getState();
    useFlowStore.setState({
      blocks: [makeShortBlock('block-a', 'om namah')],
      editorState: {
        ...store.editorState,
        activeBlockId: 'block-a',
        activeAnchorSegmentIndex: 0,
      },
    });

    store.upsertAnnotation({
      blockId: 'block-a',
      startOffset: 0,
      endOffset: 8,
      sourceText: 'om namah',
      kind: 'youtube',
      url: 'https://youtu.be/first',
    });
    store.upsertAnnotation({
      blockId: 'block-a',
      startOffset: 0,
      endOffset: 8,
      sourceText: 'om namah',
      kind: 'youtube',
      url: 'https://youtu.be/second',
    });

    const nextState = useFlowStore.getState();
    const youtubeAnnotations = nextState.annotations.filter((annotation) => annotation.kind === 'youtube');
    expect(youtubeAnnotations).toHaveLength(1);
    expect(youtubeAnnotations[0].url).toBe('https://youtu.be/second');

    const snapshot = nextState.exportSessionSnapshot();
    expect(snapshot.annotations?.filter((annotation) => annotation.kind === 'youtube')).toHaveLength(1);
    expect(snapshot.annotations?.find((annotation) => annotation.kind === 'youtube')?.url).toBe('https://youtu.be/second');
  });

  test('restoreSessionAsync loads a stored session snapshot without leaving restore state behind', async () => {
    const store = useFlowStore.getState();
    const sessionId = createSessionId();
    const snapshot = {
      ...JSON.parse(JSON.stringify(baseSnapshot)),
      sessionId,
      sessionName: 'Async Restore Session',
      updatedAt: '2024-01-02T00:00:00.000Z',
      blocks: [
        makeShortBlock('block-restore-1', 'om namah'),
        makeShortBlock('block-restore-2', 'harih om'),
      ],
      editorState: {
        ...JSON.parse(JSON.stringify(baseSnapshot.editorState)),
        activeBlockId: 'block-restore-1',
      },
    };

    window.localStorage.setItem(`sanskrit-keyboard.session.v2.${sessionId}`, JSON.stringify(snapshot));

    await store.restoreSessionAsync(sessionId);

    const nextState = useFlowStore.getState();
    expect(nextState.sessionId).toBe(sessionId);
    expect(nextState.sessionName).toBe('Async Restore Session');
    expect(nextState.blocks.map((block) => block.source)).toEqual(['om namah', 'harih om']);
    expect(nextState.largeDocumentOperation).toBeNull();
  });

  test('loadSessionSnapshot can defer derived usage for large sessions', async () => {
    const store = useFlowStore.getState();
    const largeBlocks = Array.from({ length: 101 }, (_, index) =>
      makeShortBlock(`block-large-${index}`, `om namah ${index}`)
    );
    const snapshot = {
      ...JSON.parse(JSON.stringify(baseSnapshot)),
      sessionId: createSessionId(),
      sessionName: 'Large Session',
      updatedAt: '2024-01-03T00:00:00.000Z',
      blocks: largeBlocks,
      editorState: {
        ...JSON.parse(JSON.stringify(baseSnapshot.editorState)),
        activeBlockId: largeBlocks[0].id,
      },
    };

    store.loadSessionSnapshot(snapshot, { deferDerivedUsage: true });

    expect(useFlowStore.getState().sessionLexicalUsage).toEqual({});
    await waitForQueuedTimers();
    expect(Object.keys(useFlowStore.getState().sessionLexicalUsage).length).toBeGreaterThan(0);
  });
});

test.describe('store segmentation policy', () => {
  test('updateChunkSource promotes long content into a segmented block', () => {
    const longSource = Array.from({ length: 20 }, (_, index) => `word${index}word${index}word${index}`).join(' ');
    const store = useFlowStore.getState();

    useFlowStore.setState({
      blocks: [makeShortBlock('block-a', 'seed')],
      editorState: {
        ...store.editorState,
        activeBlockId: 'block-a',
        activeAnchorSegmentIndex: 0,
      },
    });

    store.updateChunkSource(longSource, longSource.length, longSource.length);

    const block = useFlowStore.getState().blocks[0];
    expect(block.type).toBe('long');
    expect(block.segments?.length).toBeGreaterThan(1);
  });

  test('segmented blocks keep contiguous offsets from start to finish', () => {
    const longSource = Array.from({ length: 20 }, (_, index) => `word${index}word${index}word${index}`).join(' ');
    const store = useFlowStore.getState();

    useFlowStore.setState({
      blocks: [makeShortBlock('block-a', 'seed')],
      editorState: {
        ...store.editorState,
        activeBlockId: 'block-a',
        activeAnchorSegmentIndex: 0,
      },
    });

    store.updateChunkSource(longSource, longSource.length, longSource.length);

    const segments = useFlowStore.getState().blocks[0].segments ?? [];
    expect(segments.length).toBeGreaterThan(1);
    expect(segments[0].startOffset).toBe(0);
    for (let index = 1; index < segments.length; index += 1) {
      expect(segments[index].startOffset).toBe(segments[index - 1].endOffset);
    }
    expect(segments[segments.length - 1].endOffset).toBe(useFlowStore.getState().blocks[0].source.length);
  });

  test('updateChunkSource resegments long blocks after a chunk edit', async () => {
    const longSource = Array.from({ length: 20 }, (_, index) => `word${index}word${index}word${index}`).join(' ');
    const store = useFlowStore.getState();
    useFlowStore.setState({
      blocks: [makeShortBlock('block-a', 'seed')],
      editorState: {
        ...store.editorState,
        activeBlockId: 'block-a',
        activeAnchorSegmentIndex: 0,
      },
    });

    store.updateChunkSource(longSource, longSource.length, longSource.length);
    useFlowStore.setState((state) => ({
      editorState: {
        ...state.editorState,
        focusSpan: 'tight',
        activeAnchorSegmentIndex: 0,
      },
    }));

    const chunk = store.getActiveChunkGroup();
    expect(chunk).toBeDefined();
    const chunkSource = chunk!.source;
    store.updateChunkSource(`${chunkSource} extra`, chunkSource.length + 6, chunkSource.length + 6);
    await waitForQueuedTimers();

    const block = useFlowStore.getState().getActiveBlock();
    const segments = block?.segments ?? [];
    expect(block?.type).toBe('long');
    expect(block?.source).toContain('extra');
    expect(segments.length).toBeGreaterThan(1);
    expect(segments[0].startOffset).toBe(0);
    expect(segments[segments.length - 1].endOffset).toBe(block?.source.length);
  });
});
