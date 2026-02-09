export class PathEditor {
  simplify(points, threshold = 1.5) {
    if (points.length < 3) {
      return points;
    }

    const reduced = [points[0]];
    for (let i = 1; i < points.length - 1; i += 1) {
      const prev = reduced[reduced.length - 1];
      const current = points[i];
      const distance = Math.hypot(current.x - prev.x, current.y - prev.y);
      if (distance >= threshold) {
        reduced.push(current);
      }
    }
    reduced.push(points[points.length - 1]);
    return reduced;
  }

  toPathData(points, closed = false) {
    if (!points.length) {
      return "";
    }
    const commands = [`M ${points[0].x} ${points[0].y}`];
    for (let i = 1; i < points.length; i += 1) {
      commands.push(`L ${points[i].x} ${points[i].y}`);
    }
    if (closed) {
      commands.push("Z");
    }
    return commands.join(" ");
  }

  closePath(element) {
    const d = element.getAttribute("d") || "";
    if (!d.trim().endsWith("Z")) {
      element.setAttribute("d", `${d} Z`.trim());
    }
  }
}
