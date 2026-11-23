import {
  BannerAd,
  BannerAdSize,
  TestIds,
} from "react-native-google-mobile-ads";
import { View, Text, Platform } from "react-native";
import { useState } from "react";
import { useAdsReady } from "../lib/adsConsent";

export default function ABanner() {
  const [adStatus, setAdStatus] = useState("Loading...");
  const adsReady = useAdsReady();

  const adUnitId = __DEV__
    ? TestIds.BANNER
    : Platform.select({
        ios: "ca-app-pub-3818927199662677/5988682673",
        android: "ca-app-pub-3818927199662677/3221934793",
      });

  // Erst laden, wenn Einwilligung geklärt und AdMob gestartet ist
  if (!adsReady) return null;

  return (
    <View>
      <BannerAd
        unitId={adUnitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        onAdLoaded={() => {
          console.log("✅ Ad loaded");
          setAdStatus("Ad loaded");
        }}
        onAdFailedToLoad={(error) => {
          console.warn("⚠️ Ad not loaded:", error?.message);
          setAdStatus(`Error: ${error.message}`); // ✅ FIXED HERE
        }}
      />
      {!!__DEV__ && <Text style={{ fontSize: 10 }}>{adStatus}</Text>}
    </View>
  );
}
