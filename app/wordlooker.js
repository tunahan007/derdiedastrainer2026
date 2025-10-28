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
  Button,
} from "react-native";
import { useRouter } from "expo-router";
import * as Speech from "expo-speech";
import { AntDesign } from "@expo/vector-icons";
import { MaterialCommunityIcons } from "@expo/vector-icons";

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

    if (currentQuestionIndex + 1 >= quizData.length) setShowModal(true);
    else setCurrentQuestionIndex(currentQuestionIndex + 1);
  };

  useEffect(() => {
    try {
      speakWord();
    } catch (error) {
      console.error("Error in speakWord:", error);
    }
    // Trigger button animation on every word change
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

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={toggleSound} style={styles.soundButton}>
          <MaterialCommunityIcons
            name={isSoundOn ? "volume-high" : "volume-off"}
            size={30}
            color="white"
          />
        </TouchableOpacity>
        <View style={styles.counter}>
          <Text style={styles.counterText}>
            {currentQuestionIndex + 1}/{quizData.length}
          </Text>
        </View>
      </View>

      {/* Word Display */}
      <View style={styles.wordContainer}>
        <TouchableOpacity onPress={speakWord}>
          <Image
            source={
              quizData[currentQuestionIndex]?.image
                ? quizData[currentQuestionIndex]?.image
                : require("./images/end.png")
            }
            style={styles.image}
          />
        </TouchableOpacity>
        <Text style={styles.word}>
          {quizData[currentQuestionIndex]?.correctAnswer}{" "}
          {quizData[currentQuestionIndex]?.question}
        </Text>
        <Text style={styles.englishWord}>
          {quizData[currentQuestionIndex]?.englishName}
        </Text>
      </View>

      {/* Buttons */}
      <Animated.View style={[styles.buttonRow, animatedStyle]}>
        <Pressable
          onPress={handleButtonClick(() => handleNext("der"))}
          style={styles.iconButton}
        >
          <MaterialCommunityIcons
            name="skip-previous-circle-outline"
            size={66}
            color="#007bff"
          />
        </Pressable>

        <Pressable onPress={() => router.back()} style={styles.iconButton}>
          <AntDesign name="home" size={56} color="#007bff" />
        </Pressable>

        <Pressable
          onPress={handleButtonClick(() => handleNext("das"))}
          style={styles.iconButton}
        >
          <MaterialCommunityIcons
            name="skip-next-circle-outline"
            size={66}
            color="#007bff"
          />
        </Pressable>
      </Animated.View>

      {/* Banner */}
      <View style={styles.bannerWrapper}>
        <ABanner />
      </View>

      {/* Modal */}
      <Modal visible={showModal} animationType="slide" transparent={true}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Congratulations! You Finished The List!
            </Text>
            <Button title="HOME" onPress={() => router.back()} />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0f8ff" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 10,
  },
  soundButton: {
    backgroundColor: "#007bff",
    padding: 10,
    borderRadius: 50,
    elevation: 3,
  },
  counter: {
    backgroundColor: "#007bff",
    padding: 10,
    borderRadius: 50,
  },
  counterText: { color: "white", fontWeight: "bold", fontSize: 16 },

  wordContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  image: { width: 250, height: 250, borderRadius: 10, marginBottom: 10 },
  word: { fontSize: 36, fontWeight: "bold", color: "#333" },
  englishWord: { fontSize: 20, color: "#666", marginBottom: 30 },

  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    marginBottom: 40, // Buttons höher setzen
  },
  iconButton: {
    backgroundColor: "#f0f8ff",
    borderRadius: 50,
    padding: 8,
    elevation: 5,
  },

  bannerWrapper: {
    alignItems: "center",
    marginBottom: 60, // Banner höher setzen
  },

  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 10,
    alignItems: "center",
  },
  modalTitle: { fontSize: 26, fontWeight: "bold", textAlign: "center" },
});

export default App;
