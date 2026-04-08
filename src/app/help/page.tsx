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
  Sparkles
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
    <div className="flex flex-col min-h-screen bg-slate-50 font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link 
            href="/"
            className="p-2 hover:bg-slate-100 text-slate-400 hover:text-blue-600 rounded-lg transition-colors group"
          >
            <ChevronLeft className="w-5 h-5 group-active:scale-90 transition-transform" />
          </Link>
          <div className="w-[1px] h-6 bg-slate-200" />
          <h1 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-blue-600" />
            Documentation & Help
          </h1>
        </div>
        
        <Link 
          href="/welcome"
          className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-blue-600 font-bold text-xs uppercase tracking-widest transition-colors"
        >
          <Sparkles className="w-4 h-4" />
          Interactive Walkthrough
        </Link>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-8 py-12 space-y-16">
        {/* Intro */}
        <section className="space-y-4">
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">ITRANS Transliteration Scheme</h2>
          <p className="text-lg text-slate-600 leading-relaxed max-w-3xl">
            Sanskirt Keyboard uses a scholarly-tuned version of the ITRANS scheme. 
            This guide provides a comprehensive reference for mapping Roman characters to Devanagari.
          </p>
          <div className="flex items-center gap-4 pt-2">
            <a 
              href="https://sanskritdocuments.org/learning_tools/sanskritvedic.html" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-blue-600 font-bold text-sm hover:underline"
            >
              Original ITRANS Reference
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </section>

        {/* Quick Tips */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-blue-600 p-6 rounded-3xl text-white shadow-xl shadow-blue-100">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-4">
              <Keyboard className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-lg">Greedy Matching</h3>
            <p className="text-blue-100 text-sm mt-2 leading-relaxed">
              The engine always matches the longest possible sequence. For example, <kbd className="bg-white/10 px-1 rounded font-mono text-xs">kh</kbd> will be matched before <kbd className="bg-white/10 px-1 rounded font-mono text-xs">k</kbd>.
            </p>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center mb-4">
              <Info className="w-5 h-5 text-amber-600" />
            </div>
            <h3 className="font-bold text-lg text-slate-900">Implicit &apos;a&apos;</h3>
            <p className="text-slate-500 text-sm mt-2 leading-relaxed">
              Consonants are typed without the vowel. Typing <kbd className="bg-slate-100 px-1 rounded font-mono text-xs text-slate-700">k</kbd> results in <span className="font-serif">क्</span>. Add <kbd className="bg-slate-100 px-1 rounded font-mono text-xs text-slate-700">a</kbd> to get <span className="font-serif">क</span>.
            </p>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center mb-4">
              <BookOpen className="w-5 h-5 text-purple-600" />
            </div>
            <h3 className="font-bold text-lg text-slate-900">Join Controls</h3>
            <p className="text-slate-500 text-sm mt-2 leading-relaxed">
              Use <kbd className="bg-slate-100 px-1 rounded font-mono text-xs text-slate-700">^z</kbd> for ZWNJ (to prevent conjuncts) and <kbd className="bg-slate-100 px-1 rounded font-mono text-xs text-slate-700">^Z</kbd> for ZWJ.
            </p>
          </div>
        </div>

        {/* Examples Section */}
        <section className="space-y-8 bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm">
          <div className="space-y-2 text-center max-w-2xl mx-auto">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">Real-world Examples</h3>
            <p className="text-slate-500 text-sm">See how Vedic mantras from the Sri Suktam are typed using this scheme.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Example 1 */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-blue-600 font-bold text-xs uppercase tracking-widest">
                <Sparkles className="w-3.5 h-3.5" />
                Vedic Accents
              </div>
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">ITRANS Input</span>
                  <p className="font-mono text-sm text-slate-700 bg-white p-3 rounded-lg border border-slate-200/50 break-all">
                    hiRa&apos;NyavarNAM॒ hari&apos;NIM
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Devanagari Output</span>
                  <p className="text-2xl font-serif text-slate-900 bg-white p-3 rounded-lg border border-slate-200/50">
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
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">ITRANS Input</span>
                  <p className="font-mono text-sm text-slate-700 bg-white p-3 rounded-lg border border-slate-200/50 break-all">
                    lo_ke deva&apos;juShTaamu_daaraam
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Devanagari Output</span>
                  <p className="text-2xl font-serif text-slate-900 bg-white p-3 rounded-lg border border-slate-200/50">
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
        <div className="space-y-12">
          {categories.map(cat => {
            const items = getMappingsByCategory(cat.id);
            if (items.length === 0) return null;

            return (
              <section key={cat.id} className="space-y-6">
                <div className="border-b border-slate-200 pb-4">
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight capitalize">{cat.label}</h3>
                  <p className="text-slate-500 text-sm mt-1">{cat.description}</p>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {items.map((m, i) => (
                    <div 
                      key={i}
                      className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center gap-2 group hover:border-blue-200 transition-colors"
                    >
                      <span className="text-3xl font-serif text-slate-900 group-hover:scale-110 transition-transform">
                        {m.unicode}
                      </span>
                      <kbd className="px-2 py-1 bg-slate-50 border border-slate-200 rounded text-blue-600 font-mono font-bold text-xs">
                        {m.itrans}
                      </kbd>
                      {m.name && (
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter text-center line-clamp-1">
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
        <footer className="pt-12 border-t border-slate-200 text-center space-y-4">
          <p className="text-slate-400 text-sm font-medium">
            Developed for scholarly research. Settings are persisted locally.
          </p>
          <div className="flex justify-center gap-8">
            <Link href="/" className="text-blue-600 font-bold text-sm hover:underline">Return to Workspace</Link>
            <Link href="/welcome" className="text-blue-600 font-bold text-sm hover:underline">Restart Walkthrough</Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
