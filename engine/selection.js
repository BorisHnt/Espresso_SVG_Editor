export class SelectionManager {
  constructor({ svg, scene, viewport, outline, eventBus, store }) {
    this.svg = svg;
    this.scene = scene;
    this.viewport = viewport;
    this.outline = outline;
    this.eventBus = eventBus;
    this.store = store;
    this.current = null;
    this.rotateHandle = null;

    this.setupOutlineControls();
  }

  setupOutlineControls() {
    this.outline.innerHTML = "";

    const stem = document.createElement("div");
    stem.className = "selection-rotate-stem";

    const handle = document.createElement("button");
    handle.type = "button";
    handle.className = "selection-rotate-handle";
    handle.setAttribute("aria-label", "Rotate selection");
    handle.title = "Rotate selection (Shift: snap 15deg)";

    this.outline.append(stem, handle);
    this.rotateHandle = handle;
  }

  getSelectedElement() {
    return this.current;
  }

  getSelectedId() {
    return this.current?.id || null;
  }

  isRotateHandleTarget(target) {
    if (!(target instanceof Element)) {
      return false;
    }
    return Boolean(target.closest(".selection-rotate-handle"));
  }

  setRotating(isRotating) {
    this.outline.classList.toggle("is-rotating", Boolean(isRotating));
  }

  select(element, options = { silent: false }) {
    if (this.current === element) {
      this.refreshOutline();
      return;
    }

    if (this.current) {
      this.current.classList.remove("is-selected");
    }

    this.current = element || null;

    if (this.current) {
      this.current.classList.add("is-selected");
      this.outline.classList.remove("hidden");
      this.refreshOutline();
    } else {
      this.outline.classList.add("hidden");
      this.setRotating(false);
    }

    this.store.set({ selectedId: this.current?.id ?? null }, { silent: options.silent });
    if (!options.silent) {
      this.eventBus.emit("selection:changed", {
        id: this.current?.id ?? null,
        element: this.current,
      });
    }
  }

  clear(options = { silent: false }) {
    this.select(null, options);
  }

  selectById(id, options = { silent: false }) {
    if (!id) {
      this.clear(options);
      return;
    }
    const found = this.scene.querySelector(`#${CSS.escape(id)}`);
    this.select(found, options);
  }

  refreshOutline() {
    if (!this.current) {
      return;
    }
    const viewportRect = this.viewport.getBoundingClientRect();
    const elementRect = this.current.getBoundingClientRect();
    const width = Math.max(1, elementRect.width);
    const height = Math.max(1, elementRect.height);

    this.outline.style.left = `${elementRect.left - viewportRect.left}px`;
    this.outline.style.top = `${elementRect.top - viewportRect.top}px`;
    this.outline.style.width = `${width}px`;
    this.outline.style.height = `${height}px`;
  }
}
