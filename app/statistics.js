import React, { useEffect, useState, useCallback } from "react";
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
import { useRouter, useFocusEffect } from "expo-router";
import {
  getSubscriptionStatus,
  getAvailableRanks,
  hasFeatureAccess,
  FEATURES,
} from "./SubscriptionManager";

const db = openDatabaseSync("appdata.db");
const screenWidth = Dimensions.get("window").width;

// Student Rank System (based on perfectScores)
const RANKS = [
  { minPerfect: 0, name: "Student", color: "#94a3b8", emoji: "📚" },
  { minPerfect: 1, name: "Scholar", color: "#60a5fa", emoji: "🎓" },
  { minPerfect: 3, name: "Bachelor", color: "#8b5cf6", emoji: "🎓⭐" },
  { minPerfect: 5, name: "Master", color: "#10b981", emoji: "🎓⭐⭐" },
  { minPerfect: 10, name: "Doctor", color: "#f59e0b", emoji: "🧪" },
  { minPerfect: 20, name: "Professor", color: "#ef4444", emoji: "🦉" },
];

const Statistics = () => {
  const router = useRouter();
  const [stats, setStats] = useState([]);
  const [achievements, setAchievements] = useState(null);
  const [selectedTab, setSelectedTab] = useState("overview");
  const [pulseAnim] = useState(new Animated.Value(1));
  const [currentRank, setCurrentRank] = useState(RANKS[0]);
  const [nextRank, setNextRank] = useState(RANKS[1]);
  const [progressPercent, setProgressPercent] = useState(0);
  const [perfectsUntilNext, setPerfectsUntilNext] = useState(1);
  const [subscription, setSubscription] = useState(null);
  const [availableRanks, setAvailableRanks] = useState(RANKS);
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
    loadFailedWords();
  }, []);

  // Reload data whenever the screen comes into focus (user returns from trainer)
  useFocusEffect(
    useCallback(() => {
      loadData();
      loadFailedWords();
    }, []),
  );

  const loadData = async () => {
    try {
      // Load subscription status
      const subStatus = await getSubscriptionStatus();
      setSubscription(subStatus);

      // Get available ranks (includes premium ranks if subscribed)
      const ranks = await getAvailableRanks();
      setAvailableRanks(ranks);

      const tableInfo = await db.getAllAsync(`PRAGMA table_info(statistics)`);
      const hasNewColumns = tableInfo.some((col) => col.name === "bestStreak");

      if (!hasNewColumns && tableInfo.length > 0) {
        console.log("📦 Migrating statistics table...");
        await db.execAsync(`
          CREATE TABLE statistics_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            totalReviewed INTEGER,
            correctAnswers INTEGER,
            fails INTEGER,
            progressPercent REAL,
            sessionTime INTEGER,
            bestStreak INTEGER DEFAULT 0,
            avgTimePerQuestion INTEGER DEFAULT 0,
            fastestQuestion INTEGER DEFAULT 0,
            slowestQuestion INTEGER DEFAULT 0
          );
        `);
        await db.execAsync(`
          INSERT INTO statistics_new (id, date, totalReviewed, correctAnswers, fails, progressPercent, sessionTime)
          SELECT id, date, totalReviewed, correctAnswers, fails, progressPercent, sessionTime
          FROM statistics;
        `);
        await db.execAsync(`DROP TABLE statistics;`);
        await db.execAsync(`ALTER TABLE statistics_new RENAME TO statistics;`);
        console.log("✅ Statistics table migrated");
      } else if (tableInfo.length === 0) {
        await db.execAsync(`
          CREATE TABLE statistics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            totalReviewed INTEGER,
            correctAnswers INTEGER,
            fails INTEGER,
            progressPercent REAL,
            sessionTime INTEGER,
            bestStreak INTEGER DEFAULT 0,
            avgTimePerQuestion INTEGER DEFAULT 0,
            fastestQuestion INTEGER DEFAULT 0,
            slowestQuestion INTEGER DEFAULT 0
          );
        `);
      }

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

      const rows = await db.getAllAsync(
        "SELECT * FROM statistics ORDER BY date DESC LIMIT 20",
      );
      setStats(rows);

      const achievementRow = await db.getFirstAsync(
        "SELECT * FROM achievements WHERE userId = 'default'",
      );
      setAchievements(achievementRow);

      if (achievementRow) {
        calculateRank(achievementRow.perfectScores || 0);
      }
    } catch (error) {
      console.error("DB Error:", error);
    }
  };

  const calculateRank = (perfectScores) => {
    let current = availableRanks[0];
    let next = availableRanks[1];

    for (let i = availableRanks.length - 1; i >= 0; i--) {
      if ((perfectScores || 0) >= availableRanks[i].minPerfect) {
        current = availableRanks[i];
        next = availableRanks[i + 1] || availableRanks[i];
        break;
      }
    }

    setCurrentRank(current);
    setNextRank(next);

    if (next && next.name !== current.name) {
      const inCurrent = (perfectScores || 0) - current.minPerfect;
      const needed = next.minPerfect - current.minPerfect;
      const percent = needed > 0 ? (inCurrent / needed) * 100 : 100;
      setProgressPercent(percent);
      setPerfectsUntilNext(next.minPerfect - (perfectScores || 0));
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

  const getAchievementBadges = () => {
    if (!achievements) return [];
    const badges = [];

    if (achievements.perfectScores >= 10) {
      badges.push({
        icon: "trophy-award",
        color: "#fbbf24",
        label: "10 Perfect Scores",
      });
    } else if (achievements.perfectScores >= 5) {
      badges.push({
        icon: "trophy",
        color: "#f59e0b",
        label: "5 Perfect Scores",
      });
    }

    if (achievements.consecutiveDays >= 7) {
      badges.push({
        icon: "fire",
        color: "#ef4444",
        label: `${achievements.consecutiveDays} Day Streak`,
      });
    }

    if (achievements.longestStreak >= 15) {
      badges.push({
        icon: "chart-line",
        color: "#10b981",
        label: `Max Streak: ${achievements.longestStreak}`,
      });
    }

    if (achievements.totalQuizzes >= 50) {
      badges.push({
        icon: "book-multiple",
        color: "#8b5cf6",
        label: "50+ Quizzes",
      });
    }

    if (achievements.totalCorrect >= 500) {
      badges.push({ icon: "star", color: "#06b6d4", label: "500+ Correct" });
    }

    return badges;
  };

  const getChartData = () => {
    if (stats.length === 0) return null;
    const recentStats = stats.slice(0, 7).reverse();
    return {
      labels: recentStats.map((_, index) => `${index + 1}`),
      datasets: [
        {
          data: recentStats.map((s) => parseFloat(s.progressPercent) || 0),
          color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`,
          strokeWidth: 3,
        },
      ],
    };
  };

  const ensureFailedWordsTable = async () => {
    try {
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
    } catch (error) {
      console.error("ensureFailedWordsTable error:", error);
    }
  };

  const loadFailedWords = async () => {
    try {
      await ensureFailedWordsTable();
      const words = await db.getAllAsync(
        `SELECT * FROM failed_words 
         ORDER BY failCount DESC, lastFailed DESC 
         LIMIT 5`,
      );
      setFailedWords(words || []);
    } catch (error) {
      console.error("loadFailedWords error:", error);
      setFailedWords([]);
    }
  };

  const renderOverviewTab = () => (
    <View>
      {/* FREE USER PREMIUM BANNER */}
      {!subscription?.isPremium && !subscription?.isInTrial && (
        <TouchableOpacity
          style={{
            backgroundColor: "#6366f1",
            padding: 20,
            borderRadius: 16,
            marginBottom: 20,
            flexDirection: "row",
            alignItems: "center",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 12,
            elevation: 5,
          }}
          onPress={() => router.push("/SubscriptionScreen")}
        >
          <MaterialCommunityIcons name="crown" size={32} color="#fbbf24" />
          <View style={{ flex: 1, marginLeft: 16 }}>
            <Text
              style={{
                fontSize: 16,
                fontWeight: "700",
                color: "#fff",
                marginBottom: 4,
              }}
            >
              Unlock Premium Features
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: "#e0e7ff",
              }}
            >
              Unlimited quizzes, advanced stats & more!
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color="#fff" />
        </TouchableOpacity>
      )}

      {/* TRIAL BANNER */}
      {subscription?.isInTrial && (
        <View
          style={{
            backgroundColor: "#fef3c7",
            padding: 16,
            borderRadius: 12,
            marginBottom: 20,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
          }}
        >
          <MaterialCommunityIcons name="timer-sand" size={24} color="#f59e0b" />
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 14,
                fontWeight: "600",
                color: "#92400e",
              }}
            >
              Free Trial Active
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: "#92400e",
              }}
            >
              {subscription.daysLeftInTrial} days left - Subscribe to keep
              premium access
            </Text>
          </View>
          <TouchableOpacity onPress={() => router.push("/SubscriptionScreen")}>
            <MaterialCommunityIcons
              name="chevron-right"
              size={24}
              color="#92400e"
            />
          </TouchableOpacity>
        </View>
      )}

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
          <Text style={styles.statLabel}>Correct</Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: "#fef3c7" }]}>
          <MaterialCommunityIcons name="target" size={32} color="#f59e0b" />
          <Text style={styles.statNumber}>{calculateAccuracy()}%</Text>
          <Text style={styles.statLabel}>Accuracy</Text>
        </View>
      </View>

      <View style={styles.statsGrid}>
        <View style={[styles.statBox, { backgroundColor: "#ecfccb" }]}>
          <MaterialCommunityIcons name="trophy" size={32} color="#84cc16" />
          <Text style={styles.statNumber}>
            {achievements?.perfectScores || 0}
          </Text>
          <Text style={styles.statLabel}>Perfect</Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: "#fce7f3" }]}>
          <MaterialCommunityIcons name="fire" size={32} color="#ec4899" />
          <Text style={styles.statNumber}>
            {achievements?.consecutiveDays || 0}
          </Text>
          <Text style={styles.statLabel}>Day Streak</Text>
        </View>
      </View>

      {/* Owl Rank Card */}
      <View style={styles.owlRankCard}>
        <View style={styles.owlRankHeader}>
          <View
            style={[
              styles.owlCircleSmall,
              { backgroundColor: currentRank.color },
            ]}
          >
            <Text style={styles.owlEmojiLarge}>{currentRank.emoji}</Text>
            <View style={styles.rankBadgeSmall}>
              <Text style={styles.rankEmojiSmall}>🏅</Text>
            </View>
          </View>
          <View style={styles.owlRankInfo}>
            <Text style={styles.owlRankTitle}>{currentRank.name}</Text>
            <Text style={styles.owlRankSubtitle}>
              {achievements?.perfectScores || 0} Perfect Scores
            </Text>
          </View>
        </View>

        <View style={styles.achievementStatsGrid}>
          <View style={styles.achievementStatBox}>
            <MaterialCommunityIcons
              name="book-open-variant"
              size={20}
              color="#6366f1"
            />
            <Text style={styles.achievementStatNumber}>
              {achievements?.totalQuizzes || 0}
            </Text>
            <Text style={styles.achievementStatLabel}>Quizzes</Text>
          </View>
          <View style={styles.achievementStatBox}>
            <MaterialCommunityIcons
              name="chart-line"
              size={20}
              color="#10b981"
            />
            <Text style={styles.achievementStatNumber}>
              {achievements?.longestStreak || 0}
            </Text>
            <Text style={styles.achievementStatLabel}>Best Streak</Text>
          </View>
          <View style={styles.achievementStatBox}>
            <MaterialCommunityIcons
              name="clock-fast"
              size={20}
              color="#f59e0b"
            />
            <Text style={styles.achievementStatNumber}>
              {achievements?.fastestTime
                ? `${Math.floor(achievements.fastestTime / 60)}'${(achievements.fastestTime % 60).toString().padStart(2, "0")}"`
                : "N/A"}
            </Text>
            <Text style={styles.achievementStatLabel}>Fastest</Text>
          </View>
        </View>

        {nextRank && nextRank.name !== currentRank.name && (
          <View style={styles.nextRankSection}>
            <View style={styles.nextRankHeader}>
              <Text style={styles.nextRankLabel}>
                Next: {nextRank.emoji} {nextRank.name}
              </Text>
              <Text style={styles.nextRankQuizzes}>
                {perfectsUntilNext} perfect{" "}
                {perfectsUntilNext === 1 ? "quiz" : "quizzes"} away
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

      {/* Failed Words Card */}
      <View style={styles.failedWordsCard}>
        <Text style={styles.failedWordsTitle}>Words to Practice</Text>
        <Text style={styles.failedWordsSubtitle}>
          Your most challenging words
        </Text>

        {failedWords.length > 0 ? (
          <>
            <View style={styles.failedWordsList}>
              {failedWords.map((item, index) => (
                <View key={index} style={styles.failedWordItem}>
                  <View style={styles.failedWordHeader}>
                    <Text style={styles.failedWordText}>
                      {item.correctArticle} {item.word}
                    </Text>
                    <View style={styles.failCountBadge}>
                      <Text style={styles.failCountText}>
                        {item.failCount}×
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.failedWordHint}>
                    Often confused with: {item.wrongArticle}
                  </Text>
                </View>
              ))}
            </View>
            <TouchableOpacity
              style={styles.practiceButton}
              onPress={() => router.push("/PracticeFailedWords")}
            >
              <MaterialCommunityIcons name="school" size={16} color="#fff" />
              <Text style={styles.practiceButtonText}>
                Practice These Words
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.emptyFailedWords}>
            <MaterialCommunityIcons
              name="check-circle"
              size={48}
              color="#10b981"
            />
            <Text style={styles.emptyFailedWordsText}>
              Great job! No failed words yet.
              {"\n"}Keep up the excellent work!
            </Text>
          </View>
        )}
      </View>

      {/* Progress Chart */}
      {stats.length > 0 && getChartData() && (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Last 7 Sessions</Text>
          <LineChart
            data={getChartData()}
            width={screenWidth - 64}
            height={200}
            chartConfig={{
              backgroundColor: "#fff",
              backgroundGradientFrom: "#fff",
              backgroundGradientTo: "#fff",
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`,
              style: { borderRadius: 16 },
              propsForDots: {
                r: "6",
                strokeWidth: "2",
                stroke: "#6366f1",
              },
            }}
            bezier
            style={styles.chart}
          />
        </View>
      )}
    </View>
  );

  const renderHistoryTab = () => (
    <View>
      <Text style={styles.sectionTitle}>Session History</Text>

      {subscription?.isPremium || subscription?.isInTrial ? (
        // PREMIUM VERSION - Detailed Stats
        stats.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons
              name="chart-line-variant"
              size={64}
              color="#cbd5e1"
            />
            <Text style={styles.emptyText}>No sessions yet</Text>
            <Text style={styles.emptySubtext}>
              Complete your first quiz to see statistics!
            </Text>
          </View>
        ) : (
          stats.map((session, index) => {
            const date = new Date(session.date);
            const scorePercent = session.progressPercent || 0;
            const isPerfect = session.correctAnswers === session.totalReviewed;

            return (
              <View key={index} style={styles.sessionCard}>
                <View style={styles.sessionHeader}>
                  <View style={styles.sessionDateContainer}>
                    <MaterialCommunityIcons
                      name="calendar"
                      size={16}
                      color="#64748b"
                    />
                    <Text style={styles.sessionDate}>
                      {date.toLocaleDateString("de-DE")}
                    </Text>
                    <Text style={styles.sessionTime}>
                      {date.toLocaleTimeString("de-DE", {
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
                          scorePercent >= 90
                            ? "#10b981"
                            : scorePercent >= 70
                              ? "#f59e0b"
                              : "#6366f1",
                      },
                    ]}
                  >
                    <Text style={styles.scoreCircleText}>
                      {scorePercent.toFixed(0)}%
                    </Text>
                  </View>
                </View>

                <View style={styles.sessionStats}>
                  <View style={styles.sessionStatItem}>
                    <MaterialCommunityIcons
                      name="check-circle"
                      size={16}
                      color="#10b981"
                    />
                    <Text style={styles.sessionStatText}>
                      {session.correctAnswers}/{session.totalReviewed}
                    </Text>
                  </View>
                  <View style={styles.sessionStatItem}>
                    <MaterialCommunityIcons
                      name="close-circle"
                      size={16}
                      color="#ef4444"
                    />
                    <Text style={styles.sessionStatText}>
                      {session.fails} fails
                    </Text>
                  </View>
                  <View style={styles.sessionStatItem}>
                    <MaterialCommunityIcons
                      name="clock-outline"
                      size={16}
                      color="#6366f1"
                    />
                    <Text style={styles.sessionStatText}>
                      {Math.floor(session.sessionTime / 60)}:
                      {(session.sessionTime % 60).toString().padStart(2, "0")}
                    </Text>
                  </View>
                </View>

                {session.bestStreak > 0 && (
                  <View style={styles.sessionStreak}>
                    <MaterialCommunityIcons
                      name="fire"
                      size={16}
                      color="#f97316"
                    />
                    <Text style={styles.sessionStreakText}>
                      Best Streak: {session.bestStreak}
                    </Text>
                  </View>
                )}

                {session.avgTimePerQuestion > 0 && (
                  <Text style={styles.sessionAvgTime}>
                    Avg: {session.avgTimePerQuestion}s/question • Fastest:{" "}
                    {session.fastestQuestion}s • Slowest:{" "}
                    {session.slowestQuestion}s
                  </Text>
                )}

                {isPerfect && (
                  <View style={styles.sessionStreak}>
                    <MaterialCommunityIcons
                      name="trophy-award"
                      size={16}
                      color="#fbbf24"
                    />
                    <Text
                      style={[styles.sessionStreakText, { color: "#fbbf24" }]}
                    >
                      Perfect Score!
                    </Text>
                  </View>
                )}
              </View>
            );
          })
        )
      ) : (
        // FREE VERSION - Simplified Stats
        <View>
          {stats.slice(0, 3).map((session, index) => (
            <View key={index} style={styles.sessionCard}>
              <View style={styles.sessionHeader}>
                <View style={styles.sessionDateContainer}>
                  <MaterialCommunityIcons
                    name="calendar"
                    size={16}
                    color="#64748b"
                  />
                  <Text style={styles.sessionDate}>
                    {new Date(session.date).toLocaleDateString("de-DE")}
                  </Text>
                </View>
                <View
                  style={[
                    styles.scoreCircle,
                    {
                      backgroundColor:
                        session.progressPercent >= 90
                          ? "#10b981"
                          : session.progressPercent >= 70
                            ? "#f59e0b"
                            : "#6366f1",
                    },
                  ]}
                >
                  <Text style={styles.scoreCircleText}>
                    {session.progressPercent?.toFixed(0)}%
                  </Text>
                </View>
              </View>

              <View style={styles.sessionStats}>
                <View style={styles.sessionStatItem}>
                  <MaterialCommunityIcons
                    name="check-circle"
                    size={16}
                    color="#10b981"
                  />
                  <Text style={styles.sessionStatText}>
                    {session.correctAnswers}/{session.totalReviewed}
                  </Text>
                </View>
              </View>
            </View>
          ))}

          {/* Premium Upsell */}
          <TouchableOpacity
            style={{
              backgroundColor: "#eef2ff",
              padding: 16,
              borderRadius: 12,
              marginTop: 12,
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "center",
              gap: 8,
            }}
            onPress={() => router.push("/SubscriptionScreen")}
          >
            <MaterialCommunityIcons name="crown" size={20} color="#6366f1" />
            <Text
              style={{
                fontSize: 14,
                fontWeight: "600",
                color: "#6366f1",
              }}
            >
              Upgrade to see detailed analytics
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderAchievementsTab = () => (
    <View>
      {subscription?.isPremium && !subscription?.isInTrial && (
        <View
          style={{
            backgroundColor: "#fef3c7",
            padding: 16,
            borderRadius: 12,
            marginBottom: 20,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
          }}
        >
          <MaterialCommunityIcons name="crown" size={24} color="#f59e0b" />
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: "#92400e",
            }}
          >
            Premium Active - Access to Grand Master, Legend & Deity ranks!
          </Text>
        </View>
      )}

      <Text style={styles.sectionTitle}>Achievements</Text>

      {getAchievementBadges().length > 0 ? (
        <View style={styles.badgesGrid}>
          {getAchievementBadges().map((badge, index) => (
            <View key={index} style={styles.badgeCard}>
              <MaterialCommunityIcons
                name={badge.icon}
                size={48}
                color={badge.color}
              />
              <Text style={styles.badgeLabel}>{badge.label}</Text>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.emptyStatsBadges}>
          <MaterialCommunityIcons
            name="trophy-outline"
            size={64}
            color="#cbd5e1"
          />
          <Text style={styles.emptyText}>No achievements yet</Text>
          <Text style={styles.emptySubtext}>
            Keep practicing to unlock badges!
          </Text>
        </View>
      )}

      {/* Achievement Progress */}
      <View style={styles.achievementProgressCard}>
        <Text style={styles.achievementProgressTitle}>
          Achievement Progress
        </Text>

        <View style={styles.progressItem}>
          <Text style={styles.progressItemLabel}>
            🎯 First Perfect Score (
            {achievements?.perfectScores >= 1 ? "✓" : "0/1"})
          </Text>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${Math.min(
                    ((achievements?.perfectScores || 0) / 1) * 100,
                    100,
                  )}%`,
                },
              ]}
            />
          </View>
        </View>

        <View style={styles.progressItem}>
          <Text style={styles.progressItemLabel}>
            🌟 5 Perfect Scores (
            {achievements?.perfectScores >= 5
              ? "✓"
              : `${achievements?.perfectScores || 0}/5`}
            )
          </Text>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${Math.min(
                    ((achievements?.perfectScores || 0) / 5) * 100,
                    100,
                  )}%`,
                },
              ]}
            />
          </View>
        </View>

        <View style={styles.progressItem}>
          <Text style={styles.progressItemLabel}>
            🔥 7 Day Streak (
            {achievements?.consecutiveDays >= 7
              ? "✓"
              : `${achievements?.consecutiveDays || 0}/7`}
            )
          </Text>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${Math.min(
                    ((achievements?.consecutiveDays || 0) / 7) * 100,
                    100,
                  )}%`,
                },
              ]}
            />
          </View>
        </View>

        <View style={styles.progressItem}>
          <Text style={styles.progressItemLabel}>
            📚 50 Quizzes (
            {achievements?.totalQuizzes >= 50
              ? "✓"
              : `${achievements?.totalQuizzes || 0}/50`}
            )
          </Text>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${Math.min(
                    ((achievements?.totalQuizzes || 0) / 50) * 100,
                    100,
                  )}%`,
                },
              ]}
            />
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, selectedTab === "overview" && styles.activeTab]}
          onPress={() => setSelectedTab("overview")}
        >
          <Text
            style={[
              styles.tabText,
              selectedTab === "overview" && styles.activeTabText,
            ]}
          >
            Overview
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === "history" && styles.activeTab]}
          onPress={() => setSelectedTab("history")}
        >
          <Text
            style={[
              styles.tabText,
              selectedTab === "history" && styles.activeTabText,
            ]}
          >
            History
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            selectedTab === "achievements" && styles.activeTab,
          ]}
          onPress={() => setSelectedTab("achievements")}
        >
          <Text
            style={[
              styles.tabText,
              selectedTab === "achievements" && styles.activeTabText,
            ]}
          >
            Achievements
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {selectedTab === "overview" && renderOverviewTab()}
        {selectedTab === "history" && renderHistoryTab()}
        {selectedTab === "achievements" && renderAchievementsTab()}

        {!subscription?.isPremium && !subscription?.isInTrial && (
          <View style={{ marginTop: 20, marginBottom: 10 }}>
            <ABanner />
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingTop: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: "center",
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: "#6366f1",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748b",
  },
  activeTabText: {
    color: "#6366f1",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  statsGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  statBox: {
    flex: 1,
    padding: 20,
    borderRadius: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1e293b",
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "600",
    marginTop: 4,
  },
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
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
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
  failedWordsTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 4,
  },
  failedWordsSubtitle: {
    fontSize: 13,
    color: "#64748b",
    marginBottom: 16,
  },
  failedWordsList: {
    marginBottom: 16,
  },
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
  failedWordHint: {
    fontSize: 12,
    color: "#94a3b8",
    marginLeft: 28,
  },
  failCountBadge: {
    backgroundColor: "#fee2e2",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: "auto",
  },
  failCountText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#ef4444",
  },
  emptyFailedWords: {
    alignItems: "center",
    paddingVertical: 24,
  },
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
  },
  practiceButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
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
    position: "relative",
  },
  owlEmojiLarge: { fontSize: 40 },
  rankBadgeSmall: {
    position: "absolute",
    bottom: -2,
    right: -2,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 3,
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  rankEmojiSmall: { fontSize: 14 },
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
  emptyStatsBadges: { alignItems: "center", paddingVertical: 40 },
});

export default Statistics;
