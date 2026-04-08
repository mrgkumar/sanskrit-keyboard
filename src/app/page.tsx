'use client';

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
  return (
    <main className="space-y-4">
      <TransliterationEngine />
    </main>
  );
}
