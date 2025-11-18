import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  BackHandler,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  FontAwesome,
  AntDesign,
  MaterialCommunityIcons,
  Ionicons,
} from "@expo/vector-icons";
import { useRouter } from "expo-router";
import LottieView from "lottie-react-native";
import * as Speech from "expo-speech";
import ABanner from "./banner";

// German verbs with Lottie animations
const germanVerbs = [
  {
    id: 1,
    german: "essen",
    english: "to eat",
    example: "Ich esse einen Apfel",
    exampleEn: "I eat an apple",
    animation: require("./animation/eat.json"),
    icon: "cutlery",
    iconFamily: "FontAwesome",
  },
  {
    id: 2,
    german: "trinken",
    english: "to drink",
    example: "Ich trinke Wasser",
    exampleEn: "I drink water",
    animation: require("./animation/drink.json"),
    icon: "glass",
    iconFamily: "FontAwesome",
  },
  {
    id: 3,
    german: "gehen",
    english: "to go",
    example: "Ich gehe zur Schule",
    exampleEn: "I go to school",
    animation: require("./animation/go.json"),
    icon: "walk",
    iconFamily: "FontAwesome",
  },
  {
    id: 4,
    german: "sprechen",
    english: "to speak",
    example: "Ich spreche Deutsch",
    exampleEn: "I speak German",
    animation: require("./animation/speak.json"),
    icon: "comments",
    iconFamily: "FontAwesome",
  },
  {
    id: 5,
    german: "schwimmen",
    english: "to swim",
    example: "Ich schwimme im Pool",
    exampleEn: "I swim in the pool",
    animation: require("./animation/swim.json"),
    icon: "tint",
    iconFamily: "FontAwesome",
  },
  {
    id: 6,
    german: "lesen",
    english: "to read",
    example: "Ich lese ein Buch",
    exampleEn: "I read a book",
    animation: require("./animation/read.json"),
    icon: "book",
    iconFamily: "FontAwesome",
  },
  {
    id: 7,
    german: "schreiben",
    english: "to write",
    example: "Ich schreibe einen Brief",
    exampleEn: "I write a letter",
    animation: require("./animation/write.json"),
    icon: "pencil",
    iconFamily: "FontAwesome",
  },
  {
    id: 8,
    german: "lernen",
    english: "to learn",
    example: "Ich lerne Deutsch",
    exampleEn: "I learn German",
    animation: require("./animation/learn.json"),
    icon: "graduation-cap",
    iconFamily: "FontAwesome",
  },
  {
    id: 9,
    german: "arbeiten",
    english: "to work",
    example: "Ich arbeite jeden Tag",
    exampleEn: "I work every day",
    animation: require("./animation/work.json"),
    icon: "briefcase",
    iconFamily: "FontAwesome",
  },
  {
    id: 10,
    german: "spielen",
    english: "to play",
    example: "Ich spiele Fußball",
    exampleEn: "I play football",
    animation: require("./animation/play.json"),
    icon: "futbol-o",
    iconFamily: "FontAwesome",
  },
  {
    id: 11,
    german: "schlafen",
    english: "to sleep",
    example: "Ich schlafe gut",
    exampleEn: "I sleep well",
    animation: require("./animation/sleep.json"),
    icon: "sleep",
  },
  {
    id: 12,
    german: "kochen",
    english: "to cook",
    example: "Ich koche Pasta",
    exampleEn: "I cook pasta",
    animation: require("./animation/cook.json"),

    icon: "pot-steam",
  },
  {
    id: 13,
    german: "fahren",
    english: "to drive",
    example: "Ich fahre Auto",
    exampleEn: "I drive a car",
    animation: require("./animation/drive.json"),

    icon: "car",
  },
  {
    id: 14,
    german: "laufen",
    english: "to run",
    example: "Ich laufe im Park",
    exampleEn: "I run in the park",
    animation: require("./animation/run.json"),

    icon: "run",
  },
  {
    id: 15,
    german: "sehen",
    english: "to see",
    example: "Ich sehe einen Film",
    exampleEn: "I see a movie",
    animation: require("./animation/look.json"),

    icon: "eye",
  },
  {
    id: 16,
    german: "hören",
    english: "to hear",
    example: "Ich höre Musik",
    exampleEn: "I hear music",
    animation: require("./animation/hear.json"),

    icon: "music",
  },
  {
    id: 17,
    german: "kaufen",
    english: "to buy",
    example: "Ich kaufe Brot",
    exampleEn: "I buy bread",
    animation: require("./animation/buy.json"),

    icon: "shopping",
  },
  {
    id: 18,
    german: "lieben",
    english: "to love",
    example: "Ich liebe dich",
    exampleEn: "I love you",
    animation: require("./animation/love.json"),

    icon: "heart",
  },
  {
    id: 19,
    german: "denken",
    english: "to think",
    example: "Ich denke oft",
    exampleEn: "I think often",
    animation: require("./animation/think.json"),

    icon: "head-lightbulb",
  },
  {
    id: 20,
    german: "tanzen",
    english: "to dance",
    example: "Ich tanze gern",
    exampleEn: "I like to dance",
    animation: require("./animation/dance.json"),

    icon: "dance-ballroom",
  },
  {
    id: 21,
    german: "sagen",
    english: "to say",
    example: "Was hat er gesagt?",
    exampleEn: "What did he say?",
    animation: require("./animation/say.json"),
    icon: "comment",
    iconFamily: "FontAwesome",
  },
  {
    id: 22,
    german: "finden",
    english: "to find",
    example: "Ich finde mein Handy nicht",
    exampleEn: "I can’t find my phone",
    animation: require("./animation/find.json"),
    icon: "search",
    iconFamily: "FontAwesome",
  },
  {
    id: 23,
    german: "geben",
    english: "to give",
    example: "Hast du mir schon deine Handy-Nummer gegeben?",
    exampleEn: "Did you already give me your phone number?",
    animation: require("./animation/give.json"),
    icon: "gift",
    iconFamily: "FontAwesome",
  },
  {
    id: 24,
    german: "bringen",
    english: "to bring",
    example: "Bringen Sie mir bitte mein Paket.",
    exampleEn: "Bring me my package, please",
    animation: require("./animation/bring.json"),
    icon: "truck",
    iconFamily: "FontAwesome",
  },
  {
    id: 25,
    german: "wissen",
    english: "to know",
    example: "Ich weiß es leider nicht",
    exampleEn: "Unfortunately I don’t know",
    animation: require("./animation/know.json"),
    icon: "lightbulb",
    iconFamily: "FontAwesome",
  },
  {
    id: 26,
    german: "glauben",
    english: "to believe, to think",
    example: "Ich glaube, ich kenne ihn",
    exampleEn: "I think I know him",
    animation: require("./animation/believe.json"),
    icon: "pray",
    iconFamily: "FontAwesome",
  },
  {
    id: 27,
    german: "fragen",
    english: "to ask",
    example: "Sie haben mich nach dem Weg gefragt",
    exampleEn: "They asked me for directions",
    animation: require("./animation/ask.json"),
    icon: "question",
    iconFamily: "FontAwesome",
  },
  {
    id: 28,
    german: "helfen",
    english: "to help",
    example: "Hilfst du mir bei den Hausaufgaben?",
    exampleEn: "Will you help me with my homework?",
    animation: require("./animation/help.json"),
    icon: "hands-helping",
    iconFamily: "FontAwesome",
  },
  {
    id: 29,
    german: "suchen",
    english: "to search, to look for",
    example: "Er sucht sein Handy",
    exampleEn: "He’s looking for his phone",
    animation: require("./animation/search.json"),
    icon: "search",
    iconFamily: "FontAwesome",
  },
  {
    id: 30,
    german: "wohnen",
    english: "to live",
    example: "Wo wohnen Sie?",
    exampleEn: "Where do you live?",
    animation: require("./animation/live.json"),
    icon: "house",
    iconFamily: "FontAwesome",
  },
];

const GermanVerbs = () => {
  const router = useRouter();
  const [currentVerbIndex, setCurrentVerbIndex] = useState(0);
  const [isSoundOn, setSoundOn] = useState(true);
  const [isProcessingClick, setIsProcessingClick] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const buttonAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const currentVerb = germanVerbs[currentVerbIndex];

  const toggleSound = () => setSoundOn(!isSoundOn);

  const speakVerb = () => {
    if (isSoundOn && currentVerb) {
      Speech.stop();
      Speech.speak(currentVerb.example, { language: "de" });
    }
  };

  const handleButtonClick = (handler) => () => {
    if (!isProcessingClick) {
      setIsProcessingClick(true);
      handler();
      setTimeout(() => setIsProcessingClick(false), 500);
    }
  };

  const handleNext = () => {
    if (currentVerbIndex < germanVerbs.length - 1) {
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

      setCurrentVerbIndex(currentVerbIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentVerbIndex > 0) {
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

      setCurrentVerbIndex(currentVerbIndex - 1);
    }
  };

  useEffect(() => {
    try {
      speakVerb();
    } catch (error) {
      console.error("Error in speakVerb:", error);
    }
    buttonAnim.setValue(0);
    Animated.spring(buttonAnim, {
      toValue: 1,
      friction: 5,
      useNativeDriver: true,
    }).start();
  }, [currentVerbIndex]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (showModal) {
          setShowModal(false);
          return true;
        }
        router.back();
        return true;
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

  const progressPercentage =
    ((currentVerbIndex + 1) / germanVerbs.length) * 100;

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
              {currentVerbIndex + 1} / {germanVerbs.length}
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
        {/* Verb Display with Animation */}
        <Animated.View style={[styles.verbContainer, { opacity: fadeAnim }]}>
          <TouchableOpacity
            onPress={() => setShowModal(true)}
            activeOpacity={0.8}
            style={styles.animationContainer}
          >
            <View style={styles.lottieWrapper}>
              {currentVerb.animation ? (
                <LottieView
                  source={
                    typeof currentVerb.animation === "string"
                      ? { uri: currentVerb.animation }
                      : currentVerb.animation
                  }
                  autoPlay
                  loop
                  style={styles.lottie}
                />
              ) : (
                <FontAwesome
                  name={currentVerb.icon}
                  size={100}
                  color="#6366f1"
                />
              )}
            </View>
            <View style={styles.speakHint}>
              <FontAwesome name="info-circle" size={16} color="#6366f1" />
              <Text style={styles.speakHintText}>Tap for details</Text>
            </View>
          </TouchableOpacity>

          {/* Verb Card - Simple */}
          <View style={styles.textCard}>
            <Text style={styles.verbGerman}>{currentVerb.german}</Text>
            <Text style={styles.verbEnglish}>{currentVerb.english}</Text>
          </View>
        </Animated.View>
        {/* Navigation Buttons */}
        <Animated.View style={[styles.buttonRow, animatedStyle]}>
          <TouchableOpacity
            onPress={handleButtonClick(handlePrevious)}
            style={[
              styles.navButton,
              currentVerbIndex === 0 && styles.disabledButton,
            ]}
            activeOpacity={0.7}
            disabled={currentVerbIndex === 0}
          >
            <MaterialCommunityIcons
              name="skip-previous"
              size={40}
              color={currentVerbIndex === 0 ? "#cbd5e1" : "#6366f1"}
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
            onPress={handleButtonClick(handleNext)}
            style={[
              styles.navButton,
              currentVerbIndex === germanVerbs.length - 1 &&
                styles.disabledButton,
            ]}
            activeOpacity={0.7}
            disabled={currentVerbIndex === germanVerbs.length - 1}
          >
            <MaterialCommunityIcons
              name="skip-next"
              size={40}
              color={
                currentVerbIndex === germanVerbs.length - 1
                  ? "#cbd5e1"
                  : "#6366f1"
              }
            />
          </TouchableOpacity>
        </Animated.View>
        {/* Banner */}
        <View style={styles.bannerWrapper}>
          <ABanner />
        </View>
        {/* Detail Modal */}
        <Modal visible={showModal} animationType="fade" transparent={true}>
          <View style={styles.modalOverlay}>
            <TouchableOpacity
              style={styles.modalBackground}
              activeOpacity={1}
              onPress={() => setShowModal(false)}
            />
            <View style={styles.modalCard}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowModal(false)}
              >
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>

              <View style={styles.modalIconContainer}>
                {currentVerb.animation ? (
                  <LottieView
                    source={
                      typeof currentVerb.animation === "string"
                        ? { uri: currentVerb.animation }
                        : currentVerb.animation
                    }
                    autoPlay
                    loop
                    style={styles.modalLottie}
                  />
                ) : (
                  <FontAwesome
                    name={currentVerb.icon}
                    size={80}
                    color="#6366f1"
                  />
                )}
              </View>

              <Text style={styles.modalVerbGerman}>{currentVerb.german}</Text>
              <Text style={styles.modalVerbEnglish}>{currentVerb.english}</Text>

              <View style={styles.modalExampleContainer}>
                <Text style={styles.exampleLabel}>Beispiel:</Text>
                <TouchableOpacity
                  onPress={speakVerb}
                  style={styles.exampleTextContainer}
                >
                  <Text style={styles.exampleGerman}>
                    {currentVerb.example}
                  </Text>
                  <FontAwesome name="volume-up" size={20} color="#6366f1" />
                </TouchableOpacity>
                <Text style={styles.exampleEnglish}>
                  {currentVerb.exampleEn}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.practiceButton}
                onPress={() => {
                  speakVerb();
                  setShowModal(false);
                }}
              >
                <FontAwesome name="volume-up" size={20} color="#fff" />
                <Text style={styles.practiceButtonText}>
                  Anhören & Schließen
                </Text>
              </TouchableOpacity>
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
  verbContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  animationContainer: {
    alignItems: "center",
    marginBottom: 24,
  },
  lottieWrapper: {
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "#eef2ff",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  lottie: {
    width: 280,
    height: 280,
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
    width: "100%",
  },
  verbGerman: {
    fontSize: 36,
    fontWeight: "800",
    color: "#1e293b",
    marginBottom: 8,
    textAlign: "center",
  },
  verbEnglish: {
    fontSize: 20,
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
    paddingBottom: 20,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  modalBackground: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
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
  closeButton: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  modalIconContainer: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "#eef2ff",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
    overflow: "hidden",
  },
  modalLottie: {
    width: 180,
    height: 180,
  },
  modalVerbGerman: {
    fontSize: 32,
    fontWeight: "800",
    color: "#1e293b",
    marginBottom: 8,
    textAlign: "center",
  },
  modalVerbEnglish: {
    fontSize: 20,
    color: "#64748b",
    fontWeight: "500",
    marginBottom: 24,
    textAlign: "center",
  },
  modalExampleContainer: {
    width: "100%",
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  exampleLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6366f1",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  exampleTextContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  exampleGerman: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1e293b",
    flex: 1,
  },
  exampleEnglish: {
    fontSize: 15,
    color: "#64748b",
    fontStyle: "italic",
    textAlign: "center",
  },
  practiceButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#6366f1",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    gap: 8,
    width: "100%",
  },
  practiceButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});

export default GermanVerbs;
