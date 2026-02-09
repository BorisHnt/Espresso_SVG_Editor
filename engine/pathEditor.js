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

  anchorsToPathData(anchors, closed = false) {
    if (!anchors.length) {
      return "";
    }

    const commands = [`M ${anchors[0].x} ${anchors[0].y}`];
    for (let i = 1; i < anchors.length; i += 1) {
      const previous = anchors[i - 1];
      const current = anchors[i];
      commands.push(this.#segmentCommand(previous, current));
    }

    if (closed && anchors.length > 1) {
      const last = anchors[anchors.length - 1];
      const first = anchors[0];
      commands.push(this.#segmentCommand(last, first));
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

  #segmentCommand(from, to) {
    const hasCurve = Boolean(from.out || to.in);
    if (!hasCurve) {
      return `L ${to.x} ${to.y}`;
    }

    const c1x = from.out?.x ?? from.x;
    const c1y = from.out?.y ?? from.y;
    const c2x = to.in?.x ?? to.x;
    const c2y = to.in?.y ?? to.y;
    return `C ${c1x} ${c1y} ${c2x} ${c2y} ${to.x} ${to.y}`;
  }
}
