'use client';

import React from 'react';
import Link from 'next/link';
import { useFlowStore } from '@/store/useFlowStore';
import { 
  Plus, 
  Clock, 
  ChevronRight, 
  AlertTriangle,
  History,
  Trash2,
  Edit2,
  BookOpen
} from 'lucide-react';
import { LargeDocumentOperationOverlay } from './LargeDocumentOperationOverlay';

interface SessionLandingProps {
  onConfirm: () => void;
}

export const SessionLanding: React.FC<SessionLandingProps> = ({ onConfirm }) => {
  const { 
    savedSessions, 
    resetSession, 
    deleteSession,
    renameSession,
    restoreSessionAsync,
    largeDocumentOperation,
  } = useFlowStore();
  
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editingName, setEditingName] = React.useState('');

  const handleLoad = async (id: string) => {
    const restored = await restoreSessionAsync(id);
    if (restored) {
      onConfirm();
    }
  };

  const handleNew = () => {
    resetSession();
    onConfirm();
  };

  const handleRename = (e: React.FormEvent, id: string) => {
    e.preventDefault();
    if (editingName.trim()) {
      renameSession(id, editingName.trim());
      setEditingId(null);
    }
  };

  const sortedSessions = [...savedSessions].sort((a, b) => 
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-6 font-sans sm:px-6 sm:py-8 lg:px-8">
      <div className="w-full max-w-2xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 shadow-xl shadow-blue-200 sm:h-20 sm:w-20">
            <span className="text-2xl font-black text-white sm:text-4xl">S</span>
          </div>
          <h1 className="px-2 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">Welcome Back</h1>
          <p className="px-2 text-sm font-medium italic text-slate-500 sm:text-base">
            Choose a session to continue your scholarly work.
          </p>
        </div>

        {/* Primary Actions */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <button
            onClick={handleNew}
            disabled={Boolean(largeDocumentOperation)}
            className="group flex items-center justify-between gap-4 rounded-3xl border-2 border-dashed border-slate-200 bg-white p-4 text-left transition-all hover:border-blue-400 hover:bg-blue-50/30 active:scale-[0.99] sm:p-6"
          >
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 transition-transform group-hover:scale-110">
                <Plus className="w-6 h-6 text-blue-600" />
              </div>
              <div className="min-w-0 text-left">
                <p className="font-bold text-slate-900">New Session</p>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Start fresh</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-slate-300 transition-all group-hover:translate-x-1 group-hover:text-blue-500" />
          </button>

          {sortedSessions.length > 0 && (
            <button
              onClick={() => void handleLoad(sortedSessions[0].sessionId)}
              disabled={Boolean(largeDocumentOperation)}
              className="group flex items-center justify-between gap-4 rounded-3xl border-2 border-slate-900 bg-slate-900 p-4 text-left shadow-xl shadow-slate-200 transition-all hover:bg-slate-800 active:scale-[0.99] sm:p-6"
            >
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 transition-transform group-hover:scale-110">
                  <Clock className="w-6 h-6 text-white" />
                </div>
                <div className="min-w-0 text-left">
                  <p className="font-bold text-white">Resume Latest</p>
                  <p className="max-w-[12rem] truncate text-xs font-bold text-slate-400 sm:max-w-[16rem]">
                    {sortedSessions[0].sessionName}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-white/30 transition-all group-hover:translate-x-1" />
            </button>
          )}
        </div>

        <div className="flex flex-col items-center justify-center gap-3 text-sm sm:flex-row">
          <span className="font-medium text-slate-400">Need to read a source text?</span>
          <Link
            href="/reader"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-3 font-bold text-slate-700 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 sm:py-2"
          >
            <BookOpen className="w-4 h-4 text-blue-600" />
            Open Reader
          </Link>
        </div>

        {/* Session List */}
        {sortedSessions.length > 1 && (
          <div className="overflow-hidden rounded-[2rem] border border-slate-100 bg-white shadow-sm sm:rounded-[2.5rem]">
            <div className="flex items-center gap-2 border-b border-slate-50 px-5 py-4 sm:px-8 sm:py-5">
              <History className="w-4 h-4 text-slate-400" />
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Previous Sessions</h2>
            </div>
            <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-50">
              {sortedSessions.slice(1).map((session) => (
                <div
                  key={session.sessionId}
                  className="group flex flex-col gap-3 p-4 transition-colors hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1 sm:px-4">
                    {editingId === session.sessionId ? (
                      <form onSubmit={(e) => handleRename(e, session.sessionId)} className="flex items-center gap-2">
                        <input
                          autoFocus
                          className="flex-1 rounded-md border border-blue-200 bg-white px-2 py-2 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onBlur={() => setEditingId(null)}
                        />
                      </form>
                    ) : (
                      <button
                        onClick={() => void handleLoad(session.sessionId)}
                        className="w-full text-left"
                        disabled={Boolean(largeDocumentOperation)}
                      >
                        <p className="text-sm font-bold text-slate-800 group-hover:text-blue-600 transition-colors truncate">
                          {session.sessionName}
                        </p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mt-0.5">
                          {new Date(session.updatedAt).toLocaleDateString()} • {new Date(session.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-100 transition-opacity sm:pr-4 sm:opacity-0 sm:group-hover:opacity-100">
                    <button 
                      onClick={() => {
                        setEditingId(session.sessionId);
                        setEditingName(session.sessionName);
                      }}
                      className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={() => {
                        if (confirm('Delete this session permanently?')) {
                          deleteSession(session.sessionId);
                        }
                      }}
                      className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Warning Note */}
        <div className="flex gap-4 rounded-3xl border border-amber-100 bg-amber-50 p-4 sm:p-6">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-100">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-bold text-amber-900">Local Storage Notice</p>
            <p className="text-xs text-amber-700 leading-relaxed font-medium">
              Your sessions are saved only in this browser&apos;s local storage. Clearing your browser cache or site data will permanently delete all saved sessions. We recommend regularly exporting your work.
            </p>
          </div>
        </div>

      </div>
      <LargeDocumentOperationOverlay operation={largeDocumentOperation} />
    </div>
  );
};
