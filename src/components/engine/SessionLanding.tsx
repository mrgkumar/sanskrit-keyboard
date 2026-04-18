'use client';

import React from 'react';
import { useFlowStore } from '@/store/useFlowStore';
import { 
  Plus, 
  Clock, 
  ChevronRight, 
  AlertTriangle,
  History,
  Trash2,
  Edit2
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
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-2xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto shadow-xl shadow-blue-200">
            <span className="text-white font-black text-2xl">S</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Welcome Back</h1>
          <p className="text-slate-500 font-medium italic">Choose a session to continue your scholarly work.</p>
        </div>

        {/* Primary Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={handleNew}
            disabled={Boolean(largeDocumentOperation)}
            className="flex items-center justify-between p-6 bg-white border-2 border-dashed border-slate-200 rounded-3xl hover:border-blue-400 hover:bg-blue-50/30 transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <Plus className="w-6 h-6 text-blue-600" />
              </div>
              <div className="text-left">
                <p className="font-bold text-slate-900">New Session</p>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Start fresh</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
          </button>

          {sortedSessions.length > 0 && (
            <button
              onClick={() => void handleLoad(sortedSessions[0].sessionId)}
              disabled={Boolean(largeDocumentOperation)}
              className="flex items-center justify-between p-6 bg-slate-900 border-2 border-slate-900 rounded-3xl hover:bg-slate-800 transition-all group shadow-xl shadow-slate-200"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Clock className="w-6 h-6 text-white" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-white">Resume Latest</p>
                  <p className="text-xs text-slate-400 font-bold truncate max-w-[120px]">
                    {sortedSessions[0].sessionName}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-white/30 group-hover:translate-x-1 transition-all" />
            </button>
          )}
        </div>

        {/* Session List */}
        {sortedSessions.length > 1 && (
          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-8 py-5 border-b border-slate-50 flex items-center gap-2">
              <History className="w-4 h-4 text-slate-400" />
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Previous Sessions</h2>
            </div>
            <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-50">
              {sortedSessions.slice(1).map((session) => (
                <div key={session.sessionId} className="group flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex-1 min-w-0 px-4">
                    {editingId === session.sessionId ? (
                      <form onSubmit={(e) => handleRename(e, session.sessionId)} className="flex items-center gap-2">
                        <input
                          autoFocus
                          className="flex-1 bg-white border border-blue-200 rounded-md px-2 py-1 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20"
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
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pr-4">
                    <button 
                      onClick={() => {
                        setEditingId(session.sessionId);
                        setEditingName(session.sessionName);
                      }}
                      className="p-2 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={() => {
                        if (confirm('Delete this session permanently?')) {
                          deleteSession(session.sessionId);
                        }
                      }}
                      className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
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
        <div className="p-6 bg-amber-50 rounded-3xl border border-amber-100 flex gap-4">
          <div className="w-10 h-10 bg-amber-100 rounded-2xl flex items-center justify-center shrink-0">
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
