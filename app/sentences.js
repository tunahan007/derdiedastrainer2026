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
/* import { Button } from "react-native-paper";
 */ import { useRouter } from "expo-router";
import * as Speech from "expo-speech";
import Ionicons from "@expo/vector-icons/Ionicons";
import { AntDesign } from "@expo/vector-icons";

import { Entypo } from "@expo/vector-icons";
// import Icon from "react-native-vector-icons/FontAwesome";
import { FontAwesome } from "@expo/vector-icons";

import { MaterialCommunityIcons } from "@expo/vector-icons";
import "expo-dev-client";

import { quizWordSentence } from "./words";
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

const getNonRandomQuestions = (sourceArray, count) => {
  return sourceArray.slice(0, count);
};

const App = () => {
  const [count, setCount] = useState(0);
  const [score, setScore] = useState(0);
  const [fails, setFails] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [isWrong, setIsWrong] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [isButtonDisabled, setButtonDisabled] = useState(false);
  const [isSoundOn, setSoundOn] = useState(true);
  const [isProcessingClick, setIsProcessingClick] = useState(false);

  const toggleSound = () => {
    setSoundOn(!isSoundOn);
  };

  const speakMessage = () => {
    if (isSoundOn) {
      const message = "Hallo, wie geht es dir?";
      Speech.speak(message, { language: "de" });
    }
  };

  const [quizData, setQuizData] = useState(
    getRandomQuestions(quizWordSentence, wordLimit)
  );
  const [quizNonRandomData, setNonRandomQuizData] = useState(
    getNonRandomQuestions(quizWordSentence, wordLimit)
  );
  const [failureData, setFailureData] = useState([]);
  const [correctData, setCorrectData] = useState([]);
  const router = useRouter();
  const buttonAnim = useRef(new Animated.Value(0)).current;

  const speakWord = () => {
    if (currentQuestionIndex < quizData.length) {
      Speech.stop();
      const greeting = quizData[currentQuestionIndex]?.germanSentence;
      const options = {
        //voice: "de-de-x-deb-network",
        language: "de",
      };
      if (isSoundOn) {
        try {
          Speech.speak(greeting, options);
        } catch (error) {
          console.error("Speech.speak : " + error);
          // Expected output: ReferenceError: nonExistentFunction is not defined
          // (Note: the exact output may be browser-dependent)
        }
      }
    }
  };
  const handleButtonClick = (handlerFunction) => {
    return () => {
      if (!isProcessingClick) {
        setIsProcessingClick(true);
        // İlgili handler fonksiyonunu çağır
        handlerFunction();
        setTimeout(() => {
          setIsProcessingClick(false);
        }, 1000); // 1 saniye içinde başka bir tıklamaya izin verme
      }
    };
  };
  const handleNextDer = () => {
    setSelectedAnswer(null);
    setIsWrong(false);
    setCount(count - 1);
    if (showModal) {
      setButtonDisabled(true);
    }

    if (!(currentQuestionIndex === 0)) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }

    if (currentQuestionIndex === 0) {
      setShowModal(true);
    } else {
      setTimeout(() => {
        setSelectedAnswer(null);
        setIsWrong(false);
        setCurrentQuestionIndex(currentQuestionIndex - 1);
      }, 100);
    }
  };

  const handleNextDie = () => {
    setSelectedAnswer(null);
    setIsWrong(false);
    setCount(count + 1);
    if (showModal) {
      setButtonDisabled(true);
    }
    if (!(currentQuestionIndex >= quizData.length)) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }

    const currentQuestion = quizData[currentQuestionIndex];

    if (currentQuestion && currentQuestion.correctAnswer === "die") {
      setScore((prevScore) => prevScore + 1);
      correctData.push(currentQuestion?.germanSentence);
    } else {
      setIsWrong(true);
      setFails((prevFail) => prevFail + 1);
      failureData.push(currentQuestion?.germanSentence);
    }

    setSelectedAnswer("die");

    if (currentQuestionIndex === quizData.length) {
      setShowModal(true);
    } else {
      setTimeout(() => {
        setSelectedAnswer(null);
        setIsWrong(false);
        setCurrentQuestionIndex(currentQuestionIndex + 1);
      }, 100);
    }
  };

  const handleNextDas = () => {
    setSelectedAnswer(null);
    setIsWrong(false);
    setCount(count + 1);
    if (showModal) {
      setButtonDisabled(true);
    }
    if (!(currentQuestionIndex >= quizData.length)) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }

    const currentQuestion = quizData[currentQuestionIndex];

    if (currentQuestion && currentQuestion.correctAnswer === "das") {
      setScore((prevScore) => prevScore + 1);
      correctData.push(currentQuestion?.germanSentence);
    } else {
      setIsWrong(true);
      setFails((prevFail) => prevFail + 1);
      failureData.push(currentQuestion?.germanSentence);
    }

    setSelectedAnswer("das");

    if (currentQuestionIndex === quizData.length) {
      setShowModal(true);
    } else {
      setTimeout(() => {
        setSelectedAnswer(null);
        setIsWrong(false);
        setCurrentQuestionIndex(currentQuestionIndex + 1);
      }, 100);
    }
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
    if (currentQuestionIndex === quizData.length) {
      setShowModal(true);
    }
  }, [currentQuestionIndex]);

  /*   useEffect(() => {
    try {
      speakWord();
    } catch (error) {
      console.error("speakword : " + error);
      // Expected output: ReferenceError: nonExistentFunction is not defined
      // (Note: the exact output may be browser-dependent)
    }

    if (currentQuestionIndex === quizData.length) {
      setShowModal(true);
    }
  }, [currentQuestionIndex]); */

  const handleModalClose = () => {
    setShowModal(false);
    resetNonRandomQuiz();
  };

  const resetQuiz = () => {
    setCount(0);
    setScore(0);
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setIsWrong(false);
    setFails(0);
    setQuizData(getRandomQuestions(quizWordSentence, wordLimit));
    setFailureData([]);
  };

  const resetNonRandomQuiz = () => {
    setCount(0);
    setScore(0);
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setIsWrong(false);
    setFails(0);
    setQuizData(getNonRandomQuestions(quizData, wordLimit));
    setFailureData([]);
  };

  const handleMenu = () => {
    // BackHandler.exitApp(); // Uygulamayı kapatma işlemi
    router.back();
  };

  const handleNewQuiz = () => {
    setQuizData(getRandomQuestions(quizWordSentence, wordLimit));
    setShowModal(false);
    resetQuiz();
  };

  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (showModal) {
          handleModalClose();

          return true;
        }
        return false;
      }
    );
    return () => backHandler.remove();
  }, [showModal]);

  function onlyUnique(value, index, array) {
    return array.indexOf(value) === index;
  }

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
            {currentQuestionIndex + 1 <= quizData.length
              ? currentQuestionIndex + 1
              : currentQuestionIndex}
            /{quizData.length}
          </Text>
        </View>
      </View>
      <View style={styles.quizContainer}>
        <TouchableOpacity onPress={speakWord}>
          <Image
            source={
              quizData[currentQuestionIndex]?.image
                ? quizData[currentQuestionIndex]?.image
                : require("./images/end.png") // Provide a default image source here
            }
            style={[styles.image]}
          />
        </TouchableOpacity>
        <Text style={styles.word}>
          {quizData[currentQuestionIndex]?.germanSentence}
        </Text>
        <Text style={styles.englword}>
          {quizData[currentQuestionIndex]?.englishSentence}
        </Text>
      </View>

      {/* Buttons */}
      <Animated.View style={[styles.buttonRow, animatedStyle]}>
        <Pressable
          onPress={handleButtonClick(handleNextDer)}
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
          onPress={handleButtonClick(handleNextDas)}
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

      <Modal visible={showModal} animationType="slide" transparent={true}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Congrulations You Finished The List!!!
            </Text>
            <View style={styles.modalScore}>
              <Text></Text>
            </View>
            <Button
              mode="outlined"
              onPress={handleMenu}
              title="HOME"
              style={styles.modalButton}
            />
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

  modalWrongAnswers: {
    marginTop: 10,
  },
  modalWrongAnswersTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 5,
  },
  modalWrongAnswerItem: {
    fontSize: 16,
    marginBottom: 5,
  },
  buttonContent: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: "5",
    borderColor: "3498db",
  },
  buttonText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#3498db",
  },
  sayacContainer: {
    backgroundColor: "#007bff",
    padding: 10,
    borderRadius: 50,
  },
  sayacText: { color: "white", fontWeight: "bold", fontSize: 16 },
  quizContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  word: {
    fontSize: 33,
    fontWeight: "bold",
  },
  englword: {
    fontSize: 14,
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 20,
    marginBottom: 40,
    width: "90%",
  },
  answerButton: {
    margin: 4,
    minHeight: 50, // Yüksekliği ayarlayabilirsiniz
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2, // Çerçeve kalınlığı
    borderRadius: 5, // Kenar yuvarlaklığı
    borderColor: "#007BFF", // Çerçeve rengi
    padding: 10, // İçerik ile çerçeve arasındaki boşluk
  },

  selectedAnswer: {
    backgroundColor: "#2ecc71",
    borderColor: "#27ae60", // Seçildiğinde çerçeve rengi
  },
  wrongAnswer: {
    backgroundColor: "#e74c3c",
    borderColor: "#c0392b", // Yanlış seçildiğinde çerçeve rengi
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalButton: {
    margin: 4,
    minWidth: "90%",
    marginBottom: 10,
    minHeight: "6%",
  },
  modalContent: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 10,
    alignItems: "center",
  },
  modalScore: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 10,
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 26,
    fontWeight: "bold",
    textAlign: "center",
  },
  modalScoreText: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    color: "#589C26",
  },
});

export default App;
