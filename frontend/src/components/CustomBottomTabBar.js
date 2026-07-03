import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Pressable,
  Text,
  StyleSheet,
  Animated,
  Keyboard,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useTheme } from "../context/ThemeContext";
import { useDepartmentChannel } from "../context/DepartmentChannelContext";
import { useRoles } from "../hooks/useRoles";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const BAR_HEIGHT = 72;
const BAR_HORIZONTAL_PADDING = 8;
const BAR_VERTICAL_PADDING = 8;
const TAB_HEIGHT = 56;

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
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pressAnim = useRef(new Animated.Value(0)).current;
  const labelAnim = useRef(new Animated.Value(focused ? 1 : 0)).current;
  const iconLiftAnim = useRef(new Animated.Value(focused ? -1 : 0)).current;
  const iconScaleAnim = useRef(new Animated.Value(1)).current;
  const notifyPulseAnim = useRef(new Animated.Value(0)).current;

  const hasChannelNotification =
    route.name === "Channel" && channelUnreadCount > 0;
  const unreadLabel = channelUnreadCount > 9 ? "9+" : String(channelUnreadCount);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(labelAnim, {
        toValue: focused ? 1 : 0,
        damping: 18,
        stiffness: 220,
        mass: 0.7,
        useNativeDriver: false,
      }),
      Animated.spring(iconLiftAnim, {
        toValue: focused ? -1 : 0,
        damping: 18,
        stiffness: 220,
        mass: 0.7,
        useNativeDriver: true,
      }),
    ]).start();
  }, [focused]);

  useEffect(() => {
    if (!hasChannelNotification || focused) {
      notifyPulseAnim.stopAnimation();
      notifyPulseAnim.setValue(0);
      return undefined;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(notifyPulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(notifyPulseAnim, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();

    return () => loop.stop();
  }, [focused, hasChannelNotification, notifyPulseAnim]);

  const handlePressIn = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 0.92,
        damping: 14,
        stiffness: 280,
        useNativeDriver: true,
      }),
      Animated.timing(pressAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(iconScaleAnim, {
        toValue: 1.15,
        damping: 12,
        stiffness: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePressOut = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        damping: 14,
        stiffness: 250,
        useNativeDriver: true,
      }),
      Animated.timing(pressAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.spring(iconScaleAnim, {
        toValue: 1,
        damping: 14,
        stiffness: 250,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const pressBackgroundColor = pressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["transparent", colors.primary + "15"],
  });

  const iconScale = Animated.multiply(iconScaleAnim, focused ? 1 : 1);
  const notifyScale = notifyPulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1.18],
  });
  const notifyOpacity = notifyPulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.16, 0.34],
  });

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      onLongPress={onLongPress}
      style={[styles.tabButton, { width, height: TAB_HEIGHT }]}
      accessibilityRole="button"
      accessibilityState={focused ? { selected: true } : {}}
      testID={`tab.${route.name}`}
    >
      <Animated.View
        style={[
          styles.tabInner,
          {
            transform: [{ scale: scaleAnim }],
            backgroundColor: pressBackgroundColor,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.iconWrap,
            hasChannelNotification && !focused && styles.iconWrapUnread,
            {
              transform: [{ translateY: iconLiftAnim }, { scale: iconScale }],
            },
          ]}
        >
          {hasChannelNotification && !focused ? (
            <Animated.View
              style={[
                styles.notifyHalo,
                {
                  backgroundColor: colors.error ?? "#ef4444",
                  opacity: notifyOpacity,
                  transform: [{ scale: notifyScale }],
                },
              ]}
            />
          ) : null}

          <Ionicons
            name={icon}
            size={21}
            color={
              focused
                ? colors.primary
                : hasChannelNotification
                  ? colors.error ?? "#ef4444"
                  : colors.textSecondary
            }
          />

          {hasChannelNotification ? (
            <View
              style={[
                styles.unreadBadge,
                {
                  backgroundColor: colors.error ?? "#ef4444",
                  borderColor: colors.surface,
                },
              ]}
            >
              <Text style={styles.unreadBadgeText}>{unreadLabel}</Text>
            </View>
          ) : null}
        </Animated.View>

        {focused && (
          <Animated.View
            style={{
              opacity: labelAnim,
              marginLeft: 4,
              transform: [
                {
                  translateX: labelAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-6, 0],
                  }),
                },
              ],
            }}
          >
            <Text
              numberOfLines={1}
              style={[
                styles.activeLabel,
                {
                  color: colors.primary,
                  fontFamily: typography?.fontFamily?.semibold,
                  fontSize: typography?.sm ?? 14,
                },
              ]}
            >
              {label}
            </Text>
          </Animated.View>
        )}
      </Animated.View>
    </Pressable>
  );
}

export default function CustomBottomTabBar({ state, navigation }) {
  const { colors, typography, shadows, darkMode } = useTheme();
  const { channelUnreadCount } = useDepartmentChannel();
  const { canReviewRequests } = useRoles();
  const insets = useSafeAreaInsets();

  const [barWidth, setBarWidth] = useState(0);

  const pillTranslateX = useRef(new Animated.Value(0)).current;
  const pillScaleX = useRef(new Animated.Value(1)).current;

  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", () => {
      setKeyboardVisible(true);
    });

    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      setKeyboardVisible(false);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

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
        damping: 22,
        stiffness: 220,
        mass: 0.8,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.spring(pillScaleX, {
          toValue: 0.94,
          damping: 16,
          stiffness: 260,
          useNativeDriver: true,
        }),
        Animated.spring(pillScaleX, {
          toValue: 1,
          damping: 18,
          stiffness: 220,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [currentVisibleIndex, tabWidth]);

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
      case "Announcements":
        return {
          icon: focused ? "megaphone" : "megaphone-outline",
          label: "Annonces",
        };
      case "Approvals":
        return {
          icon: focused ? "checkmark-circle" : "checkmark-circle-outline",
          label: "Approb.",
        };
      case "Statistics":
        return {
          icon: focused ? "bar-chart" : "bar-chart-outline",
          label: "Stats",
        };
      default:
        return {
          icon: focused ? "ellipse" : "ellipse-outline",
          label: routeName,
        };
    }
  };

  const blurTint = darkMode ? "dark" : "light";

  const glassBackground = darkMode
    ? "rgba(15, 23, 42, 0.72)"
    : "rgba(255, 255, 255, 0.78)";

  const pillBackground = darkMode
    ? "rgba(255, 255, 255, 0.13)"
    : "rgba(255, 255, 255, 0.92)";

  const pillBorderColor = darkMode
    ? "rgba(255, 255, 255, 0.10)"
    : "rgba(255, 255, 255, 0.95)";

  if (keyboardVisible) {
    return null;
  }
  return (
    <Animated.View
      style={[
        styles.wrapper,
        {
          bottom: Math.max(insets.bottom, 14),
        },
      ]}
      pointerEvents="box-none"
    >
      <View
        style={[
          styles.shadowContainer,
          {
            shadowColor: shadows?.md?.shadowColor ?? "#000",
            shadowOffset: shadows?.md?.shadowOffset ?? { width: 0, height: 12 },
            shadowOpacity: shadows?.md?.shadowOpacity ?? 0.16,
            shadowRadius: shadows?.md?.shadowRadius ?? 18,
            elevation: shadows?.md?.elevation ?? 14,
          },
        ]}
      >
        <BlurView
          intensity={darkMode ? 34 : 42}
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
          {tabWidth > 0 && (
            <Animated.View
              style={[
                styles.activePill,
                {
                  width: tabWidth,
                  backgroundColor: pillBackground,
                  borderColor: pillBorderColor,
                  transform: [
                    { translateX: pillTranslateX },
                    { scaleX: pillScaleX },
                  ],
                },
              ]}
            />
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
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 18,
    right: 18,
    zIndex: 999,
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
    borderWidth: 1,
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
    paddingHorizontal: 4,
  },

  iconWrap: {
    position: "relative",
    width: 23,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },

  iconWrapUnread: {
    borderRadius: 999,
  },

  notifyHalo: {
    position: "absolute",
    width: 34,
    height: 34,
    borderRadius: 999,
  },

  activeLabel: {
    includeFontPadding: false,
    fontWeight: "700",
  },

  unreadBadge: {
    position: "absolute",
    top: -7,
    right: -13,
    minWidth: 18,
    height: 18,
    borderRadius: 999,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },

  unreadBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
    includeFontPadding: false,
  },
});
