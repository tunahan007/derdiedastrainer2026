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
import { useRouter } from "expo-router";
import * as Speech from "expo-speech";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { quizMainData } from "./words";
import ABanner from "./banner";
import { openDatabaseSync } from "expo-sqlite";
import {
  getSubscriptionStatus,
  hasFeatureAccess,
  FEATURES,
} from "./SubscriptionManager";

const db = openDatabaseSync("appdata.db");

const PracticeFailedWords = () => {
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
  const [isSoundOn, setSoundOn] = useState(false);
  const [isProcessingClick, setIsProcessingClick] = useState(false);
  const [failureData, setFailureData] = useState([]);
  const [correctData, setCorrectData] = useState([]);
  const [fadeAnim] = useState(new Animated.Value(1));
  const [subscription, setSubscription] = useState(null);
  const [quizData, setQuizData] = useState([]);
  const [lastQuizData, setLastQuizData] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    const subStatus = await getSubscriptionStatus();
    setSubscription(subStatus);

    // Check if user has premium access
    const hasAccess = await hasFeatureAccess(FEATURES.ADVANCED_STATS);

    if (!hasAccess && !subStatus?.isInTrial) {
      Alert.alert(
        "Premium Feature",
        "Practice Failed Words is a premium feature. Upgrade to access!",
        [
          { text: "Cancel", onPress: () => router.back() },
          {
            text: "Go Premium",
            onPress: () => router.push("/SubscriptionScreen"),
          },
        ],
      );
      return;
    }

    await loadFailedWords();
  };

  const loadFailedWords = async () => {
    try {
      // Get all failed words from database
      const words = await db.getAllAsync(
        `SELECT * FROM failed_words 
         ORDER BY failCount DESC, lastFailed DESC`,
      );

      if (!words || words.length === 0) {
        Alert.alert(
          "No Failed Words",
          "You haven't made any mistakes yet! Try the regular trainer first.",
          [{ text: "OK", onPress: () => router.back() }],
        );
        return;
      }

      // Convert failed words to quiz format
      const failedQuiz = words.map((item) => {
        // Find the original word data to get the image
        const originalWord = quizMainData.find(
          (w) => w.question.toLowerCase() === item.word.toLowerCase(),
        );

        return {
          question: item.word,
          correctAnswer: item.correctArticle,
          image: originalWord?.image,
          englishName: originalWord?.englishName || "",
          failCount: item.failCount,
        };
      });

      // Take up to 20 most failed words
      const quiz = failedQuiz.slice(0, 20);
      setQuizData(quiz);
      setLastQuizData(quiz);
      setLoading(false);
    } catch (error) {
      console.error("Error loading failed words:", error);
      Alert.alert("Error", "Could not load failed words. Please try again.");
      router.back();
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

  const saveFailedWord = async (word, correctArticle, wrongArticle) => {
    try {
      await db.runAsync(
        `UPDATE failed_words 
         SET failCount = failCount + 1, 
             wrongArticle = ?,
             lastFailed = ?
         WHERE word = ? AND correctArticle = ?`,
        [wrongArticle, new Date().toISOString(), word, correctArticle],
      );
    } catch (error) {
      console.error("saveFailedWord error:", error);
    }
  };

  const removeFromFailedWords = async (word, correctArticle) => {
    try {
      // Decrease fail count when answered correctly
      await db.runAsync(
        `UPDATE failed_words 
         SET failCount = CASE 
           WHEN failCount > 1 THEN failCount - 1 
           ELSE failCount 
         END
         WHERE word = ? AND correctArticle = ?`,
        [word, correctArticle],
      );
    } catch (error) {
      console.error("removeFromFailedWords error:", error);
    }
  };

  const handleAnswer = async (article) => {
    const questionEndTime = Date.now();
    const timeSpent = Math.round((questionEndTime - questionStartTime) / 1000);
    const newQuestionTimes = [...questionTimes, timeSpent];
    setQuestionTimes(newQuestionTimes);

    setSelectedAnswer(article);
    setCount((prev) => prev + 1);

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

      // Decrease fail count for this word
      await removeFromFailedWords(
        currentQuestion.question,
        currentQuestion.correctAnswer,
      );

      correctData.push(article + " " + currentQuestion.question);
    } else {
      newFails++;
      setFails(newFails);
      setIsWrong(true);

      newStreak = 0;
      setCurrentStreak(0);

      // Increase fail count again
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

  const handleMenu = () => {
    Speech.stop();
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
    setSessionStartTime(Date.now());
    setQuestionStartTime(Date.now());
    setQuestionTimes([]);
    setCurrentStreak(0);
    setBestStreakInSession(0);
  };

  const handleNewPractice = async () => {
    Speech.stop();
    setShowModal(false);
    setLoading(true);
    await loadFailedWords();
    setScore(0);
    setFails(0);
    setCount(0);
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setFailureData([]);
    setCorrectData([]);
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

  if (loading || quizData.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <MaterialCommunityIcons name="loading" size={48} color="#6366f1" />
          <Text style={styles.loadingText}>Loading your failed words...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentQuestion = quizData[currentQuestionIndex];
  const progressPercentage =
    ((currentQuestionIndex + 1) / quizData.length) * 100;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header with Premium Badge */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconButton} onPress={toggleSound}>
            <MaterialCommunityIcons
              name={isSoundOn ? "volume-high" : "volume-off"}
              size={24}
              color="#475569"
            />
          </TouchableOpacity>

          <View style={styles.progressContainer}>
            <View style={styles.titleContainer}>
              <MaterialCommunityIcons name="crown" size={16} color="#fbbf24" />
              <Text style={styles.headerTitle}>Practice Failed Words</Text>
            </View>
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
          </View>

          <TouchableOpacity
            style={styles.iconButton}
            onPress={handleButtonClick(handleMenu)}
          >
            <MaterialCommunityIcons name="close" size={24} color="#475569" />
          </TouchableOpacity>
        </View>

        {/* Fail Count Badge */}
        {currentQuestion?.failCount > 1 && (
          <View style={styles.failBadge}>
            <MaterialCommunityIcons name="alert" size={16} color="#ef4444" />
            <Text style={styles.failBadgeText}>
              Failed {currentQuestion.failCount}× before
            </Text>
          </View>
        )}

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

        {/* Results Modal */}
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
                          : "school"
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
                    ? "Perfect! 🎉"
                    : score >= quizData.length * 0.7
                      ? "Great Progress! 👏"
                      : "Keep Practicing! 💪"}
                </Text>

                <View style={styles.scoreCard}>
                  <Text style={styles.modalScoreNumber}>{score}</Text>
                  <Text style={styles.modalScoreDivider}>/</Text>
                  <Text style={styles.modalScoreTotal}>{quizData.length}</Text>
                </View>

                <Text style={styles.modalSubtitle}>
                  {score === quizData.length
                    ? "You've mastered these challenging words!"
                    : `${((score / quizData.length) * 100).toFixed(0)}% correct - You're improving!`}
                </Text>

                {fails > 0 && (
                  <View style={styles.modalWrongAnswers}>
                    <Text style={styles.modalWrongAnswersTitle}>
                      Still Need Practice ({fails})
                    </Text>
                    {failureData.slice(0, 5).map((item, index) => {
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
                    onPress={handleNewPractice}
                  >
                    <MaterialCommunityIcons
                      name="refresh"
                      size={20}
                      color="#fff"
                    />
                    <Text style={styles.primaryButtonText}>Practice Again</Text>
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
                      Retry Same Words
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.textButton}
                    onPress={handleMenu}
                  >
                    <Text style={styles.textButtonText}>
                      Back to Statistics
                    </Text>
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#64748b",
    fontWeight: "600",
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
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6366f1",
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
  failBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fef2f2",
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 20,
    gap: 6,
  },
  failBadgeText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#ef4444",
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

export default PracticeFailedWords;
