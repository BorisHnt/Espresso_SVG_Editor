import { getDefaultCanvasConfig } from "../core/state.js";
import { ACTION_ICON_MAP, decorateButton } from "./icons.js";

const SVG_NS = "http://www.w3.org/2000/svg";

const BUILTIN_PRESETS = [
  { id: "icon64", label: "Icon 64x64", width: 64, height: 64, unit: "px", dpi: 96 },
  { id: "logo1024", label: "Logo 1024x1024", width: 1024, height: 1024, unit: "px", dpi: 96 },
  { id: "a4", label: "A4 (210x297 mm)", width: 210, height: 297, unit: "mm", dpi: 300 },
  { id: "square", label: "Square 2048x2048", width: 2048, height: 2048, unit: "px", dpi: 96 },
  { id: "custom", label: "Custom" },
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function round(value, digits = 2) {
  return Number(value.toFixed(digits));
}

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

function safeNumber(value, fallback = 0) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sanitizeBox(box, fallback) {
  return {
    top: Math.max(0, safeNumber(box?.top, fallback.top)),
    right: Math.max(0, safeNumber(box?.right, fallback.right)),
    bottom: Math.max(0, safeNumber(box?.bottom, fallback.bottom)),
    left: Math.max(0, safeNumber(box?.left, fallback.left)),
  };
}

function sanitizeConfig(input) {
  const defaults = getDefaultCanvasConfig();
  const config = input || {};

  const unit = ["px", "mm", "cm", "in"].includes(config.unit) ? config.unit : defaults.unit;
  const dpi = clamp(Math.round(safeNumber(config.dpi, defaults.dpi)), 36, 2400);
  const width = Math.max(1, safeNumber(config.width, defaults.width));
  const height = Math.max(1, safeNumber(config.height, defaults.height));

  const defaultViewW = toPx(width, unit, dpi);
  const defaultViewH = toPx(height, unit, dpi);

  return {
    width,
    height,
    unit,
    dpi,
    viewBox: {
      x: safeNumber(config.viewBox?.x, defaults.viewBox.x),
      y: safeNumber(config.viewBox?.y, defaults.viewBox.y),
      width: Math.max(1, safeNumber(config.viewBox?.width, defaultViewW)),
      height: Math.max(1, safeNumber(config.viewBox?.height, defaultViewH)),
    },
    grid: {
      enabled: Boolean(config.grid?.enabled ?? defaults.grid.enabled),
      spacing: Math.max(1, safeNumber(config.grid?.spacing, defaults.grid.spacing)),
      subdivisions: clamp(Math.round(safeNumber(config.grid?.subdivisions, defaults.grid.subdivisions)), 1, 20),
      snap: Boolean(config.grid?.snap ?? defaults.grid.snap),
    },
    rulers: Boolean(config.rulers ?? defaults.rulers),
    guidesVisible: Boolean(config.guidesVisible ?? defaults.guidesVisible),
    zonesVisible: Boolean(config.zonesVisible ?? defaults.zonesVisible),
    guides: Array.isArray(config.guides)
      ? config.guides
          .map((guide, index) => ({
            id: guide.id || `guide-${Date.now()}-${index}`,
            orientation: guide.orientation === "horizontal" ? "horizontal" : "vertical",
            position: safeNumber(guide.position, 0),
          }))
          .filter((guide) => Number.isFinite(guide.position))
      : [],
    margins: sanitizeBox(config.margins, defaults.margins),
    bleed: sanitizeBox(config.bleed, defaults.bleed),
    safe: sanitizeBox(config.safe, defaults.safe),
  };
}

export class CanvasSettingsPanel {
  constructor({ panel, eventBus, store, viewport, svg, overlay, rulerTop, rulerLeft }) {
    this.panel = panel;
    this.eventBus = eventBus;
    this.store = store;
    this.viewport = viewport;
    this.svg = svg;
    this.overlay = overlay;
    this.rulerTop = rulerTop;
    this.rulerLeft = rulerLeft;

    this.gridLayer = document.getElementById("gridLayer");
    this.zonesLayer = document.getElementById("zonesLayer");
    this.guidesLayer = document.getElementById("guidesLayer");
    this.resizeLayer = document.getElementById("resizeLayer");

    this.controls = {
      settingsOpenBtn: document.getElementById("canvasSettingsBtn"),
      settingsCloseBtn: document.getElementById("canvasSettingsCloseBtn"),
      presetSelect: document.getElementById("canvasPresetSelect"),
      presetApplyBtn: document.getElementById("canvasPresetApplyBtn"),
      presetName: document.getElementById("canvasPresetName"),
      presetSaveBtn: document.getElementById("canvasPresetSaveBtn"),
      presetDeleteBtn: document.getElementById("canvasPresetDeleteBtn"),

      width: document.getElementById("canvasWidthInput"),
      height: document.getElementById("canvasHeightInput"),
      unit: document.getElementById("canvasUnitSelect"),
      dpi: document.getElementById("canvasDpiInput"),

      vbX: document.getElementById("viewBoxXInput"),
      vbY: document.getElementById("viewBoxYInput"),
      vbW: document.getElementById("viewBoxWInput"),
      vbH: document.getElementById("viewBoxHInput"),

      panelGridToggle: document.getElementById("panelGridToggle"),
      panelSnapToggle: document.getElementById("panelSnapToggle"),
      panelRulerToggle: document.getElementById("panelRulerToggle"),
      panelGuidesVisibleToggle: document.getElementById("panelGuidesVisibleToggle"),
      panelZonesToggle: document.getElementById("panelZonesToggle"),
      panelGridSpacing: document.getElementById("panelGridSpacingInput"),
      panelGridSubdiv: document.getElementById("panelGridSubdivInput"),

      addHGuideBtn: document.getElementById("addHGuideBtn"),
      addVGuideBtn: document.getElementById("addVGuideBtn"),
      clearGuidesBtn: document.getElementById("clearGuidesBtn"),
      guidesList: document.getElementById("guidesList"),

      marginTop: document.getElementById("marginTopInput"),
      marginRight: document.getElementById("marginRightInput"),
      marginBottom: document.getElementById("marginBottomInput"),
      marginLeft: document.getElementById("marginLeftInput"),

      bleedTop: document.getElementById("bleedTopInput"),
      bleedRight: document.getElementById("bleedRightInput"),
      bleedBottom: document.getElementById("bleedBottomInput"),
      bleedLeft: document.getElementById("bleedLeftInput"),

      safeTop: document.getElementById("safeTopInput"),
      safeRight: document.getElementById("safeRightInput"),
      safeBottom: document.getElementById("safeBottomInput"),
      safeLeft: document.getElementById("safeLeftInput"),

      quickGridBtn: document.getElementById("gridToggleBtn"),
      quickSnapBtn: document.getElementById("snapToggleBtn"),
      quickRulerBtn: document.getElementById("rulerToggleBtn"),
      quickGuidesBtn: document.getElementById("guidesToggleBtn"),
      checkerBtn: document.getElementById("checkerToggleBtn"),
    };

    this.guideDrag = null;
    this.resizeDrag = null;

    this.decorateButtons();
    this.ensureCanvasState();
    this.bind();
    this.renderPresetOptions();
    this.controls.presetSelect.value = "builtin:custom";
    this.renderFromState();
    this.emitApplyConfig("boot", false);
  }

  decorateButtons() {
    decorateButton(this.controls.settingsOpenBtn, ACTION_ICON_MAP.canvasSettings, "Canvas", { iconOnly: true });
    decorateButton(this.controls.settingsCloseBtn, ACTION_ICON_MAP.close, "Close", { iconOnly: true });
    decorateButton(this.controls.presetApplyBtn, ACTION_ICON_MAP.template, "Apply", { iconOnly: true });
    decorateButton(this.controls.presetSaveBtn, ACTION_ICON_MAP.save, "Save", { iconOnly: true });
    decorateButton(this.controls.presetDeleteBtn, ACTION_ICON_MAP.trash, "Delete", { iconOnly: true });

    decorateButton(this.controls.quickGridBtn, ACTION_ICON_MAP.grid, "Grid", { iconOnly: true });
    decorateButton(this.controls.quickSnapBtn, ACTION_ICON_MAP.snap, "Snap", { iconOnly: true });
    decorateButton(this.controls.quickRulerBtn, ACTION_ICON_MAP.ruler, "Rulers", { iconOnly: true });
    decorateButton(this.controls.quickGuidesBtn, ACTION_ICON_MAP.guides, "Guides", { iconOnly: true });
    decorateButton(this.controls.checkerBtn, ACTION_ICON_MAP.checker, "Checker", { iconOnly: true });

    decorateButton(this.controls.addHGuideBtn, ACTION_ICON_MAP.plus, "H Guide");
    decorateButton(this.controls.addVGuideBtn, ACTION_ICON_MAP.plus, "V Guide");
    decorateButton(this.controls.clearGuidesBtn, ACTION_ICON_MAP.trash, "Clear");
  }

  bind() {
    this.controls.settingsOpenBtn.addEventListener("click", () => this.openPanel());
    this.controls.settingsCloseBtn.addEventListener("click", () => this.closePanel());

    this.controls.quickGridBtn.addEventListener("click", () => {
      this.updateConfig({ grid: { enabled: !this.getConfig().grid.enabled } }, "quick-grid", false);
    });
    this.controls.quickSnapBtn.addEventListener("click", () => {
      this.updateConfig({ grid: { snap: !this.getConfig().grid.snap } }, "quick-snap", false);
    });
    this.controls.quickRulerBtn.addEventListener("click", () => {
      this.updateConfig({ rulers: !this.getConfig().rulers }, "quick-rulers", false);
    });
    this.controls.quickGuidesBtn.addEventListener("click", () => {
      this.updateConfig({ guidesVisible: !this.getConfig().guidesVisible }, "quick-guides", false);
    });
    this.controls.checkerBtn.addEventListener("click", () => {
      const next = !this.store.getState().showChecker;
      this.store.set({ showChecker: next });
      this.renderQuickToggles();
      this.eventBus.emit("canvas:checker-toggle", { enabled: next });
    });

    this.bindNumberField(this.controls.width, (value) => {
      const config = this.getConfig();
      const nextWidth = Math.max(1, value);
      const widthPx = toPx(nextWidth, config.unit, config.dpi);
      this.updateConfig(
        {
          width: nextWidth,
          viewBox: {
            ...config.viewBox,
            width: widthPx,
          },
        },
        "width",
      );
    });

    this.bindNumberField(this.controls.height, (value) => {
      const config = this.getConfig();
      const nextHeight = Math.max(1, value);
      const heightPx = toPx(nextHeight, config.unit, config.dpi);
      this.updateConfig(
        {
          height: nextHeight,
          viewBox: {
            ...config.viewBox,
            height: heightPx,
          },
        },
        "height",
      );
    });

    this.controls.unit.addEventListener("change", () => {
      const config = this.getConfig();
      const unit = this.controls.unit.value;
      const widthPx = toPx(config.width, config.unit, config.dpi);
      const heightPx = toPx(config.height, config.unit, config.dpi);
      const nextWidth = fromPx(widthPx, unit, config.dpi);
      const nextHeight = fromPx(heightPx, unit, config.dpi);

      this.updateConfig(
        {
          unit,
          width: round(nextWidth, unit === "px" ? 0 : 3),
          height: round(nextHeight, unit === "px" ? 0 : 3),
        },
        "unit",
      );
    });

    this.bindNumberField(this.controls.dpi, (value) => {
      const config = this.getConfig();
      const nextDpi = clamp(Math.round(value), 36, 2400);
      const widthPx = toPx(config.width, config.unit, nextDpi);
      const heightPx = toPx(config.height, config.unit, nextDpi);
      this.updateConfig(
        {
          dpi: nextDpi,
          viewBox: {
            ...config.viewBox,
            width: widthPx,
            height: heightPx,
          },
        },
        "dpi",
      );
    });

    this.bindNumberField(this.controls.vbX, (value) => this.updateViewBox({ x: value }));
    this.bindNumberField(this.controls.vbY, (value) => this.updateViewBox({ y: value }));
    this.bindNumberField(this.controls.vbW, (value) => this.updateViewBox({ width: Math.max(1, value) }));
    this.bindNumberField(this.controls.vbH, (value) => this.updateViewBox({ height: Math.max(1, value) }));

    this.controls.panelGridToggle.addEventListener("change", () => {
      this.updateConfig({ grid: { enabled: this.controls.panelGridToggle.checked } }, "panel-grid", false);
    });
    this.controls.panelSnapToggle.addEventListener("change", () => {
      this.updateConfig({ grid: { snap: this.controls.panelSnapToggle.checked } }, "panel-snap", false);
    });
    this.controls.panelRulerToggle.addEventListener("change", () => {
      this.updateConfig({ rulers: this.controls.panelRulerToggle.checked }, "panel-rulers", false);
    });
    this.controls.panelGuidesVisibleToggle.addEventListener("change", () => {
      this.updateConfig({ guidesVisible: this.controls.panelGuidesVisibleToggle.checked }, "panel-guides", false);
    });
    this.controls.panelZonesToggle.addEventListener("change", () => {
      this.updateConfig({ zonesVisible: this.controls.panelZonesToggle.checked }, "panel-zones", false);
    });

    this.bindNumberField(this.controls.panelGridSpacing, (value) => {
      this.updateConfig({ grid: { spacing: Math.max(1, value) } }, "grid-spacing", false);
    });
    this.bindNumberField(this.controls.panelGridSubdiv, (value) => {
      this.updateConfig({ grid: { subdivisions: clamp(Math.round(value), 1, 20) } }, "grid-subdiv", false);
    });

    this.controls.addHGuideBtn.addEventListener("click", () => this.addGuide("horizontal"));
    this.controls.addVGuideBtn.addEventListener("click", () => this.addGuide("vertical"));
    this.controls.clearGuidesBtn.addEventListener("click", () => {
      this.updateConfig({ guides: [] }, "guides-clear");
    });

    this.bindNumberField(this.controls.marginTop, (value) => this.updateConfig({ margins: { top: Math.max(0, value) } }, "margin"));
    this.bindNumberField(this.controls.marginRight, (value) => this.updateConfig({ margins: { right: Math.max(0, value) } }, "margin"));
    this.bindNumberField(this.controls.marginBottom, (value) => this.updateConfig({ margins: { bottom: Math.max(0, value) } }, "margin"));
    this.bindNumberField(this.controls.marginLeft, (value) => this.updateConfig({ margins: { left: Math.max(0, value) } }, "margin"));

    this.bindNumberField(this.controls.bleedTop, (value) => this.updateConfig({ bleed: { top: Math.max(0, value) } }, "bleed"));
    this.bindNumberField(this.controls.bleedRight, (value) => this.updateConfig({ bleed: { right: Math.max(0, value) } }, "bleed"));
    this.bindNumberField(this.controls.bleedBottom, (value) => this.updateConfig({ bleed: { bottom: Math.max(0, value) } }, "bleed"));
    this.bindNumberField(this.controls.bleedLeft, (value) => this.updateConfig({ bleed: { left: Math.max(0, value) } }, "bleed"));

    this.bindNumberField(this.controls.safeTop, (value) => this.updateConfig({ safe: { top: Math.max(0, value) } }, "safe"));
    this.bindNumberField(this.controls.safeRight, (value) => this.updateConfig({ safe: { right: Math.max(0, value) } }, "safe"));
    this.bindNumberField(this.controls.safeBottom, (value) => this.updateConfig({ safe: { bottom: Math.max(0, value) } }, "safe"));
    this.bindNumberField(this.controls.safeLeft, (value) => this.updateConfig({ safe: { left: Math.max(0, value) } }, "safe"));

    this.controls.presetApplyBtn.addEventListener("click", () => this.applySelectedPreset());
    this.controls.presetSelect.addEventListener("change", () => {
      if (this.controls.presetSelect.value.startsWith("builtin:")) {
        return;
      }
      this.controls.presetName.value = "";
    });

    this.controls.presetSaveBtn.addEventListener("click", () => this.savePreset());
    this.controls.presetDeleteBtn.addEventListener("click", () => this.deleteSelectedPreset());

    this.eventBus.on("canvas:viewbox:changed", ({ viewBox }) => {
      const config = this.getConfig();
      const next = sanitizeConfig({ ...config, viewBox });
      this.store.set({ canvas: next }, { silent: true });
      this.renderFromState();
    });

    this.eventBus.on("scene:changed", () => {
      this.renderOverlay();
    });

    window.addEventListener("resize", () => this.renderOverlay());

    this.eventBus.on("canvas:quick-logo", () => {
      this.applyQuickLogoMode(64);
    });
  }

  bindNumberField(element, callback) {
    element.addEventListener("change", () => {
      const value = Number.parseFloat(element.value);
      if (!Number.isFinite(value)) {
        return;
      }
      callback(value);
    });
  }

  ensureCanvasState() {
    const state = this.store.getState();
    const config = sanitizeConfig(state.canvas);
    this.store.set(
      {
        canvas: config,
        showGrid: config.grid.enabled,
        snapEnabled: config.grid.snap,
      },
      { silent: true },
    );
  }

  getConfig() {
    return sanitizeConfig(this.store.getState().canvas);
  }

  updateConfig(partial, source = "panel", recordHistory = true, notify = true, renderUi = true) {
    const current = this.getConfig();
    const next = clone(current);

    if (partial.width !== undefined) {
      next.width = Math.max(1, safeNumber(partial.width, current.width));
    }
    if (partial.height !== undefined) {
      next.height = Math.max(1, safeNumber(partial.height, current.height));
    }
    if (partial.unit !== undefined) {
      next.unit = partial.unit;
    }
    if (partial.dpi !== undefined) {
      next.dpi = Math.max(36, safeNumber(partial.dpi, current.dpi));
    }

    if (partial.viewBox) {
      next.viewBox = {
        ...next.viewBox,
        ...partial.viewBox,
      };
    }

    if (partial.grid) {
      next.grid = {
        ...next.grid,
        ...partial.grid,
      };
    }

    if (partial.rulers !== undefined) {
      next.rulers = Boolean(partial.rulers);
    }
    if (partial.guidesVisible !== undefined) {
      next.guidesVisible = Boolean(partial.guidesVisible);
    }
    if (partial.zonesVisible !== undefined) {
      next.zonesVisible = Boolean(partial.zonesVisible);
    }
    if (partial.guides !== undefined) {
      next.guides = partial.guides;
    }

    if (partial.margins) {
      next.margins = {
        ...next.margins,
        ...partial.margins,
      };
    }
    if (partial.bleed) {
      next.bleed = {
        ...next.bleed,
        ...partial.bleed,
      };
    }
    if (partial.safe) {
      next.safe = {
        ...next.safe,
        ...partial.safe,
      };
    }

    const sanitized = sanitizeConfig(next);

    this.store.set(
      {
        canvas: sanitized,
        showGrid: sanitized.grid.enabled,
        snapEnabled: sanitized.grid.snap,
      },
      { silent: !notify },
    );

    if (renderUi) {
      this.renderFromState();
    } else {
      this.renderOverlay();
    }
    this.emitApplyConfig(source, recordHistory);
  }

  updateViewBox(changes) {
    const config = this.getConfig();
    this.updateConfig(
      {
        viewBox: {
          ...config.viewBox,
          ...changes,
        },
      },
      "viewBox",
    );
  }

  emitApplyConfig(source, recordHistory = true) {
    this.eventBus.emit("canvas:apply-config", {
      config: this.getConfig(),
      source,
      recordHistory,
    });
  }

  openPanel() {
    this.panel.classList.remove("hidden");
  }

  closePanel() {
    this.panel.classList.add("hidden");
  }

  renderFromState() {
    const config = this.getConfig();

    this.controls.width.value = round(config.width, config.unit === "px" ? 0 : 3);
    this.controls.height.value = round(config.height, config.unit === "px" ? 0 : 3);
    this.controls.unit.value = config.unit;
    this.controls.dpi.value = Math.round(config.dpi);

    this.controls.vbX.value = round(config.viewBox.x, 2);
    this.controls.vbY.value = round(config.viewBox.y, 2);
    this.controls.vbW.value = round(config.viewBox.width, 2);
    this.controls.vbH.value = round(config.viewBox.height, 2);

    this.controls.panelGridToggle.checked = config.grid.enabled;
    this.controls.panelSnapToggle.checked = config.grid.snap;
    this.controls.panelRulerToggle.checked = config.rulers;
    this.controls.panelGuidesVisibleToggle.checked = config.guidesVisible;
    this.controls.panelZonesToggle.checked = config.zonesVisible;
    this.controls.panelGridSpacing.value = round(config.grid.spacing, 2);
    this.controls.panelGridSubdiv.value = config.grid.subdivisions;

    this.controls.marginTop.value = config.margins.top;
    this.controls.marginRight.value = config.margins.right;
    this.controls.marginBottom.value = config.margins.bottom;
    this.controls.marginLeft.value = config.margins.left;

    this.controls.bleedTop.value = config.bleed.top;
    this.controls.bleedRight.value = config.bleed.right;
    this.controls.bleedBottom.value = config.bleed.bottom;
    this.controls.bleedLeft.value = config.bleed.left;

    this.controls.safeTop.value = config.safe.top;
    this.controls.safeRight.value = config.safe.right;
    this.controls.safeBottom.value = config.safe.bottom;
    this.controls.safeLeft.value = config.safe.left;

    this.renderQuickToggles();
    this.renderGuideList();
    this.renderOverlay();
  }

  renderQuickToggles() {
    const config = this.getConfig();
    this.controls.quickGridBtn.classList.toggle("is-active", config.grid.enabled);
    this.controls.quickSnapBtn.classList.toggle("is-active", config.grid.snap);
    this.controls.quickRulerBtn.classList.toggle("is-active", config.rulers);
    this.controls.quickGuidesBtn.classList.toggle("is-active", config.guidesVisible);
    this.controls.checkerBtn.classList.toggle("is-active", this.store.getState().showChecker);
  }

  renderPresetOptions() {
    const userPresets = this.store.getState().canvasUserPresets || [];

    this.controls.presetSelect.innerHTML = "";
    BUILTIN_PRESETS.forEach((preset) => {
      const option = document.createElement("option");
      option.value = `builtin:${preset.id}`;
      option.textContent = preset.label;
      this.controls.presetSelect.append(option);
    });

    userPresets.forEach((preset) => {
      const option = document.createElement("option");
      option.value = `user:${preset.id}`;
      option.textContent = `User: ${preset.name}`;
      this.controls.presetSelect.append(option);
    });
  }

  applySelectedPreset() {
    const selected = this.controls.presetSelect.value;
    if (!selected) {
      return;
    }

    if (selected.startsWith("builtin:")) {
      const presetId = selected.replace("builtin:", "");
      const preset = BUILTIN_PRESETS.find((entry) => entry.id === presetId);
      if (!preset || preset.id === "custom") {
        return;
      }
      const widthPx = toPx(preset.width, preset.unit, preset.dpi);
      const heightPx = toPx(preset.height, preset.unit, preset.dpi);

      this.updateConfig(
        {
          width: preset.width,
          height: preset.height,
          unit: preset.unit,
          dpi: preset.dpi,
          viewBox: {
            x: 0,
            y: 0,
            width: widthPx,
            height: heightPx,
          },
        },
        `preset-${preset.id}`,
      );
      return;
    }

    const presetId = selected.replace("user:", "");
    const userPresets = this.store.getState().canvasUserPresets || [];
    const preset = userPresets.find((entry) => entry.id === presetId);
    if (!preset) {
      return;
    }
    this.updateConfig(preset.config, `preset-${preset.id}`);
  }

  applyQuickLogoMode(size = 64) {
    const iconSize = Math.max(8, Math.round(size));
    this.updateConfig(
      {
        width: iconSize,
        height: iconSize,
        unit: "px",
        dpi: 96,
        viewBox: {
          x: 0,
          y: 0,
          width: iconSize,
          height: iconSize,
        },
        grid: {
          enabled: true,
          snap: true,
          spacing: 1,
          subdivisions: 1,
        },
        rulers: false,
        guidesVisible: false,
        zonesVisible: false,
      },
      "quick-logo",
      true,
    );
    this.eventBus.emit("view:zoom-fit");
  }

  savePreset() {
    const name = this.controls.presetName.value.trim();
    if (!name) {
      return;
    }

    const userPresets = this.store.getState().canvasUserPresets || [];
    const id = `preset-${Date.now()}`;
    const nextPresets = [
      ...userPresets,
      {
        id,
        name,
        config: this.getConfig(),
      },
    ];

    this.store.set({ canvasUserPresets: nextPresets });
    this.renderPresetOptions();
    this.controls.presetSelect.value = `user:${id}`;
    this.controls.presetName.value = "";
  }

  deleteSelectedPreset() {
    const selected = this.controls.presetSelect.value;
    if (!selected.startsWith("user:")) {
      return;
    }
    const presetId = selected.replace("user:", "");
    const userPresets = this.store.getState().canvasUserPresets || [];
    this.store.set({ canvasUserPresets: userPresets.filter((entry) => entry.id !== presetId) });
    this.renderPresetOptions();
    this.controls.presetSelect.value = "builtin:custom";
  }

  addGuide(orientation) {
    const config = this.getConfig();
    const position = orientation === "horizontal"
      ? config.viewBox.y + config.viewBox.height / 2
      : config.viewBox.x + config.viewBox.width / 2;

    const nextGuides = [
      ...config.guides,
      {
        id: `guide-${Date.now()}-${Math.round(Math.random() * 10000)}`,
        orientation,
        position: round(position, 2),
      },
    ];

    this.updateConfig({ guides: nextGuides }, "guide-add", false);
  }

  removeGuide(guideId) {
    const config = this.getConfig();
    this.updateConfig(
      {
        guides: config.guides.filter((guide) => guide.id !== guideId),
      },
      "guide-remove",
      false,
    );
  }

  setGuidePosition(guideId, value) {
    const config = this.getConfig();
    const nextGuides = config.guides.map((guide) => {
      if (guide.id !== guideId) {
        return guide;
      }
      return {
        ...guide,
        position: round(value, 2),
      };
    });
    this.updateConfig({ guides: nextGuides }, "guide-move", false, false, false);
  }

  renderGuideList() {
    const config = this.getConfig();
    const { guidesList } = this.controls;
    guidesList.innerHTML = "";

    if (!config.guides.length) {
      const empty = document.createElement("div");
      empty.className = "field-group";
      empty.innerHTML = '<label>No guides</label><input type="text" value="Add H/V guides" disabled />';
      guidesList.append(empty);
      return;
    }

    config.guides.forEach((guide) => {
      const row = document.createElement("div");
      row.className = "guide-row";

      const axis = document.createElement("span");
      axis.textContent = guide.orientation === "horizontal" ? "H" : "V";

      const label = document.createElement("span");
      label.textContent = guide.id.slice(0, 8);

      const input = document.createElement("input");
      input.className = "guide-pos";
      input.type = "number";
      input.step = "1";
      input.value = String(round(guide.position, 2));
      input.addEventListener("change", () => {
        const value = Number.parseFloat(input.value);
        if (!Number.isFinite(value)) {
          return;
        }
        this.setGuidePosition(guide.id, value);
      });

      const del = document.createElement("button");
      del.className = "icon-btn icon-only";
      decorateButton(del, ACTION_ICON_MAP.trash, "Delete", { iconOnly: true });
      del.addEventListener("click", () => this.removeGuide(guide.id));

      row.append(axis, label, input, del);
      guidesList.append(row);
    });
  }

  renderOverlay() {
    const config = this.getConfig();
    const vb = config.viewBox;

    this.overlay.setAttribute("viewBox", `${vb.x} ${vb.y} ${vb.width} ${vb.height}`);

    this.renderGrid(config);
    this.renderZones(config);
    this.renderGuides(config);
    this.renderResizeHandles(config);
    this.renderRulers(config);
  }

  renderGrid(config) {
    this.gridLayer.innerHTML = "";
    if (!config.grid.enabled) {
      return;
    }

    const vb = config.viewBox;
    const spacing = Math.max(1, config.grid.spacing);
    const subdivisions = Math.max(1, config.grid.subdivisions);

    const viewportWidth = Math.max(this.viewport.clientWidth, 1);
    const viewportHeight = Math.max(this.viewport.clientHeight, 1);
    const pxPerUnitX = viewportWidth / Math.max(vb.width, 1);
    const pxPerUnitY = viewportHeight / Math.max(vb.height, 1);
    const pxPerUnit = Math.max(0.0001, Math.min(pxPerUnitX, pxPerUnitY));

    const majorMinPx = 24;
    const minorMinPx = 10;

    let displayMajorStep = spacing;
    while (displayMajorStep * pxPerUnit < majorMinPx) {
      displayMajorStep *= 2;
      if (displayMajorStep > 1e7) {
        break;
      }
    }

    const displayMinorStep = displayMajorStep / subdivisions;
    const drawMinor = displayMinorStep * pxPerUnit >= minorMinPx;
    const step = drawMinor ? displayMinorStep : displayMajorStep;
    const epsilon = step * 0.001;

    const xStart = Math.floor((vb.x - epsilon) / step) * step;
    const xEnd = vb.x + vb.width;
    const yStart = Math.floor((vb.y - epsilon) / step) * step;
    const yEnd = vb.y + vb.height;

    const isMajorLine = (value) => {
      const ratio = value / displayMajorStep;
      return Math.abs(ratio - Math.round(ratio)) < 0.001;
    };

    let lineCount = 0;
    for (let x = xStart; x <= xEnd + epsilon; x += step) {
      const rounded = round(x, 4);
      const isMajor = isMajorLine(rounded);
      const className = drawMinor
        ? (isMajor ? "grid-major" : "grid-minor")
        : "grid-major";
      this.gridLayer.append(this.createSvgLine(rounded, yStart, rounded, yEnd, className));
      lineCount += 1;
      if (lineCount > 2600) {
        break;
      }
    }

    lineCount = 0;
    for (let y = yStart; y <= yEnd + epsilon; y += step) {
      const rounded = round(y, 4);
      const isMajor = isMajorLine(rounded);
      const className = drawMinor
        ? (isMajor ? "grid-major" : "grid-minor")
        : "grid-major";
      this.gridLayer.append(this.createSvgLine(vb.x, rounded, xEnd, rounded, className));
      lineCount += 1;
      if (lineCount > 2600) {
        break;
      }
    }
  }

  renderZones(config) {
    this.zonesLayer.innerHTML = "";

    const widthPx = toPx(config.width, config.unit, config.dpi);
    const heightPx = toPx(config.height, config.unit, config.dpi);

    const appendRect = (className, x, y, width, height) => {
      if (width <= 0 || height <= 0) {
        return;
      }
      const rect = document.createElementNS(SVG_NS, "rect");
      rect.setAttribute("class", className);
      rect.setAttribute("x", round(x, 3));
      rect.setAttribute("y", round(y, 3));
      rect.setAttribute("width", round(width, 3));
      rect.setAttribute("height", round(height, 3));
      this.zonesLayer.append(rect);
    };

    appendRect("artboard-outline", 0, 0, widthPx, heightPx);

    if (!config.zonesVisible) {
      return;
    }

    appendRect(
      "zone-bleed",
      -config.bleed.left,
      -config.bleed.top,
      widthPx + config.bleed.left + config.bleed.right,
      heightPx + config.bleed.top + config.bleed.bottom,
    );
    appendRect(
      "zone-margin",
      config.margins.left,
      config.margins.top,
      widthPx - config.margins.left - config.margins.right,
      heightPx - config.margins.top - config.margins.bottom,
    );
    appendRect(
      "zone-safe",
      config.safe.left,
      config.safe.top,
      widthPx - config.safe.left - config.safe.right,
      heightPx - config.safe.top - config.safe.bottom,
    );
  }

  renderGuides(config) {
    this.guidesLayer.innerHTML = "";

    if (!config.guidesVisible) {
      return;
    }

    const vb = config.viewBox;
    const yStart = vb.y;
    const yEnd = vb.y + vb.height;
    const xStart = vb.x;
    const xEnd = vb.x + vb.width;

    config.guides.forEach((guide) => {
      const line = document.createElementNS(SVG_NS, "line");
      if (guide.orientation === "horizontal") {
        line.setAttribute("x1", xStart);
        line.setAttribute("y1", guide.position);
        line.setAttribute("x2", xEnd);
        line.setAttribute("y2", guide.position);
      } else {
        line.setAttribute("x1", guide.position);
        line.setAttribute("y1", yStart);
        line.setAttribute("x2", guide.position);
        line.setAttribute("y2", yEnd);
      }
      line.setAttribute("class", `guide-line ${guide.orientation}`);
      line.dataset.id = guide.id;
      line.dataset.orientation = guide.orientation;

      line.addEventListener("pointerdown", (event) => this.startGuideDrag(event, guide.id, guide.orientation));
      line.addEventListener("dblclick", () => this.removeGuide(guide.id));
      this.guidesLayer.append(line);
    });
  }

  renderResizeHandles(config) {
    this.resizeLayer.innerHTML = "";

    const widthPx = toPx(config.width, config.unit, config.dpi);
    const heightPx = toPx(config.height, config.unit, config.dpi);
    const viewBox = config.viewBox;

    const ratio = viewBox.width / Math.max(this.viewport.clientWidth, 1);
    const size = Math.max(11 * ratio, 4.2);

    const frame = document.createElementNS(SVG_NS, "rect");
    frame.setAttribute("x", 0);
    frame.setAttribute("y", 0);
    frame.setAttribute("width", round(widthPx, 3));
    frame.setAttribute("height", round(heightPx, 3));
    frame.setAttribute("class", "frame-outline");
    this.resizeLayer.append(frame);

    const edgeHit = Math.max(size * 1.1, 8);

    const edgeE = document.createElementNS(SVG_NS, "rect");
    edgeE.setAttribute("x", round(widthPx - edgeHit / 2, 3));
    edgeE.setAttribute("y", round(0, 3));
    edgeE.setAttribute("width", round(edgeHit, 3));
    edgeE.setAttribute("height", round(heightPx, 3));
    edgeE.setAttribute("class", "resize-edge edge-e");
    edgeE.dataset.mode = "e";
    edgeE.addEventListener("pointerdown", (event) => this.startResizeDrag(event, "e"));
    this.resizeLayer.append(edgeE);

    const edgeS = document.createElementNS(SVG_NS, "rect");
    edgeS.setAttribute("x", round(0, 3));
    edgeS.setAttribute("y", round(heightPx - edgeHit / 2, 3));
    edgeS.setAttribute("width", round(widthPx, 3));
    edgeS.setAttribute("height", round(edgeHit, 3));
    edgeS.setAttribute("class", "resize-edge edge-s");
    edgeS.dataset.mode = "s";
    edgeS.addEventListener("pointerdown", (event) => this.startResizeDrag(event, "s"));
    this.resizeLayer.append(edgeS);

    const handles = [
      { mode: "e", x: widthPx, y: heightPx / 2 },
      { mode: "s", x: widthPx / 2, y: heightPx },
      { mode: "se", x: widthPx, y: heightPx },
    ];

    handles.forEach((entry) => {
      const rect = document.createElementNS(SVG_NS, "rect");
      rect.setAttribute("x", round(entry.x - size / 2, 3));
      rect.setAttribute("y", round(entry.y - size / 2, 3));
      rect.setAttribute("width", round(size, 3));
      rect.setAttribute("height", round(size, 3));
      rect.setAttribute("class", `resize-handle handle-${entry.mode}`);
      rect.dataset.mode = entry.mode;
      rect.addEventListener("pointerdown", (event) => this.startResizeDrag(event, entry.mode));
      this.resizeLayer.append(rect);
    });
  }

  renderRulers(config) {
    const enabled = config.rulers;
    this.viewport.classList.toggle("show-rulers", enabled);
    this.rulerTop.classList.toggle("hidden", !enabled);
    this.rulerLeft.classList.toggle("hidden", !enabled);

    if (!enabled) {
      return;
    }

    const rulerSize = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--ruler-size"), 10) || 22;
    const topWidth = Math.max(1, this.viewport.clientWidth - rulerSize);
    const topHeight = rulerSize;
    const leftWidth = rulerSize;
    const leftHeight = Math.max(1, this.viewport.clientHeight - rulerSize);

    this.rulerTop.width = topWidth;
    this.rulerTop.height = topHeight;
    this.rulerLeft.width = leftWidth;
    this.rulerLeft.height = leftHeight;

    const styles = getComputedStyle(document.body);
    const tickColor = styles.getPropertyValue("--text-muted").trim() || "#8b8a86";
    const labelColor = styles.getPropertyValue("--text-soft").trim() || "#57595b";

    this.drawTopRuler(config.viewBox, topWidth, topHeight, tickColor, labelColor);
    this.drawLeftRuler(config.viewBox, leftWidth, leftHeight, tickColor, labelColor);
  }

  drawTopRuler(viewBox, width, height, tickColor, labelColor) {
    const ctx = this.rulerTop.getContext("2d");
    ctx.clearRect(0, 0, width, height);

    const unitsPerPx = viewBox.width / width;
    let step = Math.max(1, this.getConfig().grid.spacing);
    const minPx = 48;
    if (step / unitsPerPx < minPx) {
      const factor = Math.ceil(minPx / (step / unitsPerPx));
      step *= factor;
    }

    const start = Math.floor(viewBox.x / step) * step;
    const end = viewBox.x + viewBox.width;

    ctx.strokeStyle = tickColor;
    ctx.fillStyle = labelColor;
    ctx.lineWidth = 1;
    ctx.font = "10px sans-serif";

    for (let value = start; value <= end; value += step) {
      const x = (value - viewBox.x) / unitsPerPx;
      ctx.beginPath();
      ctx.moveTo(x + 0.5, height);
      ctx.lineTo(x + 0.5, 7);
      ctx.stroke();
      ctx.fillText(String(Math.round(value)), x + 2, 10);
    }
  }

  drawLeftRuler(viewBox, width, height, tickColor, labelColor) {
    const ctx = this.rulerLeft.getContext("2d");
    ctx.clearRect(0, 0, width, height);

    const unitsPerPx = viewBox.height / height;
    let step = Math.max(1, this.getConfig().grid.spacing);
    const minPx = 48;
    if (step / unitsPerPx < minPx) {
      const factor = Math.ceil(minPx / (step / unitsPerPx));
      step *= factor;
    }

    const start = Math.floor(viewBox.y / step) * step;
    const end = viewBox.y + viewBox.height;

    ctx.strokeStyle = tickColor;
    ctx.fillStyle = labelColor;
    ctx.lineWidth = 1;
    ctx.font = "10px sans-serif";

    for (let value = start; value <= end; value += step) {
      const y = (value - viewBox.y) / unitsPerPx;
      ctx.beginPath();
      ctx.moveTo(width, y + 0.5);
      ctx.lineTo(7, y + 0.5);
      ctx.stroke();
      ctx.save();
      ctx.translate(2, y + 12);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(String(Math.round(value)), 0, 0);
      ctx.restore();
    }
  }

  createSvgLine(x1, y1, x2, y2, className) {
    const line = document.createElementNS(SVG_NS, "line");
    line.setAttribute("x1", x1);
    line.setAttribute("y1", y1);
    line.setAttribute("x2", x2);
    line.setAttribute("y2", y2);
    line.setAttribute("class", className);
    return line;
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
    return { x: local.x, y: local.y };
  }

  startGuideDrag(event, guideId, orientation) {
    event.preventDefault();
    event.stopPropagation();
    this.guideDrag = { guideId, orientation };
    document.body.style.userSelect = "none";

    const onMove = (moveEvent) => {
      if (!this.guideDrag) {
        return;
      }
      const point = this.clientToSvg(moveEvent.clientX, moveEvent.clientY);
      const value = this.guideDrag.orientation === "horizontal" ? point.y : point.x;
      this.setGuidePosition(this.guideDrag.guideId, value);
    };

    const onUp = () => {
      this.guideDrag = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      document.body.style.userSelect = "";
      this.renderFromState();
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  startResizeDrag(event, mode) {
    event.preventDefault();
    event.stopPropagation();

    const config = this.getConfig();
    const viewportWidth = Math.max(this.viewport.clientWidth, 1);
    const viewportHeight = Math.max(this.viewport.clientHeight, 1);
    const unitsPerClientX = config.viewBox.width / viewportWidth;
    const unitsPerClientY = config.viewBox.height / viewportHeight;

    this.resizeDrag = {
      mode,
      startClient: { x: event.clientX, y: event.clientY },
      unitsPerClientX,
      unitsPerClientY,
      startWidthPx: toPx(config.width, config.unit, config.dpi),
      startHeightPx: toPx(config.height, config.unit, config.dpi),
      aspectRatio: toPx(config.width, config.unit, config.dpi) / Math.max(1, toPx(config.height, config.unit, config.dpi)),
      unit: config.unit,
      dpi: config.dpi,
      viewBox: config.viewBox,
      snap: config.grid.snap,
      snapStep: Math.max(1, config.grid.spacing),
    };
    document.body.style.userSelect = "none";

    const onMove = (moveEvent) => {
      if (!this.resizeDrag) {
        return;
      }
      const dxClient = moveEvent.clientX - this.resizeDrag.startClient.x;
      const dyClient = moveEvent.clientY - this.resizeDrag.startClient.y;
      const dx = dxClient * this.resizeDrag.unitsPerClientX;
      const dy = dyClient * this.resizeDrag.unitsPerClientY;

      let widthPx = this.resizeDrag.startWidthPx;
      let heightPx = this.resizeDrag.startHeightPx;

      if (this.resizeDrag.mode.includes("e")) {
        widthPx = Math.max(8, this.resizeDrag.startWidthPx + dx);
      }
      if (this.resizeDrag.mode.includes("w")) {
        widthPx = Math.max(8, this.resizeDrag.startWidthPx - dx);
      }
      if (this.resizeDrag.mode.includes("s")) {
        heightPx = Math.max(8, this.resizeDrag.startHeightPx + dy);
      }
      if (this.resizeDrag.mode.includes("n")) {
        heightPx = Math.max(8, this.resizeDrag.startHeightPx - dy);
      }

      if (moveEvent.shiftKey) {
        const ratio = this.resizeDrag.aspectRatio || 1;
        const widthBasedHeight = widthPx / ratio;
        const heightBasedWidth = heightPx * ratio;
        const widthDiff = Math.abs(widthPx - this.resizeDrag.startWidthPx);
        const heightDiff = Math.abs(heightPx - this.resizeDrag.startHeightPx);
        if (widthDiff >= heightDiff) {
          heightPx = Math.max(8, widthBasedHeight);
        } else {
          widthPx = Math.max(8, heightBasedWidth);
        }
      }

      if (this.resizeDrag.snap) {
        widthPx = Math.max(8, Math.round(widthPx / this.resizeDrag.snapStep) * this.resizeDrag.snapStep);
        heightPx = Math.max(8, Math.round(heightPx / this.resizeDrag.snapStep) * this.resizeDrag.snapStep);
      }

      const width = fromPx(widthPx, this.resizeDrag.unit, this.resizeDrag.dpi);
      const height = fromPx(heightPx, this.resizeDrag.unit, this.resizeDrag.dpi);

      this.updateConfig(
        {
          width: round(width, this.resizeDrag.unit === "px" ? 0 : 3),
          height: round(height, this.resizeDrag.unit === "px" ? 0 : 3),
          viewBox: {
            ...this.resizeDrag.viewBox,
            width: round(widthPx, 2),
            height: round(heightPx, 2),
          },
        },
        "resize-handle",
        false,
        false,
        false,
      );
    };

    const onUp = () => {
      this.resizeDrag = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      document.body.style.userSelect = "";
      this.renderFromState();
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }
}
