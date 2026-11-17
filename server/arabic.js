// Arabic answer matching: ignore diacritics, hamza forms, ة/ه, ى/ي, the article "ال" and spaces.
export function norm(s) {
  return String(s ?? "")
    .replace(/[ً-ْـ]/g, "") // tashkeel + tatweel
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .trim()
    .split(/\s+/)
    .map((w) => (w.startsWith("ال") && w.length > 3 ? w.slice(2) : w))
    .join("");
}

/** First letter for "starts with" checks (after dropping ال). */
export const firstLetter = (s) => norm(s).charAt(0);
