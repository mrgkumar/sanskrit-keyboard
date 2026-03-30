#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import math
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
from sklearn.linear_model import LogisticRegression

from runProbabilisticPredictionGame import (
  DEFAULT_SUGGESTION_LIMIT,
  MAX_SAMPLED_MISSES,
  MIN_LOOKUP_PREFIX_LENGTH,
  CharNGramModel,
  DiskRuntimeLexicon,
  MODEL_PROFILES,
  RuntimeLexiconEntry,
  load_json,
  load_or_train_model,
  normalize_for_lexical_lookup,
  sample_prepared_dataset,
)
from runSanskritPredictionGame import (
  SANSKRIT_PROFILES,
  average_surface_score,
  load_or_train_model as load_or_train_sanskrit_model,
)


@dataclass(frozen=True)
class SupervisedProfile:
  id: str
  label: str
  description: str
  retrieval_limit: int
  ngram_profile_id: str
  sanskrit_profile_id: str | None
  c: float
  class_weight: str


SUPERVISED_PROFILES: dict[str, SupervisedProfile] = {
  's001-logreg-v1': SupervisedProfile(
    id='s001-logreg-v1',
    label='S-001 Logistic Reranker v1',
    description='Logistic regression over lexical count, prefix depth, remaining length, lexical noise, and n-gram continuation score.',
    retrieval_limit=24,
    ngram_profile_id='m001-char-ngram-v1',
    sanskrit_profile_id=None,
    c=1.0,
    class_weight='balanced',
  ),
  's001-logreg-v2': SupervisedProfile(
    id='s001-logreg-v2',
    label='S-001 Logistic Reranker v2',
    description='A slightly less regularized logistic reranker with a deeper candidate pool and the same n-gram feature set.',
    retrieval_limit=32,
    ngram_profile_id='m001-char-ngram-v1',
    sanskrit_profile_id=None,
    c=2.0,
    class_weight='balanced',
  ),
  's002-logreg-hybrid-v1': SupervisedProfile(
    id='s002-logreg-hybrid-v1',
    label='S-002 Logistic Hybrid v1',
    description='Logistic reranker over the original feature set plus a Devanagari surface-language score.',
    retrieval_limit=24,
    ngram_profile_id='m001-char-ngram-v1',
    sanskrit_profile_id='d001-devanagari-ngram-v1',
    c=1.0,
    class_weight='balanced',
  ),
  's002-logreg-hybrid-v2': SupervisedProfile(
    id='s002-logreg-hybrid-v2',
    label='S-002 Logistic Hybrid v2',
    description='A deeper hybrid logistic reranker with both ITRANS continuation and Devanagari surface priors.',
    retrieval_limit=32,
    ngram_profile_id='m001-char-ngram-v1',
    sanskrit_profile_id='d001-devanagari-ngram-v1',
    c=2.0,
    class_weight='balanced',
  ),
}


def compute_noise_penalty(itrans: str) -> float:
  penalty = 0.0
  if any(ord(char) > 127 for char in itrans):
    penalty += 200.0
  if any(char.isdigit() for char in itrans):
    penalty += 120.0
  if '//' in itrans or '__' in itrans:
    penalty += 80.0
  if itrans.count(':') > 1:
    penalty += 40.0
  if len(itrans) >= 24:
    penalty += 25.0
  return penalty


def load_prepared_dataset(cache_dir: Path, dataset_id: str) -> dict[str, Any]:
  payload = load_json(cache_dir / f'{dataset_id}.prepared.json')
  return payload['prepared']


def load_prepared_dataset_variant(cache_dir: Path, dataset_id: str, limit: int | None = None) -> dict[str, Any]:
  suffix = f'.limit-{limit}' if limit and limit > 0 else ''
  payload = load_json(cache_dir / f'{dataset_id}{suffix}.prepared.json')
  return payload['prepared']


def build_feature_vector(
  entry: RuntimeLexiconEntry,
  prefix: str,
  model: CharNGramModel,
  sanskrit_model: CharNGramModel | None = None,
) -> list[float]:
  normalized_prefix = normalize_for_lexical_lookup(prefix)
  remaining_length = max(len(entry.itrans) - len(normalized_prefix), 0)
  prefix_ratio = len(normalized_prefix) / max(len(entry.itrans), 1)
  continuation_score = model.score_continuation(entry.itrans, normalized_prefix)
  return [
    math.log(max(entry.count, 1)),
    len(entry.itrans),
    len(normalized_prefix),
    remaining_length,
    prefix_ratio,
    compute_noise_penalty(entry.itrans),
    continuation_score,
    average_surface_score(sanskrit_model, entry.devanagari) if sanskrit_model else 0.0,
  ]


def train_logistic_regression(
  prepared: dict[str, Any],
  lexicon: DiskRuntimeLexicon,
  profile: SupervisedProfile,
  ngram_model: CharNGramModel,
  sanskrit_model: CharNGramModel | None,
) -> LogisticRegression:
  feature_rows: list[list[float]] = []
  labels: list[int] = []

  for query in prepared['queries']:
    target = str(query['target'])
    final_prefix_length = max(MIN_LOOKUP_PREFIX_LENGTH, len(target) - 1)
    prefix = target[:final_prefix_length]
    candidates = lexicon.get_candidates(prefix, profile.retrieval_limit)
    if not candidates:
      continue

    for entry in candidates:
      feature_rows.append(build_feature_vector(entry, prefix, ngram_model, sanskrit_model))
      labels.append(1 if entry.itrans == target else 0)

  if not feature_rows or len(set(labels)) < 2:
    raise RuntimeError('Unable to build a valid supervised training set.')

  x_train = np.asarray(feature_rows, dtype=np.float64)
  y_train = np.asarray(labels, dtype=np.int32)
  model = LogisticRegression(
    max_iter=1000,
    solver='liblinear',
    C=profile.c,
    class_weight=profile.class_weight,
  )
  model.fit(x_train, y_train)
  return model


def rank_candidates(
  candidates: list[RuntimeLexiconEntry],
  prefix: str,
  ngram_model: CharNGramModel,
  sanskrit_model: CharNGramModel | None,
  classifier: LogisticRegression,
  suggestion_limit: int,
) -> list[RuntimeLexiconEntry]:
  if not candidates:
    return []

  features = np.asarray([build_feature_vector(entry, prefix, ngram_model, sanskrit_model) for entry in candidates], dtype=np.float64)
  probabilities = classifier.predict_proba(features)[:, 1]
  ranked = sorted(
    zip(candidates, probabilities),
    key=lambda item: (float(item[1]), item[0].count, -len(item[0].itrans), item[0].itrans),
    reverse=True,
  )
  return [entry for entry, _ in ranked[:suggestion_limit]]


def create_empty_metrics() -> dict[str, int]:
  return {
    'queries': 0,
    'top1Hits': 0,
    'top3Hits': 0,
    'top5Hits': 0,
  }


def increment_metric(metric: dict[str, int], suggestions: list[RuntimeLexiconEntry], target: str, weight: int) -> None:
  metric['queries'] += weight
  if suggestions and suggestions[0].itrans == target:
    metric['top1Hits'] += weight
  if any(entry.itrans == target for entry in suggestions[:3]):
    metric['top3Hits'] += weight
  if any(entry.itrans == target for entry in suggestions[:5]):
    metric['top5Hits'] += weight


def to_rate(hits: int, queries: int) -> float:
  return hits / queries if queries else 0.0


def summarize_metrics(metric: dict[str, int]) -> dict[str, float | int]:
  return {
    'queries': metric['queries'],
    'top1Hits': metric['top1Hits'],
    'top3Hits': metric['top3Hits'],
    'top5Hits': metric['top5Hits'],
    'top1Rate': to_rate(metric['top1Hits'], metric['queries']),
    'top3Rate': to_rate(metric['top3Hits'], metric['queries']),
    'top5Rate': to_rate(metric['top5Hits'], metric['queries']),
  }


def evaluate_dataset(
  prepared: dict[str, Any],
  lexicon: DiskRuntimeLexicon,
  profile: SupervisedProfile,
  ngram_model: CharNGramModel,
  sanskrit_model: CharNGramModel | None,
  classifier: LogisticRegression,
) -> dict[str, Any]:
  final_prefix_metrics = create_empty_metrics()
  all_prefix_metrics = create_empty_metrics()
  sample_misses: list[dict[str, Any]] = []
  in_lexicon_words = 0
  missing_words = 0

  for query in prepared['queries']:
    row_id = str(query['rowId'])
    target = str(query['target'])
    devanagari = str(query['devanagari'])
    weight = int(query['weight'])

    if lexicon.has_entry(target):
      in_lexicon_words += weight
    else:
      missing_words += weight

    final_prefix_length = max(MIN_LOOKUP_PREFIX_LENGTH, len(target) - 1)
    for prefix_length in range(MIN_LOOKUP_PREFIX_LENGTH, final_prefix_length + 1):
      prefix = target[:prefix_length]
      candidates = lexicon.get_candidates(prefix, profile.retrieval_limit)
      suggestions = rank_candidates(candidates, prefix, ngram_model, sanskrit_model, classifier, DEFAULT_SUGGESTION_LIMIT)
      increment_metric(all_prefix_metrics, suggestions, target, weight)
      if prefix_length == final_prefix_length:
        increment_metric(final_prefix_metrics, suggestions, target, weight)

      hit = any(entry.itrans == target for entry in suggestions)
      if not hit and len(sample_misses) < MAX_SAMPLED_MISSES:
        sample_misses.append({
          'datasetId': prepared['datasetId'],
          'rowId': row_id,
          'prefix': prefix,
          'target': target,
          'devanagari': devanagari,
          'suggestions': [entry.itrans for entry in suggestions],
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
    'sampleMisses': sample_misses,
  }


def sort_results(results: list[dict[str, Any]]) -> list[dict[str, Any]]:
  return sorted(
    results,
    key=lambda result: (
      -float(result['prefixMetrics']['finalPrefix']['top5Rate']),
      -float(result['prefixMetrics']['finalPrefix']['top3Rate']),
      -float(result['prefixMetrics']['finalPrefix']['top1Rate']),
      str(result['profileId']),
    ),
  )


def parse_args() -> argparse.Namespace:
  root = Path(__file__).resolve().parents[2]
  parser = argparse.ArgumentParser(description='Run supervised autocomplete experiments using sklearn.')
  parser.add_argument('--profiles', default=','.join(SUPERVISED_PROFILES.keys()))
  parser.add_argument('--train-dataset', default='san-train')
  parser.add_argument('--tuning-dataset', default='san-valid')
  parser.add_argument('--holdout-dataset', default='san-test')
  parser.add_argument('--data-root', default=str(root / 'generated' / 'autocomplete'))
  parser.add_argument('--cache-dir', default=str(root / 'generated' / 'autocomplete' / 'experiments' / 'cache'))
  parser.add_argument('--output', default=str(root / 'generated' / 'autocomplete' / 'experiments' / 'supervised-leaderboard.json'))
  parser.add_argument('--sample-limit', type=int, default=None)
  parser.add_argument('--train-limit', type=int, default=None)
  parser.add_argument('--skip-cache', action='store_true')
  return parser.parse_args()


def main() -> int:
  args = parse_args()
  started_at = time.time()
  profile_ids = [profile_id.strip() for profile_id in args.profiles.split(',') if profile_id.strip()]
  profiles = [SUPERVISED_PROFILES[profile_id] for profile_id in profile_ids]

  data_root = Path(args.data_root).resolve()
  cache_dir = Path(args.cache_dir).resolve()
  output_path = Path(args.output).resolve()
  lexicon = DiskRuntimeLexicon(data_root)

  train_prepared = load_prepared_dataset_variant(cache_dir, args.train_dataset, args.train_limit)
  tuning_prepared = sample_prepared_dataset(load_prepared_dataset(cache_dir, args.tuning_dataset), args.sample_limit)
  holdout_prepared = sample_prepared_dataset(load_prepared_dataset(cache_dir, args.holdout_dataset), args.sample_limit)

  tuning_results: list[dict[str, Any]] = []
  trained_classifiers: dict[str, LogisticRegression] = {}
  trained_ngram_models: dict[str, CharNGramModel] = {}
  trained_sanskrit_models: dict[str, CharNGramModel | None] = {}

  for profile in profiles:
    ngram_model = load_or_train_model(MODEL_PROFILES[profile.ngram_profile_id], data_root, cache_dir, args.skip_cache)
    sanskrit_model = (
      load_or_train_sanskrit_model(SANSKRIT_PROFILES[profile.sanskrit_profile_id], data_root, cache_dir, args.skip_cache)
      if profile.sanskrit_profile_id
      else None
    )
    classifier = train_logistic_regression(train_prepared, lexicon, profile, ngram_model, sanskrit_model)
    trained_classifiers[profile.id] = classifier
    trained_ngram_models[profile.id] = ngram_model
    trained_sanskrit_models[profile.id] = sanskrit_model
    tuning_results.append(evaluate_dataset(tuning_prepared, lexicon, profile, ngram_model, sanskrit_model, classifier))

  tuning_results = sort_results(tuning_results)
  winner = tuning_results[0]
  winner_profile = SUPERVISED_PROFILES[winner['profileId']]
  holdout_result = evaluate_dataset(
    holdout_prepared,
    lexicon,
    winner_profile,
    trained_ngram_models[winner_profile.id],
    trained_sanskrit_models[winner_profile.id],
    trained_classifiers[winner_profile.id],
  )

  payload = {
    'version': 1,
    'generatedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
    'durationMs': int((time.time() - started_at) * 1000),
    'trainDataset': args.train_dataset,
    'tuningDataset': args.tuning_dataset,
    'holdoutDataset': args.holdout_dataset,
    'sampleLimit': args.sample_limit,
    'trainLimit': args.train_limit,
    'cacheDir': str(cache_dir),
    'winner': {
      'profileId': winner_profile.id,
      'label': winner_profile.label,
    },
    'leaderboard': [
      {
        'rank': index + 1,
        'profileId': result['profileId'],
        'label': SUPERVISED_PROFILES[result['profileId']].label,
        'description': SUPERVISED_PROFILES[result['profileId']].description,
        'finalPrefix': result['prefixMetrics']['finalPrefix'],
        'allPrefixes': result['prefixMetrics']['allPrefixes'],
        'missingWords': result['missingWords'],
        'sampleMisses': result['sampleMisses'],
      }
      for index, result in enumerate(tuning_results)
    ],
    'holdoutCheck': {
      'profileId': holdout_result['profileId'],
      'label': winner_profile.label,
      'description': winner_profile.description,
      'finalPrefix': holdout_result['prefixMetrics']['finalPrefix'],
      'allPrefixes': holdout_result['prefixMetrics']['allPrefixes'],
      'missingWords': holdout_result['missingWords'],
      'sampleMisses': holdout_result['sampleMisses'],
    },
  }

  output_path.parent.mkdir(parents=True, exist_ok=True)
  output_path.write_text(json.dumps(payload, indent=2) + '\n', encoding='utf8')
  print(json.dumps(payload, indent=2))
  return 0


if __name__ == '__main__':
  raise SystemExit(main())
