'use client';

import React from 'react';
import { clsx } from 'clsx';
import type { OutputScript } from '@/lib/vedic/mapping';
import type { SanskritFontPreset, TamilFontPreset } from '@/store/types';

interface ScriptTextProps {
  text: string;
  script: OutputScript;
  className?: string;
  sanskritFontPreset?: SanskritFontPreset;
  tamilFontPreset?: TamilFontPreset;
}

const TAMIL_PRECISION_MARKER_PATTERN = /[¹²³⁴]/u;
const COMBINING_MARK_PATTERN = /\p{Mark}/u;

const renderTamilPrecisionText = (text: string) => {
  const chars = Array.from(text.replaceAll('ஂ', 'ம்'));
  const nodes: React.ReactNode[] = [];

  for (let index = 0; index < chars.length; index += 1) {
    const char = chars[index];
    const marker = chars[index + 1];

    if (marker && TAMIL_PRECISION_MARKER_PATTERN.test(marker)) {
      let trailingMarks = '';
      let cursor = index + 2;

      while (cursor < chars.length && COMBINING_MARK_PATTERN.test(chars[cursor])) {
        trailingMarks += chars[cursor];
        cursor += 1;
      }

      nodes.push(
        <span key={`${index}-${char}-${marker}`} className="tamil-precision-akshara">
          {char}
          {trailingMarks}
          <span aria-hidden="true" className="tamil-precision-marker">
            {marker}
          </span>
        </span>
      );
      index = cursor - 1;
      continue;
    }

    if (TAMIL_PRECISION_MARKER_PATTERN.test(char)) {
      nodes.push(
        <span key={`${index}-${char}`} aria-hidden="true" className="tamil-precision-marker">
          {char}
        </span>
      );
      continue;
    }

    nodes.push(<React.Fragment key={`${index}-${char}`}>{char}</React.Fragment>);
  }

  return nodes;
};

export const ScriptText: React.FC<ScriptTextProps> = ({
  text,
  script,
  className,
  sanskritFontPreset = 'chandas',
  tamilFontPreset = 'hybrid',
}) => {
  if (script === 'roman') {
    return (
      <span className={clsx('script-text-wrap whitespace-pre-wrap font-mono text-slate-800', className)}>
        {text}
      </span>
    );
  }

  if (script === 'tamil') {
    return (
      <span
        className={clsx('script-text-tamil script-text-wrap whitespace-pre-wrap text-slate-900', className)}
        data-font-preset={tamilFontPreset}
        lang="ta"
      >
        {renderTamilPrecisionText(text)}
      </span>
    );
  }

  return (
    <span
      className={clsx('script-text-devanagari script-text-wrap whitespace-pre-wrap text-slate-900', className)}
      data-font-preset={sanskritFontPreset}
      lang="sa"
    >
      {text}
    </span>
  );
};
