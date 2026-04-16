import type { TemplateFamily } from './types.ts';

export const DEFAULT_TEMPLATE_FAMILIES: TemplateFamily[] = ['plain', 'virama', 'matra', 'ending'];

export const resolveTemplateFamilies = (
  requested: TemplateFamily[] | undefined,
  includeVedic: boolean
): TemplateFamily[] => {
  const families = requested && requested.length > 0 ? requested : DEFAULT_TEMPLATE_FAMILIES;
  const resolved = [...new Set(families)];
  if (includeVedic && !resolved.includes('vedic')) {
    resolved.push('vedic');
  }
  return resolved;
};

export const TEMPLATE_DESCRIPTIONS: Record<TemplateFamily, string> = {
  plain: 'Base character plus valid mark padding',
  virama: 'Consonant cluster with virama host chain',
  matra: 'Consonant host plus dependent vowel sign',
  ending: 'Base character plus ending mark chain',
  vedic: 'Base character plus optional Vedic mark tail',
};
