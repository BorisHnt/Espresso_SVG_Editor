export class ToolsPanel {
  constructor({ root, eventBus, store }) {
    this.root = root;
    this.eventBus = eventBus;
    this.store = store;

    this.toolButtons = Array.from(root.querySelectorAll(".tool-btn"));
    this.themeToggle = document.getElementById("themeToggle");
    this.gridToggle = document.getElementById("gridToggle");
    this.snapToggle = document.getElementById("snapToggle");
    this.checkerToggle = document.getElementById("checkerToggle");

    this.bind();
    this.applyState(store.getState());
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

    this.gridToggle.addEventListener("change", (event) => {
      this.store.set({ showGrid: event.target.checked });
      this.eventBus.emit("canvas:grid-toggle", { enabled: event.target.checked });
    });

    this.snapToggle.addEventListener("change", (event) => {
      this.store.set({ snapEnabled: event.target.checked });
    });

    this.checkerToggle.addEventListener("change", (event) => {
      this.store.set({ showChecker: event.target.checked });
      this.eventBus.emit("canvas:checker-toggle", { enabled: event.target.checked });
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
    this.themeToggle.textContent = state.theme === "latte" ? "Latte" : "Ristretto";

    this.toolButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.tool === state.tool);
    });

    this.gridToggle.checked = state.showGrid;
    this.snapToggle.checked = state.snapEnabled;
    this.checkerToggle.checked = state.showChecker;
  }
}
