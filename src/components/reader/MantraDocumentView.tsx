'use client';

import type { MantraDocument, MantraNode } from '@/lib/veda-book/types';
import { deriveDocumentOutline } from '@/lib/veda-book/renderText';

interface MantraDocumentViewProps {
  document: MantraDocument | null;
  documentStatus: 'idle' | 'loading' | 'ready' | 'refreshing' | 'error';
}

const renderNode = (node: MantraNode) => {
  switch (node.type) {
    case 'chapter':
      return <h1 className="text-balance text-3xl font-semibold tracking-tight">{node.text}</h1>;
    case 'section':
      return <h2 className="text-2xl font-semibold tracking-tight">{node.text}</h2>;
    case 'subsection':
      return <h3 className="text-xl font-semibold tracking-tight">{node.text}</h3>;
    case 'center':
      return <div className="text-center text-lg font-medium">{node.text}</div>;
    case 'sourceRef':
      return (
        <div className="inline-flex items-center gap-2 rounded-full border border-stone-300/70 bg-white/70 px-3 py-1 text-xs uppercase tracking-[0.16em] text-stone-600">
          <span>{node.source}</span>
          <span>{node.values.join(' · ')}</span>
        </div>
      );
    case 'pageBreak':
      return <div className="my-6 border-t border-dashed border-stone-300/80" />;
    case 'warning':
      return (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {node.message}
        </div>
      );
    case 'raw':
      return <pre className="whitespace-pre-wrap text-base leading-8">{node.text}</pre>;
    case 'paragraph':
    default:
      return <p className="whitespace-pre-wrap text-lg leading-8">{node.text}</p>;
  }
};

export function MantraDocumentView({ document, documentStatus }: MantraDocumentViewProps) {
  if (!document) {
    return (
      <section className="flex min-h-0 flex-1 items-center justify-center px-4 py-10">
        <div className="max-w-xl text-center">
          <div className="text-sm uppercase tracking-[0.18em] text-stone-500">
            {documentStatus === 'loading' || documentStatus === 'refreshing' ? 'Loading document' : 'Reader'}
          </div>
          <p className="mt-4 text-lg text-stone-600">
            Select a mantra from the sidebar to render the source document here.
          </p>
        </div>
      </section>
    );
  }

  const outline = deriveDocumentOutline(document.nodes);

  return (
    <section
      className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-3"
      data-testid="reader-document-scroll"
      style={{ maxHeight: 'calc(100dvh - 9rem)' }}
    >
      <article className="mx-auto flex w-full max-w-4xl flex-col gap-5">
        <header className="border-b border-stone-300/70 pb-4">
          <div className="text-[0.7rem] uppercase tracking-[0.22em] text-stone-500">{document.sourcePath}</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance">{document.title}</h1>
          <div className="mt-2 text-sm text-stone-600">
            {document.sourceRepo} · {document.sourceBranch}
          </div>
        </header>

        {outline.length > 1 ? (
          <nav className="rounded-xl border border-stone-300/70 bg-white/60 p-3" aria-label="Document outline">
            <div className="text-[0.7rem] uppercase tracking-[0.22em] text-stone-500">Outline</div>
            <div className="mt-3 space-y-1">
              {outline.map((entry) => (
                <a
                  key={entry.id}
                  href={`#${entry.id}`}
                  className={[
                    'block w-full rounded-md px-3 py-2 text-left text-sm transition',
                    entry.level === 1
                      ? 'font-semibold text-stone-900'
                      : entry.level === 2
                        ? 'pl-5 text-stone-800'
                        : 'pl-8 text-stone-700',
                    'hover:bg-stone-100',
                  ].join(' ')}
                >
                  {entry.label}
                </a>
              ))}
            </div>
          </nav>
        ) : null}

        <div className="space-y-5">
          {document.nodes.map((node) => (
            <div key={node.id} id={node.id} className="space-y-2 scroll-mt-24">
              {renderNode(node)}
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
