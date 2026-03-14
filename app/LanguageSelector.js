import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useTranslation } from "react-i18next";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { changeLanguage, SUPPORTED_LANGUAGES } from "./i18n";

export default function LanguageSelector() {
  const { i18n, t } = useTranslation();
  const [visible, setVisible] = useState(false);

  const currentLang = SUPPORTED_LANGUAGES.find(
    (l) => l.code === i18n.language
  ) || SUPPORTED_LANGUAGES[0];

  const handleSelect = async (code) => {
    await changeLanguage(code);
    setVisible(false);
  };

  return (
    <>
      {/* Trigger button — small flag + code */}
      <TouchableOpacity style={styles.trigger} onPress={() => setVisible(true)}>
        <Text style={styles.triggerFlag}>{currentLang.flag}</Text>
        <Text style={styles.triggerCode}>{currentLang.code.toUpperCase()}</Text>
        <MaterialCommunityIcons name="chevron-down" size={16} color="#8E8E93" />
      </TouchableOpacity>

      {/* Language picker modal */}
      <Modal visible={visible} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>{t("language")}</Text>
              <TouchableOpacity onPress={() => setVisible(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.list}>
              {SUPPORTED_LANGUAGES.map((lang) => {
                const isSelected = lang.code === i18n.language;
                return (
                  <TouchableOpacity
                    key={lang.code}
                    style={[styles.langRow, isSelected && styles.langRowSelected]}
                    onPress={() => handleSelect(lang.code)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.langFlag}>{lang.flag}</Text>
                    <View style={styles.langInfo}>
                      <Text style={[styles.langName, isSelected && styles.langNameSelected]}>
                        {lang.nativeName}
                      </Text>
                      <Text style={styles.langSubname}>{lang.name}</Text>
                    </View>
                    {isSelected && (
                      <MaterialCommunityIcons name="check-circle" size={22} color="#007AFF" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  triggerFlag: { fontSize: 18 },
  triggerCode: { fontSize: 13, fontWeight: "700", color: "#1C1C1E" },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingBottom: 40,
    maxHeight: "75%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#1C1C1E" },
  list: { paddingHorizontal: 16, paddingTop: 8 },
  langRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 4,
    gap: 12,
  },
  langRowSelected: { backgroundColor: "#EFF6FF" },
  langFlag: { fontSize: 28 },
  langInfo: { flex: 1 },
  langName: { fontSize: 16, fontWeight: "600", color: "#1C1C1E" },
  langNameSelected: { color: "#007AFF" },
  langSubname: { fontSize: 13, color: "#8E8E93", marginTop: 2 },
});
