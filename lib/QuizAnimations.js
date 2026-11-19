// Feedback-Animationen für Quiz-Screens.
// Alle Komponenten werden über einen "trigger"-Zähler ausgelöst (trigger > 0 und Änderung).
import React, { useEffect, useRef, useMemo } from "react";
import { Animated, Easing, StyleSheet, Text, View, Dimensions } from "react-native";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

// ── Farbiger Bildschirm-Blitz ─────────────────────────────────────────────────
const ColorFlash = ({ trigger, color, peak = 0.22 }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!trigger) return;
    opacity.setValue(0);
    Animated.sequence([
      Animated.timing(opacity, { toValue: peak, duration: 90, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [trigger]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: color, opacity }]}
    />
  );
};

// Grün bei richtiger Antwort
export const CorrectFlash = ({ trigger }) => (
  <ColorFlash trigger={trigger} color="#10b981" />
);

// Pink bei falscher Antwort
export const WrongFlash = ({ trigger }) => (
  <ColorFlash trigger={trigger} color="#ec4899" peak={0.2} />
);

// ── "+1" steigt auf und verblasst ─────────────────────────────────────────────
export const ScorePop = ({ trigger, text = "+1", duration = 700 }) => {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!trigger) return;
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [trigger]);
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [0, -70] });
  const scale = progress.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.6, 1.25, 1] });
  const opacity = progress.interpolate({ inputRange: [0, 0.1, 0.75, 1], outputRange: [0, 1, 1, 0] });
  return (
    <View pointerEvents="none" style={styles.popWrap}>
      <Animated.Text style={[styles.popText, { opacity, transform: [{ translateY }, { scale }] }]}>
        {text}
      </Animated.Text>
    </View>
  );
};

// ── Konfetti-Explosion (ohne externe Bibliothek) ──────────────────────────────
const CONFETTI_COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#3b82f6", "#ec4899"];
const PIECES = 28;

export const ConfettiBurst = ({ trigger }) => {
  const progress = useRef(new Animated.Value(0)).current;
  const pieces = useMemo(
    () =>
      Array.from({ length: PIECES }, (_, i) => {
        const angle = (Math.PI * 2 * i) / PIECES + Math.random() * 0.4;
        const dist = 90 + Math.random() * 130;
        return {
          dx: Math.cos(angle) * dist,
          dy: Math.sin(angle) * dist - 60,
          fall: 140 + Math.random() * 120,
          rot: (Math.random() > 0.5 ? 1 : -1) * (180 + Math.random() * 360),
          color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          w: 6 + Math.random() * 5,
          h: 8 + Math.random() * 8,
        };
      }),
    [trigger],
  );
  useEffect(() => {
    if (!trigger) return;
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: 1300,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [trigger]);
  if (!trigger) return null;
  return (
    <View pointerEvents="none" style={styles.confettiOrigin}>
      {pieces.map((p, i) => {
        const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, p.dx] });
        const translateY = progress.interpolate({
          inputRange: [0, 0.45, 1],
          outputRange: [0, p.dy, p.dy + p.fall],
        });
        const rotate = progress.interpolate({ inputRange: [0, 1], outputRange: ["0deg", `${p.rot}deg`] });
        const opacity = progress.interpolate({ inputRange: [0, 0.75, 1], outputRange: [1, 1, 0] });
        return (
          <Animated.View
            key={i}
            style={{
              position: "absolute",
              width: p.w,
              height: p.h,
              borderRadius: 2,
              backgroundColor: p.color,
              opacity,
              transform: [{ translateX }, { translateY }, { rotate }],
            }}
          />
        );
      })}
    </View>
  );
};

// ── Shake-Animation für falsche Antworten ─────────────────────────────────────
export const useShakeAnimation = () => {
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const shake = () => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };
  return { shakeAnim, shake };
};

const styles = StyleSheet.create({
  popWrap: {
    position: "absolute",
    top: SCREEN_H * 0.3,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  popText: {
    fontSize: 34,
    fontWeight: "800",
    color: "#10b981",
    textShadowColor: "rgba(0,0,0,0.15)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  confettiOrigin: {
    position: "absolute",
    top: SCREEN_H * 0.32,
    left: SCREEN_W / 2,
    width: 0,
    height: 0,
  },
});
