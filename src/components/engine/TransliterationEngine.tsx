'use client';

import React from 'react';
import { StickyTopComposer } from '@/components/StickyTopComposer';
import { MainDocumentArea } from '@/components/MainDocumentArea';
import { ReferenceSidePanel } from '@/components/ReferenceSidePanel'; // Import the side panel
import { ScriptText } from '@/components/ScriptText';
import { useFlowStore } from '@/store/useFlowStore';
import { BookText, Check, Copy, Eye, Menu, RefreshCw, Save, SlidersHorizontal, X } from 'lucide-react';
import { clsx } from 'clsx';
import { SessionSnapshot, SanskritFontPreset, TamilFontPreset } from '@/store/types';
import { formatSourceForPrimaryOutput, getCopySourceControlText, reverseTamilInput } from '@/lib/vedic/utils';
import {
  OUTPUT_TARGET_CONTROL_LABELS,
  OUTPUT_TARGET_VALUE_LABELS,
} from '@/lib/vedic/mapping';

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
    setInputScheme,
    setPrimaryOutputScript,
    setComparisonOutputScript,
    setRomanOutputStyle,
    setSanskritFontPreset,
    setTamilFontPreset,
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
  const [copySourceState, setCopySourceState] = React.useState<'idle' | 'copied' | 'error'>('idle');
  const [tamilRecoveryInput, setTamilRecoveryInput] = React.useState('');
  const [tamilRecoveryCopyState, setTamilRecoveryCopyState] = React.useState<'idle' | 'canonical' | 'baraha' | 'error'>('idle');
  const [isDisplayMenuOpen, setIsDisplayMenuOpen] = React.useState(false);
  const [isWorkspacePanelOpen, setIsWorkspacePanelOpen] = React.useState(false);
  const hasLoadedSessions = React.useRef(false);
  const hasLoadedLexicalLearning = React.useRef(false);
  const {
    composerLayout,
    predictionLayout,
    predictionPopupTimeoutMs,
    syncComposerScroll,
    typography,
    inputScheme,
    primaryOutputScript,
    comparisonOutputScript,
    romanOutputStyle,
    tamilOutputStyle,
    sanskritFontPreset,
    tamilFontPreset,
  } = displaySettings;
  const sanskritFontOptions: Array<{ value: SanskritFontPreset; label: string; sample: string }> = [
    { value: 'chandas', label: 'Chandas', sample: 'नमस्ते रुद्राय' },
    { value: 'siddhanta', label: 'Siddhanta', sample: 'नमस्ते रुद्राय' },
    { value: 'sampradaya', label: 'Sampradaya', sample: 'नमस्ते रुद्राय' },
  ];
  const tamilFontOptions: Array<{ value: TamilFontPreset; label: string; sample: string }> = [
    { value: 'hybrid', label: 'Hybrid', sample: 'நமஸ்தே ருத்³ராய' },
    { value: 'noto-serif', label: 'Noto Serif Tamil', sample: 'நமஸ்தே ருத்³ராய' },
    { value: 'anek', label: 'Anek Tamil', sample: 'நமஸ்தே ருத்³ராய' },
  ];
  const { viewMode } = editorState;
  const copySourceControlText = getCopySourceControlText({
    primaryOutputScript,
    comparisonOutputScript,
    romanOutputStyle,
    tamilOutputStyle,
  });
  const tamilRecoveryResult = React.useMemo(() => {
    if (tamilRecoveryInput.trim().length === 0) {
      return null;
    }

    return reverseTamilInput(tamilRecoveryInput, {
      inputMode: 'tamil-precision',
      outputMode: 'baraha',
    });
  }, [tamilRecoveryInput]);
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

  React.useEffect(() => {
    if (copySourceState === 'idle') {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCopySourceState('idle');
    }, 1500);

    return () => window.clearTimeout(timeoutId);
  }, [copySourceState]);

  React.useEffect(() => {
    if (tamilRecoveryCopyState === 'idle') {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setTamilRecoveryCopyState('idle');
    }, 1500);

    return () => window.clearTimeout(timeoutId);
  }, [tamilRecoveryCopyState]);

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

  const handleCopyWholeSource = async () => {
    const fullSourceDocument = blocks
      .map((block) => block.source.trim())
      .filter((source) => source.length > 0)
      .join('\n\n');
    const formattedSource = formatSourceForPrimaryOutput(fullSourceDocument, {
      primaryOutputScript,
      comparisonOutputScript,
      romanOutputStyle,
      tamilOutputStyle,
    });

    if (!formattedSource) {
      setCopySourceState('error');
      return;
    }

    try {
      await navigator.clipboard.writeText(formattedSource);
      setCopySourceState('copied');
    } catch {
      setCopySourceState('error');
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

  const handleCopyTamilRecovery = async (value: string, mode: 'canonical' | 'baraha') => {
    if (!value) {
      setTamilRecoveryCopyState('error');
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setTamilRecoveryCopyState(mode);
    } catch {
      setTamilRecoveryCopyState('error');
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 font-sans relative">
      <div className="fixed left-4 top-4 z-[140] flex items-center gap-2 pointer-events-none">
        <button
          type="button"
          onClick={() => setIsWorkspacePanelOpen((open) => !open)}
          className="pointer-events-auto touch-manipulation inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-xs font-bold uppercase text-slate-700 shadow-sm backdrop-blur hover:bg-white"
        >
          {isWorkspacePanelOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          Workspace
        </button>
        <div className="pointer-events-auto inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white/95 p-1 shadow-sm backdrop-blur">
          <button
            type="button"
            onClick={() => setViewMode('read')}
            className={clsx(
              'touch-manipulation inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600',
              viewMode === 'read' ? 'bg-blue-600 text-white' : 'hover:bg-slate-100'
            )}
            aria-label="Read mode"
            title="Read mode"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('immersive')}
            className={clsx(
              'touch-manipulation inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600',
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
            <button
              data-testid="copy-whole-source"
              onClick={handleCopyWholeSource}
              className={clsx(
                'inline-flex w-full items-center justify-center gap-2 rounded-md border px-3 py-2 text-xs font-bold uppercase',
                copySourceState === 'copied'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : copySourceState === 'error'
                    ? 'border-rose-200 bg-rose-50 text-rose-700'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
              )}
              type="button"
              aria-label={copySourceControlText.ariaLabel}
              title={copySourceControlText.title}
            >
              {copySourceState === 'copied' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copySourceState === 'copied'
                ? `Copied ${copySourceControlText.targetLabel}`
                : copySourceState === 'error'
                  ? 'Copy Failed'
                  : `Copy ${copySourceControlText.targetLabel}`}
            </button>
            <p className="text-xs text-slate-500">
              Source copy follows the current Read As target. Stored source and Devanagari paste remain canonical.
            </p>
          </section>

          <section className="space-y-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Input Scheme</p>
              <p className="mt-1 text-xs text-slate-500">Canonical Vedic remains the default. Baraha-compatible mode only enables deferred conflict aliases behind an explicit opt-in.</p>
            </div>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                data-testid="input-scheme-canonical"
                onClick={() => setInputScheme('canonical-vedic')}
                className={clsx(
                  'rounded-xl border px-3 py-3 text-left',
                  inputScheme === 'canonical-vedic'
                    ? 'border-blue-300 bg-blue-50 text-blue-900'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                )}
              >
                <span className="block text-xs font-bold uppercase">Canonical Vedic</span>
                <span className="mt-1 block text-xs">Uses the current canonical conflict semantics and keeps `c` literal.</span>
              </button>
              <button
                type="button"
                data-testid="input-scheme-baraha"
                onClick={() => setInputScheme('baraha-compatible')}
                className={clsx(
                  'rounded-xl border px-3 py-3 text-left',
                  inputScheme === 'baraha-compatible'
                    ? 'border-blue-300 bg-blue-50 text-blue-900'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                )}
              >
                <span className="block text-xs font-bold uppercase">Baraha Compatible</span>
                <span className="mt-1 block text-xs">Enables conflict aliases intentionally. Current scoped addition: `c` is accepted as `ch` and canonicalizes on commit.</span>
              </button>
            </div>
          </section>

          <section className="space-y-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                {OUTPUT_TARGET_CONTROL_LABELS.primaryScript}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Read As changes the main reading target and default source copy target. Stored source and canonical paste remain unchanged.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                data-testid="workspace-primary-script-devanagari"
                aria-pressed={primaryOutputScript === 'devanagari'}
                onClick={() => setPrimaryOutputScript('devanagari')}
                className={clsx(
                  'rounded-xl border px-3 py-3 text-left',
                  primaryOutputScript === 'devanagari'
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                )}
              >
                <span className="block text-xs font-bold uppercase">{OUTPUT_TARGET_VALUE_LABELS.devanagari}</span>
                <span className="mt-1 block text-xs">Keep the primary reading surface in Devanagari while source copy targets Devanagari.</span>
              </button>
              <button
                type="button"
                data-testid="workspace-primary-script-tamil"
                aria-pressed={primaryOutputScript === 'tamil'}
                onClick={() => setPrimaryOutputScript('tamil')}
                className={clsx(
                  'rounded-xl border px-3 py-3 text-left',
                  primaryOutputScript === 'tamil'
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                )}
              >
                <span className="block text-xs font-bold uppercase">{OUTPUT_TARGET_VALUE_LABELS.tamil}</span>
                <span className="mt-1 block text-xs">Use the reversible Tamil precision reading mode for Sanskrit-in-Tamil verification.</span>
              </button>
            </div>
          </section>

          <section className="space-y-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                {OUTPUT_TARGET_CONTROL_LABELS.compareWith}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Comparison stays off by default and never changes the current Read As target.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(['off', 'roman', 'devanagari', 'tamil'] as const).map((script) => (
                <button
                  key={script}
                  type="button"
                  data-testid={`workspace-compare-script-${script}`}
                  aria-pressed={comparisonOutputScript === script}
                  onClick={() => setComparisonOutputScript(script)}
                  className={clsx(
                    'rounded-md border px-3 py-2 text-xs font-bold uppercase',
                    comparisonOutputScript === script
                      ? 'border-blue-300 bg-blue-50 text-blue-900'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                  )}
                >
                  {OUTPUT_TARGET_VALUE_LABELS[script]}
                </button>
              ))}
            </div>
          </section>

          {(primaryOutputScript === 'roman' || comparisonOutputScript === 'roman') && (
            <section className="space-y-3" data-testid="workspace-roman-style">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                  {OUTPUT_TARGET_CONTROL_LABELS.romanStyle}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Roman style applies anywhere Roman is active, whether it is primary or only used for comparison.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  data-testid="workspace-roman-style-canonical"
                  aria-pressed={romanOutputStyle === 'canonical'}
                  onClick={() => setRomanOutputStyle('canonical')}
                  className={clsx(
                    'rounded-xl border px-3 py-3 text-left',
                    romanOutputStyle === 'canonical'
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                  )}
                >
                  <span className="block text-xs font-bold uppercase">{OUTPUT_TARGET_VALUE_LABELS.canonical}</span>
                  <span className="mt-1 block text-xs">Use canonical Vedic Roman output for display and source copy.</span>
                </button>
                <button
                  type="button"
                  data-testid="workspace-roman-style-baraha"
                  aria-pressed={romanOutputStyle === 'baraha'}
                  onClick={() => setRomanOutputStyle('baraha')}
                  className={clsx(
                    'rounded-xl border px-3 py-3 text-left',
                    romanOutputStyle === 'baraha'
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                  )}
                >
                  <span className="block text-xs font-bold uppercase">{OUTPUT_TARGET_VALUE_LABELS.baraha}</span>
                  <span className="mt-1 block text-xs">Keep Baraha-compatible Roman aliases for source copy without changing stored canonical input.</span>
                </button>
              </div>
            </section>
          )}

          {(primaryOutputScript === 'tamil' || comparisonOutputScript === 'tamil') && (
            <section className="space-y-3" data-testid="workspace-tamil-mode">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                  {OUTPUT_TARGET_CONTROL_LABELS.tamilMode}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Phase 1 keeps Tamil in the reversible precision mode. Additional Tamil reading styles are intentionally out of scope.
                </p>
              </div>
              <div
                data-testid="workspace-tamil-mode-precision"
                className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-left text-slate-700"
              >
                <span className="block text-xs font-bold uppercase text-amber-900">
                  {OUTPUT_TARGET_VALUE_LABELS.precision}
                </span>
                <span className="mt-1 block text-xs">
                  Tamil output stays in the scholarly precision notation so the Sanskrit contrasts remain reversible.
                </span>
              </div>
            </section>
          )}

          <section className="space-y-3" data-testid="workspace-tamil-precision-recovery">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                  Tamil Precision Recovery
                </p>
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-amber-800">
                  Utility
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Phase 1 utility: recovers Roman Sanskrit only from frozen Tamil Precision input. Plain Tamil and Baraha Tamil reject instead of guessing.
              </p>
            </div>
            <label className="block text-xs font-semibold uppercase text-slate-600">
              Tamil Precision Input
              <textarea
                data-testid="tamil-recovery-input"
                value={tamilRecoveryInput}
                onChange={(event) => setTamilRecoveryInput(event.target.value)}
                rows={4}
                placeholder="நமஸ்தே ருத்³ராய"
                className="mt-2 min-h-[6.5rem] w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-base normal-case tracking-normal text-slate-900 shadow-sm"
              />
            </label>
            {tamilRecoveryResult === null ? (
              <div
                data-testid="tamil-recovery-empty"
                className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-xs text-slate-500"
              >
                Paste Tamil Precision text here to recover canonical Roman and derived Baraha Roman safely.
              </div>
            ) : tamilRecoveryResult.status === 'success' ? (
              <div className="space-y-3" data-testid="tamil-recovery-success">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-xs text-emerald-900">
                  Exact recovery succeeded from Tamil Precision input.
                </div>
                <div className="space-y-2 rounded-xl border border-slate-200 bg-white px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                      Canonical Roman
                    </p>
                    <button
                      type="button"
                      data-testid="tamil-recovery-copy-canonical"
                      onClick={() => handleCopyTamilRecovery(tamilRecoveryResult.canonicalRoman, 'canonical')}
                      className={clsx(
                        'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-bold uppercase',
                        tamilRecoveryCopyState === 'canonical'
                          ? 'border-emerald-200 bg-emerald-100 text-emerald-800'
                          : tamilRecoveryCopyState === 'error'
                            ? 'border-rose-200 bg-rose-50 text-rose-700'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                      )}
                    >
                      {tamilRecoveryCopyState === 'canonical' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {tamilRecoveryCopyState === 'canonical' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <pre
                    data-testid="tamil-recovery-canonical-output"
                    className="overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-slate-50 px-3 py-2 font-mono text-sm text-slate-900"
                  >
                    {tamilRecoveryResult.canonicalRoman}
                  </pre>
                </div>
                <div className="space-y-2 rounded-xl border border-slate-200 bg-white px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                      Derived Baraha Roman
                    </p>
                    <button
                      type="button"
                      data-testid="tamil-recovery-copy-baraha"
                      onClick={() => handleCopyTamilRecovery(tamilRecoveryResult.barahaRoman ?? '', 'baraha')}
                      className={clsx(
                        'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-bold uppercase',
                        tamilRecoveryCopyState === 'baraha'
                          ? 'border-emerald-200 bg-emerald-100 text-emerald-800'
                          : tamilRecoveryCopyState === 'error'
                            ? 'border-rose-200 bg-rose-50 text-rose-700'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                      )}
                    >
                      {tamilRecoveryCopyState === 'baraha' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {tamilRecoveryCopyState === 'baraha' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <pre
                    data-testid="tamil-recovery-baraha-output"
                    className="overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-slate-50 px-3 py-2 font-mono text-sm text-slate-900"
                  >
                    {tamilRecoveryResult.barahaRoman ?? ''}
                  </pre>
                  <p className="text-[11px] text-slate-500">
                    Derived from the canonical recovery result. It is not a separate Tamil parser mode.
                  </p>
                </div>
              </div>
            ) : (
              <div
                data-testid="tamil-recovery-rejection"
                className="space-y-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-900"
              >
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-rose-700">
                  Rejected: {tamilRecoveryResult.inputKind}
                </p>
                <p className="text-sm leading-6">{tamilRecoveryResult.reason}</p>
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-rose-700">
                    Rejected Source
                  </p>
                  <pre
                    data-testid="tamil-recovery-rejected-source"
                    className="overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-white/70 px-3 py-2 font-medium text-sm text-rose-950"
                  >
                    {tamilRecoveryResult.originalText}
                  </pre>
                </div>
              </div>
            )}
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
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Script Fonts</p>
                      <p className="mt-1 text-xs text-slate-500">Switch the reading fonts for Sanskrit and Tamil preview surfaces.</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-slate-600">Sanskrit Font</p>
                      <div className="mt-2 grid gap-2">
                        {sanskritFontOptions.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setSanskritFontPreset(option.value)}
                            className={clsx(
                              'rounded-md border px-3 py-2 text-left',
                              sanskritFontPreset === option.value
                                ? 'border-blue-300 bg-blue-50 text-blue-950'
                                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                            )}
                          >
                            <span className="block text-xs font-bold uppercase">{option.label}</span>
                            <span
                              className="mt-1 block text-lg text-slate-900"
                            >
                              <ScriptText script="devanagari" text={option.sample} sanskritFontPreset={option.value} />
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-slate-600">Tamil Font</p>
                      <div className="mt-2 grid gap-2">
                        {tamilFontOptions.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setTamilFontPreset(option.value)}
                            className={clsx(
                              'rounded-md border px-3 py-2 text-left',
                              tamilFontPreset === option.value
                                ? 'border-amber-300 bg-amber-50 text-amber-950'
                                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                            )}
                          >
                            <span className="block text-xs font-bold uppercase">{option.label}</span>
                            <span
                              className="mt-1 block text-lg text-slate-900"
                            >
                              <ScriptText script="tamil" text={option.sample} tamilFontPreset={option.value} />
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
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
