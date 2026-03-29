'use client';

import React from 'react';
import { StickyTopComposer } from '@/components/StickyTopComposer';
import { MainDocumentArea } from '@/components/MainDocumentArea';
import { ReferenceSidePanel } from '@/components/ReferenceSidePanel'; // Import the side panel
import { useFlowStore } from '@/store/useFlowStore';
import { Check, Copy, RefreshCw, Save, SlidersHorizontal } from 'lucide-react';
import { clsx } from 'clsx';
import { SessionSnapshot } from '@/store/types';

const STORAGE_KEY = 'sanskrit-keyboard.sessions.v1';

export const TransliterationEngine: React.FC = () => {
  const {
    blocks,
    editorState,
    typography,
    sessionId,
    sessionName,
    lastSavedAt,
    setTypography,
    setSessionName,
    markSessionSaved,
    exportSessionSnapshot,
    loadSessionSnapshot,
    resetSession,
  } = useFlowStore();
  const [savedSessions, setSavedSessions] = React.useState<SessionSnapshot[]>([]);
  const [copyAllState, setCopyAllState] = React.useState<'idle' | 'copied' | 'error'>('idle');
  const [isDisplayMenuOpen, setIsDisplayMenuOpen] = React.useState(false);
  const hasLoadedSessions = React.useRef(false);
  const displayMenuRef = React.useRef<HTMLDivElement>(null);

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
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      hasLoadedSessions.current = true;
      return;
    }

    try {
      const parsed = JSON.parse(raw) as SessionSnapshot[];
      setSavedSessions(parsed);
      const matchingSession = parsed.find((item) => item.sessionId === sessionId);
      if (matchingSession) {
        loadSessionSnapshot(matchingSession);
      }
    } catch {
      setSavedSessions([]);
    } finally {
      hasLoadedSessions.current = true;
    }
  }, [loadSessionSnapshot, sessionId]);

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
    if (copyAllState === 'idle') {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCopyAllState('idle');
    }, 1500);

    return () => window.clearTimeout(timeoutId);
  }, [copyAllState]);

  React.useEffect(() => {
    if (!isDisplayMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (displayMenuRef.current && !displayMenuRef.current.contains(event.target as Node)) {
        setIsDisplayMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isDisplayMenuOpen]);

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

  const handleCopyWholeDocument = async () => {
    const fullDocument = blocks.map((block) => block.rendered).join('\n\n');
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

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 font-sans relative">
      <div className="border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              className="min-w-[16rem] rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800"
              placeholder="Session name"
            />
            <select
              value=""
              onChange={(e) => {
                handleLoadSession(e.target.value);
                e.currentTarget.value = '';
              }}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
            >
              <option value="" disabled>Load session</option>
              {savedSessions.map((session) => (
                <option key={session.sessionId} value={session.sessionId}>
                  {session.sessionName} · {new Date(session.updatedAt).toLocaleString()}
                </option>
              ))}
            </select>
            <button
              onClick={handleSaveNow}
              className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-bold uppercase text-slate-700 hover:bg-slate-200"
              type="button"
            >
              <Save className="h-4 w-4" />
              Save Now
            </button>
            <button
              onClick={resetSession}
              className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-bold uppercase text-slate-700 hover:bg-slate-100"
              type="button"
            >
              <RefreshCw className="h-4 w-4" />
              New Session
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span>{lastSavedAt ? `Autosaved ${new Date(lastSavedAt).toLocaleString()}` : 'Autosave pending'}</span>
            <div className="relative" ref={displayMenuRef}>
              <button
                onClick={() => setIsDisplayMenuOpen((open) => !open)}
                className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-bold uppercase text-slate-700 hover:bg-slate-100"
                type="button"
              >
                <SlidersHorizontal className="h-4 w-4" />
                Display
              </button>
              {isDisplayMenuOpen && (
                <div className="absolute right-0 top-full z-[70] mt-2 w-80 rounded-xl border border-slate-200 bg-white p-4 shadow-xl ring-1 ring-slate-100">
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Display</p>
                      <p className="mt-1 text-xs text-slate-500">Adjust typography only when needed; keep it out of the main typing lane.</p>
                    </div>
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
            </div>
            <button
              onClick={handleCopyWholeDocument}
              className={clsx(
                'inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-bold uppercase',
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
          </div>
        </div>
      </div>
      <StickyTopComposer />
      <MainDocumentArea />
      <ReferenceSidePanel /> {/* Add the side panel here */}
    </div>
  );
};
