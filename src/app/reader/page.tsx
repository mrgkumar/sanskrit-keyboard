import { Suspense } from 'react';
import { ReaderShell } from '@/components/reader/ReaderShell';

export default function ReaderPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-stone-50" />}>
      <ReaderShell />
    </Suspense>
  );
}
