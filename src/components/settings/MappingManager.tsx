'use client';

import React, { useState } from 'react';
import { getDisplayMappingsForScheme, getAcceptedInputs, getAlternateAcceptedInputs } from '@/lib/vedic/mapping';
import { Search, Command } from 'lucide-react';
import { useFlowStore } from '@/store/useFlowStore';

export const MappingManager: React.FC = () => {
  const [search, setSearch] = useState('');
  const { displaySettings } = useFlowStore();
  const { inputScheme, primaryOutputScript } = displaySettings;
  
  const allMappings = getDisplayMappingsForScheme(primaryOutputScript);
  const filteredMappings = allMappings.filter((m) =>
    m.itrans.toLowerCase().includes(search.toLowerCase()) ||
    getAcceptedInputs(m.itrans, inputScheme).some((input) => input.toLowerCase().includes(search.toLowerCase())) ||
    m.unicode.includes(search)
  );

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden rounded-3xl border border-slate-100 bg-white p-4 shadow-sm sm:gap-6 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-3 shrink-0 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-bold uppercase tracking-widest text-slate-900">Active Mapping Library</h3>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text"
            placeholder="Search ITRANS or Unicode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm font-bold transition-all focus:border-blue-300 focus:outline-none sm:w-64 sm:py-2 sm:text-xs"
          />
        </div>
      </div>

      <div className="custom-scrollbar flex-1 space-y-3 overflow-y-auto pr-1 sm:pr-2">
        {filteredMappings.map((m, i) => (
          <div key={i} className="group flex flex-col gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 transition-colors hover:bg-slate-100/50 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4 sm:gap-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm transition-transform group-hover:scale-110">
                <span className="text-2xl font-serif text-slate-900">{m.unicode}</span>
              </div>
              <div className="min-w-0 space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">ITRANS Input</p>
                <code className="rounded bg-slate-200/50 px-2 py-0.5 font-mono text-sm font-bold text-slate-700">
                  {m.itrans}
                </code>
                {getAlternateAcceptedInputs(m.itrans, inputScheme).length > 0 && (
                  <p className="text-[11px] text-slate-500">
                    Also accepts <span className="font-mono">{getAlternateAcceptedInputs(m.itrans, inputScheme).join(', ')}</span>
                  </p>
                )}
              </div>
            </div>

            <div className="text-left sm:text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Mode</p>
              <p className="text-xs font-bold text-slate-600">Read-only</p>
            </div>
          </div>
        ))}
      </div>

      <div className="shrink-0 flex items-start gap-3 rounded-2xl border border-amber-100 bg-amber-50 p-4">
        <Command className="w-5 h-5 text-amber-600" />
        <p className="text-[10px] font-bold leading-normal text-amber-800">
          This page is a read-only mapping library. Custom mapping editing is not wired in the current runtime.
        </p>
      </div>
    </div>
  );
};
