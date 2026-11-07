import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { View, ActivityIndicator, Platform, AppState } from "react-native";
import {
  getTrackingPermissionsAsync,
  requestTrackingPermissionsAsync,
} from "expo-tracking-transparency";
import { initI18n } from "./i18n";
import { I18nextProvider } from "react-i18next";
import i18n from "./i18n";

// iOS: ATT-Abfrage einmalig vor dem ersten Laden der Anzeigen.
// Die Abfrage wird nur angezeigt, wenn die App aktiv ist (sonst ignoriert iOS sie).
async function requestTrackingIfNeeded() {
  if (Platform.OS !== "ios") return;
  try {
    const { status } = await getTrackingPermissionsAsync();
    if (status !== "undetermined") return;

    if (AppState.currentState !== "active") {
      await new Promise((resolve) => {
        const sub = AppState.addEventListener("change", (state) => {
          if (state === "active") {
            sub.remove();
            resolve();
          }
        });
      });
    }
    // kurze Verzögerung, damit iOS die Abfrage zuverlässig anzeigt
    await new Promise((r) => setTimeout(r, 500));
    const result = await requestTrackingPermissionsAsync();
    console.log("🔒 ATT status:", result.status);
  } catch (e) {
    console.error("ATT error:", e);
  }
}

export default function Layout() {
  const [i18nReady, setI18nReady] = useState(false);
  const [attDone, setAttDone] = useState(Platform.OS !== "ios");

  useEffect(() => {
    requestTrackingIfNeeded().finally(() => setAttDone(true));
  }, []);

  useEffect(() => {
    initI18n()
      .then((lang) => {
        console.log("🌐 Language initialized:", lang);
        setI18nReady(true);
      })
      .catch((e) => {
        console.error("i18n init error:", e);
        setI18nReady(true);
      });
  }, []);

  if (!i18nReady || !attDone) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#F2F2F7",
        }}
      >
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <I18nextProvider i18n={i18n}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="trainer" />
        <Stack.Screen name="statistics" />
        <Stack.Screen name="wordlooker" />
        <Stack.Screen name="sentences" />
        <Stack.Screen name="practicefailedwords" />
      </Stack>
    </I18nextProvider>
  );
}
