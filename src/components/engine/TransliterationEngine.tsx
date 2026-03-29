'use client';

import React from 'react';
import { StickyTopComposer } from '@/components/StickyTopComposer';
import { MainDocumentArea } from '@/components/MainDocumentArea';
import { ReferenceSidePanel } from '@/components/ReferenceSidePanel'; // Import the side panel
import { useFlowStore } from '@/store/useFlowStore';
import { Check, Copy, Menu, RefreshCw, Save, SlidersHorizontal, X } from 'lucide-react';
import { clsx } from 'clsx';
import { SessionSnapshot } from '@/store/types';

const STORAGE_KEY = 'sanskrit-keyboard.sessions.v1';
const LEXICAL_HISTORY_KEY = 'sanskrit-keyboard.lexical-history.v1';

interface PersistedLexicalLearningSnapshot {
  version: 1;
  swaraPredictionEnabled: boolean;
  userLexicalUsage: Record<string, number>;
  userExactFormUsage: Record<string, Record<string, number>>;
}

export const TransliterationEngine: React.FC = () => {
  const {
    blocks,
    editorState,
    typography,
    sessionId,
    sessionName,
    lastSavedAt,
    swaraPredictionEnabled,
    userLexicalUsage,
    userExactFormUsage,
    getRenderedDocumentText,
    preloadLexicalAssets,
    setTypography,
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
  const [savedSessions, setSavedSessions] = React.useState<SessionSnapshot[]>([]);
  const [copyAllState, setCopyAllState] = React.useState<'idle' | 'copied' | 'error'>('idle');
  const [isDisplayMenuOpen, setIsDisplayMenuOpen] = React.useState(false);
  const [isWorkspacePanelOpen, setIsWorkspacePanelOpen] = React.useState(false);
  const hasLoadedSessions = React.useRef(false);
  const hasLoadedLexicalLearning = React.useRef(false);
  const hasMeaningfulContent = React.useMemo(
    () => blocks.some((block) => block.source.trim().length > 0 || block.rendered.trim().length > 0),
    [blocks]
  );

  const persistSnapshot = React.useCallback((snapshot: SessionSnapshot) => {
    const existing = typeof window !== 'undefined'
      ? JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]') as SessionSnapshot[]
      : [];
    const nextSessions = [
      snapshot,
      ...existing.filter((item) => item.sessionId !== snapshot.sessionId),
    ].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSessions.slice(0, 25)));
    setSavedSessions(nextSessions.slice(0, 25));
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
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      hasLoadedSessions.current = true;
      return;
    }

    try {
      const parsed = JSON.parse(raw) as SessionSnapshot[];
      const sortedSessions = parsed.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      setSavedSessions(sortedSessions);
      const latestSession = sortedSessions[0];
      if (latestSession) {
        loadSessionSnapshot(latestSession);
      }
    } catch {
      setSavedSessions([]);
    } finally {
      hasLoadedSessions.current = true;
    }
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
  }, [blocks, editorState, typography, sessionId, sessionName, exportSessionSnapshot, persistSnapshot]);

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
    const nextSession = savedSessions.find((item) => item.sessionId === nextSessionId);
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
      <button
        type="button"
        onClick={() => setIsWorkspacePanelOpen((open) => !open)}
        className="fixed left-4 top-4 z-[80] inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-xs font-bold uppercase text-slate-700 shadow-sm backdrop-blur hover:bg-white"
      >
        {isWorkspacePanelOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        Workspace
      </button>

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
                <div className="space-y-3">
                  <label className="block text-xs font-semibold uppercase text-slate-600">
                    ITRANS Size
                    <input
                      className="mt-2 w-full"
                      type="range"
                      min="14"
                      max="28"
                      value={typography.itransFontSize}
                      onChange={(e) => setTypography({ itransFontSize: Number(e.target.value) })}
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
                      value={typography.itransLineHeight}
                      onChange={(e) => setTypography({ itransLineHeight: Number(e.target.value) })}
                    />
                  </label>
                  <label className="block text-xs font-semibold uppercase text-slate-600">
                    Sanskrit Size
                    <input
                      className="mt-2 w-full"
                      type="range"
                      min="24"
                      max="56"
                      value={typography.renderedFontSize}
                      onChange={(e) => setTypography({ renderedFontSize: Number(e.target.value) })}
                    />
                  </label>
                  <label className="block text-xs font-semibold uppercase text-slate-600">
                    Sanskrit Height
                    <input
                      className="mt-2 w-full"
                      type="range"
                      min="1.2"
                      max="2.4"
                      step="0.1"
                      value={typography.renderedLineHeight}
                      onChange={(e) => setTypography({ renderedLineHeight: Number(e.target.value) })}
                    />
                  </label>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
      <StickyTopComposer />
      <MainDocumentArea />
      <ReferenceSidePanel /> {/* Add the side panel here */}
    </div>
  );
};
