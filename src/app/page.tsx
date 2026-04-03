import Link from 'next/link';
import { TransliterationEngine } from '@/components/engine/TransliterationEngine';

export default function Home() {
  return (
    <main className="space-y-4">
      <div className="flex flex-wrap gap-3 px-4 pt-4">
        <Link
          href="/groundtruth-label"
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Ground Truth Lab
        </Link>
        <Link
          href="/mock-output-target"
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Output Target Mock
        </Link>
      </div>
      <TransliterationEngine />
    </main>
  );
}
