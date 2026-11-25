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
  Vibration,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import * as Speech from "expo-speech";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { quizMainData } from "./words";
import WordIcon from "./WordIcon";
import ABanner from "./banner";
import { openDatabaseSync } from "expo-sqlite";
import {
  CorrectFlash,
  WrongFlash,
  ScorePop,
  ConfettiBurst,
  useShakeAnimation,
} from "../lib/QuizAnimations";

const db = openDatabaseSync("appdata.db");

const PracticeFailedWords = () => {
  const { t } = useTranslation();
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
  const [quizData, setQuizData] = useState([]);
  const [lastQuizData, setLastQuizData] = useState([]);
  const [loading, setLoading] = useState(true);
  // Live fail count of the current word (badge updates immediately on answer)
  const [currentFailCount, setCurrentFailCount] = useState(0);
  // Feedback animations (trigger counters)
  const [flashKey, setFlashKey] = useState(0);
  const [wrongFlashKey, setWrongFlashKey] = useState(0);
  const [hintKey, setHintKey] = useState(0);
  const [correctHint, setCorrectHint] = useState("");
  const [popKey, setPopKey] = useState(0);
  const [confettiKey, setConfettiKey] = useState(0);
  const { shakeAnim, shake } = useShakeAnimation();

  const router = useRouter();

  useEffect(() => {
    setCurrentFailCount(quizData[currentQuestionIndex]?.failCount ?? 0);
  }, [currentQuestionIndex, quizData]);

  useEffect(() => {
    loadFailedWords();
  }, []);

  const loadFailedWords = async () => {
    try {
      const words = await db.getAllAsync(
        `SELECT * FROM failed_words WHERE failCount > 0 ORDER BY failCount DESC, lastFailed DESC`,
      );

      if (!words || words.length === 0) {
        Alert.alert(t("noFailedWordsTitle"), t("noFailedWordsMsg"), [
          { text: t("ok"), onPress: () => router.back() },
        ]);
        return;
      }

      // ── FIX: use w.q instead of w.question ───────────────────────────────
      const failedQuiz = words.map((item) => {
        const originalWord = quizMainData.find(
          (w) => w.q && w.q.toLowerCase() === item.word.toLowerCase(),
        );

        return {
          q: item.word,
          a: item.correctArticle,
          img: originalWord?.img || null,
          emoji: originalWord?.emoji || "📝",
          en: originalWord?.en || "",
          l: originalWord?.l || "",
          c: originalWord?.c || "",
          failCount: item.failCount,
        };
      });

      const quiz = failedQuiz.slice(0, 20);
      setQuizData(quiz);
      setLastQuizData(quiz);
      setLoading(false);
    } catch (error) {
      console.error("Error loading failed words:", error);
      Alert.alert(t("errorTitle"), t("loadFailedWordsError"));
      router.back();
    }
  };

  // ── Speech ────────────────────────────────────────────────────────────────
  const speakWord = () => {
    Speech.stop();
    const word = quizData[currentQuestionIndex]?.q;
    if (isSoundOn && word) {
      try {
        Speech.speak(word, { language: "de" });
      } catch (e) {
        console.error("Speech:", e);
      }
    }
  };

  const toggleSound = () => setSoundOn(!isSoundOn);

  const handleButtonClick = (fn) => () => {
    if (!isProcessingClick) {
      setIsProcessingClick(true);
      fn();
      setTimeout(() => setIsProcessingClick(false), 1000);
    }
  };

  // ── DB ────────────────────────────────────────────────────────────────────
  const saveFailedWord = async (word, correctArticle, wrongArticle) => {
    try {
      await db.runAsync(
        `UPDATE failed_words SET failCount = failCount + 1, wrongArticle = ?, lastFailed = ?
         WHERE word = ? AND correctArticle = ?`,
        [wrongArticle, new Date().toISOString(), word, correctArticle],
      );
    } catch (e) {
      console.error("saveFailedWord:", e);
    }
  };

  const removeFromFailedWords = async (word, correctArticle) => {
    try {
      const result = await db.getFirstAsync(
        `SELECT failCount FROM failed_words WHERE word = ? AND correctArticle = ?`,
        [word, correctArticle],
      );
      if (!result) return;
      if (result.failCount > 1) {
        await db.runAsync(
          `UPDATE failed_words SET failCount = failCount - 1 WHERE word = ? AND correctArticle = ?`,
          [word, correctArticle],
        );
      } else {
        await db.runAsync(
          `UPDATE failed_words SET failCount = 0 WHERE word = ? AND correctArticle = ?`,
          [word, correctArticle],
        );
      }
    } catch (e) {
      console.error("removeFromFailedWords:", e);
    }
  };

  // ── Answer ────────────────────────────────────────────────────────────────
  const handleAnswer = async (article) => {
    const timeSpent = Math.round((Date.now() - questionStartTime) / 1000);
    setQuestionTimes((prev) => [...prev, timeSpent]);
    setSelectedAnswer(article);
    setCount((prev) => prev + 1);

    const current = quizData[currentQuestionIndex];
    let newScore = score;
    let newFails = fails;
    let newStreak = currentStreak;
    const isLastQuestion = currentQuestionIndex + 1 >= quizData.length;

    if (current.a === article) {
      newScore++;
      setScore(newScore);
      newStreak++;
      setCurrentStreak(newStreak);
      if (newStreak > bestStreakInSession) setBestStreakInSession(newStreak);
      // Badge sofort aktualisieren (z. B. 3x → 2x)
      const reduced = Math.max(0, (current.failCount ?? 0) - 1);
      current.failCount = reduced;
      setCurrentFailCount(reduced);
      setFlashKey((k) => k + 1);
      setPopKey((k) => k + 1);
      if (newStreak % 3 === 0 || isLastQuestion) setConfettiKey((k) => k + 1);
      await removeFromFailedWords(current.q, current.a);
      correctData.push(`${article} ${current.q}`);
    } else {
      newFails++;
      setFails(newFails);
      setIsWrong(true);
      newStreak = 0;
      setCurrentStreak(0);
      const increased = (current.failCount ?? 0) + 1;
      current.failCount = increased;
      setCurrentFailCount(increased);
      Vibration.vibrate([0, 80, 60, 80]);
      shake();
      setWrongFlashKey((k) => k + 1);
      // Show the correct article right away
      setCorrectHint(current.a);
      setHintKey((k) => k + 1);
      await saveFailedWord(current.q, current.a, article);
      failureData.push(
        `${article} ${current.q} => ✔️ ${current.a} ${current.q}`,
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
      }, current.a === article ? 300 : 900); // wrong: more time to read the correct article
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
    setIsWrong(false);
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
    setIsWrong(false);
    setFailureData([]);
    setCorrectData([]);
    setSessionStartTime(Date.now());
    setQuestionStartTime(Date.now());
    setQuestionTimes([]);
    setCurrentStreak(0);
    setBestStreakInSession(0);
  };

  useEffect(() => {
    const back = BackHandler.addEventListener("hardwareBackPress", () => {
      if (showModal) {
        handleMenu();
        return true;
      }
      return false;
    });
    return () => back.remove();
  }, [showModal]);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading || quizData.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <MaterialCommunityIcons name="loading" size={48} color="#6366f1" />
          <Text style={styles.loadingText}>{t("loadingFailedWords")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentQuestion = quizData[currentQuestionIndex];
  const progressPct = ((currentQuestionIndex + 1) / quizData.length) * 100;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
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
              <Text style={styles.headerTitle}>{t("practiceFailedWords")}</Text>
            </View>
            <Text style={styles.progressText}>
              {currentQuestionIndex + 1} / {quizData.length}
            </Text>
            <View style={styles.progressBarBg}>
              <View
                style={[styles.progressBarFill, { width: `${progressPct}%` }]}
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

        {/* Fail badge */}
        {currentFailCount > 0 && (
          <View style={styles.failBadge}>
            <MaterialCommunityIcons name="alert" size={16} color="#ef4444" />
            <Text style={styles.failBadgeText}>
              {t("wrongCountBadge", { n: currentFailCount })}
            </Text>
          </View>
        )}

        {/* Quiz Content */}
        <Animated.View style={[styles.quizContent, { opacity: fadeAnim }]}>
          <TouchableOpacity
            onPress={speakWord}
            activeOpacity={0.85}
            style={styles.imageContainer}
          >
            {currentQuestion?.img ? (
              <Image
                source={currentQuestion.img}
                style={styles.image}
                resizeMode="cover"
              />
            ) : (
              <WordIcon word={currentQuestion} size={240} />
            )}
            <View style={styles.speakHint}>
              <MaterialCommunityIcons
                name="volume-high"
                size={16}
                color="#6366f1"
              />
              <Text style={styles.speakHintText}>{t("tapToHear")}</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.wordContainer}>
            <Text style={styles.word}>{currentQuestion?.q}</Text>
            <Text style={styles.englword}>{currentQuestion?.en}</Text>
            {currentQuestion?.l ? (
              <View style={styles.levelBadge}>
                <Text style={styles.levelBadgeText}>{currentQuestion.l}</Text>
              </View>
            ) : null}
          </View>
        </Animated.View>

        {/* Answer Buttons */}
        <Animated.View
          style={[
            styles.buttonContainer,
            { transform: [{ translateX: shakeAnim }] },
          ]}
        >
          {["der", "die", "das"].map((article) => (
            <TouchableOpacity
              key={article}
              style={[
                styles.answerButton,
                selectedAnswer === article &&
                  currentQuestion.a === article &&
                  styles.selectedButton,
                selectedAnswer === article &&
                  currentQuestion.a !== article &&
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
        </Animated.View>

        <View style={styles.bannerContainer}>
          <ABanner />
        </View>

        {/* Feedback overlays */}
        <CorrectFlash trigger={flashKey} />
        <WrongFlash trigger={wrongFlashKey} />
        <ScorePop trigger={hintKey} text={`✓ ${correctHint}`} duration={1100} />
        <ScorePop trigger={popKey} />
        <ConfettiBurst trigger={confettiKey} />

        {/* Results Modal */}
        <Modal
          visible={showModal}
          transparent
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
                  style={{ marginBottom: 16 }}
                />

                <Text style={styles.modalTitle}>
                  {score === quizData.length
                    ? t("practicePerfect")
                    : score >= quizData.length * 0.7
                      ? t("practiceGoodProgress")
                      : t("practiceKeepGoing")}
                </Text>

                <View style={styles.scoreCard}>
                  <Text style={styles.modalScoreNumber}>{score}</Text>
                  <Text style={styles.modalScoreDivider}>/</Text>
                  <Text style={styles.modalScoreTotal}>{quizData.length}</Text>
                </View>

                {bestStreakInSession > 2 && (
                  <View style={styles.streakRow}>
                    <MaterialCommunityIcons
                      name="fire"
                      size={18}
                      color="#f97316"
                    />
                    <Text style={styles.streakText}>
                      {t("bestStreakLabel", { n: bestStreakInSession })}
                    </Text>
                  </View>
                )}

                {fails > 0 && (
                  <View style={styles.modalWrongAnswers}>
                    <Text style={styles.modalWrongAnswersTitle}>
                      {t("needsPractice", { n: fails })}
                    </Text>
                    {failureData.slice(0, 5).map((item, idx) => {
                      const parts = item.split("=>");
                      return (
                        <View key={idx} style={styles.wrongItem}>
                          <View style={styles.wrongItemRow}>
                            <MaterialCommunityIcons
                              name="close-circle"
                              size={16}
                              color="#ef4444"
                            />
                            <Text style={styles.wrongText}>
                              {parts[0]?.trim()}
                            </Text>
                          </View>
                          <View style={styles.correctItemRow}>
                            <MaterialCommunityIcons
                              name="check-circle"
                              size={16}
                              color="#10b981"
                            />
                            <Text style={styles.correctText}>
                              {parts[1]?.trim()}
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
                    onPress={handleNewPractice}
                  >
                    <MaterialCommunityIcons
                      name="refresh"
                      size={20}
                      color="#fff"
                    />
                    <Text style={styles.primaryButtonText}>{t("reloadPractice")}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.secondaryButton]}
                    onPress={handleRetry}
                  >
                    <MaterialCommunityIcons
                      name="replay"
                      size={20}
                      color="#6366f1"
                    />
                    <Text style={styles.secondaryButtonText}>
                      {t("repeatAgain")}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.textButton}
                    onPress={handleMenu}
                  >
                    <Text style={styles.textButtonText}>
                      {t("backToStatistics")}
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

export default PracticeFailedWords;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f8fafc" },
  container: { flex: 1, backgroundColor: "#f8fafc" },
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
  progressContainer: { flex: 1, marginHorizontal: 16 },
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginBottom: 4,
  },
  headerTitle: { fontSize: 13, fontWeight: "700", color: "#6366f1" },
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
    backgroundColor: "#ef4444",
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
  failBadgeText: { fontSize: 13, fontWeight: "600", color: "#ef4444" },

  quizContent: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  imageContainer: { alignItems: "center", marginBottom: 24 },
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
    gap: 6,
  },
  speakHintText: { fontSize: 13, color: "#6366f1", fontWeight: "500" },

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
    gap: 6,
  },
  word: { fontSize: 32, fontWeight: "700", color: "#1e293b" },
  englword: { fontSize: 16, color: "#64748b", fontWeight: "500" },
  levelBadge: {
    paddingHorizontal: 12,
    paddingVertical: 3,
    backgroundColor: "#fee2e2",
    borderRadius: 10,
  },
  levelBadgeText: { fontSize: 11, fontWeight: "700", color: "#ef4444" },

  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
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
  buttonText: { fontSize: 20, fontWeight: "700", color: "#475569" },
  selectedButton: { backgroundColor: "#10b981", borderColor: "#10b981" },
  wrongButton: { backgroundColor: "#ef4444", borderColor: "#ef4444" },
  selectedButtonText: { color: "#fff" },

  buttonSpacer: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
    height: 80,
    opacity: 0,
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
    backgroundColor: "rgba(0,0,0,0.7)",
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
  modalScrollView: { width: "100%" },
  modalScrollContent: { padding: 32, alignItems: "center" },
  modalTitle: {
    fontSize: 26,
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
  modalScoreNumber: { fontSize: 48, fontWeight: "800", color: "#10b981" },
  modalScoreDivider: {
    fontSize: 32,
    fontWeight: "600",
    color: "#94a3b8",
    marginHorizontal: 8,
  },
  modalScoreTotal: { fontSize: 32, fontWeight: "600", color: "#64748b" },
  streakRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  streakText: { fontSize: 14, fontWeight: "700", color: "#f97316" },
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
  wrongItem: { marginBottom: 12 },
  wrongItemRow: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
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
  modalButtons: { width: "100%", gap: 12 },
  modalButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  primaryButton: { backgroundColor: "#6366f1" },
  primaryButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  secondaryButton: {
    backgroundColor: "#eef2ff",
    borderWidth: 2,
    borderColor: "#c7d2fe",
  },
  secondaryButtonText: { color: "#6366f1", fontSize: 16, fontWeight: "700" },
  textButton: { paddingVertical: 12, alignItems: "center" },
  textButtonText: { color: "#64748b", fontSize: 15, fontWeight: "600" },
});
