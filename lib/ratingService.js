// Bewertungserinnerung (In-App Review) für Google Play und App Store.
// Regeln: mind. 3 abgeschlossene Quizze, Score >= 80 %, 14 Tage Pause, max. 3 Anfragen.
// Zustand liegt in der SQLite-Tabelle app_meta (key/value).

let StoreReview = null;
try {
  StoreReview = require("expo-store-review");
} catch (e) {
  StoreReview = null; // z. B. Expo Go / fehlendes natives Modul
}

const MIN_SESSIONS = 3;
const MIN_SCORE_PERCENT = 80;
const COOLDOWN_DAYS = 14;
const MAX_ASKS = 3;

const ensureMetaTable = async (db) => {
  await db.execAsync(
    `CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY NOT NULL, value TEXT);`,
  );
};

const getMeta = async (db, key, fallback) => {
  const row = await db.getFirstAsync(`SELECT value FROM app_meta WHERE key = ?`, [key]);
  return row ? row.value : fallback;
};

const setMeta = async (db, key, value) => {
  await db.runAsync(
    `INSERT INTO app_meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, String(value)],
  );
};

/**
 * Nach jedem abgeschlossenen Quiz aufrufen.
 * Zählt die Session und fragt bei Erfüllung aller Regeln nach einer Bewertung.
 */
export const maybeAskForReview = async (db, scorePercent) => {
  try {
    await ensureMetaTable(db);

    const sessions = parseInt(await getMeta(db, "rating_session_count", "0"), 10) + 1;
    await setMeta(db, "rating_session_count", sessions);

    if (!StoreReview) return false;
    if (sessions < MIN_SESSIONS) return false;
    if (scorePercent < MIN_SCORE_PERCENT) return false;

    const askCount = parseInt(await getMeta(db, "rating_ask_count", "0"), 10);
    if (askCount >= MAX_ASKS) return false;

    const lastAsk = parseInt(await getMeta(db, "rating_last_ask", "0"), 10);
    const daysSince = (Date.now() - lastAsk) / (1000 * 60 * 60 * 24);
    if (lastAsk > 0 && daysSince < COOLDOWN_DAYS) return false;

    const available = await StoreReview.isAvailableAsync();
    if (!available) return false;

    await StoreReview.requestReview();
    await setMeta(db, "rating_ask_count", askCount + 1);
    await setMeta(db, "rating_last_ask", Date.now());
    console.log("⭐ Review requested");
    return true;
  } catch (e) {
    console.warn("ratingService:", e?.message);
    return false;
  }
};
