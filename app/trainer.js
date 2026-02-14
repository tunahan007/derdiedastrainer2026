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
  Alert,
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
import {
  initializeSubscriptionTables,
  canStartQuiz,
  incrementQuizCount,
  getSubscriptionStatus,
  hasFeatureAccess,
  FEATURES,
} from "./subscriptionManager";

const db = openDatabaseSync("appdata.db");

const ACHIEVEMENTS = [
  { id: "achievementFirstStar", requirement: 1 },
  { id: "achievementGoldenStudent", requirement: 5 },
  { id: "achievementDoctoralAward", requirement: 10 },
  { id: "achievementProfessorBadge", requirement: 20 },
];

const App = () => {
  const [sessionStartTime, setSessionStartTime] = useState(Date.now());
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  const [questionTimes, setQuestionTimes] = useState([]);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [bestStreakInSession, setBestStreakInSession] = useState(0);
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
  const [subscription, setSubscription] = useState(null);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [quizzesLeft, setQuizzesLeft] = useState(0);
  const router = useRouter();

  const initialQuiz = () =>
    [...quizMainData].sort(() => Math.random() - 0.5).slice(0, 20);

  const [quizData, setQuizData] = useState(initialQuiz());
  const [lastQuizData, setLastQuizData] = useState(quizData);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    await initializeSubscriptionTables();
    await checkQuizAccess();
    await ensureAchievementsTable();
  };

  const checkQuizAccess = async () => {
    const quizAccess = await canStartQuiz();
    const subStatus = await getSubscriptionStatus();

    setSubscription(subStatus);
    setQuizzesLeft(quizAccess.quizzesLeft);

    if (!quizAccess.canStart) {
      setShowLimitModal(true);
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
            fastestTime INTEGER DEFAULT 0
          );
        `);

        await db.execAsync(`
          INSERT INTO achievements (userId, lastPlayedDate)
          VALUES ('default', '${new Date().toISOString()}');
        `);
      } else {
        const hasNewColumns = tableInfo.some(
          (col) => col.name === "highestScore",
        );

        if (!hasNewColumns) {
          await db.execAsync(`
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

      const existing = await db.getFirstAsync(
        `SELECT * FROM failed_words WHERE word = ? AND correctArticle = ?`,
        [word, correctArticle],
      );

      if (existing) {
        await db.runAsync(
          `UPDATE failed_words 
           SET failCount = failCount + 1, 
               wrongArticle = ?,
               lastFailed = ?
           WHERE word = ? AND correctArticle = ?`,
          [wrongArticle, new Date().toISOString(), word, correctArticle],
        );
      } else {
        await db.runAsync(
          `INSERT INTO failed_words (word, correctArticle, wrongArticle, lastFailed)
           VALUES (?, ?, ?, ?)`,
          [word, correctArticle, wrongArticle, new Date().toISOString()],
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
    const questionEndTime = Date.now();
    const timeSpent = Math.round((questionEndTime - questionStartTime) / 1000);
    const newQuestionTimes = [...questionTimes, timeSpent];
    setQuestionTimes(newQuestionTimes);

    setSelectedAnswer(article);
    setCount((prev) => prev + 1);
    if (showModal) setButtonDisabled(true);

    const currentQuestion = quizData[currentQuestionIndex];
    let newFails = fails;
    let newScore = score;
    let newStreak = currentStreak;

    if (currentQuestion.correctAnswer === article) {
      newScore++;
      setScore(newScore);
      newStreak++;
      setCurrentStreak(newStreak);

      if (newStreak > bestStreakInSession) {
        setBestStreakInSession(newStreak);
      }

      correctData.push(article + " " + currentQuestion.question);
    } else {
      newFails++;
      setFails(newFails);
      setIsWrong(true);

      newStreak = 0;
      setCurrentStreak(0);

      await saveFailedWord(
        currentQuestion.question,
        currentQuestion.correctAnswer,
        article,
      );

      failureData.push(
        `${article} ${currentQuestion.question} => ✔️ ${currentQuestion.correctAnswer} ${currentQuestion.question}`,
      );
    }

    if (currentQuestionIndex + 1 >= quizData.length) {
      setShowModal(true);

      const sessionEndTime = Date.now();
      const sessionDuration = Math.round(
        (sessionEndTime - sessionStartTime) / 1000,
      );
      const progress = ((newScore / quizData.length) * 100).toFixed(1);
      const isPerfect = newScore === quizData.length;

      const avgTime =
        newQuestionTimes.length > 0
          ? Math.round(
              newQuestionTimes.reduce((a, b) => a + b, 0) /
                newQuestionTimes.length,
            )
          : 0;
      const fastestTime =
        newQuestionTimes.length > 0 ? Math.min(...newQuestionTimes) : 0;
      const slowestTime =
        newQuestionTimes.length > 0 ? Math.max(...newQuestionTimes) : 0;

      try {
        await db.execAsync(`
          CREATE TABLE IF NOT EXISTS statistics (
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
          INSERT INTO statistics (
            date, totalReviewed, correctAnswers, fails, 
            progressPercent, sessionTime, bestStreak,
            avgTimePerQuestion, fastestQuestion, slowestQuestion
          )
          VALUES (
            '${new Date().toISOString()}', ${quizData.length}, 
            ${newScore}, ${newFails}, ${progress}, ${sessionDuration},
            ${bestStreakInSession}, ${avgTime}, ${fastestTime}, ${slowestTime}
          );
        `);
        console.log("✅ Statistics saved with advanced metrics");

        await updateAchievements(
          quizData.length,
          newScore,
          newFails,
          sessionDuration,
          isPerfect,
        );

        await incrementQuizCount();
        await checkQuizAccess();
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
        setQuestionStartTime(Date.now());
      }, 300);
    }
  };

  const updateAchievements = async (
    totalReviewed,
    correctAnswers,
    failsCount,
    sessionTime,
    isPerfect,
  ) => {
    try {
      await ensureAchievementsTable();

      const currentAch = await db.getFirstAsync(
        "SELECT * FROM achievements WHERE userId='default'",
      );

      if (!currentAch) {
        console.error("No achievements record found");
        return;
      }

      const newTotalQuizzes = (currentAch.totalQuizzes || 0) + 1;
      const newTotalCorrect = (currentAch.totalCorrect || 0) + correctAnswers;
      const newTotalQuestions =
        (currentAch.totalQuestions || 0) + totalReviewed;
      const newPerfectScores =
        (currentAch.perfectScores || 0) + (isPerfect ? 1 : 0);

      const newHighestScore = Math.max(
        currentAch.highestScore || 0,
        correctAnswers,
      );

      let newFastestTime = currentAch.fastestTime || 0;
      if (correctAnswers > 0) {
        if (newFastestTime === 0 || sessionTime < newFastestTime) {
          newFastestTime = sessionTime;
        }
      }

      const today = new Date().toISOString().split("T")[0];
      const lastPlayed = currentAch.lastPlayedDate
        ? currentAch.lastPlayedDate.split("T")[0]
        : null;

      const yesterday = new Date(Date.now() - 86400000)
        .toISOString()
        .split("T")[0];

      let newConsecutiveDays = currentAch.consecutiveDays || 0;
      if (!lastPlayed || lastPlayed === today) {
        newConsecutiveDays = currentAch.consecutiveDays || 1;
      } else if (lastPlayed === yesterday) {
        newConsecutiveDays = (currentAch.consecutiveDays || 0) + 1;
      } else {
        newConsecutiveDays = 1;
      }

      let newAchievementFirstStar = currentAch.achievementFirstStar || 0;
      let newAchievementGoldenStudent =
        currentAch.achievementGoldenStudent || 0;
      let newAchievementDoctoralAward =
        currentAch.achievementDoctoralAward || 0;
      let newAchievementProfessorBadge =
        currentAch.achievementProfessorBadge || 0;

      ACHIEVEMENTS.forEach((achievement) => {
        if (newPerfectScores >= achievement.requirement) {
          if (achievement.id === "achievementFirstStar") {
            newAchievementFirstStar = 1;
          } else if (achievement.id === "achievementGoldenStudent") {
            newAchievementGoldenStudent = 1;
          } else if (achievement.id === "achievementDoctoralAward") {
            newAchievementDoctoralAward = 1;
          } else if (achievement.id === "achievementProfessorBadge") {
            newAchievementProfessorBadge = 1;
          }
        }
      });

      await db.execAsync(`
        UPDATE achievements
        SET totalQuizzes = ${newTotalQuizzes},
            totalCorrect = ${newTotalCorrect},
            totalQuestions = ${newTotalQuestions},
            perfectScores = ${newPerfectScores},
            lastPlayedDate = '${new Date().toISOString()}',
            consecutiveDays = ${newConsecutiveDays},
            achievementFirstStar = ${newAchievementFirstStar},
            achievementGoldenStudent = ${newAchievementGoldenStudent},
            achievementDoctoralAward = ${newAchievementDoctoralAward},
            achievementProfessorBadge = ${newAchievementProfessorBadge},
            highestScore = ${newHighestScore},
            fastestTime = ${newFastestTime}
        WHERE userId = 'default';
      `);

      console.log("✅ Achievements updated");
    } catch (error) {
      console.error("❌ updateAchievements error:", error);
    }
  };

  const handleMenu = () => {
    Speech.stop();
    setShowModal(false);
    router.back();
  };

  const handleRetry = () => {
    Speech.stop();
    setQuizData(lastQuizData);
    setScore(0);
    setFails(0);
    setCount(0);
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setFailureData([]);
    setCorrectData([]);
    setShowModal(false);
    setButtonDisabled(false);
    setSessionStartTime(Date.now());
    setQuestionStartTime(Date.now());
    setQuestionTimes([]);
    setCurrentStreak(0);
    setBestStreakInSession(0);
  };

  const handleNewQuiz = () => {
    Speech.stop();
    const newQuiz = initialQuiz();
    setQuizData(newQuiz);
    setLastQuizData(newQuiz);
    setScore(0);
    setFails(0);
    setCount(0);
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setFailureData([]);
    setCorrectData([]);
    setShowModal(false);
    setButtonDisabled(false);
    setSessionStartTime(Date.now());
    setQuestionStartTime(Date.now());
    setQuestionTimes([]);
    setCurrentStreak(0);
    setBestStreakInSession(0);
  };

  useEffect(() => {
    const backAction = () => {
      if (showModal) {
        handleMenu();
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      backAction,
    );

    return () => backHandler.remove();
  }, [showModal]);

  if (currentQuestionIndex >= quizData.length) {
    return null;
  }

  const currentQuestion = quizData[currentQuestionIndex];
  const progressPercentage =
    ((currentQuestionIndex + 1) / quizData.length) * 100;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={handleButtonClick(toggleSound)}
          >
            <MaterialCommunityIcons
              name={isSoundOn ? "volume-high" : "volume-off"}
              size={24}
              color="#475569"
            />
          </TouchableOpacity>

          <View style={styles.progressContainer}>
            <Text style={styles.progressText}>
              {currentQuestionIndex + 1} / {quizData.length}
            </Text>
            <View style={styles.progressBarBg}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${progressPercentage}%` },
                ]}
              />
            </View>
            {!subscription?.isPremium && !subscription?.isInTrial && (
              <Text
                style={{
                  fontSize: 12,
                  color: "#64748b",
                  textAlign: "center",
                  marginTop: 4,
                }}
              >
                {quizzesLeft} quizzes left today
              </Text>
            )}
          </View>

          <TouchableOpacity
            style={styles.iconButton}
            onPress={handleButtonClick(handleMenu)}
          >
            <MaterialCommunityIcons name="close" size={24} color="#475569" />
          </TouchableOpacity>
        </View>

        <Animated.View style={[styles.quizContent, { opacity: fadeAnim }]}>
          {currentQuestion?.image && (
            <View style={styles.imageContainer}>
              <Image
                source={currentQuestion.image}
                style={styles.image}
                resizeMode="cover"
              />
              <TouchableOpacity style={styles.speakHint} onPress={speakWord}>
                <MaterialCommunityIcons
                  name="volume-high"
                  size={16}
                  color="#6366f1"
                />
                <Text style={styles.speakHintText}>
                  Tap to hear pronunciation
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.wordContainer}>
            <Text style={styles.word}>{currentQuestion?.question}</Text>
            <Text style={styles.englword}>{currentQuestion?.englishName}</Text>
          </View>
        </Animated.View>

        <View style={styles.buttonContainer}>
          {["der", "die", "das"].map((article) => (
            <TouchableOpacity
              key={article}
              style={[
                styles.answerButton,
                selectedAnswer === article &&
                  currentQuestion.correctAnswer === article &&
                  styles.selectedButton,
                selectedAnswer === article &&
                  currentQuestion.correctAnswer !== article &&
                  styles.wrongButton,
              ]}
              onPress={handleButtonClick(() => handleAnswer(article))}
              disabled={selectedAnswer !== null}
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

        {!subscription?.isPremium && !subscription?.isInTrial && (
          <View style={styles.bannerContainer}>
            <ABanner />
          </View>
        )}

        <Modal
          visible={showModal}
          transparent={true}
          animationType="fade"
          onRequestClose={handleMenu}
        >
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
                        : score >= quizData.length * 0.7
                          ? "emoticon-happy"
                          : "emoticon"
                    }
                    size={64}
                    color={
                      score === quizData.length
                        ? "#fbbf24"
                        : score >= quizData.length * 0.7
                          ? "#10b981"
                          : "#6366f1"
                    }
                  />
                </View>

                <Text style={styles.modalTitle}>
                  {score === quizData.length
                    ? "Perfect Score! 🎉"
                    : score >= quizData.length * 0.7
                      ? "Great Job! 👏"
                      : "Keep Practicing! 💪"}
                </Text>

                <View style={styles.scoreCard}>
                  <Text style={styles.modalScoreNumber}>{score}</Text>
                  <Text style={styles.modalScoreDivider}>/</Text>
                  <Text style={styles.modalScoreTotal}>{quizData.length}</Text>
                </View>

                <Text style={styles.modalSubtitle}>
                  {score === quizData.length
                    ? "You're a German article master!"
                    : `You got ${((score / quizData.length) * 100).toFixed(0)}% correct!`}
                </Text>

                {fails > 0 && (
                  <View style={styles.modalWrongAnswers}>
                    <Text style={styles.modalWrongAnswersTitle}>
                      Review Mistakes ({fails})
                    </Text>
                    {failureData.map((item, index) => {
                      const parts = item.split(" => ");
                      return (
                        <View key={index} style={styles.wrongItem}>
                          <View style={styles.wrongItemRow}>
                            <MaterialCommunityIcons
                              name="close-circle"
                              size={16}
                              color="#ef4444"
                            />
                            <Text style={styles.wrongText}>{parts[0]}</Text>
                          </View>
                          <View style={styles.correctItemRow}>
                            <MaterialCommunityIcons
                              name="check-circle"
                              size={16}
                              color="#10b981"
                            />
                            <Text style={styles.correctText}>{parts[1]}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.primaryButton]}
                    onPress={handleNewQuiz}
                  >
                    <MaterialCommunityIcons
                      name="refresh"
                      size={20}
                      color="#fff"
                    />
                    <Text style={styles.primaryButtonText}>New Quiz</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modalButton, styles.primaryButton]}
                    onPress={handleRetry}
                  >
                    <MaterialCommunityIcons
                      name="replay"
                      size={20}
                      color="#fff"
                    />
                    <Text style={styles.primaryButtonText}>
                      Retry Same Quiz
                    </Text>
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

        <Modal visible={showLimitModal} transparent={true} animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { maxHeight: undefined }]}>
              <View style={{ padding: 32, alignItems: "center" }}>
                <MaterialCommunityIcons
                  name="lock-clock"
                  size={64}
                  color="#f59e0b"
                />
                <Text style={styles.modalTitle}>Daily Limit Reached</Text>
                <Text style={styles.modalSubtitle}>
                  You've completed {5 - quizzesLeft} out of 5 free quizzes
                  today.
                </Text>

                {subscription?.isInTrial && (
                  <View
                    style={{
                      backgroundColor: "#fef3c7",
                      padding: 16,
                      borderRadius: 12,
                      marginVertical: 16,
                      width: "100%",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        color: "#92400e",
                        textAlign: "center",
                        fontWeight: "600",
                      }}
                    >
                      🎉 You have {subscription.daysLeftInTrial} days left in
                      your free trial!
                    </Text>
                  </View>
                )}

                <View style={{ width: "100%", gap: 12, marginTop: 16 }}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.primaryButton]}
                    onPress={() => {
                      setShowLimitModal(false);
                      router.push("/SubscriptionScreen");
                    }}
                  >
                    <MaterialCommunityIcons
                      name="crown"
                      size={20}
                      color="#fff"
                    />
                    <Text style={styles.primaryButtonText}>
                      Go Premium - Unlimited Quizzes
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.textButton}
                    onPress={() => {
                      setShowLimitModal(false);
                      router.back();
                    }}
                  >
                    <Text style={styles.textButtonText}>Back to Menu</Text>
                  </TouchableOpacity>
                </View>
              </View>
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
  progressText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#475569",
    textAlign: "center",
    marginBottom: 8,
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
