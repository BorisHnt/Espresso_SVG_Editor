export function snapValue(value, gridSize = 10) {
  return Math.round(value / gridSize) * gridSize;
}

export function snapPoint(point, gridSize = 10, enabled = true) {
  if (!enabled) {
    return point;
  }
  return {
    x: snapValue(point.x, gridSize),
    y: snapValue(point.y, gridSize),
  };
}
