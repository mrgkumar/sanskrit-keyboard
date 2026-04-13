export const BARAHA_TAMIL_SOURCE_URLS = {
  phonetic: 'https://baraha.com/help/Keyboards/tam-phonetic.htm',
  examples: 'https://baraha.com/help/Keyboards/tam-examples.htm',
} as const;

export const BARAHA_TAMIL_CONTROL_TOKENS = ['Rs', '^', '^^', '~~', '~#', '~$'] as const;

export const BARAHA_TAMIL_COLLAPSED_FAMILIES = {
  velars: ['k', 'K', 'kh', 'g', 'G', 'gh'],
  palatals: ['c', 'ch', 'C', 'Ch'],
  retroflexes: ['T', 'Th', 'D', 'Dh'],
  dentals: ['t', 'th', 'd', 'dh'],
  labials: ['p', 'P', 'ph', 'b', 'B', 'bh'],
} as const;

export const BARAHA_TAMIL_DISTINCT_LETTER_FIXTURES = {
  jFamily: ['j', 'jh', 'J'],
  shaFamily: ['S', 'sh'],
  Sha: ['Sh'],
  sa: ['s'],
  haFamily: ['h', '~h'],
  kSha: ['kSha'],
  SrI: ['SrI'],
} as const;

export const BARAHA_TAMIL_PHONETIC_PAGE_FIXTURES = {
  vowels: [
    ['அ', ['a']],
    ['ஆ', ['A', 'aa']],
    ['இ', ['i']],
    ['ஈ', ['I', 'ee']],
    ['உ', ['u']],
    ['ஊ', ['U', 'oo']],
    ['எ', ['e']],
    ['ஏ', ['E']],
    ['ஐ', ['ai']],
    ['ஒ', ['o']],
    ['ஓ', ['O']],
    ['ஔ', ['au', 'ou']],
    [':', ['H']],
  ],
  consonants: [
    ['க்', ['k', 'K', 'kh', 'g', 'G', 'gh']],
    ['ங்', ['~g']],
    ['ச்', ['c', 'ch', 'C', 'Ch']],
    ['ஞ்', ['~j']],
    ['ட்', ['T', 'Th', 'D', 'Dh']],
    ['ண்', ['N']],
    ['த்', ['t', 'th', 'd', 'dh']],
    ['ந்', ['~n']],
    ['ப்', ['p', 'P', 'ph', 'b', 'B', 'bh']],
    ['ம்', ['m', 'M']],
    ['ய்', ['y', 'Y']],
    ['ர்', ['r']],
    ['ல்', ['l']],
    ['வ்', ['v', 'w']],
    ['ழ்', ['zh', 'Lx']],
    ['ள்', ['L']],
    ['ற்', ['R', 'rx']],
    ['ன்', ['n']],
    ['ஜ்', ['j', 'jh', 'J']],
    ['ஶ்', ['S', 'sh']],
    ['ஷ்', ['Sh']],
    ['ஸ்', ['s']],
    ['ஹ்', ['h', '~h']],
    ['க்ஷ', ['kSha']],
    ['ஶ்ரீ', ['SrI']],
  ],
} as const;

export const BARAHA_TAMIL_EXAMPLE_FIXTURES = [
  { tamil: 'வணக்கம்', roman: 'vaNakkam' },
  { tamil: '(காலை) வணக்கம்', roman: '(kAlai) vaNakkam' },
  { tamil: 'சென்று வருகிறேன்', roman: 'cenRu varukiREn' },
  { tamil: 'நன்றி', roman: '~nanRi' },
  { tamil: 'நீ எப்படி இருக்கிறாய்', roman: '~nI eppaDi irukkiRAy' },
  { tamil: 'நான் நல்லபடியாக இருக்கிறேன். நன்றி', roman: '~nAn ~nallapaDiyAka irukkiREn. ~nanRi' },
  { tamil: 'மன்னியுங்கள்', roman: 'manniyu~gkaL' },
  { tamil: 'குளிர்ச்சியாக உள்ளது', roman: 'kuLircciyAka uLLatu' },
  { tamil: 'அது சூடாக உள்ளது', roman: 'atu cUDAka uLLatu' },
  { tamil: 'மழை பெய்து கொண்டிருக்கிறது', roman: 'mazhai peytu koNTirukkiRatu' },
  { tamil: 'என்னுடைய பெயர் முருகன்', roman: 'ennuDaiya peyar murukan' },
  { tamil: 'நீ எங்கே இருக்கிறாய்?', roman: '~nI e~gkE irukkiRAy?' },
  { tamil: 'அந்த கட்டிடம் உயரமானது', roman: 'a~nta kaTTiTam uyaramAnatu' },
  { tamil: 'நான் பறவைகளை நேசிக்கிறேன்', roman: '~nAn paRavaikaLai ~nEcikkiREn' },
  { tamil: 'பேருந்து நிலையம் இங்கிருந்து எவ்வளவு தொலைவில் உள்ளது?', roman: 'pEru~ntu ~nilaiyam i~gkiru~ntu evvaLavu tolaivil uLLatu?' },
  { tamil: 'அவர் வந்தவுடன் என்னை திரும்ப அழைக்குமாறு தயவு செய்து சொல்லவும்', roman: 'avar va~ntavuDan ennai tirumpa azhaikkumARu tayavu ceytu collavum' },
  { tamil: 'உணவு நன்றாக உள்ளது', roman: 'uNavu ~nanRAka uLLatu' },
  { tamil: 'வாழ்த்துக்கள்', roman: 'vAzhttukkaL' },
  { tamil: 'இனிய புத்தாண்டு வாழ்துகள்', roman: 'iniya puttANTu vAzhtukaL' },
  { tamil: 'திருமண வாழ்த்துக்கள்', roman: 'tirumaNa vAzhttukkaL' },
] as const;
