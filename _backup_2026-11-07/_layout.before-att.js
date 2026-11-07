import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { initI18n } from "./i18n";
import { I18nextProvider } from "react-i18next";
import i18n from "./i18n";

export default function Layout() {
  const [i18nReady, setI18nReady] = useState(false);

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

  if (!i18nReady) {
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
