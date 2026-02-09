import { EventBus } from "./core/eventBus.js";
import { HistoryManager } from "./core/history.js";
import { Store } from "./core/state.js";
import { SvgEngine } from "./engine/svgEngine.js";
import { setupExporters } from "./exporters/index.js";
import { setupImporters } from "./importers/index.js";
import { optimizeMarkup } from "./optimizer/optimizer.js";
import { CodeEditorPanel } from "./ui/codeEditor.js";
import { LayersPanel } from "./ui/layers.js";
import { PropertiesPanel } from "./ui/properties.js";
import { ToolsPanel } from "./ui/tools.js";

const eventBus = new EventBus();
const store = new Store(eventBus);
const history = new HistoryManager(eventBus);

const dom = {
  appLayout: document.getElementById("appLayout"),
  workspacePanel: document.getElementById("workspacePanel"),
  codePanel: document.getElementById("codePanel"),
  splitter: document.getElementById("splitter"),
  viewport: document.getElementById("canvasViewport"),
  svg: document.getElementById("editorSvg"),
  scene: document.getElementById("svgScene"),
  defs: document.getElementById("svgDefs"),
  selectionOutline: document.getElementById("selectionOutline"),
  codeEditor: document.getElementById("codeEditor"),
  codeHighlight: document.getElementById("codeHighlight"),
  codeStatus: document.getElementById("codeStatus"),
  defsViewer: document.getElementById("defsViewer"),
  layersTree: document.getElementById("layersTree"),
  layerTemplate: document.getElementById("layerItemTemplate"),
  propertiesPanel: document.getElementById("propertiesPanel"),
  fileImportInput: document.getElementById("fileImportInput"),
};

new ToolsPanel({
  root: document,
  eventBus,
  store,
});

new LayersPanel({
  root: dom.layersTree,
  template: dom.layerTemplate,
  eventBus,
});

new PropertiesPanel({
  root: dom.propertiesPanel,
  eventBus,
});

new CodeEditorPanel({
  textarea: dom.codeEditor,
  highlight: dom.codeHighlight,
  status: dom.codeStatus,
  defsViewer: dom.defsViewer,
  eventBus,
  store,
  optimizeMarkup,
});

const engine = new SvgEngine({
  svg: dom.svg,
  scene: dom.scene,
  defs: dom.defs,
  viewport: dom.viewport,
  selectionOutline: dom.selectionOutline,
  eventBus,
  store,
  history,
});

setupExporters({
  eventBus,
  getMarkup: () => engine.serializeDocument({ pretty: true, inlineStyle: store.getState().inlineStyle }),
});

setupImporters({
  eventBus,
  viewport: dom.viewport,
  fileInput: dom.fileImportInput,
});

function applyLayoutFromState() {
  const state = store.getState();

  document.documentElement.style.setProperty("--code-width", `${state.codeWidth}%`);
  dom.codePanel.classList.toggle("collapsed", state.codeCollapsed);
  dom.codePanel.classList.toggle("fullscreen", state.codeFullscreen);
  dom.appLayout.classList.toggle("code-collapsed", state.codeCollapsed);
  dom.appLayout.classList.toggle("code-fullscreen", state.codeFullscreen);

  dom.viewport.classList.toggle("show-grid", state.showGrid);
  dom.viewport.classList.toggle("show-checker", state.showChecker);
}

store.subscribe(() => {
  applyLayoutFromState();
});

eventBus.on("layout:changed", () => applyLayoutFromState());
eventBus.on("canvas:grid-toggle", ({ enabled }) => {
  dom.viewport.classList.toggle("show-grid", enabled);
});
eventBus.on("canvas:checker-toggle", ({ enabled }) => {
  dom.viewport.classList.toggle("show-checker", enabled);
});

eventBus.on("scene:refresh", () => {
  engine.emitSceneChanged("canvas");
});

let resizeSession = null;

const startResize = (clientX) => {
  const bounds = dom.appLayout.getBoundingClientRect();
  resizeSession = {
    left: bounds.left,
    width: bounds.width,
    startX: clientX,
  };
};

const moveResize = (clientX) => {
  if (!resizeSession) {
    return;
  }
  const cursorX = Math.min(Math.max(clientX, resizeSession.left + 280), resizeSession.left + resizeSession.width - 280);
  const codeWidthPx = resizeSession.left + resizeSession.width - cursorX;
  const codeWidthPct = (codeWidthPx / resizeSession.width) * 100;
  store.set({ codeWidth: Number(codeWidthPct.toFixed(1)), codeCollapsed: false });
};

dom.splitter.addEventListener("pointerdown", (event) => {
  startResize(event.clientX);
});

window.addEventListener("pointermove", (event) => {
  moveResize(event.clientX);
});

window.addEventListener("pointerup", () => {
  resizeSession = null;
});

dom.splitter.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") {
    store.set({ codeWidth: Math.min(store.getState().codeWidth + 2, 60), codeCollapsed: false });
  }
  if (event.key === "ArrowRight") {
    store.set({ codeWidth: Math.max(store.getState().codeWidth - 2, 20), codeCollapsed: false });
  }
});

window.addEventListener("resize", () => {
  eventBus.emit("scene:refresh");
});

eventBus.emit("tool:changed", { tool: store.getState().tool });
applyLayoutFromState();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch((error) => {
    console.warn("Service worker registration failed", error);
  });
}
