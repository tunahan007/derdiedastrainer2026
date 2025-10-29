import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Image,
  Animated,
} from "react-native";
import React, { useEffect, useRef } from "react";
import { FontAwesome } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Speech from "expo-speech";
import { OwlEmoji } from "./images/OwlIcon";

export default function Page() {
  const router = useRouter();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const openPlayStore = () => {
    const playStoreLink =
      "https://play.google.com/store/apps/details?id=com.tunakhan007.derdiedastrainer&pcampaignid=web_share";
    Linking.openURL(playStoreLink);
  };

  const openPlayStoreApps = () => {
    const playStoreLink =
      "https://play.google.com/store/apps/developer?id=FocusSoftware";
    Linking.openURL(playStoreLink);
  };

  const speakWord = () => {
    const greeting = "Hello welcome to german article guru";
    const options = {
      voice: "de-de-x-deb-network",
    };
    try {
      Speech.speak(greeting, options);
    } catch (error) {
      console.error("Speech.speak : " + error);
    }
  };

  const GridButton = ({ icon, title, colors, onPress }) => (
    <TouchableOpacity
      style={[styles.gridButton, { backgroundColor: colors[0] }]}
      onPress={onPress}
    >
      <View style={styles.gridButtonContent}>
        <FontAwesome name={icon} size={40} color="#FFFFFF" />
        <Text style={styles.gridButtonText}>{title}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header with Owl */}
      <View style={styles.header}>
        <TouchableOpacity onPress={speakWord} style={styles.owlContainer}>
          <Animated.View
            style={[styles.owlPulse, { transform: [{ scale: pulseAnim }] }]}
          />
          <View style={styles.owlCircle}>
            <OwlEmoji size={90} />
          </View>
        </TouchableOpacity>
        <Text style={styles.title}>DER DIE DAS</Text>
        <Text style={styles.subtitle}>GURU</Text>
      </View>

      {/* Grid of Main Buttons */}
      <View style={styles.gridContainer}>
        <GridButton
          icon="book"
          title="Power Words"
          colors={["#60A5FA", "#3B82F6"]}
          onPress={() => router.push("/wordlooker")}
        />
        <GridButton
          icon="graduation-cap"
          title="Test"
          colors={["#A78BFA", "#8B5CF6"]}
          onPress={() => router.push("/trainer")}
        />
        <GridButton
          icon="comment"
          title="Sentences"
          colors={["#F472B6", "#EC4899"]}
          onPress={() => router.push("/sentences")}
        />
        <GridButton
          icon="line-chart"
          title="Test Stats"
          colors={["#2DD4BF", "#14B8A6"]}
          onPress={() => router.push("/statistics")}
        />
      </View>

      {/* More Apps Button */}
      <TouchableOpacity
        style={styles.moreAppsButton}
        onPress={openPlayStoreApps}
      >
        <FontAwesome name="bolt" size={24} color="#FFFFFF" />
        <Text style={styles.moreAppsText}>More Apps</Text>
      </TouchableOpacity>

      {/* Rate Button */}
      <TouchableOpacity style={styles.rateButton} onPress={openPlayStore}>
        <FontAwesome name="star" size={24} color="#FFFFFF" />
        <Text style={styles.rateText}>Rate Us</Text>
        <FontAwesome name="star" size={24} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 30,
    backgroundColor: "#E0E7FF",
  },
  header: {
    alignItems: "center",
    marginBottom: 30,
  },
  owlContainer: {
    width: 112,
    height: 112,
    marginBottom: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  owlPulse: {
    position: "absolute",
    width: 121,
    height: 121,
    borderRadius: 51,
    backgroundColor: "rgba(251, 191, 36, 0.2)",
  },
  owlCircle: {
    width: 112,
    height: 112,
    borderRadius: 71,
    backgroundColor: "#FBBF24",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
  },
  owlImage: {
    width: 90,
    height: 90,
    resizeMode: "contain",
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1F2937",
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 32,
    fontWeight: "900",
    color: "#F59E0B",
    letterSpacing: 1,
    marginTop: -4,
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  gridButton: {
    width: "48%",
    aspectRatio: 1,
    borderRadius: 24,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  gridButtonContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  gridButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  moreAppsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#FB923C",
    paddingVertical: 18,
    borderRadius: 24,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  moreAppsText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  rateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FBBF24",
    paddingVertical: 16,
    borderRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  rateText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
