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
  const router = useRouter();

  const initialQuiz = () =>
    [...quizMainData].sort(() => Math.random() - 0.5).slice(0, 20);

  const [quizData, setQuizData] = useState(initialQuiz());
  const [lastQuizData, setLastQuizData] = useState(quizData);

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
      failureData.push(
        `${article} ${currentQuestion.question} => ✔︎ ${currentQuestion.correctAnswer} ${currentQuestion.question}`
      );
    }

    if (currentQuestionIndex + 1 >= quizData.length) {
      setShowModal(true);

      const sessionEndTime = Date.now();
      const sessionDuration = Math.round(
        (sessionEndTime - sessionStartTime) / 1000
      );
      const progress = ((newScore / quizData.length) * 100).toFixed(1);

      try {
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
        console.log("✅ Statistik gespeichert");
      } catch (error) {
        console.error("❌ Statistik Fehler:", error);
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

  const replayQuiz = () => {
    if (lastQuizData?.length > 0) {
      setQuizData(lastQuizData);
      setSessionStartTime(Date.now());
      setCount(0);
      setScore(0);
      setFails(0);
      setCurrentQuestionIndex(0);
      setSelectedAnswer(null);
      setIsWrong(false);
      setFailureData([]);
      setCorrectData([]);
      setShowModal(false);
    } else {
      resetQuiz();
    }
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

          <TouchableOpacity style={styles.iconButton} onPress={handleMenu}>
            <MaterialCommunityIcons name="home" size={24} color="#6366f1" />
          </TouchableOpacity>
        </View>

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
                  {failureData.slice(0, 5).map((wrongAnswer, index) => {
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
                          <Text style={styles.correctText}>{correctAnsw}</Text>
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
                  style={[styles.modalButton, styles.secondaryButton]}
                  onPress={replayQuiz}
                >
                  <MaterialCommunityIcons
                    name="replay"
                    size={20}
                    color="#6366f1"
                  />
                  <Text style={styles.secondaryButtonText}>Wiederholen</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.textButton}
                  onPress={handleMenu}
                >
                  <Text style={styles.textButtonText}>Zurück zum Menü</Text>
                </TouchableOpacity>
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
    paddingTop: 17, // ⬅️ vorher 24 – mehr Abstand von der Android-Statusleiste
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
    paddingBottom: 24, // ⬅️ vorher 8 – mehr Abstand vom unteren Android-Menü
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
    padding: 32,
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.25,
    shadowRadius: 25,
    elevation: 15,
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
  secondaryButton: {
    backgroundColor: "#eef2ff",
    borderWidth: 2,
    borderColor: "#c7d2fe",
  },
  secondaryButtonText: {
    color: "#6366f1",
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
