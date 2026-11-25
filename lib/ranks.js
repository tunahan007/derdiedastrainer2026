// Rang-System: eine Quelle für index.js und statistics.js.
// Reine Logik ohne React/SQLite, damit sie mit Jest getestet werden kann.

export const RANKS = [
  { minPerfect: 0, name: "Student", color: "#94a3b8", emoji: "📚" },
  { minPerfect: 1, name: "Scholar", color: "#60a5fa", emoji: "🎓" },
  { minPerfect: 3, name: "Bachelor", color: "#8b5cf6", emoji: "🎓⭐" },
  { minPerfect: 5, name: "Master", color: "#10b981", emoji: "🎓⭐⭐" },
  { minPerfect: 10, name: "Doctor", color: "#f59e0b", emoji: "🧪👨‍🔬" },
  { minPerfect: 20, name: "Professor", color: "#ef4444", emoji: "🦉👑" },
  { minPerfect: 35, name: "Dean", color: "#ec4899", emoji: "🏛️👑" },
  { minPerfect: 50, name: "Rector", color: "#8b5cf6", emoji: "🎖️🦉" },
  { minPerfect: 75, name: "Academy Fellow", color: "#f97316", emoji: "🌟🎓" },
  { minPerfect: 100, name: "Grandmaster", color: "#6366f1", emoji: "💎👑" },
];

/**
 * Liefert aktuellen Rang, nächsten Rang und Fortschritt für eine Anzahl Perfect Scores.
 * Beim höchsten Rang ist next === current, progressPercent = 100, perfectsUntilNext = 0.
 */
export const getRankInfo = (perfectScores) => {
  const p = Math.max(0, Number(perfectScores) || 0);
  let idx = 0;
  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (p >= RANKS[i].minPerfect) {
      idx = i;
      break;
    }
  }
  const current = RANKS[idx];
  const next = RANKS[idx + 1] || current;
  const isMax = next === current;
  const needed = next.minPerfect - current.minPerfect;
  return {
    current,
    next,
    isMax,
    progressPercent: isMax || needed <= 0 ? 100 : ((p - current.minPerfect) / needed) * 100,
    perfectsUntilNext: isMax ? 0 : next.minPerfect - p,
  };
};

/** true, wenn von prev auf current ein Aufstieg stattgefunden hat. */
export const isRankUp = (prev, current) =>
  !!prev && !!current && current.minPerfect > prev.minPerfect;
