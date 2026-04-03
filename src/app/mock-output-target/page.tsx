'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, BookOpen, Languages, SplitSquareVertical } from 'lucide-react';
import { clsx } from 'clsx';

type OutputScript = 'roman' | 'devanagari' | 'tamil';
type CompareScript = 'off' | OutputScript;
type RomanStyle = 'canonical' | 'baraha';
type TamilStyle = 'precision';

const scriptLabels: Record<OutputScript, string> = {
  roman: 'Roman',
  devanagari: 'Devanagari',
  tamil: 'Tamil',
};

const sampleSource = 'gItA dharma amR^ita guruH lakShmI';
const samplePreview = 'गीता धर्म अमृत गुरुः लक्ष्मी';

function getRomanOutput(style: RomanStyle) {
  return style === 'canonical' ? 'gItA dharma amR^ita guruH lakShmI' : 'gItA dharma amRuta guruH lakShmI';
}

function getTamilOutput(style: TamilStyle) {
  return style === 'precision' ? 'க³ீதா த⁴ர்ம அம்ரு¹த க³ுருஃ லக்ஷ்மீ' : 'க³ீதா த⁴ர்ம அம்ரு¹த க³ுருஃ லக்ஷ்மீ';
}

function getScriptOutput(script: OutputScript, romanStyle: RomanStyle, tamilStyle: TamilStyle) {
  if (script === 'roman') {
    return getRomanOutput(romanStyle);
  }

  if (script === 'tamil') {
    return getTamilOutput(tamilStyle);
  }

  return samplePreview;
}

function getPaneTone(script: OutputScript) {
  if (script === 'roman') {
    return {
      badge: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      surface: 'bg-emerald-50/60 border-emerald-200',
      text: 'font-mono text-[15px] leading-8 text-slate-700',
    };
  }

  if (script === 'tamil') {
    return {
      badge: 'bg-amber-50 text-amber-900 border-amber-200',
      surface: 'bg-amber-50/60 border-amber-200',
      text: 'font-serif text-[31px] leading-[1.9] text-slate-900',
    };
  }

  return {
    badge: 'bg-blue-50 text-blue-800 border-blue-200',
    surface: 'bg-blue-50/50 border-blue-200',
    text: 'font-serif text-[33px] leading-[1.8] text-slate-900',
  };
}

function describeScript(script: OutputScript, romanStyle: RomanStyle, tamilStyle: TamilStyle) {
  if (script === 'roman') {
    return romanStyle === 'canonical' ? 'Canonical Roman' : 'Baraha-Compatible Roman';
  }

  if (script === 'tamil') {
    return tamilStyle === 'precision' ? 'Tamil Precision' : 'Tamil Precision';
  }

  return 'Devanagari';
}

function InlineSegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange?: (value: T) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange?.(option.value)}
            className={clsx(
              'rounded-full border px-3 py-2 text-xs font-bold transition-colors',
              value === option.value
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function OutputPane({
  script,
  romanStyle,
  tamilStyle,
}: {
  script: OutputScript;
  romanStyle: RomanStyle;
  tamilStyle: TamilStyle;
}) {
  const tone = getPaneTone(script);

  return (
    <article className={clsx('rounded-[1.6rem] border p-4 shadow-sm', tone.surface)}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Output Pane</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{describeScript(script, romanStyle, tamilStyle)}</p>
        </div>
        <span className={clsx('rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em]', tone.badge)}>
          {scriptLabels[script]}
        </span>
      </div>
      <div className="mt-4 min-h-[168px] rounded-[1.3rem] border border-white/70 bg-white/90 p-4">
        <div className={tone.text}>{getScriptOutput(script, romanStyle, tamilStyle)}</div>
      </div>
    </article>
  );
}

export default function MockOutputTargetPage() {
  const [primaryScript, setPrimaryScript] = React.useState<OutputScript>('tamil');
  const [compareWith, setCompareWith] = React.useState<CompareScript>('off');
  const [romanStyle, setRomanStyle] = React.useState<RomanStyle>('canonical');
  const [tamilStyle] = React.useState<TamilStyle>('precision');

  const usesRomanControls = primaryScript === 'roman' || compareWith === 'roman';
  const usesTamilControls = primaryScript === 'tamil' || compareWith === 'tamil';
  const primaryLabel = describeScript(primaryScript, romanStyle, tamilStyle);
  const compareLabel = compareWith === 'off' ? 'Off' : describeScript(compareWith, romanStyle, tamilStyle);

  const cyclePrimaryScript = () => {
    const order: OutputScript[] = ['roman', 'devanagari', 'tamil'];
    const nextIndex = (order.indexOf(primaryScript) + 1) % order.length;
    setPrimaryScript(order[nextIndex]);
  };

  const cycleCompareScript = () => {
    const order: CompareScript[] = ['off', 'roman', 'devanagari', 'tamil'];
    const nextIndex = (order.indexOf(compareWith) + 1) % order.length;
    setCompareWith(order[nextIndex]);
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#dbeafe,transparent_28%),radial-gradient(circle_at_bottom_right,#fde68a,transparent_24%),#f8fafc] text-slate-900">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 rounded-[2rem] border border-white/70 bg-white/85 p-5 shadow-[0_20px_70px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Back To App
            </Link>
            <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-blue-700">
              Mock UI
            </span>
          </div>
          <div className="space-y-2">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">
              Output Target Design Pass
            </p>
            <h1 className="font-display text-3xl tracking-tight text-slate-950">
              Integrate Script Controls Into The Output Surface
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-slate-600">
              This mock treats script switching as a reading mode layered on top of a canonical source. The header
              exposes compact quick-switch chips, while detailed controls stay inline with the content instead of in a
              right-side panel.
            </p>
          </div>
        </header>

        <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
          <div className="border-b border-slate-200 bg-slate-50/90 px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                <span>ITRANS</span>
                <span className="text-slate-300">/</span>
                <span className="text-blue-700">Reference</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={cyclePrimaryScript}
                  title="Quick-switch primary script"
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-emerald-900"
                >
                  <Languages className="h-4 w-4" />
                  Output: {primaryLabel}
                </button>
                <button
                  type="button"
                  onClick={cycleCompareScript}
                  title="Quick-switch comparison script"
                  className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-amber-900"
                >
                  <SplitSquareVertical className="h-4 w-4" />
                  Compare: {compareLabel}
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-700"
                >
                  <BookOpen className="h-4 w-4" />
                  Reference
                </button>
              </div>
            </div>
            <p className="px-1 text-xs leading-6 text-slate-500">
              In the product these would open quick menus. In this mock they cycle through states so the interaction
              stays testable without adding popup chrome.
            </p>
          </div>

          <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <section className="space-y-4">
              <div className="rounded-[1.8rem] border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Source</p>
                    <p className="mt-1 text-sm text-slate-500">Canonical Roman remains the internal source of truth.</p>
                  </div>
                  <span className="rounded-full bg-slate-900 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white">
                    Input: Canonical
                  </span>
                </div>
                <div className="mt-4 min-h-[120px] rounded-[1.4rem] border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="font-mono text-[15px] leading-8 text-slate-700">{sampleSource}</div>
                </div>
                <p className="mt-3 text-xs leading-6 text-slate-500">
                  Output and comparison change how the text is read and checked. They should not mutate the canonical
                  source buffer or the user&apos;s editing model.
                </p>
              </div>

              <div className="rounded-[1.8rem] border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <Languages className="h-4 w-4 text-slate-500" />
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Inline Output Settings</p>
                </div>
                <div className="mt-4 grid gap-4">
                  <InlineSegmentedControl
                    label="Primary Script"
                    value={primaryScript}
                    options={[
                      { value: 'roman', label: 'Roman' },
                      { value: 'devanagari', label: 'Devanagari' },
                      { value: 'tamil', label: 'Tamil' },
                    ]}
                    onChange={setPrimaryScript}
                  />

                  <InlineSegmentedControl
                    label="Compare With"
                    value={compareWith}
                    options={[
                      { value: 'off', label: 'Off' },
                      { value: 'roman', label: 'Roman' },
                      { value: 'devanagari', label: 'Devanagari' },
                      { value: 'tamil', label: 'Tamil' },
                    ]}
                    onChange={setCompareWith}
                  />

                  {usesRomanControls && (
                    <InlineSegmentedControl
                      label="Roman Style"
                      value={romanStyle}
                      options={[
                        { value: 'canonical', label: 'Canonical' },
                        { value: 'baraha', label: 'Baraha-Compatible' },
                      ]}
                      onChange={setRomanStyle}
                    />
                  )}

                  {usesTamilControls && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Tamil Mode</p>
                      <div className="rounded-[1.3rem] border border-amber-200 bg-amber-50/70 px-4 py-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-bold uppercase text-amber-950">Precision</p>
                            <p className="mt-1 text-xs leading-5 text-slate-600">
                              Tamil is currently a precision-reading mode. It keeps Sanskrit distinctions visible for
                              comparison and careful proofing.
                            </p>
                          </div>
                          <span className="rounded-full border border-amber-200 bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-amber-900">
                            Fixed
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="space-y-5">
              <div className="rounded-[1.8rem] border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Reading Surface</p>
                    <p className="mt-1 text-sm text-slate-500">
                      One live surface that expands into comparison only when the user enables it.
                    </p>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-700">
                    {compareWith === 'off' ? 'Single View' : 'Compare Mode'}
                  </span>
                </div>
                <div
                  className={clsx(
                    'mt-4 grid gap-4',
                    compareWith === 'off' ? 'grid-cols-1' : 'grid-cols-1 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]'
                  )}
                >
                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Primary</p>
                    <OutputPane script={primaryScript} romanStyle={romanStyle} tamilStyle={tamilStyle} />
                  </div>
                  {compareWith !== 'off' && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Compare</p>
                      <OutputPane script={compareWith} romanStyle={romanStyle} tamilStyle={tamilStyle} />
                    </div>
                  )}
                </div>
                <div className="mt-4 rounded-[1.4rem] border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-xs leading-6 text-slate-600">
                  Compare stays off by default. When enabled, the secondary pane should stay slightly quieter than the
                  primary pane and stack below it on smaller screens.
                </div>
              </div>
            </section>
          </div>
        </section>
      </div>
    </div>
  );
}
