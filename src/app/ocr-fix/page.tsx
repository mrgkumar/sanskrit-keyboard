'use client';

import React from 'react';
import { SourceViewer } from '@/components/correction/SourceViewer';
import { JumpToolbar } from '@/components/correction/JumpToolbar';
import Link from 'next/link';
import { ChevronLeft, FileText, AlertCircle } from 'lucide-react';

export default function OCRFixPage() {
  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-4 bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-4">
          <Link 
            href="/dashboard"
            className="p-2 hover:bg-slate-50 text-slate-400 hover:text-blue-600 rounded-lg transition-colors group"
          >
            <ChevronLeft className="w-5 h-5 group-active:scale-90 transition-transform" />
          </Link>
          <div className="w-[1px] h-6 bg-slate-200" />
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">Normalization & Cleanup</h1>
          <span className="px-2 py-1 bg-blue-50 text-blue-700 text-[10px] font-bold uppercase rounded leading-none border border-blue-100">AI-Assisted Mode</span>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 rounded-lg border border-amber-100">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            <span className="text-xs font-bold text-amber-700 uppercase tracking-tighter">12 Ambiguities Detected</span>
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <FileText className="w-4 h-4" />
            <span className="text-xs font-medium">rigveda_mandala_01.txt</span>
          </div>
        </div>
      </header>

      {/* Main Workspace (Dual Pane) */}
      <main className="flex-1 flex overflow-hidden p-6 gap-6">
        {/* Left: Source */}
        <div className="w-1/2 h-full">
          <SourceViewer />
        </div>

        {/* Right: Editor */}
        <div className="w-1/2 h-full flex flex-col gap-6">
          <div className="flex-1 bg-white rounded-3xl border border-slate-100 shadow-sm p-8 overflow-y-auto">
            <div className="text-4xl font-serif leading-[1.8] text-slate-900 whitespace-pre-wrap">
              {/* Simulated text with highlights */}
              ॐ स॒ह ना॑ववतु। स॒ह नौ॑ भुनक्तु। स॒ह वी॒र्यं॑ करवावहै ।<br />
              ते॒ज॒स्विना॒वधी॑तमस्तु॒ मा वि॑द्विषा॒वहै᳚ ॥<br />
              <span className="bg-amber-100/50 shadow-[inset_0_-4px_0_0_#fbbf24] cursor-help">ब</span>ा॒ध॒ते॒... 
              {/* The rest would be actual text from store */}
            </div>
          </div>
          <JumpToolbar />
        </div>
      </main>

      {/* Footer / Status */}
      <footer className="px-8 py-3 bg-white border-t border-slate-200 flex justify-center text-slate-400">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em]">
          Scroll Sync: ACTIVE • AI Suggestion Engine: RUNNING
        </p>
      </footer>
    </div>
  );
}
