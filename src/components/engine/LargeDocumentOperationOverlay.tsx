'use client';

import React from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';
import type { LargeDocumentOperation } from '@/store/types';

interface LargeDocumentOperationOverlayProps {
  operation: LargeDocumentOperation | null;
}

export const LargeDocumentOperationOverlay: React.FC<LargeDocumentOperationOverlayProps> = ({
  operation,
}) => {
  if (!operation) {
    return null;
  }

  const progress =
    operation.total > 0 ? Math.max(0, Math.min(100, (operation.processed / operation.total) * 100)) : 0;

  const phaseLabel = {
    reading: 'Reading session',
    parsing: 'Parsing saved document',
    processing: 'Preparing blocks',
    hydrating: 'Hydrating workspace',
    indexing: 'Indexing document',
    saving: 'Saving session',
    complete: 'Complete',
    error: 'Restore failed',
  }[operation.phase];

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-950/20">
        <div className="flex items-start gap-4">
          <div
            className={clsx(
              'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl',
              operation.phase === 'error' ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'
            )}
          >
            {operation.phase === 'error' ? (
              <AlertTriangle className="h-6 w-6" />
            ) : (
              <Loader2 className="h-6 w-6 animate-spin" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              {operation.kind === 'restore' ? 'Session Restore' : 'Document Import'}
            </p>
            <p className="mt-1 text-lg font-black text-slate-900">{phaseLabel}</p>
            <p className="mt-1 text-sm font-medium text-slate-500">{operation.message}</p>
          </div>
        </div>

        <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className={clsx(
              'h-full rounded-full transition-all duration-200',
              operation.phase === 'error' ? 'bg-rose-500' : 'bg-blue-600'
            )}
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="mt-3 flex items-center justify-between text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
          <span>
            {operation.processed.toLocaleString()} / {operation.total.toLocaleString()}
          </span>
          <span>{operation.canCancel ? 'Cancelable' : 'Locked'}</span>
        </div>
      </div>
    </div>
  );
};
