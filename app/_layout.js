import { Stack } from "expo-router";
import { useEffect } from "react";
import { initializeSubscriptionTables } from "./SubscriptionManager";

export default function Layout() {
  useEffect(() => {
    initializeSubscriptionTables();
  }, []);

  return <Stack screenOptions={{ headerShown: false }} />;
}
