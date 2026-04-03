'use client';

import React from 'react';
import { clsx } from 'clsx';
import type { OutputScript } from '@/lib/vedic/mapping';
import { normalizeTamilPrecisionDisplayText } from '@/lib/vedic/utils';
import type { SanskritFontPreset, TamilFontPreset } from '@/store/types';

interface ScriptTextProps {
  text: string;
  script: OutputScript;
  className?: string;
  sanskritFontPreset?: SanskritFontPreset;
  tamilFontPreset?: TamilFontPreset;
}

export const renderTamilPrecisionText = (text: string) => {
  return [
    <span key="tamil-precision" className="tamil-precision-akshara" dir="ltr">
      {normalizeTamilPrecisionDisplayText(text)}
    </span>,
  ];
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
        dir="ltr"
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
