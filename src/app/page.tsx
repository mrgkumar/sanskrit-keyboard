'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import SkeletonLoader from '@/components/ui/SkeletonLoader';

const TransliterationEngine = dynamic(
  () => import('@/components/engine/TransliterationEngine').then(mod => mod.TransliterationEngine),
  { 
    ssr: false, 
    loading: () => <SkeletonLoader /> 
  }
);

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const hasVisited = localStorage.getItem('sanskirt-keyboard-visited');
    if (!hasVisited) {
      router.push('/welcome');
    }
  }, [router]);

  return (
    <main className="space-y-4">
      <TransliterationEngine />
    </main>
  );
}
