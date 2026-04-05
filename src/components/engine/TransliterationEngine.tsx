'use client';

import React from 'react';
import { StickyTopComposer } from '@/components/StickyTopComposer';
import { MainDocumentArea } from '@/components/MainDocumentArea';
import { ReferenceSidePanel } from '@/components/ReferenceSidePanel'; // Import the side panel
import { ScriptText } from '@/components/ScriptText';
import { useFlowStore } from '@/store/useFlowStore';
import { BookText, Copy, Check, Eye, Menu, RefreshCw, Save, SlidersHorizontal, X } from 'lucide-react';
import { clsx } from 'clsx';
import { SessionSnapshot, SanskritFontPreset, TamilFontPreset, TypographySettings } from '@/store/types';
import { formatSourceForScript } from '@/lib/vedic/utils';
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
    setShowItransInDocument,
    exportSessionSnapshot,
    loadSessionSnapshot,
    resetSession,
  } = useFlowStore();
  const [savedSessions, setSavedSessions] = React.useState<SessionListItem[]>([]);
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
    showItransInDocument,
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
  const adjustTypographyValue = (
    scope: 'composer' | 'document',
    key: string,
    delta: number,
    min: number,
    max: number
  ) => {
    const scopeTypography = typography[scope] as unknown as Record<string, number>;
    const currentValue = Number(scopeTypography[key]);
    const nextValue = Math.max(min, Math.min(max, currentValue + delta));
    setTypography(scope, { [key]: nextValue } as Partial<TypographySettings['composer']>);
  };
  const renderTypographyControl = (
    label: string,
    scope: 'composer' | 'document',
    key: string,
    value: number,
    options: { min: number; max: number; step: number; suffix?: string }
  ) => {
    const formattedValue = typeof value === 'number' && !Number.isInteger(value) ? value.toFixed(1) : value;
    return (
      <div className="py-2.5 first:pt-0 last:pb-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-black uppercase tracking-[0.08em] text-slate-400">{label}</span>
          <span className="text-[11px] font-black tabular-nums text-blue-700 bg-blue-50/80 px-2 py-0.5 rounded-md border border-blue-100">
            {formattedValue}{options.suffix ?? 'px'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => adjustTypographyValue(scope, key, -options.step, options.min, options.max)}
            className="flex-1 h-7 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-xs font-black text-slate-600 shadow-sm hover:border-blue-200 hover:bg-slate-50 active:scale-[0.97] transition-all"
            aria-label={`Decrease ${label}`}
          >
            -
          </button>
          <button
            type="button"
            onClick={() => adjustTypographyValue(scope, key, options.step, options.min, options.max)}
            className="flex-1 h-7 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-xs font-black text-slate-600 shadow-sm hover:border-blue-200 hover:bg-slate-50 active:scale-[0.97] transition-all"
            aria-label={`Increase ${label}`}
          >
            +
          </button>
        </div>
      </div>
    );
  };

  const renderScriptSettings = <T extends SanskritFontPreset | TamilFontPreset>(
    title: string,
    script: 'devanagari' | 'tamil' | 'itrans',
    fontPreset?: T,
    fontOptions?: Array<{ value: T; label: string; sample: string }>,
    setFontPreset?: (preset: T) => void
  ) => {
    const isITRANS = script === 'itrans';
    const isTamil = script === 'tamil';
    
    // Select correct keys based on script
    const sizeKey = isITRANS ? 'itransFontSize' : isTamil ? 'tamilFontSize' : 'devanagariFontSize';
    const lhKey = isITRANS ? 'itransLineHeight' : isTamil ? 'tamilLineHeight' : 'devanagariLineHeight';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const composerSize = (typography.composer as any)[sizeKey] as number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const composerLH = (typography.composer as any)[lhKey] as number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const documentSize = (typography.document as any)[sizeKey] as number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const documentLH = (typography.document as any)[lhKey] as number;

    return (
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="mb-3">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-900 border-b border-blue-50 pb-2">{title}</p>
        </div>

        {fontOptions && setFontPreset && (
          <div className="mb-4 space-y-2">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Font Selection</p>
            <div className="flex flex-col gap-2">
              {fontOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFontPreset(option.value)}
                  className={clsx(
                    'group relative w-full rounded-lg border px-3 py-2 text-left transition-all overflow-hidden',
                    fontPreset === option.value
                      ? 'border-blue-300 bg-blue-50/50 text-blue-950 shadow-sm'
                      : 'border-slate-100 bg-slate-50/30 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  )}
                >
                  {fontPreset === option.value && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500" />
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.12em]">{option.label}</span>
                    <span className="text-[9px] font-bold uppercase text-slate-300 group-hover:text-blue-300 transition-colors">Select</span>
                  </div>
                  <div className="mt-1.5 overflow-hidden text-ellipsis whitespace-nowrap">
                    <ScriptText 
                      script={script === 'itrans' ? 'roman' : script} 
                      text={option.sample} 
                      sanskritFontPreset={script === 'devanagari' ? (option.value as SanskritFontPreset) : undefined} 
                      tamilFontPreset={script === 'tamil' ? (option.value as TamilFontPreset) : undefined} 
                      className="text-lg"
                    />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 divide-y divide-slate-100/50">
          <div className="py-2.5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-300">Composer</span>
              <div className="flex-1 h-px bg-slate-100/50" />
            </div>
            {renderTypographyControl('Size', 'composer', sizeKey, composerSize, {
              min: 14,
              max: 54,
              step: 1,
            })}
            {renderTypographyControl('Line Height', 'composer', lhKey, composerLH, {
              min: 1.0,
              max: 2.8,
              step: 0.1,
              suffix: '',
            })}
          </div>
          <div className="py-2.5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-300">Document</span>
              <div className="flex-1 h-px bg-slate-100/50" />
            </div>
            {renderTypographyControl('Size', 'document', sizeKey, documentSize, {
              min: 12,
              max: 52,
              step: 1,
            })}
            {renderTypographyControl('Line Height', 'document', lhKey, documentLH, {
              min: 1.0,
              max: 2.8,
              step: 0.1,
              suffix: '',
            })}
          </div>
        </div>
      </div>
    );
  };
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

  type CopyState = 'idle' | 'copied' | 'error';
  const [copyStates, setCopyStates] = React.useState<Record<string, CopyState>>({
    devanagari: 'idle',
    tamil: 'idle',
    itrans: 'idle',
  });

  React.useEffect(() => {
    const hasFeedback = Object.values(copyStates).some((state) => state !== 'idle');
    if (!hasFeedback) return;

    const timeoutId = window.setTimeout(() => {
      setCopyStates({
        devanagari: 'idle',
        tamil: 'idle',
        itrans: 'idle',
      });
    }, 1500);

    return () => window.clearTimeout(timeoutId);
  }, [copyStates]);

  const handleCopyWholeDocument = async (script: 'devanagari' | 'tamil' | 'itrans') => {
    const meaningfulBlocks = blocks.filter(
      (block) => block.source.trim().length > 0 || block.rendered.trim().length > 0
    );

    if (meaningfulBlocks.length === 0) {
      setCopyStates((prev) => ({ ...prev, [script]: 'error' }));
      return;
    }

    let text = '';
    if (script === 'itrans') {
      text = meaningfulBlocks.map((b) => b.source).join('\n\n');
    } else {
      text = meaningfulBlocks
        .map((b) =>
          formatSourceForScript(b.source, script, {
            romanOutputStyle,
            tamilOutputStyle,
          })
        )
        .join('\n\n');
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopyStates((prev) => ({ ...prev, [script]: 'copied' }));
    } catch {
      setCopyStates((prev) => ({ ...prev, [script]: 'error' }));
    }
  };

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
            onClick={() => setViewMode('document')}
            className={clsx(
              'touch-manipulation inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600',
              viewMode === 'document' ? 'bg-blue-600 text-white' : 'hover:bg-slate-100'
            )}
            aria-label="Document mode"
            title="Document mode"
          >
            <BookText className="h-4 w-4" />
          </button>
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
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Font Resources</p>
              <p className="mt-1 text-xs text-slate-500">Download the scholarly fonts used in this application for offline use.</p>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <a
                href="https://sanskritdocuments.org/hindi/chandas/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 hover:bg-slate-50"
              >
                <span className="text-xs font-bold text-slate-700">Chandas Devanagari</span>
                <span className="text-[10px] font-black uppercase text-blue-600">Download</span>
              </a>
              <a
                href="https://sanskritdocuments.org/projects/siddhanta/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 hover:bg-slate-50"
              >
                <span className="text-xs font-bold text-slate-700">Siddhanta</span>
                <span className="text-[10px] font-black uppercase text-blue-600">Download</span>
              </a>
              <a
                href="https://fonts.google.com/specimen/Anek+Tamil"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 hover:bg-slate-50"
              >
                <span className="text-xs font-bold text-slate-700">Anek Tamil</span>
                <span className="text-[10px] font-black uppercase text-blue-600">Download</span>
              </a>
              <a
                href="https://fonts.google.com/specimen/Noto+Serif+Tamil"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 hover:bg-slate-50"
              >
                <span className="text-xs font-bold text-slate-700">Noto Serif Tamil</span>
                <span className="text-[10px] font-black uppercase text-blue-600">Download</span>
              </a>
            </div>
          </section>

          <section className="space-y-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Feedback & Issues</p>
              <p className="mt-1 text-xs text-slate-500">Report technical bugs or suggest improvements via GitHub.</p>
            </div>
            <a
              href="https://github.com/mrgkumar/sanskrit-keyboard/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-3 text-xs font-bold uppercase text-blue-700 hover:bg-blue-100"
            >
              Report Issue on GitHub
            </a>
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
                <div className="space-y-6">
                  <section className="space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Whole Document Actions</p>
                    <div className="grid grid-cols-1 gap-2">
                      <button
                        onClick={() => handleCopyWholeDocument('devanagari')}
                        className={clsx(
                          'flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5 transition-all active:scale-[0.98]',
                          copyStates.devanagari === 'copied'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : copyStates.devanagari === 'error'
                              ? 'border-rose-200 bg-rose-50 text-rose-700'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50/30'
                        )}
                        type="button"
                      >
                        <div className="flex items-center gap-3">
                          <Copy className="h-3.5 w-3.5 opacity-60" />
                          <span className="text-[11px] font-bold uppercase tracking-wider">Copy Devanagari</span>
                        </div>
                        {copyStates.devanagari === 'copied' && <Check className="h-3.5 w-3.5" />}
                      </button>

                      <button
                        onClick={() => handleCopyWholeDocument('itrans')}
                        className={clsx(
                          'flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5 transition-all active:scale-[0.98]',
                          copyStates.itrans === 'copied'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : copyStates.itrans === 'error'
                              ? 'border-rose-200 bg-rose-50 text-rose-700'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50/30'
                        )}
                        type="button"
                      >
                        <div className="flex items-center gap-3">
                          <Copy className="h-3.5 w-3.5 opacity-60" />
                          <span className="text-[11px] font-bold uppercase tracking-wider">Copy ITRANS</span>
                        </div>
                        {copyStates.itrans === 'copied' && <Check className="h-3.5 w-3.5" />}
                      </button>

                      <button
                        onClick={() => handleCopyWholeDocument('tamil')}
                        className={clsx(
                          'flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5 transition-all active:scale-[0.98]',
                          copyStates.tamil === 'copied'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : copyStates.tamil === 'error'
                              ? 'border-rose-200 bg-rose-50 text-rose-700'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50/30'
                        )}
                        type="button"
                      >
                        <div className="flex items-center gap-3">
                          <Copy className="h-3.5 w-3.5 opacity-60" />
                          <span className="text-[11px] font-bold uppercase tracking-wider">Copy Tamil</span>
                        </div>
                        {copyStates.tamil === 'copied' && <Check className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </section>

                  <section className="space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Workspace & Prediction</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-3">
                        <div className="rounded-xl border border-slate-200 bg-white p-3">
                           <p className="mb-2 text-[10px] font-bold uppercase text-slate-400">Layout</p>
                           <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => setComposerLayout('side-by-side')}
                                className={clsx(
                                  'flex-1 rounded-md border px-2 py-1.5 text-[10px] font-bold uppercase',
                                  composerLayout === 'side-by-side' ? 'border-blue-300 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-700'
                                )}
                              >
                                Side by Side
                              </button>
                              <button
                                type="button"
                                onClick={() => setComposerLayout('stacked')}
                                className={clsx(
                                  'flex-1 rounded-md border px-2 py-1.5 text-[10px] font-bold uppercase',
                                  composerLayout === 'stacked' ? 'border-blue-300 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-700'
                                )}
                              >
                                Stacked
                              </button>
                           </div>
                        </div>
                        <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3">
                          <input
                            checked={syncComposerScroll}
                            onChange={(e) => setSyncComposerScroll(e.target.checked)}
                            type="checkbox"
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-[10px] font-bold uppercase text-slate-700">Sync Scroll</span>
                        </label>
                        <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3">
                          <input
                            checked={showItransInDocument}
                            onChange={(e) => setShowItransInDocument(e.target.checked)}
                            type="checkbox"
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-[10px] font-bold uppercase text-slate-700">Show ITRANS in Document</span>
                        </label>
                      </div>

                      <div className="space-y-3">
                        <div className="rounded-xl border border-slate-200 bg-white p-3">
                           <p className="mb-2 text-[10px] font-bold uppercase text-slate-400">Prediction</p>
                           <div className="grid grid-cols-2 gap-2">
                              {(['inline', 'split', 'footer', 'listbox'] as const).map(layout => (
                                 <button
                                   key={layout}
                                   type="button"
                                   onClick={() => setPredictionLayout(layout)}
                                   className={clsx(
                                     'rounded-md border px-1 py-1 text-[9px] font-bold uppercase',
                                     predictionLayout === layout ? 'border-emerald-300 bg-emerald-600 text-white' : 'border-slate-200 bg-white text-slate-700'
                                   )}
                                 >
                                   {layout}
                                 </button>
                              ))}
                           </div>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white p-3">
                           <p className="mb-2 text-[10px] font-bold uppercase text-slate-400">Popup Timeout</p>
                           <input
                              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                              type="range"
                              min="3"
                              max="20"
                              step="1"
                              value={Math.round(predictionPopupTimeoutMs / 1000)}
                              onChange={(e) => setPredictionPopupTimeoutMs(Number(e.target.value) * 1000)}
                            />
                            <div className="mt-1 flex justify-between text-[9px] font-bold text-slate-400">
                              <span>3s</span>
                              <span>{Math.round(predictionPopupTimeoutMs / 1000)}s</span>
                              <span>20s</span>
                            </div>
                        </div>
                      </div>
                    </div>
                  </section>

                  {renderScriptSettings('Sanskrit (Devanagari)', 'devanagari', sanskritFontPreset, sanskritFontOptions, setSanskritFontPreset)}
                  {renderScriptSettings('Tamil', 'tamil', tamilFontPreset, tamilFontOptions, setTamilFontPreset)}
                  {renderScriptSettings('ITRANS', 'itrans')}
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
