'use client';

import type { ReaderSearchHit } from '@/lib/veda-book/renderText';

interface ReaderSearchResultsProps {
  hits: ReaderSearchHit[];
  activeIndex: number;
  query: string;
  onSelectHit: (index: number) => void;
}

export function ReaderSearchResults({ hits, activeIndex, query, onSelectHit }: ReaderSearchResultsProps) {
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    return null;
  }

  const clampedActiveIndex = hits.length > 0 ? Math.min(activeIndex, hits.length - 1) : -1;

  return (
    <section
      className="border-b border-stone-300/70 bg-white/70 px-4 py-3 backdrop-blur"
      data-testid="reader-search-results"
      aria-label="Document search results"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[0.7rem] uppercase tracking-[0.22em] text-stone-500">Search results</div>
          <p className="text-sm text-stone-700">
            {hits.length > 0
              ? `${hits.length} match${hits.length === 1 ? '' : 'es'} for “${trimmedQuery}”`
              : `No matches for “${trimmedQuery}”`}
          </p>
        </div>
        {hits.length > 0 ? (
          <div className="text-xs uppercase tracking-[0.18em] text-stone-500">
            Active {clampedActiveIndex + 1}/{hits.length}
          </div>
        ) : null}
      </div>

      {hits.length > 0 ? (
        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {hits.map((hit, index) => {
            const active = index === clampedActiveIndex;
            return (
              <button
                key={`${hit.nodeId}-${index}`}
                type="button"
                onClick={() => onSelectHit(index)}
                className={[
                  'group rounded-xl border px-3 py-3 text-left transition',
                  active
                    ? 'border-stone-900 bg-stone-900 text-stone-50 shadow-sm'
                    : 'border-stone-300/70 bg-white/80 text-stone-800 hover:border-stone-400 hover:bg-white',
                ].join(' ')}
                aria-pressed={active}
                aria-label={`Search result ${index + 1} of ${hits.length}`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={[
                      'inline-flex h-6 min-w-6 items-center justify-center rounded-full border px-2 text-[0.72rem] font-medium',
                      active
                        ? 'border-stone-50/30 bg-stone-50/10 text-stone-50'
                        : 'border-stone-300/70 bg-stone-100 text-stone-700',
                    ].join(' ')}
                  >
                    {index + 1}
                  </span>
                  {hit.isTitle ? (
                    <span className="rounded-full border border-emerald-300/70 bg-emerald-50 px-2 py-0.5 text-[0.65rem] uppercase tracking-[0.18em] text-emerald-800">
                      Title
                    </span>
                  ) : (
                    <span className="rounded-full border border-stone-300/70 bg-stone-100 px-2 py-0.5 text-[0.65rem] uppercase tracking-[0.18em] text-stone-600">
                      Match
                    </span>
                  )}
                </div>
                <div
                  className={[
                    'mt-2 line-clamp-2 text-sm leading-6',
                    active ? 'text-stone-50/95' : 'text-stone-700',
                  ].join(' ')}
                >
                  {hit.text}
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="mt-3 rounded-lg border border-dashed border-stone-300/80 bg-stone-50/70 px-3 py-3 text-sm text-stone-600">
          Try a different query or switch display mode to match the rendered text.
        </div>
      )}
    </section>
  );
}
