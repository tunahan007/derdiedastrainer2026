import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  ScrollView,
  Animated,
  Modal,
  Alert,
} from "react-native";
import { FontAwesome, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Speech from "expo-speech";
import { openDatabaseSync } from "expo-sqlite";
import ABanner from "./banner";
import { OwlEmoji } from "./images/OwlIcon";
import { quizMainData } from "./words";
import { useTranslation } from "react-i18next";
import LanguageSelector from "./LanguageSelector";

const db = openDatabaseSync("appdata.db");
// WAL mode: prevents "database is locked" errors with concurrent operations
try {
  db.execSync("PRAGMA journal_mode=WAL;");
} catch (e) {}

const RANKS = [
  { minPerfect: 0, name: "Student", color: "#94a3b8", emoji: "📚" },
  { minPerfect: 1, name: "Scholar", color: "#60a5fa", emoji: "🎓" },
  { minPerfect: 3, name: "Bachelor", color: "#8b5cf6", emoji: "🎓⭐" },
  { minPerfect: 5, name: "Master", color: "#10b981", emoji: "🎓⭐⭐" },
  { minPerfect: 10, name: "Doctor", color: "#f59e0b", emoji: "🧪👨‍🔬" },
  { minPerfect: 20, name: "Professor", color: "#ef4444", emoji: "🦉👑" },
  { minPerfect: 35, name: "Dean", color: "#ec4899", emoji: "🏛️👑" },
  { minPerfect: 50, name: "Rector", color: "#8b5cf6", emoji: "🎖️🦉" },
  { minPerfect: 75, name: "Academy Fellow", color: "#f97316", emoji: "🌟🎓" },
  { minPerfect: 100, name: "Grandmaster", color: "#6366f1", emoji: "💎👑" },
];

const ACHIEVEMENTS = [
  {
    id: "achievementFirstStar",
    icon: "star",
    color: "#fbbf24",
    label: "⭐ First Star",
    requirement: 1,
  },
  {
    id: "achievementGoldenStudent",
    icon: "trophy",
    color: "#f59e0b",
    label: "🏅 Golden Student",
    requirement: 5,
  },
  {
    id: "achievementDoctoralAward",
    icon: "medal",
    color: "#8b5cf6",
    label: "🎖 Doctoral Award",
    requirement: 10,
  },
  {
    id: "achievementProfessorBadge",
    icon: "crown",
    color: "#ef4444",
    label: "👑 Professor Badge",
    requirement: 20,
  },
];

// Level config — counts derived from words.js
const LEVELS = ["Alle", "A1", "A2", "B1"];
const LEVEL_COLORS = {
  Alle: "#007AFF",
  A1: "#10b981",
  A2: "#3b82f6",
  B1: "#8b5cf6",
};

// Count words per level from words.js at startup
const WORD_COUNTS = quizMainData.reduce(
  (acc, w) => {
    const lvl = w.l || "A1";
    acc[lvl] = (acc[lvl] || 0) + 1;
    acc["Alle"] = (acc["Alle"] || 0) + 1;
    return acc;
  },
  { Alle: 0 },
);

export default function Page() {
  const router = useRouter();
  const progressAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const { t } = useTranslation();

  const [achievements, setAchievements] = useState(null);
  const [currentRank, setCurrentRank] = useState(RANKS[0]);
  const [nextRank, setNextRank] = useState(RANKS[1]);
  const [progressPercent, setProgressPercent] = useState(0);
  const [perfectsUntilNext, setPerfectsUntilNext] = useState(1);
  const [showRankPopup, setShowRankPopup] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [showCongratulations, setShowCongratulations] = useState(false);
  const [congratsRank, setCongratsRank] = useState(null);

  // ── Level Filter ─────────────────────────────────────────────────────────────
  const [selectedLevel, setSelectedLevel] = useState("Alle");

  useEffect(() => {
    // Run sequentially to avoid DB lock
    const initDB = async () => {
      await loadUserStats();
      await loadSavedLevel();
    };
    initDB();

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
  }, []);

  useEffect(() => {
    if (achievements) {
      Animated.timing(progressAnim, {
        toValue: progressPercent,
        duration: 800,
        useNativeDriver: false,
      }).start();
    }
  }, [progressPercent, achievements]);

  const loadSavedLevel = async () => {
    try {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS user_prefs (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
      `);
      const row = await db.getFirstAsync(
        `SELECT value FROM user_prefs WHERE key = 'selectedLevel'`,
      );
      if (row && LEVELS.includes(row.value)) {
        setSelectedLevel(row.value);
      }
    } catch (e) {
      console.error("loadSavedLevel error:", e);
    }
  };

  const handleLevelSelect = async (level) => {
    setSelectedLevel(level);
    try {
      await db.runAsync(
        `INSERT OR REPLACE INTO user_prefs (key, value) VALUES ('selectedLevel', ?)`,
        [level],
      );
    } catch (e) {
      console.error("saveLevel error:", e);
    }
  };

  // ── DB ───────────────────────────────────────────────────────────────────────

  const ensureTables = async () => {
    try {
      const achTableInfo = await db.getAllAsync(
        `PRAGMA table_info(achievements)`,
      );
      if (achTableInfo.length === 0) {
        await db.execAsync(`
          CREATE TABLE achievements (
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
            fastestTime INTEGER DEFAULT 0,
            tutorialCompleted INTEGER DEFAULT 0
          );
        `);
      } else {
        const cols = achTableInfo.map((c) => c.name);
        if (!cols.includes("tutorialCompleted"))
          await db.execAsync(
            `ALTER TABLE achievements ADD COLUMN tutorialCompleted INTEGER DEFAULT 0;`,
          );
      }
    } catch (err) {
      console.error("ensureTables error:", err);
    }
  };

  const loadUserStats = async () => {
    try {
      await ensureTables();
      const row = await db.getFirstAsync(
        "SELECT * FROM achievements WHERE userId='default'",
      );
      if (!row) {
        await db.execAsync(`
          INSERT INTO achievements (userId, lastPlayedDate, tutorialCompleted)
          VALUES ('default', '${new Date().toISOString()}', 0);
        `);
        const created = await db.getFirstAsync(
          "SELECT * FROM achievements WHERE userId='default'",
        );
        setAchievements(created);
        calculateRank(created.perfectScores || 0);
        setShowTutorial(true);
      } else {
        setAchievements(row);
        calculateRank(row.perfectScores || 0);
        if (row.tutorialCompleted === 0) setShowTutorial(true);
      }
    } catch (err) {
      console.error("loadUserStats error:", err);
    }
  };

  const completeTutorial = async () => {
    setShowTutorial(false);
    setTutorialStep(0);
    // Small delay to let any pending DB ops finish before writing
    setTimeout(async () => {
      try {
        await db.runAsync(
          `UPDATE achievements SET tutorialCompleted = 1 WHERE userId='default'`,
        );
      } catch (err) {
        console.error("completeTutorial error:", err);
        // Retry once after short delay
        setTimeout(async () => {
          try {
            await db.runAsync(
              `UPDATE achievements SET tutorialCompleted = 1 WHERE userId='default'`,
            );
          } catch (e) {
            console.error("completeTutorial retry failed:", e);
          }
        }, 1000);
      }
    }, 300);
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
    if (
      achievements &&
      current.name !== currentRank.name &&
      currentRank.name !== "Student"
    ) {
      setCongratsRank(current);
      setShowCongratulations(true);
      triggerRankUp(current);
    }
    setCurrentRank(current);
    setNextRank(next);
    if (next && next.name !== current.name) {
      const inCurrent = (perfectScores || 0) - current.minPerfect;
      const needed = next.minPerfect - current.minPerfect;
      setProgressPercent(needed > 0 ? (inCurrent / needed) * 100 : 100);
      setPerfectsUntilNext(next.minPerfect - (perfectScores || 0));
    } else {
      setProgressPercent(100);
      setPerfectsUntilNext(0);
    }
  };

  const triggerRankUp = (newRank) => {
    setShowRankPopup(true);
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 1.1, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }),
    ]).start();
    try {
      Speech.speak(`Congratulations! You are now ${newRank.name}`, {
        language: "en",
      });
    } catch (e) {
      console.error("Speech error:", e);
    }
  };

  const getUnlockedAchievements = () => {
    if (!achievements) return [];
    return ACHIEVEMENTS.filter((ach) => achievements[ach.id] === 1);
  };

  const getLeaderboardEntries = () => {
    if (!achievements) return [];
    return [
      {
        label: "Perfect Quizzes",
        value: achievements.perfectScores || 0,
        icon: "star",
        color: "#fbbf24",
      },
      {
        label: "Highest Score",
        value: achievements.highestScore || 0,
        icon: "trophy",
        color: "#ef4444",
      },
      {
        label: "Day Streak",
        value: achievements.consecutiveDays || 0,
        icon: "fire",
        color: "#f97316",
      },
      {
        label: "Total Quizzes",
        value: achievements.totalQuizzes || 0,
        icon: "book",
        color: "#8b5cf6",
      },
      {
        label: "Total Correct",
        value: achievements.totalCorrect || 0,
        icon: "check-circle",
        color: "#10b981",
      },
    ];
  };

  const animatedWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ["0%", "100%"],
  });

  const tap = (callback) => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.98,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start(() => callback && callback());
  };

  const openPlayStore = () =>
    Linking.openURL(
      "https://play.google.com/store/apps/details?id=com.tunakhan007.derdiedastrainer&pcampaignid=web_share",
    );
  const openPlayStoreApps = () =>
    Linking.openURL(
      "https://play.google.com/store/apps/developer?id=FocusSoftware",
    );
  const speakWord = () => {
    try {
      Speech.speak("Hello! Welcome to Artikel Trainer", { language: "en" });
    } catch (e) {}
  };

  // Start quiz — pass selectedLevel as param
  const startQuiz = () => {
    router.push({ pathname: "/trainer", params: { level: selectedLevel } });
  };

  const GridButton = ({ icon, title, onPress, badge }) => (
    <Animated.View style={{ width: "48%", transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={styles.gridButton}
        onPress={() => tap(onPress)}
        activeOpacity={0.9}
      >
        <View style={styles.gridButtonContent}>
          <FontAwesome name={icon} size={24} color="#FFFFFF" />
          <Text style={styles.gridButtonText}>{title}</Text>
          {badge && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

  const TUTORIAL_STEPS = [
    {
      title: t("tutorialWelcomeTitle"),
      description: t("tutorialWelcomeDesc"),
      icon: "rocket",
      color: "#007AFF",
    },
    {
      title: t("tutorialPerfectTitle"),
      description: t("tutorialPerfectDesc"),
      icon: "star",
      color: "#fbbf24",
    },
    {
      title: t("tutorialRankTitle"),
      description: t("tutorialRankDesc"),
      icon: "trophy",
      color: "#f59e0b",
    },
    {
      title: t("tutorialStreakTitle"),
      description: t("tutorialStreakDesc"),
      icon: "fire",
      color: "#f97316",
    },
    {
      title: t("tutorialLevelTitle"),
      description: t("tutorialLevelDesc"),
      icon: "filter",
      color: "#8b5cf6",
    },
    {
      title: t("tutorialReadyTitle"),
      description: t("tutorialReadyDesc"),
      icon: "play-circle",
      color: "#34C759",
    },
  ];

  const nextTutorialStep = () => {
    if (tutorialStep < TUTORIAL_STEPS.length - 1)
      setTutorialStep(tutorialStep + 1);
    else completeTutorial();
  };

  // ── RENDER ───────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Header with Owl + Language Selector */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={{ flex: 1 }} />
            <LanguageSelector />
          </View>
          <TouchableOpacity onPress={speakWord} style={styles.owlContainer}>
            <Animated.View
              style={[styles.owlPulse, { transform: [{ scale: pulseAnim }] }]}
            />
            <View
              style={[styles.owlCircle, { backgroundColor: currentRank.color }]}
            >
              <OwlEmoji size={60} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Stats Row */}
        {achievements && (
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <MaterialCommunityIcons name="star" size={20} color="#fbbf24" />
              <Text style={styles.statValue}>
                {achievements.perfectScores || 0}
              </Text>
              <Text style={styles.statLabel}>{t("perfect")}</Text>
            </View>
            <View style={styles.statBox}>
              <MaterialCommunityIcons name="fire" size={20} color="#f97316" />
              <Text style={styles.statValue}>
                {achievements.consecutiveDays || 0}
              </Text>
              <Text style={styles.statLabel}>{t("streak")}</Text>
            </View>
            <View style={styles.statBox}>
              <MaterialCommunityIcons name="trophy" size={20} color="#ef4444" />
              <Text style={styles.statValue}>
                {achievements.highestScore || 0}
              </Text>
              <Text style={styles.statLabel}>{t("best")}</Text>
            </View>
          </View>
        )}

        {/* Rank Progress Card */}
        {achievements && (
          <View style={styles.rankCard}>
            <View style={styles.rankHeader}>
              <Text style={styles.rankEmoji}>{currentRank.emoji}</Text>
              <View style={styles.rankInfo}>
                <Text style={styles.rankTitle}>{currentRank.name}</Text>
                {perfectsUntilNext > 0 && (
                  <Text style={styles.nextRankLabel}>→ {nextRank.name}</Text>
                )}
              </View>
              <TouchableOpacity
                onPress={() => setShowTutorial(true)}
                style={styles.helpButton}
              >
                <MaterialCommunityIcons
                  name="help-circle-outline"
                  size={24}
                  color="#007AFF"
                />
              </TouchableOpacity>
            </View>

            {perfectsUntilNext > 0 ? (
              <>
                <View style={styles.progressSection}>
                  <View style={styles.progressHeader}>
                    <Text style={styles.progressLabel}>
                      {t("progressTo", { rank: nextRank.name })}
                    </Text>
                    <Text style={styles.quizzesLeft}>
                      {t("moreToGo", { n: perfectsUntilNext })}
                    </Text>
                  </View>
                  <View style={styles.progressBarContainer}>
                    <Animated.View
                      style={[
                        styles.progressBar,
                        {
                          width: animatedWidth,
                          backgroundColor: currentRank.color,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.progressText}>
                    {progressPercent.toFixed(0)}%
                  </Text>
                </View>
                <View style={styles.reminderChip}>
                  <MaterialCommunityIcons
                    name="lightbulb-on-outline"
                    size={16}
                    color="#f59e0b"
                  />
                  <Text style={styles.reminderText}>
                    {t("getPerfectScores", {
                      n: perfectsUntilNext,
                      rank: nextRank.name,
                    })}
                  </Text>
                </View>
              </>
            ) : (
              <Text style={styles.maxRankText}>🎉 {t("maxRankAchieved")}</Text>
            )}
          </View>
        )}

        {/* ── LEVEL FILTER CARD ─────────────────────────────────────────────── */}
        <View style={styles.levelCard}>
          <View style={styles.levelCardHeader}>
            <MaterialCommunityIcons
              name="filter-variant"
              size={20}
              color="#1C1C1E"
            />
            <Text style={styles.levelCardTitle}>{t("selectLevel")}</Text>
            <View
              style={[
                styles.levelActiveBadge,
                { backgroundColor: LEVEL_COLORS[selectedLevel] },
              ]}
            >
              <Text style={styles.levelActiveBadgeText}>
                {selectedLevel === "Alle" ? t("allLabel") : selectedLevel}
              </Text>
            </View>
          </View>

          <View style={styles.levelButtonRow}>
            {LEVELS.map((level) => {
              const isSelected = selectedLevel === level;
              const count = WORD_COUNTS[level] || 0;
              return (
                <TouchableOpacity
                  key={level}
                  style={[
                    styles.levelButton,
                    isSelected && {
                      backgroundColor: LEVEL_COLORS[level],
                      borderColor: LEVEL_COLORS[level],
                    },
                  ]}
                  onPress={() => handleLevelSelect(level)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.levelButtonLabel,
                      isSelected && styles.levelButtonLabelActive,
                    ]}
                  >
                    {level === "Alle" ? t("allLabel") : level}
                  </Text>
                  <Text
                    style={[
                      styles.levelButtonCount,
                      isSelected && styles.levelButtonCountActive,
                    ]}
                  >
                    {WORD_COUNTS[level]} {t("words")}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.levelDescription}>
            {selectedLevel === "Alle"
              ? t("allWords")
              : selectedLevel === "A1"
                ? t("basicVocab")
                : selectedLevel === "A2"
                  ? t("intermediate")
                  : t("upperIntermediate")}
          </Text>
        </View>
        {/* ──────────────────────────────────────────────────────────────────── */}

        {/* Unlocked Achievements */}
        {getUnlockedAchievements().length > 0 && (
          <View style={styles.achievementsRow}>
            <Text style={styles.sectionTitle}>{t("achievements")}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.achievementsScroll}
            >
              {getUnlockedAchievements().map((ach, idx) => (
                <View key={idx} style={styles.achievementBadge}>
                  <Text style={styles.achievementBadgeText}>{ach.label}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Grid Buttons */}
        <View style={styles.gridContainer}>
          {/* Start Test uses selectedLevel */}
          <Animated.View
            style={{ width: "48%", transform: [{ scale: scaleAnim }] }}
          >
            <TouchableOpacity
              style={[
                styles.gridButton,
                { backgroundColor: LEVEL_COLORS[selectedLevel] },
              ]}
              onPress={() => tap(startQuiz)}
              activeOpacity={0.9}
            >
              <View style={styles.gridButtonContent}>
                <FontAwesome name="play-circle" size={24} color="#FFFFFF" />
                <Text style={styles.gridButtonText}>{t("startTest")}</Text>
                <Text style={styles.gridButtonSubtext}>
                  {selectedLevel === "Alle" ? t("allLabel") : selectedLevel}
                </Text>
              </View>
            </TouchableOpacity>
          </Animated.View>

          <GridButton
            icon="book"
            title={t("powerWords")}
            onPress={() => router.push("/wordlooker")}
          />
          <GridButton
            icon="comment"
            title={t("sentences")}
            onPress={() => router.push("/sentences")}
          />
          <GridButton
            icon="bar-chart"
            title={t("statistics")}
            onPress={() => router.push("/statistics")}
          />
        </View>

        {/* Secondary Actions */}
        <View style={styles.secondaryActions}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => setShowAchievements(true)}
          >
            <MaterialCommunityIcons name="medal" size={20} color="#007AFF" />
            <Text style={styles.secondaryButtonText}>
              {t("yourAchievements")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => setShowLeaderboard(true)}
          >
            <MaterialCommunityIcons name="trophy" size={20} color="#007AFF" />
            <Text style={styles.secondaryButtonText}>{t("yourStats")}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.moreAppsButton}
          onPress={openPlayStoreApps}
        >
          <FontAwesome name="bolt" size={20} color="#FFFFFF" />
          <Text style={styles.moreAppsText}>{t("moreApps")}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.rateButton} onPress={openPlayStore}>
          <FontAwesome name="star" size={20} color="#FFFFFF" />
          <Text style={styles.rateText}>{t("rateUs")}</Text>
        </TouchableOpacity>

        <View style={styles.bannerWrapper}>
          <ABanner />
        </View>
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Tutorial Modal */}
      <Modal visible={showTutorial} animationType="slide" transparent>
        <View style={styles.tutorialOverlay}>
          <View style={styles.tutorialBox}>
            <View style={styles.tutorialIconContainer}>
              <MaterialCommunityIcons
                name={TUTORIAL_STEPS[tutorialStep].icon}
                size={60}
                color={TUTORIAL_STEPS[tutorialStep].color}
              />
            </View>
            <Text style={styles.tutorialTitle}>
              {TUTORIAL_STEPS[tutorialStep].title}
            </Text>
            <Text style={styles.tutorialDescription}>
              {TUTORIAL_STEPS[tutorialStep].description}
            </Text>
            <View style={styles.tutorialDots}>
              {TUTORIAL_STEPS.map((_, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.tutorialDot,
                    idx === tutorialStep && styles.tutorialDotActive,
                  ]}
                />
              ))}
            </View>
            <View style={styles.tutorialButtons}>
              {tutorialStep < TUTORIAL_STEPS.length - 1 ? (
                <>
                  <TouchableOpacity
                    style={styles.tutorialSkipButton}
                    onPress={completeTutorial}
                  >
                    <Text style={styles.tutorialSkipText}>{t("skip")}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.tutorialNextButton}
                    onPress={nextTutorialStep}
                  >
                    <Text style={styles.tutorialNextText}>{t("next")}</Text>
                    <MaterialCommunityIcons
                      name="arrow-right"
                      size={20}
                      color="#fff"
                    />
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={styles.tutorialStartButton}
                  onPress={completeTutorial}
                >
                  <Text style={styles.tutorialStartText}>{t("letsStart")}</Text>
                  <MaterialCommunityIcons name="check" size={20} color="#fff" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Congratulations Modal */}
      <Modal visible={showCongratulations} transparent animationType="slide">
        <View style={styles.congratsOverlay}>
          <Animated.View
            style={[styles.congratsBox, { transform: [{ scale: scaleAnim }] }]}
          >
            <View style={styles.congratsOwlContainer}>
              <Animated.View
                style={[
                  styles.congratsOwlPulse,
                  { transform: [{ scale: pulseAnim }] },
                ]}
              />
              <View
                style={[
                  styles.congratsOwlCircle,
                  { backgroundColor: congratsRank?.color || currentRank.color },
                ]}
              >
                <OwlEmoji size={80} />
              </View>
            </View>
            <MaterialCommunityIcons
              name="trophy-award"
              size={60}
              color="#fbbf24"
            />
            <Text style={styles.congratsTitle}>{t("congratulations")}</Text>
            <Text style={styles.congratsMessage}>{t("achievedRankOf")}</Text>
            <View style={styles.congratsRankBadge}>
              <Text style={styles.congratsRankEmoji}>
                {congratsRank?.emoji || currentRank.emoji}
              </Text>
              <Text
                style={[
                  styles.congratsRankName,
                  { color: congratsRank?.color || currentRank.color },
                ]}
              >
                {congratsRank?.name || currentRank.name}
              </Text>
            </View>
            <Text style={styles.congratsSubtext}>{t("owlIsProud")}</Text>
            <TouchableOpacity
              style={[
                styles.congratsButton,
                { backgroundColor: congratsRank?.color || currentRank.color },
              ]}
              onPress={() => setShowCongratulations(false)}
            >
              <Text style={styles.congratsButtonText}>
                {t("continueLearning")}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>

      {/* Rank Up Modal */}
      <Modal visible={showRankPopup} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <Animated.View
            style={[styles.modalBox, { transform: [{ scale: scaleAnim }] }]}
          >
            <MaterialCommunityIcons
              name="trophy-award"
              size={60}
              color="#34C759"
            />
            <Text style={styles.modalTitle}>{t("rankUp")}</Text>
            <Text style={styles.modalText}>
              {t("youAreNow", { rank: currentRank.name })}
            </Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setShowRankPopup(false)}
            >
              <Text style={styles.modalButtonText}>{t("continue")}</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>

      {/* Leaderboard Modal */}
      <Modal visible={showLeaderboard} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.leaderboardBox}>
            <View style={styles.leaderboardHeader}>
              <Text style={styles.leaderboardTitle}>Your Stats</Text>
              <TouchableOpacity onPress={() => setShowLeaderboard(false)}>
                <MaterialCommunityIcons
                  name="close"
                  size={24}
                  color="#64748b"
                />
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.leaderboardScroll}
              contentContainerStyle={styles.leaderboardScrollContent}
            >
              {getLeaderboardEntries().map((entry, idx) => (
                <View key={idx} style={styles.leaderboardRow}>
                  <View style={styles.leaderboardLeft}>
                    <MaterialCommunityIcons
                      name={entry.icon}
                      size={20}
                      color={entry.color}
                    />
                    <Text style={styles.leaderboardLabel}>{entry.label}</Text>
                  </View>
                  <Text
                    style={[styles.leaderboardValue, { color: entry.color }]}
                  >
                    {entry.value}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Achievements Modal */}
      <Modal visible={showAchievements} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.achievementsBox}>
            <View style={styles.achievementsHeader}>
              <Text style={styles.achievementsBoxTitle}>
                {t("achievements")}
              </Text>
              <TouchableOpacity onPress={() => setShowAchievements(false)}>
                <MaterialCommunityIcons
                  name="close"
                  size={24}
                  color="#64748b"
                />
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.achievementsBoxScroll}
              contentContainerStyle={styles.achievementsScrollContent}
            >
              {ACHIEVEMENTS.map((ach, idx) => {
                const isUnlocked = achievements && achievements[ach.id] === 1;
                const progress = achievements
                  ? achievements.perfectScores || 0
                  : 0;
                return (
                  <View
                    key={idx}
                    style={[
                      styles.achievementItem,
                      isUnlocked && styles.achievementUnlocked,
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={ach.icon}
                      size={30}
                      color={isUnlocked ? ach.color : "#cbd5e1"}
                    />
                    <View style={styles.achievementItemInfo}>
                      <Text
                        style={[
                          styles.achievementItemLabel,
                          isUnlocked && styles.achievementItemLabelUnlocked,
                        ]}
                      >
                        {ach.label}
                      </Text>
                      <Text style={styles.achievementItemProgress}>
                        {progress} / {ach.requirement}
                      </Text>
                    </View>
                    {isUnlocked && (
                      <MaterialCommunityIcons
                        name="check-circle"
                        size={20}
                        color={ach.color}
                      />
                    )}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F2F2F7" },
  scrollView: { flex: 1 },
  contentContainer: {
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 32,
  },
  header: { alignItems: "center", marginBottom: 24 },
  headerTop: {
    flexDirection: "row",
    justifyContent: "flex-end",
    width: "100%",
    marginBottom: 8,
  },
  owlContainer: {
    width: 100,
    height: 100,
    alignItems: "center",
    justifyContent: "center",
  },
  owlPulse: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(251, 191, 36, 0.2)",
  },
  owlCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  statBox: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginHorizontal: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1C1C1E",
    marginTop: 4,
  },
  statLabel: { fontSize: 11, color: "#8E8E93", marginTop: 2 },

  // Rank card
  rankCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  rankHeader: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  rankEmoji: { fontSize: 48, marginRight: 16 },
  rankInfo: { flex: 1 },
  rankTitle: { fontSize: 22, fontWeight: "bold", color: "#1C1C1E" },
  nextRankLabel: {
    fontSize: 14,
    color: "#8E8E93",
    fontWeight: "600",
    marginTop: 4,
  },
  helpButton: { padding: 8 },
  progressSection: {},
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  progressLabel: { fontSize: 13, color: "#8E8E93", fontWeight: "500" },
  quizzesLeft: { fontSize: 13, color: "#007AFF", fontWeight: "600" },
  progressBarContainer: {
    height: 8,
    backgroundColor: "#E5E5EA",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressBar: { height: "100%", borderRadius: 4 },
  progressText: {
    fontSize: 12,
    color: "#8E8E93",
    textAlign: "right",
    marginBottom: 12,
  },
  reminderChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF7E6",
    borderRadius: 12,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: "#fbbf24",
  },
  reminderText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: "#f59e0b",
    lineHeight: 18,
  },
  maxRankText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#34C759",
    textAlign: "center",
  },

  // ── Level Filter Card
  levelCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  levelCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  levelCardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1C1C1E",
    flex: 1,
  },
  levelActiveBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  levelActiveBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
  },
  levelButtonRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  levelButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#E5E5EA",
    backgroundColor: "#F2F2F7",
  },
  levelButtonLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#8E8E93",
    marginBottom: 2,
  },
  levelButtonLabelActive: { color: "#FFFFFF" },
  levelButtonCount: {
    fontSize: 10,
    color: "#8E8E93",
    fontWeight: "500",
  },
  levelButtonCountActive: { color: "rgba(255,255,255,0.85)" },
  levelDescription: {
    fontSize: 13,
    color: "#8E8E93",
    textAlign: "center",
    fontStyle: "italic",
  },
  // ───────────────────────────────────────────────────────────────────────────

  achievementsRow: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1C1C1E",
    marginBottom: 12,
  },
  achievementsScroll: { flexDirection: "row" },
  achievementBadge: {
    backgroundColor: "#E5E5EA",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 8,
  },
  achievementBadgeText: { fontSize: 12, fontWeight: "600", color: "#1C1C1E" },

  // Grid
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  gridButton: {
    backgroundColor: "#007AFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  gridButtonContent: { alignItems: "center", gap: 8 },
  gridButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },
  gridButtonSubtext: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 11,
    fontWeight: "600",
  },
  badge: {
    position: "absolute",
    top: -8,
    right: -8,
    backgroundColor: "#FF3B30",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "bold" },

  secondaryActions: { marginBottom: 24, gap: 12 },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  secondaryButtonText: { color: "#007AFF", fontSize: 15, fontWeight: "600" },
  moreAppsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FB923C",
    paddingVertical: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  moreAppsText: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },
  rateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FBBF24",
    paddingVertical: 16,
    borderRadius: 16,
  },
  rateText: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },
  bannerWrapper: { marginTop: 24 },
  bottomSpacer: { height: 80 },

  // Tutorial
  tutorialOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  tutorialBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 32,
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
  },
  tutorialIconContainer: { marginBottom: 24 },
  tutorialTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1C1C1E",
    textAlign: "center",
    marginBottom: 16,
  },
  tutorialDescription: {
    fontSize: 16,
    color: "#8E8E93",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 24,
  },
  tutorialDots: { flexDirection: "row", gap: 8, marginBottom: 24 },
  tutorialDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#E5E5EA",
  },
  tutorialDotActive: { backgroundColor: "#007AFF", width: 24 },
  tutorialButtons: { flexDirection: "row", gap: 12, width: "100%" },
  tutorialSkipButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#F2F2F7",
    alignItems: "center",
  },
  tutorialSkipText: { color: "#8E8E93", fontSize: 16, fontWeight: "600" },
  tutorialNextButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#007AFF",
  },
  tutorialNextText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
  tutorialStartButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#34C759",
  },
  tutorialStartText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  modalBox: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginTop: 12,
    marginBottom: 8,
    color: "#1C1C1E",
  },
  modalText: {
    fontSize: 16,
    color: "#8E8E93",
    textAlign: "center",
    marginBottom: 24,
  },
  modalButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
  },
  modalButtonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  leaderboardBox: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: "75%",
  },
  leaderboardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  leaderboardTitle: { fontSize: 20, fontWeight: "bold", color: "#1C1C1E" },
  leaderboardScroll: { maxHeight: 500 },
  leaderboardScrollContent: { paddingBottom: 20 },
  leaderboardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  leaderboardLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  leaderboardLabel: { fontSize: 15, color: "#8E8E93", fontWeight: "500" },
  leaderboardValue: { fontSize: 16, fontWeight: "600" },
  achievementsBox: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: "75%",
  },
  achievementsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  achievementsBoxTitle: { fontSize: 20, fontWeight: "bold", color: "#1C1C1E" },
  achievementsBoxScroll: { maxHeight: 400 },
  achievementsScrollContent: { paddingBottom: 24 },
  achievementItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  achievementUnlocked: { borderBottomColor: "#007AFF" },
  achievementItemInfo: { flex: 1, marginLeft: 12 },
  achievementItemLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#8E8E93",
    marginBottom: 4,
  },
  achievementItemLabelUnlocked: { color: "#1C1C1E" },
  achievementItemProgress: { fontSize: 13, color: "#8E8E93" },
  congratsOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  congratsBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 32,
    padding: 40,
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
  },
  congratsOwlContainer: {
    width: 120,
    height: 120,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  congratsOwlPulse: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(251, 191, 36, 0.3)",
  },
  congratsOwlCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  congratsTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1C1C1E",
    textAlign: "center",
    marginTop: 16,
    marginBottom: 12,
  },
  congratsMessage: {
    fontSize: 16,
    color: "#8E8E93",
    textAlign: "center",
    marginBottom: 20,
  },
  congratsRankBadge: {
    backgroundColor: "#F2F2F7",
    paddingHorizontal: 32,
    paddingVertical: 20,
    borderRadius: 20,
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 2,
    borderColor: "#E5E5EA",
  },
  congratsRankEmoji: { fontSize: 48, marginBottom: 8 },
  congratsRankName: { fontSize: 32, fontWeight: "800", textAlign: "center" },
  congratsSubtext: {
    fontSize: 14,
    color: "#8E8E93",
    textAlign: "center",
    marginBottom: 28,
    lineHeight: 20,
  },
  congratsButton: {
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 16,
    width: "100%",
    alignItems: "center",
  },
  congratsButtonText: { color: "#FFFFFF", fontSize: 17, fontWeight: "700" },
});
