// Quiz-Aufbau und Bewertung. Reine Funktionen, mit Jest getestet.

export const QUIZ_LENGTH = 20;
export const MIN_POOL_SIZE = 10;

/** Fisher-Yates: unverzerrtes Mischen, gibt eine neue Liste zurück. */
export const shuffle = (array, rng = Math.random) => {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/** Wörter eines Levels ("Alle" = alle). Zu kleiner Pool → alle Wörter. Duplikate entfernt. */
export const getWordPool = (words, level) => {
  const filtered = !level || level === "Alle" ? words : words.filter((w) => w.l === level);
  const pool = filtered.length >= MIN_POOL_SIZE ? filtered : words;
  const seen = new Set();
  return pool.filter((w) => {
    const key = `${w.a}|${w.q}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/** Gemischtes Quiz mit höchstens `length` verschiedenen Wörtern. */
export const buildQuiz = (words, level, { length = QUIZ_LENGTH, rng = Math.random } = {}) =>
  shuffle(getWordPool(words, level), rng).slice(0, length);

/** Übersetzungs-Schlüssel für die Ergebnismeldung, prozentbasiert (bei 20 Fragen: 18/15/10/5). */
export const getRewardKey = (score, total) => {
  if (!total) return "rewardDefault";
  if (score >= total) return "rewardPerfect";
  const pct = (score / total) * 100;
  if (pct >= 90) return "reward18";
  if (pct >= 75) return "reward15";
  if (pct >= 50) return "reward10";
  if (pct >= 25) return "reward5";
  return "rewardDefault";
};
