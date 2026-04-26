'use client';

import React from 'react';
import { StickyTopComposer } from '@/components/StickyTopComposer';
import { MainDocumentArea } from '@/components/MainDocumentArea';
import { ReferenceSidePanel } from '@/components/ReferenceSidePanel';
import { ScriptText } from '@/components/ScriptText';
import { useFlowStore, getSessionStorageKey } from '@/store/useFlowStore';
import {
  BookText,
  Copy,
  Check,
  Edit2,
  Eye,
  Menu,
  RefreshCw,
  Save,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
  History,
  Zap,
  Info,
  Download,
  Upload,
  Wrench
} from 'lucide-react';
import { clsx } from 'clsx';
import { SessionSnapshot, SanskritFontPreset, TamilFontPreset, TypographySettings, SessionListItem } from '@/store/types';
import { formatSourceForScript } from '@/lib/vedic/utils';
import { BUILD_VERSION, BUILD_TIME } from '@/lib/version';
import {
  createSessionTransferFilename,
  createSessionTransferPayload,
  parseSessionTransferPayload,
  serializeSessionTransferPayload,
  type PersistedLexicalLearningSnapshot,
} from '@/lib/sessionTransfer';
import {
  OUTPUT_TARGET_CONTROL_LABELS,
  OUTPUT_TARGET_VALUE_LABELS,
} from '@/lib/vedic/mapping';
import { TamilPrecisionRecovery } from './TamilPrecisionRecovery';
import { LargeDocumentOperationOverlay } from './LargeDocumentOperationOverlay';

const LEGACY_STORAGE_KEY = 'sanskrit-keyboard.sessions.v1';
const LEXICAL_HISTORY_KEY = 'sanskrit-keyboard.lexical-history.v1';
const LEGACY_AUTOLOAD_BYTES_LIMIT = 1_000_000;

const migrateLegacySessionsIfNeeded = () => {
  if (window.localStorage.getItem('sanskrit-keyboard.session-index.v2')) {
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
    const nextIndex: SessionListItem[] = parsed.map((snapshot) => ({
      sessionId: snapshot.sessionId,
      sessionName: snapshot.sessionName,
      updatedAt: snapshot.updatedAt,
    }));
    
    window.localStorage.setItem('sanskrit-keyboard.session-index.v2', JSON.stringify(nextIndex));

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
    annotations,
    editorState,
    displaySettings,
    sessionId,
    sessionName,
    savedSessions,
    sessionSearchQuery,
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
    setSessionSearchQuery,
    setSavedSessions,
    loadSessionSnapshot,
    deleteSession,
    renameSession,
    setSwaraPredictionEnabled,
    exportSessionSnapshot,
    markSessionSaved,
    hydratePersistedLexicalLearning,
    clearSessionLexicalLearning,
    clearPersistedLexicalLearning,
    setShowItransInDocument,
    setAutoSwapVisargaSvarita,
    restoreSessionAsync,
    largeDocumentOperation,
    resetSession,
    setImmersiveFindOpen,
  } = useFlowStore();
  
  const [isWorkspacePanelOpen, setIsWorkspacePanelOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<'sessions' | 'display' | 'intelligence' | 'utility' | 'info'>('sessions');
  const [editingSessionId, setEditingSessionId] = React.useState<string | null>(null);
  const [editingName, setEditingName] = React.useState('');
  const [transferStatus, setTransferStatus] = React.useState<string | null>(null);
  const [transferError, setTransferError] = React.useState<string | null>(null);
  const hasLoadedSessions = React.useRef(true); // Disable auto-load here
  const hasLoadedLexicalLearning = React.useRef(false);
  const importInputRef = React.useRef<HTMLInputElement | null>(null);
  
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
    autoSwapVisargaSvarita,
  } = displaySettings;
  const documentTypography = typography.document;
  const immersiveTypography = typography.immersive;

  const sanskritFontOptions: Array<{ value: SanskritFontPreset; label: string; sample: string }> = [
    { value: 'noto-sans', label: 'Noto Sans Devanagari', sample: 'श्रीसूक्तम्' },
    { value: 'chandas', label: 'Chandas', sample: 'नमस्ते रुद्राय' },
    { value: 'sampradaya', label: 'Sampradaya', sample: 'नमस्ते रुद्राय' },
    { value: 'sanskrit2003', label: 'Sanskrit 2003', sample: 'नमस्ते रुद्राय' },
    { value: 'siddhanta', label: 'Siddhanta', sample: 'नमस्ते रुद्राय' },
  ];
  const devanagariFontDownloads = [
    { name: 'Noto Sans Devanagari', url: 'https://fonts.google.com/noto/specimen/Noto+Sans+Devanagari' },
    { name: 'Chandas Devanagari', url: 'https://sanskritdocuments.org/hindi/chandas/' },
    { name: 'Sanskrit 2003', url: 'https://salrc.uchicago.edu/resources/fonts/available/sanskrit/sanskrit2003.shtml' },
    { name: 'Siddhanta', url: 'https://sanskritdocuments.org/projects/siddhanta/' },
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
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-900 border-b border-blue-50 pb-2">{title}</p>
        </div>

        {fontOptions && setFontPreset && (
          <div className="mb-6 space-y-2">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Font Selection</p>
            <div className="flex flex-col gap-2">
              {fontOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFontPreset(option.value)}
                  className={clsx(
                    'group relative w-full rounded-xl border px-3 py-3 text-left transition-all overflow-hidden',
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
                      className="text-lg font-medium"
                    />
                  </div>
                </button>
              ))}
            </div>
            {script === 'devanagari' && (
              <div className="mt-3 flex flex-wrap gap-2">
                {devanagariFontDownloads.map((font) => (
                  <a
                    key={font.name}
                    href={font.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                  >
                    {font.name}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 divide-y divide-slate-100/50">
          <div className="py-2.5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-300">Composer Tuning</span>
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
              <span className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-300">Document Tuning</span>
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

  const getImmersiveTypographyKey = (key: 'fontSize' | 'lineHeight') =>
    primaryOutputScript === 'tamil'
      ? key === 'fontSize'
        ? 'tamilFontSize'
        : 'tamilLineHeight'
      : key === 'fontSize'
        ? 'devanagariFontSize'
        : 'devanagariLineHeight';

  const getImmersiveTypographyValue = (key: 'fontSize' | 'lineHeight') => {
    const resolvedKey = getImmersiveTypographyKey(key);
    return immersiveTypography[resolvedKey];
  };

  const adjustImmersiveTypographyValue = (
    key: 'fontSize' | 'lineHeight',
    delta: number,
    min: number,
    max: number,
    step: number = 1
  ) => {
    const resolvedKey = getImmersiveTypographyKey(key);
    const currentValue = Number(immersiveTypography[resolvedKey]);
    const nextValue = Math.max(min, Math.min(max, currentValue + delta * step));
    setTypography('immersive', { [resolvedKey]: nextValue } as Partial<typeof immersiveTypography>);
  };

  const { viewMode } = editorState;
  const hasMeaningfulContent = React.useMemo(
    () => blocks.some((block) => block.source.trim().length > 0 || block.rendered.trim().length > 0),
    [blocks]
  );

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
          }, {
            sanskritFontPreset,
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
    if (typeof window !== 'undefined' && typography.composer.itransPanelHeight === 168) {
      const dynamicHeight = Math.round(window.innerHeight * 0.33);
      const boundedHeight = Math.max(140, Math.min(500, dynamicHeight));
      
      setTypography('composer', {
        itransPanelHeight: boundedHeight
      } as Partial<TypographySettings['composer']>);
    }
  }, [setTypography, typography.composer.itransPanelHeight]);

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
    if (migrationResult) {
      setSavedSessions(migrationResult.sessions);
    }

    const currentSavedSessions = useFlowStore.getState().savedSessions;
    const latestSession = currentSavedSessions[0];
    if (latestSession && !hasLoadedSessions.current) {
      hasLoadedSessions.current = true;
      void restoreSessionAsync(latestSession.sessionId);
    }

    hasLoadedSessions.current = true;
  }, [restoreSessionAsync, setSavedSessions]);

  React.useEffect(() => {
    if (!hasLoadedSessions.current || largeDocumentOperation) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      markSessionSaved();
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [annotations, blocks, displaySettings, editorState, largeDocumentOperation, sessionId, sessionName, markSessionSaved]);

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
    markSessionSaved();
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

  const handleExportCurrentSession = () => {
    const sessionSnapshot = exportSessionSnapshot();
    const lexicalLearning: PersistedLexicalLearningSnapshot = {
      version: 1,
      swaraPredictionEnabled,
      userLexicalUsage,
      userExactFormUsage,
    };
    const payload = createSessionTransferPayload(sessionSnapshot, lexicalLearning, BUILD_VERSION);
    const blob = new Blob([serializeSessionTransferPayload(payload)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = createSessionTransferFilename(sessionSnapshot.sessionName, sessionSnapshot.sessionId);
    anchor.rel = 'noreferrer';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    globalThis.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setTransferError(null);
    setTransferStatus(`Exported ${sessionSnapshot.sessionName || 'current session'}.`);
  };

  const handleImportButtonClick = () => {
    importInputRef.current?.click();
  };

  const handleImportSessionFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    setTransferError(null);
    setTransferStatus(null);

    try {
      const raw = await file.text();
      const parsed = parseSessionTransferPayload(raw);

      if (!window.confirm(`Import "${parsed.session.sessionName}" and replace the current workspace?`)) {
        return;
      }

      if (parsed.lexicalLearning) {
        hydratePersistedLexicalLearning(parsed.lexicalLearning);
        window.localStorage.setItem(LEXICAL_HISTORY_KEY, JSON.stringify(parsed.lexicalLearning));
      }

      loadSessionSnapshot(parsed.session);
      markSessionSaved(parsed.session.updatedAt);
      setIsWorkspacePanelOpen(false);
      setTransferStatus(`Imported ${parsed.session.sessionName}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to import the selected file.';
      setTransferError(message);
    }
  };

  return (
    <div className={clsx(
      "flex min-h-0 flex-1 flex-col bg-slate-50 font-sans relative h-dvh max-h-dvh overflow-hidden"
    )}>
      <div className="fixed left-4 top-4 z-[160] flex items-center gap-2 pointer-events-none">
        <button
          data-testid="workspace-toggle"
          type="button"
          onClick={() => setIsWorkspacePanelOpen((open) => !open)}
          className="pointer-events-auto touch-manipulation inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-xs font-bold uppercase text-slate-700 shadow-sm backdrop-blur hover:bg-white transition-all active:scale-95"
        >
          {isWorkspacePanelOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          Workspace
        </button>
        {viewMode === 'immersive' && (
          <button
            type="button"
            onClick={() => setImmersiveFindOpen(true)}
            className="pointer-events-auto touch-manipulation inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-xs font-bold uppercase text-slate-700 shadow-sm backdrop-blur hover:bg-white transition-all active:scale-95"
            aria-label="Find in immersive view"
            title="Find in immersive view"
          >
            <Search className="h-4 w-4" />
            Find
          </button>
        )}
        <div className="pointer-events-auto inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white/95 p-1 shadow-sm backdrop-blur">
          <button
            type="button"
            onClick={() => setViewMode('document')}
            className={clsx(
              'touch-manipulation inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition-all',
              viewMode === 'document' ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'hover:bg-slate-100'
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
              'touch-manipulation inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition-all',
              viewMode === 'read' ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'hover:bg-slate-100'
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
              'touch-manipulation inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition-all',
              viewMode === 'immersive' ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'hover:bg-slate-100'
            )}
            aria-label="Immersive mode"
            title="Immersive mode"
          >
            <BookText className="h-4 w-4" />
          </button>
        </div>
        {viewMode === 'immersive' && (
          <div className="pointer-events-auto inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white/90 px-2 py-1 shadow-sm backdrop-blur">
            <span className="mr-1 text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">Immersive</span>
            <button
              type="button"
              onClick={() => adjustImmersiveTypographyValue('fontSize', -1, 18, 60)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-100"
              aria-label="Decrease immersive font size"
              title="Decrease immersive font size"
            >
              -
            </button>
            <button
              type="button"
              onClick={() => adjustImmersiveTypographyValue('fontSize', 1, 18, 60)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-100"
              aria-label="Increase immersive font size"
              title="Increase immersive font size"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => adjustImmersiveTypographyValue('lineHeight', -1, 1.2, 3, 0.1)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-100"
              aria-label="Decrease immersive line spacing"
              title="Decrease immersive line spacing"
            >
              -
            </button>
            <button
              type="button"
              onClick={() => adjustImmersiveTypographyValue('lineHeight', 1, 1.2, 3, 0.1)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-100"
              aria-label="Increase immersive line spacing"
              title="Increase immersive line spacing"
            >
              +
            </button>
          </div>
        )}
      </div>

      <div
        data-testid="workspace-panel"
        className={clsx(
          'fixed left-0 top-0 flex h-full w-[32rem] max-w-[90vw] overflow-hidden border-r border-slate-200 bg-white shadow-2xl transition-transform duration-500 ease-in-out',
          viewMode === 'immersive' ? 'z-[150]' : 'z-[75]',
          isWorkspacePanelOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Sidebar Tabs */}
        <aside className="w-16 bg-slate-900 flex flex-col items-center py-8 gap-6 border-r border-slate-800 shrink-0">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black text-xl mb-4 shadow-lg shadow-blue-900/20">S</div>
          
          <button 
            onClick={() => setActiveTab('sessions')}
            data-testid="workspace-tab-sessions"
            className={clsx(
              "p-3 rounded-xl transition-all duration-300",
              activeTab === 'sessions' ? "bg-white/10 text-white shadow-inner" : "text-slate-500 hover:text-slate-300"
            )}
            title="Sessions"
          >
            <History className="w-5 h-5" />
          </button>

          <button 
            onClick={() => setActiveTab('display')}
            data-testid="workspace-tab-display"
            className={clsx(
              "p-3 rounded-xl transition-all duration-300",
              activeTab === 'display' ? "bg-white/10 text-white shadow-inner" : "text-slate-500 hover:text-slate-300"
            )}
            title="Display & Scripts"
          >
            <SlidersHorizontal className="w-5 h-5" />
          </button>

          <button 
            onClick={() => setActiveTab('intelligence')}
            data-testid="workspace-tab-intelligence"
            className={clsx(
              "p-3 rounded-xl transition-all duration-300",
              activeTab === 'intelligence' ? "bg-white/10 text-white shadow-inner" : "text-slate-500 hover:text-slate-300"
            )}
            title="Intelligence"
          >
            <Zap className="w-5 h-5" />
          </button>

          <button 
            onClick={() => setActiveTab('utility')}
            data-testid="workspace-tab-utility"
            className={clsx(
              "p-3 rounded-xl transition-all duration-300",
              activeTab === 'utility' ? "bg-white/10 text-white shadow-inner" : "text-slate-500 hover:text-slate-300"
            )}
            title="Utilities"
          >
            <Wrench className="w-5 h-5" />
          </button>

          <div className="flex-1" />

          <button 
            onClick={() => setActiveTab('info')}
            className={clsx(
              "p-3 rounded-xl transition-all duration-300",
              activeTab === 'info' ? "bg-white/10 text-white shadow-inner" : "text-slate-500 hover:text-slate-300"
            )}
            title="Resources & Info"
          >
            <Info className="w-5 h-5" />
          </button>
        </aside>

        {/* Tab Content Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-white">
          <header className="flex items-center justify-between px-8 py-6 border-b border-slate-100 shrink-0">
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                {activeTab === 'sessions' && 'Workspaces'}
                {activeTab === 'display' && 'Display & Scripts'}
                {activeTab === 'intelligence' && 'Intelligence'}
                {activeTab === 'utility' && 'Utilities'}
                {activeTab === 'info' && 'Resources'}
              </h2>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mt-1">
                {activeTab === 'sessions' && 'Manage your scholarly sessions'}
                {activeTab === 'display' && 'Configure rendering and typography'}
                {activeTab === 'intelligence' && 'Lexical learning and predictions'}
                {activeTab === 'utility' && 'Scholarly precision tools'}
                {activeTab === 'info' && 'Version and scholarly resources'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsWorkspacePanelOpen(false)}
              className="w-10 h-10 rounded-full border border-slate-100 flex items-center justify-center text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </header>

          <main className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar bg-slate-50/30">
            
            {/* SESSIONS TAB */}
            {activeTab === 'sessions' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Current Session</p>
                    <span className="text-[10px] font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">Active</span>
                  </div>
                  <input
                    value={sessionName}
                    onChange={(e) => setSessionName(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none shadow-sm"
                    placeholder="Active session name..."
                  />
                </section>

                <section className="space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Library</p>
                  
                  <div className="relative group">
                    <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                    <input
                      value={sessionSearchQuery}
                      onChange={(e) => setSessionSearchQuery(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 py-3 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none shadow-sm"
                      placeholder="Search saved work..."
                    />
                  </div>

                  <div className="space-y-2 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                    {savedSessions
                      .filter(s => s.sessionName.toLowerCase().includes(sessionSearchQuery.toLowerCase()))
                      .map((session) => (
                      <div 
                        key={session.sessionId}
                        className={clsx(
                          "group relative flex flex-col gap-1 rounded-2xl border p-4 transition-all duration-300",
                          sessionId === session.sessionId 
                            ? "border-blue-200 bg-blue-50/50 ring-1 ring-blue-100" 
                            : "border-slate-100 bg-white hover:border-blue-200 hover:shadow-md"
                        )}
                      >
                        <div className="flex items-start justify-between gap-4">
                          {editingSessionId === session.sessionId ? (
                            <form 
                              onSubmit={(e) => {
                                e.preventDefault();
                                renameSession(session.sessionId, editingName);
                                setEditingSessionId(null);
                              }}
                              className="flex-1"
                            >
                              <input
                                autoFocus
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                onBlur={() => {
                                  renameSession(session.sessionId, editingName);
                                  setEditingSessionId(null);
                                }}
                                className="w-full rounded-lg border border-blue-300 px-2 py-1 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100"
                              />
                            </form>
                          ) : (
                            <div className="flex-1 min-w-0">
                              <button
                                onClick={() => {
                                  void restoreSessionAsync(session.sessionId).then((restored) => {
                                    if (restored) {
                                      setIsWorkspacePanelOpen(false);
                                    }
                                  });
                                }}
                                disabled={Boolean(largeDocumentOperation)}
                                className="w-full text-left"
                              >
                                <p className="truncate text-sm font-bold text-slate-800 group-hover:text-blue-700 transition-colors">
                                  {session.sessionName}
                                </p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mt-1">
                                  {new Date(session.updatedAt).toLocaleDateString()} • {new Date(session.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </button>
                            </div>
                          )}

                          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <button
                              onClick={() => {
                                setEditingSessionId(session.sessionId);
                                setEditingName(session.sessionName);
                              }}
                              className="rounded-lg p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                              title="Rename"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Delete "${session.sessionName}" permanently?`)) {
                                  deleteSession(session.sessionId);
                                }
                              }}
                              className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {savedSessions.length === 0 && (
                      <div className="py-12 text-center space-y-2 bg-white rounded-3xl border border-slate-100">
                        <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-200">
                          <History className="w-6 h-6" />
                        </div>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">No Library Entries</p>
                      </div>
                    )}
                  </div>
                </section>

                <div className="grid grid-cols-2 gap-4 pt-4">
                  <button
                    onClick={handleSaveNow}
                    className="flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-4 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all active:scale-[0.97]"
                    type="button"
                  >
                    <Save className="h-4 w-4" />
                    Save Now
                  </button>
                  <button
                    onClick={handleResetSession}
                    className="flex items-center justify-center gap-2 rounded-2xl border-2 border-slate-100 bg-white px-4 py-4 text-xs font-black uppercase tracking-widest text-slate-700 hover:bg-slate-50 hover:border-slate-200 transition-all active:scale-[0.97]"
                    type="button"
                  >
                    <RefreshCw className="h-4 w-4" />
                    New Blank
                  </button>
                </div>

                <section className="space-y-4 pt-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Session Portability</p>
                  <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm space-y-3">
                    <p className="text-[11px] leading-relaxed text-slate-500">
                      Export the current session and its learning state as a versioned JSON file, then import it on another computer to continue working.
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <button
                        onClick={handleExportCurrentSession}
                        className="flex items-center justify-center gap-2 rounded-2xl border-2 border-blue-100 bg-blue-50 px-4 py-4 text-xs font-black uppercase tracking-widest text-blue-700 hover:bg-blue-100 transition-all active:scale-[0.97]"
                        type="button"
                      >
                        <Download className="h-4 w-4" />
                        Export Session
                      </button>
                      <button
                        onClick={handleImportButtonClick}
                        className="flex items-center justify-center gap-2 rounded-2xl border-2 border-slate-100 bg-white px-4 py-4 text-xs font-black uppercase tracking-widest text-slate-700 hover:bg-slate-50 transition-all active:scale-[0.97]"
                        type="button"
                      >
                        <Upload className="h-4 w-4" />
                        Import Session
                      </button>
                    </div>
                    <input
                      ref={importInputRef}
                      data-testid="session-import-input"
                      accept=".json,application/json"
                      className="sr-only"
                      type="file"
                      onChange={handleImportSessionFile}
                    />
                    <div className="space-y-2">
                      {transferStatus && (
                        <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-[11px] font-bold text-emerald-700">
                          {transferStatus}
                        </p>
                      )}
                      {transferError && (
                        <p className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-700">
                          {transferError}
                        </p>
                      )}
                    </div>
                  </div>
                </section>
              </div>
            )}

            {/* DISPLAY TAB */}
            {activeTab === 'display' && (
              <div className="space-y-10 pb-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <section className="space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Input Scheme</p>
                  <div className="grid grid-cols-1 gap-3">
                    <button
                      type="button"
                      onClick={() => setInputScheme('canonical-vedic')}
                      className={clsx(
                        'rounded-2xl border-2 p-4 text-left transition-all duration-300',
                        inputScheme === 'canonical-vedic'
                          ? 'border-blue-500 bg-blue-50/50 text-blue-900 shadow-md ring-4 ring-blue-500/5'
                          : 'border-slate-100 bg-white text-slate-600 hover:border-slate-300 shadow-sm'
                      )}
                    >
                      <span className="block text-xs font-black uppercase tracking-wider">Canonical Vedic</span>
                      <span className="mt-1 block text-[11px] leading-relaxed opacity-70">Strict scholarly transliteration. Default mode.</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setInputScheme('baraha-compatible')}
                      className={clsx(
                        'rounded-2xl border-2 p-4 text-left transition-all duration-300',
                        inputScheme === 'baraha-compatible'
                          ? 'border-blue-500 bg-blue-50/50 text-blue-900 shadow-md ring-4 ring-blue-500/5'
                          : 'border-slate-100 bg-white text-slate-600 hover:border-slate-300 shadow-sm'
                      )}
                    >
                      <span className="block text-xs font-black uppercase tracking-wider">Baraha Compatible</span>
                      <span className="mt-1 block text-[11px] leading-relaxed opacity-70">Enables legacy aliases (e.g., `c` for `ch`).</span>
                    </button>
                  </div>
                </section>

                <section className="space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Primary Script</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setPrimaryOutputScript('devanagari')}
                      className={clsx(
                        'rounded-2xl border-2 px-4 py-4 text-center transition-all shadow-sm',
                        primaryOutputScript === 'devanagari'
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-900 shadow-md'
                          : 'border-slate-100 bg-white text-slate-600 hover:border-slate-300'
                      )}
                    >
                      <span className="block text-xs font-black uppercase tracking-widest">Devanagari</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPrimaryOutputScript('tamil')}
                      className={clsx(
                        'rounded-2xl border-2 px-4 py-4 text-center transition-all shadow-sm',
                        primaryOutputScript === 'tamil'
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-900 shadow-md'
                          : 'border-slate-100 bg-white text-slate-600 hover:border-slate-300'
                      )}
                    >
                      <span className="block text-xs font-black uppercase tracking-widest">Tamil</span>
                    </button>
                  </div>
                </section>

                <section className="space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Comparison Output</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(['off', 'roman', 'devanagari', 'tamil'] as const).map((script) => (
                      <button
                        key={script}
                        type="button"
                        onClick={() => setComparisonOutputScript(script)}
                        className={clsx(
                          'rounded-xl border px-3 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all shadow-sm',
                          comparisonOutputScript === script
                            ? 'border-blue-400 bg-blue-600 text-white shadow-md'
                            : 'border-slate-100 bg-white text-slate-500 hover:border-slate-200'
                        )}
                      >
                        {OUTPUT_TARGET_VALUE_LABELS[script]}
                      </button>
                    ))}
                  </div>
                </section>

                <section className="space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Typography Tuning</p>
                  <div className="space-y-4">
                    {renderScriptSettings('Sanskrit (Devanagari)', 'devanagari', sanskritFontPreset, sanskritFontOptions, setSanskritFontPreset)}
                    {renderScriptSettings('Tamil', 'tamil', tamilFontPreset, tamilFontOptions, setTamilFontPreset)}
                    {renderScriptSettings('ITRANS', 'itrans')}
                  </div>
                </section>

                <section className="space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Immersive Mode</p>
                  <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-[0.08em] text-slate-400">Font Size</span>
                          <span className="rounded-md border border-blue-100 bg-blue-50/80 px-2 py-0.5 text-[11px] font-black tabular-nums text-blue-700">
                            {(viewMode === 'immersive'
                              ? getImmersiveTypographyValue('fontSize')
                              : documentTypography.devanagariFontSize)}px
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => adjustImmersiveTypographyValue('fontSize', -1, 18, 56)}
                            className="flex-1 rounded-lg border border-slate-200 bg-white py-2 text-xs font-black text-slate-600 shadow-sm hover:border-blue-200 hover:bg-slate-50"
                            aria-label="Decrease immersive font size"
                          >
                            -
                          </button>
                          <button
                            type="button"
                            onClick={() => adjustImmersiveTypographyValue('fontSize', 1, 18, 56)}
                            className="flex-1 rounded-lg border border-slate-200 bg-white py-2 text-xs font-black text-slate-600 shadow-sm hover:border-blue-200 hover:bg-slate-50"
                            aria-label="Increase immersive font size"
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-[0.08em] text-slate-400">Line Spacing</span>
                          <span className="rounded-md border border-blue-100 bg-blue-50/80 px-2 py-0.5 text-[11px] font-black tabular-nums text-blue-700">
                            {viewMode === 'immersive'
                              ? getImmersiveTypographyValue('lineHeight').toFixed(1)
                              : documentTypography.devanagariLineHeight.toFixed(1)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => adjustImmersiveTypographyValue('lineHeight', -1, 1.2, 2.8, 0.1)}
                            className="flex-1 rounded-lg border border-slate-200 bg-white py-2 text-xs font-black text-slate-600 shadow-sm hover:border-blue-200 hover:bg-slate-50"
                            aria-label="Decrease immersive line spacing"
                          >
                            -
                          </button>
                          <button
                            type="button"
                            onClick={() => adjustImmersiveTypographyValue('lineHeight', 1, 1.2, 2.8, 0.1)}
                            className="flex-1 rounded-lg border border-slate-200 bg-white py-2 text-xs font-black text-slate-600 shadow-sm hover:border-blue-200 hover:bg-slate-50"
                            aria-label="Increase immersive line spacing"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                {(primaryOutputScript === 'roman' || comparisonOutputScript === 'roman') && (
                  <section className="space-y-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      {OUTPUT_TARGET_CONTROL_LABELS.romanStyle}
                    </p>
                    <div className="grid grid-cols-1 gap-2">
                      <button
                        type="button"
                        onClick={() => setRomanOutputStyle('canonical')}
                        className={clsx(
                          'rounded-xl border-2 px-4 py-3 text-left transition-all',
                          romanOutputStyle === 'canonical'
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-900 shadow-md'
                            : 'border-slate-100 bg-white text-slate-700 hover:border-slate-200'
                        )}
                      >
                        <span className="block text-xs font-black uppercase tracking-wider">{OUTPUT_TARGET_VALUE_LABELS.canonical}</span>
                        <span className="mt-1 block text-[10px] opacity-70">Scholarly Vedic Roman output.</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setRomanOutputStyle('baraha')}
                        className={clsx(
                          'rounded-xl border-2 px-4 py-3 text-left transition-all',
                          romanOutputStyle === 'baraha'
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-900 shadow-md'
                            : 'border-slate-100 bg-white text-slate-700 hover:border-slate-200'
                        )}
                      >
                        <span className="block text-xs font-black uppercase tracking-wider">{OUTPUT_TARGET_VALUE_LABELS.baraha}</span>
                        <span className="mt-1 block text-[10px] opacity-70">Legacy Baraha-compatible Roman.</span>
                      </button>
                    </div>
                  </section>
                )}

                <section className="space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Document Actions</p>
                  <div className="grid grid-cols-1 gap-3">
                    <button
                      onClick={() => handleCopyWholeDocument('devanagari')}
                      className={clsx(
                        'flex items-center justify-between gap-3 rounded-2xl border-2 px-5 py-4 transition-all active:scale-[0.98] shadow-sm',
                        copyStates.devanagari === 'copied'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-slate-100 bg-white text-slate-700 hover:border-blue-200'
                      )}
                      type="button"
                    >
                      <span className="text-[11px] font-black uppercase tracking-widest">Copy Whole Devanagari</span>
                      {copyStates.devanagari === 'copied' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4 opacity-40" />}
                    </button>
                    <button
                      onClick={() => handleCopyWholeDocument('itrans')}
                      className={clsx(
                        'flex items-center justify-between gap-3 rounded-2xl border-2 px-5 py-4 transition-all active:scale-[0.98] shadow-sm',
                        copyStates.itrans === 'copied'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-slate-100 bg-white text-slate-700 hover:border-blue-200'
                      )}
                      type="button"
                    >
                      <span className="text-[11px] font-black uppercase tracking-widest">Copy Whole ITRANS</span>
                      {copyStates.itrans === 'copied' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4 opacity-40" />}
                    </button>
                  </div>
                </section>
              </div>
            )}

            {/* INTELLIGENCE TAB */}
            {activeTab === 'intelligence' && (
              <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <section className="space-y-6">
                  <div className="p-8 bg-white rounded-[3rem] border border-slate-100 shadow-sm">
                    <div className="flex items-start gap-5">
                      <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center shrink-0 shadow-sm border border-emerald-100">
                        <Zap className="w-7 h-7 text-emerald-600" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-base font-black uppercase tracking-widest text-slate-900">Learning Engine</h3>
                        <p className="text-xs text-slate-500 leading-relaxed font-medium">
                          The engine automatically surfaces Vedic accented forms based on corpus patterns and your history.
                        </p>
                      </div>
                    </div>
                    
                    <div className="mt-8 pt-6 border-t border-slate-50">
                      <label className="flex items-center justify-between cursor-pointer group p-2 hover:bg-slate-50 rounded-xl transition-colors">
                        <span className="text-xs font-black uppercase tracking-widest text-slate-700 group-hover:text-blue-600 transition-colors">Adaptive Prediction</span>
                        <div className="relative">
                          <input
                            checked={swaraPredictionEnabled}
                            onChange={(e) => setSwaraPredictionEnabled(e.target.checked)}
                            type="checkbox"
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    <button
                      onClick={handleClearSessionLearning}
                      className="flex items-center justify-center gap-2 rounded-2xl border-2 border-slate-100 bg-white px-4 py-4 text-xs font-black uppercase tracking-widest text-slate-700 hover:bg-slate-50 transition-all active:scale-[0.97]"
                      type="button"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Reset Session Learning
                    </button>
                    <button
                      onClick={handlePurgeSavedLearning}
                      className="flex items-center justify-center gap-2 rounded-2xl border-2 border-rose-50 bg-rose-50/50 px-4 py-4 text-xs font-black uppercase tracking-widest text-rose-700 hover:bg-rose-100 transition-all active:scale-[0.97]"
                      type="button"
                    >
                      <Trash2 className="h-4 w-4" />
                      Purge Global History
                    </button>
                  </div>
                </section>

                <section className="space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Workspace & Sync</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm space-y-3">
                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Layout</p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setComposerLayout('side-by-side')}
                          className={clsx(
                            'flex-1 rounded-xl border px-2 py-2 text-[10px] font-black uppercase transition-all',
                            composerLayout === 'side-by-side' ? 'border-blue-500 bg-blue-600 text-white shadow-md' : 'border-slate-100 bg-slate-50 text-slate-600 hover:bg-white'
                          )}
                        >
                          Side by Side
                        </button>
                        <button
                          type="button"
                          onClick={() => setComposerLayout('stacked')}
                          className={clsx(
                            'flex-1 rounded-xl border px-2 py-2 text-[10px] font-black uppercase transition-all',
                            composerLayout === 'stacked' ? 'border-blue-500 bg-blue-600 text-white shadow-md' : 'border-slate-100 bg-slate-50 text-slate-600 hover:bg-white'
                          )}
                        >
                          Stacked
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      {[
                        { label: 'Sync Scroll', checked: syncComposerScroll, onChange: setSyncComposerScroll },
                        { label: 'Show ITRANS in Doc', checked: showItransInDocument, onChange: setShowItransInDocument },
                        { label: 'Auto-Swap Markers', checked: autoSwapVisargaSvarita, onChange: setAutoSwapVisargaSvarita }
                      ].map(toggle => (
                        <label key={toggle.label} className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100 shadow-sm cursor-pointer hover:bg-slate-50 transition-colors">
                          <span className="text-[10px] font-black uppercase text-slate-700 tracking-wider">{toggle.label}</span>
                          <div className="relative">
                            <input
                              checked={toggle.checked}
                              onChange={(e) => toggle.onChange(e.target.checked)}
                              type="checkbox"
                              className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                </section>

                <section className="space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Prediction Display</p>
                  <div className="grid grid-cols-2 gap-3">
                    {(['inline', 'split', 'footer', 'listbox'] as const).map(layout => (
                      <button
                        key={layout}
                        type="button"
                        onClick={() => setPredictionLayout(layout)}
                        className={clsx(
                          'rounded-2xl border-2 px-4 py-4 text-center transition-all shadow-sm',
                          predictionLayout === layout
                            ? 'border-blue-500 bg-blue-600 text-white shadow-md'
                            : 'border-slate-100 bg-white text-slate-600 hover:border-slate-300'
                        )}
                      >
                        <span className="block text-[10px] font-black uppercase tracking-widest">{layout}</span>
                      </button>
                    ))}
                  </div>
                </section>

                <section className="space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Popup Timeout</p>
                  <div className="p-6 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm">
                    <input
                      className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                      type="range"
                      min="3"
                      max="20"
                      step="1"
                      value={Math.round(predictionPopupTimeoutMs / 1000)}
                      onChange={(e) => setPredictionPopupTimeoutMs(Number(e.target.value) * 1000)}
                    />
                    <div className="mt-4 flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <span>3 Seconds</span>
                      <span className="text-blue-600 px-2 py-1 bg-blue-50 rounded-lg">{Math.round(predictionPopupTimeoutMs / 1000)}s</span>
                      <span>20 Seconds</span>
                    </div>
                  </div>
                </section>
              </div>
            )}

            {/* UTILITY TAB */}
            {activeTab === 'utility' && (
              <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <TamilPrecisionRecovery />
              </div>
            )}

            {/* INFO TAB */}
            {activeTab === 'info' && (
              <div className="space-y-10 pb-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <section className="space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Scholarly Fonts</p>
                  <div className="grid grid-cols-1 gap-3">
                    {[
                      { name: 'Chandas Devanagari', desc: 'High-Precision Vedic Glyphs', url: 'https://sanskritdocuments.org/hindi/chandas/' },
                      { name: 'Sanskrit 2003', desc: 'Unicode Devanagari Standard', url: 'https://salrc.uchicago.edu/resources/fonts/available/sanskrit/sanskrit2003.shtml' },
                      { name: 'Siddhanta', desc: 'Modern Digital Standard', url: 'https://sanskritdocuments.org/projects/siddhanta/' },
                      { name: 'Anek Tamil', desc: 'Versatile Tamil Display', url: 'https://fonts.google.com/specimen/Anek+Tamil' },
                      { name: 'Noto Serif Tamil', desc: 'Scholarly Tamil Standard', url: 'https://fonts.google.com/specimen/Noto+Serif+Tamil' }
                    ].map(font => (
                      <a
                        key={font.name}
                        href={font.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white p-5 hover:border-blue-200 hover:shadow-md transition-all group shadow-sm"
                      >
                        <div>
                          <p className="text-sm font-bold text-slate-800">{font.name}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight mt-1">{font.desc}</p>
                        </div>
                        <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center group-hover:bg-blue-50 transition-colors">
                          <Download className="w-4 h-4 text-slate-300 group-hover:text-blue-500" />
                        </div>
                      </a>
                    ))}
                  </div>
                </section>

                <section className="space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Scholarly Contribution</p>
                  <a
                    href="https://github.com/mrgkumar/sanskrit-keyboard/issues"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-3 rounded-2xl bg-slate-900 px-5 py-5 text-xs font-black uppercase tracking-widest text-white shadow-xl shadow-slate-300 hover:bg-slate-800 transition-all active:scale-[0.97]"
                  >
                    <Info className="h-4 w-4" />
                    Collaborate on GitHub
                  </a>
                </section>

                <section className="pt-10 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">Software Artifact</p>
                    <span className="text-[10px] font-mono font-black text-slate-400 px-2 py-1 bg-slate-50 rounded-lg">v{BUILD_VERSION}</span>
                  </div>
                  <p className="mt-4 text-[10px] font-bold text-slate-400 leading-relaxed px-1">
                    Released on {new Date(BUILD_TIME).toLocaleDateString('en-IN', { dateStyle: 'long' })}
                  </p>
                  <p className="mt-12 text-center text-[10px] font-black uppercase tracking-[0.4em] text-slate-200 select-none">
                    Sanskrit Keyboard
                  </p>
                </section>
              </div>
            )}

          </main>
        </div>
      </div>

      {viewMode !== 'immersive' && <StickyTopComposer />}
      <MainDocumentArea />
      <ReferenceSidePanel /> {/* Add the side panel here */}
      <LargeDocumentOperationOverlay operation={largeDocumentOperation} />
    </div>
  );
};
