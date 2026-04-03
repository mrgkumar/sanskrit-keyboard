const TAMIL_CONSONANTS = new Map<string, string>([
  ['க', 'k'],
  ['ங', 'ng'],
  ['ச', 'c'],
  ['ஜ', 'j'],
  ['ஞ', 'ny'],
  ['ட', 't'],
  ['ண', 'n'],
  ['த', 't'],
  ['ந', 'n'],
  ['ப', 'p'],
  ['ம', 'm'],
  ['ய', 'y'],
  ['ர', 'r'],
  ['ல', 'l'],
  ['வ', 'v'],
  ['ழ', 'zh'],
  ['ள', 'l'],
  ['ற', 'r'],
  ['ன', 'n'],
  ['ஶ', 'sh'],
  ['ஷ', 'sh'],
  ['ஸ', 's'],
  ['ஹ', 'h'],
]);

const TAMIL_DEPENDENT_VOWELS = new Map<string, string>([
  ['ா', 'aa'],
  ['ி', 'i'],
  ['ீ', 'ii'],
  ['ு', 'u'],
  ['ூ', 'uu'],
  ['ெ', 'e'],
  ['ே', 'ee'],
  ['ை', 'ai'],
  ['ொ', 'o'],
  ['ோ', 'oo'],
  ['ௌ', 'au'],
]);

const TAMIL_INDEPENDENT_VOWELS = new Map<string, string>([
  ['அ', 'a'],
  ['ஆ', 'aa'],
  ['இ', 'i'],
  ['ஈ', 'ii'],
  ['உ', 'u'],
  ['ஊ', 'uu'],
  ['எ', 'e'],
  ['ஏ', 'ee'],
  ['ஐ', 'ai'],
  ['ஒ', 'o'],
  ['ஓ', 'oo'],
  ['ஔ', 'au'],
  ['஋', 'ru'],
  ['஌', 'lu'],
]);

const removeNoise = (value: string) =>
  value
    .normalize('NFC')
    .replace(/[\s\u200c\u200d।॥:;,.'"!?\-—()\[\]{}\/]/gu, '')
    .replace(/[¹²³⁴]/gu, '')
    .replace(/[॒᳜᳝᳞᳟॑᳚᳛᳡᳢᳣᳤᳥᳦᳧᳨ᳩᳪᳫᳬ᳭ᳮᳯᳰᳱ]/gu, '');

export const romanizeTamilForVignanamAlignment = (value: string) => {
  const chars = Array.from(removeNoise(value));
  let output = '';

  for (let index = 0; index < chars.length; index += 1) {
    const current = chars[index];

    if (current === 'ஂ') {
      output += 'm';
      continue;
    }

    if (current === 'ஃ') {
      output += 'h';
      continue;
    }

    if (TAMIL_INDEPENDENT_VOWELS.has(current)) {
      output += TAMIL_INDEPENDENT_VOWELS.get(current);
      continue;
    }

    if (TAMIL_CONSONANTS.has(current)) {
      const base = TAMIL_CONSONANTS.get(current) ?? '';
      const next = chars[index + 1] ?? '';
      const nextNext = chars[index + 2] ?? '';

      if (next === '்') {
        output += base;
        continue;
      }

      if (TAMIL_DEPENDENT_VOWELS.has(next)) {
        output += base + TAMIL_DEPENDENT_VOWELS.get(next);
        index += 1;
        continue;
      }

      if (next === 'ா' && nextNext === '²') {
        output += base + 'aa';
        index += 2;
        continue;
      }

      output += base + 'a';
      continue;
    }
  }

  return output;
};

export const normalizeVignanamRomanComparisonKey = (value: string) =>
  value
    .normalize('NFC')
    .toLowerCase()
    .replace(/r\^i/g, 'ru')
    .replace(/r\^I/g, 'ru')
    .replace(/l\^i/g, 'lu')
    .replace(/l\^I/g, 'lu')
    .replace(/kh/g, 'k')
    .replace(/gh/g, 'g')
    .replace(/ch/g, 'c')
    .replace(/jh/g, 'j')
    .replace(/th/g, 't')
    .replace(/dh/g, 'd')
    .replace(/ph/g, 'p')
    .replace(/bh/g, 'b')
    .replace(/sh/g, 'sh')
    .replace(/~n/g, 'ny')
    .replace(/~N/g, 'ng')
    .replace(/[^a-z]+/g, '');

export const getVignanamAlignmentScore = (expectedRoman: string, actualTamil: string) => {
  const expected = normalizeVignanamRomanComparisonKey(expectedRoman);
  const actual = normalizeVignanamRomanComparisonKey(romanizeTamilForVignanamAlignment(actualTamil));
  const maxLength = Math.max(expected.length, actual.length, 1);

  return {
    expected,
    actual,
    score: 1 - levenshteinDistance(expected, actual) / maxLength,
  };
};

const levenshteinDistance = (left: string, right: string) => {
  const rows = left.length + 1;
  const cols = right.length + 1;
  const matrix: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0));

  for (let row = 0; row < rows; row += 1) {
    matrix[row]![0] = row;
  }

  for (let col = 0; col < cols; col += 1) {
    matrix[0]![col] = col;
  }

  for (let row = 1; row < rows; row += 1) {
    for (let col = 1; col < cols; col += 1) {
      const substitutionCost = left[row - 1] === right[col - 1] ? 0 : 1;

      matrix[row]![col] = Math.min(
        matrix[row - 1]![col] + 1,
        matrix[row]![col - 1] + 1,
        matrix[row - 1]![col - 1] + substitutionCost,
      );
    }
  }

  return matrix[rows - 1]![cols - 1]!;
};
