'use client';

import { useRouter } from 'next/navigation';
import { ChevronRight, FileText, Folder, Search } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { useReaderStore } from '@/store/useReaderStore';
import {
  buildManifestTree,
  filterManifestEntries,
  type ManifestTreeFolderNode,
} from '@/lib/veda-book/buildManifest';

interface ReaderSidebarProps {
  onSelectDocument?: () => void;
}

const renderEntryButton = (
  entry: ManifestTreeFolderNode['entries'][number],
  active: boolean,
  onClick: (event: MouseEvent<HTMLButtonElement>) => void,
) => (
  <button
    key={entry.id}
    type="button"
    onMouseDown={(event) => event.preventDefault()}
    onClick={(event) => {
      event.currentTarget.blur();
      onClick(event);
    }}
    className={[
      'w-full rounded-md border px-3 py-3 text-left transition',
      active ? 'border-stone-900 bg-stone-900 text-stone-50' : 'border-transparent bg-white/60 text-stone-800 hover:border-stone-300/70 hover:bg-white',
    ].join(' ')}
  >
    <div className="flex items-start gap-2">
      <FileText className="mt-0.5 h-4 w-4 shrink-0 opacity-70" />
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{entry.title}</div>
        <div className="truncate text-[0.72rem] uppercase tracking-[0.14em] opacity-70">
          {entry.folderPath || entry.category} · {entry.path}
        </div>
      </div>
    </div>
  </button>
);

const collectFolderPaths = (node: ManifestTreeFolderNode): string[] => [
  ...(node.path ? [node.path] : []),
  ...node.folders.flatMap(collectFolderPaths),
];

const renderTreeNode = (
  node: ManifestTreeFolderNode,
  options: {
    activePath: string | null;
    onSelectDocument?: () => void;
    onOpenDocument: (path: string) => Promise<void>;
    expandedFolders: Set<string>;
    onToggleFolder: (path: string) => void;
    level?: number;
  },
) => {
  const { activePath, onOpenDocument, expandedFolders, onToggleFolder, level = 0 } = options;
  const isRoot = node.path.length === 0;
  const folderLabel = isRoot ? 'Root' : node.name;
  const isExpanded = isRoot || expandedFolders.has(node.path);

  return (
    <div key={node.path || 'root'} className={level === 0 ? 'space-y-3' : 'space-y-2'}>
      {isRoot ? (
        <div
          className={[
            'flex items-center gap-2 uppercase tracking-[0.18em] text-stone-400',
            level === 0 ? 'px-3 pb-1 text-[0.68rem]' : 'pl-4 text-[0.66rem]',
          ].join(' ')}
        >
          <Folder className="h-3.5 w-3.5 shrink-0" />
          <span>{folderLabel}</span>
          <span className="normal-case tracking-[0.08em] text-stone-500">documents</span>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => onToggleFolder(node.path)}
          aria-expanded={isExpanded}
          aria-label={`${isExpanded ? 'Collapse' : 'Expand'} folder ${node.path}`}
          data-testid={`reader-folder-toggle-${node.path}`}
          className={[
            'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left uppercase tracking-[0.18em] text-stone-400 transition',
            'hover:bg-stone-100/80 hover:text-stone-600',
            level === 0 ? 'text-[0.68rem]' : 'text-[0.66rem]',
          ].join(' ')}
        >
          <ChevronRight className={[
            'h-3.5 w-3.5 shrink-0 transition-transform',
            isExpanded ? 'rotate-90' : 'rotate-0',
          ].join(' ')} />
          <Folder className="h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 truncate">{folderLabel}</span>
          <span className="normal-case tracking-[0.08em] text-stone-500">{node.path}</span>
        </button>
      )}

      {isExpanded ? (
        <>
          {node.entries.length > 0 ? (
            <div className={level === 0 ? 'space-y-1' : 'space-y-1 border-l border-stone-200/80 pl-3'}>
              {node.entries.map((entry) => {
                const active = activePath === entry.path;
                return renderEntryButton(entry, active, () => {
                  void onOpenDocument(entry.path);
                });
              })}
            </div>
          ) : null}

          {node.folders.length > 0 ? (
            <div className={level === 0 ? 'space-y-3' : 'space-y-3 border-l border-stone-200/80 pl-3'}>
              {node.folders.map((folder) =>
                renderTreeNode(folder, {
                  ...options,
                  level: level + 1,
                }),
              )}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
};

export function ReaderSidebar({ onSelectDocument }: ReaderSidebarProps) {
  const router = useRouter();
  const sidebarScrollRef = useRef<HTMLDivElement | null>(null);
  const pendingScrollTopRef = useRef<number | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => new Set());
  const activePath = useReaderStore((state) => state.activePath);
  const manifest = useReaderStore((state) => state.manifest);
  const manifestError = useReaderStore((state) => state.manifestError);
  const manifestStatus = useReaderStore((state) => state.manifestStatus);
  const openDocument = useReaderStore((state) => state.openDocument);
  const searchQuery = useReaderStore((state) => state.searchQuery);
  const setSearchQuery = useReaderStore((state) => state.setSearchQuery);

  const filteredEntries = useMemo(() => {
    if (!manifest) {
      return [];
    }

    return filterManifestEntries(manifest.entries, searchQuery);
  }, [manifest, searchQuery]);

  const tree = useMemo(() => (manifest ? buildManifestTree(filteredEntries) : null), [filteredEntries, manifest]);
  const folderPaths = useMemo(() => (tree ? collectFolderPaths(tree) : []), [tree]);

  useEffect(() => {
    if (!tree || folderPaths.length === 0) {
      return;
    }

    setExpandedFolders((current) => {
      if (current.size > 0) {
        return current;
      }

      return new Set(folderPaths);
    });
  }, [folderPaths, tree]);

  useLayoutEffect(() => {
    const element = sidebarScrollRef.current;
    const scrollTop = pendingScrollTopRef.current;

    if (!element || scrollTop === null) {
      return;
    }

    pendingScrollTopRef.current = null;
    element.scrollTop = scrollTop;
  }, [activePath]);

  const handleOpenDocument = async (path: string) => {
    const scrollTop = sidebarScrollRef.current?.scrollTop ?? 0;
    pendingScrollTopRef.current = scrollTop;
    router.replace(`/reader?path=${encodeURIComponent(path)}`, { scroll: false });
    await openDocument(path);

    onSelectDocument?.();
  };

  const handleToggleFolder = (path: string) => {
    setExpandedFolders((current) => {
      const next = new Set(current);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="sticky top-0 z-10 border-b border-stone-300/70 bg-inherit/95 px-4 py-3 backdrop-blur">
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

      <div className="min-h-0 flex-1 px-2 py-2">
        {manifestStatus === 'loading' ? (
          <div className="space-y-2 p-2 text-sm text-stone-500">Loading manifest...</div>
        ) : null}

        {manifestError ? <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{manifestError}</div> : null}

        {manifest ? (
          <div className="px-1 pb-2 text-xs uppercase tracking-[0.18em] text-stone-500">
            {filteredEntries.length} of {manifest.entries.length} documents
          </div>
        ) : null}

        <div
          className="overflow-y-auto pr-1"
          data-testid="reader-sidebar-scroll"
          ref={sidebarScrollRef}
          style={{ height: 'calc(100dvh - 14rem)' }}
        >
          <div className="space-y-4 pb-4">
            {tree ? (
              renderTreeNode(tree, {
                activePath,
                onOpenDocument: handleOpenDocument,
                expandedFolders,
                onToggleFolder: handleToggleFolder,
              })
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
