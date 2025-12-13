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

import { Button } from "react-native-paper";
import { useRouter } from "expo-router";
import * as Speech from "expo-speech";
import { FontAwesome, MaterialCommunityIcons } from "@expo/vector-icons";
import "expo-dev-client";
import { quizMainData } from "./words";
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
  const [dailyBoostActive, setDailyBoostActive] = useState(false);
  const router = useRouter();

  const initialQuiz = () =>
    [...quizMainData].sort(() => Math.random() - 0.5).slice(0, 20);

  const [quizData, setQuizData] = useState(initialQuiz());
  const [lastQuizData, setLastQuizData] = useState(quizData);

  // Check for daily boost on mount
  useEffect(() => {
    checkDailyBoost();
  }, []);

  const checkDailyBoost = async () => {
    try {
      await ensureAchievementsTable();
      const row = await db.getFirstAsync(
        "SELECT dailyBoostUsed, lastDailyBoost FROM achievements WHERE userId='default'"
      );
      if (row) {
        const today = new Date().toISOString().split("T")[0];
        if (row.lastDailyBoost === today && row.dailyBoostUsed === 0) {
          setDailyBoostActive(true);
        }
      }
    } catch (error) {
      console.error("checkDailyBoost error:", error);
    }
  };

  const ensureAchievementsTable = async () => {
    try {
      const tableInfo = await db.getAllAsync(`PRAGMA table_info(achievements)`);

      if (tableInfo.length === 0) {
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
            lastDailyBoost TEXT,
            dailyBoostUsed INTEGER DEFAULT 0,
            streakFreeze INTEGER DEFAULT 0
          );
        `);

        const today = new Date().toISOString().split("T")[0];
        await db.execAsync(`
          INSERT INTO achievements (userId, lastPlayedDate, lastDailyBoost)
          VALUES ('default', '${new Date().toISOString()}', '${today}');
        `);
      } else {
        const hasNewColumns = tableInfo.some(
          (col) => col.name === "dailyBoostUsed"
        );

        if (!hasNewColumns) {
          await db.execAsync(`
            ALTER TABLE achievements ADD COLUMN lastDailyBoost TEXT;
            ALTER TABLE achievements ADD COLUMN dailyBoostUsed INTEGER DEFAULT 0;
            ALTER TABLE achievements ADD COLUMN streakFreeze INTEGER DEFAULT 0;
            ALTER TABLE achievements ADD COLUMN highestScore INTEGER DEFAULT 0;
            ALTER TABLE achievements ADD COLUMN fastestTime INTEGER DEFAULT 0;
          `);
        }
      }
    } catch (error) {
      console.error("ensureAchievementsTable error:", error);
    }
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

  const saveFailedWord = async (word, correctArticle, wrongArticle) => {
    try {
      await ensureFailedWordsTable();

      // Check if word already exists
      const existing = await db.getFirstAsync(
        `SELECT * FROM failed_words WHERE word = ? AND correctArticle = ?`,
        [word, correctArticle]
      );

      if (existing) {
        // Update fail count
        await db.runAsync(
          `UPDATE failed_words 
           SET failCount = failCount + 1, 
               wrongArticle = ?,
               lastFailed = ?
           WHERE word = ? AND correctArticle = ?`,
          [wrongArticle, new Date().toISOString(), word, correctArticle]
        );
      } else {
        // Insert new failed word
        await db.runAsync(
          `INSERT INTO failed_words (word, correctArticle, wrongArticle, lastFailed)
           VALUES (?, ?, ?, ?)`,
          [word, correctArticle, wrongArticle, new Date().toISOString()]
        );
      }
    } catch (error) {
      console.error("saveFailedWord error:", error);
    }
  };

  const speakWord = () => {
    Speech.stop();
    const greeting = quizData[currentQuestionIndex]?.question;
    const options = { language: "de" };
    if (isSoundOn && currentQuestionIndex < quizData.length) {
      try {
        Speech.speak(greeting, options);
      } catch (error) {
        console.error("Speech.speak : " + error);
      }
    }
  };

  const toggleSound = () => setSoundOn(!isSoundOn);

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
    let newFails = fails;
    let newScore = score;

    if (currentQuestion.correctAnswer === article) {
      newScore++;
      setScore(newScore);
      correctData.push(article + " " + currentQuestion.question);
    } else {
      newFails++;
      setFails(newFails);
      setIsWrong(true);

      // Save failed word to database
      await saveFailedWord(
        currentQuestion.question,
        currentQuestion.correctAnswer,
        article
      );

      failureData.push(
        `${article} ${currentQuestion.question} => ✔️ ${currentQuestion.correctAnswer} ${currentQuestion.question}`
      );
    }

    if (currentQuestionIndex + 1 >= quizData.length) {
      setShowModal(true);

      const sessionEndTime = Date.now();
      const sessionDuration = Math.round(
        (sessionEndTime - sessionStartTime) / 1000
      );
      const progress = ((newScore / quizData.length) * 100).toFixed(1);
      const isPerfect = newScore === quizData.length;

      try {
        // 1. Save to statistics table (session history)
        await db.execAsync(`
          CREATE TABLE IF NOT EXISTS statistics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            totalReviewed INTEGER,
            correctAnswers INTEGER,
            fails INTEGER,
            progressPercent REAL,
            sessionTime INTEGER
          );
        `);

        await db.execAsync(`
          INSERT INTO statistics (date, totalReviewed, correctAnswers, fails, progressPercent, sessionTime)
          VALUES ('${new Date().toISOString()}', ${
          quizData.length
        }, ${newScore}, ${newFails}, ${progress}, ${sessionDuration});
        `);
        console.log("✅ Statistics saved");

        // 2. Update achievements table
        await updateAchievements(
          quizData.length,
          newScore,
          newFails,
          sessionDuration,
          isPerfect
        );
      } catch (error) {
        console.error("❌ Save error:", error);
      }
    } else {
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();

      setTimeout(() => {
        setSelectedAnswer(null);
        setIsWrong(false);
        setCurrentQuestionIndex((prev) => prev + 1);
      }, 300);
    }
  };

  const updateAchievements = async (
    totalReviewed,
    correctAnswers,
    failsCount,
    sessionTime,
    isPerfect
  ) => {
    try {
      await ensureAchievementsTable();

      const currentAch = await db.getFirstAsync(
        "SELECT * FROM achievements WHERE userId='default'"
      );

      if (!currentAch) {
        console.error("No achievements record found");
        return;
      }

      // Calculate new values
      const newTotalQuizzes = (currentAch.totalQuizzes || 0) + 1;
      const newTotalCorrect = (currentAch.totalCorrect || 0) + correctAnswers;
      const newTotalQuestions =
        (currentAch.totalQuestions || 0) + totalReviewed;
      const newPerfectScores =
        (currentAch.perfectScores || 0) + (isPerfect ? 1 : 0);

      // Update highest score
      const newHighestScore = Math.max(
        currentAch.highestScore || 0,
        correctAnswers
      );

      // Update fastest time (only if score > 0)
      let newFastestTime = currentAch.fastestTime || 0;
      if (correctAnswers > 0) {
        if (newFastestTime === 0 || sessionTime < newFastestTime) {
          newFastestTime = sessionTime;
        }
      }

      // Update streak
      const today = new Date().toISOString().split("T")[0];
      const lastPlayed = currentAch.lastPlayedDate
        ? new Date(currentAch.lastPlayedDate).toISOString().split("T")[0]
        : null;

      let newConsecutiveDays = currentAch.consecutiveDays || 0;
      let newLongestStreak = currentAch.longestStreak || 0;
      let streakFreezeUsed = false;

      if (!lastPlayed) {
        newConsecutiveDays = 1;
      } else {
        const lastPlayedDate = new Date(lastPlayed);
        const todayDate = new Date(today);
        const diffTime = todayDate - lastPlayedDate;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
          // Same day - no change
        } else if (diffDays === 1) {
          // Consecutive day
          newConsecutiveDays++;
        } else if (diffDays > 1) {
          // Streak broken - check for freeze
          if ((currentAch.streakFreeze || 0) > 0) {
            // Use streak freeze
            streakFreezeUsed = true;
            console.log("🧊 Streak freeze used!");
          } else {
            // Reset streak
            newConsecutiveDays = 1;
          }
        }
      }

      if (newConsecutiveDays > newLongestStreak) {
        newLongestStreak = newConsecutiveDays;
      }

      // Check and unlock achievements
      const achievementUpdates = {};
      ACHIEVEMENTS.forEach((ach) => {
        if (newPerfectScores >= ach.requirement && currentAch[ach.id] === 0) {
          achievementUpdates[ach.id] = 1;
          console.log(`🎉 Achievement unlocked: ${ach.id}`);
        }
      });

      // Build SQL update
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

      const dailyBoostUpdate = dailyBoostActive ? ", dailyBoostUsed = 1" : "";
      const streakFreezeUpdate = streakFreezeUsed
        ? ", streakFreeze = streakFreeze - 1"
        : "";

      const allUpdates = [
        baseUpdate,
        achievementFields,
        dailyBoostUpdate,
        streakFreezeUpdate,
      ]
        .filter((s) => s.trim())
        .join(", ");

      await db.execAsync(`
        UPDATE achievements
        SET ${allUpdates}
        WHERE userId='default'
      `);

      console.log("✅ Achievements updated");
      console.log(`📊 Quiz: ${newTotalQuizzes}, Perfect: ${newPerfectScores}`);
      console.log(`🔥 Streak: ${newConsecutiveDays} days`);

      if (dailyBoostActive) {
        console.log("🚀 Daily boost used!");
      }
    } catch (error) {
      console.error("❌ updateAchievements error:", error);
    }
  };

  useEffect(() => {
    try {
      speakWord();
    } catch (error) {
      console.error("speakword : " + error);
    }
  }, [currentQuestionIndex]);

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
    setLastQuizData(newQuiz);
    setFailureData([]);
    setCorrectData([]);
    setShowModal(false);
  };

  const handleMenu = () => router.back();

  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (showModal) {
          setShowModal(false);
          return true;
        }
        return false;
      }
    );
    return () => backHandler.remove();
  }, [showModal]);

  const getRewardMessage = (score) => {
    if (score === quizData.length) return "Perfekt! 🌟🌟🌟🌟🌟";
    if (score >= 15) return "Super gemacht! 🌟🌟🌟🌟";
    if (score >= 10) return "Gut gemacht! 🌟🌟🌟";
    if (score >= 5) return "Ordentliche Leistung! 🌟🌟";
    return "Nicht schlecht – weiter üben! ⭐";
  };

  const progressPercentage =
    ((currentQuestionIndex + 1) / quizData.length) * 100;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Modern Header with Progress */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconButton} onPress={toggleSound}>
            <FontAwesome
              name={isSoundOn ? "volume-up" : "volume-off"}
              size={24}
              color="#6366f1"
            />
          </TouchableOpacity>

          <View style={styles.progressContainer}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressText}>
                {currentQuestionIndex + 1} / {quizData.length}
              </Text>
              {dailyBoostActive && (
                <View style={styles.boostBadge}>
                  <MaterialCommunityIcons
                    name="flash"
                    size={12}
                    color="#fbbf24"
                  />
                  <Text style={styles.boostText}>2x</Text>
                </View>
              )}
            </View>
            <View style={styles.progressBarBg}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${progressPercentage}%` },
                ]}
              />
            </View>
          </View>

          <TouchableOpacity style={styles.iconButton} onPress={handleMenu}>
            <MaterialCommunityIcons name="home" size={24} color="#6366f1" />
          </TouchableOpacity>
        </View>

        {/* Daily Boost Indicator */}
        {dailyBoostActive && (
          <View style={styles.dailyBoostBanner}>
            <MaterialCommunityIcons name="flash" size={16} color="#fbbf24" />
            <Text style={styles.dailyBoostText}>
              Daily Boost Active! First quiz today 🚀
            </Text>
          </View>
        )}

        {/* Quiz Content with Animation */}
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
              <Text style={styles.speakHintText}>Tap to hear</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.wordContainer}>
            <Text style={styles.word}>
              {quizData[currentQuestionIndex]?.question}
            </Text>
            <Text style={styles.englword}>
              {quizData[currentQuestionIndex]?.englishName}
            </Text>
          </View>
        </Animated.View>

        {/* Modern Answer Buttons */}
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

        {/* Modern Modal */}
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
                    name={
                      score === quizData.length
                        ? "trophy-award"
                        : "check-decagram"
                    }
                    size={80}
                    color={score === quizData.length ? "#fbbf24" : "#10b981"}
                  />
                </View>

                <Text style={styles.modalTitle}>Quiz abgeschlossen!</Text>

                <View style={styles.scoreCard}>
                  <Text style={styles.modalScoreNumber}>{score}</Text>
                  <Text style={styles.modalScoreDivider}>/</Text>
                  <Text style={styles.modalScoreTotal}>{quizData.length}</Text>
                </View>

                <Text style={styles.modalSubtitle}>
                  {getRewardMessage(score)}
                </Text>

                {failureData.length > 0 && (
                  <View style={styles.modalWrongAnswers}>
                    <Text style={styles.modalWrongAnswersTitle}>
                      Fehleranalyse
                    </Text>
                    {failureData.map((wrongAnswer, index) => {
                      const parts = wrongAnswer.split("=>");
                      const correctAnsw = parts[1]?.trim();
                      const wrongAnsw = parts[0]?.trim();
                      return (
                        <View key={index} style={styles.wrongItem}>
                          <View style={styles.wrongItemRow}>
                            <MaterialCommunityIcons
                              name="close-circle"
                              size={16}
                              color="#ef4444"
                            />
                            <Text style={styles.wrongText}>{wrongAnsw}</Text>
                          </View>
                          <View style={styles.correctItemRow}>
                            <MaterialCommunityIcons
                              name="check-circle"
                              size={16}
                              color="#10b981"
                            />
                            <Text style={styles.correctText}>
                              {correctAnsw}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.primaryButton]}
                    onPress={resetQuiz}
                  >
                    <MaterialCommunityIcons
                      name="refresh"
                      size={20}
                      color="#fff"
                    />
                    <Text style={styles.primaryButtonText}>Neues Quiz</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.textButton}
                    onPress={handleMenu}
                  >
                    <Text style={styles.textButtonText}>Zurück zum Menü</Text>
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
  safeArea: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
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
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
  },
  progressContainer: {
    flex: 1,
    marginHorizontal: 16,
  },
  progressHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  progressText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#475569",
    textAlign: "center",
  },
  boostBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef3c7",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  boostText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#f59e0b",
    marginLeft: 2,
  },
  progressBarBg: {
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
  dailyBoostBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fef3c7",
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 12,
    gap: 8,
  },
  dailyBoostText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#f59e0b",
  },
  quizContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  imageContainer: {
    alignItems: "center",
    marginBottom: 24,
  },
  image: {
    width: 240,
    height: 240,
    borderRadius: 20,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  speakHint: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#eef2ff",
    borderRadius: 20,
  },
  speakHintText: {
    marginLeft: 6,
    fontSize: 13,
    color: "#6366f1",
    fontWeight: "500",
  },
  wordContainer: {
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 32,
    paddingVertical: 24,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  word: {
    fontSize: 32,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 8,
  },
  englword: {
    fontSize: 16,
    color: "#64748b",
    fontWeight: "500",
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 12,
  },
  answerButton: {
    flex: 1,
    height: 64,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  buttonText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#475569",
  },
  selectedButton: {
    backgroundColor: "#10b981",
    borderColor: "#10b981",
  },
  wrongButton: {
    backgroundColor: "#ef4444",
    borderColor: "#ef4444",
  },
  selectedButtonText: {
    color: "#fff",
  },
  bannerContainer: {
    width: "100%",
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 20,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    paddingHorizontal: 20,
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    width: "100%",
    maxWidth: 400,
    maxHeight: "85%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.25,
    shadowRadius: 25,
    elevation: 15,
  },
  modalScrollView: {
    width: "100%",
  },
  modalScrollContent: {
    padding: 32,
    alignItems: "center",
  },
  modalIconContainer: {
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1e293b",
    textAlign: "center",
    marginBottom: 16,
  },
  scoreCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  modalScoreNumber: {
    fontSize: 48,
    fontWeight: "800",
    color: "#10b981",
  },
  modalScoreDivider: {
    fontSize: 32,
    fontWeight: "600",
    color: "#94a3b8",
    marginHorizontal: 8,
  },
  modalScoreTotal: {
    fontSize: 32,
    fontWeight: "600",
    color: "#64748b",
  },
  modalSubtitle: {
    fontSize: 18,
    textAlign: "center",
    color: "#475569",
    marginBottom: 24,
    fontWeight: "500",
  },
  modalWrongAnswers: {
    width: "100%",
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  modalWrongAnswersTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
    color: "#1e293b",
  },
  wrongItem: {
    marginBottom: 12,
  },
  wrongItemRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  correctItemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 20,
  },
  wrongText: {
    marginLeft: 8,
    fontSize: 14,
    color: "#ef4444",
    fontWeight: "500",
  },
  correctText: {
    marginLeft: 8,
    fontSize: 14,
    color: "#10b981",
    fontWeight: "600",
  },
  modalButtons: {
    width: "100%",
    gap: 12,
  },
  modalButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  primaryButton: {
    backgroundColor: "#6366f1",
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  textButton: {
    paddingVertical: 12,
    alignItems: "center",
  },
  textButtonText: {
    color: "#64748b",
    fontSize: 15,
    fontWeight: "600",
  },
});

export default App;
