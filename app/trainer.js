import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  BackHandler,
  TouchableOpacity,
  Image,
  Animated,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as Speech from "expo-speech";
import { FontAwesome, MaterialCommunityIcons } from "@expo/vector-icons";
import "expo-dev-client";
import { quizMainData } from "./words";
import { useTranslation } from "react-i18next";
import ABanner from "./banner";
import { openDatabaseSync } from "expo-sqlite";

const db = openDatabaseSync("appdata.db");

const ACHIEVEMENTS = [
  { id: "achievementFirstStar", requirement: 1 },
  { id: "achievementGoldenStudent", requirement: 5 },
  { id: "achievementDoctoralAward", requirement: 10 },
  { id: "achievementProfessorBadge", requirement: 20 },
];

const App = () => {
  const [sessionStartTime, setSessionStartTime] = useState(Date.now());
  const [count, setCount] = useState(0);
  const [score, setScore] = useState(0);
  const [fails, setFails] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [isWrong, setIsWrong] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [isButtonDisabled, setButtonDisabled] = useState(false);
  const [isSoundOn, setSoundOn] = useState(false);
  const [isProcessingClick, setIsProcessingClick] = useState(false);
  const [failureData, setFailureData] = useState([]);
  const [correctData, setCorrectData] = useState([]);
  const [fadeAnim] = useState(new Animated.Value(1));
  const { t } = useTranslation();
  const [dbReady, setDbReady] = useState(false); // ← DB guard

  // Streak tracking within session
  const [currentStreak, setCurrentStreak] = useState(0);
  const [bestSessionStreak, setBestSessionStreak] = useState(0);
  // Question timing
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  const [questionTimes, setQuestionTimes] = useState([]);

  const router = useRouter();
  const { level } = useLocalSearchParams(); // "Alle" | "A1" | "A2" | "B1"

  const initialQuiz = () => {
    const filtered =
      !level || level === "Alle"
        ? quizMainData
        : quizMainData.filter((w) => w.level === level);
    // fallback: if filtered is too small, use all words
    const pool = filtered.length >= 10 ? filtered : quizMainData;
    return [...pool].sort(() => Math.random() - 0.5).slice(0, 20);
  };

  const [quizData, setQuizData] = useState(initialQuiz());

  // ─── DB SETUP ────────────────────────────────────────────────────────────────

  const ensureAllTables = async () => {
    try {
      // achievements table
      const achInfo = await db.getAllAsync(`PRAGMA table_info(achievements)`);
      if (achInfo.length === 0) {
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
            fastestTime INTEGER DEFAULT 0
          );
        `);
        await db.execAsync(`
          INSERT INTO achievements (userId, lastPlayedDate)
          VALUES ('default', '${new Date().toISOString()}');
        `);
      } else {
        // migrate: add missing columns
        const cols = achInfo.map((c) => c.name);
        if (!cols.includes("highestScore"))
          await db.execAsync(`ALTER TABLE achievements ADD COLUMN highestScore INTEGER DEFAULT 0;`);
        if (!cols.includes("fastestTime"))
          await db.execAsync(`ALTER TABLE achievements ADD COLUMN fastestTime INTEGER DEFAULT 0;`);
      }

      // statistics table
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
          await db.execAsync(`ALTER TABLE statistics ADD COLUMN bestStreak INTEGER DEFAULT 0;`);
        if (!cols.includes("avgTimePerQuestion"))
          await db.execAsync(`ALTER TABLE statistics ADD COLUMN avgTimePerQuestion INTEGER DEFAULT 0;`);
        if (!cols.includes("fastestQuestion"))
          await db.execAsync(`ALTER TABLE statistics ADD COLUMN fastestQuestion INTEGER DEFAULT 0;`);
        if (!cols.includes("slowestQuestion"))
          await db.execAsync(`ALTER TABLE statistics ADD COLUMN slowestQuestion INTEGER DEFAULT 0;`);
      }

      // failed_words table
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

      // word_progress table — NEW: tracks every word seen/correct/wrong
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

    } catch (error) {
      console.error("ensureAllTables error:", error);
    }
  };

  useEffect(() => {
    ensureAllTables()
      .then(() => setDbReady(true))
      .catch((e) => {
        console.error("DB init failed:", e);
        setDbReady(true); // still allow quiz
      });
  }, []);

  // ─── WORD PROGRESS ───────────────────────────────────────────────────────────

  const updateWordProgress = async (word, correctArticle, level, category, isCorrect) => {
    try {
      const now = new Date().toISOString();
      const existing = await db.getFirstAsync(
        `SELECT * FROM word_progress WHERE word = ?`,
        [word]
      );

      if (existing) {
        await db.runAsync(
          `UPDATE word_progress SET
            seenCount = seenCount + 1,
            correctCount = correctCount + ?,
            wrongCount = wrongCount + ?,
            lastSeen = ?
          WHERE word = ?`,
          [isCorrect ? 1 : 0, isCorrect ? 0 : 1, now, word]
        );
      } else {
        await db.runAsync(
          `INSERT INTO word_progress (word, correctArticle, level, category, seenCount, correctCount, wrongCount, lastSeen, firstSeen)
           VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)`,
          [word, correctArticle, level || "A1", category || "", isCorrect ? 1 : 0, isCorrect ? 0 : 1, now, now]
        );
      }
    } catch (error) {
      console.error("updateWordProgress error:", error);
    }
  };

  // ─── FAILED WORDS ────────────────────────────────────────────────────────────

  const saveFailedWord = async (word, correctArticle, wrongArticle) => {
    try {
      const existing = await db.getFirstAsync(
        `SELECT * FROM failed_words WHERE word = ? AND correctArticle = ?`,
        [word, correctArticle]
      );
      if (existing) {
        await db.runAsync(
          `UPDATE failed_words SET failCount = failCount + 1, wrongArticle = ?, lastFailed = ? WHERE word = ? AND correctArticle = ?`,
          [wrongArticle, new Date().toISOString(), word, correctArticle]
        );
      } else {
        await db.runAsync(
          `INSERT INTO failed_words (word, correctArticle, wrongArticle, lastFailed) VALUES (?, ?, ?, ?)`,
          [word, correctArticle, wrongArticle, new Date().toISOString()]
        );
      }
    } catch (error) {
      console.error("saveFailedWord error:", error);
    }
  };

  // ─── SPEECH ──────────────────────────────────────────────────────────────────

  const speakWord = () => {
    Speech.stop();
    const word = quizData[currentQuestionIndex]?.question;
    if (isSoundOn && currentQuestionIndex < quizData.length) {
      try {
        Speech.speak(word, { language: "de" });
      } catch (error) {
        console.error("Speech.speak:", error);
      }
    }
  };

  const toggleSound = () => setSoundOn(!isSoundOn);

  useEffect(() => {
    speakWord();
    setQuestionStartTime(Date.now());
  }, [currentQuestionIndex]);

  // ─── ANSWER HANDLER ──────────────────────────────────────────────────────────

  const handleButtonClick = (handlerFunction) => {
    return () => {
      if (!isProcessingClick) {
        setIsProcessingClick(true);
        handlerFunction();
        setTimeout(() => setIsProcessingClick(false), 1000);
      }
    };
  };

  const handleAnswer = async (article) => {
    setSelectedAnswer(article);
    setCount((prev) => prev + 1);
    if (showModal) setButtonDisabled(true);

    const currentQuestion = quizData[currentQuestionIndex];
    const isCorrect = currentQuestion.correctAnswer === article;

    // Time tracking
    const elapsed = Math.round((Date.now() - questionStartTime) / 1000);
    const newQuestionTimes = [...questionTimes, elapsed];
    setQuestionTimes(newQuestionTimes);

    let newFails = fails;
    let newScore = score;
    let newStreak = currentStreak;
    let newBestStreak = bestSessionStreak;

    if (isCorrect) {
      newScore++;
      setScore(newScore);
      newStreak++;
      if (newStreak > newBestStreak) newBestStreak = newStreak;
      setBestSessionStreak(newBestStreak);
      setCurrentStreak(newStreak);
      correctData.push(article + " " + currentQuestion.question);
    } else {
      newFails++;
      setFails(newFails);
      setIsWrong(true);
      newStreak = 0;
      setCurrentStreak(0);

      if (dbReady) {
        await saveFailedWord(
          currentQuestion.question,
          currentQuestion.correctAnswer,
          article
        );
      }
      failureData.push(
        `${article} ${currentQuestion.question} => ✔️ ${currentQuestion.correctAnswer} ${currentQuestion.question}`
      );
    }

    // Update word_progress for every answered question
    if (dbReady) {
      await updateWordProgress(
        currentQuestion.question,
        currentQuestion.correctAnswer,
        currentQuestion.level,
        currentQuestion.category,
        isCorrect
      );
    }

    // Last question → save session
    if (currentQuestionIndex + 1 >= quizData.length) {
      setShowModal(true);

      const sessionEndTime = Date.now();
      const sessionDuration = Math.round((sessionEndTime - sessionStartTime) / 1000);
      const progress = ((newScore / quizData.length) * 100).toFixed(1);
      const isPerfect = newScore === quizData.length;

      // Calculate time stats
      const allTimes = [...newQuestionTimes];
      const avgTime = allTimes.length > 0
        ? Math.round(allTimes.reduce((a, b) => a + b, 0) / allTimes.length)
        : 0;
      const fastestQ = allTimes.length > 0 ? Math.min(...allTimes) : 0;
      const slowestQ = allTimes.length > 0 ? Math.max(...allTimes) : 0;

      if (dbReady) {
        try {
          await db.runAsync(
            `INSERT INTO statistics (date, totalReviewed, correctAnswers, fails, progressPercent, sessionTime, bestStreak, avgTimePerQuestion, fastestQuestion, slowestQuestion)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              new Date().toISOString(),
              quizData.length,
              newScore,
              newFails,
              parseFloat(progress),
              sessionDuration,
              newBestStreak,
              avgTime,
              fastestQ,
              slowestQ,
            ]
          );
          console.log("✅ Statistics saved");
          await updateAchievements(quizData.length, newScore, sessionDuration, isPerfect);
        } catch (error) {
          console.error("❌ Save error:", error);
        }
      }
    } else {
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]).start();

      setTimeout(() => {
        setSelectedAnswer(null);
        setIsWrong(false);
        setCurrentQuestionIndex((prev) => prev + 1);
      }, 300);
    }
  };

  // ─── ACHIEVEMENTS ────────────────────────────────────────────────────────────

  const updateAchievements = async (totalReviewed, correctAnswers, sessionTime, isPerfect) => {
    try {
      const currentAch = await db.getFirstAsync(
        "SELECT * FROM achievements WHERE userId='default'"
      );
      if (!currentAch) return;

      const newTotalQuizzes = (currentAch.totalQuizzes || 0) + 1;
      const newTotalCorrect = (currentAch.totalCorrect || 0) + correctAnswers;
      const newTotalQuestions = (currentAch.totalQuestions || 0) + totalReviewed;
      const newPerfectScores = (currentAch.perfectScores || 0) + (isPerfect ? 1 : 0);
      const newHighestScore = Math.max(currentAch.highestScore || 0, correctAnswers);

      let newFastestTime = currentAch.fastestTime || 0;
      if (correctAnswers > 0 && (newFastestTime === 0 || sessionTime < newFastestTime)) {
        newFastestTime = sessionTime;
      }

      // Streak calculation
      const today = new Date().toISOString().split("T")[0];
      const lastPlayed = currentAch.lastPlayedDate
        ? new Date(currentAch.lastPlayedDate).toISOString().split("T")[0]
        : null;

      let newConsecutiveDays = currentAch.consecutiveDays || 0;
      let newLongestStreak = currentAch.longestStreak || 0;

      if (!lastPlayed) {
        newConsecutiveDays = 1;
      } else {
        const diffDays = Math.floor(
          (new Date(today) - new Date(lastPlayed)) / (1000 * 60 * 60 * 24)
        );
        if (diffDays === 0) {
          // same day, no change
        } else if (diffDays === 1) {
          newConsecutiveDays++;
        } else {
          newConsecutiveDays = 1;
        }
      }
      if (newConsecutiveDays > newLongestStreak) newLongestStreak = newConsecutiveDays;

      // Achievement unlocks
      const achievementUpdates = {};
      ACHIEVEMENTS.forEach((ach) => {
        if (newPerfectScores >= ach.requirement && currentAch[ach.id] === 0) {
          achievementUpdates[ach.id] = 1;
        }
      });

      const achievementFields = Object.entries(achievementUpdates)
        .map(([key, value]) => `${key} = ${value}`)
        .join(", ");

      const baseUpdate = `
        totalQuizzes = ${newTotalQuizzes},
        totalCorrect = ${newTotalCorrect},
        totalQuestions = ${newTotalQuestions},
        perfectScores = ${newPerfectScores},
        consecutiveDays = ${newConsecutiveDays},
        longestStreak = ${newLongestStreak},
        lastPlayedDate = '${new Date().toISOString()}',
        highestScore = ${newHighestScore},
        fastestTime = ${newFastestTime}
      `;

      const allUpdates = [baseUpdate, achievementFields].filter((s) => s && s.trim()).join(", ");

      await db.execAsync(`UPDATE achievements SET ${allUpdates} WHERE userId='default'`);
      console.log("✅ Achievements updated");
    } catch (error) {
      console.error("❌ updateAchievements error:", error);
    }
  };

  // ─── RESET ───────────────────────────────────────────────────────────────────

  const resetQuiz = () => {
    const newQuiz = initialQuiz();
    setSessionStartTime(Date.now());
    setCount(0);
    setScore(0);
    setFails(0);
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setIsWrong(false);
    setQuizData(newQuiz);
    setFailureData([]);
    setCorrectData([]);
    setShowModal(false);
    setCurrentStreak(0);
    setBestSessionStreak(0);
    setQuestionTimes([]);
    setQuestionStartTime(Date.now());
  };

  const handleMenu = () => router.back();

  useEffect(() => {
    const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
      if (showModal) { setShowModal(false); return true; }
      return false;
    });
    return () => backHandler.remove();
  }, [showModal]);

  // ─── UI HELPERS ──────────────────────────────────────────────────────────────

  const getRewardMessage = (score) => {
    const isPerfect = score === quizData.length;
    if (isPerfect) return t("rewardPerfect");
    if (score >= 18) return t("reward18");
    if (score >= 15) return t("reward15");
    if (score >= 10) return t("reward10");
    if (score >= 5)  return t("reward5");
    return t("rewardDefault");
  };

  const progressPercentage = ((currentQuestionIndex + 1) / quizData.length) * 100;

  // ─── RENDER ──────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconButton} onPress={toggleSound}>
            <FontAwesome
              name={isSoundOn ? "volume-up" : "volume-off"}
              size={24}
              color="#6366f1"
            />
          </TouchableOpacity>

          <View style={styles.progressContainer}>
            <Text style={styles.progressText}>
              {currentQuestionIndex + 1} / {quizData.length}
            </Text>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${progressPercentage}%` }]} />
            </View>
          </View>

          <TouchableOpacity style={styles.iconButton} onPress={handleMenu}>
            <MaterialCommunityIcons name="home" size={24} color="#6366f1" />
          </TouchableOpacity>
        </View>

        {/* Streak indicator */}
        {currentStreak >= 3 && (
          <View style={styles.streakBanner}>
            <MaterialCommunityIcons name="fire" size={18} color="#f97316" />
            <Text style={styles.streakBannerText}>{t("streakBanner", { n: currentStreak })}</Text>
          </View>
        )}

        {/* Quiz Content */}
        <Animated.View style={[styles.quizContent, { opacity: fadeAnim }]}>
          <TouchableOpacity
            onPress={speakWord}
            activeOpacity={0.8}
            style={styles.imageContainer}
          >
            <Image
              source={
                quizData[currentQuestionIndex]?.image
                  ? quizData[currentQuestionIndex]?.image
                  : require("./images/end.png")
              }
              style={styles.image}
            />
            <View style={styles.speakHint}>
              <FontAwesome name="volume-up" size={16} color="#6366f1" />
              <Text style={styles.speakHintText}>{t("tapToHear")}</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.wordContainer}>
            <Text style={styles.word}>{quizData[currentQuestionIndex]?.question}</Text>
            <Text style={styles.englword}>{quizData[currentQuestionIndex]?.englishName}</Text>
            {quizData[currentQuestionIndex]?.level && (
              <View style={styles.levelBadge}>
                <Text style={styles.levelBadgeText}>{quizData[currentQuestionIndex].level}</Text>
              </View>
            )}
          </View>
        </Animated.View>

        {/* Answer Buttons */}
        <View style={styles.buttonContainer}>
          {["der", "die", "das"].map((article) => (
            <TouchableOpacity
              key={article}
              style={[
                styles.answerButton,
                selectedAnswer === article && styles.selectedButton,
                selectedAnswer === article && isWrong && styles.wrongButton,
              ]}
              onPress={handleButtonClick(() => handleAnswer(article))}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.buttonText,
                  selectedAnswer === article && styles.selectedButtonText,
                ]}
              >
                {article}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.bannerContainer}>
          <ABanner />
        </View>

        {/* Modal */}
        <Modal visible={showModal} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <ScrollView
                style={styles.modalScrollView}
                contentContainerStyle={styles.modalScrollContent}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.modalIconContainer}>
                  <MaterialCommunityIcons
                    name={score === quizData.length ? "trophy-award" : "check-decagram"}
                    size={80}
                    color={score === quizData.length ? "#fbbf24" : "#10b981"}
                  />
                </View>

                <Text style={styles.modalTitle}>{t("quizCompleted")}</Text>

                <View style={styles.scoreCard}>
                  <Text style={styles.modalScoreNumber}>{score}</Text>
                  <Text style={styles.modalScoreDivider}>/</Text>
                  <Text style={styles.modalScoreTotal}>{quizData.length}</Text>
                </View>

                {bestSessionStreak > 0 && (
                  <View style={styles.streakRow}>
                    <MaterialCommunityIcons name="fire" size={18} color="#f97316" />
                    <Text style={styles.streakRowText}>{t("bestStreakLabel", { n: bestSessionStreak })}</Text>
                  </View>
                )}

                <Text style={styles.modalSubtitle}>{getRewardMessage(score)}</Text>

                {failureData.length > 0 && (
                  <View style={styles.modalWrongAnswers}>
                    <Text style={styles.modalWrongAnswersTitle}>{t("errorAnalysis")}</Text>
                    {failureData.map((wrongAnswer, index) => {
                      const parts = wrongAnswer.split("=>");
                      return (
                        <View key={index} style={styles.wrongItem}>
                          <View style={styles.wrongItemRow}>
                            <MaterialCommunityIcons name="close-circle" size={16} color="#ef4444" />
                            <Text style={styles.wrongText}>{parts[0]?.trim()}</Text>
                          </View>
                          <View style={styles.correctItemRow}>
                            <MaterialCommunityIcons name="check-circle" size={16} color="#10b981" />
                            <Text style={styles.correctText}>{parts[1]?.trim()}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}

                <View style={styles.modalButtons}>
                  <TouchableOpacity style={[styles.modalButton, styles.primaryButton]} onPress={resetQuiz}>
                    <MaterialCommunityIcons name="refresh" size={20} color="#fff" />
                    <Text style={styles.primaryButtonText}>{t("newQuiz")}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.textButton} onPress={handleMenu}>
                    <Text style={styles.textButtonText}>{t("backToMenu")}</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f8fafc" },
  container: { flex: 1, backgroundColor: "#f8fafc" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  iconButton: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: "#f1f5f9",
    justifyContent: "center", alignItems: "center",
  },
  progressContainer: { flex: 1, marginHorizontal: 16 },
  progressText: { fontSize: 14, fontWeight: "600", color: "#475569", textAlign: "center", marginBottom: 8 },
  progressBarBg: { height: 8, backgroundColor: "#e2e8f0", borderRadius: 4, overflow: "hidden" },
  progressBarFill: { height: "100%", backgroundColor: "#6366f1", borderRadius: 4 },
  streakBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 6,
    backgroundColor: "#fff7ed",
    borderBottomWidth: 1,
    borderBottomColor: "#fed7aa",
  },
  streakBannerText: { fontSize: 14, fontWeight: "700", color: "#f97316" },
  quizContent: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 20 },
  imageContainer: { alignItems: "center", marginBottom: 24 },
  image: {
    width: 240, height: 240, borderRadius: 20,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 12, elevation: 5,
  },
  speakHint: {
    flexDirection: "row", alignItems: "center",
    marginTop: 12, paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: "#eef2ff", borderRadius: 20,
  },
  speakHintText: { marginLeft: 6, fontSize: 13, color: "#6366f1", fontWeight: "500" },
  wordContainer: {
    alignItems: "center", backgroundColor: "#fff",
    paddingHorizontal: 32, paddingVertical: 24,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  word: { fontSize: 32, fontWeight: "700", color: "#1e293b", marginBottom: 8 },
  englword: { fontSize: 16, color: "#64748b", fontWeight: "500" },
  levelBadge: {
    marginTop: 8, paddingHorizontal: 12, paddingVertical: 4,
    backgroundColor: "#eef2ff", borderRadius: 12,
  },
  levelBadgeText: { fontSize: 12, fontWeight: "700", color: "#6366f1" },
  buttonContainer: {
    flexDirection: "row", justifyContent: "space-between",
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24, gap: 12,
  },
  answerButton: {
    flex: 1, height: 64, justifyContent: "center", alignItems: "center",
    backgroundColor: "#fff", borderRadius: 16, borderWidth: 2, borderColor: "#e2e8f0",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  buttonText: { fontSize: 20, fontWeight: "700", color: "#475569" },
  selectedButton: { backgroundColor: "#10b981", borderColor: "#10b981" },
  wrongButton: { backgroundColor: "#ef4444", borderColor: "#ef4444" },
  selectedButtonText: { color: "#fff" },
  bannerContainer: {
    width: "100%", alignItems: "center",
    paddingTop: 8, paddingBottom: 20,
    backgroundColor: "#fff",
    borderTopWidth: 1, borderTopColor: "#e2e8f0",
  },
  modalOverlay: {
    flex: 1, justifyContent: "center", alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.7)", paddingHorizontal: 20,
  },
  modalCard: {
    backgroundColor: "#fff", borderRadius: 24,
    width: "100%", maxWidth: 400, maxHeight: "85%",
    shadowColor: "#000", shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.25, shadowRadius: 25, elevation: 15,
  },
  modalScrollView: { width: "100%" },
  modalScrollContent: { padding: 32, alignItems: "center" },
  modalIconContainer: { marginBottom: 20 },
  modalTitle: { fontSize: 28, fontWeight: "800", color: "#1e293b", textAlign: "center", marginBottom: 16 },
  scoreCard: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: "#f1f5f9", paddingHorizontal: 24, paddingVertical: 16,
    borderRadius: 16, marginBottom: 12,
  },
  modalScoreNumber: { fontSize: 48, fontWeight: "800", color: "#10b981" },
  modalScoreDivider: { fontSize: 32, fontWeight: "600", color: "#94a3b8", marginHorizontal: 8 },
  modalScoreTotal: { fontSize: 32, fontWeight: "600", color: "#64748b" },
  streakRow: {
    flexDirection: "row", alignItems: "center", gap: 6,
    marginBottom: 8,
  },
  streakRowText: { fontSize: 14, fontWeight: "700", color: "#f97316" },
  modalSubtitle: { fontSize: 18, textAlign: "center", color: "#475569", marginBottom: 24, fontWeight: "500" },
  modalWrongAnswers: {
    width: "100%", backgroundColor: "#f8fafc",
    borderRadius: 16, padding: 16, marginBottom: 24,
    borderWidth: 1, borderColor: "#e2e8f0",
  },
  modalWrongAnswersTitle: { fontSize: 16, fontWeight: "700", marginBottom: 12, color: "#1e293b" },
  wrongItem: { marginBottom: 12 },
  wrongItemRow: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  correctItemRow: { flexDirection: "row", alignItems: "center", paddingLeft: 20 },
  wrongText: { marginLeft: 8, fontSize: 14, color: "#ef4444", fontWeight: "500" },
  correctText: { marginLeft: 8, fontSize: 14, color: "#10b981", fontWeight: "600" },
  modalButtons: { width: "100%", gap: 12 },
  modalButton: {
    flexDirection: "row", justifyContent: "center", alignItems: "center",
    paddingVertical: 16, borderRadius: 12, gap: 8,
  },
  primaryButton: { backgroundColor: "#6366f1" },
  primaryButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  textButton: { paddingVertical: 12, alignItems: "center" },
  textButtonText: { color: "#64748b", fontSize: 15, fontWeight: "600" },
});

export default App;
