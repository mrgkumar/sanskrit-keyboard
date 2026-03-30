export interface PredictionExperimentProfile {
  id: string;
  label: string;
  track: 'ranking';
  description: string;
  candidatePoolLimit: number;
  remainingLengthPenalty: number;
  activationMinPrefixLength: number;
}

export const PREDICTION_EXPERIMENT_PROFILES: Record<string, PredictionExperimentProfile> = {
  baseline: {
    id: 'baseline',
    label: 'Baseline Frequency Ranking',
    track: 'ranking',
    description: 'Current lexical ranking by corpus frequency, then shorter ITRANS, then alphabetical order.',
    candidatePoolLimit: 8,
    remainingLengthPenalty: 0,
    activationMinPrefixLength: 99,
  },
  'r001-completion-distance-v1': {
    id: 'r001-completion-distance-v1',
    label: 'R-001 Completion Distance v1',
    track: 'ranking',
    description:
      'Penalize candidates that still require many characters after the typed prefix, while keeping corpus frequency as the main signal.',
    candidatePoolLimit: 16,
    remainingLengthPenalty: 25,
    activationMinPrefixLength: 5,
  },
  'r001-completion-distance-v2': {
    id: 'r001-completion-distance-v2',
    label: 'R-001 Completion Distance v2',
    track: 'ranking',
    description:
      'Apply the completion-distance penalty only after a longer typed prefix, preserving broad early-prefix ranking while sharpening late completions.',
    candidatePoolLimit: 16,
    remainingLengthPenalty: 25,
    activationMinPrefixLength: 6,
  },
};

export const resolvePredictionExperimentProfile = (id: string) => {
  const profile = PREDICTION_EXPERIMENT_PROFILES[id];
  if (!profile) {
    throw new Error(
      `Unknown prediction experiment profile "${id}". Known profiles: ${Object.keys(PREDICTION_EXPERIMENT_PROFILES).join(', ')}`
    );
  }

  return profile;
};
