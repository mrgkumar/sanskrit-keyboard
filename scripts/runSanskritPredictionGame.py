#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import math
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from runProbabilisticPredictionGame import (
  DEFAULT_SUGGESTION_LIMIT,
  MAX_SAMPLED_MISSES,
  MIN_LOOKUP_PREFIX_LENGTH,
  CharNGramModel,
  DiskRuntimeLexicon,
  RuntimeLexiconEntry,
  create_empty_failure_breakdown,
  create_empty_metrics,
  fingerprint,
  fingerprints_match,
  increment_metric,
  load_completion_table,
  load_json,
  sample_prepared_dataset,
  sort_results,
  summarize_failure_breakdown,
  summarize_metrics,
)


@dataclass(frozen=True)
class SanskritProfile:
  id: str
  label: str
  description: str
  retrieval_limit: int
  order: int
  alpha: float
  count_weight: float
  surface_weight: float


SANSKRIT_PROFILES: dict[str, SanskritProfile] = {
  'd001-devanagari-ngram-v1': SanskritProfile(
    id='d001-devanagari-ngram-v1',
    label='D-001 Devanagari N-gram v1',
    description='Devanagari surface-language reranker that combines lexical count with average 5-gram character likelihood over the candidate Sanskrit form.',
    retrieval_limit=32,
    order=5,
    alpha=0.5,
    count_weight=1.0,
    surface_weight=0.55,
  ),
  'd001-devanagari-ngram-v2': SanskritProfile(
    id='d001-devanagari-ngram-v2',
    label='D-001 Devanagari N-gram v2',
    description='A stronger 6-gram Devanagari surface reranker with a deeper pool and higher surface weight.',
    retrieval_limit=48,
    order=6,
    alpha=0.35,
    count_weight=0.9,
    surface_weight=0.8,
  ),
}


def load_prepared_dataset(cache_dir: Path, dataset_id: str) -> dict[str, Any]:
  payload = load_json(cache_dir / f'{dataset_id}.prepared.json')
  return payload['prepared']


def average_surface_score(model: CharNGramModel, devanagari: str) -> float:
  padded_length = max(len(devanagari) + 1, 1)
  return model.score_continuation(devanagari, '') / padded_length


def load_or_train_model(profile: SanskritProfile, data_root: Path, cache_dir: Path, skip_cache: bool) -> CharNGramModel:
  manifest_path = data_root / 'completion-table.json'
  source_fingerprint = fingerprint(manifest_path)
  cache_path = cache_dir / f'{profile.id}.model.json'

  if not skip_cache and cache_path.exists():
    try:
      cached = load_json(cache_path)
      if (
        cached.get('version') == 1
        and fingerprints_match(cached.get('source', {}), source_fingerprint)
        and int(cached.get('order', 0)) == profile.order
        and float(cached.get('alpha', 0.0)) == profile.alpha
      ):
        return CharNGramModel.from_json(cached['model'])
    except Exception:
      pass

  model = CharNGramModel(order=profile.order, alpha=profile.alpha)
  for entry in load_completion_table(data_root):
    model.train(entry.sanskrit_word, max(entry.frequency, 1))

  cache_dir.mkdir(parents=True, exist_ok=True)
  cache_payload = {
    'version': 1,
    'source': source_fingerprint,
    'order': profile.order,
    'alpha': profile.alpha,
    'model': model.to_json(),
  }
  cache_path.write_text(json.dumps(cache_payload, indent=2) + '\n', encoding='utf8')
  return model


def rank_candidates(
  candidates: list[RuntimeLexiconEntry],
  model: CharNGramModel,
  profile: SanskritProfile,
  suggestion_limit: int,
) -> list[RuntimeLexiconEntry]:
  def score(entry: RuntimeLexiconEntry) -> tuple[float, int, int, str]:
    count_score = math.log(max(entry.count, 1))
    surface_score = average_surface_score(model, entry.devanagari)
    blended = profile.count_weight * count_score + profile.surface_weight * surface_score
    return (blended, entry.count, -len(entry.itrans), entry.itrans)

  ranked = sorted(candidates, key=score, reverse=True)
  return ranked[:suggestion_limit]


def evaluate_prepared_dataset(
  prepared: dict[str, Any],
  lexicon: DiskRuntimeLexicon,
  model: CharNGramModel,
  profile: SanskritProfile,
) -> dict[str, Any]:
  final_prefix_metrics = create_empty_metrics()
  all_prefix_metrics = create_empty_metrics()
  final_prefix_failures = create_empty_failure_breakdown()
  all_prefix_failures = create_empty_failure_breakdown()
  sample_misses: list[dict[str, Any]] = []
  in_lexicon_words = 0
  missing_words = 0

  for query in prepared['queries']:
    row_id = str(query['rowId'])
    target = str(query['target'])
    devanagari = str(query['devanagari'])
    weight = int(query['weight'])

    in_lexicon = lexicon.has_entry(target)
    if in_lexicon:
      in_lexicon_words += weight
    else:
      missing_words += weight

    final_prefix_length = max(MIN_LOOKUP_PREFIX_LENGTH, len(target) - 1)
    for prefix_length in range(MIN_LOOKUP_PREFIX_LENGTH, final_prefix_length + 1):
      prefix = target[:prefix_length]
      candidates = lexicon.get_candidates(prefix, profile.retrieval_limit)
      suggestions = rank_candidates(candidates, model, profile, DEFAULT_SUGGESTION_LIMIT)
      increment_metric(all_prefix_metrics, suggestions, target, weight)
      all_prefix_failures['queries'] += weight
      if prefix_length == final_prefix_length:
        increment_metric(final_prefix_metrics, suggestions, target, weight)
        final_prefix_failures['queries'] += weight

      hit = any(entry.itrans == target for entry in suggestions[:DEFAULT_SUGGESTION_LIMIT])
      failure_type = 'ranking' if in_lexicon else 'retrieval'
      if not hit:
        if in_lexicon:
          all_prefix_failures['rankingFailures'] += weight
        else:
          all_prefix_failures['retrievalFailures'] += weight

      if not hit and prefix_length == final_prefix_length:
        if in_lexicon:
          final_prefix_failures['rankingFailures'] += weight
        else:
          final_prefix_failures['retrievalFailures'] += weight

      if not hit and len(sample_misses) < MAX_SAMPLED_MISSES:
        sample_misses.append({
          'datasetId': prepared['datasetId'],
          'rowId': row_id,
          'prefix': prefix,
          'target': target,
          'devanagari': devanagari,
          'suggestions': [entry.itrans for entry in suggestions],
          'failureType': failure_type,
        })

  return {
    'profileId': profile.id,
    'datasetId': prepared['datasetId'],
    'datasetLabel': prepared['datasetLabel'],
    'rowCount': int(prepared['rowCount']),
    'skippedRows': int(prepared['skippedRows']),
    'eligibleWords': int(prepared['eligibleWords']),
    'inLexiconWords': in_lexicon_words,
    'missingWords': missing_words,
    'prefixMetrics': {
      'finalPrefix': summarize_metrics(final_prefix_metrics),
      'allPrefixes': summarize_metrics(all_prefix_metrics),
    },
    'failureBreakdown': {
      'finalPrefix': summarize_failure_breakdown(final_prefix_failures),
      'allPrefixes': summarize_failure_breakdown(all_prefix_failures),
    },
    'sampleMisses': sample_misses,
  }


def load_reference_metrics(path: Path) -> dict[str, Any] | None:
  if not path.exists():
    return None
  try:
    return load_json(path)
  except Exception:
    return None


def parse_args() -> argparse.Namespace:
  default_output = Path(__file__).resolve().parents[2] / 'generated' / 'autocomplete' / 'experiments' / 'sanskrit-leaderboard.json'
  default_cache_dir = Path(__file__).resolve().parents[2] / 'generated' / 'autocomplete' / 'experiments' / 'cache'
  default_data_root = Path(__file__).resolve().parents[2] / 'generated' / 'autocomplete'

  parser = argparse.ArgumentParser(description='Run Sanskrit-side autocomplete experiments over prepared held-out datasets.')
  parser.add_argument('--profiles', default=','.join(SANSKRIT_PROFILES.keys()))
  parser.add_argument('--tuning-dataset', default='san-valid')
  parser.add_argument('--holdout-dataset', default='san-test')
  parser.add_argument('--data-root', default=str(default_data_root))
  parser.add_argument('--cache-dir', default=str(default_cache_dir))
  parser.add_argument('--output', default=str(default_output))
  parser.add_argument('--sample-limit', type=int, default=None)
  parser.add_argument('--skip-cache', action='store_true')
  return parser.parse_args()


def main() -> int:
  args = parse_args()
  started_at = time.time()

  profile_ids = [profile_id.strip() for profile_id in args.profiles.split(',') if profile_id.strip()]
  profiles = [SANSKRIT_PROFILES[profile_id] for profile_id in profile_ids]
  data_root = Path(args.data_root).resolve()
  cache_dir = Path(args.cache_dir).resolve()
  output_path = Path(args.output).resolve()
  experiments_dir = output_path.parent

  tuning_prepared = sample_prepared_dataset(load_prepared_dataset(cache_dir, args.tuning_dataset), args.sample_limit)
  holdout_prepared = sample_prepared_dataset(load_prepared_dataset(cache_dir, args.holdout_dataset), args.sample_limit)

  lexicon = DiskRuntimeLexicon(data_root)
  tuning_results: list[dict[str, Any]] = []

  for profile in profiles:
    model = load_or_train_model(profile, data_root, cache_dir, args.skip_cache)
    tuning_results.append(evaluate_prepared_dataset(tuning_prepared, lexicon, model, profile))

  tuning_results = sort_results(tuning_results)
  winner = tuning_results[0]
  winner_profile = SANSKRIT_PROFILES[winner['profileId']]
  holdout_model = load_or_train_model(winner_profile, data_root, cache_dir, args.skip_cache)
  holdout_result = evaluate_prepared_dataset(holdout_prepared, lexicon, holdout_model, winner_profile)

  payload = {
    'version': 1,
    'generatedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
    'durationMs': int((time.time() - started_at) * 1000),
    'tuningDataset': args.tuning_dataset,
    'holdoutDataset': args.holdout_dataset,
    'sampleLimit': args.sample_limit,
    'cacheDir': str(cache_dir),
    'winner': {
      'profileId': winner_profile.id,
      'label': winner_profile.label,
    },
    'leaderboard': [
      {
        'rank': index + 1,
        'profileId': result['profileId'],
        'label': SANSKRIT_PROFILES[result['profileId']].label,
        'description': SANSKRIT_PROFILES[result['profileId']].description,
        'tuning': result,
      }
      for index, result in enumerate(tuning_results)
    ],
    'holdout': holdout_result,
    'heuristicReference': load_reference_metrics(experiments_dir / 'leaderboard.json'),
    'probabilisticReference': load_reference_metrics(experiments_dir / 'probabilistic-leaderboard.json'),
    'supervisedReference': load_reference_metrics(experiments_dir / 'supervised-leaderboard.json'),
  }

  output_path.parent.mkdir(parents=True, exist_ok=True)
  output_path.write_text(json.dumps(payload, indent=2) + '\n', encoding='utf8')

  winner_text = winner_profile.label
  final_top5 = holdout_result['prefixMetrics']['finalPrefix']['top5Rate']
  print(f'Winner: {winner_text}')
  print(f'Holdout final-prefix top5: {final_top5:.4f}')
  print(f'Wrote: {output_path}')
  return 0


if __name__ == '__main__':
  raise SystemExit(main())
