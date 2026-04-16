import { expect, test } from '@playwright/test';
import { transliterate } from './src/lib/vedic/utils';
import {
  readStoredSessionSnapshot,
  useFlowStore,
} from './src/store/useFlowStore';

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
