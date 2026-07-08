import React from "react";
import { Animated, StyleSheet, useWindowDimensions, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { PanGestureHandler, State } from "react-native-gesture-handler";

const DRAG_THRESHOLD = 0.18;
const FLICK_VELOCITY = 550;
const ACTIVATION_OFFSET = 8;
const EDGE_RESISTANCE = 0.28;

const SPRING_CONFIG = {
  friction: 8,
  tension: 70,
  useNativeDriver: true,
};

let pendingSwipeTransition = null;

export default function SwipeTabsPager({
  routes,
  activeRouteName,
  onChangeRouteName,
  renderRoute,
}) {
  const { width } = useWindowDimensions();
  const isFocused = useIsFocused();
  const routeCount = routes.length;
  const routesKey = routes.join("|");
  const routeIndex = routes.indexOf(activeRouteName);
  const activeIndex = routeIndex < 0 ? 0 : routeIndex;

  const translateX = React.useRef(
    new Animated.Value(-activeIndex * width),
  ).current;

  const dragX = React.useRef(new Animated.Value(0)).current;
  const isDraggingRef = React.useRef(false);

  React.useEffect(() => {
    if (!isFocused) return;

    dragX.setValue(0);

    if (
      pendingSwipeTransition?.routesKey === routesKey &&
      pendingSwipeTransition?.toRoute === activeRouteName
    ) {
      const { fromIndex, releaseOffset, toIndex } = pendingSwipeTransition;
      pendingSwipeTransition = null;

      translateX.setValue(-fromIndex * width + releaseOffset);

      Animated.spring(translateX, {
        toValue: -toIndex * width,
        ...SPRING_CONFIG,
      }).start();

      return;
    }

    if (pendingSwipeTransition?.routesKey === routesKey) {
      pendingSwipeTransition = null;
    }

    Animated.spring(translateX, {
      toValue: -activeIndex * width,
      ...(isDraggingRef.current
        ? { speed: 100, bounciness: 0, useNativeDriver: true }
        : SPRING_CONFIG),
    }).start();
  }, [
    activeIndex,
    activeRouteName,
    dragX,
    isFocused,
    routesKey,
    translateX,
    width,
  ]);

  const clampIndex = React.useCallback(
    (index) => Math.min(Math.max(index, 0), Math.max(routeCount - 1, 0)),
    [routeCount],
  );

  const clampDragOffset = React.useCallback(
    (offset) => {
      const limitedOffset = Math.min(Math.max(offset, -width), width);

      if (limitedOffset > 0 && activeIndex <= 0) {
        return limitedOffset * EDGE_RESISTANCE;
      }

      if (limitedOffset < 0 && activeIndex >= routeCount - 1) {
        return limitedOffset * EDGE_RESISTANCE;
      }

      return limitedOffset;
    },
    [activeIndex, routeCount, width],
  );

  const settleToIndex = React.useCallback(
    (nextIndex, releaseOffset = 0) => {
      const targetIndex = clampIndex(nextIndex);
      const nextRoute = routes[targetIndex];
      const routeChanged = targetIndex !== activeIndex;
      const clampedReleaseOffset = clampDragOffset(releaseOffset);

      translateX.setValue(-activeIndex * width + clampedReleaseOffset);
      dragX.setValue(0);

      if (routeChanged && nextRoute) {
        pendingSwipeTransition = {
          routesKey,
          fromIndex: activeIndex,
          toIndex: targetIndex,
          toRoute: nextRoute,
          releaseOffset: clampedReleaseOffset,
        };

        onChangeRouteName?.(nextRoute);
        return;
      }

      Animated.spring(translateX, {
        toValue: -targetIndex * width,
        ...SPRING_CONFIG,
      }).start();
    },
    [
      activeIndex,
      clampDragOffset,
      clampIndex,
      dragX,
      onChangeRouteName,
      routes,
      routesKey,
      translateX,
      width,
    ],
  );

  const handleGestureEvent = React.useMemo(
    () =>
      Animated.event([{ nativeEvent: { translationX: dragX } }], {
        useNativeDriver: true,
      }),
    [dragX],
  );

  const handleStateChange = React.useCallback(
    (event) => {
      const { oldState, state, translationX, velocityX } = event.nativeEvent;

      if (state === State.ACTIVE) {
        isDraggingRef.current = true;
        return;
      }

      if (oldState !== State.ACTIVE) return;

      isDraggingRef.current = false;

      const movedFarEnough = Math.abs(translationX) > width * DRAG_THRESHOLD;
      const flickedFastEnough = Math.abs(velocityX) > FLICK_VELOCITY;

      let nextIndex = activeIndex;

      if (flickedFastEnough) {
        nextIndex = velocityX < 0 ? activeIndex + 1 : activeIndex - 1;
      } else if (movedFarEnough) {
        nextIndex = translationX < 0 ? activeIndex + 1 : activeIndex - 1;
      }

      settleToIndex(nextIndex, translationX);
    },
    [activeIndex, settleToIndex, width],
  );

  const resistedDragX = dragX.interpolate({
    inputRange: [-width, 0, width],
    outputRange: [
      activeIndex >= routeCount - 1 ? -width * EDGE_RESISTANCE : -width,
      0,
      activeIndex <= 0 ? width * EDGE_RESISTANCE : width,
    ],
    extrapolate: "clamp",
  });

  const animatedTranslateX = Animated.add(translateX, resistedDragX);

  return (
    <View style={styles.container}>
      <PanGestureHandler
        activeOffsetX={[-ACTIVATION_OFFSET, ACTIVATION_OFFSET]}
        failOffsetY={[-30, 30]}
        onGestureEvent={handleGestureEvent}
        onHandlerStateChange={handleStateChange}
      >
        <Animated.View
          collapsable={false}
          style={[
            styles.pages,
            {
              width: width * Math.max(routeCount, 1),
              transform: [{ translateX: animatedTranslateX }],
            },
          ]}
        >
          {routes.map((routeName) => (
            <View key={routeName} style={[styles.page, { width }]}>
              {renderRoute(routeName, routeName === activeRouteName)}
            </View>
          ))}
        </Animated.View>
      </PanGestureHandler>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: "hidden",
  },
  pages: {
    flex: 1,
    flexDirection: "row",
  },
  page: {
    flex: 1,
  },
});