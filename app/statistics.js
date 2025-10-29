import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { FontAwesome, MaterialCommunityIcons } from "@expo/vector-icons";
import { openDatabaseSync } from "expo-sqlite";
import ABanner from "./banner";

const db = openDatabaseSync("appdata.db");

const Statistics = () => {
  const [lastSession, setLastSession] = useState(null);
  const [totals, setTotals] = useState({
    totalReviewed: 0,
    totalCorrect: 0,
    totalFails: 0,
    accuracy: 0,
    totalTime: 0,
  });
  const [topWrongWords, setTopWrongWords] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Get last session
        const lastSessionData = await db.getFirstAsync(
          "SELECT * FROM statistics ORDER BY date DESC LIMIT 1"
        );
        setLastSession(lastSessionData);

        // Get totals
        const totalsData = await db.getFirstAsync(
          "SELECT * FROM totals WHERE id = 1"
        );

        if (totalsData) {
          const accuracy =
            totalsData.totalReviewed > 0
              ? (totalsData.totalCorrect / totalsData.totalReviewed) * 100
              : 0;

          setTotals({
            totalReviewed: totalsData.totalReviewed || 0,
            totalCorrect: totalsData.totalCorrect || 0,
            totalFails: totalsData.totalFails || 0,
            accuracy: accuracy,
            totalTime: totalsData.totalTime || 0,
          });
        }

        // Get top 5 wrong words
        const wrongWords = await db.getAllAsync(
          "SELECT word, count FROM wrong_words ORDER BY count DESC LIMIT 5"
        );
        setTopWrongWords(wrongWords || []);
      } catch (error) {
        console.error("DB Error:", error);
      }
    };

    loadData();
  }, []);

  const StatCard = ({ icon, label, value, color, bgColor }) => (
    <View style={[styles.statCard, { backgroundColor: bgColor }]}>
      <View style={[styles.iconContainer, { backgroundColor: color }]}>
        {icon}
      </View>
      <View style={styles.statContent}>
        <Text style={styles.statLabel}>{label}</Text>
        <Text style={styles.statValue}>{value}</Text>
      </View>
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <MaterialCommunityIcons name="trophy" size={32} color="#fbbf24" />
          <Text style={styles.headerTitle}>Test Statistics</Text>
        </View>
        <Text style={styles.headerSubtitle}>
          Your learning progress at a glance
        </Text>
      </View>
      {/* Quick Stats Grid */}
      <View style={styles.statsGrid}>
        <StatCard
          icon={
            <MaterialCommunityIcons name="chart-line" size={24} color="#fff" />
          }
          label="Accuracy"
          value={`${totals.accuracy.toFixed(0)}%`}
          color="#10b981"
          bgColor="#d1fae5"
        />
        <StatCard
          icon={<MaterialCommunityIcons name="target" size={24} color="#fff" />}
          label="Total"
          value={totals.totalReviewed}
          color="#6366f1"
          bgColor="#e0e7ff"
        />
        <StatCard
          icon={
            <MaterialCommunityIcons
              name="check-circle"
              size={24}
              color="#fff"
            />
          }
          label="Correct"
          value={totals.totalCorrect}
          color="#14b8a6"
          bgColor="#ccfbf1"
        />
        <StatCard
          icon={<MaterialCommunityIcons name="clock" size={24} color="#fff" />}
          label="Hours"
          value={(totals.totalTime / 3600).toFixed(1)}
          color="#a855f7"
          bgColor="#f3e8ff"
        />
      </View>
      {/* Last Session */}
      {lastSession && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Last Session</Text>
            <Text style={styles.cardDate}>
              {new Date(lastSession.date).toLocaleDateString("en-EN", {
                day: "2-digit",
                month: "short",
              })}
            </Text>
          </View>

          <View style={styles.sessionContent}>
            <View style={styles.sessionRow}>
              <Text style={styles.sessionLabel}>Words</Text>
              <Text style={styles.sessionValue}>
                {lastSession.totalReviewed}
              </Text>
            </View>

            <View style={styles.scoreRow}>
              <View style={styles.scoreBox}>
                <View style={styles.scoreHeader}>
                  <MaterialCommunityIcons
                    name="check-circle"
                    size={16}
                    color="#10b981"
                  />
                  <Text style={styles.scoreNumber}>
                    {lastSession.correctAnswers}
                  </Text>
                </View>
                <Text style={styles.scoreLabel}>Correct</Text>
              </View>

              <View style={[styles.scoreBox, styles.wrongBox]}>
                <View style={styles.scoreHeader}>
                  <MaterialCommunityIcons
                    name="close-circle"
                    size={16}
                    color="#ef4444"
                  />
                  <Text style={[styles.scoreNumber, styles.wrongNumber]}>
                    {lastSession.fails}
                  </Text>
                </View>
                <Text style={styles.wrongLabel}>Wrong</Text>
              </View>
            </View>

            {/* Progress Bar */}
            <View style={styles.progressSection}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>Progress</Text>
                <Text style={styles.progressValue}>
                  {lastSession.progressPercent?.toFixed(1)}%
                </Text>
              </View>
              <View style={styles.progressBarBg}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${lastSession.progressPercent}%` },
                  ]}
                />
              </View>
            </View>

            <View style={styles.timeRow}>
              <MaterialCommunityIcons name="clock" size={16} color="#64748b" />
              <Text style={styles.timeText}>
                {Math.round((lastSession.sessionTime || 0) / 60)} Minutes
              </Text>
            </View>
          </View>
        </View>
      )}
      {/* Top Wrong Words */}
      {topWrongWords.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Practice Recommended</Text>
          <View style={styles.wrongWordsContainer}>
            {topWrongWords.map((item, index) => (
              <View key={item.word} style={styles.wrongWordItem}>
                <View style={styles.wrongWordRank}>
                  <Text style={styles.wrongWordRankText}>{index + 1}</Text>
                </View>
                <View style={styles.wrongWordContent}>
                  <Text style={styles.wrongWordText}>{item.word}</Text>
                </View>
                <Text style={styles.wrongWordCount}>{item.count}×</Text>
              </View>
            ))}
          </View>
        </View>
      )}
      <ABanner />
      <View style={styles.bottomPadding} />
    </ScrollView>
  );
};

export default Statistics;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    backgroundColor: "#6366f1",
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 32,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#c7d2fe",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    marginTop: -20,
    gap: 12,
  },
  statCard: {
    width: "48%",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  statContent: {
    flex: 1,
  },
  statLabel: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1e293b",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 16,
    marginTop: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1e293b",
  },
  cardDate: {
    fontSize: 12,
    color: "#64748b",
  },
  sessionContent: {
    gap: 12,
  },
  sessionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sessionLabel: {
    fontSize: 14,
    color: "#64748b",
  },
  sessionValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1e293b",
  },
  scoreRow: {
    flexDirection: "row",
    gap: 8,
  },
  scoreBox: {
    flex: 1,
    backgroundColor: "#d1fae5",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },
  wrongBox: {
    backgroundColor: "#fee2e2",
    borderColor: "#fecaca",
  },
  scoreHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  scoreNumber: {
    fontSize: 18,
    fontWeight: "700",
    color: "#10b981",
  },
  wrongNumber: {
    color: "#ef4444",
  },
  scoreLabel: {
    fontSize: 12,
    color: "#059669",
  },
  wrongLabel: {
    fontSize: 12,
    color: "#dc2626",
  },
  progressSection: {
    marginTop: 4,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 14,
    color: "#64748b",
  },
  progressValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#6366f1",
  },
  progressBarBg: {
    height: 8,
    backgroundColor: "#e2e8f0",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#6366f1",
    borderRadius: 4,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  timeText: {
    fontSize: 14,
    color: "#64748b",
  },
  wrongWordsContainer: {
    marginTop: 12,
    gap: 8,
  },
  wrongWordItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff3e0",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#ffcc80",
  },
  wrongWordRank: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#f97316",
    justifyContent: "center",
    alignItems: "center",
  },
  wrongWordRankText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#fff",
  },
  wrongWordContent: {
    flex: 1,
  },
  wrongWordText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
  },
  wrongWordCount: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ea580c",
  },
  bottomPadding: {
    height: 32,
  },
});
