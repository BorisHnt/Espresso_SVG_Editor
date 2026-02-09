import { getGeometry } from "../engine/transform.js";

function buildField({ key, label, type = "text", min = "", max = "", step = "" }, value = "") {
  const wrapper = document.createElement("div");
  wrapper.className = "field-group";

  const title = document.createElement("label");
  title.htmlFor = `prop-${key}`;
  title.textContent = label;

  const input = document.createElement("input");
  input.id = `prop-${key}`;
  input.name = key;
  input.type = type;
  input.value = value ?? "";
  if (min !== "") {
    input.min = min;
  }
  if (max !== "") {
    input.max = max;
  }
  if (step !== "") {
    input.step = step;
  }

  wrapper.append(title, input);
  return wrapper;
}

export class PropertiesPanel {
  constructor({ root, eventBus }) {
    this.root = root;
    this.eventBus = eventBus;
    this.current = null;

    this.eventBus.on("scene:changed", ({ selectedId, selectionGeometry }) => {
      if (!selectedId || !selectionGeometry) {
        this.renderEmpty();
        return;
      }
      this.current = {
        id: selectedId,
        geometry: selectionGeometry,
      };
      this.render(this.current);
    });

    this.eventBus.on("selection:changed", ({ id, element }) => {
      if (!id || !element) {
        this.renderEmpty();
        return;
      }
      this.current = {
        id,
        geometry: getGeometry(element),
      };
      this.render(this.current);
    });

    this.renderEmpty();
  }

  renderEmpty() {
    this.root.innerHTML = '<div class="field-group"><label>Selection</label><input type="text" value="No selection" disabled /></div>';
  }

  render(selection) {
    const { id, geometry } = selection;

    const fields = [
      { key: "fill", label: "Fill" },
      { key: "stroke", label: "Stroke" },
      { key: "strokeWidth", label: "Stroke Width", type: "number", step: "0.1" },
      { key: "opacity", label: "Opacity", type: "number", min: "0", max: "1", step: "0.05" },
      { key: "transform", label: "Transform" },
    ];

    if (typeof geometry.x === "number") {
      fields.unshift({ key: "x", label: "X", type: "number", step: "1" });
      fields.unshift({ key: "y", label: "Y", type: "number", step: "1" });
    }
    if (typeof geometry.width === "number") {
      fields.push({ key: "width", label: "Width", type: "number", step: "1" });
      fields.push({ key: "height", label: "Height", type: "number", step: "1" });
    }
    if (typeof geometry.cx === "number") {
      fields.push({ key: "cx", label: "CX", type: "number", step: "1" });
      fields.push({ key: "cy", label: "CY", type: "number", step: "1" });
    }
    if (typeof geometry.r === "number") {
      fields.push({ key: "r", label: "R", type: "number", step: "1" });
    }
    if (typeof geometry.rx === "number" && geometry.tag === "ellipse") {
      fields.push({ key: "rx", label: "RX", type: "number", step: "1" });
      fields.push({ key: "ry", label: "RY", type: "number", step: "1" });
    }
    if (typeof geometry.x1 === "number") {
      fields.push({ key: "x1", label: "X1", type: "number", step: "1" });
      fields.push({ key: "y1", label: "Y1", type: "number", step: "1" });
      fields.push({ key: "x2", label: "X2", type: "number", step: "1" });
      fields.push({ key: "y2", label: "Y2", type: "number", step: "1" });
    }

    this.root.innerHTML = "";
    fields.forEach((field) => {
      if (!(field.key in geometry)) {
        return;
      }
      const inputNode = buildField(field, geometry[field.key]);
      const input = inputNode.querySelector("input");
      input.addEventListener("change", (event) => {
        const nextValue = event.target.type === "number" ? Number.parseFloat(event.target.value) : event.target.value;
        this.eventBus.emit("element:update", {
          id,
          geometry: {
            ...geometry,
            [field.key]: Number.isNaN(nextValue) ? event.target.value : nextValue,
          },
        });
      });
      this.root.append(inputNode);
    });
  }
}
