import { useRef, useCallback, useEffect } from 'react';

/**
 * Syncs the vertical scroll position of two elements.
 */
export const useSyncScroll = () => {
  const sourceRef = useRef<HTMLTextAreaElement>(null);
  const targetRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback(() => {
    if (!sourceRef.current || !targetRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = sourceRef.current;
    const scrollPercentage = scrollTop / (scrollHeight - clientHeight);
    
    const targetScrollTop = scrollPercentage * (targetRef.current.scrollHeight - targetRef.current.clientHeight);
    targetRef.current.scrollTop = targetScrollTop;
  }, []);

  useEffect(() => {
    const source = sourceRef.current;
    if (source) {
      source.addEventListener('scroll', handleScroll);
      return () => source.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  return { sourceRef, targetRef };
};
