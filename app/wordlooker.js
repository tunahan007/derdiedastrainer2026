import React, { useState, useEffect, useRef } from "react";
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
import { useRouter } from "expo-router";
import * as Speech from "expo-speech";
import { FontAwesome, MaterialCommunityIcons } from "@expo/vector-icons";
import { quizMainData } from "./words";
import WordIcon, { CATEGORY_THEME } from "./WordIcon";
import ABanner from "./banner";
import { useTranslation } from "react-i18next";

// ── Constants ────────────────────────────────────────────────────────────────
const LEVELS = ["Alle", "A1", "A2", "B1"];
const LEVEL_COLORS = {
  Alle: "#6366f1",
  A1: "#10b981",
  A2: "#3b82f6",
  B1: "#8b5cf6",
};

const shuffleArray = (array) => {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const buildWordList = (level) => {
  const filtered =
    !level || level === "Alle"
      ? quizMainData
      : quizMainData.filter((w) => w.level === level);
  return shuffleArray(filtered.length >= 5 ? filtered : quizMainData);
};

// ── Component ────────────────────────────────────────────────────────────────
const App = () => {
  const { t, i18n } = useTranslation();
  const router = useRouter();

  const [selectedLevel, setSelectedLevel] = useState("Alle");
  const [showLevelPicker, setShowLevelPicker] = useState(false);
  const [quizData, setQuizData] = useState(() => buildWordList("Alle"));
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [isSoundOn, setSoundOn] = useState(true);
  const [isProcessingClick, setIsProcessingClick] = useState(false);
  const [showSentencePopup, setShowSentencePopup] = useState(false);

  const buttonAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // ── Helpers ────────────────────────────────────────────────────────────────

  const getTranslation = (word) => {
    if (!word) return "";
    const lang = i18n.language;
    return (
      word.translations?.[lang] || word.translations?.["en"] || word.englishName
    );
  };

  const toggleSound = () => setSoundOn((prev) => !prev);

  const speakWord = () => {
    if (currentQuestionIndex >= quizData.length) return;
    Speech.stop();
    const w = quizData[currentQuestionIndex];
    const text = `${w.correctAnswer} ${w.question}`;
    if (isSoundOn) Speech.speak(text, { language: "de" });
  };

  const handleButtonClick = (handler) => () => {
    if (!isProcessingClick) {
      setIsProcessingClick(true);
      handler();
      setTimeout(() => setIsProcessingClick(false), 400);
    }
  };

  const animateTransition = (callback) => {
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start();
    setTimeout(callback, 120);
  };

  const handleNext = () => {
    if (currentQuestionIndex + 1 >= quizData.length) {
      setShowModal(true);
    } else {
      animateTransition(() => setCurrentQuestionIndex((i) => i + 1));
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      animateTransition(() => setCurrentQuestionIndex((i) => i - 1));
    }
  };

  const handleNewList = () => {
    const newData = buildWordList(selectedLevel);
    setQuizData(newData);
    setCurrentQuestionIndex(0);
    setShowModal(false);
  };

  const handleRestart = () => {
    setCurrentQuestionIndex(0);
    setShowModal(false);
  };

  const handleLevelChange = (level) => {
    setSelectedLevel(level);
    setQuizData(buildWordList(level));
    setCurrentQuestionIndex(0);
    setShowLevelPicker(false);
  };

  // ── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    try {
      speakWord();
    } catch (e) {}
    buttonAnim.setValue(0);
    Animated.spring(buttonAnim, {
      toValue: 1,
      friction: 5,
      useNativeDriver: true,
    }).start();
  }, [currentQuestionIndex]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (showModal) {
          setShowModal(false);
          return true;
        }
        if (showLevelPicker) {
          setShowLevelPicker(false);
          return true;
        }
        return false;
      },
    );
    return () => backHandler.remove();
  }, [showModal, showLevelPicker]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const current = quizData[currentQuestionIndex];
  const progressPercentage =
    ((currentQuestionIndex + 1) / quizData.length) * 100;
  const levelColor = LEVEL_COLORS[selectedLevel] || "#6366f1";

  const animatedStyle = {
    transform: [
      {
        scale: buttonAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.85, 1],
        }),
      },
    ],
    opacity: buttonAnim,
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconButton} onPress={toggleSound}>
            <FontAwesome
              name={isSoundOn ? "volume-up" : "volume-off"}
              size={22}
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
                  {
                    width: `${progressPercentage}%`,
                    backgroundColor: levelColor,
                  },
                ]}
              />
            </View>
          </View>

          {/* Level Picker Button */}
          <TouchableOpacity
            style={[styles.levelChip, { backgroundColor: levelColor }]}
            onPress={() => setShowLevelPicker(true)}
          >
            <Text style={styles.levelChipText}>
              {selectedLevel === "Alle" ? t("allLabel") : selectedLevel}
            </Text>
            <MaterialCommunityIcons
              name="chevron-down"
              size={14}
              color="#fff"
            />
          </TouchableOpacity>
        </View>

        {/* Word Display */}
        <Animated.View style={[styles.wordContainer, { opacity: fadeAnim }]}>
          {/* Image or WordIcon */}
          <TouchableOpacity
            onPress={() => {
              speakWord();
              if (current?.sentences) setShowSentencePopup(true);
            }}
            activeOpacity={0.85}
            style={styles.imageContainer}
          >
            {current?.image ? (
              <Image source={current.image} style={styles.image} />
            ) : (
              <WordIcon word={current} size={240} />
            )}
            <View style={styles.speakHint}>
              <FontAwesome name="volume-up" size={14} color="#6366f1" />
              <Text style={styles.speakHintText}>{t("tapToHear")}</Text>
            </View>
            {current?.sentences && (
              <View style={styles.sentenceHint}>
                <MaterialCommunityIcons
                  name="text-box-outline"
                  size={13}
                  color="#8b5cf6"
                />
                <Text style={styles.sentenceHintText}>
                  Tippe für Beispielsätze
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Text Card */}
          <View style={styles.textCard}>
            {/* Article badge */}
            <View
              style={[styles.articleBadge, { backgroundColor: levelColor }]}
            >
              <Text style={styles.articleBadgeText}>
                {current?.correctAnswer}
              </Text>
            </View>

            <Text style={styles.word}>{current?.question}</Text>
            <Text style={styles.englishWord}>{getTranslation(current)}</Text>

            {/* Level + Category tags */}
            <View style={styles.tagsRow}>
              {current?.level && (
                <View
                  style={[
                    styles.tag,
                    {
                      backgroundColor: levelColor + "20",
                      borderColor: levelColor + "40",
                    },
                  ]}
                >
                  <Text style={[styles.tagText, { color: levelColor }]}>
                    {current.level}
                  </Text>
                </View>
              )}
              {current?.category && (
                <View style={styles.tagCategory}>
                  <Text style={styles.tagCategoryText}>
                    {CATEGORY_THEME[current.category]?.emoji || "📝"}{" "}
                    {current.category}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </Animated.View>

        {/* Navigation */}
        <Animated.View style={[styles.buttonRow, animatedStyle]}>
          <TouchableOpacity
            onPress={handleButtonClick(handlePrevious)}
            style={[
              styles.navButton,
              currentQuestionIndex === 0 && styles.disabledButton,
            ]}
            disabled={currentQuestionIndex === 0}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name="skip-previous"
              size={36}
              color={currentQuestionIndex === 0 ? "#cbd5e1" : "#6366f1"}
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.homeButton}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="home" size={28} color="#6366f1" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleButtonClick(handleNext)}
            style={styles.navButton}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name="skip-next"
              size={36}
              color="#6366f1"
            />
          </TouchableOpacity>
        </Animated.View>

        {/* Banner */}
        <View style={styles.bannerWrapper}>
          <ABanner />
        </View>

        {/* ── Level Picker Modal ──────────────────────────────────────────── */}
        <Modal visible={showLevelPicker} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.pickerSheet}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>{t("selectLevel")}</Text>
                <TouchableOpacity onPress={() => setShowLevelPicker(false)}>
                  <MaterialCommunityIcons
                    name="close"
                    size={24}
                    color="#64748b"
                  />
                </TouchableOpacity>
              </View>
              <ScrollView>
                {LEVELS.map((level) => {
                  const isSelected = selectedLevel === level;
                  const color = LEVEL_COLORS[level];
                  const count =
                    level === "Alle"
                      ? quizMainData.length
                      : quizMainData.filter((w) => w.level === level).length;
                  return (
                    <TouchableOpacity
                      key={level}
                      style={[
                        styles.pickerRow,
                        isSelected && { backgroundColor: color + "15" },
                      ]}
                      onPress={() => handleLevelChange(level)}
                    >
                      <View
                        style={[styles.pickerDot, { backgroundColor: color }]}
                      />
                      <View style={styles.pickerInfo}>
                        <Text
                          style={[styles.pickerLabel, isSelected && { color }]}
                        >
                          {level === "Alle" ? t("allLabel") : level}
                        </Text>
                        <Text style={styles.pickerCount}>
                          {count} {t("words")}
                        </Text>
                      </View>
                      {isSelected && (
                        <MaterialCommunityIcons
                          name="check-circle"
                          size={22}
                          color={color}
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* ── Completion Modal ────────────────────────────────────────────── */}
        <Modal visible={showModal} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <MaterialCommunityIcons
                name="check-decagram"
                size={72}
                color="#10b981"
              />
              <Text style={styles.modalTitle}>Liste abgeschlossen! 🎉</Text>
              <Text style={styles.modalSubtitle}>
                {quizData.length} Wörter durchgesehen
              </Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.primaryButton]}
                  onPress={handleNewList}
                >
                  <MaterialCommunityIcons
                    name="refresh"
                    size={20}
                    color="#fff"
                  />
                  <Text style={styles.primaryButtonText}>{t("newQuiz")}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.secondaryButton]}
                  onPress={handleRestart}
                >
                  <MaterialCommunityIcons
                    name="replay"
                    size={20}
                    color="#6366f1"
                  />
                  <Text style={styles.secondaryButtonText}>Von vorne</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.textButton}
                  onPress={() => router.back()}
                >
                  <Text style={styles.textButtonText}>{t("backToMenu")}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Sentence Popup */}
        <Modal visible={showSentencePopup} animationType="slide" transparent>
          <View style={styles.sentenceOverlay}>
            <View style={styles.sentenceSheet}>
              <View style={styles.sentenceSheetHeader}>
                <View style={styles.sentenceWordRow}>
                  <View
                    style={[
                      styles.articleMini,
                      {
                        backgroundColor:
                          LEVEL_COLORS[current?.level] || "#6366f1",
                      },
                    ]}
                  >
                    <Text style={styles.articleMiniText}>
                      {current?.correctAnswer}
                    </Text>
                  </View>
                  <Text style={styles.sentenceWordTitle}>
                    {current?.question}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setShowSentencePopup(false)}>
                  <MaterialCommunityIcons
                    name="close"
                    size={22}
                    color="#64748b"
                  />
                </TouchableOpacity>
              </View>

              {/* Nominativ sentence - main */}
              <View style={styles.sentenceMainCard}>
                <Text style={styles.sentenceNomLabel}>Nominativ</Text>
                <Text style={styles.sentenceNomText}>
                  {current?.sentences?.nom}
                </Text>
              </View>

              {/* Go to Sentences screen */}
              <TouchableOpacity
                style={styles.sentenceMoreBtn}
                onPress={() => {
                  setShowSentencePopup(false);
                  router.push("/sentences");
                }}
              >
                <MaterialCommunityIcons
                  name="text-box-multiple-outline"
                  size={18}
                  color="#fff"
                />
                <Text style={styles.sentenceMoreBtnText}>
                  Alle 4 Fälle ansehen →
                </Text>
              </TouchableOpacity>

              <Text style={styles.sentenceHintBottom}>
                Akkusativ · Dativ · Genitiv im Sentences-Bereich
              </Text>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
};

export default App;

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f8fafc" },
  container: { flex: 1, backgroundColor: "#f8fafc" },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    gap: 10,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
  },
  progressContainer: { flex: 1 },
  progressText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
    textAlign: "center",
    marginBottom: 6,
  },
  progressBarBg: {
    height: 7,
    backgroundColor: "#e2e8f0",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: { height: "100%", borderRadius: 4 },
  levelChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  levelChipText: { fontSize: 13, fontWeight: "700", color: "#fff" },

  // Word area
  wordContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  imageContainer: { alignItems: "center", marginBottom: 20 },
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
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: "#eef2ff",
    borderRadius: 20,
    gap: 6,
  },
  speakHintText: { fontSize: 12, color: "#6366f1", fontWeight: "500" },

  // Text card
  textCard: {
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 28,
    paddingVertical: 20,
    borderRadius: 20,
    maxWidth: "92%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    gap: 6,
  },
  articleBadge: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 4,
  },
  articleBadgeText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 1,
  },
  word: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1e293b",
    textAlign: "center",
  },
  englishWord: {
    fontSize: 16,
    color: "#64748b",
    fontWeight: "500",
    textAlign: "center",
  },
  tagsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  tagText: { fontSize: 11, fontWeight: "700" },
  tagCategory: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
  },
  tagCategoryText: { fontSize: 11, color: "#64748b", fontWeight: "500" },

  // Navigation
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  navButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  disabledButton: { backgroundColor: "#f1f5f9", shadowOpacity: 0.02 },
  homeButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#eef2ff",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#c7d2fe",
  },

  // Banner
  bannerWrapper: {
    alignItems: "center",
    paddingTop: 6,
    paddingBottom: 32,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },

  // Level picker
  pickerSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    maxHeight: "60%",
  },
  pickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  pickerTitle: { fontSize: 18, fontWeight: "700", color: "#1e293b" },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    gap: 14,
  },
  pickerDot: { width: 14, height: 14, borderRadius: 7 },
  pickerInfo: { flex: 1 },
  pickerLabel: { fontSize: 16, fontWeight: "600", color: "#1e293b" },
  pickerCount: { fontSize: 12, color: "#94a3b8", marginTop: 2 },

  // Completion modal
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 32,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1e293b",
    marginTop: 12,
    marginBottom: 8,
  },
  modalSubtitle: { fontSize: 15, color: "#64748b", marginBottom: 24 },
  modalButtons: { width: "100%", gap: 10 },
  modalButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 14,
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
  textButton: { paddingVertical: 10, alignItems: "center" },
  textButtonText: { color: "#64748b", fontSize: 14, fontWeight: "600" },
  // Sentence hint
  sentenceHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "#f5f3ff",
    borderRadius: 20,
  },
  sentenceHintText: { fontSize: 11, color: "#8b5cf6", fontWeight: "500" },
  sentenceOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sentenceSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 36,
    gap: 14,
  },
  sentenceSheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sentenceWordRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  articleMini: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  articleMiniText: { fontSize: 13, fontWeight: "800", color: "#fff" },
  sentenceWordTitle: { fontSize: 22, fontWeight: "700", color: "#1e293b" },
  sentenceMainCard: {
    backgroundColor: "#f0fdf4",
    borderRadius: 14,
    padding: 16,
    borderLeftWidth: 3,
    borderLeftColor: "#10b981",
  },
  sentenceNomLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#10b981",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  sentenceNomText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1e293b",
    lineHeight: 24,
  },
  sentenceMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#6366f1",
    paddingVertical: 14,
    borderRadius: 14,
  },
  sentenceMoreBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
  sentenceHintBottom: { fontSize: 12, color: "#94a3b8", textAlign: "center" },
});
