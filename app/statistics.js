import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
} from "react-native";
import { openDatabaseSync } from "expo-sqlite";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LineChart } from "react-native-chart-kit";
import { Dimensions } from "react-native";
import ABanner from "./banner";
import { useRouter } from "expo-router";
import { quizMainData } from "./words";
import { useTranslation } from "react-i18next";

const db = openDatabaseSync("appdata.db");
const screenWidth = Dimensions.get("window").width;

const RANKS = [
  { minPerfect: 0, name: "Student", color: "#94a3b8", emoji: "📚" },
  { minPerfect: 1, name: "Scholar", color: "#60a5fa", emoji: "🎓" },
  { minPerfect: 3, name: "Bachelor", color: "#8b5cf6", emoji: "🎓⭐" },
  { minPerfect: 5, name: "Master", color: "#10b981", emoji: "🎓⭐⭐" },
  { minPerfect: 10, name: "Doctor", color: "#f59e0b", emoji: "🧪👨‍🔬" },
  { minPerfect: 20, name: "Professor", color: "#ef4444", emoji: "🦉👑" },
];

const TOTAL_WORDS = quizMainData.length;

// Count words per level from words.js
const WORDS_PER_LEVEL = quizMainData.reduce((acc, w) => {
  const lvl = w.level || "A1";
  acc[lvl] = (acc[lvl] || 0) + 1;
  return acc;
}, {});

const LEVEL_COLORS = {
  A1: "#10b981",
  A2: "#3b82f6",
  B1: "#8b5cf6",
  B2: "#f59e0b",
  C1: "#ef4444",
  C2: "#ec4899",
};

const Statistics = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const [stats, setStats] = useState([]);
  const [achievements, setAchievements] = useState(null);
  const [wordProgress, setWordProgress] = useState({
    totalSeen: 0,
    totalMastered: 0, // correct >= 2 and accuracy >= 70%
    byLevel: {},
    weakWords: [],
  });
  const [selectedTab, setSelectedTab] = useState("overview");
  const [pulseAnim] = useState(new Animated.Value(1));
  const [currentRank, setCurrentRank] = useState(RANKS[0]);
  const [nextRank, setNextRank] = useState(RANKS[1]);
  const [progressPercent, setProgressPercent] = useState(0);
  const [perfectsUntilNext, setPerfectsUntilNext] = useState(1);
  const [failedWords, setFailedWords] = useState([]);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    ).start();
    loadData();
  }, []);

  const loadData = async () => {
    try {
      await ensureTables();

      const rows = await db.getAllAsync(
        "SELECT * FROM statistics ORDER BY date DESC LIMIT 20",
      );
      setStats(rows);

      const achRow = await db.getFirstAsync(
        "SELECT * FROM achievements WHERE userId = 'default'",
      );
      setAchievements(achRow);
      if (achRow) calculateRank(achRow.perfectScores || 0);

      await loadWordProgress();
      await loadFailedWords();
    } catch (error) {
      console.error("loadData error:", error);
    }
  };

  const ensureTables = async () => {
    // statistics
    const statInfo = await db.getAllAsync(`PRAGMA table_info(statistics)`);
    if (statInfo.length === 0) {
      await db.execAsync(`
        CREATE TABLE statistics (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT NOT NULL,
          totalReviewed INTEGER DEFAULT 0,
          correctAnswers INTEGER DEFAULT 0,
          fails INTEGER DEFAULT 0,
          progressPercent REAL DEFAULT 0,
          sessionTime INTEGER DEFAULT 0,
          bestStreak INTEGER DEFAULT 0,
          avgTimePerQuestion INTEGER DEFAULT 0,
          fastestQuestion INTEGER DEFAULT 0,
          slowestQuestion INTEGER DEFAULT 0
        );
      `);
    } else {
      const cols = statInfo.map((c) => c.name);
      if (!cols.includes("bestStreak"))
        await db.execAsync(
          `ALTER TABLE statistics ADD COLUMN bestStreak INTEGER DEFAULT 0;`,
        );
      if (!cols.includes("avgTimePerQuestion"))
        await db.execAsync(
          `ALTER TABLE statistics ADD COLUMN avgTimePerQuestion INTEGER DEFAULT 0;`,
        );
    }

    // achievements
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS achievements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT DEFAULT 'default',
        totalQuizzes INTEGER DEFAULT 0,
        totalCorrect INTEGER DEFAULT 0,
        totalQuestions INTEGER DEFAULT 0,
        perfectScores INTEGER DEFAULT 0,
        longestStreak INTEGER DEFAULT 0,
        lastPlayedDate TEXT,
        consecutiveDays INTEGER DEFAULT 0,
        achievementFirstStar INTEGER DEFAULT 0,
        achievementGoldenStudent INTEGER DEFAULT 0,
        achievementDoctoralAward INTEGER DEFAULT 0,
        achievementProfessorBadge INTEGER DEFAULT 0,
        highestScore INTEGER DEFAULT 0,
        fastestTime INTEGER DEFAULT 0
      );
    `);

    // failed_words
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS failed_words (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        word TEXT NOT NULL,
        correctArticle TEXT NOT NULL,
        wrongArticle TEXT NOT NULL,
        failCount INTEGER DEFAULT 1,
        lastFailed TEXT NOT NULL,
        UNIQUE(word, correctArticle)
      );
    `);

    // word_progress
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS word_progress (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        word TEXT NOT NULL UNIQUE,
        correctArticle TEXT NOT NULL,
        level TEXT DEFAULT 'A1',
        category TEXT DEFAULT '',
        seenCount INTEGER DEFAULT 0,
        correctCount INTEGER DEFAULT 0,
        wrongCount INTEGER DEFAULT 0,
        lastSeen TEXT,
        firstSeen TEXT
      );
    `);
  };

  const loadWordProgress = async () => {
    try {
      const allProgress = await db.getAllAsync("SELECT * FROM word_progress");

      const totalSeen = allProgress.length;
      // "mastered" = seen at least 3 times with accuracy >= 70%
      const totalMastered = allProgress.filter(
        (w) => w.seenCount >= 3 && w.correctCount / w.seenCount >= 0.7,
      ).length;

      // By level
      const byLevel = {};
      for (const w of allProgress) {
        const lvl = w.level || "A1";
        if (!byLevel[lvl]) byLevel[lvl] = { seen: 0, mastered: 0 };
        byLevel[lvl].seen++;
        if (w.seenCount >= 3 && w.correctCount / w.seenCount >= 0.7) {
          byLevel[lvl].mastered++;
        }
      }

      // Weak words: seen but accuracy < 50%, sorted by wrongCount
      const weakWords = allProgress
        .filter((w) => w.seenCount >= 2 && w.correctCount / w.seenCount < 0.5)
        .sort((a, b) => b.wrongCount - a.wrongCount)
        .slice(0, 5);

      setWordProgress({ totalSeen, totalMastered, byLevel, weakWords });
    } catch (error) {
      console.error("loadWordProgress error:", error);
      setWordProgress({
        totalSeen: 0,
        totalMastered: 0,
        byLevel: {},
        weakWords: [],
      });
    }
  };

  const loadFailedWords = async () => {
    try {
      const words = await db.getAllAsync(
        `SELECT * FROM failed_words WHERE failCount > 0 ORDER BY failCount DESC, lastFailed DESC LIMIT 5`,
      );
      setFailedWords(words || []);
    } catch (error) {
      setFailedWords([]);
    }
  };

  const calculateRank = (perfectScores) => {
    let current = RANKS[0];
    let next = RANKS[1];
    for (let i = RANKS.length - 1; i >= 0; i--) {
      if (perfectScores >= RANKS[i].minPerfect) {
        current = RANKS[i];
        next = RANKS[i + 1] || RANKS[i];
        break;
      }
    }
    setCurrentRank(current);
    setNextRank(next);
    if (next && next.name !== current.name) {
      const inCurrent = perfectScores - current.minPerfect;
      const needed = next.minPerfect - current.minPerfect;
      setProgressPercent(needed > 0 ? (inCurrent / needed) * 100 : 100);
      setPerfectsUntilNext(next.minPerfect - perfectScores);
    } else {
      setProgressPercent(100);
      setPerfectsUntilNext(0);
    }
  };

  const calculateAccuracy = () => {
    if (!achievements || achievements.totalQuestions === 0) return 0;
    return (
      (achievements.totalCorrect / achievements.totalQuestions) *
      100
    ).toFixed(1);
  };

  const getChartData = () => {
    if (stats.length === 0) return null;
    const recentStats = stats.slice(0, 7).reverse();
    return {
      labels: recentStats.map((_, i) => `${i + 1}`),
      datasets: [
        {
          data: recentStats.map((s) => parseFloat(s.progressPercent) || 0),
          color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`,
          strokeWidth: 3,
        },
      ],
    };
  };

  const getAchievementBadges = () => {
    if (!achievements) return [];
    const badges = [];
    if (achievements.perfectScores >= 10)
      badges.push({
        icon: "trophy-award",
        color: "#fbbf24",
        label: t("10perfectScores"),
      });
    else if (achievements.perfectScores >= 5)
      badges.push({
        icon: "trophy",
        color: "#f59e0b",
        label: t("5perfectScores"),
      });
    if (achievements.consecutiveDays >= 7)
      badges.push({
        icon: "fire",
        color: "#ef4444",
        label: t("dayStreakBadge", { n: achievements.consecutiveDays }),
      });
    if (achievements.longestStreak >= 15)
      badges.push({
        icon: "chart-line",
        color: "#10b981",
        label: t("maxStreakBadge", { n: achievements.longestStreak }),
      });
    if (achievements.totalQuizzes >= 50)
      badges.push({
        icon: "book-multiple",
        color: "#8b5cf6",
        label: t("50quizzesBadge"),
      });
    if (achievements.totalCorrect >= 500)
      badges.push({
        icon: "star",
        color: "#06b6d4",
        label: t("500correctBadge"),
      });
    return badges;
  };

  // ─── OVERVIEW TAB ────────────────────────────────────────────────────────────

  const renderOverviewTab = () => (
    <View>
      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <View style={[styles.statBox, { backgroundColor: "#eff6ff" }]}>
          <MaterialCommunityIcons
            name="check-circle"
            size={32}
            color="#3b82f6"
          />
          <Text style={styles.statNumber}>
            {achievements?.totalCorrect || 0}
          </Text>
          <Text style={styles.statLabel}>{t("correct")}</Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: "#fef3c7" }]}>
          <MaterialCommunityIcons
            name="book-open-variant"
            size={32}
            color="#f59e0b"
          />
          <Text style={styles.statNumber}>
            {achievements?.totalQuizzes || 0}
          </Text>
          <Text style={styles.statLabel}>{t("quizzes")}</Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: "#ecfdf5" }]}>
          <MaterialCommunityIcons name="fire" size={32} color="#ef4444" />
          <Text style={styles.statNumber}>
            {achievements?.consecutiveDays || 0}
          </Text>
          <Text style={styles.statLabel}>{t("dayStreak")}</Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: "#fce7f3" }]}>
          <MaterialCommunityIcons name="percent" size={32} color="#ec4899" />
          <Text style={styles.statNumber}>{calculateAccuracy()}%</Text>
          <Text style={styles.statLabel}>{t("accuracy")}</Text>
        </View>
      </View>

      {/* Word Coverage Card */}
      <View style={styles.coverageCard}>
        <View style={styles.coverageHeader}>
          <MaterialCommunityIcons
            name="book-alphabet"
            size={24}
            color="#6366f1"
          />
          <Text style={styles.coverageTitle}>{t("wordsDiscovered")}</Text>
        </View>

        <View style={styles.coverageBigRow}>
          <Text style={styles.coverageBigNumber}>{wordProgress.totalSeen}</Text>
          <Text style={styles.coverageBigDivider}>/</Text>
          <Text style={styles.coverageBigTotal}>{TOTAL_WORDS}</Text>
        </View>

        <View style={styles.coverageBarBg}>
          <View
            style={[
              styles.coverageBarFill,
              {
                width: `${Math.min((wordProgress.totalSeen / TOTAL_WORDS) * 100, 100)}%`,
              },
            ]}
          />
        </View>
        <Text style={styles.coverageSubtext}>
          {wordProgress.totalMastered} {t("mastered")} ·{" "}
          {TOTAL_WORDS - wordProgress.totalSeen} {t("notSeenYet")}
        </Text>

        {/* By Level */}
        <View style={styles.levelBreakdown}>
          {Object.entries(WORDS_PER_LEVEL)
            .sort()
            .map(([level, total]) => {
              const seen = wordProgress.byLevel[level]?.seen || 0;
              const mastered = wordProgress.byLevel[level]?.mastered || 0;
              const pct = Math.min((seen / total) * 100, 100);
              return (
                <View key={level} style={styles.levelRow}>
                  <View
                    style={[
                      styles.levelTag,
                      { backgroundColor: LEVEL_COLORS[level] || "#6366f1" },
                    ]}
                  >
                    <Text style={styles.levelTagText}>{level}</Text>
                  </View>
                  <View style={styles.levelBarBg}>
                    <View
                      style={[
                        styles.levelBarFill,
                        {
                          width: `${pct}%`,
                          backgroundColor: LEVEL_COLORS[level] || "#6366f1",
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.levelCount}>
                    {seen}/{total}
                  </Text>
                </View>
              );
            })}
        </View>
      </View>

      {/* Chart */}
      {getChartData() && (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>{t("last7Sessions")}</Text>
          <LineChart
            data={getChartData()}
            width={screenWidth - 60}
            height={180}
            chartConfig={{
              backgroundColor: "#ffffff",
              backgroundGradientFrom: "#ffffff",
              backgroundGradientTo: "#ffffff",
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(71, 85, 105, ${opacity})`,
              style: { borderRadius: 16 },
              propsForDots: { r: "6", strokeWidth: "2", stroke: "#6366f1" },
            }}
            bezier
            style={styles.chart}
          />
        </View>
      )}

      {/* Weak Words */}
      {wordProgress.weakWords.length > 0 && (
        <View style={styles.weakWordsCard}>
          <Text style={styles.sectionCardTitle}>{t("weakWords")}</Text>
          <Text style={styles.sectionCardSubtitle}>{t("oftenWrong")}</Text>
          {wordProgress.weakWords.map((item, i) => {
            const accuracy =
              item.seenCount > 0
                ? Math.round((item.correctCount / item.seenCount) * 100)
                : 0;
            return (
              <View key={i} style={styles.weakWordItem}>
                <View style={styles.weakWordLeft}>
                  <Text style={styles.weakWordText}>
                    {item.correctArticle} {item.word}
                  </Text>
                  <View
                    style={[
                      styles.levelTag,
                      {
                        backgroundColor: LEVEL_COLORS[item.level] || "#6366f1",
                      },
                    ]}
                  >
                    <Text style={styles.levelTagText}>{item.level}</Text>
                  </View>
                </View>
                <View style={styles.weakWordRight}>
                  <Text
                    style={[
                      styles.weakWordAccuracy,
                      { color: accuracy < 30 ? "#ef4444" : "#f59e0b" },
                    ]}
                  >
                    {accuracy}%
                  </Text>
                  <Text style={styles.weakWordSeen}>{item.seenCount}x</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Failed Words */}
      <View style={styles.failedWordsCard}>
        <Text style={styles.sectionCardTitle}>{t("wordsToPractice")}</Text>
        <Text style={styles.sectionCardSubtitle}>{t("missedMost")}</Text>
        {failedWords.length > 0 ? (
          <View style={styles.failedWordsList}>
            {failedWords.map((item, index) => (
              <View key={index} style={styles.failedWordItem}>
                <View style={styles.failedWordHeader}>
                  <MaterialCommunityIcons
                    name="alert-circle"
                    size={20}
                    color="#ef4444"
                  />
                  <Text style={styles.failedWordText}>
                    {item.wrongArticle} {item.word}
                  </Text>
                  <View style={styles.failCountBadge}>
                    <Text style={styles.failCountText}>×{item.failCount}</Text>
                  </View>
                </View>
                <Text style={styles.failedWordHint}>
                  {t("correctAnswer")} {item.correctArticle} {item.word}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyFailedWords}>
            <MaterialCommunityIcons
              name="information-outline"
              size={48}
              color="#cbd5e1"
            />
            <Text style={styles.emptyFailedWordsText}>
              {achievements && achievements.totalQuizzes > 0
                ? t("noFailedYet")
                : t("completeQuizFirst")}
            </Text>
          </View>
        )}
        <TouchableOpacity
          style={styles.practiceButton}
          onPress={() => router.push("/practicefailedwords")}
        >
          <MaterialCommunityIcons name="school" size={20} color="#fff" />
          <Text style={styles.practiceButtonText}>
            {t("practiceFailedWords")}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ─── SESSIONS TAB ────────────────────────────────────────────────────────────

  const renderSessionsTab = () => (
    <View>
      <Text style={styles.sectionTitle}>{t("sessionHistory")}</Text>
      {stats.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons
            name="clipboard-text-off"
            size={64}
            color="#cbd5e1"
          />
          <Text style={styles.emptyText}>{t("noSessionsYet")}</Text>
          <Text style={styles.emptySubtext}>{t("startFirstQuiz")}</Text>
        </View>
      ) : (
        stats.map((item) => (
          <View key={item.id} style={styles.sessionCard}>
            <View style={styles.sessionHeader}>
              <View style={styles.sessionDateContainer}>
                <MaterialCommunityIcons
                  name="calendar"
                  size={20}
                  color="#6366f1"
                />
                <Text style={styles.sessionDate}>
                  {new Date(item.date).toLocaleDateString("de-DE", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </Text>
                <Text style={styles.sessionTime}>
                  {new Date(item.date).toLocaleTimeString("de-DE", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </View>
              <View
                style={[
                  styles.scoreCircle,
                  {
                    backgroundColor:
                      (item.progressPercent || 0) >= 80
                        ? "#10b981"
                        : (item.progressPercent || 0) >= 60
                          ? "#f59e0b"
                          : "#ef4444",
                  },
                ]}
              >
                <Text style={styles.scoreCircleText}>
                  {(item.progressPercent || 0).toFixed(0)}%
                </Text>
              </View>
            </View>

            <View style={styles.sessionStats}>
              <View style={styles.sessionStatItem}>
                <MaterialCommunityIcons
                  name="check-circle"
                  size={18}
                  color="#10b981"
                />
                <Text style={styles.sessionStatText}>
                  {item.correctAnswers || 0} {t("rightAnswer")}
                </Text>
              </View>
              <View style={styles.sessionStatItem}>
                <MaterialCommunityIcons
                  name="close-circle"
                  size={18}
                  color="#ef4444"
                />
                <Text style={styles.sessionStatText}>
                  {item.fails || 0} {t("wrongAnswer")}
                </Text>
              </View>
              <View style={styles.sessionStatItem}>
                <MaterialCommunityIcons
                  name="clock-outline"
                  size={18}
                  color="#6366f1"
                />
                <Text style={styles.sessionStatText}>
                  {Math.round((item.sessionTime || 0) / 60)} {t("minLabel")}
                </Text>
              </View>
            </View>

            {(item.bestStreak || 0) > 0 && (
              <View style={styles.sessionStreak}>
                <MaterialCommunityIcons name="fire" size={16} color="#f97316" />
                <Text style={styles.sessionStreakText}>
                  Best Streak: {item.bestStreak}
                </Text>
              </View>
            )}
            {(item.avgTimePerQuestion || 0) > 0 && (
              <Text style={styles.sessionAvgTime}>
                {t("avgPerQuestion", { n: item.avgTimePerQuestion })}
              </Text>
            )}
          </View>
        ))
      )}
    </View>
  );

  // ─── ACHIEVEMENTS TAB ────────────────────────────────────────────────────────

  const renderAchievementsTab = () => {
    const badges = getAchievementBadges();
    return (
      <View>
        <Text style={styles.sectionTitle}>{t("achievementsBadges")}</Text>

        {achievements && (
          <View style={styles.owlRankCard}>
            <View style={styles.owlRankHeader}>
              <View
                style={[
                  styles.owlCircleSmall,
                  { backgroundColor: currentRank.color },
                ]}
              >
                <Text style={styles.owlEmojiLarge}>🦉</Text>
                <View style={styles.rankBadgeSmall}>
                  <Text style={styles.rankEmojiSmall}>{currentRank.emoji}</Text>
                </View>
              </View>
              <View style={styles.owlRankInfo}>
                <Text style={styles.owlRankTitle}>{currentRank.name}</Text>
                <Text style={styles.owlRankSubtitle}>
                  {t("perfectScoresAch", {
                    n: achievements.perfectScores || 0,
                    s: (achievements.perfectScores || 0) !== 1 ? "s" : "",
                  })}
                </Text>
              </View>
            </View>

            <View style={styles.achievementStatsGrid}>
              <View style={styles.achievementStatBox}>
                <MaterialCommunityIcons
                  name="check-circle"
                  size={24}
                  color="#10b981"
                />
                <Text style={styles.achievementStatNumber}>
                  {achievements.totalCorrect}
                </Text>
                <Text style={styles.achievementStatLabel}>
                  {t("rightLabel")}
                </Text>
              </View>
              <View style={styles.achievementStatBox}>
                <MaterialCommunityIcons name="fire" size={24} color="#ef4444" />
                <Text style={styles.achievementStatNumber}>
                  {achievements.consecutiveDays}
                </Text>
                <Text style={styles.achievementStatLabel}>
                  {t("dayStreak")}
                </Text>
              </View>
              <View style={styles.achievementStatBox}>
                <MaterialCommunityIcons name="star" size={24} color="#fbbf24" />
                <Text style={styles.achievementStatNumber}>
                  {achievements.perfectScores}
                </Text>
                <Text style={styles.achievementStatLabel}>
                  {t("perfectLabel")}
                </Text>
              </View>
              <View style={styles.achievementStatBox}>
                <MaterialCommunityIcons
                  name="book-alphabet"
                  size={24}
                  color="#6366f1"
                />
                <Text style={styles.achievementStatNumber}>
                  {wordProgress.totalSeen}
                </Text>
                <Text style={styles.achievementStatLabel}>
                  {t("wordsLabel")}
                </Text>
              </View>
            </View>

            {perfectsUntilNext > 0 && (
              <View style={styles.nextRankSection}>
                <View style={styles.nextRankHeader}>
                  <Text style={styles.nextRankLabel}>
                    {t("nextRank", { rank: nextRank.name })}
                  </Text>
                  <Text style={styles.nextRankQuizzes}>
                    {t("morePerfect", { n: perfectsUntilNext })}
                  </Text>
                </View>
                <View style={styles.nextRankProgressBar}>
                  <View
                    style={[
                      styles.nextRankProgressFill,
                      {
                        width: `${progressPercent}%`,
                        backgroundColor: nextRank.color,
                      },
                    ]}
                  />
                </View>
              </View>
            )}
          </View>
        )}

        {badges.length > 0 ? (
          <View style={styles.badgesGrid}>
            {badges.map((badge, index) => (
              <View key={index} style={styles.badgeCard}>
                <MaterialCommunityIcons
                  name={badge.icon}
                  size={40}
                  color={badge.color}
                />
                <Text style={styles.badgeLabel}>{badge.label}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyStateBadges}>
            <MaterialCommunityIcons
              name="trophy-outline"
              size={64}
              color="#cbd5e1"
            />
            <Text style={styles.emptyText}>{t("noBadgesYet")}</Text>
            <Text style={styles.emptySubtext}>{t("playMoreQuizzes")}</Text>
          </View>
        )}

        <View style={styles.achievementProgressCard}>
          <Text style={styles.achievementProgressTitle}>{t("nextGoals")}</Text>
          <View style={styles.progressItem}>
            <Text style={styles.progressItemLabel}>
              {t("perfectScoresGoal", { n: achievements?.perfectScores || 0 })}
            </Text>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${((achievements?.perfectScores || 0) / 10) * 100}%`,
                  },
                ]}
              />
            </View>
          </View>
          <View style={styles.progressItem}>
            <Text style={styles.progressItemLabel}>
              {t("quizzesGoal", { n: achievements?.totalQuizzes || 0 })}
            </Text>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${((achievements?.totalQuizzes || 0) / 50) * 100}%`,
                  },
                ]}
              />
            </View>
          </View>
          <View style={styles.progressItem}>
            <Text style={styles.progressItemLabel}>
              {t("correctAnswersGoal", { n: achievements?.totalCorrect || 0 })}
            </Text>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${((achievements?.totalCorrect || 0) / 500) * 100}%`,
                  },
                ]}
              />
            </View>
          </View>
          <View style={styles.progressItem}>
            <Text style={styles.progressItemLabel}>
              {t("wordsDiscoveredGoal")}: {wordProgress.totalSeen} /{" "}
              {TOTAL_WORDS}
            </Text>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${(wordProgress.totalSeen / TOTAL_WORDS) * 100}%`,
                    backgroundColor: "#10b981",
                  },
                ]}
              />
            </View>
          </View>
          <View style={styles.progressItem}>
            <Text style={styles.progressItemLabel}>
              Wörter {t("mastered")}: {wordProgress.totalMastered} /{" "}
              {TOTAL_WORDS}
            </Text>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${(wordProgress.totalMastered / TOTAL_WORDS) * 100}%`,
                    backgroundColor: "#8b5cf6",
                  },
                ]}
              />
            </View>
          </View>
        </View>
      </View>
    );
  };

  // ─── RENDER ──────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <View style={styles.tabContainer}>
        {[
          { id: "overview", icon: "view-dashboard", label: t("overview") },
          {
            id: "sessions",
            icon: "format-list-bulleted",
            label: t("sessions"),
          },
          { id: "achievements", icon: "trophy", label: t("achievements") },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, selectedTab === tab.id && styles.activeTab]}
            onPress={() => setSelectedTab(tab.id)}
          >
            <MaterialCommunityIcons
              name={tab.icon}
              size={24}
              color={selectedTab === tab.id ? "#6366f1" : "#94a3b8"}
            />
            <Text
              style={[
                styles.tabText,
                selectedTab === tab.id && styles.activeTabText,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.topBannerContainer}>
        <ABanner />
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {selectedTab === "overview" && renderOverviewTab()}
        {selectedTab === "sessions" && renderSessionsTab()}
        {selectedTab === "achievements" && renderAchievementsTab()}
        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
};

export default Statistics;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#fff",
    paddingHorizontal: 10,
    paddingTop: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 3,
    borderBottomColor: "transparent",
  },
  activeTab: { borderBottomColor: "#6366f1" },
  tabText: { fontSize: 12, color: "#94a3b8", fontWeight: "600", marginTop: 4 },
  activeTabText: { color: "#6366f1" },
  topBannerContainer: {
    width: "100%",
    alignItems: "center",
    paddingVertical: 8,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  scrollView: { flex: 1, padding: 20 },

  // Stats grid
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  statBox: {
    width: "48%",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1e293b",
    marginTop: 8,
  },
  statLabel: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "600",
    marginTop: 4,
  },

  // Coverage card
  coverageCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  coverageHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  coverageTitle: { fontSize: 18, fontWeight: "700", color: "#1e293b" },
  coverageBigRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    marginBottom: 12,
  },
  coverageBigNumber: { fontSize: 48, fontWeight: "800", color: "#6366f1" },
  coverageBigDivider: { fontSize: 28, color: "#94a3b8", marginHorizontal: 8 },
  coverageBigTotal: { fontSize: 28, fontWeight: "600", color: "#64748b" },
  coverageBarBg: {
    height: 10,
    backgroundColor: "#e2e8f0",
    borderRadius: 5,
    overflow: "hidden",
    marginBottom: 8,
  },
  coverageBarFill: {
    height: "100%",
    backgroundColor: "#6366f1",
    borderRadius: 5,
  },
  coverageSubtext: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
    marginBottom: 16,
  },
  levelBreakdown: { gap: 10 },
  levelRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  levelTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    minWidth: 32,
    alignItems: "center",
  },
  levelTagText: { fontSize: 11, fontWeight: "700", color: "#fff" },
  levelBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: "#e2e8f0",
    borderRadius: 4,
    overflow: "hidden",
  },
  levelBarFill: { height: "100%", borderRadius: 4 },
  levelCount: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "600",
    minWidth: 40,
    textAlign: "right",
  },

  // Chart
  chartCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 16,
  },
  chart: { marginVertical: 8, borderRadius: 16 },

  // Weak words
  weakWordsCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  weakWordItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  weakWordLeft: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  weakWordText: { fontSize: 15, fontWeight: "600", color: "#1e293b" },
  weakWordRight: { alignItems: "flex-end" },
  weakWordAccuracy: { fontSize: 16, fontWeight: "800" },
  weakWordSeen: { fontSize: 11, color: "#94a3b8" },

  // Section card titles
  sectionCardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 4,
  },
  sectionCardSubtitle: { fontSize: 13, color: "#64748b", marginBottom: 16 },

  // Failed words
  failedWordsCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  failedWordsList: { marginBottom: 16 },
  failedWordItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  failedWordHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  failedWordText: {
    fontSize: 15,
    color: "#1e293b",
    fontWeight: "600",
    flex: 1,
  },
  failedWordHint: { fontSize: 12, color: "#94a3b8", marginLeft: 28 },
  failCountBadge: {
    backgroundColor: "#fee2e2",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  failCountText: { fontSize: 11, fontWeight: "700", color: "#ef4444" },
  emptyFailedWords: { alignItems: "center", paddingVertical: 24 },
  emptyFailedWordsText: {
    fontSize: 13,
    color: "#94a3b8",
    marginTop: 12,
    textAlign: "center",
  },
  practiceButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#6366f1",
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 4,
  },
  practiceButtonText: { color: "#fff", fontSize: 15, fontWeight: "600" },

  // Sessions
  sectionTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1e293b",
    marginBottom: 20,
  },
  sessionCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sessionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sessionDateContainer: { flexDirection: "row", alignItems: "center", gap: 8 },
  sessionDate: { fontSize: 14, fontWeight: "700", color: "#1e293b" },
  sessionTime: { fontSize: 13, color: "#64748b" },
  scoreCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
  },
  scoreCircleText: { fontSize: 14, fontWeight: "800", color: "#fff" },
  sessionStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 8,
  },
  sessionStatItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  sessionStatText: { fontSize: 13, color: "#64748b", fontWeight: "600" },
  sessionStreak: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  sessionStreakText: { fontSize: 13, color: "#f97316", fontWeight: "600" },
  sessionAvgTime: { fontSize: 12, color: "#64748b", marginTop: 4 },
  emptyState: { alignItems: "center", paddingVertical: 60 },
  emptyText: {
    fontSize: 18,
    color: "#64748b",
    fontWeight: "600",
    marginTop: 16,
  },
  emptySubtext: { fontSize: 14, color: "#94a3b8", marginTop: 4 },

  // Achievements
  badgesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  badgeCard: {
    width: "48%",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  badgeLabel: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "600",
    marginTop: 8,
    textAlign: "center",
  },
  achievementProgressCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  achievementProgressTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 16,
  },
  progressItem: { marginBottom: 16 },
  progressItemLabel: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "600",
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: "#e2e8f0",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#6366f1",
    borderRadius: 4,
  },
  owlRankCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  owlRankHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  owlCircleSmall: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  owlEmojiLarge: { fontSize: 40 },
  rankBadgeSmall: {
    position: "absolute",
    bottom: -4,
    right: -4,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  rankEmojiSmall: { fontSize: 16 },
  owlRankInfo: { flex: 1 },
  owlRankTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1e293b",
    marginBottom: 4,
  },
  owlRankSubtitle: { fontSize: 14, color: "#64748b", fontWeight: "500" },
  achievementStatsGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#f1f5f9",
    marginBottom: 16,
  },
  achievementStatBox: { alignItems: "center", gap: 4 },
  achievementStatNumber: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1e293b",
    marginTop: 4,
  },
  achievementStatLabel: { fontSize: 11, color: "#64748b", fontWeight: "600" },
  nextRankSection: {
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 12,
  },
  nextRankHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  nextRankLabel: { fontSize: 13, fontWeight: "600", color: "#64748b" },
  nextRankQuizzes: { fontSize: 13, fontWeight: "700", color: "#6366f1" },
  nextRankProgressBar: {
    height: 8,
    backgroundColor: "#e2e8f0",
    borderRadius: 4,
    overflow: "hidden",
  },
  nextRankProgressFill: { height: "100%", borderRadius: 4 },
  emptyStateBadges: { alignItems: "center", paddingVertical: 40 },
});
