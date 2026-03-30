export interface PredictionExperimentProfile {
  id: string;
  label: string;
  track: 'ranking' | 'source-weighting';
  description: string;
  candidatePoolLimit: number;
  remainingLengthPenalty: number;
  activationMinPrefixLength: number;
  activationMinPrefixRatio: number;
  activationMaxRemainingLength: number | null;
  sourceWeights: Record<string, number> | null;
  noisePenaltyMultiplier: number;
  continuationBranchPenalty: number;
  continuationBranchDepth: number;
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
    activationMinPrefixRatio: 1,
    activationMaxRemainingLength: null,
    sourceWeights: null,
    noisePenaltyMultiplier: 0,
    continuationBranchPenalty: 0,
    continuationBranchDepth: 1,
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
    activationMinPrefixRatio: 0,
    activationMaxRemainingLength: null,
    sourceWeights: null,
    noisePenaltyMultiplier: 0,
    continuationBranchPenalty: 0,
    continuationBranchDepth: 1,
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
    activationMinPrefixRatio: 0,
    activationMaxRemainingLength: null,
    sourceWeights: null,
    noisePenaltyMultiplier: 0,
    continuationBranchPenalty: 0,
    continuationBranchDepth: 1,
  },
  'r001-completion-distance-v3': {
    id: 'r001-completion-distance-v3',
    label: 'R-001 Completion Distance v3',
    track: 'ranking',
    description:
      'Apply the completion-distance penalty only when the typed prefix is both long enough and covers most of the candidate, preserving early-prefix breadth.',
    candidatePoolLimit: 16,
    remainingLengthPenalty: 25,
    activationMinPrefixLength: 5,
    activationMinPrefixRatio: 0.75,
    activationMaxRemainingLength: null,
    sourceWeights: null,
    noisePenaltyMultiplier: 0,
    continuationBranchPenalty: 0,
    continuationBranchDepth: 1,
  },
  'r001-completion-distance-v4': {
    id: 'r001-completion-distance-v4',
    label: 'R-001 Completion Distance v4',
    track: 'ranking',
    description:
      'Apply a milder completion-distance penalty only when the user is close to finishing the candidate, preserving broad early-prefix ranking.',
    candidatePoolLimit: 16,
    remainingLengthPenalty: 14,
    activationMinPrefixLength: 5,
    activationMinPrefixRatio: 0,
    activationMaxRemainingLength: 4,
    sourceWeights: null,
    noisePenaltyMultiplier: 0,
    continuationBranchPenalty: 0,
    continuationBranchDepth: 1,
  },
  'r001-completion-distance-v5': {
    id: 'r001-completion-distance-v5',
    label: 'R-001 Completion Distance v5',
    track: 'ranking',
    description:
      'Use a slightly deeper pool and a light late-stage completion-distance penalty only for near-finish candidates.',
    candidatePoolLimit: 24,
    remainingLengthPenalty: 10,
    activationMinPrefixLength: 5,
    activationMinPrefixRatio: 0,
    activationMaxRemainingLength: 4,
    sourceWeights: null,
    noisePenaltyMultiplier: 0,
    continuationBranchPenalty: 0,
    continuationBranchDepth: 1,
  },
  'r001-completion-distance-v6': {
    id: 'r001-completion-distance-v6',
    label: 'R-001 Completion Distance v6',
    track: 'ranking',
    description:
      'Apply a mild completion-distance penalty only after a longer prefix, testing whether v1 was directionally right but too aggressive.',
    candidatePoolLimit: 16,
    remainingLengthPenalty: 10,
    activationMinPrefixLength: 6,
    activationMinPrefixRatio: 0,
    activationMaxRemainingLength: null,
    sourceWeights: null,
    noisePenaltyMultiplier: 0,
    continuationBranchPenalty: 0,
    continuationBranchDepth: 1,
  },
  'r001-completion-distance-v7': {
    id: 'r001-completion-distance-v7',
    label: 'R-001 Completion Distance v7',
    track: 'ranking',
    description:
      'Apply a very mild completion-distance penalty only after a long prefix, minimizing early-prefix disturbance while testing late completion gains.',
    candidatePoolLimit: 16,
    remainingLengthPenalty: 6,
    activationMinPrefixLength: 7,
    activationMinPrefixRatio: 0,
    activationMaxRemainingLength: null,
    sourceWeights: null,
    noisePenaltyMultiplier: 0,
    continuationBranchPenalty: 0,
    continuationBranchDepth: 1,
  },
  'r002-source-weight-v1': {
    id: 'r002-source-weight-v1',
    label: 'R-002 Source Weight v1',
    track: 'source-weighting',
    description:
      'Down-weight example-vedic lexical counts while leaving cleaner corpus sources unchanged, reducing noisy Vedic dominance in ranking.',
    candidatePoolLimit: 8,
    remainingLengthPenalty: 0,
    activationMinPrefixLength: 99,
    activationMinPrefixRatio: 1,
    activationMaxRemainingLength: null,
    sourceWeights: {
      'example-vedic': 0.35,
    },
    noisePenaltyMultiplier: 0,
    continuationBranchPenalty: 0,
    continuationBranchDepth: 1,
  },
  'r002-source-weight-v2': {
    id: 'r002-source-weight-v2',
    label: 'R-002 Source Weight v2',
    track: 'source-weighting',
    description:
      'Apply a milder example-vedic down-weight, testing whether a softer source penalty improves ranking without overcorrecting.',
    candidatePoolLimit: 8,
    remainingLengthPenalty: 0,
    activationMinPrefixLength: 99,
    activationMinPrefixRatio: 1,
    activationMaxRemainingLength: null,
    sourceWeights: {
      'example-vedic': 0.55,
    },
    noisePenaltyMultiplier: 0,
    continuationBranchPenalty: 0,
    continuationBranchDepth: 1,
  },
  'r003-noise-penalty-v1': {
    id: 'r003-noise-penalty-v1',
    label: 'R-003 Noise Penalty v1',
    track: 'ranking',
    description:
      'Penalize mixed-script, digit-bearing, punctuation-heavy, and extremely long lexical entries while leaving clean forms unchanged.',
    candidatePoolLimit: 8,
    remainingLengthPenalty: 0,
    activationMinPrefixLength: 99,
    activationMinPrefixRatio: 1,
    activationMaxRemainingLength: null,
    sourceWeights: null,
    noisePenaltyMultiplier: 1,
    continuationBranchPenalty: 0,
    continuationBranchDepth: 1,
  },
  'r003-noise-penalty-v2': {
    id: 'r003-noise-penalty-v2',
    label: 'R-003 Noise Penalty v2',
    track: 'ranking',
    description:
      'Apply a milder lexical-noise penalty to suspicious ITRANS forms, testing whether a softer filter improves ranking without dropping coverage.',
    candidatePoolLimit: 8,
    remainingLengthPenalty: 0,
    activationMinPrefixLength: 99,
    activationMinPrefixRatio: 1,
    activationMaxRemainingLength: null,
    sourceWeights: null,
    noisePenaltyMultiplier: 0.5,
    continuationBranchPenalty: 0,
    continuationBranchDepth: 1,
  },
  'r004-continuation-branch-v1': {
    id: 'r004-continuation-branch-v1',
    label: 'R-004 Continuation Branch v1',
    track: 'ranking',
    description:
      'Prefer candidates whose next one-character continuation branch is less crowded, helping longer specific continuations surface once the prefix is informative.',
    candidatePoolLimit: 16,
    remainingLengthPenalty: 0,
    activationMinPrefixLength: 99,
    activationMinPrefixRatio: 1,
    activationMaxRemainingLength: null,
    sourceWeights: null,
    noisePenaltyMultiplier: 0,
    continuationBranchPenalty: 20,
    continuationBranchDepth: 1,
  },
  'r004-continuation-branch-v2': {
    id: 'r004-continuation-branch-v2',
    label: 'R-004 Continuation Branch v2',
    track: 'ranking',
    description:
      'Use a milder continuation-branch penalty over the next two characters, testing whether branch distinctness can help without overcorrecting.',
    candidatePoolLimit: 16,
    remainingLengthPenalty: 0,
    activationMinPrefixLength: 99,
    activationMinPrefixRatio: 1,
    activationMaxRemainingLength: null,
    sourceWeights: null,
    noisePenaltyMultiplier: 0,
    continuationBranchPenalty: 10,
    continuationBranchDepth: 2,
  },
  'r005-hybrid-v1': {
    id: 'r005-hybrid-v1',
    label: 'R-005 Hybrid v1',
    track: 'ranking',
    description:
      'Combine the safer late-prefix completion-distance bias from v6 with the strong lexical-noise penalty from R-003.',
    candidatePoolLimit: 16,
    remainingLengthPenalty: 10,
    activationMinPrefixLength: 6,
    activationMinPrefixRatio: 0,
    activationMaxRemainingLength: null,
    sourceWeights: null,
    noisePenaltyMultiplier: 1,
    continuationBranchPenalty: 0,
    continuationBranchDepth: 1,
  },
  'r005-hybrid-v2': {
    id: 'r005-hybrid-v2',
    label: 'R-005 Hybrid v2',
    track: 'ranking',
    description:
      'Combine the very mild late-prefix bias from v7 with the strong lexical-noise penalty, aiming for a safer overall tradeoff.',
    candidatePoolLimit: 16,
    remainingLengthPenalty: 6,
    activationMinPrefixLength: 7,
    activationMinPrefixRatio: 0,
    activationMaxRemainingLength: null,
    sourceWeights: null,
    noisePenaltyMultiplier: 1,
    continuationBranchPenalty: 0,
    continuationBranchDepth: 1,
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
