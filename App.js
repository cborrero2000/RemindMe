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
  ScrollView,
  StatusBar,
  Modal,
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
  const [highlightedItemId, setHighlightedItemId] = useState(null);
  const [highlightedGroupId, setHighlightedGroupId] = useState(null);
  const [reorderContext, setReorderContext] = useState(null); // { type: 'group'|'item', groupId, groupIndex?, itemId?, itemIndex? }
  const undoTimer = useRef(null);
  const highlightTimer = useRef(null);
  const scrollViewRefs = useRef({});
  const groupsScrollRef = useRef(null);
  const themeThumbAnim = useRef(new Animated.Value(isDarkMode ? 0 : 1)).current;

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
  };

  const loadTheme = async () => {
    const stored = await AsyncStorage.getItem("theme");
    if (stored === "dark" || stored === "light") {
      setIsDarkMode(stored === "dark");
    }
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

  const deleteGroup = async (groupId) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    let deletedGroup = null;
    let groupIndex = 0;

    setGroups((prev) => {
      groupIndex = prev.findIndex((g) => g.id === groupId);
      deletedGroup = prev[groupIndex];
      return prev.filter((g) => g.id !== groupId);
    });

    setLastDeleted({
      groupId,
      group: deletedGroup,
      index: groupIndex,
      isGroup: true,
    });
    setShowUndo(true);

    if (activeGroupId === groupId) {
      setActiveGroupId(null);
    }

    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setShowUndo(false), 4000);
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

    let itemIndex = 0;
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id === groupId) {
          itemIndex = g.items.findIndex((i) => i.id === item.id);
          return { ...g, items: g.items.filter((i) => i.id !== item.id) };
        }
        return g;
      }),
    );

    setLastDeleted({ groupId, item, index: itemIndex });
    setShowUndo(true);

    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setShowUndo(false), 4000);
  };

  const moveGroupUp = (groupIndex) => {
    if (groupIndex <= 0) return;
    setGroups((prev) => {
      const next = [...prev];
      [next[groupIndex - 1], next[groupIndex]] = [
        next[groupIndex],
        next[groupIndex - 1],
      ];
      return next;
    });
    setReorderContext(null);
  };

  const moveGroupDown = (groupIndex) => {
    setGroups((prev) => {
      if (groupIndex >= prev.length - 1) return prev;
      const next = [...prev];
      [next[groupIndex], next[groupIndex + 1]] = [
        next[groupIndex + 1],
        next[groupIndex],
      ];
      return next;
    });
    setReorderContext(null);
  };

  const moveItemUp = (groupId, itemIndex) => {
    if (itemIndex <= 0) return;
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        const items = [...g.items];
        [items[itemIndex - 1], items[itemIndex]] = [
          items[itemIndex],
          items[itemIndex - 1],
        ];
        return { ...g, items };
      }),
    );
    setReorderContext(null);
  };

  const moveItemDown = (groupId, itemIndex) => {
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        if (itemIndex >= g.items.length - 1) return g;
        const items = [...g.items];
        [items[itemIndex], items[itemIndex + 1]] = [
          items[itemIndex + 1],
          items[itemIndex],
        ];
        return { ...g, items };
      }),
    );
    setReorderContext(null);
  };

  const undoDelete = () => {
    if (!lastDeleted) return;

    if (lastDeleted.isGroup) {
      // Undo group deletion
      setGroups((prev) => {
        const newGroups = [...prev];
        newGroups.splice(lastDeleted.index, 0, lastDeleted.group);
        return newGroups;
      });

      setHighlightedGroupId(lastDeleted.groupId);

      if (highlightTimer.current) clearTimeout(highlightTimer.current);
      highlightTimer.current = setTimeout(() => {
        setHighlightedGroupId(null);
      }, 1000);

      // Scroll to make the group visible
      setTimeout(() => {
        if (groupsScrollRef.current) {
          const groupHeight = 80; // Approximate height of each group
          const scrollPosition = Math.max(
            0,
            lastDeleted.index * groupHeight - 100,
          );
          groupsScrollRef.current.scrollTo({
            y: scrollPosition,
            animated: true,
          });
        }
      }, 100);
    } else {
      // Undo item deletion
      const itemIndex = lastDeleted.index;
      const itemHeight = 50; // Approximate height of each item
      const scrollPosition = Math.max(0, itemIndex * itemHeight - 100);

      setGroups((prev) =>
        prev.map((g) => {
          if (g.id === lastDeleted.groupId) {
            const newItems = [...g.items];
            newItems.splice(lastDeleted.index, 0, lastDeleted.item);
            return { ...g, items: newItems };
          }
          return g;
        }),
      );

      setHighlightedItemId(lastDeleted.item.id);

      if (highlightTimer.current) clearTimeout(highlightTimer.current);
      highlightTimer.current = setTimeout(() => {
        setHighlightedItemId(null);
      }, 1000);

      // Scroll to make the item visible
      setTimeout(() => {
        const scrollView = scrollViewRefs.current[lastDeleted.groupId];
        if (scrollView) {
          scrollView.scrollTo({ y: scrollPosition, animated: true });
        }
      }, 100);
    }

    setShowUndo(false);
    setLastDeleted(null);
  };

  /* ---------------- Render ---------------- */
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
            placeholder="Add a group (e.g. Walmart)"
            placeholderTextColor={theme.subtext}
            value={groupText}
            onChangeText={setGroupText}
          />
          <TouchableOpacity style={styles.addBtn(theme)} onPress={addGroup}>
            <Text style={styles.addText}>＋</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.groupsScroll} ref={groupsScrollRef}>
          {groups.map((group, groupIndex) => (
            <Swipeable
              key={group.id}
              renderRightActions={() => (
                <TouchableOpacity
                  style={styles.deleteAction}
                  onPress={() => deleteGroup(group.id)}
                >
                  <Text style={styles.deleteText}>Delete</Text>
                </TouchableOpacity>
              )}
            >
              <View
                style={[
                  styles.groupCard(theme),
                  highlightedGroupId === group.id && styles.highlightedGroup,
                ]}
              >
                <Pressable
                  onPress={() =>
                    setActiveGroupId(
                      activeGroupId === group.id ? null : group.id,
                    )
                  }
                  onLongPress={async () => {
                    await Haptics.impactAsync(
                      Haptics.ImpactFeedbackStyle.Medium,
                    );
                    setReorderContext({
                      type: "group",
                      groupId: group.id,
                      groupIndex,
                    });
                  }}
                >
                  <Text style={styles.groupTitle(theme)}>{group.title}</Text>
                </Pressable>

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

                    <ScrollView
                      style={styles.itemsScroll}
                      ref={(ref) => (scrollViewRefs.current[group.id] = ref)}
                    >
                      {group.items.map((item, itemIndex) => (
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
                          <Pressable
                            onLongPress={async () => {
                              await Haptics.impactAsync(
                                Haptics.ImpactFeedbackStyle.Medium,
                              );
                              setReorderContext({
                                type: "item",
                                groupId: group.id,
                                itemId: item.id,
                                itemIndex,
                              });
                            }}
                          >
                            <View
                              style={[
                                styles.itemRow(theme),
                                highlightedItemId === item.id &&
                                  styles.highlightedItem,
                              ]}
                            >
                              <TouchableOpacity
                                onPress={() => toggleItem(group.id, item.id)}
                              >
                                <Text
                                  style={[
                                    styles.checkbox,
                                    { color: theme.primary },
                                  ]}
                                >
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
                          </Pressable>
                        </Swipeable>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            </Swipeable>
          ))}
        </ScrollView>

        {/* Reorder menu (long-press) */}
        <Modal
          visible={!!reorderContext}
          transparent
          animationType="fade"
          onRequestClose={() => setReorderContext(null)}
        >
          <Pressable
            style={styles.reorderBackdrop}
            onPress={() => setReorderContext(null)}
          >
            <Pressable
              style={styles.reorderSheet(theme)}
              onPress={(e) => e.stopPropagation()}
            >
              <Text style={styles.reorderTitle(theme)}>
                {reorderContext?.type === "group" ? "Move group" : "Move item"}
              </Text>
              {reorderContext?.type === "group" && (
                <>
                  {reorderContext.groupIndex > 0 && (
                    <TouchableOpacity
                      style={styles.reorderBtn(theme)}
                      onPress={() => moveGroupUp(reorderContext.groupIndex)}
                    >
                      <Text style={styles.reorderBtnText(theme)}>Move up</Text>
                    </TouchableOpacity>
                  )}
                  {reorderContext.groupIndex < groups.length - 1 && (
                    <TouchableOpacity
                      style={styles.reorderBtn(theme)}
                      onPress={() => moveGroupDown(reorderContext.groupIndex)}
                    >
                      <Text style={styles.reorderBtnText(theme)}>
                        Move down
                      </Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
              {reorderContext?.type === "item" &&
                (() => {
                  const g = groups.find((x) => x.id === reorderContext.groupId);
                  const len = g?.items?.length ?? 0;
                  const idx = reorderContext.itemIndex ?? 0;
                  return (
                    <>
                      {idx > 0 && (
                        <TouchableOpacity
                          style={styles.reorderBtn(theme)}
                          onPress={() =>
                            moveItemUp(reorderContext.groupId, idx)
                          }
                        >
                          <Text style={styles.reorderBtnText(theme)}>
                            Move up
                          </Text>
                        </TouchableOpacity>
                      )}
                      {idx < len - 1 && (
                        <TouchableOpacity
                          style={styles.reorderBtn(theme)}
                          onPress={() =>
                            moveItemDown(reorderContext.groupId, idx)
                          }
                        >
                          <Text style={styles.reorderBtnText(theme)}>
                            Move down
                          </Text>
                        </TouchableOpacity>
                      )}
                    </>
                  );
                })()}
              <TouchableOpacity
                style={[styles.reorderBtn(theme), { marginTop: 8 }]}
                onPress={() => setReorderContext(null)}
              >
                <Text style={styles.reorderBtnText(theme)}>Cancel</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>

        {showUndo && (
          <View style={styles.undoBar(theme)}>
            <Text style={{ color: theme.text }}>Item deleted</Text>
            <TouchableOpacity
              onPress={async () => {
                await Haptics.selectionAsync();
                undoDelete();
              }}
            >
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
  inputRow: {
    flexDirection: "row",
    marginBottom: 10,
  },
  groupsScroll: {
    flex: 1,
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
  highlightedGroup: {
    backgroundColor: "#ADD8E6",
    opacity: 0.9,
  },
  groupTitle: (t) => ({
    fontSize: 18,
    fontWeight: "600",
    color: t.text,
  }),
  itemsScroll: {
    maxHeight: 300,
    marginVertical: 8,
  },
  itemRow: (t) => ({
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: t.card,
    paddingVertical: 10,
  }),
  highlightedItem: {
    backgroundColor: "#ADD8E6",
    borderRadius: 8,
    opacity: 0.9,
  },
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
    padding: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 999,
    zIndex: 999,
    minHeight: 72,
  }),
  reorderBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  reorderSheet: (t) => ({
    backgroundColor: t.card,
    borderRadius: 16,
    padding: 20,
    minWidth: 240,
  }),
  reorderTitle: (t) => ({
    fontSize: 16,
    fontWeight: "600",
    color: t.subtext,
    marginBottom: 12,
  }),
  reorderBtn: (t) => ({
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: t.bg,
  }),
  reorderBtnText: (t) => ({
    fontSize: 16,
    color: t.primary,
    fontWeight: "600",
  }),
});
