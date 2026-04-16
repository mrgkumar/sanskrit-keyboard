// app/src/components/engine/CaretOverlay.tsx
import * as React from 'react';
import { clsx } from 'clsx';

interface CaretOverlayProps {
  targetRef: React.RefObject<HTMLElement | null>;
  containerRef: React.RefObject<HTMLElement | null>;
  color?: string;
}

export const CaretOverlay: React.FC<CaretOverlayProps> = ({ targetRef, containerRef, color = 'bg-blue-600' }) => {
  const [style, setStyle] = React.useState<React.CSSProperties>({ opacity: 0 });

  React.useLayoutEffect(() => {
    const container = containerRef.current;
    const updatePosition = () => {
      if (!targetRef.current || !container) return;

      const targetRect = targetRef.current.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      setStyle({
        position: 'absolute',
        left: targetRect.left - containerRect.left,
        top: targetRect.top - containerRect.top,
        height: targetRect.height || '1.2em',
        width: '2px',
        opacity: 1,
        transition: 'left 0.1s ease-out, top 0.1s ease-out',
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    container?.addEventListener('scroll', updatePosition);

    const observer = new MutationObserver(updatePosition);
    if (container) {
      observer.observe(container, { childList: true, subtree: true, characterData: true });
    }

    return () => {
      window.removeEventListener('resize', updatePosition);
      container?.removeEventListener('scroll', updatePosition);
      observer.disconnect();
    };
  }, [targetRef, containerRef]);

  return (
    <div
      className={clsx('pointer-events-none rounded-full motion-safe:animate-caret', color)}
      style={style}
      data-testid="preview-caret"
    />
  );
};
