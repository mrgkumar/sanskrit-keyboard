#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import math
import os
import time
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Any


SHARD_PREFIX_LENGTH = 2
MIN_LOOKUP_PREFIX_LENGTH = 2
DEFAULT_SUGGESTION_LIMIT = 5
MAX_SAMPLED_MISSES = 10
START_TOKEN = '^'
END_TOKEN = '$'


@dataclass(frozen=True)
class RuntimeLexiconEntry:
  itrans: str
  devanagari: str
  count: int


@dataclass(frozen=True)
class ModelProfile:
  id: str
  label: str
  description: str
  retrieval_limit: int
  order: int
  alpha: float
  count_weight: float
  continuation_weight: float


MODEL_PROFILES: dict[str, ModelProfile] = {
  'baseline-frequency': ModelProfile(
    id='baseline-frequency',
    label='M-000 Baseline Frequency',
    description='Reference Python baseline that ranks only by lexical count, then shorter ITRANS, then alphabetical order.',
    retrieval_limit=24,
    order=5,
    alpha=0.5,
    count_weight=1.0,
    continuation_weight=0.0,
  ),
  'm001-char-ngram-v1': ModelProfile(
    id='m001-char-ngram-v1',
    label='M-001 Char N-gram v1',
    description='Character-level Markov reranker that combines log count with 5-gram continuation likelihood after the typed prefix.',
    retrieval_limit=32,
    order=5,
    alpha=0.5,
    count_weight=1.0,
    continuation_weight=0.65,
  ),
  'm001-char-ngram-v2': ModelProfile(
    id='m001-char-ngram-v2',
    label='M-001 Char N-gram v2',
    description='A stronger 6-gram continuation reranker with a deeper retrieval pool and higher continuation weight.',
    retrieval_limit=48,
    order=6,
    alpha=0.35,
    count_weight=0.85,
    continuation_weight=0.9,
  ),
}


def normalize_for_lexical_lookup(value: str) -> str:
  result_chars: list[str] = []
  index = 0
  while index < len(value):
    char = value[index]
    if char == '\\' and index + 1 < len(value):
      escaped = value[index + 1]
      if escaped in "_'\"^":
        index += 2
        continue

    if char in "_'\"^":
      index += 1
      continue

    result_chars.append(char)
    index += 1

  return ''.join(result_chars)


def to_rate(hits: int, queries: int) -> float:
  return hits / queries if queries > 0 else 0.0


class CharNGramModel:
  def __init__(self, order: int = 5, alpha: float = 0.5) -> None:
    self.order = order
    self.alpha = alpha
    self.context_totals: Counter[str] = Counter()
    self.context_next_counts: dict[str, Counter[str]] = {}
    self.alphabet: set[str] = {END_TOKEN}

  def train(self, word: str, weight: int) -> None:
    padded = (START_TOKEN * (self.order - 1)) + word + END_TOKEN
    self.alphabet.update(word)
    self.alphabet.add(END_TOKEN)
    for position in range(self.order - 1, len(padded)):
      next_char = padded[position]
      full_context = padded[position - (self.order - 1):position]
      self.context_totals[full_context] += weight
      if full_context not in self.context_next_counts:
        self.context_next_counts[full_context] = Counter()
      self.context_next_counts[full_context][next_char] += weight

      self.context_totals[''] += weight
      if '' not in self.context_next_counts:
        self.context_next_counts[''] = Counter()
      self.context_next_counts[''][next_char] += weight

  def log_probability(self, context: str, next_char: str) -> float:
    truncated_context = context[-(self.order - 1):]
    candidate_context = truncated_context if truncated_context in self.context_totals else ''
    next_counts = self.context_next_counts[candidate_context]
    total = self.context_totals[candidate_context]
    vocab_size = max(len(self.alphabet), 1)
    count = next_counts.get(next_char, 0)
    return math.log((count + self.alpha) / (total + self.alpha * vocab_size))

  def score_continuation(self, word: str, prefix: str) -> float:
    normalized_prefix = prefix[: len(word)]
    padded = (START_TOKEN * (self.order - 1)) + word + END_TOKEN
    prefix_position = min(len(normalized_prefix), len(word))
    start_index = (self.order - 1) + prefix_position
    score = 0.0
    for position in range(start_index, len(padded)):
      next_char = padded[position]
      context = padded[max(0, position - (self.order - 1)):position]
      score += self.log_probability(context, next_char)
    return score

  def to_json(self) -> dict[str, Any]:
    return {
      'version': 1,
      'order': self.order,
      'alpha': self.alpha,
      'alphabet': sorted(self.alphabet),
      'contextTotals': dict(self.context_totals),
      'contextNextCounts': {context: dict(counter) for context, counter in self.context_next_counts.items()},
    }

  @classmethod
  def from_json(cls, payload: dict[str, Any]) -> 'CharNGramModel':
    model = cls(order=int(payload['order']), alpha=float(payload['alpha']))
    model.alphabet = set(payload['alphabet'])
    model.context_totals = Counter({str(key): int(value) for key, value in payload['contextTotals'].items()})
    model.context_next_counts = {
      str(context): Counter({str(key): int(value) for key, value in counts.items()})
      for context, counts in payload['contextNextCounts'].items()
    }
    return model


class DiskRuntimeLexicon:
  def __init__(self, data_root: Path) -> None:
    self.data_root = data_root
    with (data_root / 'runtime-lexicon-shards-manifest.json').open('r', encoding='utf8') as handle:
      manifest = json.load(handle)
    self.shards: dict[str, dict[str, Any]] = {
      shard['prefix']: shard for shard in manifest['shards']
    }
    self.shard_cache: dict[str, list[RuntimeLexiconEntry]] = {}
    self.prefix_cache: dict[tuple[str, int], list[RuntimeLexiconEntry]] = {}
    self.entry_set_cache: dict[str, set[str]] = {}

  def _to_shard_prefix(self, prefix: str) -> str:
    return ''.join(list(prefix[:SHARD_PREFIX_LENGTH])) or '_'

  def _load_shard(self, prefix: str) -> list[RuntimeLexiconEntry]:
    if prefix not in self.shard_cache:
      shard_meta = self.shards.get(prefix)
      if not shard_meta:
        self.shard_cache[prefix] = []
        self.entry_set_cache[prefix] = set()
      else:
        with (self.data_root / shard_meta['file']).open('r', encoding='utf8') as handle:
          payload = json.load(handle)
        entries = [
          RuntimeLexiconEntry(
            itrans=str(entry['itrans']),
            devanagari=str(entry['devanagari']),
            count=int(entry['count']),
          )
          for entry in payload['entries']
        ]
        self.shard_cache[prefix] = entries
        self.entry_set_cache[prefix] = {entry.itrans for entry in entries}

    return self.shard_cache[prefix]

  def has_entry(self, itrans: str) -> bool:
    normalized = normalize_for_lexical_lookup(itrans)
    if len(normalized) < MIN_LOOKUP_PREFIX_LENGTH:
      return False
    shard_prefix = self._to_shard_prefix(normalized)
    self._load_shard(shard_prefix)
    return normalized in self.entry_set_cache[shard_prefix]

  def get_candidates(self, prefix: str, limit: int) -> list[RuntimeLexiconEntry]:
    normalized = normalize_for_lexical_lookup(prefix)
    if len(normalized) < MIN_LOOKUP_PREFIX_LENGTH:
      return []

    shard_prefix = self._to_shard_prefix(normalized)
    cache_key = (normalized, limit)
    if cache_key not in self.prefix_cache:
      entries = self._load_shard(shard_prefix)
      matches = [entry for entry in entries if entry.itrans.startswith(normalized)]
      matches.sort(key=lambda entry: (-entry.count, len(entry.itrans), entry.itrans))
      self.prefix_cache[cache_key] = matches[:limit]
    return self.prefix_cache[cache_key]

  def iter_all_entries(self):
    for shard_prefix in self.shards:
      for entry in self._load_shard(shard_prefix):
        yield entry


def load_json(path: Path) -> Any:
  with path.open('r', encoding='utf8') as handle:
    return json.load(handle)


def load_prepared_dataset(cache_dir: Path, dataset_id: str) -> dict[str, Any]:
  payload = load_json(cache_dir / f'{dataset_id}.prepared.json')
  return payload['prepared']


def sample_prepared_dataset(prepared: dict[str, Any], max_queries: int | None) -> dict[str, Any]:
  if not max_queries or max_queries <= 0 or max_queries >= len(prepared['queries']):
    return prepared

  queries = sorted(
    prepared['queries'],
    key=lambda query: (-int(query['weight']), str(query['target'])),
  )[:max_queries]
  sampled = dict(prepared)
  sampled['queries'] = queries
  sampled['eligibleWords'] = sum(int(query['weight']) for query in queries)
  return sampled


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


def fingerprint(path: Path) -> dict[str, Any]:
  stats = path.stat()
  return {
    'path': str(path.resolve()),
    'size': stats.st_size,
    'mtimeMs': int(stats.st_mtime * 1000),
  }


def fingerprints_match(left: dict[str, Any], right: dict[str, Any]) -> bool:
  return left == right


def load_or_train_model(profile: ModelProfile, data_root: Path, cache_dir: Path, skip_cache: bool) -> CharNGramModel:
  if profile.continuation_weight <= 0:
    return CharNGramModel(order=profile.order, alpha=profile.alpha)

  manifest_path = data_root / 'runtime-lexicon-shards-manifest.json'
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
  lexicon = DiskRuntimeLexicon(data_root)
  for entry in lexicon.iter_all_entries():
    model.train(entry.itrans, max(entry.count, 1))

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
  prefix: str,
  model: CharNGramModel,
  profile: ModelProfile,
  suggestion_limit: int,
) -> list[RuntimeLexiconEntry]:
  if profile.continuation_weight <= 0:
    ranked = sorted(candidates, key=lambda entry: (-entry.count, len(entry.itrans), entry.itrans))
    return ranked[:suggestion_limit]

  normalized_prefix = normalize_for_lexical_lookup(prefix)

  def score(entry: RuntimeLexiconEntry) -> tuple[float, int, int, str]:
    count_score = math.log(max(entry.count, 1))
    continuation_score = model.score_continuation(entry.itrans, normalized_prefix)
    blended = profile.count_weight * count_score + profile.continuation_weight * continuation_score
    return (blended, entry.count, -len(entry.itrans), entry.itrans)

  ranked = sorted(candidates, key=score, reverse=True)
  return ranked[:suggestion_limit]


def evaluate_prepared_dataset(
  prepared: dict[str, Any],
  lexicon: DiskRuntimeLexicon,
  model: CharNGramModel,
  profile: ModelProfile,
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
      suggestions = rank_candidates(candidates, prefix, model, profile, DEFAULT_SUGGESTION_LIMIT)
      increment_metric(all_prefix_metrics, suggestions, target, weight)
      if prefix_length == final_prefix_length:
        increment_metric(final_prefix_metrics, suggestions, target, weight)

      hit = any(entry.itrans == target for entry in suggestions[:DEFAULT_SUGGESTION_LIMIT])
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


def compare_results(left: dict[str, Any], right: dict[str, Any]) -> int:
  left_final = left['prefixMetrics']['finalPrefix']
  right_final = right['prefixMetrics']['finalPrefix']

  for key in ('top5Rate', 'top3Rate', 'top1Rate'):
    if right_final[key] != left_final[key]:
      return 1 if right_final[key] > left_final[key] else -1

  return -1 if left['profileId'] < right['profileId'] else 1 if left['profileId'] > right['profileId'] else 0


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


def load_reference_metrics(experiments_dir: Path) -> dict[str, Any] | None:
  leaderboard_path = experiments_dir / 'leaderboard.json'
  if not leaderboard_path.exists():
    return None
  try:
    return load_json(leaderboard_path)
  except Exception:
    return None


def parse_args() -> argparse.Namespace:
  default_output = Path(__file__).resolve().parents[2] / 'generated' / 'autocomplete' / 'experiments' / 'probabilistic-leaderboard.json'
  default_cache_dir = Path(__file__).resolve().parents[2] / 'generated' / 'autocomplete' / 'experiments' / 'cache'
  default_data_root = Path(__file__).resolve().parents[2] / 'generated' / 'autocomplete'

  parser = argparse.ArgumentParser(description='Run probabilistic autocomplete experiments over prepared held-out datasets.')
  parser.add_argument('--profiles', default=','.join(MODEL_PROFILES.keys()))
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
  profiles = [MODEL_PROFILES[profile_id] for profile_id in profile_ids]
  data_root = Path(args.data_root).resolve()
  cache_dir = Path(args.cache_dir).resolve()
  output_path = Path(args.output).resolve()
  experiments_dir = output_path.parent

  tuning_prepared = load_prepared_dataset(cache_dir, args.tuning_dataset)
  holdout_prepared = load_prepared_dataset(cache_dir, args.holdout_dataset)
  tuning_prepared = sample_prepared_dataset(tuning_prepared, args.sample_limit)
  holdout_prepared = sample_prepared_dataset(holdout_prepared, args.sample_limit)

  lexicon = DiskRuntimeLexicon(data_root)
  tuning_results: list[dict[str, Any]] = []

  for profile in profiles:
    model = load_or_train_model(profile, data_root, cache_dir, args.skip_cache)
    tuning_results.append(evaluate_prepared_dataset(tuning_prepared, lexicon, model, profile))

  tuning_results = sort_results(tuning_results)
  winner = tuning_results[0]
  winner_profile = MODEL_PROFILES[winner['profileId']]
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
        'label': MODEL_PROFILES[result['profileId']].label,
        'description': MODEL_PROFILES[result['profileId']].description,
        'finalPrefix': result['prefixMetrics']['finalPrefix'],
        'allPrefixes': result['prefixMetrics']['allPrefixes'],
        'missingWords': result['missingWords'],
        'sampleMisses': result['sampleMisses'],
      }
      for index, result in enumerate(tuning_results)
    ],
    'holdoutCheck': {
      'profileId': holdout_result['profileId'],
      'label': MODEL_PROFILES[holdout_result['profileId']].label,
      'description': MODEL_PROFILES[holdout_result['profileId']].description,
      'finalPrefix': holdout_result['prefixMetrics']['finalPrefix'],
      'allPrefixes': holdout_result['prefixMetrics']['allPrefixes'],
      'missingWords': holdout_result['missingWords'],
      'sampleMisses': holdout_result['sampleMisses'],
    },
    'heuristicReference': load_reference_metrics(experiments_dir),
  }

  output_path.parent.mkdir(parents=True, exist_ok=True)
  output_path.write_text(json.dumps(payload, indent=2) + '\n', encoding='utf8')
  print(json.dumps(payload, indent=2))
  return 0


if __name__ == '__main__':
  raise SystemExit(main())
