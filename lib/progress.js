// Fortschritts-Logik für das Quiz-Ende: Tages-Streak, Achievements, Zeitstatistik.
// Reine Funktionen ohne React/SQLite, damit sie mit Jest getestet werden können.

export const ACHIEVEMENT_REQUIREMENTS = [
  { id: "achievementFirstStar", requirement: 1 },
  { id: "achievementGoldenStudent", requirement: 5 },
  { id: "achievementDoctoralAward", requirement: 10 },
  { id: "achievementProfessorBadge", requirement: 20 },
];

const pad = (n) => String(n).padStart(2, "0");

/** Kalendertag in der LOKALEN Zeitzone des Geräts, z. B. "2026-11-25". */
export const toLocalDayKey = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Differenz in ganzen Kalendertagen zwischen zwei Day-Keys (unabhängig von Sommerzeit). */
export const daysBetween = (fromKey, toKey) => {
  const [y1, m1, d1] = fromKey.split("-").map(Number);
  const [y2, m2, d2] = toKey.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
};

/**
 * Neuer Tages-Streak nach einem abgeschlossenen Quiz.
 * Gleicher Tag → unverändert (mind. 1), nächster Tag → +1, Lücke → 1.
 */
export const computeDayStreak = (
  { lastPlayedDate, consecutiveDays = 0, longestStreak = 0 } = {},
  now = new Date(),
) => {
  const today = toLocalDayKey(now);
  const last = lastPlayedDate ? toLocalDayKey(lastPlayedDate) : null;
  let days = consecutiveDays || 0;

  if (!last) {
    days = 1;
  } else {
    const diff = daysBetween(last, today);
    if (diff === 0) days = Math.max(days, 1);
    else if (diff === 1) days = days + 1;
    else days = 1; // Lücke, oder Gerätezeit wurde zurückgestellt
  }
  return { consecutiveDays: days, longestStreak: Math.max(longestStreak || 0, days) };
};

/** IDs der Achievements, die mit dieser Anzahl Perfect Scores NEU freigeschaltet werden. */
export const getNewlyUnlockedAchievements = (perfectScores, achRow = {}) =>
  ACHIEVEMENT_REQUIREMENTS.filter(
    (a) => perfectScores >= a.requirement && !achRow[a.id],
  ).map((a) => a.id);

/** Durchschnitt, schnellste und langsamste Antwortzeit (Sekunden). */
export const getQuestionTimeStats = (times = []) => {
  if (!times.length) return { avg: 0, fastest: 0, slowest: 0 };
  return {
    avg: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
    fastest: Math.min(...times),
    slowest: Math.max(...times),
  };
};
