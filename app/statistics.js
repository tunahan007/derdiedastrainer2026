import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { openDatabaseSync } from "expo-sqlite";

const db = openDatabaseSync("appdata.db");

const Statistics = () => {
  const [stats, setStats] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Tabelle anlegen
        await db.execAsync(`
          CREATE TABLE IF NOT EXISTS statistics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            totalReviewed INTEGER,
            correctAnswers INTEGER,
            fails INTEGER,
            progressPercent REAL,
            sessionTime INTEGER
          );
        `);

        // Alle Daten abrufen
        const rows = await db.getAllAsync(
          "SELECT * FROM statistics ORDER BY date DESC"
        );

        setStats(rows);
      } catch (error) {
        console.error("DB Error:", error);
      }
    };

    loadData();
  }, []);

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>📊 Lernstatistiken</Text>

      {stats.length === 0 ? (
        <Text style={styles.emptyText}>Noch keine Daten vorhanden.</Text>
      ) : (
        stats.map((item) => (
          <View key={item.id} style={styles.card}>
            <Text style={styles.dateText}>
              🗓 {new Date(item.date).toLocaleDateString()}{" "}
              {new Date(item.date).toLocaleTimeString()}
            </Text>
            <Text style={styles.item}>
              👁️‍🗨️ Wörter/Sätze: {item.totalReviewed}
            </Text>
            <Text style={styles.item}>
              ✅ Richtige Antworten: {item.correctAnswers}
            </Text>
            <Text style={styles.item}>❌ Fehler: {item.fails}</Text>
            <Text style={styles.item}>
              📈 Fortschritt: {item.progressPercent?.toFixed(1)} %
            </Text>
            <Text style={styles.item}>
              ⏱️ Zeit: {Math.round((item.sessionTime || 0) / 60)} Min
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  );
};

export default Statistics;

const styles = StyleSheet.create({
  container: { flex: 1, padding: 15, backgroundColor: "#e6ffe6" },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 18,
    textAlign: "center",
    marginTop: 40,
    color: "#555",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#3498db",
  },
  dateText: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 5,
    color: "#2c3e50",
  },
  item: { fontSize: 16, marginVertical: 2, color: "#333" },
});
