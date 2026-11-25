import {
  computeDayStreak,
  daysBetween,
  getNewlyUnlockedAchievements,
  getQuestionTimeStats,
  toLocalDayKey,
} from "../lib/progress";

// Lokale Zeit (Monat ist 0-basiert)
const at = (y, m, d, h = 12, min = 0) => new Date(y, m - 1, d, h, min);

describe("daysBetween", () => {
  test("über Monats- und Jahresgrenzen", () => {
    expect(daysBetween("2026-11-30", "2026-12-01")).toBe(1);
    expect(daysBetween("2026-12-31", "2027-01-01")).toBe(1);
    expect(daysBetween("2028-02-28", "2028-03-01")).toBe(2); // Schaltjahr
  });
  test("über Zeitumstellung (Ende Oktober)", () => {
    expect(daysBetween("2026-10-24", "2026-10-25")).toBe(1);
    expect(daysBetween("2026-10-25", "2026-10-26")).toBe(1);
  });
});

describe("computeDayStreak", () => {
  test("erstes Quiz überhaupt → 1", () => {
    expect(computeDayStreak({}, at(2026, 11, 25))).toEqual({
      consecutiveDays: 1,
      longestStreak: 1,
    });
  });

  test("gleicher Tag → unverändert", () => {
    const r = computeDayStreak(
      { lastPlayedDate: at(2026, 11, 25, 8).toISOString(), consecutiveDays: 4, longestStreak: 6 },
      at(2026, 11, 25, 21),
    );
    expect(r).toEqual({ consecutiveDays: 4, longestStreak: 6 });
  });

  test("nächster Tag → +1, Rekord steigt mit", () => {
    const r = computeDayStreak(
      { lastPlayedDate: at(2026, 11, 24).toISOString(), consecutiveDays: 6, longestStreak: 6 },
      at(2026, 11, 25),
    );
    expect(r).toEqual({ consecutiveDays: 7, longestStreak: 7 });
  });

  test("Lücke → zurück auf 1, Rekord bleibt", () => {
    const r = computeDayStreak(
      { lastPlayedDate: at(2026, 11, 20).toISOString(), consecutiveDays: 9, longestStreak: 12 },
      at(2026, 11, 25),
    );
    expect(r).toEqual({ consecutiveDays: 1, longestStreak: 12 });
  });

  test("kurz nach Mitternacht zählt als neuer Tag (lokale Zeit, nicht UTC)", () => {
    const r = computeDayStreak(
      { lastPlayedDate: at(2026, 11, 24, 22).toISOString(), consecutiveDays: 2, longestStreak: 2 },
      at(2026, 11, 25, 0, 30),
    );
    expect(r.consecutiveDays).toBe(3);
  });

  test("gleicher Tag mit kaputtem Zähler 0 → mindestens 1", () => {
    const r = computeDayStreak(
      { lastPlayedDate: at(2026, 11, 25, 8).toISOString(), consecutiveDays: 0 },
      at(2026, 11, 25, 9),
    );
    expect(r.consecutiveDays).toBe(1);
  });

  test("Gerätezeit zurückgestellt → 1 statt Absturz oder negativer Wert", () => {
    const r = computeDayStreak(
      { lastPlayedDate: at(2026, 11, 25).toISOString(), consecutiveDays: 5, longestStreak: 5 },
      at(2026, 11, 20),
    );
    expect(r.consecutiveDays).toBe(1);
  });

  test("ungültiges Datum in der DB wird wie 'nie gespielt' behandelt", () => {
    expect(computeDayStreak({ lastPlayedDate: "kaputt" }, at(2026, 11, 25)).consecutiveDays).toBe(1);
  });
});

describe("toLocalDayKey", () => {
  test("Format JJJJ-MM-TT", () => {
    expect(toLocalDayKey(at(2026, 3, 5))).toBe("2026-03-05");
  });
});

describe("getNewlyUnlockedAchievements", () => {
  const none = {
    achievementFirstStar: 0,
    achievementGoldenStudent: 0,
    achievementDoctoralAward: 0,
    achievementProfessorBadge: 0,
  };
  test("erster Perfect Score → First Star", () => {
    expect(getNewlyUnlockedAchievements(1, none)).toEqual(["achievementFirstStar"]);
  });
  test("bereits freigeschaltete werden nicht erneut gemeldet", () => {
    expect(getNewlyUnlockedAchievements(5, { ...none, achievementFirstStar: 1 })).toEqual([
      "achievementGoldenStudent",
    ]);
  });
  test("0 Perfect → nichts", () => {
    expect(getNewlyUnlockedAchievements(0, none)).toEqual([]);
  });
  test("Spalte fehlt (NULL nach ALTER TABLE) → wird trotzdem freigeschaltet", () => {
    expect(getNewlyUnlockedAchievements(20, {})).toHaveLength(4);
  });
});

describe("getQuestionTimeStats", () => {
  test("leere Liste → Nullen", () => {
    expect(getQuestionTimeStats([])).toEqual({ avg: 0, fastest: 0, slowest: 0 });
  });
  test("Durchschnitt gerundet, schnellste und langsamste Antwort", () => {
    expect(getQuestionTimeStats([2, 3, 10])).toEqual({ avg: 5, fastest: 2, slowest: 10 });
  });
});
