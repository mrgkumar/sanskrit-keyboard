'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  getDisplayMappingsForScheme,
  getAcceptedInputs,
  getAlternateAcceptedInputs,
  getInputMappings,
} from '@/lib/vedic/mapping';
import { Search, ChevronRight, ChevronDown, Sparkles } from 'lucide-react';
import { useFlowStore } from '@/store/useFlowStore';
import type { ChunkEditTarget } from '@/store/types';

interface ReferenceLibraryProps {
  deletedBuffer: string | null;
  activeBuffer: string;
}

const JOIN_CONTROL_SHORTCUTS = [
  {
    label: 'ZWNJ',
    shortcut: '^z',
    name: 'Zero Width Non-Joiner',
    description: 'Blocks the conjunct so the letters stay visually separate.',
    example: 'क्‌ष',
    exampleLabel: 'k + virama + ZWNJ + ṣa',
  },
  {
    label: 'ZWJ',
    shortcut: '^Z',
    name: 'Zero Width Joiner',
    description: 'Encourages the conjunct when the font supports it.',
    example: 'क्‍ष',
    exampleLabel: 'k + virama + ZWJ + ṣa',
  },
] as const;

export const ReferenceLibrary: React.FC<ReferenceLibraryProps> = ({ deletedBuffer, activeBuffer }) => {
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const {
    updateChunkSource,
    getActiveChunkGroup,
    toggleReferencePanel,
    composerSelectionStart,
    composerSelectionEnd,
    displaySettings,
    incrementReferenceUsage,
    toggleReferenceCategory,
  } = useFlowStore();
  const { inputScheme, primaryOutputScript, referenceUsage, expandedCategories } = displaySettings;
  const activeMappings = getInputMappings(inputScheme);
  const displayMappings = getDisplayMappingsForScheme(primaryOutputScript);

  const handleInsert = (itrans: string) => {
    incrementReferenceUsage(itrans);
    const activeChunkGroup = getActiveChunkGroup();
    if (activeChunkGroup) {
      const editTarget: ChunkEditTarget | undefined = activeChunkGroup.blockId
        ? {
            blockId: activeChunkGroup.blockId,
            startSegmentIndex: activeChunkGroup.startSegmentIndex,
            endSegmentIndex: activeChunkGroup.endSegmentIndex,
            source: activeChunkGroup.source,
          }
        : undefined;
      const start = Math.max(0, Math.min(composerSelectionStart, activeChunkGroup.source.length));
      const end = Math.max(start, Math.min(composerSelectionEnd, activeChunkGroup.source.length));
      const newSource =
        activeChunkGroup.source.slice(0, start) +
        itrans +
        activeChunkGroup.source.slice(end);
      const nextCaret = start + itrans.length;
      updateChunkSource(newSource, nextCaret, nextCaret, editTarget);
      toggleReferencePanel();
    }
  };

  const fuzzySearch = (term: string, text: string) => {
    const termChars = term.replace(/\s+/g, '').toLowerCase();
    const textChars = text.toLowerCase();
    let termIndex = 0;
    let textIndex = 0;
    while (termIndex < termChars.length && textIndex < textChars.length) {
      if (termChars[termIndex] === textChars[textIndex]) {
        termIndex++;
      }
      textIndex++;
    }
    return termIndex === termChars.length;
  };

  const categories = ['vowel', 'consonant', 'number', 'vedic', 'mark', 'special'];
  
  const filteredMappings = displayMappings.filter((m) => {
    const acceptedInputs = getAcceptedInputs(m.itrans, inputScheme).join(' ');
    return (
      fuzzySearch(search, m.itrans) ||
      fuzzySearch(search, acceptedInputs) ||
      fuzzySearch(search, m.name || '')
    );
  });

  const title = primaryOutputScript === 'tamil' ? 'Tamil Transliteration Reference' : 'ITRANS Mapping Reference';
  const description = primaryOutputScript === 'tamil' ? 'A guide for scholars to type Sanskrit in Tamil script with precision.' : 'A guide for scholars to type Vedic Sanskrit with precision.';

  useEffect(() => {
    let targetItrans: string | null = null;

    if (deletedBuffer) {
      // Prioritize scrolling based on the deleted character
      targetItrans = deletedBuffer;
      // Clear deletedBuffer after using it for scroll
      useFlowStore.setState({ deletedBuffer: null });
    } else if (activeBuffer) {
      // Fallback to activeBuffer if no specific deleted char
      let longestMatch = '';
      for (let i = 0; i < activeBuffer.length; i++) {
        const suffix = activeBuffer.substring(i);
        if (activeMappings.some((m) => m.itrans === suffix)) {
          longestMatch = suffix;
          break;
        }
      }
      targetItrans = longestMatch;
    }

    if (targetItrans && containerRef.current) {
      const element = Array.from(containerRef.current.querySelectorAll<HTMLElement>('[data-itrans]'))
        .find((node) => node.dataset.itrans === targetItrans);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [deletedBuffer, activeBuffer, activeMappings, primaryOutputScript]); // Added primaryOutputScript to dependencies

  const bestGuessMappings = Object.entries(referenceUsage)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([itrans]) => displayMappings.find((m) => m.itrans === itrans))
    .filter((m): m is NonNullable<typeof m> => !!m);

  return (
    <div className="w-full h-full flex flex-col">
      {/* Header */}
      <div className="p-8 border-b border-slate-100 bg-slate-50/50">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
          <p className="text-slate-500 text-sm mt-1">{description}</p>
          {primaryOutputScript === 'tamil' && (
            <div className="mt-4 p-3 bg-blue-50/50 rounded-lg border border-blue-100 text-blue-800">
              <p className="text-xs font-bold uppercase tracking-wide">Vedic Swara Representation (Tamil)</p>
              <p className="mt-1 text-sm">
                Vedic accents (Svaras) like {'&apos;'} (udatta), {'_'} (anudatta), {'&apos;&apos;'} (double svarita) are represented by their ITRANS codes in square brackets (e.g., <span className="font-mono">[&apos;]</span> for udatta) in Tamil script, as direct equivalents are not available.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="p-6 border-b border-slate-100 relative">
        <Search className="absolute left-10 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
        <input 
          type="text" 
          placeholder="Search characters or shortcuts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        className="w-full pl-12 pr-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:outline-none focus:border-blue-500 transition-all text-lg"
        />
      </div>

      {/* Mappings List */}
      <div ref={containerRef} className="flex-1 overflow-y-auto p-8 flex flex-col gap-6">
        {/* Best Guess Section */}
        {bestGuessMappings.length > 0 && !search && (
          <div className="space-y-4 mb-2">
            <h3 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-amber-600 pl-2 bg-amber-50/50 py-1 rounded w-fit px-3">
              <Sparkles className="w-3 h-3" /> Quick Access
            </h3>
            <div className="grid grid-cols-4 gap-2">
              {bestGuessMappings.map((m, i) => (
                <div
                  key={`best-${i}`}
                  onClick={() => handleInsert(m.itrans)}
                  className="flex flex-col items-center justify-center p-3 bg-white border border-slate-100 rounded-xl hover:shadow-md hover:border-amber-200 hover:bg-amber-50/30 transition-all group cursor-pointer active:scale-95"
                >
                  <span className="text-2xl font-serif text-slate-900 group-hover:scale-110 transition-transform">{m.unicode}</span>
                  <kbd className="mt-1 px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded text-[10px] text-amber-700 font-mono font-bold">{m.itrans}</kbd>
                </div>
              ))}
            </div>
          </div>
        )}

        {categories.map(cat => {
          const catMappings = filteredMappings.filter(m => m.category === cat);
          if (catMappings.length === 0) return null;

          const isExpanded = expandedCategories.includes(cat) || search.length > 0;
          
          // Group by subCategory
          const subGroups: Record<string, typeof catMappings> = {};
          catMappings.forEach(m => {
            const sub = m.subCategory || 'Standard';
            if (!subGroups[sub]) subGroups[sub] = [];
            subGroups[sub].push(m);
          });

          return (
            <div key={cat} className="space-y-3">
              <button 
                onClick={() => toggleReferenceCategory(cat)}
                className="w-full flex items-center justify-between gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 pl-2 bg-blue-50/50 py-2 rounded-lg px-3 group hover:bg-blue-100/50 transition-colors"
              >
                <span className="capitalize">{cat}s</span>
                {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              </button>
              
              {isExpanded && (
                <div className="space-y-6 pt-1 animate-in fade-in slide-in-from-top-1 duration-200">
                  {Object.entries(subGroups).sort(([a], [b]) => {
                    if (a === 'Standard') return -1;
                    if (b === 'Standard') return 1;
                    return a.localeCompare(b);
                  }).map(([subName, items]) => (
                    <div key={subName} className="space-y-3">
                      {subName !== 'Standard' && (
                        <h4 className="text-[9px] font-bold uppercase tracking-widest text-slate-400 ml-1">{subName}</h4>
                      )}
                      <div className="grid grid-cols-1 gap-1">
                        {items.sort((a, b) => {
                          if (a.unicode !== b.unicode) return a.unicode.localeCompare(b.unicode);
                          return a.itrans.length - b.itrans.length;
                        }).map((m, i) => (
                          <div
                            key={i}
                            onClick={() => handleInsert(m.itrans)}
                            data-itrans={m.itrans}
                            className="flex items-center justify-between gap-4 p-3 bg-white border border-slate-100 rounded-xl hover:shadow-md hover:border-blue-200 hover:bg-blue-50/30 transition-all group cursor-pointer active:scale-95"
                          >
                            <span className="text-3xl font-serif text-slate-900 group-hover:scale-110 transition-transform">{m.unicode}</span>
                            <div className="min-w-0 text-right">
                              <kbd className="inline-flex px-2 py-1 bg-slate-50 border border-slate-200 rounded text-blue-600 font-mono font-bold text-sm tracking-tight">{m.itrans}</kbd>
                              {getAlternateAcceptedInputs(m.itrans, inputScheme).length > 0 && (
                                <p className="mt-1 text-[10px] font-medium text-slate-400">
                                  Also {getAlternateAcceptedInputs(m.itrans, inputScheme).join(', ')}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {/* Zero-width joiners - Now inside scrollable area */}
        <div className="mt-4 border-t border-slate-100 pt-8 pb-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Zero-width joiners</p>
              <p className="mt-1 text-xs text-slate-500">Use these when you need to force or suppress a conjunct.</p>
            </div>
          </div>
          <div className="grid gap-3">
            {JOIN_CONTROL_SHORTCUTS.map((shortcut) => (
              <button
                key={shortcut.label}
                type="button"
                onClick={() => handleInsert(shortcut.shortcut)}
                className="group flex min-w-0 flex-1 items-start justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-left transition-all hover:border-blue-200 hover:bg-blue-50/40 hover:shadow-md active:scale-[0.99]"
              >
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-700">{shortcut.label}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{shortcut.name}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {shortcut.description}
                  </p>
                  <p className="mt-2 text-xs font-medium text-slate-600">
                    Example: <span className="font-serif text-sm text-slate-900" dir="ltr">{shortcut.example}</span>
                    <span className="ml-2 text-[10px] uppercase tracking-[0.12em] text-slate-400">({shortcut.exampleLabel})</span>
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs font-bold text-slate-700 transition-colors group-hover:border-blue-200 group-hover:text-blue-700">
                  {shortcut.shortcut}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>




      <div className="p-6 bg-slate-50 text-center border-t border-slate-100">
        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
          Scholarly Standard • Optimized for Flow State
        </p>
      </div>
    </div>
  );
};
