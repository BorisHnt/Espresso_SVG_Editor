export class SelectionManager {
  constructor({ svg, scene, viewport, outline, eventBus, store }) {
    this.svg = svg;
    this.scene = scene;
    this.viewport = viewport;
    this.outline = outline;
    this.eventBus = eventBus;
    this.store = store;
    this.current = null;
  }

  getSelectedElement() {
    return this.current;
  }

  getSelectedId() {
    return this.current?.id || null;
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

    const bbox = this.current.getBBox();
    const ctm = this.current.getScreenCTM();
    if (!ctm) {
      return;
    }

    const topLeft = this.svg.createSVGPoint();
    topLeft.x = bbox.x;
    topLeft.y = bbox.y;
    const bottomRight = this.svg.createSVGPoint();
    bottomRight.x = bbox.x + bbox.width;
    bottomRight.y = bbox.y + bbox.height;

    const p1 = topLeft.matrixTransform(ctm);
    const p2 = bottomRight.matrixTransform(ctm);

    const viewportRect = this.viewport.getBoundingClientRect();
    this.outline.style.left = `${Math.min(p1.x, p2.x) - viewportRect.left}px`;
    this.outline.style.top = `${Math.min(p1.y, p2.y) - viewportRect.top}px`;
    this.outline.style.width = `${Math.abs(p2.x - p1.x)}px`;
    this.outline.style.height = `${Math.abs(p2.y - p1.y)}px`;
  }
}
