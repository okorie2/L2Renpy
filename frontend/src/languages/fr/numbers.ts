/**
 * Whole numbers written out in French and in English, for saying the learner's age
 * ("J'ai vingt-neuf ans."), as in the Ren'Py prototype. Covers 0 to 199.
 */
const FRENCH_UNDER_20 = [
  "zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix",
  "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf"
];
const FRENCH_TENS: Record<number, string> = { 20: "vingt", 30: "trente", 40: "quarante", 50: "cinquante", 60: "soixante" };
const ENGLISH_UNDER_20 = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"
];
const ENGLISH_TENS: Record<number, string> = { 20: "twenty", 30: "thirty", 40: "forty", 50: "fifty", 60: "sixty", 70: "seventy", 80: "eighty", 90: "ninety" };

export function frenchNumber(number: number): string {
  if (number < 20) return FRENCH_UNDER_20[number];
  if (number < 70) {
    const tens = Math.floor(number / 10) * 10;
    const rest = number % 10;
    if (rest === 0) return FRENCH_TENS[tens];
    return rest === 1 ? `${FRENCH_TENS[tens]} et un` : `${FRENCH_TENS[tens]}-${FRENCH_UNDER_20[rest]}`;
  }
  if (number < 80) {
    const rest = number - 60;
    return rest === 11 ? "soixante et onze" : `soixante-${frenchNumber(rest)}`;
  }
  if (number < 100) {
    const rest = number - 80;
    return rest === 0 ? "quatre-vingts" : `quatre-vingt-${frenchNumber(rest)}`;
  }
  return number === 100 ? "cent" : `cent ${frenchNumber(number - 100)}`;
}

export function englishNumber(number: number): string {
  if (number < 20) return ENGLISH_UNDER_20[number];
  if (number < 100) {
    const tens = Math.floor(number / 10) * 10;
    const rest = number % 10;
    return rest === 0 ? ENGLISH_TENS[tens] : `${ENGLISH_TENS[tens]}-${ENGLISH_UNDER_20[rest]}`;
  }
  return number === 100 ? "one hundred" : `one hundred and ${englishNumber(number - 100)}`;
}
