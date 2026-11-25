// Prüft words.js, translations.js und sentences_data.js auf Datenfehler.
import { quizMainData } from "../app/words";
import { TRANSLATIONS } from "../app/translations";
import { SENTENCES } from "../app/sentences_data";

const ARTICLES = ["der", "die", "das"];
const LEVELS = ["A1", "A2", "B1"];
const TRANSLATION_LANGS = ["ru", "tr", "ar", "fr", "es", "uk"];
const label = (x) => `${x.a} ${x.q}`;

describe("words.js", () => {
  test("hat Wörter", () => {
    expect(quizMainData.length).toBeGreaterThan(100);
  });

  test("jedes Wort hat Pflichtfelder", () => {
    const broken = quizMainData.filter(
      (x) => !x.q?.trim() || !x.en?.trim() || !x.c?.trim() || x.q !== x.q.trim(),
    );
    expect(broken.map(label)).toEqual([]);
  });

  test("Artikel ist der/die/das (kleingeschrieben)", () => {
    expect(quizMainData.filter((x) => !ARTICLES.includes(x.a)).map(label)).toEqual([]);
  });

  test("Level ist A1/A2/B1", () => {
    expect(quizMainData.filter((x) => !LEVELS.includes(x.l)).map(label)).toEqual([]);
  });

  test("Nomen beginnen mit Großbuchstaben", () => {
    expect(quizMainData.filter((x) => x.q[0] !== x.q[0].toUpperCase()).map(label)).toEqual([]);
  });

  test("kein Wort doppelt", () => {
    const seen = new Set();
    const dups = [];
    quizMainData.forEach((x) => {
      if (seen.has(x.q)) dups.push(label(x));
      seen.add(x.q);
    });
    expect(dups).toEqual([]);
  });

  test("jedes Level hat genug Wörter für ein eigenes Quiz (>= 20)", () => {
    const tooSmall = LEVELS.map((lvl) => [lvl, quizMainData.filter((x) => x.l === lvl).length]).filter(
      ([, n]) => n < 20,
    );
    expect(tooSmall).toEqual([]);
  });
});

describe("translations.js", () => {
  test("jedes Wort hat Übersetzungen in allen 6 Sprachen", () => {
    const missing = [];
    quizMainData.forEach((x) => {
      const tr = TRANSLATIONS[x.q];
      TRANSLATION_LANGS.forEach((lang) => {
        if (!tr?.[lang]?.trim()) missing.push(`${x.q}:${lang}`);
      });
    });
    expect(missing).toEqual([]);
  });

  test("keine verwaisten Einträge (Übersetzung ohne Wort)", () => {
    const known = new Set(quizMainData.map((x) => x.q));
    expect(Object.keys(TRANSLATIONS).filter((k) => !known.has(k))).toEqual([]);
  });
});

describe("sentences_data.js", () => {
  test("vorhandene Sätze haben alle 4 Fälle", () => {
    const broken = Object.entries(SENTENCES)
      .filter(([, s]) => ["n", "a", "d", "g"].some((k) => !s?.[k]?.trim()))
      .map(([k]) => k);
    expect(broken).toEqual([]);
  });

  test("keine verwaisten Sätze (Satz ohne Wort)", () => {
    const known = new Set(quizMainData.map((x) => x.q));
    expect(Object.keys(SENTENCES).filter((k) => !known.has(k))).toEqual([]);
  });

  test("Nominativ-Satz enthält das Wort", () => {
    const bad = quizMainData
      .filter((x) => SENTENCES[x.q] && !SENTENCES[x.q].n.includes(x.q))
      .map(label);
    expect(bad).toEqual([]);
  });
});
