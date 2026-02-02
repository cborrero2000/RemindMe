// RemindMe – Grouped Checklist App (Clean & Stable)
// Features:
// ✔ Groups (e.g. Walmart, Home Tasks)
// ✔ Items with checkboxes
// ✔ Swipe to delete + Undo
// ✔ Haptics on check & delete
// ✔ Persistent storage
// ✔ Dark mode

import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import {
  GestureHandlerRootView,
  Swipeable,
} from "react-native-gesture-handler";

export default function App() {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? dark : light;

  const [groups, setGroups] = useState([]);
  const [groupText, setGroupText] = useState("");
  const [itemText, setItemText] = useState("");
  const [activeGroupId, setActiveGroupId] = useState(null);

  const [lastDeleted, setLastDeleted] = useState(null);
  const [showUndo, setShowUndo] = useState(false);
  const undoTimer = useRef(null);

  /* ---------------- Load / Save ---------------- */
  useEffect(() => {
    loadGroups();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem("groups", JSON.stringify(groups));
  }, [groups]);

  const loadGroups = async () => {
    const data = await AsyncStorage.getItem("groups");
    if (data) setGroups(JSON.parse(data));
  };

  /* ---------------- Actions ---------------- */
  const addGroup = () => {
    if (!groupText.trim()) return;

    setGroups((prev) => [
      ...prev,
      { id: Date.now().toString(), title: groupText, items: [] },
    ]);

    setGroupText("");
  };

  const addItem = () => {
    if (!itemText.trim() || !activeGroupId) return;

    setGroups((prev) =>
      prev.map((g) =>
        g.id === activeGroupId
          ? {
              ...g,
              items: [
                ...g.items,
                { id: Date.now().toString(), title: itemText, done: false },
              ],
            }
          : g,
      ),
    );

    setItemText("");
  };

  const toggleItem = async (groupId, itemId) => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? {
              ...g,
              items: g.items.map((i) =>
                i.id === itemId ? { ...i, done: !i.done } : i,
              ),
            }
          : g,
      ),
    );
  };

  const deleteItem = async (groupId, item) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? { ...g, items: g.items.filter((i) => i.id !== item.id) }
          : g,
      ),
    );

    setLastDeleted({ groupId, item });
    setShowUndo(true);

    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setShowUndo(false), 4000);
  };

  const undoDelete = () => {
    if (!lastDeleted) return;

    setGroups((prev) =>
      prev.map((g) =>
        g.id === lastDeleted.groupId
          ? { ...g, items: [...g.items, lastDeleted.item] }
          : g,
      ),
    );

    setShowUndo(false);
    setLastDeleted(null);
  };

  /* ---------------- Render ---------------- */
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container(theme)}>
        <Text style={styles.title(theme)}>RemindMe</Text>

        {/* Add Group */}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input(theme)}
            placeholder="Add a group (e.g. Walmart)"
            placeholderTextColor={theme.subtext}
            value={groupText}
            onChangeText={setGroupText}
          />
          <TouchableOpacity style={styles.addBtn(theme)} onPress={addGroup}>
            <Text style={styles.addText}>＋</Text>
          </TouchableOpacity>
        </View>

        {groups.map((group) => (
          <View key={group.id} style={styles.groupCard(theme)}>
            <TouchableOpacity
              onPress={() =>
                setActiveGroupId(activeGroupId === group.id ? null : group.id)
              }
            >
              <Text style={styles.groupTitle(theme)}>{group.title}</Text>
            </TouchableOpacity>

            {activeGroupId === group.id && (
              <View style={{ marginTop: 10 }}>
                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.input(theme)}
                    placeholder="Add item…"
                    placeholderTextColor={theme.subtext}
                    value={itemText}
                    onChangeText={setItemText}
                  />
                  <TouchableOpacity
                    style={styles.addBtn(theme)}
                    onPress={addItem}
                  >
                    <Text style={styles.addText}>＋</Text>
                  </TouchableOpacity>
                </View>

                {group.items.map((item) => (
                  <Swipeable
                    key={item.id}
                    renderRightActions={() => (
                      <TouchableOpacity
                        style={styles.deleteAction}
                        onPress={() => deleteItem(group.id, item)}
                      >
                        <Text style={styles.deleteText}>Delete</Text>
                      </TouchableOpacity>
                    )}
                  >
                    <View style={styles.itemRow(theme)}>
                      <TouchableOpacity
                        onPress={() => toggleItem(group.id, item.id)}
                      >
                        <Text style={styles.checkbox}>
                          {item.done ? "☑" : "☐"}
                        </Text>
                      </TouchableOpacity>
                      <Text
                        style={[
                          styles.itemText(theme),
                          item.done && styles.itemDone(theme),
                        ]}
                      >
                        {item.title}
                      </Text>
                    </View>
                  </Swipeable>
                ))}
              </View>
            )}
          </View>
        ))}

        {showUndo && (
          <View style={styles.undoBar(theme)}>
            <Text style={{ color: theme.text }}>Item deleted</Text>
            <TouchableOpacity onPress={undoDelete}>
              <Text style={{ color: theme.primary, fontWeight: "600" }}>
                UNDO
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

/* ---------------- Theme ---------------- */
const light = {
  bg: "#F5F7FB",
  card: "#FFFFFF",
  text: "#111827",
  subtext: "#6B7280",
  primary: "#4F46E5",
};

const dark = {
  bg: "#0F172A",
  card: "#1E293B",
  text: "#E5E7EB",
  subtext: "#9CA3AF",
  primary: "#6366F1",
};

/* ---------------- Styles ---------------- */
const styles = StyleSheet.create({
  container: (t) => ({
    flex: 1,
    backgroundColor: t.bg,
    padding: 16,
  }),
  title: (t) => ({
    fontSize: 28,
    fontWeight: "700",
    color: t.text,
    marginBottom: 12,
  }),
  inputRow: {
    flexDirection: "row",
    marginBottom: 10,
  },
  input: (t) => ({
    flex: 1,
    backgroundColor: t.card,
    borderRadius: 12,
    padding: 14,
    color: t.text,
  }),
  addBtn: (t) => ({
    marginLeft: 8,
    backgroundColor: t.primary,
    borderRadius: 12,
    width: 52,
    alignItems: "center",
    justifyContent: "center",
  }),
  addText: {
    color: "#fff",
    fontSize: 26,
  },
  groupCard: (t) => ({
    backgroundColor: t.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  }),
  groupTitle: (t) => ({
    fontSize: 18,
    fontWeight: "600",
    color: t.text,
  }),
  itemRow: (t) => ({
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: t.card,
    paddingVertical: 10,
  }),
  checkbox: {
    fontSize: 20,
    marginRight: 12,
  },
  itemText: (t) => ({
    fontSize: 16,
    color: t.text,
  }),
  itemDone: (t) => ({
    textDecorationLine: "line-through",
    color: t.subtext,
  }),
  deleteAction: {
    backgroundColor: "#EF4444",
    justifyContent: "center",
    alignItems: "flex-end",
    paddingHorizontal: 20,
  },
  deleteText: {
    color: "#fff",
    fontWeight: "600",
  },
  undoBar: (t) => ({
    position: "absolute",
    bottom: 80,
    left: 16,
    right: 16,
    backgroundColor: t.card,
    borderRadius: 14,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 999,
    zIndex: 999,
  }),
});
