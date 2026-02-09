import { ACTION_ICON_MAP, decorateButton, decorateToolButton } from "./icons.js";

export class ToolsPanel {
  constructor({ root, eventBus, store }) {
    this.root = root;
    this.eventBus = eventBus;
    this.store = store;

    this.toolButtons = Array.from(root.querySelectorAll(".tool-btn"));
    this.themeToggle = document.getElementById("themeToggle");

    this.bind();
    this.decorate();
    this.applyState(store.getState());
  }

  decorate() {
    this.toolButtons.forEach((button) => decorateToolButton(button));

    decorateButton(document.getElementById("undoBtn"), ACTION_ICON_MAP.undo, "Undo", { iconOnly: true });
    decorateButton(document.getElementById("redoBtn"), ACTION_ICON_MAP.redo, "Redo", { iconOnly: true });
    decorateButton(document.getElementById("importBtn"), ACTION_ICON_MAP.import, "Import", { iconOnly: true });
    decorateButton(document.getElementById("exportSvgBtn"), ACTION_ICON_MAP.exportSvg, "SVG", { iconOnly: true });
    decorateButton(document.getElementById("exportPngBtn"), ACTION_ICON_MAP.exportPng, "PNG", { iconOnly: true });
    decorateButton(document.getElementById("exportJpgBtn"), ACTION_ICON_MAP.exportJpg, "JPG", { iconOnly: true });

    decorateButton(document.getElementById("zoomInBtn"), ACTION_ICON_MAP.zoomIn, "Zoom in", { iconOnly: true });
    decorateButton(document.getElementById("zoomOutBtn"), ACTION_ICON_MAP.zoomOut, "Zoom out", { iconOnly: true });
    decorateButton(document.getElementById("zoomFitBtn"), ACTION_ICON_MAP.zoomFit, "Zoom fit", { iconOnly: true });
    decorateButton(document.getElementById("deleteBtn"), ACTION_ICON_MAP.delete, "Delete", { iconOnly: true });

    decorateButton(document.getElementById("prettyBtn"), ACTION_ICON_MAP.pretty, "Pretty", { iconOnly: true });
    decorateButton(document.getElementById("minifyBtn"), ACTION_ICON_MAP.minify, "Minify", { iconOnly: true });
    decorateButton(document.getElementById("inlineStyleBtn"), ACTION_ICON_MAP.inlineStyle, "Inline", { iconOnly: true });
    decorateButton(document.getElementById("defsViewerBtn"), ACTION_ICON_MAP.defs, "Defs", { iconOnly: true });
  }

  bind() {
    this.toolButtons.forEach((button) => {
      button.addEventListener("click", () => {
        this.setTool(button.dataset.tool);
      });
    });

    this.themeToggle.addEventListener("click", () => {
      const nextTheme = this.store.getState().theme === "latte" ? "ristretto" : "latte";
      this.store.set({ theme: nextTheme });
    });

    document.getElementById("zoomInBtn").addEventListener("click", () => this.eventBus.emit("view:zoom-in"));
    document.getElementById("zoomOutBtn").addEventListener("click", () => this.eventBus.emit("view:zoom-out"));
    document.getElementById("zoomFitBtn").addEventListener("click", () => this.eventBus.emit("view:zoom-fit"));
    document.getElementById("deleteBtn").addEventListener("click", () => this.eventBus.emit("selection:delete"));

    document.getElementById("undoBtn").addEventListener("click", () => this.eventBus.emit("history:undo"));
    document.getElementById("redoBtn").addEventListener("click", () => this.eventBus.emit("history:redo"));

    window.addEventListener("keydown", (event) => this.onKeyDown(event));
    this.store.subscribe((state) => this.applyState(state));

    this.eventBus.on("history:changed", ({ canUndo, canRedo }) => {
      document.getElementById("undoBtn").disabled = !canUndo;
      document.getElementById("redoBtn").disabled = !canRedo;
    });

    document.getElementById("undoBtn").disabled = true;
    document.getElementById("redoBtn").disabled = true;
  }

  onKeyDown(event) {
    const targetTag = event.target.tagName.toLowerCase();
    const isTypingContext = ["textarea", "input"].includes(targetTag) || event.target.isContentEditable;

    if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === "z") {
      event.preventDefault();
      this.eventBus.emit("history:undo");
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "z") {
      event.preventDefault();
      this.eventBus.emit("history:redo");
      return;
    }

    if (isTypingContext) {
      return;
    }

    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      this.eventBus.emit("selection:delete");
      return;
    }

    const shortcuts = {
      v: "select",
      r: "rect",
      o: "roundRect",
      c: "circle",
      e: "ellipse",
      l: "line",
      p: "path",
      t: "text",
      i: "image",
    };

    const tool = shortcuts[event.key.toLowerCase()];
    if (tool) {
      this.setTool(tool);
    }

    if (event.key === "+") {
      this.eventBus.emit("view:zoom-in");
    }

    if (event.key === "-") {
      this.eventBus.emit("view:zoom-out");
    }
  }

  setTool(tool) {
    this.store.set({ tool });
    this.eventBus.emit("tool:changed", { tool });
  }

  applyState(state) {
    document.body.dataset.theme = state.theme;
    decorateButton(
      this.themeToggle,
      state.theme === "latte" ? ACTION_ICON_MAP.themeLatte : ACTION_ICON_MAP.themeRistretto,
      state.theme === "latte" ? "Latte" : "Ristretto",
      { iconOnly: true },
    );

    this.toolButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.tool === state.tool);
    });

    decorateButton(
      document.getElementById("codeCollapseBtn"),
      state.codeCollapsed ? ACTION_ICON_MAP.codeExpand : ACTION_ICON_MAP.codeCollapse,
      "Collapse",
      { iconOnly: true },
    );

    decorateButton(
      document.getElementById("codeFullscreenBtn"),
      state.codeFullscreen ? ACTION_ICON_MAP.fullscreenExit : ACTION_ICON_MAP.fullscreen,
      "Fullscreen",
      { iconOnly: true },
    );
  }
}
