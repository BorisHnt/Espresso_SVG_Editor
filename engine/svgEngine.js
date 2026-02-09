import { Command } from "../core/history.js";
import { getDefaultCanvasConfig } from "../core/state.js";
import { PathEditor } from "./pathEditor.js";
import { SelectionManager } from "./selection.js";
import { snapPoint } from "./snapping.js";
import { applyGeometry, getGeometry, translateElement } from "./transform.js";
import { formatXml, minifyXml } from "../utils/xml.js";

const SVG_NS = "http://www.w3.org/2000/svg";

function unitFactor(unit, dpi) {
  if (unit === "px") {
    return 1;
  }
  if (unit === "mm") {
    return dpi / 25.4;
  }
  if (unit === "cm") {
    return dpi / 2.54;
  }
  if (unit === "in") {
    return dpi;
  }
  return 1;
}

function toPx(value, unit, dpi) {
  return value * unitFactor(unit, dpi);
}

function fromPx(value, unit, dpi) {
  return value / unitFactor(unit, dpi);
}

function parseLength(value) {
  if (!value) {
    return null;
  }
  const match = String(value).trim().match(/^([0-9]*\.?[0-9]+)\s*(px|mm|cm|in)?$/i);
  if (!match) {
    return null;
  }
  return {
    value: Number.parseFloat(match[1]),
    unit: (match[2] || "px").toLowerCase(),
  };
}

function parseSvgString(source) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(source, "image/svg+xml");
  const parserError = doc.querySelector("parsererror");
  if (parserError) {
    return { error: parserError.textContent || "Invalid SVG" };
  }
  const root = doc.documentElement;
  if (!root || root.tagName.toLowerCase() !== "svg") {
    return { error: "No <svg> root found" };
  }
  return { root };
}

export class SvgEngine {
  constructor({ svg, scene, defs, viewport, selectionOutline, eventBus, store, history }) {
    this.svg = svg;
    this.scene = scene;
    this.defs = defs;
    this.viewport = viewport;
    this.eventBus = eventBus;
    this.store = store;
    this.history = history;

    this.pathEditor = new PathEditor();
    this.selection = new SelectionManager({
      svg,
      scene,
      viewport,
      outline: selectionOutline,
      eventBus,
      store,
    });

    this.currentTool = store.getState().tool;
    this.pointerAction = null;
    this.pathSession = null;
    this.nodeCounter = 0;

    this.#bindEvents();
    this.#restoreDocument();
    this.applyCanvasConfig(this.getCanvasConfig(), {
      source: "boot",
      recordHistory: false,
      emitScene: false,
    });
    this.emitSceneChanged("boot");
  }

  #bindEvents() {
    this.svg.addEventListener("pointerdown", (event) => this.onPointerDown(event));
    this.svg.addEventListener("dblclick", (event) => this.onDoubleClick(event));
    window.addEventListener("pointermove", (event) => this.onPointerMove(event));
    window.addEventListener("pointerup", (event) => this.onPointerUp(event));
    window.addEventListener("keydown", (event) => this.onWindowKeyDown(event));
    this.viewport.addEventListener("wheel", (event) => this.onWheel(event), { passive: false });

    this.eventBus.on("tool:changed", ({ tool }) => {
      if (this.currentTool === "path" && tool !== "path" && this.pathSession) {
        this.finalizePathSession({ close: false });
      }
      this.currentTool = tool;
    });

    this.eventBus.on("selection:by-id", ({ id }) => {
      this.selection.selectById(id);
    });

    this.eventBus.on("scene:load-code", ({ code, recordHistory = true }) => {
      this.loadFromCode(code, { recordHistory, source: "code" });
    });

    this.eventBus.on("selection:delete", () => {
      this.deleteSelection();
    });

    this.eventBus.on("scene:reset", () => {
      this.resetDocument();
    });

    this.eventBus.on("view:zoom-in", () => this.zoomBy(1.2));
    this.eventBus.on("view:zoom-out", () => this.zoomBy(1 / 1.2));
    this.eventBus.on("view:zoom-fit", () => this.fitToCanvas());
    this.eventBus.on("canvas:apply-config", ({ config, source = "canvas-settings", recordHistory = true }) => {
      this.applyCanvasConfig(config, { source, recordHistory });
    });

    this.eventBus.on("image:insert", ({ dataUrl, x = 120, y = 120, width = 240, height = 180 }) => {
      const before = this.snapshot();
      const image = document.createElementNS(SVG_NS, "image");
      this.assignNodeId(image);
      image.setAttribute("x", x);
      image.setAttribute("y", y);
      image.setAttribute("width", width);
      image.setAttribute("height", height);
      image.setAttribute("href", dataUrl);
      this.scene.append(image);
      this.selection.select(image);
      this.pushSnapshotHistory("Insert image", before);
      this.emitSceneChanged("canvas");
    });

    this.eventBus.on("element:update", ({ id, geometry }) => {
      const element = this.scene.querySelector(`#${CSS.escape(id)}`);
      if (!element) {
        return;
      }
      const before = this.snapshot();
      applyGeometry(element, geometry);
      this.selection.refreshOutline();
      this.pushSnapshotHistory("Update properties", before);
      this.emitSceneChanged("canvas");
    });

    this.eventBus.on("element:rename", ({ id, name }) => {
      const element = this.scene.querySelector(`#${CSS.escape(id)}`);
      if (!element) {
        return;
      }
      const before = this.snapshot();
      element.setAttribute("data-name", name);
      this.pushSnapshotHistory("Rename layer", before);
      this.emitSceneChanged("canvas");
    });

    this.eventBus.on("layer:reorder", ({ id, direction }) => {
      const target = this.scene.querySelector(`#${CSS.escape(id)}`);
      if (!target) {
        return;
      }
      const before = this.snapshot();
      if (direction === "up" && target.previousElementSibling) {
        this.scene.insertBefore(target, target.previousElementSibling);
      }
      if (direction === "down" && target.nextElementSibling) {
        this.scene.insertBefore(target.nextElementSibling, target);
      }
      this.pushSnapshotHistory("Reorder layer", before);
      this.emitSceneChanged("canvas");
    });

    this.eventBus.on("layer:visibility", ({ id }) => {
      const target = this.scene.querySelector(`#${CSS.escape(id)}`);
      if (!target) {
        return;
      }
      const before = this.snapshot();
      const hidden = target.getAttribute("data-hidden") === "true";
      target.setAttribute("data-hidden", String(!hidden));
      target.style.display = hidden ? "" : "none";
      this.pushSnapshotHistory("Toggle visibility", before);
      this.emitSceneChanged("canvas");
    });

    this.eventBus.on("layer:lock", ({ id }) => {
      const target = this.scene.querySelector(`#${CSS.escape(id)}`);
      if (!target) {
        return;
      }
      const before = this.snapshot();
      const locked = target.getAttribute("data-locked") === "true";
      target.setAttribute("data-locked", String(!locked));
      this.pushSnapshotHistory("Toggle lock", before);
      this.emitSceneChanged("canvas");
    });

    this.eventBus.on("history:undo", () => this.history.undo());
    this.eventBus.on("history:redo", () => this.history.redo());
  }

  #restoreDocument() {
    const saved = this.store.loadDocument();
    if (!saved?.markup) {
      this.seedDocument();
      return;
    }
    const result = parseSvgString(saved.markup);
    if (result.error) {
      this.seedDocument();
      return;
    }
    this.importSvgRoot(result.root);
    if (saved.viewBox) {
      this.svg.setAttribute("viewBox", saved.viewBox);
    }
  }

  seedDocument() {
    const canvasConfig = this.getCanvasConfig();
    const widthPx = toPx(canvasConfig.width, canvasConfig.unit, canvasConfig.dpi);
    const heightPx = toPx(canvasConfig.height, canvasConfig.unit, canvasConfig.dpi);

    const bg = document.createElementNS(SVG_NS, "rect");
    this.assignNodeId(bg, "artboard");
    bg.setAttribute("x", "0");
    bg.setAttribute("y", "0");
    bg.setAttribute("width", widthPx);
    bg.setAttribute("height", heightPx);
    bg.setAttribute("fill", "#ffffff");
    bg.setAttribute("stroke", "#d4d0c8");
    bg.setAttribute("stroke-width", "1");
    bg.setAttribute("data-name", "Artboard");
    this.scene.append(bg);
  }

  importSvgRoot(root) {
    this.pathSession = null;
    this.scene.innerHTML = "";
    const incomingDefs = root.querySelector("defs");
    this.defs.innerHTML = incomingDefs ? incomingDefs.innerHTML : "";

    const sceneRoot = root.querySelector("#svgScene");
    if (sceneRoot) {
      Array.from(sceneRoot.children).forEach((child) => {
        this.scene.append(child.cloneNode(true));
      });
    } else {
      Array.from(root.children)
        .filter((child) => child.tagName?.toLowerCase() !== "defs")
        .forEach((child) => {
          this.scene.append(child.cloneNode(true));
        });
    }

    this.normalizeNodeIds();
    const viewBox = root.getAttribute("viewBox");
    if (viewBox) {
      this.svg.setAttribute("viewBox", viewBox);
    }

    this.syncCanvasConfigFromSvg();
    this.eventBus.emit("defs:changed", this.getDefsSummary());
    this.eventBus.emit("layers:refresh", this.getLayerModel());
  }

  getCanvasConfig() {
    return this.store.getState().canvas || getDefaultCanvasConfig();
  }

  applyCanvasConfig(config, { source = "canvas-settings", recordHistory = true, emitScene = true } = {}) {
    if (!config) {
      return;
    }

    const before = this.snapshot();
    const widthPx = toPx(config.width, config.unit, config.dpi);
    const heightPx = toPx(config.height, config.unit, config.dpi);

    this.svg.setAttribute("width", `${config.width}${config.unit}`);
    this.svg.setAttribute("height", `${config.height}${config.unit}`);
    this.svg.setAttribute("data-unit", config.unit);
    this.svg.setAttribute("data-dpi", String(config.dpi));

    const artboard = this.scene.querySelector("[id^='artboard-'], [data-name='Artboard']");
    if (artboard?.tagName?.toLowerCase() === "rect") {
      artboard.setAttribute("width", widthPx);
      artboard.setAttribute("height", heightPx);
    }

    this.setViewBox(config.viewBox, { silentState: true });
    this.selection.refreshOutline();

    if (recordHistory) {
      this.pushSnapshotHistory("Canvas settings", before);
    }

    if (emitScene) {
      this.emitSceneChanged(source);
    }
  }

  syncCanvasConfigFromSvg() {
    const current = this.getCanvasConfig();
    const viewBox = this.getViewBoxObject();
    const dpi = Number.parseFloat(this.svg.getAttribute("data-dpi")) || current.dpi;

    const parsedWidth = parseLength(this.svg.getAttribute("width"));
    const parsedHeight = parseLength(this.svg.getAttribute("height"));

    let unit = current.unit;
    let width = current.width;
    let height = current.height;

    if (parsedWidth && parsedHeight && parsedWidth.unit === parsedHeight.unit) {
      unit = parsedWidth.unit;
      width = parsedWidth.value;
      height = parsedHeight.value;
    } else {
      width = fromPx(viewBox.width, unit, dpi);
      height = fromPx(viewBox.height, unit, dpi);
    }

    const nextConfig = {
      ...current,
      width: Number(width.toFixed(unit === "px" ? 0 : 3)),
      height: Number(height.toFixed(unit === "px" ? 0 : 3)),
      unit,
      dpi,
      viewBox,
    };

    this.store.set(
      {
        canvas: nextConfig,
        showGrid: nextConfig.grid.enabled,
        snapEnabled: nextConfig.grid.snap,
      },
      { silent: true },
    );
    this.eventBus.emit("canvas:viewbox:changed", { viewBox });
  }

  onPointerDown(event) {
    if (event.button !== 0 && event.button !== 1) {
      return;
    }
    event.preventDefault();

    if (event.button === 1 || event.altKey) {
      this.pointerAction = {
        type: "pan",
        startClient: { x: event.clientX, y: event.clientY },
        startViewBox: this.getViewBoxObject(),
      };
      return;
    }

    const rawPoint = this.clientToSvg(event.clientX, event.clientY);
    const canvasConfig = this.getCanvasConfig();
    const snapEnabled = canvasConfig.grid?.snap ?? this.store.getState().snapEnabled;
    const spacing = canvasConfig.grid?.spacing ?? 10;
    const point = snapPoint(rawPoint, spacing, snapEnabled);

    if (this.currentTool === "select") {
      const target = this.findEditableTarget(event.target);
      if (target && !this.isLocked(target)) {
        this.selection.select(target);
        this.pointerAction = {
          type: "move",
          element: target,
          start: point,
          original: target.cloneNode(true),
          before: this.snapshot(),
        };
      } else {
        this.selection.clear();
      }
      return;
    }

    if (this.currentTool === "text") {
      const value = window.prompt("Texte", "Label") || "Text";
      const before = this.snapshot();
      const text = document.createElementNS(SVG_NS, "text");
      this.assignNodeId(text);
      text.setAttribute("x", point.x);
      text.setAttribute("y", point.y);
      text.setAttribute("fill", "#111111");
      text.textContent = value;
      this.scene.append(text);
      this.selection.select(text);
      this.pushSnapshotHistory("Add text", before);
      this.emitSceneChanged("canvas");
      return;
    }

    if (this.currentTool === "image") {
      this.eventBus.emit("image:request", { point });
      return;
    }

    if (this.currentTool === "path") {
      this.handlePathPointerDown(point, event);
      return;
    }

    if (this.isActionTool(this.currentTool)) {
      this.runActionTool(this.currentTool);
      return;
    }

    const before = this.snapshot();
    const element = this.createDraftElement(this.currentTool, point);
    if (!element) {
      return;
    }

    this.scene.append(element);
    this.selection.select(element);
    this.pointerAction = {
      type: "draw",
      tool: this.currentTool,
      element,
      start: point,
      points: [point],
      before,
    };
  }

  onPointerMove(event) {
    if (this.currentTool === "path" && this.pathSession && (!this.pointerAction || this.pointerAction.type !== "pan")) {
      const rawPoint = this.clientToSvg(event.clientX, event.clientY);
      const canvasConfig = this.getCanvasConfig();
      const snapEnabled = canvasConfig.grid?.snap ?? this.store.getState().snapEnabled;
      const spacing = canvasConfig.grid?.spacing ?? 10;
      const point = snapPoint(rawPoint, spacing, snapEnabled);
      this.pathSession.preview = point;
      this.renderPathSession();
    }

    if (!this.pointerAction) {
      return;
    }

    if (this.pointerAction.type === "pan") {
      const { startClient, startViewBox } = this.pointerAction;
      const current = this.getViewBoxObject();
      const rect = this.viewport.getBoundingClientRect();
      const dx = event.clientX - startClient.x;
      const dy = event.clientY - startClient.y;
      const ratioX = startViewBox.width / rect.width;
      const ratioY = startViewBox.height / rect.height;
      current.x = startViewBox.x - dx * ratioX;
      current.y = startViewBox.y - dy * ratioY;
      this.setViewBox(current);
      this.selection.refreshOutline();
      return;
    }

    const rawPoint = this.clientToSvg(event.clientX, event.clientY);
    const canvasConfig = this.getCanvasConfig();
    const snapEnabled = canvasConfig.grid?.snap ?? this.store.getState().snapEnabled;
    const spacing = canvasConfig.grid?.spacing ?? 10;
    const point = snapPoint(rawPoint, spacing, snapEnabled);

    if (this.pointerAction.type === "move") {
      const { element, original, start } = this.pointerAction;
      const dx = point.x - start.x;
      const dy = point.y - start.y;
      this.cloneAttributes(original, element);
      let finalDx = dx;
      let finalDy = dy;
      if (event.shiftKey) {
        if (Math.abs(dx) > Math.abs(dy)) {
          finalDy = 0;
        } else {
          finalDx = 0;
        }
      }
      translateElement(element, finalDx, finalDy);
      this.selection.refreshOutline();
      return;
    }

    if (this.pointerAction.type === "draw") {
      const { tool, element, start } = this.pointerAction;
      this.updateDraftElement(tool, element, start, point, event.shiftKey);
      this.selection.refreshOutline();
    }
  }

  onPointerUp() {
    if (!this.pointerAction) {
      return;
    }

    if (this.pointerAction.type === "draw") {
      const { element, before } = this.pointerAction;
      if (!this.hasVisibleSize(element)) {
        element.remove();
      } else {
        this.pushSnapshotHistory(`Draw ${this.pointerAction.tool}`, before);
      }
      this.emitSceneChanged("canvas");
    }

    if (this.pointerAction.type === "move") {
      const { before } = this.pointerAction;
      this.pushSnapshotHistory("Move element", before);
      this.emitSceneChanged("canvas");
    }

    this.pointerAction = null;
  }

  onDoubleClick(event) {
    if (this.currentTool !== "path" || !this.pathSession) {
      return;
    }
    event.preventDefault();
    this.finalizePathSession({ close: false });
  }

  onWindowKeyDown(event) {
    if (this.currentTool !== "path" || !this.pathSession) {
      return;
    }

    const targetTag = event.target?.tagName?.toLowerCase?.() || "";
    if (["input", "textarea", "select"].includes(targetTag) || event.target?.isContentEditable) {
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      this.finalizePathSession({ cancel: true });
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      this.finalizePathSession({ close: event.shiftKey });
    }
  }

  handlePathPointerDown(point, event) {
    if (!this.pathSession) {
      const before = this.snapshot();
      const path = document.createElementNS(SVG_NS, "path");
      this.assignNodeId(path);
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", "#4a4947");
      path.setAttribute("stroke-width", "2");
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("stroke-linejoin", "round");
      path.setAttribute("d", `M ${point.x} ${point.y}`);
      this.scene.append(path);
      this.selection.select(path);

      this.pathSession = {
        element: path,
        points: [point],
        preview: null,
        before,
      };
      return;
    }

    const session = this.pathSession;
    const last = session.points[session.points.length - 1];
    let nextPoint = point;

    if (event.shiftKey && last) {
      const dx = Math.abs(point.x - last.x);
      const dy = Math.abs(point.y - last.y);
      nextPoint = dx >= dy ? { x: point.x, y: last.y } : { x: last.x, y: point.y };
    }

    const first = session.points[0];
    const canvasConfig = this.getCanvasConfig();
    const closeThreshold = Math.max(6, canvasConfig.grid?.spacing ?? 10);
    if (session.points.length >= 3 && Math.hypot(nextPoint.x - first.x, nextPoint.y - first.y) <= closeThreshold) {
      this.finalizePathSession({ close: true });
      return;
    }

    session.points.push(nextPoint);
    session.preview = null;
    this.renderPathSession();
  }

  renderPathSession() {
    if (!this.pathSession) {
      return;
    }
    const { element, points, preview } = this.pathSession;
    const drawPoints = preview ? [...points, preview] : points;
    const simplified = this.pathEditor.simplify(drawPoints, 0.6);
    element.setAttribute("d", this.pathEditor.toPathData(simplified, false));
    this.selection.refreshOutline();
  }

  finalizePathSession({ close = false, cancel = false } = {}) {
    if (!this.pathSession) {
      return;
    }

    const { element, points, before } = this.pathSession;

    if (cancel || points.length < 2) {
      element.remove();
      this.pathSession = null;
      this.selection.clear();
      this.emitSceneChanged("canvas");
      return;
    }

    const simplified = this.pathEditor.simplify(points, 0.6);
    element.setAttribute("d", this.pathEditor.toPathData(simplified, close));
    this.pathSession = null;

    this.pushSnapshotHistory("Draw path", before);
    this.emitSceneChanged("canvas");
  }

  resetDocument() {
    this.finalizePathSession({ cancel: true });
    const defaults = getDefaultCanvasConfig();

    this.scene.innerHTML = "";
    this.defs.innerHTML = "";
    this.seedDocument();
    this.selection.clear({ silent: true });

    this.store.set(
      {
        canvas: defaults,
        showGrid: defaults.grid.enabled,
        snapEnabled: defaults.grid.snap,
        selectedId: null,
      },
      { silent: true },
    );

    this.applyCanvasConfig(defaults, {
      source: "reset",
      recordHistory: false,
      emitScene: false,
    });

    this.history.clear();
    this.emitSceneChanged("reset");
  }

  onWheel(event) {
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
    this.zoomBy(factor, { x: event.clientX, y: event.clientY });
  }

  isActionTool(tool) {
    return ["group", "clipPath", "mask", "symbol", "gradient", "filter"].includes(tool);
  }

  runActionTool(tool) {
    const selected = this.selection.getSelectedElement();
    if (!selected) {
      return;
    }
    const before = this.snapshot();

    if (tool === "group") {
      const group = document.createElementNS(SVG_NS, "g");
      this.assignNodeId(group, "group");
      group.setAttribute("data-name", "Group");
      this.scene.insertBefore(group, selected);
      group.append(selected);
      this.selection.select(group);
    }

    if (tool === "clipPath") {
      const clipPath = document.createElementNS(SVG_NS, "clipPath");
      this.assignNodeId(clipPath, "clip");
      const bbox = selected.getBBox();
      const clipShape = document.createElementNS(SVG_NS, "rect");
      clipShape.setAttribute("x", bbox.x);
      clipShape.setAttribute("y", bbox.y);
      clipShape.setAttribute("width", bbox.width);
      clipShape.setAttribute("height", bbox.height);
      clipPath.append(clipShape);
      this.defs.append(clipPath);
      selected.setAttribute("clip-path", `url(#${clipPath.id})`);
    }

    if (tool === "mask") {
      const mask = document.createElementNS(SVG_NS, "mask");
      this.assignNodeId(mask, "mask");
      const shape = selected.cloneNode(true);
      shape.setAttribute("fill", "white");
      mask.append(shape);
      this.defs.append(mask);
      selected.setAttribute("mask", `url(#${mask.id})`);
    }

    if (tool === "symbol") {
      const symbol = document.createElementNS(SVG_NS, "symbol");
      this.assignNodeId(symbol, "symbol");
      symbol.append(selected.cloneNode(true));
      this.defs.append(symbol);

      const use = document.createElementNS(SVG_NS, "use");
      this.assignNodeId(use, "use");
      use.setAttribute("href", `#${symbol.id}`);
      use.setAttribute("transform", "translate(20 20)");
      this.scene.append(use);
      this.selection.select(use);
    }

    if (tool === "gradient") {
      const gradient = document.createElementNS(SVG_NS, "linearGradient");
      this.assignNodeId(gradient, "gradient");
      gradient.setAttribute("x1", "0%");
      gradient.setAttribute("y1", "0%");
      gradient.setAttribute("x2", "100%");
      gradient.setAttribute("y2", "100%");
      const stopA = document.createElementNS(SVG_NS, "stop");
      stopA.setAttribute("offset", "0%");
      stopA.setAttribute("stop-color", "#b17457");
      const stopB = document.createElementNS(SVG_NS, "stop");
      stopB.setAttribute("offset", "100%");
      stopB.setAttribute("stop-color", "#452829");
      gradient.append(stopA, stopB);
      this.defs.append(gradient);
      selected.setAttribute("fill", `url(#${gradient.id})`);
    }

    if (tool === "filter") {
      const filter = document.createElementNS(SVG_NS, "filter");
      this.assignNodeId(filter, "filter");
      const shadow = document.createElementNS(SVG_NS, "feDropShadow");
      shadow.setAttribute("dx", "2");
      shadow.setAttribute("dy", "2");
      shadow.setAttribute("stdDeviation", "2");
      shadow.setAttribute("flood-color", "#000");
      shadow.setAttribute("flood-opacity", "0.2");
      filter.append(shadow);
      this.defs.append(filter);
      selected.setAttribute("filter", `url(#${filter.id})`);
    }

    this.pushSnapshotHistory(`Apply ${tool}`, before);
    this.emitSceneChanged("canvas");
  }

  createDraftElement(tool, point) {
    const commonStroke = "#4a4947";
    const commonFill = "rgba(177,116,87,0.16)";

    if (tool === "rect" || tool === "roundRect") {
      const rect = document.createElementNS(SVG_NS, "rect");
      this.assignNodeId(rect);
      rect.setAttribute("x", point.x);
      rect.setAttribute("y", point.y);
      rect.setAttribute("width", 1);
      rect.setAttribute("height", 1);
      rect.setAttribute("fill", commonFill);
      rect.setAttribute("stroke", commonStroke);
      rect.setAttribute("stroke-width", "1.5");
      if (tool === "roundRect") {
        rect.setAttribute("rx", "12");
        rect.setAttribute("ry", "12");
      }
      return rect;
    }

    if (tool === "circle") {
      const circle = document.createElementNS(SVG_NS, "circle");
      this.assignNodeId(circle);
      circle.setAttribute("cx", point.x);
      circle.setAttribute("cy", point.y);
      circle.setAttribute("r", 1);
      circle.setAttribute("fill", commonFill);
      circle.setAttribute("stroke", commonStroke);
      circle.setAttribute("stroke-width", "1.5");
      return circle;
    }

    if (tool === "ellipse") {
      const ellipse = document.createElementNS(SVG_NS, "ellipse");
      this.assignNodeId(ellipse);
      ellipse.setAttribute("cx", point.x);
      ellipse.setAttribute("cy", point.y);
      ellipse.setAttribute("rx", 1);
      ellipse.setAttribute("ry", 1);
      ellipse.setAttribute("fill", commonFill);
      ellipse.setAttribute("stroke", commonStroke);
      ellipse.setAttribute("stroke-width", "1.5");
      return ellipse;
    }

    if (tool === "line") {
      const line = document.createElementNS(SVG_NS, "line");
      this.assignNodeId(line);
      line.setAttribute("x1", point.x);
      line.setAttribute("y1", point.y);
      line.setAttribute("x2", point.x + 1);
      line.setAttribute("y2", point.y + 1);
      line.setAttribute("stroke", commonStroke);
      line.setAttribute("stroke-width", "2");
      return line;
    }

    if (tool === "polyline" || tool === "polygon") {
      const node = document.createElementNS(SVG_NS, tool);
      this.assignNodeId(node);
      node.setAttribute("points", `${point.x},${point.y} ${point.x + 1},${point.y + 1}`);
      node.setAttribute("fill", tool === "polygon" ? commonFill : "none");
      node.setAttribute("stroke", commonStroke);
      node.setAttribute("stroke-width", "1.5");
      return node;
    }

    if (tool === "path") {
      const path = document.createElementNS(SVG_NS, "path");
      this.assignNodeId(path);
      path.setAttribute("d", `M ${point.x} ${point.y}`);
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", commonStroke);
      path.setAttribute("stroke-width", "2");
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("stroke-linejoin", "round");
      return path;
    }

    return null;
  }

  updateDraftElement(tool, element, start, end, keepRatio = false) {
    const minX = Math.min(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    let width = Math.abs(end.x - start.x);
    let height = Math.abs(end.y - start.y);

    if (keepRatio) {
      const max = Math.max(width, height);
      width = max;
      height = max;
    }

    if (tool === "rect" || tool === "roundRect") {
      element.setAttribute("x", minX);
      element.setAttribute("y", minY);
      element.setAttribute("width", width || 1);
      element.setAttribute("height", height || 1);
      return;
    }

    if (tool === "circle") {
      const radius = Math.max(width, height) / 2 || 1;
      element.setAttribute("cx", start.x);
      element.setAttribute("cy", start.y);
      element.setAttribute("r", radius);
      return;
    }

    if (tool === "ellipse") {
      element.setAttribute("cx", start.x);
      element.setAttribute("cy", start.y);
      element.setAttribute("rx", width || 1);
      element.setAttribute("ry", height || 1);
      return;
    }

    if (tool === "line") {
      let x2 = end.x;
      let y2 = end.y;
      if (keepRatio) {
        const delta = Math.max(Math.abs(end.x - start.x), Math.abs(end.y - start.y));
        x2 = start.x + Math.sign(end.x - start.x || 1) * delta;
        y2 = start.y + Math.sign(end.y - start.y || 1) * delta;
      }
      element.setAttribute("x2", x2);
      element.setAttribute("y2", y2);
      return;
    }

    if (tool === "polyline") {
      const midX = (start.x + end.x) / 2;
      element.setAttribute("points", `${start.x},${start.y} ${midX},${end.y} ${end.x},${end.y}`);
      return;
    }

    if (tool === "polygon") {
      const top = `${start.x},${start.y}`;
      const right = `${end.x},${end.y}`;
      const left = `${start.x - (end.x - start.x)},${end.y}`;
      element.setAttribute("points", `${top} ${right} ${left}`);
    }
  }

  deleteSelection() {
    const selected = this.selection.getSelectedElement();
    if (!selected) {
      return;
    }
    if (this.pathSession && this.pathSession.element === selected) {
      this.finalizePathSession({ cancel: true });
      return;
    }
    const before = this.snapshot();
    selected.remove();
    this.selection.clear();
    this.pushSnapshotHistory("Delete", before);
    this.emitSceneChanged("canvas");
  }

  hasVisibleSize(element) {
    try {
      const bbox = element.getBBox();
      return bbox.width >= 1 || bbox.height >= 1;
    } catch {
      return true;
    }
  }

  findEditableTarget(node) {
    if (!(node instanceof SVGElement)) {
      return null;
    }
    if (node === this.svg || node === this.scene || node === this.defs) {
      return null;
    }
    const element = node.closest("[id]");
    if (!element || !this.scene.contains(element)) {
      return null;
    }
    return element;
  }

  isLocked(element) {
    return element.getAttribute("data-locked") === "true";
  }

  clientToSvg(clientX, clientY) {
    const point = this.svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    const ctm = this.svg.getScreenCTM();
    if (!ctm) {
      return { x: 0, y: 0 };
    }
    const local = point.matrixTransform(ctm.inverse());
    return { x: Number(local.x.toFixed(2)), y: Number(local.y.toFixed(2)) };
  }

  cloneAttributes(source, target) {
    Array.from(target.attributes).forEach((attribute) => {
      target.removeAttribute(attribute.name);
    });
    Array.from(source.attributes).forEach((attribute) => {
      target.setAttribute(attribute.name, attribute.value);
    });
    target.innerHTML = source.innerHTML;
  }

  assignNodeId(element, prefix = "node") {
    if (element.id) {
      return element.id;
    }
    this.nodeCounter += 1;
    const id = `${prefix}-${this.nodeCounter}`;
    element.id = id;
    if (!element.getAttribute("data-name")) {
      element.setAttribute("data-name", id);
    }
    return id;
  }

  normalizeNodeIds() {
    this.scene.querySelectorAll("*").forEach((node) => {
      this.assignNodeId(node);
    });
    this.defs.querySelectorAll("*").forEach((node) => {
      this.assignNodeId(node, "def");
    });
  }

  snapshot() {
    return {
      scene: this.scene.innerHTML,
      defs: this.defs.innerHTML,
      viewBox: this.svg.getAttribute("viewBox"),
      selectedId: this.selection.getSelectedId(),
    };
  }

  restoreSnapshot(snapshot, source = "history") {
    this.scene.innerHTML = snapshot.scene || "";
    this.defs.innerHTML = snapshot.defs || "";
    if (snapshot.viewBox) {
      this.svg.setAttribute("viewBox", snapshot.viewBox);
    }
    this.normalizeNodeIds();
    this.selection.selectById(snapshot.selectedId, { silent: true });
    this.emitSceneChanged(source);
  }

  pushSnapshotHistory(label, beforeSnapshot) {
    const afterSnapshot = this.snapshot();
    if (
      beforeSnapshot.scene === afterSnapshot.scene &&
      beforeSnapshot.defs === afterSnapshot.defs &&
      beforeSnapshot.viewBox === afterSnapshot.viewBox
    ) {
      return;
    }

    const command = new Command(
      label,
      () => this.restoreSnapshot(afterSnapshot, "history"),
      () => this.restoreSnapshot(beforeSnapshot, "history"),
    );
    this.history.execute(command, { alreadyExecuted: true });
  }

  getViewBoxObject() {
    const canvasConfig = this.getCanvasConfig();
    const defaultWidth = toPx(canvasConfig.width, canvasConfig.unit, canvasConfig.dpi);
    const defaultHeight = toPx(canvasConfig.height, canvasConfig.unit, canvasConfig.dpi);

    const [x = 0, y = 0, width = defaultWidth, height = defaultHeight] = (
      this.svg.getAttribute("viewBox") || `0 0 ${defaultWidth} ${defaultHeight}`
    )
      .split(/\s+/)
      .map((value) => Number.parseFloat(value));
    return { x, y, width, height };
  }

  setViewBox(box, options = { silentState: true }) {
    const normalized = {
      x: Number(box.x.toFixed(2)),
      y: Number(box.y.toFixed(2)),
      width: Number(box.width.toFixed(2)),
      height: Number(box.height.toFixed(2)),
    };

    this.svg.setAttribute(
      "viewBox",
      `${normalized.x} ${normalized.y} ${normalized.width} ${normalized.height}`,
    );

    const canvasConfig = this.getCanvasConfig();
    const baseWidth = toPx(canvasConfig.width, canvasConfig.unit, canvasConfig.dpi);
    const zoom = baseWidth / normalized.width;
    this.store.set(
      {
        zoom: Number(zoom.toFixed(2)),
        canvas: {
          ...canvasConfig,
          viewBox: normalized,
        },
      },
      { silent: options.silentState },
    );

    this.eventBus.emit("canvas:viewbox:changed", { viewBox: normalized });
  }

  zoomBy(multiplier, centerClient = null) {
    const box = this.getViewBoxObject();
    const center = centerClient
      ? this.clientToSvg(centerClient.x, centerClient.y)
      : { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const newWidth = Math.max(30, Math.min(12000, box.width / multiplier));
    const newHeight = Math.max(20, Math.min(8000, box.height / multiplier));
    const ratioX = (center.x - box.x) / box.width;
    const ratioY = (center.y - box.y) / box.height;

    const next = {
      x: center.x - newWidth * ratioX,
      y: center.y - newHeight * ratioY,
      width: newWidth,
      height: newHeight,
    };

    this.setViewBox(next);
    this.selection.refreshOutline();
    this.emitSceneChanged("canvas");
  }

  fitToCanvas() {
    const canvasConfig = this.getCanvasConfig();
    const width = toPx(canvasConfig.width, canvasConfig.unit, canvasConfig.dpi);
    const height = toPx(canvasConfig.height, canvasConfig.unit, canvasConfig.dpi);
    this.setViewBox({ x: 0, y: 0, width, height });
    this.selection.refreshOutline();
    this.emitSceneChanged("canvas");
  }

  getDefsSummary() {
    return Array.from(this.defs.children).map((node) => ({
      id: node.id,
      tag: node.tagName,
    }));
  }

  getLayerModel() {
    return Array.from(this.scene.children).map((node, index) => ({
      id: node.id,
      tag: node.tagName,
      name: node.getAttribute("data-name") || node.id,
      hidden: node.getAttribute("data-hidden") === "true",
      locked: node.getAttribute("data-locked") === "true",
      index,
    }));
  }

  serializeDocument(options = { pretty: false, minified: false, inlineStyle: false }) {
    const clone = this.svg.cloneNode(true);
    clone.querySelectorAll(".is-selected").forEach((node) => {
      node.classList.remove("is-selected");
    });

    if (options.inlineStyle) {
      clone.querySelectorAll("*").forEach((node) => {
        if (!(node instanceof SVGElement)) {
          return;
        }
        const styleParts = [];
        ["fill", "stroke", "stroke-width", "opacity", "font-size", "font-family"].forEach((name) => {
          const value = node.getAttribute(name);
          if (value !== null) {
            styleParts.push(`${name}:${value}`);
            node.removeAttribute(name);
          }
        });
        if (styleParts.length) {
          node.setAttribute("style", styleParts.join(";"));
        }
      });
    }

    const serializer = new XMLSerializer();
    let xml = serializer.serializeToString(clone);

    if (options.minified) {
      xml = minifyXml(xml);
    }

    if (options.pretty) {
      xml = formatXml(xml);
    }

    return xml;
  }

  loadFromCode(code, { recordHistory = true, source = "code" } = {}) {
    const result = parseSvgString(code);
    if (result.error) {
      this.eventBus.emit("code:error", result.error);
      return false;
    }

    const before = this.snapshot();
    this.importSvgRoot(result.root);
    if (recordHistory) {
      this.pushSnapshotHistory("Edit code", before);
    }
    this.emitSceneChanged(source);
    return true;
  }

  emitSceneChanged(source = "canvas") {
    const markup = this.serializeDocument({
      pretty: true,
      inlineStyle: this.store.getState().inlineStyle,
    });

    this.store.saveDocument(markup, this.svg.getAttribute("viewBox"));
    this.eventBus.emit("scene:changed", {
      source,
      markup,
      selectedId: this.selection.getSelectedId(),
      layers: this.getLayerModel(),
      defs: this.getDefsSummary(),
      selectionGeometry: this.selection.getSelectedElement() ? getGeometry(this.selection.getSelectedElement()) : null,
    });

    this.eventBus.emit("layers:refresh", this.getLayerModel());
    this.eventBus.emit("defs:changed", this.getDefsSummary());
    this.selection.refreshOutline();
  }
}
