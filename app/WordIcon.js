import React from "react";
import { View, Text, StyleSheet } from "react-native";

// Category → background color + accent
export const CATEGORY_THEME = {
  Zuhause: { bg: "#DBEAFE", accent: "#2563EB", emoji: "🏠" },
  Natur: { bg: "#DCFCE7", accent: "#16A34A", emoji: "🌿" },
  Tiere: { bg: "#FEF3C7", accent: "#D97706", emoji: "🐾" },
  Transport: { bg: "#E0E7FF", accent: "#4338CA", emoji: "🚗" },
  Essen: { bg: "#FFE4E6", accent: "#E11D48", emoji: "🍎" },
  Schule: { bg: "#FEF9C3", accent: "#CA8A04", emoji: "📚" },
  Technik: { bg: "#F0F9FF", accent: "#0284C7", emoji: "💻" },
  Orte: { bg: "#F5F3FF", accent: "#7C3AED", emoji: "📍" },
  Körper: { bg: "#FFF1F2", accent: "#BE123C", emoji: "👤" },
  Alltag: { bg: "#F0FDF4", accent: "#15803D", emoji: "☀️" },
  Kleidung: { bg: "#FDF4FF", accent: "#A21CAF", emoji: "👕" },
  Musik: { bg: "#FFF7ED", accent: "#C2410C", emoji: "🎵" },
  Menschen: { bg: "#EFF6FF", accent: "#1D4ED8", emoji: "👤" },
  Berufe: { bg: "#F0FDF4", accent: "#166534", emoji: "💼" },
  Sport: { bg: "#FFF7ED", accent: "#EA580C", emoji: "⚽" },
  Gesundheit: { bg: "#FFF1F2", accent: "#BE123C", emoji: "🏥" },
  Reisen: { bg: "#ECFDF5", accent: "#059669", emoji: "✈️" },
  Wetter: { bg: "#EFF6FF", accent: "#3B82F6", emoji: "🌤️" },
  Familie: { bg: "#FDF4FF", accent: "#9333EA", emoji: "👨‍👩‍👧" },
  default: { bg: "#F1F5F9", accent: "#475569", emoji: "📝" },
};

export default function WordIcon({ word, size = 240 }) {
  const theme = CATEGORY_THEME[word?.category] || CATEGORY_THEME.default;

  // Get emoji for this specific word, fallback to category emoji
  const emoji = word?.emoji || theme.emoji;

  const fontSize = size * 0.55;
  const borderRadius = size * 0.083;

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius,
          backgroundColor: theme.bg,
          borderColor: theme.accent + "30",
        },
      ]}
    >
      {/* Decorative circles */}
      <View
        style={[
          styles.circle1,
          {
            width: size * 0.6,
            height: size * 0.6,
            borderRadius: size * 0.3,
            backgroundColor: theme.accent + "12",
          },
        ]}
      />
      <View
        style={[
          styles.circle2,
          {
            width: size * 0.35,
            height: size * 0.35,
            borderRadius: size * 0.175,
            backgroundColor: theme.accent + "18",
          },
        ]}
      />

      {/* Main Emoji */}
      <Text style={[styles.emoji, { fontSize }]}>{emoji}</Text>

      {/* Category dot */}
      <View style={[styles.dot, { backgroundColor: theme.accent }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  circle1: {
    position: "absolute",
    top: -10,
    right: -10,
  },
  circle2: {
    position: "absolute",
    bottom: -8,
    left: -8,
  },
  emoji: {
    zIndex: 1,
    textAlign: "center",
  },
  dot: {
    position: "absolute",
    bottom: 12,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
