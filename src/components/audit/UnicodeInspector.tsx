'use client';

import React from 'react';
import { SearchCode, Fingerprint, ShieldCheck, AlertCircle } from 'lucide-react';

interface CharConfidence {
  char: string;
  confidence: number;
  rationale?: string;
}

export const UnicodeInspector: React.FC<{ 
  selectedChar?: string;
  confidence?: CharConfidence;
}> = ({ selectedChar, confidence }) => {
  if (!selectedChar) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
        <Fingerprint className="w-12 h-12 text-slate-200 mb-4" />
        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
          Select a character<br />to inspect precision data
        </p>
      </div>
    );
  }

  const codePoint = selectedChar.codePointAt(0)?.toString(16).toUpperCase().padStart(4, '0');
  const isHighConfidence = (confidence?.confidence || 1) >= 0.8;

  return (
    <div className="flex flex-col gap-6 p-6 bg-white rounded-3xl border border-slate-100 shadow-sm h-full overflow-y-auto">
      <div className="flex items-center gap-2 text-slate-900">
        <SearchCode className="w-5 h-5 text-blue-500" />
        <h3 className="text-sm font-bold uppercase tracking-widest">Precision Metadata</h3>
      </div>

      <div className="flex flex-col items-center gap-4 py-8 bg-slate-50 rounded-2xl border border-slate-100 relative overflow-hidden">
        {/* Confidence Watermark */}
        <div className={`absolute -right-4 -top-4 w-24 h-24 rotate-12 opacity-10 flex items-center justify-center`}>
          {isHighConfidence ? <ShieldCheck className="w-full h-full text-emerald-600" /> : <AlertCircle className="w-full h-full text-amber-600" />}
        </div>

        <span className="text-7xl font-serif text-slate-900 z-10">{selectedChar}</span>
        <code className="px-3 py-1.5 bg-slate-900 text-amber-400 text-lg font-bold rounded-lg font-mono z-10">
          U+{codePoint}
        </code>
      </div>

      <div className="space-y-4">
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Engine Confidence</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 ${isHighConfidence ? 'bg-emerald-500' : 'bg-amber-500'}`} 
                style={{ width: `${(confidence?.confidence || 1) * 100}%` }}
              />
            </div>
            <span className={`text-xs font-bold ${isHighConfidence ? 'text-emerald-600' : 'text-amber-600'}`}>
              {Math.round((confidence?.confidence || 1) * 100)}%
            </span>
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Input Rationale</p>
          <p className="text-xs font-bold text-slate-700 leading-tight">
            {confidence?.rationale || 'Direct character input'}
          </p>
        </div>
        
        <div className="w-full h-[1px] bg-slate-100" />

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Script Type</p>
            <p className="text-xs font-bold text-slate-700">Devanagari</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Normalization</p>
            <p className="text-xs font-bold text-slate-700 italic">Canonical NFC</p>
          </div>
        </div>
      </div>

      <div className={`mt-auto p-4 rounded-xl border ${isHighConfidence ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'}`}>
        <p className={`text-[10px] font-bold leading-normal italic ${isHighConfidence ? 'text-emerald-700' : 'text-amber-700'}`}>
          {isHighConfidence 
            ? "Verified for searchable archives and future-proof digital rendering." 
            : "Requires visual confirmation. Predicted by adaptive learning engine."}
        </p>
      </div>
    </div>
  );
};
