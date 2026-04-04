'use client';

import React from 'react';
import { clsx } from 'clsx';

interface VerticalResizeHandleProps {
  height: number;
  minHeight: number;
  maxHeight: number;
  onHeightChange: (nextHeight: number) => void;
  ariaLabel: string;
  className?: string;
  placement?: 'separator' | 'corner';
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const VerticalResizeHandle: React.FC<VerticalResizeHandleProps> = ({
  height,
  minHeight,
  maxHeight,
  onHeightChange,
  ariaLabel,
  className,
  placement = 'separator',
}) => {
  const startRef = React.useRef<{ startY: number; startHeight: number } | null>(null);

  React.useEffect(
    () => () => {
      startRef.current = null;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    },
    []
  );

  const stopDragging = React.useCallback(() => {
    startRef.current = null;
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  }, []);

  const handlePointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      startRef.current = {
        startY: event.clientY,
        startHeight: height,
      };

      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'row-resize';

      const handlePointerMove = (moveEvent: PointerEvent) => {
        if (!startRef.current) {
          return;
        }

        const nextHeight = clamp(
          startRef.current.startHeight + (moveEvent.clientY - startRef.current.startY),
          minHeight,
          maxHeight
        );
        onHeightChange(nextHeight);
      };

      const handlePointerUp = () => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
        window.removeEventListener('pointercancel', handlePointerUp);
        stopDragging();
      };

      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp, { once: true });
      window.addEventListener('pointercancel', handlePointerUp, { once: true });
    },
    [height, maxHeight, minHeight, onHeightChange, stopDragging]
  );

  return (
    <div
      aria-label={ariaLabel}
      aria-orientation="horizontal"
      role="separator"
      onPointerDown={handlePointerDown}
      className={clsx(
        placement === 'corner'
          ? 'group absolute bottom-2 right-2 z-30 flex h-9 w-9 items-center justify-center rounded-xl border border-blue-200 bg-white/98 shadow-md ring-1 ring-white/60'
          : 'group flex h-5 w-full items-center justify-center',
        'cursor-row-resize touch-none',
        placement === 'corner' ? 'opacity-95 hover:opacity-100 focus-visible:opacity-100' : 'opacity-60 hover:opacity-100 focus-visible:opacity-100 group-hover:opacity-90',
        className
      )}
      title={ariaLabel}
    >
      {placement === 'corner' ? (
        <span className="flex h-5 w-5 flex-col items-end justify-center gap-[3px]">
          <span className="block h-px w-5 rounded-full bg-slate-400 transition-colors group-hover:bg-blue-600" />
          <span className="block h-px w-4 rounded-full bg-slate-400 transition-colors group-hover:bg-blue-600" />
          <span className="block h-px w-3 rounded-full bg-slate-400 transition-colors group-hover:bg-blue-600" />
        </span>
      ) : (
        <span className="h-[3px] w-full max-w-32 rounded-full bg-slate-300/90 transition-colors group-hover:bg-slate-400" />
      )}
    </div>
  );
};
