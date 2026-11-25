import { RANKS, getRankInfo, isRankUp } from "../lib/ranks";

describe("RANKS", () => {
  test("starten bei 0 und sind streng aufsteigend sortiert", () => {
    expect(RANKS[0].minPerfect).toBe(0);
    for (let i = 1; i < RANKS.length; i++) {
      expect(RANKS[i].minPerfect).toBeGreaterThan(RANKS[i - 1].minPerfect);
    }
  });
  test("haben eindeutige Namen", () => {
    expect(new Set(RANKS.map((r) => r.name)).size).toBe(RANKS.length);
  });
});

describe("getRankInfo", () => {
  test.each([
    [0, "Student", "Scholar"],
    [1, "Scholar", "Bachelor"],
    [2, "Scholar", "Bachelor"],
    [3, "Bachelor", "Master"],
    [9, "Master", "Doctor"],
    [10, "Doctor", "Professor"],
    [99, "Academy Fellow", "Grandmaster"],
    [100, "Grandmaster", "Grandmaster"],
    [5000, "Grandmaster", "Grandmaster"],
  ])("%i Perfect → %s (nächster: %s)", (p, current, next) => {
    const info = getRankInfo(p);
    expect(info.current.name).toBe(current);
    expect(info.next.name).toBe(next);
  });

  test("Fortschritt innerhalb eines Rangs", () => {
    // Master (5) → Doctor (10): bei 7 sind 2 von 5 geschafft
    const info = getRankInfo(7);
    expect(info.progressPercent).toBeCloseTo(40);
    expect(info.perfectsUntilNext).toBe(3);
  });

  test("höchster Rang: 100 % und nichts mehr offen", () => {
    const info = getRankInfo(150);
    expect(info.isMax).toBe(true);
    expect(info.progressPercent).toBe(100);
    expect(info.perfectsUntilNext).toBe(0);
  });

  test.each([null, undefined, NaN, -3, "abc"])("ungültiger Wert %p → Student", (v) => {
    const info = getRankInfo(v);
    expect(info.current.name).toBe("Student");
    expect(info.perfectsUntilNext).toBe(1);
  });

  test("Fortschritt liegt immer zwischen 0 und 100", () => {
    for (let p = 0; p <= 120; p++) {
      const { progressPercent } = getRankInfo(p);
      expect(progressPercent).toBeGreaterThanOrEqual(0);
      expect(progressPercent).toBeLessThanOrEqual(100);
    }
  });
});

describe("isRankUp", () => {
  test("Aufstieg wird erkannt", () => {
    expect(isRankUp(getRankInfo(0).current, getRankInfo(1).current)).toBe(true);
  });
  test("kein Aufstieg im selben Rang oder ohne vorherigen Rang", () => {
    expect(isRankUp(getRankInfo(1).current, getRankInfo(2).current)).toBe(false);
    expect(isRankUp(null, getRankInfo(5).current)).toBe(false);
  });
  test("kein Popup beim ersten Laden", () => {
    expect(isRankUp(undefined, RANKS[3])).toBe(false);
  });
});
