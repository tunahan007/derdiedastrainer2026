import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  Animated,
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

const SubscriptionScreen = () => {
  const router = useRouter();
  const [subscription, setSubscription] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState("yearly");
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [pulseAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    loadSubscription();

    // Pulse animation for premium badge
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  const loadSubscription = async () => {
    const status = await getSubscriptionStatus();
    setSubscription(status);
  };

  const handlePurchase = async () => {
    setIsPurchasing(true);

    try {
      // TODO: Integrate with Google Play Billing
      // For now, simulate purchase

      Alert.alert(
        "Purchase Simulation",
        `This will integrate with Google Play Billing.\n\nSelected: ${selectedPlan === "monthly" ? "Monthly €3.99" : "Yearly €24.99"}`,
        [
          {
            text: "Cancel",
            style: "cancel",
            onPress: () => setIsPurchasing(false),
          },
          {
            text: "Simulate Purchase",
            onPress: async () => {
              const type =
                selectedPlan === "monthly"
                  ? SUBSCRIPTION_TYPES.MONTHLY
                  : SUBSCRIPTION_TYPES.YEARLY;

              const success = await activatePremiumSubscription(
                type,
                `test_token_${Date.now()}`,
              );

              if (success) {
                Alert.alert(
                  "🎉 Welcome to Premium!",
                  "You now have access to all premium features!",
                  [
                    {
                      text: "Start Learning",
                      onPress: () => router.back(),
                    },
                  ],
                );
                loadSubscription();
              }
              setIsPurchasing(false);
            },
          },
        ],
      );
    } catch (error) {
      console.error("Purchase error:", error);
      Alert.alert("Error", "Purchase failed. Please try again.");
      setIsPurchasing(false);
    }
  };

  const handleRestorePurchase = () => {
    Alert.alert(
      "Restore Purchase",
      "This will check Google Play for existing purchases and restore them.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Restore",
          onPress: () => {
            // TODO: Implement restore purchase logic
            Alert.alert("Info", "No previous purchases found.");
          },
        },
      ],
    );
  };

  const features = [
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
      description: "Detailed insights and progress tracking",
      color: "#f59e0b",
    },
    {
      icon: "trophy-award",
      title: "Premium Ranks",
      description: "Unlock Grand Master, Legend, and Deity ranks",
      color: "#a855f7",
    },
    {
      icon: "trending-up",
      title: "Progress Analytics",
      description: "Weekly and monthly performance reports",
      color: "#ec4899",
    },
    {
      icon: "palette",
      title: "Premium Themes",
      description: "Exclusive visual themes and customization",
      color: "#06b6d4",
    },
  ];

  const renderTrialBanner = () => {
    if (!subscription?.isInTrial) return null;

    return (
      <View style={styles.trialBanner}>
        <MaterialCommunityIcons name="timer-sand" size={20} color="#f59e0b" />
        <Text style={styles.trialText}>
          {subscription.daysLeftInTrial} days left in your free trial
        </Text>
      </View>
    );
  };

  const renderPremiumStatus = () => {
    if (!subscription?.isPremium || subscription?.isInTrial) return null;

    return (
      <View style={styles.premiumStatusCard}>
        <Animated.View
          style={[styles.premiumBadge, { transform: [{ scale: pulseAnim }] }]}
        >
          <MaterialCommunityIcons name="crown" size={32} color="#fbbf24" />
        </Animated.View>
        <View style={styles.premiumStatusContent}>
          <Text style={styles.premiumStatusTitle}>Premium Active</Text>
          <Text style={styles.premiumStatusSubtitle}>
            {subscription.subscriptionType === SUBSCRIPTION_TYPES.MONTHLY
              ? "Monthly Plan"
              : "Yearly Plan"}
          </Text>
          {subscription.endDate && (
            <Text style={styles.premiumStatusDate}>
              Renews on{" "}
              {new Date(subscription.endDate).toLocaleDateString("de-DE")}
            </Text>
          )}
        </View>
      </View>
    );
  };

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

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {renderPremiumStatus()}

          <Text style={styles.sectionTitle}>Your Premium Features</Text>
          <View style={styles.featuresGrid}>
            {features.map((feature, index) => (
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
          <Text style={styles.heroTitle}>Unlock Your Full Potential</Text>
          <Text style={styles.heroSubtitle}>
            Master German articles faster with premium features
          </Text>
        </View>

        {/* Pricing Plans */}
        <View style={styles.pricingSection}>
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
                <Text style={styles.pricingPrice}>€3.99</Text>
                <Text style={styles.pricingPeriod}>per month</Text>
              </View>
              {selectedPlan === "monthly" && (
                <MaterialCommunityIcons
                  name="check-circle"
                  size={32}
                  color="#6366f1"
                />
              )}
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.pricingCard,
              selectedPlan === "yearly" && styles.pricingCardSelected,
              styles.recommendedCard,
            ]}
            onPress={() => setSelectedPlan("yearly")}
          >
            <View style={styles.recommendedBadge}>
              <Text style={styles.recommendedText}>SAVE 48%</Text>
            </View>
            <View style={styles.pricingHeader}>
              <View>
                <Text style={styles.pricingTitle}>Yearly</Text>
                <Text style={styles.pricingPrice}>€24.99</Text>
                <Text style={styles.pricingPeriod}>per year</Text>
                <Text style={styles.savingsText}>Only €2.08/month</Text>
              </View>
              {selectedPlan === "yearly" && (
                <MaterialCommunityIcons
                  name="check-circle"
                  size={32}
                  color="#6366f1"
                />
              )}
            </View>
          </TouchableOpacity>
        </View>

        {/* Features List */}
        <Text style={styles.sectionTitle}>Premium Features</Text>
        <View style={styles.featuresGrid}>
          {features.map((feature, index) => (
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
          <MaterialCommunityIcons name="crown" size={20} color="#fff" />
          <Text style={styles.ctaButtonText}>
            {isPurchasing
              ? "Processing..."
              : subscription?.isInTrial
                ? "Subscribe Now"
                : "Start 7-Day Free Trial"}
          </Text>
        </TouchableOpacity>

        {/* Restore Purchase */}
        <TouchableOpacity
          style={styles.restoreButton}
          onPress={handleRestorePurchase}
        >
          <Text style={styles.restoreButtonText}>Restore Purchase</Text>
        </TouchableOpacity>

        {/* Terms */}
        <Text style={styles.termsText}>
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
  trialBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fef3c7",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 20,
    gap: 8,
  },
  trialText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#92400e",
  },
  premiumStatusCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  premiumBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#fef3c7",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  premiumStatusContent: {
    flex: 1,
  },
  premiumStatusTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 4,
  },
  premiumStatusSubtitle: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 4,
  },
  premiumStatusDate: {
    fontSize: 12,
    color: "#94a3b8",
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
  pricingSection: {
    marginBottom: 32,
    gap: 12,
  },
  pricingCard: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#e2e8f0",
  },
  pricingCardSelected: {
    borderColor: "#6366f1",
    backgroundColor: "#eef2ff",
  },
  recommendedCard: {
    position: "relative",
  },
  recommendedBadge: {
    position: "absolute",
    top: -10,
    right: 20,
    backgroundColor: "#10b981",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  recommendedText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  pricingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pricingTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 4,
  },
  pricingPrice: {
    fontSize: 32,
    fontWeight: "800",
    color: "#6366f1",
  },
  pricingPeriod: {
    fontSize: 14,
    color: "#64748b",
  },
  savingsText: {
    fontSize: 12,
    color: "#10b981",
    fontWeight: "600",
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 16,
  },
  featuresGrid: {
    gap: 12,
    marginBottom: 24,
  },
  featureCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  featureTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 2,
  },
  featureDescription: {
    flex: 1,
    fontSize: 13,
    color: "#64748b",
  },
  trialInfoCard: {
    flexDirection: "row",
    backgroundColor: "#eef2ff",
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    gap: 12,
  },
  trialInfoText: {
    flex: 1,
    fontSize: 13,
    color: "#4338ca",
    lineHeight: 18,
  },
  ctaButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#6366f1",
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginBottom: 12,
  },
  ctaButtonDisabled: {
    opacity: 0.5,
  },
  ctaButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  restoreButton: {
    alignItems: "center",
    paddingVertical: 12,
    marginBottom: 16,
  },
  restoreButtonText: {
    color: "#6366f1",
    fontSize: 14,
    fontWeight: "600",
  },
  manageButton: {
    backgroundColor: "#f1f5f9",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  manageButtonText: {
    color: "#475569",
    fontSize: 14,
    fontWeight: "600",
  },
  termsText: {
    fontSize: 11,
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 16,
  },
});

export default SubscriptionScreen;
