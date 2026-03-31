'use client';

import React from 'react';
import { StickyTopComposer } from '@/components/StickyTopComposer';
import { MainDocumentArea } from '@/components/MainDocumentArea';
import { ReferenceSidePanel } from '@/components/ReferenceSidePanel'; // Import the side panel
import { useFlowStore } from '@/store/useFlowStore';
import { BookText, Check, Copy, Eye, FileCode2, Menu, RefreshCw, Save, SlidersHorizontal, X } from 'lucide-react';
import { clsx } from 'clsx';
import { SessionSnapshot } from '@/store/types';

const LEGACY_STORAGE_KEY = 'sanskrit-keyboard.sessions.v1';
const SESSION_INDEX_KEY = 'sanskrit-keyboard.session-index.v2';
const SESSION_SNAPSHOT_PREFIX = 'sanskrit-keyboard.session.v2.';
const LEXICAL_HISTORY_KEY = 'sanskrit-keyboard.lexical-history.v1';
const LEGACY_AUTOLOAD_BYTES_LIMIT = 1_000_000;

interface SessionListItem {
  sessionId: string;
  sessionName: string;
  updatedAt: string;
}

interface PersistedLexicalLearningSnapshot {
  version: 1;
  swaraPredictionEnabled: boolean;
  userLexicalUsage: Record<string, number>;
  userExactFormUsage: Record<string, Record<string, number>>;
}

const sortSessionList = (sessions: SessionListItem[]) =>
  [...sessions].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

const getSessionStorageKey = (sessionId: string) => `${SESSION_SNAPSHOT_PREFIX}${sessionId}`;

const readSessionIndex = () => {
  const raw = window.localStorage.getItem(SESSION_INDEX_KEY);
  if (!raw) {
    return [] as SessionListItem[];
  }

  try {
    return sortSessionList(JSON.parse(raw) as SessionListItem[]);
  } catch {
    return [] as SessionListItem[];
  }
};

const writeSessionIndex = (items: SessionListItem[]) => {
  const nextItems = sortSessionList(items).slice(0, 25);
  window.localStorage.setItem(SESSION_INDEX_KEY, JSON.stringify(nextItems));
  return nextItems;
};

const readStoredSessionSnapshot = (sessionId: string) => {
  const raw = window.localStorage.getItem(getSessionStorageKey(sessionId));
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as SessionSnapshot;
  } catch {
    return null;
  }
};

const migrateLegacySessionsIfNeeded = () => {
  if (window.localStorage.getItem(SESSION_INDEX_KEY)) {
    return null;
  }

  const legacyRaw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!legacyRaw) {
    return null;
  }

  if (legacyRaw.length > LEGACY_AUTOLOAD_BYTES_LIMIT) {
    return { skipped: true as const, sessions: [] as SessionListItem[] };
  }

  try {
    const parsed = JSON.parse(legacyRaw) as SessionSnapshot[];
    const nextIndex = writeSessionIndex(
      parsed.map((snapshot) => ({
        sessionId: snapshot.sessionId,
        sessionName: snapshot.sessionName,
        updatedAt: snapshot.updatedAt,
      }))
    );
    for (const snapshot of parsed) {
      window.localStorage.setItem(getSessionStorageKey(snapshot.sessionId), JSON.stringify(snapshot));
    }
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    return { skipped: false as const, sessions: nextIndex };
  } catch {
    return null;
  }
};

export const TransliterationEngine: React.FC = () => {
  const {
    blocks,
    editorState,
    displaySettings,
    sessionId,
    sessionName,
    lastSavedAt,
    swaraPredictionEnabled,
    userLexicalUsage,
    userExactFormUsage,
    getRenderedDocumentText,
    preloadLexicalAssets,
    setComposerLayout,
    setPredictionLayout,
    setPredictionPopupTimeoutMs,
    setSyncComposerScroll,
    setTypography,
    setViewMode,
    setSessionName,
    setSwaraPredictionEnabled,
    markSessionSaved,
    hydratePersistedLexicalLearning,
    clearSessionLexicalLearning,
    clearPersistedLexicalLearning,
    exportSessionSnapshot,
    loadSessionSnapshot,
    resetSession,
  } = useFlowStore();
  const [savedSessions, setSavedSessions] = React.useState<SessionListItem[]>([]);
  const [copyAllState, setCopyAllState] = React.useState<'idle' | 'copied' | 'error'>('idle');
  const [isDisplayMenuOpen, setIsDisplayMenuOpen] = React.useState(false);
  const [isWorkspacePanelOpen, setIsWorkspacePanelOpen] = React.useState(false);
  const hasLoadedSessions = React.useRef(false);
  const hasLoadedLexicalLearning = React.useRef(false);
  const { composerLayout, predictionLayout, predictionPopupTimeoutMs, syncComposerScroll, typography } = displaySettings;
  const { viewMode } = editorState;
  const hasMeaningfulContent = React.useMemo(
    () => blocks.some((block) => block.source.trim().length > 0 || block.rendered.trim().length > 0),
    [blocks]
  );

  const persistSnapshot = React.useCallback((snapshot: SessionSnapshot) => {
    window.localStorage.setItem(getSessionStorageKey(snapshot.sessionId), JSON.stringify(snapshot));
    const nextSessions = writeSessionIndex([
      {
        sessionId: snapshot.sessionId,
        sessionName: snapshot.sessionName,
        updatedAt: snapshot.updatedAt,
      },
      ...readSessionIndex().filter((item) => item.sessionId !== snapshot.sessionId),
    ]);
    setSavedSessions(nextSessions);
    markSessionSaved(snapshot.updatedAt);
  }, [markSessionSaved]);

  React.useEffect(() => {
    const raw = window.localStorage.getItem(LEXICAL_HISTORY_KEY);
    if (!raw) {
      hasLoadedLexicalLearning.current = true;
      return;
    }

    try {
      const parsed = JSON.parse(raw) as PersistedLexicalLearningSnapshot;
      hydratePersistedLexicalLearning({
        userLexicalUsage: parsed.userLexicalUsage,
        userExactFormUsage: parsed.userExactFormUsage,
        swaraPredictionEnabled: parsed.swaraPredictionEnabled,
      });
    } catch {
      hydratePersistedLexicalLearning({
        userLexicalUsage: {},
        userExactFormUsage: {},
        swaraPredictionEnabled: true,
      });
    } finally {
      hasLoadedLexicalLearning.current = true;
    }
  }, [hydratePersistedLexicalLearning]);

  React.useEffect(() => {
    const migrationResult = migrateLegacySessionsIfNeeded();
    const indexedSessions =
      migrationResult?.sessions ?? readSessionIndex();
    setSavedSessions(indexedSessions);

    const latestSession = indexedSessions[0];
    if (latestSession) {
      const runRestore = () => {
        const snapshot = readStoredSessionSnapshot(latestSession.sessionId);
        if (snapshot) {
          loadSessionSnapshot(snapshot);
        }
      };

      const idleWindow = window as Window & {
        requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
        cancelIdleCallback?: (handle: number) => void;
      };

      if (idleWindow.requestIdleCallback) {
        const idleId = idleWindow.requestIdleCallback(runRestore, { timeout: 1500 });
        hasLoadedSessions.current = true;
        return () => idleWindow.cancelIdleCallback?.(idleId);
      }

      const timeoutId = window.setTimeout(runRestore, 0);
      hasLoadedSessions.current = true;
      return () => window.clearTimeout(timeoutId);
    }

    hasLoadedSessions.current = true;
  }, [loadSessionSnapshot]);

  React.useEffect(() => {
    if (!hasLoadedSessions.current) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const snapshot = exportSessionSnapshot();
      snapshot.updatedAt = new Date().toISOString();
      persistSnapshot(snapshot);
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [blocks, displaySettings, editorState, sessionId, sessionName, exportSessionSnapshot, persistSnapshot]);

  React.useEffect(() => {
    if (!hasLoadedLexicalLearning.current) {
      return;
    }

    const payload: PersistedLexicalLearningSnapshot = {
      version: 1,
      swaraPredictionEnabled,
      userLexicalUsage,
      userExactFormUsage,
    };
    window.localStorage.setItem(LEXICAL_HISTORY_KEY, JSON.stringify(payload));
  }, [swaraPredictionEnabled, userExactFormUsage, userLexicalUsage]);

  React.useEffect(() => {
    const runPreload = () => preloadLexicalAssets();
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    if (idleWindow.requestIdleCallback) {
      const idleId = idleWindow.requestIdleCallback(runPreload, { timeout: 1200 });
      return () => idleWindow.cancelIdleCallback?.(idleId);
    }

    const timeoutId = globalThis.setTimeout(runPreload, 250);
    return () => globalThis.clearTimeout(timeoutId);
  }, [preloadLexicalAssets, swaraPredictionEnabled]);

  React.useEffect(() => {
    if (copyAllState === 'idle') {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCopyAllState('idle');
    }, 1500);

    return () => window.clearTimeout(timeoutId);
  }, [copyAllState]);

  const handleSaveNow = () => {
    const snapshot = exportSessionSnapshot();
    snapshot.updatedAt = new Date().toISOString();
    persistSnapshot(snapshot);
  };

  const handleLoadSession = (nextSessionId: string) => {
    const nextSession = readStoredSessionSnapshot(nextSessionId);
    if (nextSession) {
      loadSessionSnapshot(nextSession);
    }
  };

  const handleResetSession = () => {
    if (
      hasMeaningfulContent &&
      !window.confirm('Start a new blank session? The current session is autosaved and can still be reloaded later.')
    ) {
      return;
    }

    resetSession();
    setIsWorkspacePanelOpen(false);
  };

  const handleCopyWholeDocument = async () => {
    const fullDocument = getRenderedDocumentText();
    if (!fullDocument) {
      setCopyAllState('error');
      return;
    }

    try {
      await navigator.clipboard.writeText(fullDocument);
      setCopyAllState('copied');
    } catch {
      setCopyAllState('error');
    }
  };

  const handleClearSessionLearning = () => {
    if (!window.confirm('Clear autocomplete learning from the current session?')) {
      return;
    }

    clearSessionLexicalLearning();
  };

  const handlePurgeSavedLearning = () => {
    if (!window.confirm('Purge saved autocomplete learning across sessions?')) {
      return;
    }

    clearPersistedLexicalLearning();
    window.localStorage.removeItem(LEXICAL_HISTORY_KEY);
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 font-sans relative">
      <div className="fixed left-4 top-4 z-[80] flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIsWorkspacePanelOpen((open) => !open)}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-xs font-bold uppercase text-slate-700 shadow-sm backdrop-blur hover:bg-white"
        >
          {isWorkspacePanelOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          Workspace
        </button>
        <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white/95 p-1 shadow-sm backdrop-blur">
          <button
            type="button"
            onClick={() => setViewMode('read')}
            className={clsx(
              'inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600',
              viewMode === 'read' ? 'bg-blue-600 text-white' : 'hover:bg-slate-100'
            )}
            aria-label="Read mode"
            title="Read mode"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('review')}
            className={clsx(
              'inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600',
              viewMode === 'review' ? 'bg-blue-600 text-white' : 'hover:bg-slate-100'
            )}
            aria-label="Review mode"
            title="Review mode"
          >
            <FileCode2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('immersive')}
            className={clsx(
              'inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600',
              viewMode === 'immersive' ? 'bg-blue-600 text-white' : 'hover:bg-slate-100'
            )}
            aria-label="Immersive mode"
            title="Immersive mode"
          >
            <BookText className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        className={clsx(
          'fixed left-0 top-0 z-[75] flex h-full w-80 flex-col border-r border-slate-200 bg-white shadow-xl transition-transform duration-300 ease-in-out',
          isWorkspacePanelOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Workspace</p>
            <p className="mt-1 text-sm text-slate-500">Session and document-level controls.</p>
          </div>
          <button
            type="button"
            onClick={() => setIsWorkspacePanelOpen(false)}
            className="rounded-md border border-slate-200 p-2 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          <section className="space-y-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Session</p>
              <p className="mt-1 text-xs text-slate-500">{lastSavedAt ? `Autosaved ${new Date(lastSavedAt).toLocaleString()}` : 'Autosave pending'}</p>
            </div>
            <input
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800"
              placeholder="Session name"
            />
            <select
              value=""
              onChange={(e) => {
                handleLoadSession(e.target.value);
                e.currentTarget.value = '';
                setIsWorkspacePanelOpen(false);
              }}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
            >
              <option value="" disabled>Load session</option>
              {savedSessions.map((session) => (
                <option key={session.sessionId} value={session.sessionId}>
                  {session.sessionName} · {new Date(session.updatedAt).toLocaleString()}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleSaveNow}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-bold uppercase text-slate-700 hover:bg-slate-200"
                type="button"
              >
                <Save className="h-4 w-4" />
                Save
              </button>
              <button
                onClick={handleResetSession}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-bold uppercase text-slate-700 hover:bg-slate-100"
                type="button"
              >
                <RefreshCw className="h-4 w-4" />
                New
              </button>
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Document</p>
                <p className="mt-1 text-xs text-slate-500">Whole-document actions stay out of the typing lane.</p>
              </div>
            </div>
            <button
              onClick={handleCopyWholeDocument}
              className={clsx(
                'inline-flex w-full items-center justify-center gap-2 rounded-md border px-3 py-2 text-xs font-bold uppercase',
                copyAllState === 'copied'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : copyAllState === 'error'
                    ? 'border-rose-200 bg-rose-50 text-rose-700'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
              )}
              type="button"
            >
              {copyAllState === 'copied' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copyAllState === 'copied' ? 'Copied Whole Document' : copyAllState === 'error' ? 'Copy Failed' : 'Copy Whole Document'}
            </button>
          </section>

          <section className="space-y-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Autocomplete</p>
              <p className="mt-1 text-xs text-slate-500">Word prediction can prefer learned swara-marked forms from corpus and personal history.</p>
            </div>
            <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
              <input
                checked={swaraPredictionEnabled}
                data-testid="swara-prediction-toggle"
                onChange={(e) => setSwaraPredictionEnabled(e.target.checked)}
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span>
                <span className="block text-xs font-bold uppercase text-slate-700">Show Learned Swara Forms</span>
                <span className="mt-1 block text-xs text-slate-500">Enabled suggestions can surface accented Vedic forms like <span className="font-mono">bha_draM</span> instead of only plain lexical stems.</span>
              </span>
            </label>
            <div className="grid grid-cols-1 gap-2">
              <button
                data-testid="clear-session-learning"
                onClick={handleClearSessionLearning}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-bold uppercase text-slate-700 hover:bg-slate-100"
                type="button"
              >
                <RefreshCw className="h-4 w-4" />
                Clear Session Learning
              </button>
              <button
                data-testid="purge-saved-learning"
                onClick={handlePurgeSavedLearning}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold uppercase text-rose-700 hover:bg-rose-100"
                type="button"
              >
                <X className="h-4 w-4" />
                Purge Saved Learning
              </button>
            </div>
          </section>

          <section className="space-y-3">
            <button
              onClick={() => setIsDisplayMenuOpen((open) => !open)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-bold uppercase text-slate-700 hover:bg-slate-100"
              type="button"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Display
            </button>
            {isDisplayMenuOpen && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="space-y-5">
                  <section className="space-y-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Composer Layout</p>
                      <p className="mt-1 text-xs text-slate-500">Choose how the source and live preview sit inside the sticky typing lane.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setComposerLayout('side-by-side')}
                        className={clsx(
                          'rounded-md border px-3 py-2 text-xs font-bold uppercase',
                          composerLayout === 'side-by-side'
                            ? 'border-blue-300 bg-blue-600 text-white'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                        )}
                      >
                        Side by Side
                      </button>
                      <button
                        type="button"
                        onClick={() => setComposerLayout('stacked')}
                        className={clsx(
                          'rounded-md border px-3 py-2 text-xs font-bold uppercase',
                          composerLayout === 'stacked'
                            ? 'border-blue-300 bg-blue-600 text-white'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                        )}
                      >
                        Stacked
                      </button>
                    </div>
                    <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3">
                      <input
                        checked={syncComposerScroll}
                        onChange={(e) => setSyncComposerScroll(e.target.checked)}
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>
                        <span className="block text-xs font-bold uppercase text-slate-700">Sync Source And Preview Scroll</span>
                        <span className="mt-1 block text-xs text-slate-500">Keep the ITRANS and Devanagari panes aligned proportionally during long edits.</span>
                      </span>
                    </label>
                  </section>

                  <section className="space-y-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Prediction Placement</p>
                      <p className="mt-1 text-xs text-slate-500">Compare different positions for lexical word predictions while keeping the same underlying suggestions.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setPredictionLayout('inline')}
                        className={clsx(
                          'rounded-md border px-3 py-2 text-xs font-bold uppercase',
                          predictionLayout === 'inline'
                            ? 'border-emerald-300 bg-emerald-600 text-white'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                        )}
                      >
                        Inline
                      </button>
                      <button
                        type="button"
                        onClick={() => setPredictionLayout('split')}
                        className={clsx(
                          'rounded-md border px-3 py-2 text-xs font-bold uppercase',
                          predictionLayout === 'split'
                            ? 'border-emerald-300 bg-emerald-600 text-white'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                        )}
                      >
                        Split
                      </button>
                      <button
                        type="button"
                        onClick={() => setPredictionLayout('footer')}
                        className={clsx(
                          'rounded-md border px-3 py-2 text-xs font-bold uppercase',
                          predictionLayout === 'footer'
                            ? 'border-emerald-300 bg-emerald-600 text-white'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                        )}
                      >
                        Footer
                      </button>
                      <button
                        type="button"
                        onClick={() => setPredictionLayout('listbox')}
                        className={clsx(
                          'rounded-md border px-3 py-2 text-xs font-bold uppercase',
                          predictionLayout === 'listbox'
                            ? 'border-emerald-300 bg-emerald-600 text-white'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                        )}
                      >
                        Listbox
                      </button>
                    </div>
                    <label className="block text-xs font-semibold uppercase text-slate-600">
                      Prediction Popup Timeout
                      <input
                        className="mt-2 w-full"
                        type="range"
                        min="3"
                        max="20"
                        step="1"
                        value={Math.round(predictionPopupTimeoutMs / 1000)}
                        onChange={(e) => setPredictionPopupTimeoutMs(Number(e.target.value) * 1000)}
                      />
                      <span className="mt-1 block text-[11px] normal-case tracking-normal text-slate-500">
                        Floating listbox auto-hides after {Math.round(predictionPopupTimeoutMs / 1000)} seconds of inactivity.
                      </span>
                    </label>
                  </section>

                  <section className="space-y-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Composer Typography</p>
                      <p className="mt-1 text-xs text-slate-500">These controls affect only the sticky typing lane.</p>
                    </div>
                    <label className="block text-xs font-semibold uppercase text-slate-600">
                      ITRANS Size
                      <input
                        className="mt-2 w-full"
                        type="range"
                        min="14"
                        max="28"
                        value={typography.composer.itransFontSize}
                        onChange={(e) => setTypography('composer', { itransFontSize: Number(e.target.value) })}
                      />
                    </label>
                    <label className="block text-xs font-semibold uppercase text-slate-600">
                      ITRANS Height
                      <input
                        className="mt-2 w-full"
                        type="range"
                        min="1.2"
                        max="2.4"
                        step="0.1"
                        value={typography.composer.itransLineHeight}
                        onChange={(e) => setTypography('composer', { itransLineHeight: Number(e.target.value) })}
                      />
                    </label>
                    <label className="block text-xs font-semibold uppercase text-slate-600">
                      Preview Sanskrit Size
                      <input
                        className="mt-2 w-full"
                        type="range"
                        min="24"
                        max="56"
                        value={typography.composer.renderedFontSize}
                        onChange={(e) => setTypography('composer', { renderedFontSize: Number(e.target.value) })}
                      />
                    </label>
                    <label className="block text-xs font-semibold uppercase text-slate-600">
                      Preview Sanskrit Height
                      <input
                        className="mt-2 w-full"
                        type="range"
                        min="1.2"
                        max="2.4"
                        step="0.1"
                        value={typography.composer.renderedLineHeight}
                        onChange={(e) => setTypography('composer', { renderedLineHeight: Number(e.target.value) })}
                      />
                    </label>
                  </section>

                  <section className="space-y-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Document Typography</p>
                      <p className="mt-1 text-xs text-slate-500">These controls affect Read mode and the source/rendered text inside Review.</p>
                    </div>
                    <label className="block text-xs font-semibold uppercase text-slate-600">
                      Document ITRANS Size
                      <input
                        className="mt-2 w-full"
                        type="range"
                        min="12"
                        max="28"
                        value={typography.document.itransFontSize}
                        onChange={(e) => setTypography('document', { itransFontSize: Number(e.target.value) })}
                      />
                    </label>
                    <label className="block text-xs font-semibold uppercase text-slate-600">
                      Document ITRANS Height
                      <input
                        className="mt-2 w-full"
                        type="range"
                        min="1.2"
                        max="2.6"
                        step="0.1"
                        value={typography.document.itransLineHeight}
                        onChange={(e) => setTypography('document', { itransLineHeight: Number(e.target.value) })}
                      />
                    </label>
                    <label className="block text-xs font-semibold uppercase text-slate-600">
                      Document Sanskrit Size
                      <input
                        className="mt-2 w-full"
                        type="range"
                        min="20"
                        max="56"
                        value={typography.document.renderedFontSize}
                        onChange={(e) => setTypography('document', { renderedFontSize: Number(e.target.value) })}
                      />
                    </label>
                    <label className="block text-xs font-semibold uppercase text-slate-600">
                      Document Sanskrit Height
                      <input
                        className="mt-2 w-full"
                        type="range"
                        min="1.2"
                        max="2.6"
                        step="0.1"
                        value={typography.document.renderedLineHeight}
                        onChange={(e) => setTypography('document', { renderedLineHeight: Number(e.target.value) })}
                      />
                    </label>
                  </section>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
      {viewMode !== 'immersive' && <StickyTopComposer />}
      <MainDocumentArea />
      <ReferenceSidePanel /> {/* Add the side panel here */}
    </div>
  );
};
