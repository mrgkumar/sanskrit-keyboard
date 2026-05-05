'use client';

import React from 'react';
import Link from 'next/link';
import { 
  ChevronLeft, 
  BookOpen, 
  Keyboard, 
  Info,
  HelpCircle,
  ExternalLink,
  Sparkles,
  Bug
} from 'lucide-react';
import { VEDIC_MAPPINGS } from '@/lib/vedic/mapping';

export default function HelpPage() {
  const categories = [
    { id: 'vowel', label: 'Vowels', description: 'Independent vowels and their combinations.' },
    { id: 'consonant', label: 'Consonants', description: 'Standard Sanskrit consonants categorized by point of articulation.' },
    { id: 'vedic', label: 'Vedic Accents', description: 'Svaras used in Vedic recitation.' },
    { id: 'mark', label: 'Marks & Symbols', description: 'Anusvara, Visarga, Avagraha, and Nukta.' },
    { id: 'special', label: 'Special Characters', description: 'Common conjuncts, OM, and join controls.' },
    { id: 'number', label: 'Numbers', description: 'Devanagari numerals 0-9.' },
  ];

  const getMappingsByCategory = (cat: string) => {
    return VEDIC_MAPPINGS.filter(m => m.category === cat && !m.isAlias);
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between gap-4 border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur-md sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <Link 
            href="/"
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-blue-600 group"
          >
            <ChevronLeft className="w-5 h-5 group-active:scale-90 transition-transform" />
          </Link>
          <div className="h-6 w-[1px] bg-slate-200" />
          <h1 className="flex min-w-0 items-center gap-2 text-base font-bold tracking-tight text-slate-900 sm:text-lg">
            <HelpCircle className="w-5 h-5 text-blue-600" />
            <span className="truncate">Documentation & Help</span>
          </h1>
        </div>
        
        <Link
          href="/welcome"
          className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold uppercase tracking-widest text-slate-600 transition-colors hover:border-blue-200 hover:text-blue-600 sm:inline-flex"
        >
          <Sparkles className="w-4 h-4" />
          Interactive Walkthrough
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-12 px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
        {/* Intro */}
        <section className="space-y-4">
          <h2 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">ITRANS Transliteration Scheme</h2>
          <p className="max-w-3xl text-base leading-relaxed text-slate-600 sm:text-lg">
            Sanskrit Keyboard uses a scholarly-tuned version of the ITRANS scheme. 
            This guide provides a comprehensive reference for mapping Roman characters to Devanagari.
          </p>
          <div className="flex flex-col items-start gap-3 pt-2 sm:flex-row sm:items-center">
            <a 
              href="https://sanskritdocuments.org/learning_tools/sanskritvedic.html" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-bold text-sm text-blue-600 hover:underline"
            >
              Original ITRANS Reference
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </section>

        {/* Quick Tips */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
          <div className="rounded-3xl bg-blue-600 p-5 text-white shadow-xl shadow-blue-100 sm:p-6">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
              <Keyboard className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold">Greedy Matching</h3>
            <p className="mt-2 text-sm leading-relaxed text-blue-100">
              The engine always matches the longest possible sequence. For example, <kbd className="bg-white/10 px-1 rounded font-mono text-xs">kh</kbd> will be matched before <kbd className="bg-white/10 px-1 rounded font-mono text-xs">k</kbd>.
            </p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50">
              <Info className="w-5 h-5 text-amber-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Implicit &apos;a&apos;</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              Consonants are typed without the vowel. Typing <kbd className="bg-slate-100 px-1 rounded font-mono text-xs text-slate-700">k</kbd> results in <span className="font-serif">क्</span>. Add <kbd className="bg-slate-100 px-1 rounded font-mono text-xs text-slate-700">a</kbd> to get <span className="font-serif">क</span>.
            </p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50">
              <BookOpen className="w-5 h-5 text-purple-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Join Controls</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              Use <kbd className="bg-slate-100 px-1 rounded font-mono text-xs text-slate-700">^z</kbd> for ZWNJ (to prevent conjuncts) and <kbd className="bg-slate-100 px-1 rounded font-mono text-xs text-slate-700">^Z</kbd> for ZWJ.
            </p>
          </div>
        </div>

        {/* Examples Section */}
        <section className="space-y-8 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:rounded-[3rem] sm:p-8">
          <div className="space-y-2 text-center max-w-2xl mx-auto">
            <h3 className="text-2xl font-black tracking-tight text-slate-900">Real-world Examples</h3>
            <p className="text-sm text-slate-500">See how Vedic mantras from the Sri Suktam are typed using this scheme.</p>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
            {/* Example 1 */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-blue-600 font-bold text-xs uppercase tracking-widest">
                <Sparkles className="w-3.5 h-3.5" />
                Vedic Accents
              </div>
              <div className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50 p-5 sm:p-6">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">ITRANS Input</span>
                  <p className="break-all rounded-lg border border-slate-200/50 bg-white p-3 font-mono text-sm text-slate-700">
                    hiRa&apos;NyavarNAM॒ hari&apos;NIM
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Devanagari Output</span>
                  <p className="rounded-lg border border-slate-200/50 bg-white p-3 text-2xl font-serif text-slate-900">
                    हिर॑ण्यवर्णां॒ हरि॑णीम्
                  </p>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed italic">
                  Note the use of <kbd className="font-mono text-[10px] bg-slate-200/50 px-1 rounded">&apos;</kbd> for udatta and <kbd className="font-mono text-[10px] bg-slate-200/50 px-1 rounded">_</kbd> for anudatta.
                </p>
              </div>
            </div>

            {/* Example 2 */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-blue-600 font-bold text-xs uppercase tracking-widest">
                <Sparkles className="w-3.5 h-3.5" />
                Complex Conjuncts
              </div>
              <div className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50 p-5 sm:p-6">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">ITRANS Input</span>
                  <p className="break-all rounded-lg border border-slate-200/50 bg-white p-3 font-mono text-sm text-slate-700">
                    lo_ke deva&apos;juShTaamu_daaraam
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Devanagari Output</span>
                  <p className="rounded-lg border border-slate-200/50 bg-white p-3 text-2xl font-serif text-slate-900">
                    लो॒के देव॑जुष्टामु॒दाराम्
                  </p>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed italic">
                  The engine automatically handles clusters like <span className="font-serif italic">ष्ट</span> (ShTa) and <span className="font-serif italic">प्र</span> (pra).
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Mapping Tables */}
        <div className="space-y-10 sm:space-y-12">
          {categories.map(cat => {
            const items = getMappingsByCategory(cat.id);
            if (items.length === 0) return null;

            return (
              <section key={cat.id} className="space-y-6">
                <div className="border-b border-slate-200 pb-4">
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight capitalize">{cat.label}</h3>
                  <p className="text-slate-500 text-sm mt-1">{cat.description}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {items.map((m, i) => (
                    <div 
                      key={i}
                      className="group flex flex-col items-center justify-center gap-2 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm transition-colors hover:border-blue-200 sm:p-4"
                    >
                      <span className="text-2xl font-serif text-slate-900 transition-transform group-hover:scale-110 sm:text-3xl">
                        {m.unicode}
                      </span>
                      <kbd className="px-2 py-1 bg-slate-50 border border-slate-200 rounded text-blue-600 font-mono font-bold text-xs">
                        {m.itrans}
                      </kbd>
                      {m.name && (
                        <span className="line-clamp-1 text-center text-[10px] font-bold uppercase tracking-tighter text-slate-400">
                          {m.name}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        {/* Closing */}
        <footer className="space-y-6 border-t border-slate-200 pt-10 text-center sm:pt-12">
          <div className="space-y-2">
            <p className="text-slate-400 text-sm font-medium">
              Developed for scholarly research. Settings are persisted locally.
            </p>
            <div className="flex flex-col items-center gap-4 pt-2">
              <a
                href="https://github.com/mrgkumar/sanskrit-keyboard/issues" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-5 py-3 text-xs font-bold uppercase tracking-widest text-slate-600 transition-all hover:bg-slate-200 hover:text-slate-900 active:scale-95"
              >
                <Bug className="w-4 h-4 text-rose-500" />
                Report an Issue on GitHub
              </a>
            </div>
          </div>
          <div className="flex flex-col justify-center gap-3 pt-4 sm:flex-row sm:gap-8">
            <Link href="/" className="text-blue-600 font-bold text-sm hover:underline">Return to Workspace</Link>
            <Link href="/welcome" className="text-blue-600 font-bold text-sm hover:underline">Restart Walkthrough</Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
