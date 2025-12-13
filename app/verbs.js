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

/* =========================
   VERB LIST (30)
========================= */
const germanVerbs = [
  {
    id: 1,
    german: "essen",
    english: "to eat",
    example: "Ich esse einen Apfel",
    exampleEn: "I eat an apple",
    animation: require("./animation/eat.json"),
    icon: "cutlery",
  },
  {
    id: 2,
    german: "trinken",
    english: "to drink",
    example: "Ich trinke Wasser",
    exampleEn: "I drink water",
    animation: require("./animation/drink.json"),
    icon: "glass",
  },
  {
    id: 3,
    german: "gehen",
    english: "to go",
    example: "Ich gehe zur Schule",
    exampleEn: "I go to school",
    animation: require("./animation/go.json"),
    icon: "walk",
  },
  {
    id: 4,
    german: "sprechen",
    english: "to speak",
    example: "Ich spreche Deutsch",
    exampleEn: "I speak German",
    animation: require("./animation/speak.json"),
    icon: "comments",
  },
  {
    id: 5,
    german: "schwimmen",
    english: "to swim",
    example: "Ich schwimme im Pool",
    exampleEn: "I swim in the pool",
    animation: require("./animation/swim.json"),
    icon: "tint",
  },
  {
    id: 6,
    german: "lesen",
    english: "to read",
    example: "Ich lese ein Buch",
    exampleEn: "I read a book",
    animation: require("./animation/read.json"),
    icon: "book",
  },
  {
    id: 7,
    german: "schreiben",
    english: "to write",
    example: "Ich schreibe einen Brief",
    exampleEn: "I write a letter",
    animation: require("./animation/write.json"),
    icon: "pencil",
  },
  {
    id: 8,
    german: "lernen",
    english: "to learn",
    example: "Ich lerne Deutsch",
    exampleEn: "I learn German",
    animation: require("./animation/learn.json"),
    icon: "graduation-cap",
  },
  {
    id: 9,
    german: "arbeiten",
    english: "to work",
    example: "Ich arbeite jeden Tag",
    exampleEn: "I work every day",
    animation: require("./animation/work.json"),
    icon: "briefcase",
  },
  {
    id: 10,
    german: "spielen",
    english: "to play",
    example: "Ich spiele Fußball",
    exampleEn: "I play football",
    animation: require("./animation/play.json"),
    icon: "futbol-o",
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
    german: "anrufen",
    english: "to call",
    example: "Ich rufe dich später an",
    exampleEn: "I'll call you later",
    animation: require("./animation/call.json"),
    icon: "phone",
  },
  {
    id: 22,
    german: "sich freuen",
    english: "to be happy / look forward",
    example: "Ich freue mich auf morgen",
    exampleEn: "I look forward to tomorrow",
    animation: require("./animation/happy.json"),
    icon: "smile-o",
  },
  {
    id: 23,
    german: "springen",
    english: "to jump",
    example: "Ich springe hoch",
    exampleEn: "I jump high",
    animation: require("./animation/jump.json"),
    icon: "arrow-up",
  },
  {
    id: 24,
    german: "fliegen",
    english: "to fly",
    example: "Ich fliege nach Berlin",
    exampleEn: "I fly to Berlin",
    animation: require("./animation/fly.json"),
    icon: "plane",
  },
  {
    id: 25,
    german: "sitzen",
    english: "to sit",
    example: "Ich sitze am Tisch",
    exampleEn: "I sit at the table",
    animation: require("./animation/sit.json"),
    icon: "user",
  },
  {
    id: 26,
    german: "winken",
    english: "to wave",
    example: "Ich winke dir zu",
    exampleEn: "I wave to you",
    animation: require("./animation/wave.json"),
    icon: "hand-paper-o",
  },
  {
    id: 27,
    german: "klatschen",
    english: "to clap",
    example: "Ich klatsche laut",
    exampleEn: "I clap loudly",
    animation: require("./animation/clap.json"),
    icon: "hand-rock-o",
  },
  {
    id: 28,
    german: "lachen",
    english: "to laugh",
    example: "Ich lache viel",
    exampleEn: "I laugh a lot",
    animation: require("./animation/laugh.json"),
    icon: "smile-o",
  },
  {
    id: 29,
    german: "weinen",
    english: "to cry",
    example: "Ich weine manchmal",
    exampleEn: "I cry sometimes",
    animation: require("./animation/cry.json"),
    icon: "frown-o",
  },
  {
    id: 30,
    german: "singen",
    english: "to sing",
    example: "Ich singe gern",
    exampleEn: "I like to sing",
    animation: require("./animation/sing.json"),
    icon: "music",
  },
];

/* =========================
   SHUFFLE HELPER
========================= */
const shuffleArray = (array) => [...array].sort(() => Math.random() - 0.5);

/* =========================
   COMPONENT
========================= */
const GermanVerbs = () => {
  const router = useRouter();

  const [sessionVerbs, setSessionVerbs] = useState([]);
  const [currentVerbIndex, setCurrentVerbIndex] = useState(0);
  const [isSoundOn, setSoundOn] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const buttonAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  /* ===== Init / Shuffle ===== */
  const shuffleSession = () => {
    const shuffled = shuffleArray(germanVerbs).slice(0, 20);
    setSessionVerbs(shuffled);
    setCurrentVerbIndex(0);
  };

  useEffect(() => {
    shuffleSession();
  }, []);

  const currentVerb = sessionVerbs[currentVerbIndex];
  if (!currentVerb) return null;

  const speakVerb = () => {
    if (isSoundOn) {
      Speech.stop();
      Speech.speak(currentVerb.example, { language: "de" });
    }
  };

  const handleNext = () => {
    if (currentVerbIndex < sessionVerbs.length - 1) {
      setCurrentVerbIndex((i) => i + 1);
    }
  };

  const handlePrevious = () => {
    if (currentVerbIndex > 0) {
      setCurrentVerbIndex((i) => i - 1);
    }
  };

  const progress = ((currentVerbIndex + 1) / sessionVerbs.length) * 100;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => setSoundOn(!isSoundOn)}
          >
            <FontAwesome
              name={isSoundOn ? "volume-up" : "volume-off"}
              size={24}
              color="#6366f1"
            />
          </TouchableOpacity>

          <View style={styles.progressContainer}>
            <Text style={styles.progressText}>
              {currentVerbIndex + 1} / {sessionVerbs.length}
            </Text>
            <View style={styles.progressBarBg}>
              <View
                style={[styles.progressBarFill, { width: `${progress}%` }]}
              />
            </View>
          </View>

          {/* 🔁 Shuffle Button */}
          <TouchableOpacity style={styles.iconButton} onPress={shuffleSession}>
            <MaterialCommunityIcons
              name="shuffle-variant"
              size={24}
              color="#6366f1"
            />
          </TouchableOpacity>
        </View>

        {/* CONTENT */}
        <View style={styles.verbContainer}>
          <TouchableOpacity onPress={() => setShowModal(true)}>
            <LottieView
              source={currentVerb.animation}
              autoPlay
              loop
              style={{ width: 240, height: 240 }}
            />
          </TouchableOpacity>

          <View style={styles.textCard}>
            <Text style={styles.verbGerman}>{currentVerb.german}</Text>
            <Text style={styles.verbEnglish}>{currentVerb.english}</Text>
          </View>
        </View>

        {/* NAV */}
        <View style={styles.buttonRow}>
          <TouchableOpacity onPress={handlePrevious}>
            <MaterialCommunityIcons
              name="skip-previous"
              size={40}
              color="#6366f1"
            />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.back()}>
            <AntDesign name="home" size={32} color="#6366f1" />
          </TouchableOpacity>

          <TouchableOpacity onPress={handleNext}>
            <MaterialCommunityIcons
              name="skip-next"
              size={40}
              color="#6366f1"
            />
          </TouchableOpacity>
        </View>

        <ABanner />
      </View>
    </SafeAreaView>
  );
};

export default GermanVerbs;

/* =========================
   STYLES (gekürzt)
========================= */
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f8fafc" },
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    padding: 20,
    alignItems: "center",
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#eef2ff",
    alignItems: "center",
    justifyContent: "center",
  },
  progressContainer: { flex: 1, marginHorizontal: 16 },
  progressText: { textAlign: "center", marginBottom: 6 },
  progressBarBg: {
    height: 8,
    backgroundColor: "#e2e8f0",
    borderRadius: 4,
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#6366f1",
  },
  verbContainer: { flex: 1, alignItems: "center" },
  textCard: { alignItems: "center", marginTop: 20 },
  verbGerman: { fontSize: 36, fontWeight: "800" },
  verbEnglish: { fontSize: 18, color: "#64748b" },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    padding: 20,
  },
});
