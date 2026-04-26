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
    <div className="flex flex-col min-h-screen bg-slate-50 font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Background Decor */}
      <div className="fixed top-0 right-0 w-[600px] h-[600px] bg-blue-100/30 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
      <div className="fixed bottom-0 left-0 w-[400px] h-[400px] bg-amber-100/20 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2 pointer-events-none" />

      {/* Header */}
      <header className="flex flex-col items-center pt-20 pb-12 shrink-0 relative z-10">
        <div className="w-20 h-20 bg-blue-600 rounded-[2rem] flex items-center justify-center mb-8 shadow-2xl shadow-blue-200 animate-in zoom-in duration-700">
          <span className="text-white font-black text-4xl">S</span>
        </div>
        <h1 className="text-4xl font-black text-slate-900 tracking-tight text-center px-4">
          The Invisible Interface
        </h1>
        <p className="text-slate-500 font-bold uppercase text-xs tracking-[0.4em] mt-4 text-center">
          Sanskrit Keyboard Walkthrough
        </p>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-6 pb-24 relative z-10 space-y-24">
        
        {/* Philosophy */}
        <section className="space-y-6 text-center">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-slate-800">Typing, Transformed</h2>
            <p className="mt-4 text-lg text-slate-600 leading-relaxed">
              Sanskrit Keyboard is designed for scholars who need to move at the speed of thought. 
              No menus, no distractions—just a fluid transliteration experience that learns your patterns.
            </p>
          </div>
        </section>

        {/* Attributes & Inspiration */}
        <section className="max-w-3xl mx-auto py-12 px-8 rounded-[2.5rem] bg-white border border-slate-100 shadow-sm space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">Attributes & Inspiration</h2>
            <div className="w-12 h-1 bg-blue-600 mx-auto rounded-full" />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-8 text-sm leading-relaxed">
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

            <div className="lg:col-span-4 md:col-span-2 space-y-4 pt-4 border-t border-slate-50">
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Feature 1: ITRANS */}
          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
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
          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
            <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
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
          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
            <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
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
          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
            <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
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
        <section className="bg-blue-600 rounded-[3rem] p-12 text-white shadow-2xl shadow-blue-200">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center shrink-0">
              <BookOpen className="w-10 h-10 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Always Within Reach</h2>
              <p className="mt-2 text-blue-100 leading-relaxed text-lg">
                Forgotten a mapping? The **Reference Drawer** is available anytime. Click the book icon or search for characters instantly.
              </p>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="text-center py-12 space-y-8">
          <h2 className="text-3xl font-black text-slate-900">Ready to enter the flow?</h2>
          <div className="flex flex-col items-center gap-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <Link 
                href="/"
                onClick={markAsVisited}
                className="flex items-center justify-center gap-3 px-12 py-5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-[2rem] shadow-2xl transition-all hover:scale-105 active:scale-95 group text-lg"
              >
                <span>Launch Engine</span>
                <Sparkles className="w-5 h-5 text-amber-400 group-hover:rotate-12 transition-transform" />
              </Link>
              <Link
                href="/reader"
                onClick={markAsVisited}
                className="flex items-center justify-center gap-3 px-12 py-5 bg-white hover:bg-slate-50 text-slate-900 font-bold rounded-[2rem] border border-slate-200 shadow-lg transition-all hover:scale-105 active:scale-95 group text-lg"
              >
                <span>Open Reader</span>
                <BookOpen className="w-5 h-5 text-blue-600 group-hover:rotate-[-6deg] transition-transform" />
              </Link>
            </div>
            <p className="text-slate-400 text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              Settings are saved automatically
            </p>
          </div>
        </section>

      </main>

      {/* Help Link Footer */}
      <footer className="px-8 py-12 border-t border-slate-100 text-center relative z-10 bg-white/50 backdrop-blur-sm space-y-4">
        <p className="text-slate-400 text-xs font-medium uppercase tracking-[0.2em]">
          Scholarly Standard • Sanskrit Keyboard
        </p>
        <div className="flex justify-center items-center gap-8">
          <Link href="/help" className="text-blue-600 font-bold text-xs uppercase tracking-widest hover:underline flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5" />
            Full Documentation
          </Link>
          <a 
            href="https://github.com/mrgkumar/sanskrit-keyboard/issues" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-slate-500 hover:text-rose-600 font-bold text-xs uppercase tracking-widest hover:underline flex items-center gap-1.5 transition-colors"
          >
            <Bug className="w-3.5 h-3.5" />
            Report Issue
          </a>
        </div>
      </footer>
    </div>
  );
}
