// RemindMe – Grouped Checklist App (Drag & Drop)
// ✔ Long‑press drag for groups & items
// ✔ Swipe to delete + Undo
// ✔ Haptics
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
  ScrollView,
  StatusBar,
  Pressable,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import {
  GestureHandlerRootView,
  Swipeable,
} from "react-native-gesture-handler";
import DraggableFlatList from "react-native-draggable-flatlist";

export default function App() {
  const scheme = useColorScheme();
  const [isDarkMode, setIsDarkMode] = useState(scheme === "dark");
  const theme = isDarkMode ? dark : light;

  const [groups, setGroups] = useState([]);
  const [groupText, setGroupText] = useState("");
  const [itemText, setItemText] = useState("");
  const [activeGroupId, setActiveGroupId] = useState(null);

  const [lastDeleted, setLastDeleted] = useState(null);
  const [showUndo, setShowUndo] = useState(false);
  const undoTimer = useRef(null);

  const themeThumbAnim = useRef(new Animated.Value(isDarkMode ? 1 : 0)).current;
  const hasLoaded = useRef(false);

  /* ---------------- Load / Save ---------------- */
  useEffect(() => {
    loadGroups();
    loadTheme();
  }, []);

  useEffect(() => {
    StatusBar.setBarStyle(isDarkMode ? "light-content" : "dark-content");
  }, [isDarkMode]);

  useEffect(() => {
    Animated.timing(themeThumbAnim, {
      toValue: isDarkMode ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [isDarkMode]);

  useEffect(() => {
    AsyncStorage.setItem("groups", JSON.stringify(groups));
  }, [groups]);

  useEffect(() => {
    AsyncStorage.setItem("theme", isDarkMode ? "dark" : "light");
  }, [isDarkMode]);

  const loadGroups = async () => {
    const data = await AsyncStorage.getItem("groups");
    if (data) setGroups(JSON.parse(data));
    hasLoaded.current = true;
  };

  const loadTheme = async () => {
    const stored = await AsyncStorage.getItem("theme");
    if (stored === "dark" || stored === "light") {
      setIsDarkMode(stored === "dark");
    }
  };

  /* ---------- Actions ---------- */
  const addGroup = () => {
    if (!groupText.trim()) return;
    setGroups((p) => [...p, { id: Date.now().toString(), title: groupText, items: [] }]);
    setGroupText("");
  };

  const addItem = (groupId) => {
    if (!itemText.trim()) return;
    setGroups((p) =>
      p.map((g) =>
        g.id === groupId
          ? { ...g, items: [...g.items, { id: Date.now().toString(), title: itemText, done: false }] }
          : g,
      ),
    );
    setItemText("");
  };

  const toggleItem = async (groupId, itemId) => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setGroups((p) =>
      p.map((g) =>
        g.id === groupId
          ? { ...g, items: g.items.map((i) => (i.id === itemId ? { ...i, done: !i.done } : i)) }
          : g,
      ),
    );
  };

  const deleteGroup = async (group) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setGroups((p) => p.filter((g) => g.id !== group.id));
    setLastDeleted({ type: "group", data: group });
    setShowUndo(true);
    resetUndoTimer();
  };

  const deleteItem = async (groupId, item) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setGroups((p) =>
      p.map((g) =>
        g.id === groupId ? { ...g, items: g.items.filter((i) => i.id !== item.id) } : g,
      ),
    );
    setLastDeleted({ type: "item", groupId, data: item });
    setShowUndo(true);
    resetUndoTimer();
  };

  const resetUndoTimer = () => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setShowUndo(false), 4000);
  };

  const undoDelete = () => {
    if (!lastDeleted) return;
    if (lastDeleted.type === "group") {
      setGroups((p) => [...p, lastDeleted.data]);
    } else {
      setGroups((p) =>
        p.map((g) =>
          g.id === lastDeleted.groupId ? { ...g, items: [...g.items, lastDeleted.data] } : g,
        ),
      );
    }
    setShowUndo(false);
    setLastDeleted(null);
  };

  /* ---------- Render ---------- */
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container(theme)}>
      <View style={styles.titleRow}>
          <Text style={styles.title(theme)}>RemindMe</Text>
          <View style={styles.themeToggleTrack(theme, isDarkMode)}>
            <View style={styles.themeToggleTouchRow}>
              <Pressable
                style={styles.themeToggleHalfTouch}
                onPress={async () => {
                  if (isDarkMode) {
                    await Haptics.selectionAsync();
                    setIsDarkMode(false);
                  }
                }}
              />
              <Pressable
                style={styles.themeToggleHalfTouch}
                onPress={async () => {
                  if (!isDarkMode) {
                    await Haptics.selectionAsync();
                    setIsDarkMode(true);
                  }
                }}
              />
            </View>
            <View style={styles.themeToggleHalves} pointerEvents="none">
              <View
                style={[styles.themeToggleHalf, styles.themeToggleHalfLeft]}
              >
                <Text
                  style={styles.themeToggleLabel(theme, !isDarkMode)}
                  numberOfLines={2}
                >
                  LIGHT{"\n"}MODE
                </Text>
              </View>
              <View
                style={[styles.themeToggleHalf, styles.themeToggleHalfRight]}
              >
                <Text
                  style={styles.themeToggleLabel(theme, isDarkMode)}
                  numberOfLines={2}
                >
                  DARK{"\n"}MODE
                </Text>
              </View>
            </View>
            <Animated.View
              style={[
                styles.themeToggleThumb(theme),
                {
                  transform: [
                    {
                      translateX: themeThumbAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, 128],
                      }),
                    },
                  ],
                },
              ]}
              pointerEvents="none"
            >
              <Text style={styles.themeToggleThumbIcon}>
                {isDarkMode ? "🌙" : "☀️"}
              </Text>
            </Animated.View>
          </View>
        </View>

        {/* Add Group */}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input(theme)}
            placeholder="Add a group (e.g. Groceries)"
            placeholderTextColor={theme.subtext}
            value={groupText}
            onChangeText={setGroupText}
          />
          <TouchableOpacity style={styles.addBtn(theme)} onPress={addGroup}>
            <Text style={styles.addText}>＋</Text>
          </TouchableOpacity>
        </View>

        {/* GROUP DRAG LIST */}
        <DraggableFlatList
          data={groups}
          keyExtractor={(g) => g.id}
          onDragBegin={async () => await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)}
          onDragEnd={({ data }) => hasLoaded.current && setGroups(data)}
          renderItem={({ item: group, drag, isActive }) => (
            <Swipeable
              renderRightActions={() => (
                <TouchableOpacity style={styles.deleteAction} onPress={() => deleteGroup(group)}>
                  <Text style={styles.deleteText}>Delete</Text>
                </TouchableOpacity>
              )}
            >
              <TouchableOpacity
                onLongPress={drag}
                activeOpacity={0.9}
                style={[styles.groupCard(theme), isActive && { opacity: 0.7 }]}
                onPress={() => setActiveGroupId(activeGroupId === group.id ? null : group.id)}
              >
                <Text style={styles.groupTitle(theme)}>{group.title}</Text>

                {activeGroupId === group.id && (
                  <>
                    <View style={styles.inputRow}>
                      <TextInput
                        style={styles.input(theme)}
                        placeholder="Add item"
                        placeholderTextColor={theme.subtext}
                        value={itemText}
                        onChangeText={setItemText}
                      />
                      <TouchableOpacity style={styles.addBtn(theme)} onPress={() => addItem(group.id)}>
                        <Text style={styles.addText}>＋</Text>
                      </TouchableOpacity>
                    </View>

                    {/* ITEM DRAG LIST */}
                    <DraggableFlatList
                      data={group.items}
                      keyExtractor={(i) => i.id}
                      onDragBegin={async () => await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
                      onDragEnd={({ data }) =>
                        hasLoaded.current &&
                        setGroups((p) => p.map((g) => (g.id === group.id ? { ...g, items: data } : g)))
                      }
                      renderItem={({ item, drag, isActive }) => (
                        <Swipeable
                          renderRightActions={() => (
                            <TouchableOpacity
                              style={styles.deleteAction}
                              onPress={() => deleteItem(group.id, item)}
                            >
                              <Text style={styles.deleteText}>Delete</Text>
                            </TouchableOpacity>
                          )}
                        >
                          <TouchableOpacity
                            onLongPress={drag}
                            style={[styles.itemRow(theme), isActive && { opacity: 0.6 }]}
                          >
                            <Text style={styles.checkbox(theme, item.done)} onPress={() => toggleItem(group.id, item.id)}>
                              {item.done ? "☑" : "☐"}
                            </Text>
                            <Text style={[styles.itemText(theme), item.done && styles.itemDone(theme)]}>
                              {item.title}
                            </Text>
                          </TouchableOpacity>
                        </Swipeable>
                      )}
                    />
                  </>
                )}
              </TouchableOpacity>
            </Swipeable>
          )}
        />

        {showUndo && (
          <View style={styles.undoBar(theme)}>
            <Text style={{ color: theme.text }}>Deleted</Text>
            <TouchableOpacity onPress={async () => {
                await Haptics.selectionAsync();
                undoDelete();
              }}>
              <Text style={{ color: theme.primary, fontWeight: "700" }}>UNDO</Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

/* ---------- Themes & Styles ---------- */
const light = { bg: "#F5F7FB", card: "#FFF", text: "#111", subtext: "#6B7280", primary: "#4F46E5" };
const dark = { bg: "#0F172A", card: "#1E293B", text: "#E5E7EB", subtext: "#9CA3AF", primary: "#6366F1" };

const styles = StyleSheet.create({
  container: (t) => ({ flex: 1, backgroundColor: t.bg, padding: 16 }),
  title: (t) => ({ fontSize: 28, fontWeight: "700", color: t.text, marginBottom: 12 }),
  inputRow: { flexDirection: "row", marginBottom: 10 },
  input: (t) => ({ flex: 1, backgroundColor: t.card, borderRadius: 12, padding: 14, color: t.text }),
  addBtn: (t) => ({ marginLeft: 8, backgroundColor: t.primary, borderRadius: 12, width: 52, alignItems: "center", justifyContent: "center" }),
  addText: { color: "#fff", fontSize: 26 },
  groupCard: (t) => ({ backgroundColor: t.card, borderRadius: 16, padding: 14, marginBottom: 12 }),
  groupTitle: (t) => ({ fontSize: 18, fontWeight: "600", color: t.text }),
  itemRow: (t) => ({ flexDirection: "row", alignItems: "center", paddingVertical: 10 }),
  checkbox: (t, done) => ({
    fontSize: 22,
    marginRight: 12,
    color: done ? t.primary : t.subtext,
  }),
  
  itemText: (t) => ({ fontSize: 16, color: t.text }),
  itemDone: (t) => ({ textDecorationLine: "line-through", color: t.subtext }),
  deleteAction: { backgroundColor: "#EF4444", justifyContent: "center", alignItems: "flex-end", paddingHorizontal: 20 },
  deleteText: { color: "#fff", fontWeight: "600" },
  undoBar: (t) => ({ position: "absolute", bottom: 40, left: 16, right: 16, backgroundColor: t.card, borderRadius: 14, padding: 20, flexDirection: "row", justifyContent: "space-between" }),
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
themeToggleTrack: (t, isDark) => ({
    width: 180,
    height: 52,
    borderRadius: 26,
    backgroundColor: isDark ? "#374151" : "#E4E8EC",
    overflow: "hidden",
    position: "relative",
    ...(isDark
      ? {
          shadowColor: "#000",
          shadowOffset: { width: 2, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 3,
          elevation: 4,
        }
      : {
          shadowColor: "#000",
          shadowOffset: { width: -1, height: -1 },
          shadowOpacity: 0.06,
          shadowRadius: 2,
          elevation: 1,
        }),
  }),
  themeToggleTouchRow: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: "row",
  },
  themeToggleHalfTouch: {
    flex: 1,
  },
  themeToggleHalves: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  themeToggleHalf: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  themeToggleHalfLeft: {
    alignItems: "flex-end",
    paddingRight: 8,
  },
  themeToggleHalfRight: {
    alignItems: "flex-start",
    paddingLeft: 8,
  },
  themeToggleLabel: (t, active) => ({
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
    color: active ? t.text : t.subtext,
    textAlign: "center",
  }),
  themeToggleThumb: (t) => ({
    position: "absolute",
    left: 4,
    top: 4,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: t.card,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 1, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  }),
  themeToggleThumbIcon: {
    fontSize: 20,
  },
});
