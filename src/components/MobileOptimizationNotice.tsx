'use client';

import React, { useEffect, useState } from 'react';
import { Monitor, Smartphone } from 'lucide-react';

export const MobileOptimizationNotice: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [hasDismissed, setHasDismissed] = useState(true); // Default to true to prevent flash during hydration

  useEffect(() => {
    // Check if we've already dismissed it in this session
    const dismissed = sessionStorage.getItem('mobile-notice-dismissed');
    setHasDismissed(!!dismissed);

    const checkMobile = () => {
      // Common mobile breakpoint
      const isMobileSize = window.innerWidth < 1024;
      setIsVisible(isMobileSize && !dismissed);
    };

    // Initial check
    checkMobile();

    // Re-check on resize
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    setHasDismissed(true);
    sessionStorage.setItem('mobile-notice-dismissed', 'true');
  };

  if (!isVisible || hasDismissed) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in fade-in zoom-in duration-300">
        <div className="bg-blue-600 p-6 text-white">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-white/20 p-2">
              <Monitor className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-bold">Desktop Optimized</h2>
          </div>
        </div>
        
        <div className="p-6">
          <div className="mb-6 flex items-start gap-4">
            <div className="mt-1 rounded-full bg-amber-50 p-2 text-amber-600">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm leading-relaxed text-slate-600">
                Sanskrit Keyboard is designed for complex scholarly transliteration and works best on **desktops or larger screens**. 
              </p>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                You might experience layout issues or limited functionality on mobile devices. For the best experience, we recommend using a desktop browser.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={handleDismiss}
              className="flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white transition-all hover:bg-slate-800 active:scale-[0.98]"
            >
              Continue anyway
            </button>
            <p className="text-center text-[10px] font-medium uppercase tracking-wider text-slate-400">
              We won&apos;t show this again in this session
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
