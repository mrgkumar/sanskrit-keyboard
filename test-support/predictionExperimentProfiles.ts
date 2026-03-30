export interface PredictionExperimentProfile {
  id: string;
  label: string;
  track: 'ranking';
  description: string;
  candidatePoolLimit: number;
  remainingLengthPenalty: number;
}

export const PREDICTION_EXPERIMENT_PROFILES: Record<string, PredictionExperimentProfile> = {
  baseline: {
    id: 'baseline',
    label: 'Baseline Frequency Ranking',
    track: 'ranking',
    description: 'Current lexical ranking by corpus frequency, then shorter ITRANS, then alphabetical order.',
    candidatePoolLimit: 8,
    remainingLengthPenalty: 0,
  },
  'r001-completion-distance-v1': {
    id: 'r001-completion-distance-v1',
    label: 'R-001 Completion Distance v1',
    track: 'ranking',
    description:
      'Penalize candidates that still require many characters after the typed prefix, while keeping corpus frequency as the main signal.',
    candidatePoolLimit: 16,
    remainingLengthPenalty: 25,
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
