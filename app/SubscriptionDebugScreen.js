import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  getSubscriptionStatus,
  SUBSCRIPTION_TYPES,
  SUBSCRIPTION_STATUS,
} from "./SubscriptionManager";
import { openDatabaseSync } from "expo-sqlite";

const db = openDatabaseSync("appdata.db");

const SubscriptionDebugScreen = () => {
  const router = useRouter();
  const [subscription, setSubscription] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    loadSubscription();
  }, [refreshKey]);

  const loadSubscription = async () => {
    const status = await getSubscriptionStatus();
    setSubscription(status);
  };

  const refresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  // Test Functions
  const setToFree = async () => {
    try {
      await db.runAsync(
        `UPDATE user_subscription 
         SET subscriptionType = ?,
             subscriptionStatus = ?,
             endDate = NULL,
             trialEndDate = NULL,
             purchaseToken = NULL
         WHERE userId = 'default'`,
        [SUBSCRIPTION_TYPES.FREE, SUBSCRIPTION_STATUS.ACTIVE],
      );
      Alert.alert("✅ Success", "Set to FREE user (no trial)");
      refresh();
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  };

  const setToTrial = async (days = 7) => {
    try {
      const now = new Date();
      const trialEnd = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

      await db.runAsync(
        `UPDATE user_subscription 
         SET subscriptionType = ?,
             subscriptionStatus = ?,
             trialStartDate = ?,
             trialEndDate = ?,
             startDate = ?,
             endDate = NULL,
             purchaseToken = NULL
         WHERE userId = 'default'`,
        [
          SUBSCRIPTION_TYPES.FREE,
          SUBSCRIPTION_STATUS.TRIAL,
          now.toISOString(),
          trialEnd.toISOString(),
          now.toISOString(),
        ],
      );
      Alert.alert("✅ Success", `Set to TRIAL (${days} days remaining)`);
      refresh();
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  };

  const setToMonthlyPremium = async () => {
    try {
      const now = new Date();
      const endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      await db.runAsync(
        `UPDATE user_subscription 
         SET subscriptionType = ?,
             subscriptionStatus = ?,
             startDate = ?,
             endDate = ?,
             purchaseToken = ?,
             trialEndDate = NULL
         WHERE userId = 'default'`,
        [
          SUBSCRIPTION_TYPES.MONTHLY,
          SUBSCRIPTION_STATUS.ACTIVE,
          now.toISOString(),
          endDate.toISOString(),
          `test_monthly_${Date.now()}`,
        ],
      );
      Alert.alert("✅ Success", "Set to MONTHLY PREMIUM (30 days)");
      refresh();
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  };

  const setToYearlyPremium = async () => {
    try {
      const now = new Date();
      const endDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

      await db.runAsync(
        `UPDATE user_subscription 
         SET subscriptionType = ?,
             subscriptionStatus = ?,
             startDate = ?,
             endDate = ?,
             purchaseToken = ?,
             trialEndDate = NULL
         WHERE userId = 'default'`,
        [
          SUBSCRIPTION_TYPES.YEARLY,
          SUBSCRIPTION_STATUS.ACTIVE,
          now.toISOString(),
          endDate.toISOString(),
          `test_yearly_${Date.now()}`,
        ],
      );
      Alert.alert("✅ Success", "Set to YEARLY PREMIUM (365 days)");
      refresh();
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  };

  const resetDailyQuizCount = async () => {
    try {
      await db.runAsync(
        `UPDATE user_subscription 
         SET dailyQuizCount = 0
         WHERE userId = 'default'`,
      );
      Alert.alert("✅ Success", "Daily quiz count reset to 0");
      refresh();
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  };

  const setQuizCount = async (count) => {
    try {
      const today = new Date().toISOString().split("T")[0];
      await db.runAsync(
        `UPDATE user_subscription 
         SET dailyQuizCount = ?,
             lastQuizDate = ?
         WHERE userId = 'default'`,
        [count, today],
      );
      Alert.alert("✅ Success", `Daily quiz count set to ${count}`);
      refresh();
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  };

  const expireTrial = async () => {
    try {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      await db.runAsync(
        `UPDATE user_subscription 
         SET trialEndDate = ?,
             subscriptionStatus = ?
         WHERE userId = 'default'`,
        [yesterday.toISOString(), SUBSCRIPTION_STATUS.ACTIVE],
      );
      Alert.alert("✅ Success", "Trial expired - now free user");
      refresh();
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  };

  const getStatusColor = () => {
    if (subscription?.isPremium) return "#10b981";
    if (subscription?.isInTrial) return "#f59e0b";
    return "#64748b";
  };

  const getStatusText = () => {
    if (subscription?.isPremium) {
      return subscription.subscriptionType === SUBSCRIPTION_TYPES.MONTHLY
        ? "PREMIUM - MONTHLY"
        : "PREMIUM - YEARLY";
    }
    if (subscription?.isInTrial) return "FREE TRIAL";
    return "FREE USER";
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🛠️ Subscription Debugger</Text>
        <TouchableOpacity onPress={refresh}>
          <MaterialCommunityIcons name="refresh" size={24} color="#6366f1" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Current Status */}
        <View
          style={[
            styles.statusCard,
            { backgroundColor: `${getStatusColor()}15` },
          ]}
        >
          <Text style={styles.statusTitle}>Current Status</Text>
          <Text style={[styles.statusBadge, { color: getStatusColor() }]}>
            {getStatusText()}
          </Text>

          {subscription && (
            <View style={styles.statusDetails}>
              <Text style={styles.statusDetail}>
                Type: {subscription.subscriptionType}
              </Text>
              <Text style={styles.statusDetail}>
                Status: {subscription.subscriptionStatus}
              </Text>
              {subscription.isInTrial && (
                <Text style={styles.statusDetail}>
                  Trial Days Left: {subscription.daysLeftInTrial}
                </Text>
              )}
              {subscription.endDate && (
                <Text style={styles.statusDetail}>
                  Expires: {new Date(subscription.endDate).toLocaleDateString()}
                </Text>
              )}
              <Text style={styles.statusDetail}>
                Daily Quizzes: {subscription.dailyQuizCount || 0}/5
              </Text>
            </View>
          )}
        </View>

        {/* Test Buttons */}
        <Text style={styles.sectionTitle}>Switch Subscription Type</Text>

        <TouchableOpacity
          style={[styles.testButton, { backgroundColor: "#64748b" }]}
          onPress={setToFree}
        >
          <MaterialCommunityIcons name="account" size={24} color="#fff" />
          <Text style={styles.testButtonText}>Set to FREE User</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.testButton, { backgroundColor: "#f59e0b" }]}
          onPress={() => setToTrial(7)}
        >
          <MaterialCommunityIcons name="timer-sand" size={24} color="#fff" />
          <Text style={styles.testButtonText}>Set to TRIAL (7 days)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.testButton, { backgroundColor: "#f59e0b" }]}
          onPress={() => setToTrial(1)}
        >
          <MaterialCommunityIcons
            name="timer-sand-empty"
            size={24}
            color="#fff"
          />
          <Text style={styles.testButtonText}>Set to TRIAL (1 day left)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.testButton, { backgroundColor: "#6366f1" }]}
          onPress={setToMonthlyPremium}
        >
          <MaterialCommunityIcons name="crown" size={24} color="#fff" />
          <Text style={styles.testButtonText}>Set to MONTHLY Premium</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.testButton, { backgroundColor: "#8b5cf6" }]}
          onPress={setToYearlyPremium}
        >
          <MaterialCommunityIcons name="crown" size={24} color="#fbbf24" />
          <Text style={styles.testButtonText}>Set to YEARLY Premium</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Quiz Count Controls</Text>

        <TouchableOpacity
          style={[styles.testButton, { backgroundColor: "#10b981" }]}
          onPress={resetDailyQuizCount}
        >
          <MaterialCommunityIcons name="refresh" size={24} color="#fff" />
          <Text style={styles.testButtonText}>Reset Daily Quiz Count</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.testButton, { backgroundColor: "#ef4444" }]}
          onPress={() => setQuizCount(5)}
        >
          <MaterialCommunityIcons name="lock" size={24} color="#fff" />
          <Text style={styles.testButtonText}>Set to 5/5 (Limit Reached)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.testButton, { backgroundColor: "#f97316" }]}
          onPress={() => setQuizCount(4)}
        >
          <MaterialCommunityIcons name="alert" size={24} color="#fff" />
          <Text style={styles.testButtonText}>Set to 4/5 (1 left)</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Trial Controls</Text>

        <TouchableOpacity
          style={[styles.testButton, { backgroundColor: "#94a3b8" }]}
          onPress={expireTrial}
        >
          <MaterialCommunityIcons name="timer-off" size={24} color="#fff" />
          <Text style={styles.testButtonText}>Expire Trial (→ Free)</Text>
        </TouchableOpacity>

        <View style={styles.infoCard}>
          <MaterialCommunityIcons
            name="information"
            size={20}
            color="#6366f1"
          />
          <Text style={styles.infoText}>
            Use these buttons to test different subscription states. Changes are
            immediate. Restart the app or navigate away and back to see the
            effects.
          </Text>
        </View>
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
  statusCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
  },
  statusTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748b",
    marginBottom: 8,
  },
  statusBadge: {
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 16,
  },
  statusDetails: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  statusDetail: {
    fontSize: 14,
    color: "#475569",
    fontWeight: "500",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 12,
    marginTop: 8,
  },
  testButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  testButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
  },
  infoCard: {
    flexDirection: "row",
    backgroundColor: "#eef2ff",
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: "#4338ca",
    lineHeight: 18,
  },
});

export default SubscriptionDebugScreen;
