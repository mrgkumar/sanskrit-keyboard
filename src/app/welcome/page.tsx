'use client';

import React from 'react';
import Link from 'next/link';
import { 
  Sparkles, 
  Keyboard, 
  Zap, 
  BookOpen, 
  MousePointer2, 
  CheckCircle2,
  ArrowRight,
  Command,
  Bug
} from 'lucide-react';

export default function WelcomePage() {
  const markAsVisited = () => {
    localStorage.setItem('sanskrit-keyboard-visited', 'true');
    localStorage.removeItem('sanskirt-keyboard-visited');
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Background Decor */}
      <div className="pointer-events-none fixed right-0 top-0 h-[28rem] w-[28rem] translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-100/30 blur-[120px] sm:h-[36rem] sm:w-[36rem]" />
      <div className="pointer-events-none fixed bottom-0 left-0 h-[20rem] w-[20rem] -translate-x-1/2 translate-y-1/2 rounded-full bg-amber-100/20 blur-[100px] sm:h-[24rem] sm:w-[24rem]" />

      {/* Header */}
      <header className="relative z-10 shrink-0 flex flex-col items-center px-4 pb-10 pt-12 text-center sm:pt-16 lg:pt-20">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-[1.75rem] bg-blue-600 shadow-2xl shadow-blue-200 animate-in zoom-in duration-700 sm:mb-8 sm:h-20 sm:w-20">
          <span className="text-3xl font-black text-white sm:text-4xl">S</span>
        </div>
        <h1 className="max-w-3xl px-4 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
          The Invisible Interface
        </h1>
        <p className="mt-4 text-xs font-bold uppercase tracking-[0.28em] text-slate-500 sm:tracking-[0.4em]">
          Sanskrit Keyboard Walkthrough
        </p>
      </header>

      {/* Main Content */}
      <main className="relative z-10 mx-auto flex w-full max-w-4xl flex-1 flex-col gap-16 px-4 pb-20 sm:px-6 sm:pb-24 lg:gap-24 lg:px-6">
        
        {/* Philosophy */}
        <section className="space-y-6 text-center">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-slate-800 sm:text-3xl">Typing, Transformed</h2>
            <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg">
              Sanskrit Keyboard is designed for scholars who need to move at the speed of thought. 
              No menus, no distractions—just a fluid transliteration experience that learns your patterns.
            </p>
          </div>
        </section>

        {/* Attributes & Inspiration */}
        <section className="mx-auto max-w-3xl space-y-8 rounded-[2rem] border border-slate-100 bg-white px-5 py-8 shadow-sm sm:rounded-[2.5rem] sm:px-8 sm:py-12">
          <div className="text-center space-y-2">
            <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">Attributes & Inspiration</h2>
            <div className="w-12 h-1 bg-blue-600 mx-auto rounded-full" />
          </div>
          
          <div className="grid grid-cols-1 gap-x-6 gap-y-6 text-sm leading-relaxed md:grid-cols-2 lg:grid-cols-4 lg:gap-x-8 lg:gap-y-8">
            <div className="space-y-3">
              <h4 className="font-bold text-blue-700 uppercase tracking-wider text-[10px]">Data & Research</h4>
              <p className="text-slate-600">
                Validated against <a href="https://huggingface.co/datasets/ai4bharat/Aksharantar" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium">Aksharantar</a> and inspired by <a href="https://github.com/AI4Bharat/IndicXlit" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium">IndicXlit</a> from AI4Bharat.
              </p>
            </div>
            
            <div className="space-y-3">
              <h4 className="font-bold text-blue-700 uppercase tracking-wider text-[10px]">Tools & Precedents</h4>
              <p className="text-slate-600">
                Rooted in the phonetic logic of <a href="https://baraha.com/main.php" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium">Baraha</a> and the excellent corpus work of <a href="https://vignanam.org" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium">Vignanam.org</a>.
              </p>
            </div>

            <div className="space-y-3">
              <h4 className="font-bold text-blue-700 uppercase tracking-wider text-[10px]">Methodology</h4>
              <p className="text-slate-600">
                Learned through an unsupervised loop modelling the path: <span className="font-bold text-slate-800 text-[10px]">Devanagari → English → Devanagari → English → Tamil → English</span>.
              </p>
            </div>

            <div className="space-y-3">
              <h4 className="font-bold text-blue-700 uppercase tracking-wider text-[10px]">Agentic Development</h4>
              <p className="text-slate-600">
                Orchestrated via <span className="font-medium text-slate-800">Gemini CLI</span> & <span className="font-medium text-slate-800">Codex</span> using the <a href="https://docs.bmad-method.org/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium">BMad-Method</a> on <a href="https://github.com/mrgkumar/sanskrit-keyboard" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium">GitHub</a>.
              </p>
            </div>

            <div className="space-y-4 border-t border-slate-50 pt-4 md:col-span-2 lg:col-span-4">
              <h4 className="font-bold text-blue-700 uppercase tracking-wider text-[10px] text-center">The Scholarly Mission</h4>
              <p className="text-slate-600 text-center italic max-w-2xl mx-auto">
                &quot;Driven by the gap in Vedic swara support in Tamil transliteration. This work is dedicated to my Guru, family, and friends who motivated the quest for 100% cross-script precision.&quot;
              </p>
              <p className="text-slate-400 text-[10px] text-center uppercase tracking-widest font-bold">
                Built entirely with GenAI &bull; No manual React coding involved
              </p>
            </div>
          </div>
        </section>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:gap-8">
          
          {/* Feature 1: ITRANS */}
          <div className="group rounded-3xl border border-slate-100 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl sm:p-8">
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 transition-transform group-hover:scale-110">
              <Keyboard className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">Natural ITRANS Entry</h3>
            <p className="mt-3 text-slate-600 leading-relaxed">
              Type using the standard ITRANS scheme. Your input is converted instantly into high-precision Devanagari or Tamil.
            </p>
            <div className="mt-6 flex items-center gap-2">
              <kbd className="px-2 py-1 bg-slate-100 border border-slate-200 rounded text-xs font-mono font-bold text-slate-500">agniM</kbd>
              <ArrowRight className="w-3 h-3 text-slate-300" />
              <span className="text-lg font-serif text-slate-900">अग्निं</span>
            </div>
          </div>

          {/* Feature 2: Autocomplete */}
          <div className="group rounded-3xl border border-slate-100 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl sm:p-8">
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 transition-transform group-hover:scale-110">
              <Zap className="w-6 h-6 text-amber-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">Intelligent Flow</h3>
            <p className="mt-3 text-slate-600 leading-relaxed">
              Accept lexical suggestions without lifting your hands from the home row.
            </p>
            <div className="mt-6 flex items-center gap-3">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 rounded-lg text-white text-xs font-bold">
                <Command className="w-3 h-3" />
                <span>TAB</span>
              </div>
              <span className="text-sm font-medium text-slate-400">to select suggestion</span>
            </div>
          </div>

          {/* Feature 3: Vedic Markers */}
          <div className="group rounded-3xl border border-slate-100 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl sm:p-8">
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 transition-transform group-hover:scale-110">
              <Sparkles className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">Vedic Precision</h3>
            <p className="mt-3 text-slate-600 leading-relaxed">
              Engineered for scholarly accuracy. Use simple shortcuts for complex Vedic svaras and markers.
            </p>
            <ul className="mt-6 space-y-2">
              <li className="flex items-center gap-3 text-sm text-slate-500">
                <kbd className="px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded font-mono text-[10px]">&apos;</kbd>
                <span>Udatta</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-slate-500">
                <kbd className="px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded font-mono text-[10px]">_</kbd>
                <span>Anudatta</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-slate-500">
                <kbd className="px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded font-mono text-[10px]">&apos;&apos;</kbd>
                <span>Double Svarita</span>
              </li>
            </ul>
          </div>

          {/* Feature 4: Blocks */}
          <div className="group rounded-3xl border border-slate-100 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl sm:p-8">
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-green-50 transition-transform group-hover:scale-110">
              <MousePointer2 className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">Block Management</h3>
            <p className="mt-3 text-slate-600 leading-relaxed">
              Organize long texts into manageable chunks. 
            </p>
            <div className="mt-6 space-y-3">
              <div className="flex items-center gap-3 text-sm text-slate-500">
                <kbd className="px-2 py-1 bg-slate-50 border border-slate-200 rounded font-mono text-[10px]">Enter</kbd>
                <span>New Paragraph</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-500">
                <kbd className="px-2 py-1 bg-slate-50 border border-slate-200 rounded font-mono text-[10px]">Shift + Enter</kbd>
                <span>Split into new Block</span>
              </div>
            </div>
          </div>

        </div>

        {/* Reference Drawer Tip */}
        <section className="rounded-[2rem] bg-blue-600 p-6 text-white shadow-2xl shadow-blue-200 sm:rounded-[3rem] sm:p-8 lg:p-12">
          <div className="flex flex-col items-center gap-6 md:flex-row md:gap-8">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-white/20 sm:h-24 sm:w-24">
              <BookOpen className="w-10 h-10 text-white" />
            </div>
            <div className="text-center md:text-left">
              <h2 className="text-2xl font-bold">Always Within Reach</h2>
              <p className="mt-2 text-base leading-relaxed text-blue-100 sm:text-lg">
                Forgotten a mapping? The **Reference Drawer** is available anytime. Click the book icon or search for characters instantly.
              </p>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="space-y-6 py-10 text-center sm:py-12">
          <h2 className="text-3xl font-black text-slate-900">Ready to enter the flow?</h2>
          <div className="flex flex-col items-center gap-4">
            <div className="flex w-full flex-col items-stretch gap-4 sm:w-auto sm:flex-row sm:items-center">
              <Link 
                href="/"
                onClick={markAsVisited}
                className="group flex items-center justify-center gap-3 rounded-[2rem] bg-slate-900 px-8 py-4 text-base font-bold text-white shadow-2xl transition-all hover:bg-slate-800 hover:scale-105 active:scale-95 sm:px-12 sm:py-5 sm:text-lg"
              >
                <span>Launch Engine</span>
                <Sparkles className="w-5 h-5 text-amber-400 group-hover:rotate-12 transition-transform" />
              </Link>
              <Link
                href="/reader"
                onClick={markAsVisited}
                className="group flex items-center justify-center gap-3 rounded-[2rem] border border-slate-200 bg-white px-8 py-4 text-base font-bold text-slate-900 shadow-lg transition-all hover:scale-105 hover:bg-slate-50 active:scale-95 sm:px-12 sm:py-5 sm:text-lg"
              >
                <span>Open Reader</span>
                <BookOpen className="w-5 h-5 text-blue-600 group-hover:rotate-[-6deg] transition-transform" />
              </Link>
            </div>
            <p className="flex items-center gap-2 text-sm text-slate-400">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              Settings are saved automatically
            </p>
          </div>
        </section>

      </main>

      {/* Help Link Footer */}
      <footer className="relative z-10 space-y-4 border-t border-slate-100 bg-white/50 px-4 py-10 text-center backdrop-blur-sm sm:px-6 sm:py-12">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
          Scholarly Standard • Sanskrit Keyboard
        </p>
        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-8">
          <Link href="/help" className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-blue-600 hover:underline">
            <BookOpen className="w-3.5 h-3.5" />
            Full Documentation
          </Link>
          <a 
            href="https://github.com/mrgkumar/sanskrit-keyboard/issues" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-slate-500 transition-colors hover:text-rose-600 hover:underline"
          >
            <Bug className="w-3.5 h-3.5" />
            Report Issue
          </a>
        </div>
      </footer>
    </div>
  );
}
