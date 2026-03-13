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

const db = openDatabaseSync("appdata.db");
const screenWidth = Dimensions.get("window").width;
const router = useRouter();

// Student Rank System (based on perfectScores)
const RANKS = [
  { minPerfect: 0, name: "Student", color: "#94a3b8", emoji: "📚" },
  { minPerfect: 1, name: "Scholar", color: "#60a5fa", emoji: "🎓" },
  { minPerfect: 3, name: "Bachelor", color: "#8b5cf6", emoji: "🎓⭐" },
  { minPerfect: 5, name: "Master", color: "#10b981", emoji: "🎓⭐⭐" },
  { minPerfect: 10, name: "Doctor", color: "#f59e0b", emoji: "🧪👨‍🔬" },
  { minPerfect: 20, name: "Professor", color: "#ef4444", emoji: "🦉👑" },
];

const Statistics = () => {
  const [stats, setStats] = useState([]);
  const [achievements, setAchievements] = useState(null);
  const [selectedTab, setSelectedTab] = useState("overview");
  const [pulseAnim] = useState(new Animated.Value(1));
  const [currentRank, setCurrentRank] = useState(RANKS[0]);
  const [nextRank, setNextRank] = useState(RANKS[1]);
  const [progressPercent, setProgressPercent] = useState(0);
  const [perfectsUntilNext, setPerfectsUntilNext] = useState(1);

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

  const loadData = async () => {
    try {
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
    let current = RANKS[0];
    let next = RANKS[1];

    for (let i = RANKS.length - 1; i >= 0; i--) {
      if ((perfectScores || 0) >= RANKS[i].minPerfect) {
        current = RANKS[i];
        next = RANKS[i + 1] || RANKS[i];
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

  // Get most failed words from database
  const [failedWords, setFailedWords] = useState([]);

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
      // First ensure table exists
      await ensureFailedWordsTable();

      // Then try to load data
      const words = await db.getAllAsync(
        `SELECT * FROM failed_words 
         WHERE failCount > 0
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
          <MaterialCommunityIcons
            name="book-open-variant"
            size={32}
            color="#f59e0b"
          />
          <Text style={styles.statNumber}>
            {achievements?.totalQuizzes || 0}
          </Text>
          <Text style={styles.statLabel}>Quizzes</Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: "#ecfdf5" }]}>
          <MaterialCommunityIcons name="fire" size={32} color="#ef4444" />
          <Text style={styles.statNumber}>
            {achievements?.consecutiveDays || 0}
          </Text>
          <Text style={styles.statLabel}>Day Streak</Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: "#fce7f3" }]}>
          <MaterialCommunityIcons name="percent" size={32} color="#ec4899" />
          <Text style={styles.statNumber}>{calculateAccuracy()}%</Text>
          <Text style={styles.statLabel}>Accuracy</Text>
        </View>
      </View>

      {getChartData() && (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>📈 Last 7 Sessions in %</Text>
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

      {/* Most Failed Words Card */}
      <View style={styles.failedWordsCard}>
        <Text style={styles.failedWordsTitle}>❌ Words to Practice</Text>
        <Text style={styles.failedWordsSubtitle}>
          Review these articles you've missed most
        </Text>

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
                  ✓ Correct: {item.correctArticle} {item.word}
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
                ? "Great! No failed words yet"
                : "Complete quizzes to see which words need practice"}
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.practiceButton}
          onPress={() => router.push("/practicefailedwords")}
        >
          <MaterialCommunityIcons name="school" size={20} color="#fff" />
          <Text style={styles.practiceButtonText}>Practice Failed Words</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderSessionsTab = () => (
    <View>
      <Text style={styles.sectionTitle}>📚 Session History</Text>
      {stats.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons
            name="clipboard-text-off"
            size={64}
            color="#cbd5e1"
          />
          <Text style={styles.emptyText}>No sessions yet.</Text>
          <Text style={styles.emptySubtext}>Start your first quiz!</Text>
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
                  {new Date(item.date).toLocaleDateString("en-US", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </Text>
                <Text style={styles.sessionTime}>
                  {new Date(item.date).toLocaleTimeString("en-US", {
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
                  {item.correctAnswers || 0} correct
                </Text>
              </View>
              <View style={styles.sessionStatItem}>
                <MaterialCommunityIcons
                  name="close-circle"
                  size={18}
                  color="#ef4444"
                />
                <Text style={styles.sessionStatText}>
                  {item.fails || 0} wrong
                </Text>
              </View>
              <View style={styles.sessionStatItem}>
                <MaterialCommunityIcons
                  name="clock-outline"
                  size={18}
                  color="#6366f1"
                />
                <Text style={styles.sessionStatText}>
                  {Math.round((item.sessionTime || 0) / 60)} min
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
                ⚡ Average: {item.avgTimePerQuestion}s per question
              </Text>
            )}
          </View>
        ))
      )}
    </View>
  );

  const renderAchievementsTab = () => {
    const badges = getAchievementBadges();
    return (
      <View>
        <Text style={styles.sectionTitle}>🏆 Achievements & Badges</Text>

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
                  {achievements.perfectScores || 0} Perfect Score
                  {achievements.perfectScores !== 1 ? "s" : ""}
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
                <Text style={styles.achievementStatLabel}>Correct</Text>
              </View>
              <View style={styles.achievementStatBox}>
                <MaterialCommunityIcons name="fire" size={24} color="#ef4444" />
                <Text style={styles.achievementStatNumber}>
                  {achievements.consecutiveDays}
                </Text>
                <Text style={styles.achievementStatLabel}>Day Streak</Text>
              </View>
              <View style={styles.achievementStatBox}>
                <MaterialCommunityIcons name="star" size={24} color="#fbbf24" />
                <Text style={styles.achievementStatNumber}>
                  {achievements.perfectScores}
                </Text>
                <Text style={styles.achievementStatLabel}>Perfect</Text>
              </View>
            </View>

            {perfectsUntilNext > 0 && (
              <View style={styles.nextRankSection}>
                <View style={styles.nextRankHeader}>
                  <Text style={styles.nextRankLabel}>
                    Next: {nextRank.name}
                  </Text>
                  <Text style={styles.nextRankQuizzes}>
                    {perfectsUntilNext} more perfect{" "}
                    {perfectsUntilNext === 1 ? "quiz" : "quizzes"}
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
            <Text style={styles.emptyText}>No badges yet.</Text>
            <Text style={styles.emptySubtext}>
              Play more quizzes to unlock achievements!
            </Text>
          </View>
        )}

        <View style={styles.achievementProgressCard}>
          <Text style={styles.achievementProgressTitle}>🎯 Next Goals</Text>
          <View style={styles.progressItem}>
            <Text style={styles.progressItemLabel}>
              Perfect Scores: {achievements?.perfectScores || 0} / 10
            </Text>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${
                      ((achievements?.perfectScores || 0) / 10) * 100
                    }%`,
                  },
                ]}
              />
            </View>
          </View>
          <View style={styles.progressItem}>
            <Text style={styles.progressItemLabel}>
              Quizzes: {achievements?.totalQuizzes || 0} / 50
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
              Correct Answers: {achievements?.totalCorrect || 0} / 500
            </Text>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${
                      ((achievements?.totalCorrect || 0) / 500) * 100
                    }%`,
                  },
                ]}
              />
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, selectedTab === "overview" && styles.activeTab]}
          onPress={() => setSelectedTab("overview")}
        >
          <MaterialCommunityIcons
            name="view-dashboard"
            size={24}
            color={selectedTab === "overview" ? "#6366f1" : "#94a3b8"}
          />
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
          style={[styles.tab, selectedTab === "sessions" && styles.activeTab]}
          onPress={() => setSelectedTab("sessions")}
        >
          <MaterialCommunityIcons
            name="format-list-bulleted"
            size={24}
            color={selectedTab === "sessions" ? "#6366f1" : "#94a3b8"}
          />
          <Text
            style={[
              styles.tabText,
              selectedTab === "sessions" && styles.activeTabText,
            ]}
          >
            Sessions
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            selectedTab === "achievements" && styles.activeTab,
          ]}
          onPress={() => setSelectedTab("achievements")}
        >
          <MaterialCommunityIcons
            name="trophy"
            size={24}
            color={selectedTab === "achievements" ? "#6366f1" : "#94a3b8"}
          />
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
    marginBottom: 20,
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
  emptyStatsBadges: { alignItems: "center", paddingVertical: 40 },
});
