'use client';

import React from 'react';
import Link from 'next/link';
import { Check, Copy, Download, ChevronLeft, ChevronRight, Languages, ScrollText } from 'lucide-react';
import { clsx } from 'clsx';
import { ScriptText } from '@/components/ScriptText';
import { detransliterate, formatSourceForOutput, normalizeTamilPrecisionDisplayText } from '@/lib/vedic/utils';

type TamilFlavor = 'corpus' | 'precision-rich' | 'precision-readable' | 'ascii-fallback' | 'plain';

type WordRow = {
  id: string;
  label: string;
  roman: string;
  devanagari: string;
  tamilReference: string;
  contextLeft?: string;
  contextRight?: string;
};

type WordCandidateSet = Record<TamilFlavor, string>;

const WORD_ROWS: WordRow[] = [
  {
    id: 'sri-suktam-01-01',
    label: 'Sri Suktam / opening',
    roman: 'OM',
    devanagari: 'ॐ',
    tamilReference: 'ஓம்',
  },
  {
    id: 'sri-suktam-01-02',
    label: 'Sri Suktam / hiraNyavarNa',
    roman: "hira'NyavarNaaM_",
    devanagari: 'हिर॑ण्यवर्णां॒',
    tamilReference: 'ஹிர॑ண்யவர்ணாம்॒',
    contextLeft: 'ॐ',
  },
  {
    id: 'sri-suktam-01-03',
    label: 'Sri Suktam / hariNii',
    roman: "hari'NiiM",
    devanagari: 'हरि॑णीं',
    tamilReference: 'ஹரி॑ணீம்',
    contextLeft: '॒',
  },
  {
    id: 'sri-suktam-01-04',
    label: 'Sri Suktam / suvarna-rjata-sraja',
    roman: "su_varNa'raja_tasra'jaam",
    devanagari: 'सु॒वर्ण॑रज॒तस्र॑जाम्',
    tamilReference: 'ஸு॒வர்ண॑ரஜ॒தஸ்ர॑ஜாம்',
    contextLeft: 'ं',
  },
  {
    id: 'sri-suktam-02-01',
    label: 'Sri Suktam / chandra',
    roman: 'cha_ndraaM',
    devanagari: 'च॒न्द्रां',
    tamilReference: 'ச॒ந்த்³ராம்',
    contextLeft: '्',
  },
  {
    id: 'sri-suktam-02-02',
    label: 'Sri Suktam / hiraNmaya',
    roman: "hi_raN^zma'yiiM",
    devanagari: 'हि॒रण्‌म॑यीं',
    tamilReference: 'ஹி॒ரண்‌॑மயீம்',
    contextLeft: 'ं',
  },
  {
    id: 'sri-suktam-02-03',
    label: 'Sri Suktam / lakshmi',
    roman: 'la_kShmIm',
    devanagari: 'ल॒क्ष्मीम्',
    tamilReference: 'ல॒க்ஷ்மீம்',
    contextLeft: 'ी',
  },
  {
    id: 'sri-suktam-02-04',
    label: 'Sri Suktam / jatavedo',
    roman: "jaa_ta'vedo",
    devanagari: 'जாத॑वेदो',
    tamilReference: 'ஜாத॑வேதோ³',
    contextLeft: 'ो',
  },
  {
    id: 'sri-suktam-02-05',
    label: 'Sri Suktam / mama avaha',
    roman: "ma_maava'ha",
    devanagari: 'म॒माव॑ह',
    tamilReference: 'ம॒மாவ॑ஹ',
    contextLeft: 'ा',
  },
  {
    id: 'sri-suktam-03-01',
    label: 'Sri Suktam / taaM',
    roman: 'taaM',
    devanagari: 'ता-म्',
    tamilReference: 'தாம்',
    contextLeft: 'ा',
  },
  {
    id: 'sri-suktam-03-02',
    label: 'Sri Suktam / yasyAM',
    roman: "yasyaaM",
    devanagari: 'यस्यां॒',
    tamilReference: 'யஸ்யாம்॒',
    contextLeft: 'ं',
  },
  {
    id: 'sri-suktam-03-03',
    label: 'Sri Suktam / hiranya',
    roman: "hiraNyaM",
    devanagari: 'हिर॑ण्यं',
    tamilReference: 'ஹிர॑ண்யம்',
    contextLeft: '्',
  },
  {
    id: 'sri-suktam-03-04',
    label: 'Sri Suktam / vindeya',
    roman: "vindeyam",
    devanagari: 'विँ॒न्देय॒',
    tamilReference: 'வி॒ந்தே³யம்॒',
    contextLeft: 'य',
  },
  {
    id: 'sri-suktam-03-05',
    label: 'Sri Suktam / gamashva',
    roman: "gAmashvaM",
    devanagari: 'गामश्वम्',
    tamilReference: 'கா³மஶ்வம்॒',
    contextLeft: '्',
  },
  {
    id: 'sri-suktam-03-06',
    label: 'Sri Suktam / puruShAnaH',
    roman: "puruShAnaham",
    devanagari: 'पुरु॑षान॒हम्',
    tamilReference: 'புரு॑ஷான॒ஹம்',
    contextLeft: 'ा',
  },
] as const;

const flavorLabels: Record<TamilFlavor, string> = {
  corpus: 'Corpus Exact',
  'precision-rich': 'Precision Rich',
  'precision-readable': 'Precision Readable',
  'ascii-fallback': 'ASCII Fallback',
  plain: 'Plain Tamil',
};

const getCanonicalRoman = (row: WordRow) => detransliterate(row.devanagari);

const getCandidateSet = (row: WordRow): WordCandidateSet => {
  const precisionRich = formatSourceForOutput(row.roman, { outputScheme: 'sanskrit-tamil-precision' });
  const precisionReadable = normalizeTamilPrecisionDisplayText(precisionRich);
  const asciiFallback = formatSourceForOutput(row.roman, {
    outputScheme: 'sanskrit-tamil-precision',
    tamilPrecisionAsciiFallback: true,
  });
  const plain = precisionReadable
    .replaceAll(/[¹²³⁴]/gu, '')
    .replaceAll(/[॒॑]/gu, '')
    .replaceAll('ஂ', 'ம்')
    .replaceAll(/\s+/g, ' ')
    .trim();

  return {
    corpus: row.tamilReference,
    'precision-rich': precisionRich,
    'precision-readable': precisionReadable,
    'ascii-fallback': asciiFallback,
    plain,
  };
};

const getContextWindow = (row: WordRow) => {
  const left = row.contextLeft ?? '';
  const right = row.contextRight ?? '';
  return `${left}⟦${row.tamilReference}⟧${right}`;
};

function FlavorCard({
  active,
  label,
  body,
  onClick,
}: {
  active: boolean;
  label: string;
  body: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        'group flex h-full min-h-[11rem] w-full flex-col rounded-[1.4rem] border p-4 text-left transition-all',
        active
          ? 'border-slate-900 bg-slate-950 text-white shadow-[0_18px_50px_rgba(15,23,42,0.18)]'
          : 'border-slate-200 bg-white text-slate-900 hover:border-slate-400 hover:bg-slate-50'
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className={clsx('text-[10px] font-black uppercase tracking-[0.2em]', active ? 'text-blue-200' : 'text-slate-500')}>
          {label}
        </p>
        {active ? <Check className="h-4 w-4 text-emerald-400" /> : <span className="h-4 w-4 rounded-full border border-slate-300" />}
      </div>
      <div className={clsx('mt-4 leading-relaxed', active ? 'text-white' : 'text-slate-900')}>{body}</div>
    </button>
  );
}

export default function GroundTruthLabelPage() {
  const [selection, setSelection] = React.useState<Record<string, TamilFlavor | null>>(() =>
    Object.fromEntries(WORD_ROWS.map((row) => [row.id, null]))
  );
  const [copyState, setCopyState] = React.useState<'idle' | 'copied' | 'error'>('idle');
  const [activeRowId, setActiveRowId] = React.useState(WORD_ROWS[0]?.id ?? '');

  const exportRows = React.useMemo(
    () =>
      WORD_ROWS.filter((row) => selection[row.id] !== null).map((row) => {
        const candidates = getCandidateSet(row);
        const chosenFlavor = selection[row.id]!;
        const canonicalRoman = getCanonicalRoman(row);

        return {
          id: row.id,
          label: row.label,
          romanInput: row.roman,
          canonicalRoman,
          devanagari: row.devanagari,
          sourceTamil: row.tamilReference,
          chosenFlavor,
          chosenTamilText: candidates[chosenFlavor],
          candidates,
        };
      }),
    [selection]
  );
  const reviewedCount = exportRows.length;
  const activeIndex = WORD_ROWS.findIndex((row) => row.id === activeRowId);
  const activeRow = WORD_ROWS[activeIndex] ?? WORD_ROWS[0];
  const exportJson = React.useMemo(() => JSON.stringify(exportRows, null, 2), [exportRows]);

  const selectChoice = (rowId: string, choice: TamilFlavor) => {
    setSelection((current) => ({ ...current, [rowId]: choice }));
    setActiveRowId(rowId);
  };

  const jumpRow = (offset: number) => {
    const nextIndex = Math.max(0, Math.min(WORD_ROWS.length - 1, activeIndex + offset));
    setActiveRowId(WORD_ROWS[nextIndex]?.id ?? WORD_ROWS[0].id);
  };

  const handleCopyExport = async () => {
    try {
      await navigator.clipboard.writeText(exportJson);
      setCopyState('copied');
      window.setTimeout(() => setCopyState('idle'), 1600);
    } catch {
      setCopyState('error');
      window.setTimeout(() => setCopyState('idle'), 1600);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([exportJson], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'groundtruth-word-labels.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#dbeafe,transparent_24%),radial-gradient(circle_at_bottom_right,#fde68a,transparent_22%),#f8fafc] px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="rounded-[2rem] border border-white/70 bg-white/90 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <ChevronLeft className="h-4 w-4" />
              Back To App
            </Link>
            <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-blue-700">
              <Languages className="h-3.5 w-3.5" />
              Ground Truth Lab
            </span>
          </div>
          <div className="mt-4 space-y-2">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Word-by-word labeling</p>
            <h1 className="font-display text-3xl tracking-tight text-slate-950">
              Choose the best Tamil flavor for each word, then export the labeled pairs
            </h1>
            <p className="max-w-4xl text-sm leading-6 text-slate-600">
              Each row is one word. The row shows the Roman source, the Sanskrit source, and several Tamil candidates:
              corpus exact, precision rich, precision readable, ASCII fallback, and plain Tamil. Click the Tamil form
              you want to keep as the label.
            </p>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.85fr)]">
          <div className="space-y-4">
            <div className="rounded-[1.8rem] border border-slate-200 bg-white p-4 shadow-[0_16px_50px_rgba(15,23,42,0.06)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                    Review Progress
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {reviewedCount}/{WORD_ROWS.length} words labeled
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => jumpRow(-1)}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => jumpRow(1)}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 via-violet-500 to-emerald-500 transition-all"
                  style={{ width: `${(reviewedCount / WORD_ROWS.length) * 100}%` }}
                />
              </div>
            </div>

            <div className="space-y-4">
              {WORD_ROWS.map((row) => {
                const candidates = getCandidateSet(row);
                const chosen = selection[row.id];
                const isActive = row.id === activeRowId;
                const canonicalRoman = getCanonicalRoman(row);

                return (
                  <article
                    key={row.id}
                    className={clsx(
                      'rounded-[2rem] border p-4 shadow-[0_16px_50px_rgba(15,23,42,0.06)] transition-all',
                      isActive ? 'border-slate-900 bg-slate-50' : 'border-slate-200 bg-white'
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{row.label}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
                          <span>
                            Roman: <span className="font-mono text-slate-900">{row.roman}</span>
                          </span>
                          <span>
                            Canonical: <span className="font-mono text-slate-900">{canonicalRoman}</span>
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.15em] text-slate-600">
                          {chosen ? `Chosen: ${flavorLabels[chosen]}` : 'Unlabeled'}
                        </span>
                        <button
                          type="button"
                          onClick={() => setActiveRowId(row.id)}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                        >
                          Focus
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Sanskrit</p>
                      <div className="mt-2">
                        <ScriptText
                          script="devanagari"
                          text={row.devanagari}
                          className="text-[28px] leading-[1.75] text-slate-950"
                        />
                      </div>
                      <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                          One-character context
                        </p>
                        <div className="mt-1 font-mono text-sm leading-6 text-slate-700">{getContextWindow(row)}</div>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 xl:grid-cols-5">
                      <FlavorCard
                        active={chosen === 'corpus'}
                        label={flavorLabels.corpus}
                        onClick={() => selectChoice(row.id, 'corpus')}
                        body={
                          <ScriptText
                            script="tamil"
                            text={candidates.corpus}
                            className="text-[26px] leading-[1.9] text-slate-950"
                          />
                        }
                      />
                      <FlavorCard
                        active={chosen === 'precision-rich'}
                        label={flavorLabels['precision-rich']}
                        onClick={() => selectChoice(row.id, 'precision-rich')}
                        body={
                          <ScriptText
                            script="tamil"
                            text={candidates['precision-rich']}
                            className="text-[26px] leading-[1.9] text-slate-950"
                          />
                        }
                      />
                      <FlavorCard
                        active={chosen === 'precision-readable'}
                        label={flavorLabels['precision-readable']}
                        onClick={() => selectChoice(row.id, 'precision-readable')}
                        body={
                          <ScriptText
                            script="tamil"
                            text={candidates['precision-readable']}
                            className="text-[26px] leading-[1.9] text-slate-950"
                          />
                        }
                      />
                      <FlavorCard
                        active={chosen === 'ascii-fallback'}
                        label={flavorLabels['ascii-fallback']}
                        onClick={() => selectChoice(row.id, 'ascii-fallback')}
                        body={<div className="font-mono text-[14px] leading-7 text-slate-700">{candidates['ascii-fallback']}</div>}
                      />
                      <FlavorCard
                        active={chosen === 'plain'}
                        label={flavorLabels.plain}
                        onClick={() => selectChoice(row.id, 'plain')}
                        body={
                          <ScriptText
                            script="tamil"
                            text={candidates.plain}
                            className="text-[26px] leading-[1.9] text-slate-950"
                          />
                        }
                      />
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_16px_50px_rgba(15,23,42,0.06)]">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Export</p>
              <h2 className="mt-2 text-lg font-semibold text-slate-950">Labeled word set</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Only words with a selected Tamil flavor are included. Exported rows carry the Roman input, the
                canonical Roman recovered from Devanagari, the Sanskrit source, the reference Tamil, and the chosen
                Tamil flavor.
              </p>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Reviewed</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-950">{reviewedCount}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Pending</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-950">{WORD_ROWS.length - reviewedCount}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleCopyExport}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-900 bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  {copyState === 'copied' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copyState === 'copied' ? 'Copied JSON' : copyState === 'error' ? 'Copy failed' : 'Copy JSON'}
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Download className="h-4 w-4" />
                  Download JSON
                </button>
              </div>

              <div className="mt-4 rounded-[1.5rem] border border-slate-200 bg-slate-950 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-300">
                    <ScrollText className="h-3.5 w-3.5" />
                    Export Preview
                  </p>
                  <span className="rounded-full border border-slate-700 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-300">
                    JSON
                  </span>
                </div>
                <pre className="mt-3 max-h-[28rem] overflow-auto whitespace-pre-wrap break-words text-xs leading-6 text-slate-100">
                  {exportJson}
                </pre>
              </div>
            </div>

            <div className="rounded-[2rem] border border-blue-200 bg-blue-50/70 p-5 shadow-[0_16px_50px_rgba(15,23,42,0.06)]">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-700">How to use</p>
              <ol className="mt-3 space-y-2 text-sm leading-6 text-blue-950">
                <li>1. Read the Sanskrit source and the different Tamil flavors for one word.</li>
                <li>2. Click the Tamil form you want to keep as the labeled ground truth.</li>
                <li>3. Export the labeled word pairs as JSON when the set is ready.</li>
              </ol>
            </div>
          </aside>
        </section>

        <p className="pb-4 text-xs text-slate-500">
          Current focus: {activeRow?.label ?? 'None'}.
        </p>
      </div>
    </main>
  );
}
