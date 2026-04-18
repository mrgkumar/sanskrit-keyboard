'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import SkeletonLoader from '@/components/ui/SkeletonLoader';
import { SessionLanding } from '@/components/engine/SessionLanding';

const TransliterationEngine = dynamic(
  () => import('@/components/engine/TransliterationEngine').then(mod => mod.TransliterationEngine),
  { 
    ssr: false, 
    loading: () => <SkeletonLoader /> 
  }
);

export default function Home() {
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);
  const [isSessionConfirmed, setIsSessionConfirmed] = useState(false);
  const LEGACY_VISITED_KEY = 'sanskirt-keyboard-visited';
  const VISITED_KEY = 'sanskrit-keyboard-visited';

  useEffect(() => {
    const legacyVisited = localStorage.getItem(LEGACY_VISITED_KEY);
    const hasVisited = localStorage.getItem(VISITED_KEY) || legacyVisited;
    if (legacyVisited && !localStorage.getItem(VISITED_KEY)) {
      localStorage.setItem(VISITED_KEY, legacyVisited);
      localStorage.removeItem(LEGACY_VISITED_KEY);
    }
    if (!hasVisited) {
      router.push('/welcome');
    } else {
      setIsReady(true);
    }
  }, [router]);

  if (!isReady) {
    return <SkeletonLoader />;
  }

  if (!isSessionConfirmed) {
    return <SessionLanding onConfirm={() => setIsSessionConfirmed(true)} />;
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <TransliterationEngine />
    </main>
  );
}
