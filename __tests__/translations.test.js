// Prüft die 8 UI-Sprachen in app/i18n.js gegen den Code.
import fs from "fs";
import path from "path";

jest.mock("expo-sqlite", () => ({ openDatabaseSync: () => ({}) }));
jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: "en" }] }));

const { LANGUAGE_RESOURCES } = require("../app/i18n");

const ROOT = path.join(__dirname, "..");
const SOURCE_DIRS = ["app", "lib"];
const placeholders = (s) => (String(s).match(/{{\s*\w+\s*}}/g) || []).map((p) => p.replace(/\s/g, "")).sort();

const sourceFiles = SOURCE_DIRS.flatMap((dir) =>
  fs
    .readdirSync(path.join(ROOT, dir))
    .filter((f) => f.endsWith(".js") && !["i18n.js", "words.js", "translations.js", "sentences_data.js"].includes(f))
    .map((f) => path.join(ROOT, dir, f)),
);

// Schlüssel, die im Code per t("…") oder t('…') abgefragt werden
const usedKeys = new Set();
sourceFiles.forEach((file) => {
  const src = fs.readFileSync(file, "utf8");
  for (const m of src.matchAll(/\bt\(\s*["']([A-Za-z0-9_.]+)["']/g)) usedKeys.add(m[1]);
});
// Dynamisch erzeugte Schlüssel (z. B. aus lib/quizLogic.getRewardKey)
[
  "rewardPerfect", "reward18", "reward15", "reward10", "reward5", "rewardDefault",
  // t(ach.id) in index.js
  "achievementFirstStar", "achievementGoldenStudent", "achievementDoctoralAward", "achievementProfessorBadge",
].forEach((k) =>
  usedKeys.add(k),
);

const langs = Object.keys(LANGUAGE_RESOURCES);
const enKeys = Object.keys(LANGUAGE_RESOURCES.en).sort();

test("alle 8 Sprachen sind vorhanden", () => {
  expect(langs.sort()).toEqual(["ar", "de", "en", "es", "fr", "ru", "tr", "uk"]);
});

test.each(langs)("%s hat genau dieselben Schlüssel wie en", (lang) => {
  const keys = Object.keys(LANGUAGE_RESOURCES[lang]);
  expect({ fehlt: enKeys.filter((k) => !keys.includes(k)), zuviel: keys.filter((k) => !enKeys.includes(k)) }).toEqual({
    fehlt: [],
    zuviel: [],
  });
});

test.each(langs)("%s hat keine leeren Texte", (lang) => {
  const empty = Object.entries(LANGUAGE_RESOURCES[lang])
    .filter(([, v]) => typeof v !== "string" || !v.trim())
    .map(([k]) => k);
  expect(empty).toEqual([]);
});

// {{s}} ist nur die englische Pluralendung ("Score{{s}}") und darf in anderen Sprachen fehlen.
const OPTIONAL_PLACEHOLDERS = ["{{s}}"];

test.each(langs)("%s nutzt dieselben Platzhalter ({{n}}, {{rank}} …) wie en", (lang) => {
  const wrong = [];
  enKeys.forEach((k) => {
    const en = placeholders(LANGUAGE_RESOURCES.en[k]);
    const own = placeholders(LANGUAGE_RESOURCES[lang][k]);
    const missing = en.filter((p) => !own.includes(p) && !OPTIONAL_PLACEHOLDERS.includes(p));
    const unknown = own.filter((p) => !en.includes(p)); // würde als Text "{{x}}" erscheinen
    if (missing.length || unknown.length) wrong.push({ key: k, missing, unknown });
  });
  expect(wrong).toEqual([]);
});

test("jeder t(\"…\")-Schlüssel im Code existiert", () => {
  expect([...usedKeys].filter((k) => !(k in LANGUAGE_RESOURCES.en)).sort()).toEqual([]);
});
