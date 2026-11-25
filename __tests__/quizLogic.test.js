import { buildQuiz, getRewardKey, getWordPool, QUIZ_LENGTH, shuffle } from "../lib/quizLogic";

const w = (q, l = "A1", a = "der") => ({ q, a, l });
const words = [
  ...Array.from({ length: 30 }, (_, i) => w(`A1wort${i}`, "A1")),
  ...Array.from({ length: 15 }, (_, i) => w(`A2wort${i}`, "A2")),
  ...Array.from({ length: 5 }, (_, i) => w(`B1wort${i}`, "B1")),
];

// Deterministischer Zufall für reproduzierbare Tests
const seeded = (seed) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

describe("shuffle", () => {
  test("verändert die Eingabe nicht und verliert nichts", () => {
    const input = [1, 2, 3, 4, 5];
    const out = shuffle(input, seeded(1));
    expect(input).toEqual([1, 2, 3, 4, 5]);
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5]);
  });

  test("ist gleichverteilt (jedes Element landet ~gleich oft vorne)", () => {
    const counts = [0, 0, 0, 0, 0];
    const rng = seeded(42);
    const runs = 20000;
    for (let i = 0; i < runs; i++) counts[shuffle([0, 1, 2, 3, 4], rng)[0]]++;
    counts.forEach((c) => expect(Math.abs(c / runs - 0.2)).toBeLessThan(0.02));
  });
});

describe("getWordPool", () => {
  test("filtert nach Level", () => {
    expect(getWordPool(words, "A2").every((x) => x.l === "A2")).toBe(true);
  });
  test("'Alle' und leer → alle Wörter", () => {
    expect(getWordPool(words, "Alle")).toHaveLength(50);
    expect(getWordPool(words, undefined)).toHaveLength(50);
  });
  test("zu kleiner Level-Pool (< 10) → Fallback auf alle Wörter", () => {
    expect(getWordPool(words, "B1")).toHaveLength(50);
  });
  test("entfernt doppelte Einträge", () => {
    const dup = [...words, w("A1wort0", "A1")];
    expect(getWordPool(dup, "Alle")).toHaveLength(50);
  });
});

describe("buildQuiz", () => {
  test(`liefert ${QUIZ_LENGTH} verschiedene Wörter`, () => {
    for (let s = 1; s <= 50; s++) {
      const quiz = buildQuiz(words, "Alle", { rng: seeded(s) });
      expect(quiz).toHaveLength(QUIZ_LENGTH);
      expect(new Set(quiz.map((x) => `${x.a}|${x.q}`)).size).toBe(QUIZ_LENGTH);
    }
  });
  test("kleiner Pool → so viele Fragen wie Wörter da sind", () => {
    expect(buildQuiz(words, "A2")).toHaveLength(15);
  });
  test("Level wird eingehalten", () => {
    expect(buildQuiz(words, "A1").every((x) => x.l === "A1")).toBe(true);
  });
});

describe("getRewardKey", () => {
  test.each([
    [20, 20, "rewardPerfect"],
    [19, 20, "reward18"],
    [18, 20, "reward18"],
    [17, 20, "reward15"],
    [15, 20, "reward15"],
    [10, 20, "reward10"],
    [9, 20, "reward5"],
    [5, 20, "reward5"],
    [4, 20, "rewardDefault"],
    [0, 20, "rewardDefault"],
    [15, 15, "rewardPerfect"], // kleiner Pool: 15/15 ist auch perfekt
    [0, 0, "rewardDefault"],
  ])("%i/%i → %s", (score, total, key) => {
    expect(getRewardKey(score, total)).toBe(key);
  });
});
