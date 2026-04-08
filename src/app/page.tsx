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

  useEffect(() => {
    const hasVisited = localStorage.getItem('sanskirt-keyboard-visited');
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
    <main className="space-y-4">
      <TransliterationEngine />
    </main>
  );
}
