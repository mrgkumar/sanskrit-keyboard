'use client';

import React, { useState } from 'react';
import { DISPLAY_MAPPINGS, getAcceptedInputs, getAlternateAcceptedInputs } from '@/lib/vedic/mapping';
import { Search, Edit3, Command } from 'lucide-react';
import { useFlowStore } from '@/store/useFlowStore';

export const MappingManager: React.FC = () => {
  const [search, setSearch] = useState('');
  const inputScheme = useFlowStore((state) => state.displaySettings.inputScheme);
  
  const filteredMappings = DISPLAY_MAPPINGS.filter((m) =>
    m.itrans.toLowerCase().includes(search.toLowerCase()) ||
    getAcceptedInputs(m.itrans, inputScheme).some((input) => input.toLowerCase().includes(search.toLowerCase())) ||
    m.unicode.includes(search)
  );

  return (
    <div className="flex flex-col gap-6 p-8 bg-white rounded-3xl border border-slate-100 shadow-sm h-full overflow-hidden">
      <div className="flex items-center justify-between shrink-0">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Active Mapping Library</h3>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text"
            placeholder="Search ITRANS or Unicode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-blue-300 w-64 transition-all"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
        {filteredMappings.map((m, i) => (
          <div key={i} className="flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100/50 rounded-2xl border border-slate-100 transition-colors group">
            <div className="flex items-center gap-6">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center border border-slate-200 shadow-sm group-hover:scale-110 transition-transform">
                <span className="text-2xl font-serif text-slate-900">{m.unicode}</span>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">ITRANS Input</p>
                <code className="text-sm font-bold text-slate-700 bg-slate-200/50 px-2 py-0.5 rounded font-mono">
                  {m.itrans}
                </code>
                {getAlternateAcceptedInputs(m.itrans, inputScheme).length > 0 && (
                  <p className="text-[11px] text-slate-500">
                    Also accepts <span className="font-mono">{getAlternateAcceptedInputs(m.itrans, inputScheme).join(', ')}</span>
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Shortcut</p>
                <p className="text-xs font-bold text-slate-600">Auto-learned</p>
              </div>
              <button className="p-2 hover:bg-white text-slate-400 hover:text-blue-600 rounded-lg transition-all active:scale-90 border border-transparent hover:border-blue-100 hover:shadow-sm">
                <Edit3 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="shrink-0 p-4 bg-amber-50 rounded-2xl border border-amber-100 flex items-center gap-3">
        <Command className="w-5 h-5 text-amber-600" />
        <p className="text-[10px] font-bold text-amber-800 leading-normal">
          Shortcut conflicts are automatically detected. Your custom mappings take priority over standard ITRANS during flow sessions.
        </p>
      </div>
    </div>
  );
};
