export const TAMIL_REVERSE_ATOMIC_AKSHARA_FIXTURES = [
  ['க', 'ka'],
  ['க²', 'kha'],
  ['க³', 'ga'],
  ['க⁴', 'gha'],
  ['ச', 'cha'],
  ['ச²', 'Cha'],
  ['ஜ', 'ja'],
  ['ஜ²', 'jha'],
  ['ட', 'Ta'],
  ['ட²', 'Tha'],
  ['ட³', 'Da'],
  ['ட⁴', 'Dha'],
  ['த', 'ta'],
  ['த²', 'tha'],
  ['த³', 'da'],
  ['த⁴', 'dha'],
  ['ப', 'pa'],
  ['ப²', 'pha'],
  ['ப³', 'ba'],
  ['ப⁴', 'bha'],
] as const;

export const TAMIL_REVERSE_DEAD_CONSONANT_FIXTURES = [
  ['க்', 'k'],
  ['க்²', 'kh'],
  ['ஜ்', 'j'],
  ['த்⁴', 'dh'],
  ['ப்³', 'b'],
  ['ஹ்', 'h'],
  ['க்ஷ்', 'kSh'],
] as const;

export const TAMIL_REVERSE_DIRECT_GRANTHA_FIXTURES = [
  ['ஶ', 'sha'],
  ['ஷ', 'Sha'],
  ['ஸ', 'sa'],
  ['ஹ', 'ha'],
  ['க்ஷ', 'kSha'],
] as const;

export const TAMIL_REVERSE_VOCALIC_FIXTURES = [
  ['ரு¹', 'R^i'],
  ['ரூ¹', 'R^I'],
  ['லு¹', 'L^i'],
  ['லூ¹', 'L^I'],
  ['ரு<R>', 'R^i'],
  ['ரூ<R>', 'R^I'],
  ['லு<L>', 'L^i'],
  ['லூ<L>', 'L^I'],
] as const;

export const TAMIL_REVERSE_SPECIAL_MARK_FIXTURES = [
  ['ம்', 'M'],
  [':', ':'],
] as const;

export const TAMIL_REVERSE_CLUSTER_FIXTURES = [
  ['கீ³தா', 'gItA'],
  ['த⁴ர்ம', 'dharma'],
  ['ப⁴க்தி', 'bhakti'],
  ['லக்ஷ்மீ', 'lakShmI'],
  ['ஜ்ஞாந', 'j~nAna'],
  ['அம்ரு¹த', 'amR^ita'],
  ['க்ரு¹த', 'kR^ita'],
  ['க்லு¹ப்த', 'kL^ipta'],
  ['ஸம்ஸ்க்ரு¹த', 'saMskR^ita'],
  ['கு³ரு:', 'guru:'],
  ['ஶ்ரீ', 'shrI'],
] as const;

export const TAMIL_REVERSE_ASCII_NORMALIZATION_FIXTURES = [
  { rich: 'கீ³தா', ascii: 'கீ^3தா', tokens: ['க³', 'ீ', 'த', 'ா'] },
  { rich: 'க்²', ascii: 'க்^2', tokens: ['க²', '்'] },
  { rich: 'ரு¹', ascii: 'ரு<R>', tokens: ['ரு¹'] },
  { rich: 'லூ¹', ascii: 'லூ<L>', tokens: ['லூ¹'] },
  { rich: 'க்ரு¹த', ascii: 'க்ரு<R>த', tokens: ['க', '்ரு¹', 'த'] },
] as const;

export const TAMIL_REVERSE_LONGEST_MATCH_TOKEN_FIXTURES = [
  { source: 'க்ஷ', tokens: ['க்ஷ'] },
  { source: 'க்ஷ்', tokens: ['க்ஷ', '்'] },
  { source: 'ரு¹', tokens: ['ரு¹'] },
  { source: 'க²', tokens: ['க²'] },
  { source: 'த⁴ர்ம', tokens: ['த⁴', 'ர', '்', 'ம'] },
  { source: 'க்ரு¹த', tokens: ['க', '்ரு¹', 'த'] },
] as const;

export const TAMIL_REVERSE_PLAIN_TAMIL_REJECTION_FIXTURES = [
  'குரு',
  'தர்ம',
  'பகவதே',
  'கவி',
  'சென்று வருகிறேன்',
  'மழை பெய்து கொண்டிருக்கிறது',
  'வாழ்த்துக்கள்',
] as const;

export const TAMIL_REVERSE_BARAHA_TAMIL_REJECTION_FIXTURES = [
  'ஸ்ரீ^^',
  'கRs',
  'ஹ~~',
  'ஸ~#',
  'லூ~$',
] as const;

export const TAMIL_REVERSE_MALFORMED_PRECISION_FIXTURES = [
  'க^',
  'க^1',
  'க¹',
  'ரு<R',
  'லு<L',
  '<R>',
] as const;

export const TAMIL_REVERSE_MIXED_AMBIGUOUS_FIXTURES = [
  'கு³ரு ரு',
  'கு^3ரு ரு',
  'கீ³தா gItA',
  'gItA கீ³தா',
  'கீ³தா संस्कृतम्',
] as const;
