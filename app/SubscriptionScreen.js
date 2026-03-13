import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Alert,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  getSubscriptionStatus,
  activatePremiumSubscription,
  SUBSCRIPTION_TYPES,
  FEATURES,
} from "./SubscriptionManager";

// Product IDs - MUST match Google Play Console
const PRODUCT_IDS = {
  MONTHLY: "monthly_premium",
  YEARLY: "yearly_premium",
};

const SubscriptionScreen = () => {
  const router = useRouter();
  const [subscription, setSubscription] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState("yearly");
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [products, setProducts] = useState([]);
  const [scaleAnim] = useState(new Animated.Value(1));
  const [pulseAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    loadSubscription();
    initializeIAP();

    // Pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    ).start();

    return () => {
      // Cleanup IAP connection
      RNIap.endConnection();
    };
  }, []);

  const loadSubscription = async () => {
    const status = await getSubscriptionStatus();
    setSubscription(status);
  };

  const initializeIAP = async () => {
    try {
      console.log("🔧 Initializing IAP...");

      // Initialize connection
      await RNIap.initConnection();
      console.log("✅ IAP connection initialized");

      // Get available products
      const availableProducts = await RNIap.getSubscriptions({
        skus: [PRODUCT_IDS.MONTHLY, PRODUCT_IDS.YEARLY],
      });

      console.log("✅ Products loaded:", availableProducts);
      setProducts(availableProducts);
      setIsInitialized(true);

      // Setup purchase update listener
      const purchaseUpdateSubscription = RNIap.purchaseUpdatedListener(
        async (purchase) => {
          console.log("📦 Purchase update:", purchase);
          const receipt = purchase.transactionReceipt;

          if (receipt) {
            try {
              // Acknowledge the purchase
              await RNIap.acknowledgePurchaseAndroid({
                token: purchase.purchaseToken,
              });

              // Activate premium in our database
              await handlePurchaseSuccess(purchase);

              // Finish the transaction
              await RNIap.finishTransaction({ purchase, isConsumable: false });
            } catch (error) {
              console.error("❌ Purchase acknowledgment error:", error);
            }
          }
        },
      );

      const purchaseErrorSubscription = RNIap.purchaseErrorListener((error) => {
        console.error("❌ Purchase error:", error);
        setIsPurchasing(false);

        if (error.code !== "E_USER_CANCELLED") {
          Alert.alert(
            "Purchase Failed",
            "There was an error processing your purchase. Please try again.",
          );
        }
      });

      return () => {
        purchaseUpdateSubscription?.remove();
        purchaseErrorSubscription?.remove();
      };
    } catch (error) {
      console.error("❌ IAP initialization error:", error);
      setIsInitialized(false);

      // Show error only if it's a real problem (not just testing in dev)
      if (__DEV__) {
        console.warn("IAP not available - using simulation for development");
      } else {
        Alert.alert(
          "Setup Error",
          "Could not connect to Google Play. Please make sure you have the latest version of Google Play Services.",
        );
      }
    }
  };

  const handlePurchaseSuccess = async (purchase) => {
    try {
      // Determine subscription type from product ID
      const subscriptionType =
        purchase.productId === PRODUCT_IDS.MONTHLY
          ? SUBSCRIPTION_TYPES.MONTHLY
          : SUBSCRIPTION_TYPES.YEARLY;

      // Activate premium subscription in database
      await activatePremiumSubscription(
        subscriptionType,
        purchase.purchaseToken,
      );

      // Reload subscription status
      await loadSubscription();

      // Show success message
      Alert.alert(
        "🎉 Welcome to Premium!",
        "Your subscription is now active. Enjoy unlimited access!",
        [{ text: "Start Learning", onPress: () => router.back() }],
      );

      setIsPurchasing(false);
    } catch (error) {
      console.error("❌ Error activating subscription:", error);
      Alert.alert(
        "Activation Error",
        "Your purchase was successful but there was an error activating your subscription. Please contact support.",
      );
      setIsPurchasing(false);
    }
  };

  const handlePurchase = async () => {
    if (isPurchasing) return;

    // If IAP is not initialized (dev mode), use simulation
    if (!isInitialized || __DEV__) {
      handlePurchaseSimulation();
      return;
    }

    setIsPurchasing(true);

    try {
      const productId =
        selectedPlan === "monthly" ? PRODUCT_IDS.MONTHLY : PRODUCT_IDS.YEARLY;

      console.log("🛒 Requesting purchase for:", productId);

      // Request subscription
      await RNIap.requestSubscription({
        sku: productId,
        ...(subscription?.isInTrial
          ? {}
          : {
              // Offer free trial if not already in trial
              subscriptionOffers: [{ offerToken: "trial_offer" }],
            }),
      });

      // Purchase listener will handle the rest
    } catch (error) {
      console.error("❌ Purchase request error:", error);
      setIsPurchasing(false);

      if (error.code !== "E_USER_CANCELLED") {
        Alert.alert(
          "Purchase Error",
          "Could not start the purchase. Please try again.",
        );
      }
    }
  };

  // Development simulation (fallback)
  const handlePurchaseSimulation = async () => {
    setIsPurchasing(true);

    Alert.alert(
      "Development Mode",
      "This is a simulated purchase for testing. In production, this would process a real Google Play purchase.",
      [
        {
          text: "Cancel",
          onPress: () => setIsPurchasing(false),
          style: "cancel",
        },
        {
          text: "Simulate Purchase",
          onPress: async () => {
            try {
              const subscriptionType =
                selectedPlan === "monthly"
                  ? SUBSCRIPTION_TYPES.MONTHLY
                  : SUBSCRIPTION_TYPES.YEARLY;

              await activatePremiumSubscription(
                subscriptionType,
                `simulated_${Date.now()}`,
              );

              await loadSubscription();

              Alert.alert(
                "✅ Simulated Success",
                "Premium activated (simulation mode)",
              );
              setIsPurchasing(false);
            } catch (error) {
              console.error("Simulation error:", error);
              Alert.alert("Error", "Simulation failed");
              setIsPurchasing(false);
            }
          },
        },
      ],
    );
  };

  const handleRestorePurchase = async () => {
    if (!isInitialized) {
      Alert.alert(
        "Not Available",
        "Restore purchases is not available in development mode.",
      );
      return;
    }

    try {
      setIsPurchasing(true);
      console.log("🔄 Restoring purchases...");

      // Get purchase history
      const purchases = await RNIap.getAvailablePurchases();
      console.log("📜 Purchase history:", purchases);

      if (purchases.length === 0) {
        Alert.alert(
          "No Purchases Found",
          "We couldn't find any previous purchases for this account.",
        );
        setIsPurchasing(false);
        return;
      }

      // Find most recent subscription
      const subscription = purchases.find(
        (p) =>
          p.productId === PRODUCT_IDS.MONTHLY ||
          p.productId === PRODUCT_IDS.YEARLY,
      );

      if (subscription) {
        // Restore subscription
        await handlePurchaseSuccess(subscription);

        Alert.alert(
          "✅ Restored!",
          "Your subscription has been restored successfully.",
        );
      } else {
        Alert.alert(
          "No Subscription Found",
          "We couldn't find an active subscription for this account.",
        );
      }

      setIsPurchasing(false);
    } catch (error) {
      console.error("❌ Restore error:", error);
      Alert.alert(
        "Restore Failed",
        "Could not restore purchases. Please try again or contact support.",
      );
      setIsPurchasing(false);
    }
  };

  const getProductPrice = (productId) => {
    const product = products.find((p) => p.productId === productId);
    return product?.localizedPrice || "€3.99"; // Fallback price
  };

  const renderTrialBanner = () => {
    if (!subscription?.isInTrial) return null;

    return (
      <View style={styles.trialBanner}>
        <MaterialCommunityIcons name="timer-sand" size={24} color="#f59e0b" />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.trialBannerTitle}>Free Trial Active</Text>
          <Text style={styles.trialBannerText}>
            {subscription.daysLeftInTrial} days left in your free trial
          </Text>
        </View>
      </View>
    );
  };

  // If user is already premium, show success screen
  if (subscription?.isPremium && !subscription?.isInTrial) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <MaterialCommunityIcons
              name="arrow-left"
              size={24}
              color="#1e293b"
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Premium</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.successContent}>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <MaterialCommunityIcons name="crown" size={80} color="#fbbf24" />
          </Animated.View>

          <Text style={styles.successTitle}>You're Premium! 👑</Text>
          <Text style={styles.successSubtitle}>
            Enjoy unlimited access to all premium features
          </Text>

          <View style={styles.premiumFeaturesCard}>
            <Text style={styles.premiumFeaturesTitle}>Active Features:</Text>
            {[
              { icon: "infinity", title: "Unlimited Quizzes" },
              { icon: "close-circle-outline", title: "Ad-Free Experience" },
              { icon: "chart-line", title: "Advanced Statistics" },
              { icon: "trophy-award", title: "Premium Ranks" },
              { icon: "school", title: "Practice Failed Words" },
            ].map((feature, index) => (
              <View key={index} style={styles.premiumFeatureRow}>
                <View
                  style={[
                    styles.premiumFeatureIcon,
                    { backgroundColor: "#10b98115" },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={feature.icon}
                    size={24}
                    color="#10b981"
                  />
                </View>
                <Text style={styles.featureTitle}>{feature.title}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={styles.manageButton}
            onPress={() =>
              Alert.alert(
                "Manage Subscription",
                "You can manage your subscription in Google Play Store.",
              )
            }
          >
            <Text style={styles.manageButtonText}>
              Manage Subscription in Play Store
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Go Premium</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {renderTrialBanner()}

        {/* Hero Section */}
        <View style={styles.heroSection}>
          <Animated.View
            style={[
              styles.heroIconContainer,
              { transform: [{ scale: pulseAnim }] },
            ]}
          >
            <MaterialCommunityIcons name="crown" size={64} color="#fbbf24" />
          </Animated.View>
          <Text style={styles.heroTitle}>Unlock Premium Features</Text>
          <Text style={styles.heroSubtitle}>
            Master German articles faster with unlimited practice
          </Text>
        </View>

        {/* Features Grid */}
        <View style={styles.featuresGrid}>
          {[
            {
              icon: "infinity",
              title: "Unlimited Quizzes",
              description: "Practice as much as you want, no daily limits",
              color: "#6366f1",
            },
            {
              icon: "close-circle-outline",
              title: "Ad-Free Experience",
              description: "Learn without interruptions",
              color: "#10b981",
            },
            {
              icon: "chart-line",
              title: "Advanced Statistics",
              description: "Detailed timing, streaks, and session analytics",
              color: "#f59e0b",
            },
            {
              icon: "trophy-award",
              title: "Premium Ranks",
              description: "Unlock Grand Master, Legend, and Deity ranks",
              color: "#a855f7",
            },
            {
              icon: "school",
              title: "Practice Failed Words",
              description: "Focus on your weakest areas for faster improvement",
              color: "#ef4444",
            },
          ].map((feature, index) => (
            <View key={index} style={styles.featureCard}>
              <View
                style={[
                  styles.featureIcon,
                  { backgroundColor: `${feature.color}15` },
                ]}
              >
                <MaterialCommunityIcons
                  name={feature.icon}
                  size={24}
                  color={feature.color}
                />
              </View>
              <Text style={styles.featureTitle}>{feature.title}</Text>
              <Text style={styles.featureDescription}>
                {feature.description}
              </Text>
            </View>
          ))}
        </View>

        {/* Pricing Cards */}
        <Text style={styles.sectionTitle}>Choose Your Plan</Text>

        <TouchableOpacity
          style={[
            styles.pricingCard,
            selectedPlan === "yearly" && styles.pricingCardSelected,
          ]}
          onPress={() => setSelectedPlan("yearly")}
        >
          <View style={styles.popularBadge}>
            <Text style={styles.popularBadgeText}>BEST VALUE</Text>
          </View>

          <View style={styles.pricingHeader}>
            <View>
              <Text style={styles.pricingTitle}>Yearly</Text>
              <Text style={styles.pricingPrice}>
                {getProductPrice(PRODUCT_IDS.YEARLY)}/year
              </Text>
            </View>
            <View
              style={[
                styles.radioButton,
                selectedPlan === "yearly" && styles.radioButtonSelected,
              ]}
            >
              {selectedPlan === "yearly" && (
                <View style={styles.radioButtonInner} />
              )}
            </View>
          </View>

          <View style={styles.savingsBadge}>
            <MaterialCommunityIcons name="tag" size={16} color="#10b981" />
            <Text style={styles.savingsText}>Save 48% vs Monthly</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.pricingCard,
            selectedPlan === "monthly" && styles.pricingCardSelected,
          ]}
          onPress={() => setSelectedPlan("monthly")}
        >
          <View style={styles.pricingHeader}>
            <View>
              <Text style={styles.pricingTitle}>Monthly</Text>
              <Text style={styles.pricingPrice}>
                {getProductPrice(PRODUCT_IDS.MONTHLY)}/month
              </Text>
            </View>
            <View
              style={[
                styles.radioButton,
                selectedPlan === "monthly" && styles.radioButtonSelected,
              ]}
            >
              {selectedPlan === "monthly" && (
                <View style={styles.radioButtonInner} />
              )}
            </View>
          </View>
        </TouchableOpacity>

        {/* Trial Info */}
        {subscription?.isInTrial && (
          <View style={styles.trialInfoCard}>
            <MaterialCommunityIcons
              name="information-outline"
              size={20}
              color="#6366f1"
            />
            <Text style={styles.trialInfoText}>
              You're in your 7-day free trial. Subscribe now to continue
              enjoying premium features after your trial ends.
            </Text>
          </View>
        )}

        {/* CTA Button */}
        <TouchableOpacity
          style={[styles.ctaButton, isPurchasing && styles.ctaButtonDisabled]}
          onPress={handlePurchase}
          disabled={isPurchasing}
        >
          {isPurchasing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <MaterialCommunityIcons name="crown" size={20} color="#fff" />
              <Text style={styles.ctaButtonText}>
                {subscription?.isInTrial
                  ? "Subscribe Now"
                  : "Start 7-Day Free Trial"}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Restore Purchase */}
        <TouchableOpacity
          style={styles.restoreButton}
          onPress={handleRestorePurchase}
          disabled={isPurchasing}
        >
          <Text style={styles.restoreButtonText}>Restore Purchase</Text>
        </TouchableOpacity>

        {/* Terms */}
        <Text style={styles.termsText}>
          {!subscription?.isInTrial && "Start with a 7-day free trial. "}
          Payment will be charged to your Google Play account. Subscription
          automatically renews unless auto-renew is turned off at least 24 hours
          before the end of the current period.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1e293b",
  },
  scrollContent: {
    padding: 20,
  },
  successContent: {
    padding: 40,
    alignItems: "center",
  },
  trialBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef3c7",
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  trialBannerTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#92400e",
  },
  trialBannerText: {
    fontSize: 13,
    color: "#92400e",
    marginTop: 2,
  },
  heroSection: {
    alignItems: "center",
    marginBottom: 32,
  },
  heroIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#fef3c7",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1e293b",
    textAlign: "center",
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 16,
    color: "#64748b",
    textAlign: "center",
  },
  featuresGrid: {
    gap: 12,
    marginBottom: 32,
  },
  featureCard: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1e293b",
    flex: 1,
  },
  featureDescription: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 16,
  },
  pricingCard: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "#e2e8f0",
  },
  pricingCardSelected: {
    borderColor: "#6366f1",
    backgroundColor: "#eef2ff",
  },
  popularBadge: {
    position: "absolute",
    top: -12,
    right: 20,
    backgroundColor: "#fbbf24",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  popularBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#fff",
  },
  pricingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  pricingTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 4,
  },
  pricingPrice: {
    fontSize: 24,
    fontWeight: "800",
    color: "#6366f1",
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#cbd5e1",
    justifyContent: "center",
    alignItems: "center",
  },
  radioButtonSelected: {
    borderColor: "#6366f1",
  },
  radioButtonInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#6366f1",
  },
  savingsBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  savingsText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#10b981",
  },
  trialInfoCard: {
    flexDirection: "row",
    backgroundColor: "#eef2ff",
    padding: 16,
    borderRadius: 12,
    gap: 12,
    marginBottom: 20,
  },
  trialInfoText: {
    flex: 1,
    fontSize: 13,
    color: "#4338ca",
    lineHeight: 18,
  },
  ctaButton: {
    flexDirection: "row",
    backgroundColor: "#6366f1",
    paddingVertical: 16,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    shadowColor: "#6366f1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  ctaButtonDisabled: {
    opacity: 0.6,
  },
  ctaButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },
  restoreButton: {
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 16,
  },
  restoreButtonText: {
    color: "#6366f1",
    fontSize: 15,
    fontWeight: "600",
  },
  termsText: {
    fontSize: 12,
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 18,
    marginTop: 16,
  },
  successTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: "#1e293b",
    marginTop: 24,
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 16,
    color: "#64748b",
    textAlign: "center",
    marginBottom: 32,
  },
  premiumFeaturesCard: {
    width: "100%",
    backgroundColor: "#fff",
    padding: 24,
    borderRadius: 16,
    marginBottom: 24,
  },
  premiumFeaturesTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 16,
  },
  premiumFeatureRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  premiumFeatureIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  manageButton: {
    backgroundColor: "#f1f5f9",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
  },
  manageButtonText: {
    color: "#475569",
    fontSize: 15,
    fontWeight: "600",
  },
});

export default SubscriptionScreen;
