'use client';

import React from 'react';
import { clsx } from 'clsx';

type ResizeAxis = 'x' | 'y';

interface ResizeHandleProps {
  size: number;
  minSize: number;
  maxSize: number;
  onSizeChange: (nextSize: number) => void;
  ariaLabel: string;
  className?: string;
  placement?: 'separator' | 'corner';
  axis?: ResizeAxis;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const getAxisConfig = (axis: ResizeAxis) => {
  if (axis === 'x') {
    return {
      cursor: 'col-resize',
      orientation: 'vertical' as const,
      cursorClassName: 'cursor-col-resize',
      deltaKey: 'clientX' as const,
    };
  }

  return {
    cursor: 'row-resize',
    orientation: 'horizontal' as const,
    cursorClassName: 'cursor-row-resize',
    deltaKey: 'clientY' as const,
  };
};

export const ResizeHandle: React.FC<ResizeHandleProps> = ({
  size,
  minSize,
  maxSize,
  onSizeChange,
  ariaLabel,
  className,
  placement = 'separator',
  axis = 'y',
}) => {
  const startRef = React.useRef<{ startCoordinate: number; startSize: number; pointerId: number } | null>(null);
  const axisConfig = React.useMemo(() => getAxisConfig(axis), [axis]);

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

      const target = event.currentTarget;
      const pointerId = event.pointerId;
      startRef.current = {
        startCoordinate: axisConfig.deltaKey === 'clientX' ? event.clientX : event.clientY,
        startSize: size,
        pointerId,
      };

      document.body.style.userSelect = 'none';
      document.body.style.cursor = axisConfig.cursor;

      try {
        target.setPointerCapture(pointerId);
      } catch {
        // Ignore capture failures and fall back to the global listeners below.
      }

      const handlePointerMove = (moveEvent: PointerEvent) => {
        if (!startRef.current) {
          return;
        }

        const currentCoordinate =
          axisConfig.deltaKey === 'clientX' ? moveEvent.clientX : moveEvent.clientY;
        const nextSize = clamp(
          startRef.current.startSize + (currentCoordinate - startRef.current.startCoordinate),
          minSize,
          maxSize
        );
        onSizeChange(nextSize);
      };

      const handlePointerUp = () => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
        window.removeEventListener('pointercancel', handlePointerUp);
        try {
          target.releasePointerCapture(pointerId);
        } catch {
          // Ignore capture release failures.
        }
        stopDragging();
      };

      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp, { once: true });
      window.addEventListener('pointercancel', handlePointerUp, { once: true });
    },
    [axisConfig, maxSize, minSize, onSizeChange, size, stopDragging]
  );

  const isHorizontalAxis = axis === 'y';

  return (
    <div
      aria-label={ariaLabel}
      aria-orientation={axisConfig.orientation}
      role="separator"
      onPointerDown={handlePointerDown}
      className={clsx(
        placement === 'corner'
          ? 'group absolute bottom-2 right-2 z-30 flex h-9 w-9 items-center justify-center rounded-xl border border-blue-200 bg-white/98 shadow-md ring-1 ring-white/60'
          : isHorizontalAxis
            ? 'group flex h-5 w-full items-center justify-center'
            : 'group flex h-full w-5 items-center justify-center',
        axisConfig.cursorClassName,
        'touch-none',
        placement === 'corner' ? 'opacity-95 hover:opacity-100 focus-visible:opacity-100' : 'opacity-60 hover:opacity-100 focus-visible:opacity-100 group-hover:opacity-90',
        className
      )}
      title={ariaLabel}
    >
      {placement === 'corner' ? (
        isHorizontalAxis ? (
          <span className="flex h-5 w-5 flex-col items-end justify-center gap-[3px]">
            <span className="block h-px w-5 rounded-full bg-slate-400 transition-colors group-hover:bg-blue-600" />
            <span className="block h-px w-4 rounded-full bg-slate-400 transition-colors group-hover:bg-blue-600" />
            <span className="block h-px w-3 rounded-full bg-slate-400 transition-colors group-hover:bg-blue-600" />
          </span>
        ) : (
          <span className="flex h-5 w-5 items-center justify-center gap-[3px]">
            <span className="block h-5 w-px rounded-full bg-slate-400 transition-colors group-hover:bg-blue-600" />
            <span className="block h-4 w-px rounded-full bg-slate-400 transition-colors group-hover:bg-blue-600" />
            <span className="block h-3 w-px rounded-full bg-slate-400 transition-colors group-hover:bg-blue-600" />
          </span>
        )
      ) : isHorizontalAxis ? (
        <span className="h-[3px] w-full max-w-32 rounded-full bg-slate-300/90 transition-colors group-hover:bg-slate-400" />
      ) : (
        <span className="h-full w-[3px] max-h-32 rounded-full bg-slate-300/90 transition-colors group-hover:bg-slate-400" />
      )}
    </div>
  );
};

export const VerticalResizeHandle = ResizeHandle;
