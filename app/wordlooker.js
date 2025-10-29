import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  BackHandler,
  TouchableOpacity,
  Image,
  Pressable,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Speech from "expo-speech";
import {
  AntDesign,
  FontAwesome,
  MaterialCommunityIcons,
} from "@expo/vector-icons";
import { quizMainData } from "./words";
import ABanner from "./banner";

const wordLimit = 100;

const shuffleArray = (array) => {
  const shuffledArray = [...array];
  for (let i = shuffledArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledArray[i], shuffledArray[j]] = [shuffledArray[j], shuffledArray[i]];
  }
  return shuffledArray;
};

const getRandomQuestions = (sourceArray, count) => {
  const shuffledArray = shuffleArray(sourceArray);
  return shuffledArray.slice(0, count);
};

const App = () => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [fails, setFails] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [isSoundOn, setSoundOn] = useState(true);
  const [isProcessingClick, setIsProcessingClick] = useState(false);

  const [quizData, setQuizData] = useState(
    getRandomQuestions(quizMainData, wordLimit)
  );

  const router = useRouter();
  const buttonAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const toggleSound = () => setSoundOn(!isSoundOn);

  const speakWord = () => {
    if (currentQuestionIndex < quizData.length) {
      Speech.stop();
      const word =
        quizData[currentQuestionIndex]?.correctAnswer +
        " " +
        quizData[currentQuestionIndex]?.question;
      if (isSoundOn) Speech.speak(word, { language: "de" });
    }
  };

  const handleButtonClick = (handler) => () => {
    if (!isProcessingClick) {
      setIsProcessingClick(true);
      handler();
      setTimeout(() => setIsProcessingClick(false), 500);
    }
  };

  const handleNext = (answer) => {
    const current = quizData[currentQuestionIndex];
    if (current.correctAnswer === answer) setScore(score + 1);
    else setFails(fails + 1);

    if (currentQuestionIndex + 1 >= quizData.length) {
      setShowModal(true);
    } else {
      // Fade animation
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

      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      // Fade animation
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

      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  useEffect(() => {
    try {
      speakWord();
    } catch (error) {
      console.error("Error in speakWord:", error);
    }
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
        return false;
      }
    );
    return () => backHandler.remove();
  }, [showModal]);

  const handleNewList = () => {
    setQuizData(getRandomQuestions(quizMainData, wordLimit));
    setCurrentQuestionIndex(0);
    setScore(0);
    setFails(0);
    setShowModal(false);
  };

  const handleRestart = () => {
    setCurrentQuestionIndex(0);
    setScore(0);
    setFails(0);
    setShowModal(false);
  };

  const animatedStyle = {
    transform: [
      {
        scale: buttonAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.8, 1],
        }),
      },
    ],
    opacity: buttonAnim,
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

          <View style={styles.iconButton} />
        </View>

        {/* Word Display with Animation */}
        <Animated.View style={[styles.wordContainer, { opacity: fadeAnim }]}>
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

          <View style={styles.textCard}>
            <Text style={styles.word}>
              {quizData[currentQuestionIndex]?.correctAnswer}{" "}
              {quizData[currentQuestionIndex]?.question}
            </Text>
            <Text style={styles.englishWord}>
              {quizData[currentQuestionIndex]?.englishName}
            </Text>
          </View>
        </Animated.View>

        {/* Navigation Buttons */}
        <Animated.View style={[styles.buttonRow, animatedStyle]}>
          <TouchableOpacity
            onPress={handleButtonClick(handlePrevious)}
            style={[
              styles.navButton,
              currentQuestionIndex === 0 && styles.disabledButton,
            ]}
            activeOpacity={0.7}
            disabled={currentQuestionIndex === 0}
          >
            <MaterialCommunityIcons
              name="skip-previous"
              size={40}
              color={currentQuestionIndex === 0 ? "#cbd5e1" : "#6366f1"}
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.homeButton}
            activeOpacity={0.7}
          >
            <AntDesign name="home" size={32} color="#6366f1" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleButtonClick(() => handleNext("das"))}
            style={styles.navButton}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name="skip-next"
              size={40}
              color="#6366f1"
            />
          </TouchableOpacity>
        </Animated.View>

        {/* Banner */}
        <View style={styles.bannerWrapper}>
          <ABanner />
        </View>

        {/* Modern Modal */}
        <Modal visible={showModal} animationType="fade" transparent={true}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalIconContainer}>
                <MaterialCommunityIcons
                  name="check-decagram"
                  size={80}
                  color="#10b981"
                />
              </View>

              <Text style={styles.modalTitle}>Liste abgeschlossen!</Text>

              <Text style={styles.modalSubtitle}>
                Du hast alle {quizData.length} Wörter durchgesehen! 🎉
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
                  <Text style={styles.primaryButtonText}>Neue Liste</Text>
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
    paddingTop: 24,
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
  wordContainer: {
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
  textCard: {
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
    maxWidth: "90%",
  },
  word: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 8,
    textAlign: "center",
  },
  englishWord: {
    fontSize: 18,
    color: "#64748b",
    fontWeight: "500",
    textAlign: "center",
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  navButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  disabledButton: {
    backgroundColor: "#f1f5f9",
    shadowOpacity: 0.05,
  },
  homeButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#eef2ff",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#c7d2fe",
  },
  bannerWrapper: {
    alignItems: "center",
    paddingTop: 6,
    paddingBottom: 40,
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
    marginBottom: 12,
  },
  modalSubtitle: {
    fontSize: 16,
    textAlign: "center",
    color: "#475569",
    marginBottom: 24,
    fontWeight: "500",
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
