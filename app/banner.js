import {
  BannerAd,
  BannerAdSize,
  TestIds,
} from "react-native-google-mobile-ads";
import { View, Text } from "react-native";
import { useState } from "react";

export default function ABanner() {
  const [adStatus, setAdStatus] = useState("Loading...");

  const adUnitId = __DEV__
    ? TestIds.BANNER
    : "ca-app-pub-3818927199662677/3221934793";

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
          console.error("❌ Ad error:", error);
          setAdStatus(`Error: ${error.message}`); // ✅ FIXED HERE
        }}
      />
      {__DEV__ && <Text style={{ fontSize: 10 }}>{adStatus}</Text>}
    </View>
  );
}
