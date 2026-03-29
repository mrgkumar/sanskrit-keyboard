'use client';

import React, { useState, useEffect, useRef } from 'react';
import { VEDIC_MAPPINGS, MAPPING_TRIE } from '@/lib/vedic/mapping';
import { Search } from 'lucide-react';
import { useFlowStore } from '@/store/useFlowStore';

interface ReferenceLibraryProps {
  deletedBuffer: string | null;
  activeBuffer: string;
}

export const ReferenceLibrary: React.FC<ReferenceLibraryProps> = ({ deletedBuffer, activeBuffer }) => {
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const { updateChunkSource, getActiveChunkGroup, toggleReferencePanel, composerSelectionStart, composerSelectionEnd } = useFlowStore();

  const handleInsert = (itrans: string) => {
    const activeChunkGroup = getActiveChunkGroup();
    if (activeChunkGroup) {
      const start = Math.max(0, Math.min(composerSelectionStart, activeChunkGroup.source.length));
      const end = Math.max(start, Math.min(composerSelectionEnd, activeChunkGroup.source.length));
      const newSource =
        activeChunkGroup.source.slice(0, start) +
        itrans +
        activeChunkGroup.source.slice(end);
      const nextCaret = start + itrans.length;
      updateChunkSource(newSource, nextCaret, nextCaret);
      toggleReferencePanel();
    }
  };

  const escapeCssSelector = (str: string) => {
    // Escapes characters with special meaning in CSS selectors.
    // The characters to escape are: ", ', \, and /
    return str.replace(/["'\\/]/g, '\\$&');
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
  
  const filteredMappings = VEDIC_MAPPINGS.filter(m => 
    fuzzySearch(search, m.itrans) || fuzzySearch(search, m.name || '')
  );

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
        if (MAPPING_TRIE.some(m => m.itrans === suffix)) {
          longestMatch = suffix;
          break;
        }
      }
      targetItrans = longestMatch;
    }

    if (targetItrans && containerRef.current) {
      const safeSelector = escapeCssSelector(targetItrans);
      const element = containerRef.current.querySelector(`[data-itrans="${safeSelector}"]`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [deletedBuffer, activeBuffer]); // Depend on deletedBuffer and activeBuffer

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
                    className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl hover:shadow-md hover:border-blue-200 hover:bg-blue-50/30 transition-all group cursor-pointer active:scale-95"
                  >
                    <span className="text-3xl font-serif text-slate-900 group-hover:scale-110 transition-transform">{m.unicode}</span>
                    <kbd className="px-2 py-1 bg-slate-50 border border-slate-200 rounded text-blue-600 font-mono font-bold text-sm tracking-tight">{m.itrans}</kbd>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
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
