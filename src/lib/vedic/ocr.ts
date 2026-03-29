export interface OCRAmbiguity {
  index: number;
  length: number;
  original: string;
  suggestion: string;
  rationale: string;
}

// Common patterns where OCR typically fails in Sanskrit/Vedic
const VEDIC_CONFUSION_MATRIX: Record<string, string[]> = {
  'ब': ['व'],
  'व': ['ब'],
  'ध': ['घ'],
  'घ': ['ध'],
  'श': ['स'],
  'स': ['श'],
};

export const analyzeOCRText = (text: string): OCRAmbiguity[] => {
  const ambiguities: OCRAmbiguity[] = [];
  
  // Basic pattern matching for common confusions
  Object.keys(VEDIC_CONFUSION_MATRIX).forEach(char => {
    let index = text.indexOf(char);
    while (index !== -1) {
      ambiguities.push({
        index,
        length: 1,
        original: char,
        suggestion: VEDIC_CONFUSION_MATRIX[char][0],
        rationale: `Common OCR confusion between ${char} and ${VEDIC_CONFUSION_MATRIX[char][0]}`
      });
      index = text.indexOf(char, index + 1);
    }
  });

  // Flag potential missing swaras (Vedic gap)
  // In a real app, this would use a more complex linguistic model
  
  return ambiguities.sort((a, b) => a.index - b.index);
};
