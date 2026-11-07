import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle, Ellipse, Path, G } from "react-native-svg";

// Custom Owl Component
export const OwlIcon = ({ size = 90 }) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {/* Body */}
      <Ellipse cx="50" cy="60" rx="35" ry="38" fill="#8B4513" />

      {/* Belly */}
      <Ellipse cx="50" cy="65" rx="22" ry="25" fill="#D2691E" />

      {/* Head */}
      <Circle cx="50" cy="35" r="28" fill="#A0522D" />

      {/* Left Eye White */}
      <Circle cx="40" cy="32" r="10" fill="#FFFFFF" />
      {/* Left Eye Pupil */}
      <Circle cx="40" cy="32" r="6" fill="#1F1F1F" />
      {/* Left Eye Shine */}
      <Circle cx="42" cy="30" r="2" fill="#FFFFFF" />

      {/* Right Eye White */}
      <Circle cx="60" cy="32" r="10" fill="#FFFFFF" />
      {/* Right Eye Pupil */}
      <Circle cx="60" cy="32" r="6" fill="#1F1F1F" />
      {/* Right Eye Shine */}
      <Circle cx="62" cy="30" r="2" fill="#FFFFFF" />

      {/* Beak */}
      <Path d="M 50 38 L 46 44 L 54 44 Z" fill="#FFA500" />

      {/* Left Ear Tuft */}
      <Path d="M 28 20 Q 25 10 30 8 Q 32 15 30 22 Z" fill="#8B4513" />

      {/* Right Ear Tuft */}
      <Path d="M 72 20 Q 75 10 70 8 Q 68 15 70 22 Z" fill="#8B4513" />

      {/* Left Wing */}
      <Ellipse cx="22" cy="65" rx="12" ry="20" fill="#6B3410" />

      {/* Right Wing */}
      <Ellipse cx="78" cy="65" rx="12" ry="20" fill="#6B3410" />

      {/* Feet */}
      <Path d="M 40 95 L 38 100 L 40 100 L 41 95 Z" fill="#FFA500" />
      <Path d="M 43 95 L 41 100 L 43 100 L 44 95 Z" fill="#FFA500" />
      <Path d="M 60 95 L 58 100 L 60 100 L 61 95 Z" fill="#FFA500" />
      <Path d="M 63 95 L 61 100 L 63 100 L 64 95 Z" fill="#FFA500" />
    </Svg>
  );
};

// Alternative: Emoji-based Owl (simpler, guaranteed to work)
export const OwlEmoji = ({ size = 90 }) => {
  return (
    <View style={[styles.emojiContainer, { width: size, height: size }]}>
      <Text style={[styles.emoji, { fontSize: size * 0.8 }]}>🦉</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  emojiContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  emoji: {
    textAlign: "center",
  },
});

// Usage example - Replace the owl image in your home screen with this:
/*
import { OwlIcon, OwlEmoji } from './OwlIcon';

// Then in your render, replace:
// <Image source={require("./images/guru.png")} style={styles.owlImage} />

// With either:
<OwlIcon size={90} />

// Or use the emoji version (simpler):
<OwlEmoji size={90} />
*/
