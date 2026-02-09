function parseNumber(value, fallback = 0) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parsePoints(pointsText = "") {
  return pointsText
    .trim()
    .split(/\s+/)
    .map((pair) => pair.split(",").map((entry) => parseNumber(entry, 0)))
    .filter((pair) => pair.length === 2 && Number.isFinite(pair[0]) && Number.isFinite(pair[1]));
}

function stringifyPoints(points) {
  return points.map(([x, y]) => `${x},${y}`).join(" ");
}

function translateViaTransform(element, dx, dy) {
  const previous = element.getAttribute("transform") || "";
  const translated = `${previous} translate(${dx} ${dy})`.trim();
  element.setAttribute("transform", translated);
}

function formatNumber(value) {
  return Number(Number(value).toFixed(2));
}

function parseNumberToken(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function samePivot(a, b, epsilon = 0.01) {
  return Math.abs(a.x - b.x) <= epsilon && Math.abs(a.y - b.y) <= epsilon;
}

function collapseTrailingRotations(transformText, pivot) {
  let remaining = (transformText || "").trim();
  let angle = 0;
  const rotateAtEnd = /(?:^|\s)rotate\(\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*([,\s]+([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)[,\s]+([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?))?\s*\)\s*$/i;

  while (remaining.length) {
    const match = remaining.match(rotateAtEnd);
    if (!match) {
      break;
    }

    if (!match[3] || !match[4]) {
      break;
    }

    const parsedAngle = parseNumberToken(match[1]);
    const parsedX = parseNumberToken(match[3]);
    const parsedY = parseNumberToken(match[4]);
    if (parsedAngle === null || parsedX === null || parsedY === null) {
      break;
    }

    if (!samePivot({ x: parsedX, y: parsedY }, pivot)) {
      break;
    }

    angle += parsedAngle;
    remaining = remaining.slice(0, remaining.length - match[0].length).trim();
  }

  return { remaining, angle };
}

export function rotateViaTransform(element, angleDeg, cx, cy) {
  const previous = element.getAttribute("transform") || "";
  const pivot = { x: Number(cx), y: Number(cy) };
  const collapsed = collapseTrailingRotations(previous, pivot);
  const mergedAngle = collapsed.angle + Number(angleDeg);
  if (Math.abs(mergedAngle) < 0.0001) {
    if (collapsed.remaining) {
      element.setAttribute("transform", collapsed.remaining);
    } else {
      element.removeAttribute("transform");
    }
    return;
  }
  const rotate = `rotate(${formatNumber(mergedAngle)} ${formatNumber(pivot.x)} ${formatNumber(pivot.y)})`;
  const nextTransform = `${collapsed.remaining} ${rotate}`.trim();
  element.setAttribute("transform", nextTransform);
}

export function translateElement(element, dx, dy) {
  const tag = element.tagName.toLowerCase();

  if (tag === "rect" || tag === "image" || tag === "text") {
    const x = parseNumber(element.getAttribute("x"), 0) + dx;
    const y = parseNumber(element.getAttribute("y"), 0) + dy;
    element.setAttribute("x", x);
    element.setAttribute("y", y);
    return;
  }

  if (tag === "circle" || tag === "ellipse") {
    const cx = parseNumber(element.getAttribute("cx"), 0) + dx;
    const cy = parseNumber(element.getAttribute("cy"), 0) + dy;
    element.setAttribute("cx", cx);
    element.setAttribute("cy", cy);
    return;
  }

  if (tag === "line") {
    element.setAttribute("x1", parseNumber(element.getAttribute("x1"), 0) + dx);
    element.setAttribute("y1", parseNumber(element.getAttribute("y1"), 0) + dy);
    element.setAttribute("x2", parseNumber(element.getAttribute("x2"), 0) + dx);
    element.setAttribute("y2", parseNumber(element.getAttribute("y2"), 0) + dy);
    return;
  }

  if (tag === "polyline" || tag === "polygon") {
    const points = parsePoints(element.getAttribute("points"));
    const translated = points.map(([x, y]) => [x + dx, y + dy]);
    element.setAttribute("points", stringifyPoints(translated));
    return;
  }

  translateViaTransform(element, dx, dy);
}

export function getGeometry(element) {
  const tag = element.tagName.toLowerCase();
  const base = {
    tag,
    fill: element.getAttribute("fill") || "none",
    stroke: element.getAttribute("stroke") || "#111111",
    strokeWidth: element.getAttribute("stroke-width") || "1",
    opacity: element.getAttribute("opacity") || "1",
    transform: element.getAttribute("transform") || "",
  };

  if (tag === "rect" || tag === "image") {
    return {
      ...base,
      x: parseNumber(element.getAttribute("x"), 0),
      y: parseNumber(element.getAttribute("y"), 0),
      width: parseNumber(element.getAttribute("width"), 0),
      height: parseNumber(element.getAttribute("height"), 0),
      rx: parseNumber(element.getAttribute("rx"), 0),
      ry: parseNumber(element.getAttribute("ry"), 0),
    };
  }

  if (tag === "circle") {
    return {
      ...base,
      cx: parseNumber(element.getAttribute("cx"), 0),
      cy: parseNumber(element.getAttribute("cy"), 0),
      r: parseNumber(element.getAttribute("r"), 0),
    };
  }

  if (tag === "ellipse") {
    return {
      ...base,
      cx: parseNumber(element.getAttribute("cx"), 0),
      cy: parseNumber(element.getAttribute("cy"), 0),
      rx: parseNumber(element.getAttribute("rx"), 0),
      ry: parseNumber(element.getAttribute("ry"), 0),
    };
  }

  if (tag === "line") {
    return {
      ...base,
      x1: parseNumber(element.getAttribute("x1"), 0),
      y1: parseNumber(element.getAttribute("y1"), 0),
      x2: parseNumber(element.getAttribute("x2"), 0),
      y2: parseNumber(element.getAttribute("y2"), 0),
    };
  }

  return base;
}

export function applyGeometry(element, geometry) {
  Object.entries(geometry).forEach(([key, value]) => {
    if (key === "tag" || value === undefined || value === null) {
      return;
    }
    if (key === "strokeWidth") {
      element.setAttribute("stroke-width", value);
      return;
    }
    element.setAttribute(key, value);
  });
}
