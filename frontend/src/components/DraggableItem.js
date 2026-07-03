import React from "react";
import { Animated, PanResponder, Text } from "react-native";

const DraggableItem = ({
  item,
  type,
  children,
  style,
  onDragEnd,
}) => {
  const startX = item.positionX ?? 0;
  const startY = item.positionY ?? 0;
  const pan = React.useRef(new Animated.ValueXY({ x: startX, y: startY })).current;
  const dragStart = React.useRef({ x: startX, y: startY });

  React.useEffect(() => {
    dragStart.current = { x: startX, y: startY };
    pan.setValue({ x: startX, y: startY });
  }, [pan, startX, startY]);

  const panResponder = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          pan.stopAnimation((value) => {
            dragStart.current = value;
          });
        },
        onPanResponderMove: (_event, gestureState) => {
          pan.setValue({
            x: dragStart.current.x + gestureState.dx,
            y: dragStart.current.y + gestureState.dy,
          });
        },
        onPanResponderRelease: () => {
          pan.stopAnimation((value) => {
            onDragEnd(item, {
              positionX: Math.round(value.x),
              positionY: Math.round(value.y),
              type,
            });
          });
        },
        onPanResponderTerminate: () => {
          pan.stopAnimation();
        },
      }),
    [item, onDragEnd, pan, type]
  );

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        {
          position: "absolute",
          left: 0,
          top: 0,
          transform: pan.getTranslateTransform(),
        },
        style,
      ]}
    >
      {children || <Text>{item.name || item.label}</Text>}
    </Animated.View>
  );
};

export default DraggableItem;
