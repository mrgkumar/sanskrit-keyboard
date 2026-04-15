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
  style?: React.CSSProperties;
  sanskritFontPreset?: SanskritFontPreset;
  tamilFontPreset?: TamilFontPreset;
}

export const getScriptDisplayText = (script: OutputScript, text: string) => {
  if (script === 'tamil') {
    return normalizeTamilPrecisionDisplayText(text);
  }

  return text;
};

export const renderTamilPrecisionText = (text: string) => {
  return [
    <span key="tamil-precision" className="tamil-precision-akshara" dir="ltr">
      {getScriptDisplayText('tamil', text)}
    </span>,
  ];
};

export const ScriptText: React.FC<ScriptTextProps> = ({
  text,
  script,
  className,
  style,
  sanskritFontPreset = 'chandas',
  tamilFontPreset = 'anek',
}) => {
  if (script === 'roman') {
    return (
      <span className={clsx('inline script-text-wrap whitespace-pre-wrap break-words font-mono text-slate-800', className)} style={style}>
        {text}
      </span>
    );
  }

  if (script === 'tamil') {
    return (
      <span
        className={clsx('inline script-text-tamil script-text-wrap whitespace-pre-wrap break-words text-slate-900', className)}
        data-font-preset={tamilFontPreset}
        lang="ta"
        dir="ltr"
        style={style}
      >
        {renderTamilPrecisionText(text)}
      </span>
    );
  }

  return (
    <span
      className={clsx('inline font-serif script-text-devanagari script-text-wrap whitespace-pre-wrap break-words text-slate-900', className)}
      data-font-preset={sanskritFontPreset}
      lang="sa-Deva"
      style={style}
    >
      {text}
    </span>
  );

};
