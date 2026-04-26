import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Pressable, Text, StyleSheet, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useTheme } from "../context/ThemeContext";
import { useDepartmentChannel } from "../context/DepartmentChannelContext";
import { useAuth } from "../context/AuthContext";

const BAR_HEIGHT = 74;
const BAR_HORIZONTAL_PADDING = 10;
const BAR_VERTICAL_PADDING = 10;
const TAB_HEIGHT = 54;
const TAB_GAP = 8;

function AnimatedTabItem({
  route,
  focused,
  onPress,
  onLongPress,
  icon,
  label,
  colors,
  typography,
  channelUnreadCount,
  width,
}) {
  const scaleAnim = useRef(new Animated.Value(focused ? 1 : 0.92)).current;
  const labelAnim = useRef(new Animated.Value(focused ? 1 : 0)).current;
  const translateYAnim = useRef(new Animated.Value(focused ? 0 : 3)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: focused ? 1 : 0.92,
        friction: 6,
        tension: 150,
        useNativeDriver: true,
      }),
      Animated.spring(translateYAnim, {
        toValue: focused ? 0 : 3,
        friction: 6,
        tension: 150,
        useNativeDriver: true,
      }),
      Animated.timing(labelAnim, {
        toValue: focused ? 1 : 0,
        duration: 180,
        useNativeDriver: false,
      }),
    ]).start();
  }, [focused, scaleAnim, translateYAnim, labelAnim]);

  return (
    <Pressable
      onPressIn={() => {
        Animated.spring(scaleAnim, {
          toValue: focused ? 0.95 : 0.93,
          friction: 5,
          tension: 200,
          useNativeDriver: true,
        }).start();
      }}
      onPressOut={() => {
        Animated.spring(scaleAnim, {
          toValue: focused ? 1 : 0.92,
          friction: 6,
          tension: 150,
          useNativeDriver: true,
        }).start();
      }}
      onPress={onPress}
      onLongPress={onLongPress}
      style={[styles.tabButton, { width, height: TAB_HEIGHT }]}
      accessibilityRole="button"
      accessibilityState={focused ? { selected: true } : {}}
    >
      <Animated.View
        style={[
          styles.tabInner,
          {
            transform: [{ scale: scaleAnim }, { translateY: translateYAnim }],
          },
        ]}
      >
        <View style={styles.iconWrap}>
          <Ionicons
            name={icon}
            size={20}
            color={focused ? colors.primary : colors.textSecondary}
          />
          {route.name === "Channel" && channelUnreadCount > 0 ? (
            <View
              style={[
                styles.dot,
                {
                  backgroundColor: colors.error ?? "#ef4444",
                  borderColor: colors.surface,
                },
              ]}
            />
          ) : null}
        </View>

        <Animated.View
          style={{
            overflow: "hidden",
            maxWidth: labelAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 90],
            }),
            opacity: labelAnim,
            marginLeft: labelAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 6],
            }),
          }}
        >
          <Animated.Text
            numberOfLines={1}
            style={[
              styles.activeLabel,
              {
                color: colors.primary,
                fontFamily: typography?.fontFamily?.semibold,
                fontSize: typography?.sm ?? 14,
                transform: [
                  {
                    translateX: labelAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-8, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            {label}
          </Animated.Text>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

export default function CustomBottomTabBar({ state, navigation }) {
  const { colors, typography, shadows, darkMode } = useTheme();
  const { channelUnreadCount } = useDepartmentChannel();
  const { user } = useAuth();

  const isAdmin = user?.role === "Admin" || user?.role === 3;
  const isHR = user?.role === "HR" || user?.role === 4;
  const canReviewRequests = isAdmin || isHR;

  const blurTint = darkMode ? "dark" : "light";

  const glassBackground = darkMode
    ? "rgba(15, 23, 42, 0.78)"
    : "rgba(255, 255, 255, 0.82)";

  const pillBackground = darkMode
    ? "rgba(255, 255, 255, 0.10)"
    : "rgba(255, 255, 255, 0.65)";

  const pillBorderColor = darkMode
    ? "rgba(255, 255, 255, 0.08)"
    : "rgba(255, 255, 255, 0.7)";

  const visibleRoutes = useMemo(() => {
    return state.routes.filter((route) => {
      if (
        route.name === "Desk" ||
        route.name === "Rooms" ||
        route.name === "Events"
      ) {
        return false;
      }

      if (route.name === "Approvals" && !canReviewRequests) {
        return false;
      }

      return true;
    });
  }, [state.routes, canReviewRequests]);

  const currentVisibleIndex = Math.max(
    0,
    visibleRoutes.findIndex(
      (route) => route.key === state.routes[state.index]?.key,
    ),
  );

  const [barWidth, setBarWidth] = useState(0);

  const pillTranslateX = useRef(new Animated.Value(0)).current;
  const pillScale = useRef(new Animated.Value(1)).current;
  const pillOpacity = useRef(new Animated.Value(1)).current;

  const tabWidth =
    barWidth > 0
      ? (barWidth - BAR_HORIZONTAL_PADDING * 2) /
        Math.max(visibleRoutes.length, 1)
      : 0;

  useEffect(() => {
    if (!tabWidth) return;

    Animated.parallel([
      Animated.spring(pillTranslateX, {
        toValue: currentVisibleIndex * tabWidth,
        friction: 8,
        tension: 120,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(pillScale, {
          toValue: 0.96,
          duration: 90,
          useNativeDriver: true,
        }),
        Animated.spring(pillScale, {
          toValue: 1,
          friction: 6,
          tension: 180,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.timing(pillOpacity, {
          toValue: 0.92,
          duration: 90,
          useNativeDriver: true,
        }),
        Animated.timing(pillOpacity, {
          toValue: 1,
          duration: 120,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [currentVisibleIndex, tabWidth, pillTranslateX, pillScale, pillOpacity]);

  const getTabConfig = (routeName, focused) => {
    switch (routeName) {
      case "Home":
        return {
          icon: focused ? "home" : "home-outline",
          label: "Accueil",
        };
      case "Channel":
        return {
          icon: focused ? "chatbubbles" : "chatbubbles-outline",
          label: "Canal",
        };
      case "Approvals":
        return {
          icon: focused ? "checkmark-circle" : "checkmark-circle-outline",
          label: "Approb.",
        };
      default:
        return {
          icon: "ellipse-outline",
          label: routeName,
        };
    }
  };

  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      <View
        style={[
          styles.shadowContainer,
          {
            shadowColor: shadows?.md?.shadowColor ?? "#000",
            shadowOffset: shadows?.md?.shadowOffset ?? { width: 0, height: 10 },
            shadowOpacity: shadows?.md?.shadowOpacity ?? 0.14,
            shadowRadius: shadows?.md?.shadowRadius ?? 16,
            elevation: shadows?.md?.elevation ?? 12,
          },
        ]}
      >
        <BlurView
          intensity={darkMode ? 28 : 36}
          tint={blurTint}
          style={[
            styles.blurShell,
            {
              borderColor: colors.border,
              backgroundColor: glassBackground,
            },
          ]}
          onLayout={(event) => setBarWidth(event.nativeEvent.layout.width)}
        >
          {tabWidth > 80 && (
            <Animated.View
              style={[
                styles.activePill,
                {
                  width: tabWidth,
                  backgroundColor: pillBackground,
                  borderWidth: 1,
                  borderColor: pillBorderColor,
                  transform: [
                    { translateX: pillTranslateX },
                    { scale: pillScale },
                  ],
                  opacity: pillOpacity,
                },
              ]}
            >
              <BlurView
                intensity={darkMode ? 14 : 20}
                tint={blurTint}
                style={styles.activePillBlur}
              />
            </Animated.View>
          )}

          <View style={styles.row}>
            {visibleRoutes.map((route) => {
              const focused =
                state.index ===
                state.routes.findIndex((r) => r.key === route.key);

              const { icon, label } = getTabConfig(route.name, focused);

              const onPress = () => {
                const event = navigation.emit({
                  type: "tabPress",
                  target: route.key,
                  canPreventDefault: true,
                });

                if (!focused && !event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              };

              const onLongPress = () => {
                navigation.emit({
                  type: "tabLongPress",
                  target: route.key,
                });
              };

              return (
                <AnimatedTabItem
                  key={route.key}
                  route={route}
                  focused={focused}
                  onPress={onPress}
                  onLongPress={onLongPress}
                  icon={icon}
                  label={label}
                  colors={colors}
                  typography={typography}
                  channelUnreadCount={channelUnreadCount}
                  width={tabWidth || 0}
                />
              );
            })}
          </View>
        </BlurView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 14,
  },

  shadowContainer: {
    borderRadius: 999,
  },

  blurShell: {
    minHeight: BAR_HEIGHT,
    borderRadius: 999,
    borderWidth: 1,
    overflow: "hidden",
    paddingHorizontal: BAR_HORIZONTAL_PADDING,
    paddingVertical: BAR_VERTICAL_PADDING,
  },

  activePill: {
    position: "absolute",
    zIndex: 1,
    left: BAR_HORIZONTAL_PADDING,
    top: BAR_VERTICAL_PADDING,
    bottom: BAR_VERTICAL_PADDING,
    borderRadius: 999,
    overflow: "hidden",
  },

  activePillBlur: {
    flex: 1,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    zIndex: 2,
  },

  tabButton: {
    justifyContent: "center",
    alignItems: "center",
  },

  tabInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },

  iconWrap: {
    position: "relative",
    width: 22,
    alignItems: "center",
    justifyContent: "center",
  },

  activeLabel: {
    includeFontPadding: false,
  },

  dot: {
    position: "absolute",
    top: -3,
    right: -5,
    width: 9,
    height: 9,
    borderRadius: 999,
    borderWidth: 1.5,
  },
});
