'use client';

import { BookMarked, Search } from 'lucide-react';
import { useReaderStore } from '@/store/useReaderStore';
import { filterManifestEntries } from '@/lib/veda-book/buildManifest';

interface ReaderSidebarProps {
  onSelectDocument?: () => void;
}

export function ReaderSidebar({ onSelectDocument }: ReaderSidebarProps) {
  const {
    activePath,
    manifest,
    manifestError,
    manifestStatus,
    openDocument,
    searchQuery,
    setSearchQuery,
  } = useReaderStore();

  const entries = manifest ? filterManifestEntries(manifest.entries, searchQuery) : [];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-stone-300/70 px-4 py-3">
        <label className="flex items-center gap-2 rounded-md border border-stone-300/70 bg-white/70 px-3 py-2">
          <Search className="h-4 w-4 text-stone-500" />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search titles or paths"
            className="w-full bg-transparent text-sm outline-none placeholder:text-stone-400"
          />
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {manifestStatus === 'loading' ? (
          <div className="space-y-2 p-2 text-sm text-stone-500">Loading manifest...</div>
        ) : null}

        {manifestError ? <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{manifestError}</div> : null}

        {manifest ? (
          <div className="px-1 pb-2 text-xs uppercase tracking-[0.18em] text-stone-500">
            {entries.length} of {manifest.entries.length} documents
          </div>
        ) : null}

        <div className="space-y-1">
          {entries.map((entry) => {
            const active = activePath === entry.path;
            return (
              <button
                key={entry.id}
                type="button"
                onClick={async () => {
                  await openDocument(entry.path);
                  onSelectDocument?.();
                }}
                className={[
                  'w-full rounded-md border px-3 py-3 text-left transition',
                  active
                    ? 'border-stone-900 bg-stone-900 text-stone-50'
                    : 'border-transparent bg-white/60 text-stone-800 hover:border-stone-300/70 hover:bg-white',
                ].join(' ')}
              >
                <div className="flex items-start gap-2">
                  <BookMarked className="mt-0.5 h-4 w-4 shrink-0 opacity-70" />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{entry.title}</div>
                    <div className="truncate text-[0.72rem] uppercase tracking-[0.14em] opacity-70">
                      {entry.category} · {entry.path}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
