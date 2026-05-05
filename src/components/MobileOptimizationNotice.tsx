'use client';

import React, { useEffect, useState } from 'react';
import { MonitorSmartphone, Smartphone } from 'lucide-react';

export const MobileOptimizationNotice: React.FC = () => {
  const [isCompactViewport, setIsCompactViewport] = useState(false);
  const [isDismissed, setIsDismissed] = useState(true);

  useEffect(() => {
    const dismissed = sessionStorage.getItem('mobile-notice-dismissed') === 'true';
    setIsDismissed(dismissed);

    const mediaQuery = window.matchMedia('(max-width: 1023px)');
    const update = () => setIsCompactViewport(mediaQuery.matches);
    update();

    mediaQuery.addEventListener('change', update);
    return () => mediaQuery.removeEventListener('change', update);
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    sessionStorage.setItem('mobile-notice-dismissed', 'true');
  };

  if (!isCompactViewport || isDismissed) {
    return null;
  }

  return (
    <div className="fixed inset-x-3 bottom-3 z-[1000] pointer-events-none pb-[env(safe-area-inset-bottom)] sm:inset-x-4 sm:bottom-4">
      <div className="pointer-events-auto mx-auto flex w-full max-w-2xl items-start gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-2xl backdrop-blur-xl">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
          <MonitorSmartphone className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-900">Compact layout enabled</h2>
            <Smartphone className="h-4 w-4 text-slate-400" />
          </div>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            The interface now adapts for tablet and phone screens with stacked panels, larger touch targets, and docked drawers.
          </p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-900 px-3 text-xs font-bold uppercase tracking-[0.14em] text-white transition-colors hover:bg-slate-800"
        >
          Got it
        </button>
      </div>
    </div>
  );
};
