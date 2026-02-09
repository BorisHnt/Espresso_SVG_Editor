import { ACTION_ICON_MAP, decorateButton, tablerIcon } from "./icons.js";

export class LayersPanel {
  constructor({ root, template, eventBus }) {
    this.root = root;
    this.template = template;
    this.eventBus = eventBus;
    this.selectedId = null;

    this.eventBus.on("layers:refresh", (layers) => this.render(layers));
    this.eventBus.on("selection:changed", ({ id }) => {
      this.selectedId = id;
      this.root.querySelectorAll(".layer-item").forEach((item) => {
        item.classList.toggle("selected", item.dataset.id === id);
      });
    });
  }

  render(layers) {
    this.root.innerHTML = "";
    layers
      .slice()
      .reverse()
      .forEach((layer) => {
        const fragment = this.template.content.cloneNode(true);
        const item = fragment.querySelector(".layer-item");
        const visibility = fragment.querySelector(".layer-visibility");
        const lock = fragment.querySelector(".layer-lock");
        const select = fragment.querySelector(".layer-select");
        const up = fragment.querySelector(".layer-up");
        const down = fragment.querySelector(".layer-down");

        item.dataset.id = layer.id;
        item.classList.toggle("selected", layer.id === this.selectedId);

        decorateButton(visibility, layer.hidden ? ACTION_ICON_MAP.hide : ACTION_ICON_MAP.show, "Visibility", { iconOnly: true });
        decorateButton(lock, layer.locked ? ACTION_ICON_MAP.lock : ACTION_ICON_MAP.unlock, "Lock", { iconOnly: true });
        decorateButton(up, ACTION_ICON_MAP.up, "Up", { iconOnly: true });
        decorateButton(down, ACTION_ICON_MAP.down, "Down", { iconOnly: true });

        select.innerHTML = `${tablerIcon("pointer", "", "")}<span class="btn-label"></span>`;
        select.querySelector(".btn-label").textContent = `${layer.name} <${layer.tag}>`;

        select.addEventListener("click", () => {
          this.eventBus.emit("selection:by-id", { id: layer.id });
        });

        select.addEventListener("dblclick", () => {
          const next = window.prompt("Rename layer", layer.name);
          if (next && next.trim()) {
            this.eventBus.emit("element:rename", { id: layer.id, name: next.trim() });
          }
        });

        visibility.addEventListener("click", () => {
          this.eventBus.emit("layer:visibility", { id: layer.id });
        });

        lock.addEventListener("click", () => {
          this.eventBus.emit("layer:lock", { id: layer.id });
        });

        up.addEventListener("click", () => {
          this.eventBus.emit("layer:reorder", { id: layer.id, direction: "up" });
        });

        down.addEventListener("click", () => {
          this.eventBus.emit("layer:reorder", { id: layer.id, direction: "down" });
        });

        item.addEventListener("dragstart", (event) => {
          event.dataTransfer.setData("text/plain", layer.id);
        });

        item.addEventListener("dragover", (event) => {
          event.preventDefault();
        });

        item.addEventListener("drop", (event) => {
          event.preventDefault();
          const draggedId = event.dataTransfer.getData("text/plain");
          if (!draggedId || draggedId === layer.id) {
            return;
          }
          this.eventBus.emit("layer:reorder", { id: draggedId, direction: "up" });
        });

        this.root.append(item);
      });
  }
}
