import React from "react";
import { Text } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

const DraggableItem = ({
  item,
  type,
  children,
  style,
  onDragEnd,
}) => {
  const startX = item.positionX ?? 0;
  const startY = item.positionY ?? 0;

  const translateX = useSharedValue(startX);
  const translateY = useSharedValue(startY);

  const offsetX = useSharedValue(startX);
  const offsetY = useSharedValue(startY);

  const gesture = Gesture.Pan()
    .onBegin(() => {
      offsetX.value = translateX.value;
      offsetY.value = translateY.value;
    })
    .onUpdate((event) => {
      translateX.value = offsetX.value + event.translationX;
      translateY.value = offsetY.value + event.translationY;
    })
    .onEnd(() => {
      runOnJS(onDragEnd)(item, {
        positionX: Math.round(translateX.value),
        positionY: Math.round(translateY.value),
        type,
      });
    });

  const animatedStyle = useAnimatedStyle(() => ({
    position: "absolute",
    left: 0,
    top: 0,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[animatedStyle, style]}>
        {children || <Text>{item.name || item.label}</Text>}
      </Animated.View>
    </GestureDetector>
  );
};

export default DraggableItem;