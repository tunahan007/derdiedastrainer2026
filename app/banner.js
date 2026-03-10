import {
  BannerAd,
  BannerAdSize,
  TestIds,
} from "react-native-google-mobile-ads";
import { View, Text } from "react-native";
import { useState, useEffect } from "react";
import { getSubscriptionStatus } from "./SubscriptionManager";

export default function ABanner() {
  const [adStatus, setAdStatus] = useState("Loading...");
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSubscription();
  }, []);

  const loadSubscription = async () => {
    try {
      const subStatus = await getSubscriptionStatus();
      setSubscription(subStatus);
    } catch (error) {
      console.error("Banner subscription check error:", error);
    } finally {
      setLoading(false);
    }
  };

  const adUnitId = __DEV__
    ? TestIds.BANNER
    : "ca-app-pub-3818927199662677/3221934793";

  // Don't show ads for premium or trial users
  if (loading) {
    return null; // Return nothing while checking subscription
  }

  if (subscription?.isPremium || subscription?.isInTrial) {
    return null; // Hide ads for premium/trial users
  }

  // Show ads only for free users
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
          setAdStatus(`Error: ${error.message}`);
        }}
      />
      {__DEV__ && <Text style={{ fontSize: 10 }}>{adStatus}</Text>}
    </View>
  );
}
