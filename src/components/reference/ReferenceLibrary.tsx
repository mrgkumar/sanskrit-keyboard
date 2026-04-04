'use client';

import React, { useState, useEffect, useRef } from 'react';
import { DISPLAY_MAPPINGS, getAcceptedInputs, getAlternateAcceptedInputs, getInputMappings } from '@/lib/vedic/mapping';
import { Search } from 'lucide-react';
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
  } = useFlowStore();
  const { inputScheme } = displaySettings;
  const activeMappings = getInputMappings(inputScheme);

  const handleInsert = (itrans: string) => {
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

  const categories = ['vowel', 'consonant', 'vedic', 'mark', 'special'];
  
  const filteredMappings = DISPLAY_MAPPINGS.filter((m) => {
    const acceptedInputs = getAcceptedInputs(m.itrans, inputScheme).join(' ');
    return (
      fuzzySearch(search, m.itrans) ||
      fuzzySearch(search, acceptedInputs) ||
      fuzzySearch(search, m.name || '')
    );
  });

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
  }, [deletedBuffer, activeBuffer, activeMappings]); // Depend on deletedBuffer and activeBuffer

  return (
    <div className="w-full h-full flex flex-col">
      {/* Header */}
      <div className="p-8 border-b border-slate-100 bg-slate-50/50">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">ITRANS Mapping Reference</h2>
          <p className="text-slate-500 text-sm mt-1">A guide for scholars to type Vedic Sanskrit with precision.</p>
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
      <div ref={containerRef} className="flex-1 overflow-y-auto p-8 grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        {categories.map(cat => {
          const catMappings = filteredMappings
            .filter(m => m.category === cat)
            .sort((a, b) => {
              if (a.unicode !== b.unicode) return a.unicode.localeCompare(b.unicode);
              return a.itrans.length - b.itrans.length;
            });
            
          if (catMappings.length === 0) return null;
          
          return (
            <div key={cat} className="space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 pl-2 bg-blue-50/50 py-1 rounded w-fit px-3">{cat}s</h3>
              <div className="space-y-1">
                {catMappings.map((m, i) => (
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
                          Also accepts {getAlternateAcceptedInputs(m.itrans, inputScheme).join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Join Control Shortcuts */}
      <div className="border-t border-slate-100 bg-white/70 px-6 py-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Zero-width joiners</p>
            <p className="mt-1 text-xs text-slate-500">Use these when you need to force or suppress a conjunct.</p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
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

      {/* Footer */}
      <div className="p-6 bg-slate-50 text-center border-t border-slate-100">
        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
          Scholarly Standard • Optimized for Flow State
        </p>
      </div>
    </div>
  );
};
