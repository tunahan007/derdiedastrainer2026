// Bewertungs-Logik: 3+ Quizze, >= 80 %, 14 Tage Pause, max. 3 Anfragen.
jest.mock("expo-store-review", () => ({
  isAvailableAsync: jest.fn(async () => true),
  requestReview: jest.fn(async () => {}),
}));

const StoreReview = require("expo-store-review");
const { maybeAskForReview } = require("../lib/ratingService");

// Minimaler Ersatz für die SQLite-DB (nur app_meta)
const fakeDb = () => {
  const meta = new Map();
  return {
    meta,
    execAsync: async () => {},
    getFirstAsync: async (_sql, [key]) => (meta.has(key) ? { value: meta.get(key) } : null),
    runAsync: async (_sql, [key, value]) => {
      meta.set(key, value);
    },
  };
};

const DAY = 24 * 60 * 60 * 1000;
let now;
beforeEach(() => {
  jest.clearAllMocks();
  now = new Date(2026, 10, 1).getTime();
  jest.spyOn(Date, "now").mockImplementation(() => now);
  jest.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

test("fragt erst ab dem 3. Quiz", async () => {
  const db = fakeDb();
  expect(await maybeAskForReview(db, 100)).toBe(false);
  expect(await maybeAskForReview(db, 100)).toBe(false);
  expect(await maybeAskForReview(db, 100)).toBe(true);
  expect(StoreReview.requestReview).toHaveBeenCalledTimes(1);
});

test("fragt nicht bei Score unter 80 %", async () => {
  const db = fakeDb();
  await maybeAskForReview(db, 100);
  await maybeAskForReview(db, 100);
  expect(await maybeAskForReview(db, 75)).toBe(false);
  expect(await maybeAskForReview(db, 80)).toBe(true);
});

test("14 Tage Pause zwischen zwei Anfragen", async () => {
  const db = fakeDb();
  for (let i = 0; i < 3; i++) await maybeAskForReview(db, 100);
  now += 13 * DAY;
  expect(await maybeAskForReview(db, 100)).toBe(false);
  now += 1 * DAY;
  expect(await maybeAskForReview(db, 100)).toBe(true);
});

test("höchstens 3 Anfragen insgesamt", async () => {
  const db = fakeDb();
  let asks = 0;
  for (let i = 0; i < 20; i++) {
    if (await maybeAskForReview(db, 100)) asks++;
    now += 15 * DAY;
  }
  expect(asks).toBe(3);
});

test("zählt Quizze auch dann, wenn nicht gefragt wird", async () => {
  const db = fakeDb();
  await maybeAskForReview(db, 10);
  await maybeAskForReview(db, 10);
  expect(db.meta.get("rating_session_count")).toBe("2");
});

test("Store-Review nicht verfügbar → kein Absturz, false", async () => {
  StoreReview.isAvailableAsync.mockResolvedValueOnce(false);
  const db = fakeDb();
  for (let i = 0; i < 2; i++) await maybeAskForReview(db, 100);
  expect(await maybeAskForReview(db, 100)).toBe(false);
  expect(StoreReview.requestReview).not.toHaveBeenCalled();
});

test("DB-Fehler → kein Absturz, false", async () => {
  jest.spyOn(console, "warn").mockImplementation(() => {});
  const db = { execAsync: async () => { throw new Error("database is locked"); } };
  expect(await maybeAskForReview(db, 100)).toBe(false);
});
