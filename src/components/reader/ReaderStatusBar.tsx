'use client';

import { useReaderStore } from '@/store/useReaderStore';
import { detectReaderSourceScript, formatReaderSourceScriptLabel } from '@/lib/veda-book/renderText';

export function ReaderStatusBar() {
  const { activeDocument, documentStatus, manifest, manifestStatus } = useReaderStore();
  const sourceScript = activeDocument ? detectReaderSourceScript(activeDocument.rawTex) : 'unknown';

  return (
    <footer className="border-t border-stone-300/70 bg-inherit/90 px-4 py-2 text-xs text-stone-600 backdrop-blur">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span>
          Manifest: {manifestStatus}
          {manifest ? ` · ${manifest.entries.length} entries` : ''}
        </span>
        <span>Document: {documentStatus}</span>
        <span>Source: {activeDocument?.sourceRepo ?? 'n/a'}</span>
        <span>Branch: {activeDocument?.sourceBranch ?? 'n/a'}</span>
        <span>Script: {formatReaderSourceScriptLabel(sourceScript)}</span>
      </div>
    </footer>
  );
}
