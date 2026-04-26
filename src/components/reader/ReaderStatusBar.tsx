'use client';

import { useReaderStore } from '@/store/useReaderStore';
import { readerThemeTextClass } from './readerTheme';
import {
  detectReaderSourceScript,
  formatReaderSourceScriptLabel,
  getReaderDisplayScriptLabel,
  getReaderPageSizeLabel,
} from '@/lib/veda-book/renderText';

export function ReaderStatusBar() {
  const activeDocument = useReaderStore((state) => state.activeDocument);
  const displayScript = useReaderStore((state) => state.displayScript);
  const documentStatus = useReaderStore((state) => state.documentStatus);
  const manifest = useReaderStore((state) => state.manifest);
  const manifestStatus = useReaderStore((state) => state.manifestStatus);
  const pageSize = useReaderStore((state) => state.pageSize);
  const fontSize = useReaderStore((state) => state.fontSize);
  const lineHeight = useReaderStore((state) => state.lineHeight);
  const theme = useReaderStore((state) => state.theme);
  const sourceScript = activeDocument ? detectReaderSourceScript(activeDocument.rawTex) : 'unknown';
  const bodyTextClass = readerThemeTextClass(theme, 'text-stone-600', 'text-white/75');

  return (
    <footer className={`border-t border-stone-300/70 bg-inherit/90 px-4 py-2 text-xs ${bodyTextClass} backdrop-blur`}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span>
          Manifest: {manifestStatus}
          {manifest ? ` · ${manifest.entries.length} entries` : ''}
        </span>
        <span>Document: {documentStatus}</span>
        <span>Source: {activeDocument?.sourceRepo ?? 'n/a'}</span>
        <span>Branch: {activeDocument?.sourceBranch ?? 'n/a'}</span>
        <span>Script: {formatReaderSourceScriptLabel(sourceScript)}</span>
        <span>Display: {getReaderDisplayScriptLabel(displayScript)}</span>
        <span>Type: {fontSize}px / {lineHeight.toFixed(2)}</span>
        <span>Page: {getReaderPageSizeLabel(pageSize)}</span>
      </div>
    </footer>
  );
}
