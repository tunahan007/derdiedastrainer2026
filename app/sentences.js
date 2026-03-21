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
import { TRANSLATIONS } from "./translations";
import { SENTENCES } from "./sentences_data";
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

const CASES = [
  { key: "n", label: "Nominativ", color: "#10b981", icon: "alpha-n-circle" },
  { key: "a", label: "Akkusativ", color: "#3b82f6", icon: "alpha-a-circle" },
  { key: "d", label: "Dativ", color: "#8b5cf6", icon: "alpha-d-circle" },
  { key: "g", label: "Genitiv", color: "#f59e0b", icon: "alpha-g-circle" },
];

const shuffleArray = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const buildList = (level) => {
  if (!quizMainData || !SENTENCES) return [];
  const base = quizMainData.filter((w) => w && w.q && SENTENCES[w.q]);
  const filtered =
    !level || level === "Alle" ? base : base.filter((w) => w && w.l === level);
  const pool = filtered.length >= 5 ? filtered : base;
  return pool.length > 0 ? shuffleArray(pool) : [];
};

// ── Component ────────────────────────────────────────────────────────────────
export default function SentencesScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();

  const [selectedLevel, setSelectedLevel] = useState("Alle");
  const [showLevelPicker, setShowLevelPicker] = useState(false);
  const [quizData, setQuizData] = useState(() => buildList("Alle"));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [isSoundOn, setSoundOn] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeCase, setActiveCase] = useState("n");

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const buttonAnim = useRef(new Animated.Value(0)).current;

  const current = quizData[currentIndex];
  const levelColor = LEVEL_COLORS[selectedLevel] || "#6366f1";
  const progressPct = ((currentIndex + 1) / quizData.length) * 100;

  // ── Helpers ────────────────────────────────────────────────────────────────

  const getTranslation = (word) => {
    if (!word) return "";
    const lang = i18n.language;
    return (
      TRANSLATIONS[word?.q]?.[lang] || TRANSLATIONS[word?.q]?.["en"] || word?.en
    );
  };

  const speakSentence = (caseKey = activeCase) => {
    if (!SENTENCES[current?.q]) return;
    Speech.stop();
    const text = SENTENCES[current?.q][caseKey] || "";
    if (isSoundOn && text) Speech.speak(text, { language: "de" });
  };

  const throttle = (fn) => () => {
    if (!isProcessing) {
      setIsProcessing(true);
      fn();
      setTimeout(() => setIsProcessing(false), 400);
    }
  };

  const animateTransition = (cb) => {
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
    setTimeout(cb, 120);
  };

  const goNext = () => {
    if (currentIndex + 1 >= quizData.length) {
      setShowModal(true);
    } else {
      animateTransition(() => {
        setCurrentIndex((i) => i + 1);
        setActiveCase("n");
      });
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      animateTransition(() => {
        setCurrentIndex((i) => i - 1);
        setActiveCase("n");
      });
    }
  };

  const handleLevelChange = (level) => {
    setSelectedLevel(level);
    setQuizData(buildList(level));
    setCurrentIndex(0);
    setActiveCase("n");
    setShowLevelPicker(false);
  };

  const handleNewList = () => {
    setQuizData(buildList(selectedLevel));
    setCurrentIndex(0);
    setActiveCase("n");
    setShowModal(false);
  };

  // ── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    try {
      speakSentence("n");
    } catch (e) {}
    buttonAnim.setValue(0);
    Animated.spring(buttonAnim, {
      toValue: 1,
      friction: 5,
      useNativeDriver: true,
    }).start();
  }, [currentIndex]);

  useEffect(() => {
    try {
      speakSentence(activeCase);
    } catch (e) {}
  }, [activeCase]);

  useEffect(() => {
    const back = BackHandler.addEventListener("hardwareBackPress", () => {
      if (showModal) {
        setShowModal(false);
        return true;
      }
      if (showLevelPicker) {
        setShowLevelPicker(false);
        return true;
      }
      return false;
    });
    return () => back.remove();
  }, [showModal, showLevelPicker]);

  // ── Render ─────────────────────────────────────────────────────────────────

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

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => setSoundOn((p) => !p)}
          >
            <FontAwesome
              name={isSoundOn ? "volume-up" : "volume-off"}
              size={22}
              color="#6366f1"
            />
          </TouchableOpacity>

          <View style={styles.progressContainer}>
            <Text style={styles.progressText}>
              {currentIndex + 1} / {quizData.length}
            </Text>
            <View style={styles.progressBarBg}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${progressPct}%`, backgroundColor: levelColor },
                ]}
              />
            </View>
          </View>

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

        {/* Main Content */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={[styles.contentArea, { opacity: fadeAnim }]}>
            {/* Image / WordIcon */}
            <TouchableOpacity
              onPress={() => speakSentence(activeCase)}
              activeOpacity={0.85}
              style={styles.imageContainer}
            >
              {current?.img ? (
                <Image source={current.img} style={styles.image} />
              ) : (
                <WordIcon word={current} size={180} />
              )}
              <View style={styles.speakHint}>
                <FontAwesome name="volume-up" size={13} color="#6366f1" />
                <Text style={styles.speakHintText}>
                  {t("tapToHear") || "Tap to hear"}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Word + translation */}
            <View style={styles.wordHeader}>
              <View
                style={[styles.articleBadge, { backgroundColor: levelColor }]}
              >
                <Text style={styles.articleBadgeText}>{current?.a}</Text>
              </View>
              <Text style={styles.wordText}>{current?.q}</Text>
              <Text style={styles.wordTranslation}>
                {getTranslation(current)}
              </Text>
              {current?.l && (
                <View
                  style={[
                    styles.levelTag,
                    { backgroundColor: levelColor + "20" },
                  ]}
                >
                  <Text style={[styles.levelTagText, { color: levelColor }]}>
                    {current.l}
                  </Text>
                </View>
              )}
            </View>

            {/* Case Tabs */}
            <View style={styles.caseTabs}>
              {CASES.map((c) => (
                <TouchableOpacity
                  key={c.key}
                  style={[
                    styles.caseTab,
                    activeCase === c.key && {
                      backgroundColor: c.color,
                      borderColor: c.color,
                    },
                  ]}
                  onPress={() => setActiveCase(c.key)}
                >
                  <Text
                    style={[
                      styles.caseTabText,
                      activeCase === c.key && styles.caseTabTextActive,
                    ]}
                  >
                    {c.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Sentence Card */}
            {SENTENCES[current?.q] ? (
              <View
                style={[
                  styles.sentenceCard,
                  {
                    borderLeftColor: CASES.find((c) => c.key === activeCase)
                      ?.color,
                  },
                ]}
              >
                <View style={styles.sentenceHeader}>
                  <MaterialCommunityIcons
                    name={
                      CASES.find((c) => c.key === activeCase)?.icon ||
                      "alpha-n-circle"
                    }
                    size={22}
                    color={CASES.find((c) => c.key === activeCase)?.color}
                  />
                  <Text
                    style={[
                      styles.caseLabelBig,
                      { color: CASES.find((c) => c.key === activeCase)?.color },
                    ]}
                  >
                    {CASES.find((c) => c.key === activeCase)?.label}
                  </Text>
                </View>
                <Text style={styles.sentenceText}>
                  {SENTENCES[current?.q][activeCase]}
                </Text>
                <TouchableOpacity
                  style={styles.speakSentenceBtn}
                  onPress={() => speakSentence(activeCase)}
                >
                  <FontAwesome name="volume-up" size={16} color="#6366f1" />
                  <Text style={styles.speakSentenceBtnText}>Anhören</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.noSentenceCard}>
                <MaterialCommunityIcons
                  name="information-outline"
                  size={32}
                  color="#cbd5e1"
                />
                <Text style={styles.noSentenceText}>
                  Kein Beispielsatz verfügbar
                </Text>
              </View>
            )}

            {/* All 4 cases overview */}
            {SENTENCES[current?.q] && (
              <View style={styles.overviewCard}>
                <Text style={styles.overviewTitle}>Alle Formen</Text>
                {CASES.map((c) => (
                  <TouchableOpacity
                    key={c.key}
                    style={[
                      styles.overviewRow,
                      activeCase === c.key && {
                        backgroundColor: c.color + "10",
                      },
                    ]}
                    onPress={() => setActiveCase(c.key)}
                  >
                    <View
                      style={[styles.overviewDot, { backgroundColor: c.color }]}
                    />
                    <View style={styles.overviewContent}>
                      <Text style={[styles.overviewLabel, { color: c.color }]}>
                        {c.label}
                      </Text>
                      <Text style={styles.overviewSentence}>
                        {SENTENCES[current?.q][c.key]}
                      </Text>
                    </View>
                    <MaterialCommunityIcons
                      name="volume-high"
                      size={18}
                      color={c.color + "80"}
                      onPress={() => speakSentence(c.key)}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </Animated.View>
        </ScrollView>

        {/* Navigation */}
        <Animated.View style={[styles.buttonRow, animatedStyle]}>
          <TouchableOpacity
            onPress={throttle(goPrev)}
            style={[
              styles.navButton,
              currentIndex === 0 && styles.disabledButton,
            ]}
            disabled={currentIndex === 0}
          >
            <MaterialCommunityIcons
              name="skip-previous"
              size={34}
              color={currentIndex === 0 ? "#cbd5e1" : "#6366f1"}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.homeButton}
            onPress={() => router.back()}
          >
            <MaterialCommunityIcons name="home" size={26} color="#6366f1" />
          </TouchableOpacity>

          <TouchableOpacity onPress={throttle(goNext)} style={styles.navButton}>
            <MaterialCommunityIcons
              name="skip-next"
              size={34}
              color="#6366f1"
            />
          </TouchableOpacity>
        </Animated.View>

        {/* Banner */}
        <View style={styles.bannerWrapper}>
          <ABanner />
        </View>

        {/* Level Picker */}
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
              {LEVELS.map((level) => {
                const isSelected = selectedLevel === level;
                const color = LEVEL_COLORS[level];
                const total = quizMainData.filter(
                  (w) =>
                    w &&
                    w.q &&
                    SENTENCES[w.q] &&
                    (level === "Alle" || w.l === level),
                ).length;
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
                        {total} {t("words")}
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
            </View>
          </View>
        </Modal>

        {/* Completion Modal */}
        <Modal visible={showModal} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.completionCard}>
              <MaterialCommunityIcons
                name="check-decagram"
                size={64}
                color="#10b981"
              />
              <Text style={styles.completionTitle}>
                Liste abgeschlossen! 🎉
              </Text>
              <Text style={styles.completionSubtitle}>
                {quizData.length} Wörter mit Sätzen geübt
              </Text>
              <View style={styles.completionButtons}>
                <TouchableOpacity
                  style={[styles.btn, styles.btnPrimary]}
                  onPress={handleNewList}
                >
                  <MaterialCommunityIcons
                    name="refresh"
                    size={20}
                    color="#fff"
                  />
                  <Text style={styles.btnPrimaryText}>{t("newQuiz")}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.btnText}
                  onPress={() => router.back()}
                >
                  <Text style={styles.btnTextLabel}>{t("backToMenu")}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f8fafc" },
  container: { flex: 1, backgroundColor: "#f8fafc" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
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

  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  contentArea: { gap: 14 },

  imageContainer: { alignItems: "center" },
  image: {
    width: 180,
    height: 180,
    borderRadius: 16,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  speakHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: "#eef2ff",
    borderRadius: 20,
  },
  speakHintText: { fontSize: 12, color: "#6366f1", fontWeight: "500" },

  wordHeader: { alignItems: "center", gap: 6 },
  articleBadge: { paddingHorizontal: 14, paddingVertical: 3, borderRadius: 16 },
  articleBadgeText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 1,
  },
  wordText: { fontSize: 26, fontWeight: "700", color: "#1e293b" },
  wordTranslation: { fontSize: 15, color: "#64748b", fontWeight: "500" },
  levelTag: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  levelTagText: { fontSize: 11, fontWeight: "700" },

  caseTabs: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  caseTab: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    backgroundColor: "#fff",
  },
  caseTabText: { fontSize: 12, fontWeight: "600", color: "#64748b" },
  caseTabTextActive: { color: "#fff" },

  sentenceCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 18,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    gap: 8,
  },
  sentenceHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  caseLabelBig: { fontSize: 14, fontWeight: "700" },
  sentenceText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1e293b",
    lineHeight: 26,
  },
  speakSentenceBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#eef2ff",
    borderRadius: 20,
    marginTop: 4,
  },
  speakSentenceBtnText: { fontSize: 12, color: "#6366f1", fontWeight: "600" },

  noSentenceCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    gap: 8,
  },
  noSentenceText: { fontSize: 14, color: "#94a3b8" },

  overviewCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    gap: 2,
  },
  overviewTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#94a3b8",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  overviewRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    gap: 10,
  },
  overviewDot: { width: 10, height: 10, borderRadius: 5 },
  overviewContent: { flex: 1, gap: 2 },
  overviewLabel: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  overviewSentence: { fontSize: 14, color: "#334155", lineHeight: 20 },

  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  navButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  disabledButton: { opacity: 0.4 },
  homeButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#eef2ff",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#c7d2fe",
  },

  bannerWrapper: {
    alignItems: "center",
    paddingTop: 4,
    paddingBottom: 16,
    backgroundColor: "#fff",
  },

  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  pickerSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
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
  pickerDot: { width: 12, height: 12, borderRadius: 6 },
  pickerInfo: { flex: 1 },
  pickerLabel: { fontSize: 16, fontWeight: "600", color: "#1e293b" },
  pickerCount: { fontSize: 12, color: "#94a3b8", marginTop: 2 },

  completionCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 32,
    alignItems: "center",
    gap: 8,
  },
  completionTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1e293b",
    marginTop: 8,
  },
  completionSubtitle: { fontSize: 14, color: "#64748b", marginBottom: 8 },
  completionButtons: { width: "100%", gap: 10, marginTop: 8 },
  btn: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  btnPrimary: { backgroundColor: "#6366f1" },
  btnPrimaryText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  btnText: { paddingVertical: 10, alignItems: "center" },
  btnTextLabel: { color: "#64748b", fontSize: 14, fontWeight: "600" },
});
