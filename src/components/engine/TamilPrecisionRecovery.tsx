// app/src/components/engine/TamilPrecisionRecovery.tsx
'use client';

import React from 'react';
import { clsx } from 'clsx';
import { Copy, Check, Info } from 'lucide-react';
import { reverseTamilInput } from '@/lib/vedic/utils';

export const TamilPrecisionRecovery: React.FC = () => {
  const [tamilRecoveryInput, setTamilRecoveryInput] = React.useState('');
  const [tamilRecoveryCopyState, setTamilRecoveryCopyState] = React.useState<'idle' | 'canonical' | 'baraha' | 'error'>('idle');

  const tamilRecoveryResult = React.useMemo(() => {
    if (tamilRecoveryInput.trim().length === 0) {
      return null;
    }

    return reverseTamilInput(tamilRecoveryInput, {
      inputMode: 'tamil-precision',
      outputMode: 'baraha',
    });
  }, [tamilRecoveryInput]);

  React.useEffect(() => {
    if (tamilRecoveryCopyState === 'idle') {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setTamilRecoveryCopyState('idle');
    }, 1500);

    return () => window.clearTimeout(timeoutId);
  }, [tamilRecoveryCopyState]);

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
    <section className="space-y-4" data-testid="workspace-tamil-precision-recovery">
      <div className="p-6 bg-amber-50/30 rounded-[2.5rem] border border-amber-100 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center shrink-0">
            <Info className="w-6 h-6 text-amber-700" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">Tamil Precision Recovery</h3>
            <p className="text-[10px] text-amber-800/70 font-bold uppercase tracking-tight mt-1">Utility Mode</p>
            <p className="mt-2 text-xs text-slate-500 leading-relaxed font-medium">
              Phase 1 utility: recovers Roman Sanskrit only from frozen Tamil Precision input. Plain Tamil and Baraha Tamil reject instead of guessing.
            </p>
          </div>
        </div>

        <div className="mt-6">
          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
            Tamil Precision Input
          </label>
          <textarea
            data-testid="tamil-recovery-input"
            value={tamilRecoveryInput}
            onChange={(event) => setTamilRecoveryInput(event.target.value)}
            rows={4}
            placeholder="நமஸ்தே ருத்³ராய"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 placeholder:text-slate-300 focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none shadow-sm min-h-[6.5rem]"
          />
        </div>

        <div className="mt-4">
          {tamilRecoveryResult === null ? (
            <div
              data-testid="tamil-recovery-empty"
              className="rounded-2xl border-2 border-dashed border-slate-100 bg-white/50 px-4 py-6 text-center text-[11px] font-bold text-slate-300 uppercase tracking-widest"
            >
              Paste Tamil Precision text here to recover canonical Roman and derived Baraha Roman safely.
            </div>
          ) : tamilRecoveryResult.status === 'success' ? (
            <div className="space-y-4" data-testid="tamil-recovery-success">
              <div className="rounded-xl bg-emerald-50 px-4 py-3 text-[11px] font-bold text-emerald-700 border border-emerald-100">
                Exact recovery succeeded from Tamil Precision input.
              </div>
              
              <div className="space-y-3">
                <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Canonical Roman</p>
                    <button
                      type="button"
                      data-testid="tamil-recovery-copy-canonical"
                      onClick={() => handleCopyTamilRecovery(tamilRecoveryResult.canonicalRoman, 'canonical')}
                      className={clsx(
                        'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] font-black uppercase transition-all',
                        tamilRecoveryCopyState === 'canonical'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-slate-100 bg-white text-slate-500 hover:border-blue-200 hover:text-blue-600'
                      )}
                    >
                      {tamilRecoveryCopyState === 'canonical' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      {tamilRecoveryCopyState === 'canonical' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <pre
                    data-testid="tamil-recovery-canonical-output"
                    className="overflow-x-auto whitespace-pre-wrap break-words rounded-xl bg-slate-50 px-3 py-3 font-mono text-sm text-slate-900 border border-slate-100"
                  >
                    {tamilRecoveryResult.canonicalRoman}
                  </pre>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Derived Baraha Roman</p>
                    <button
                      type="button"
                      data-testid="tamil-recovery-copy-baraha"
                      onClick={() => handleCopyTamilRecovery(tamilRecoveryResult.barahaRoman ?? '', 'baraha')}
                      className={clsx(
                        'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] font-black uppercase transition-all',
                        tamilRecoveryCopyState === 'baraha'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-slate-100 bg-white text-slate-500 hover:border-blue-200 hover:text-blue-600'
                      )}
                    >
                      {tamilRecoveryCopyState === 'baraha' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      {tamilRecoveryCopyState === 'baraha' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <pre
                    data-testid="tamil-recovery-baraha-output"
                    className="overflow-x-auto whitespace-pre-wrap break-words rounded-xl bg-slate-50 px-3 py-3 font-mono text-sm text-slate-900 border border-slate-100"
                  >
                    {tamilRecoveryResult.barahaRoman ?? ''}
                  </pre>
                  <p className="mt-3 text-[10px] text-slate-400 font-medium leading-relaxed italic">
                    Derived from the canonical recovery result. It is not a separate Tamil parser mode.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div
              data-testid="tamil-recovery-rejection"
              className="rounded-2xl border border-rose-100 bg-rose-50/50 p-5 space-y-3"
            >
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 text-[9px] font-black uppercase tracking-widest">Rejected: {tamilRecoveryResult.inputKind}</span>
              </div>
              <p className="text-xs font-medium text-rose-900/80 leading-relaxed">{tamilRecoveryResult.reason}</p>
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-rose-300">Rejected Source</p>
                <pre
                  data-testid="tamil-recovery-rejected-source"
                  className="overflow-x-auto whitespace-pre-wrap break-words rounded-xl bg-white/80 px-3 py-3 font-medium text-sm text-rose-950 border border-rose-100"
                >
                  {tamilRecoveryResult.originalText}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
