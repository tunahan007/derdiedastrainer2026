// Word data helpers — used by trainer, wordlooker, sentences screens
import { TRANSLATIONS } from "./translations";
import { SENTENCES } from "./sentences_data";

// Map compact fields to readable names for all screens
export const getWord = (w) => w?.q || "";
export const getArticle = (w) => w?.a || "";
export const getEmoji = (w) => w?.emoji || "";
export const getLevel = (w) => w?.l || "";
export const getCategory = (w) => w?.c || "";
export const getImage = (w) => w?.img || null;

// Get translation for current language
export const getTranslation = (w, lang) => {
  if (!w?.q) return "";
  const tr = TRANSLATIONS[w.q];
  return tr?.[lang] || tr?.["en"] || w.en || "";
};

// Get sentences for a word
export const getSentences = (w) => {
  if (!w?.q) return null;
  const s = SENTENCES[w.q];
  if (!s) return null;
  return { nom: s.n, akk: s.a, dat: s.d, gen: s.g };
};

// Check if word has sentences
export const hasSentences = (w) => !!SENTENCES[w?.q];

// Check if word has local image
export const hasImage = (w) => !!w?.img;

// Build quiz list filtered by level
export const buildQuizList = (words, level, shuffle = true) => {
  const filtered = !level || level === "Alle"
    ? words
    : words.filter(w => w.l === level);
  const pool = filtered.length >= 10 ? filtered : words;
  if (!shuffle) return pool;
  return [...pool].sort(() => Math.random() - 0.5);
};
