const STORAGE_KEY = "espresso-svg-state-v1";
const DOC_STORAGE_KEY = "espresso-svg-doc-v1";

function createDefaultCanvasConfig() {
  return {
    width: 1200,
    height: 800,
    unit: "px",
    dpi: 96,
    viewBox: {
      x: 0,
      y: 0,
      width: 1200,
      height: 800,
    },
    grid: {
      enabled: true,
      spacing: 25,
      subdivisions: 5,
      snap: true,
    },
    rulers: false,
    guidesVisible: true,
    zonesVisible: false,
    guides: [],
    margins: { top: 24, right: 24, bottom: 24, left: 24 },
    bleed: { top: 0, right: 0, bottom: 0, left: 0 },
    safe: { top: 36, right: 36, bottom: 36, left: 36 },
  };
}

const defaultState = {
  theme: "latte",
  codeWidth: 34,
  codeCollapsed: false,
  codeFullscreen: false,
  tool: "select",
  selectedId: null,
  showGrid: true,
  showChecker: false,
  snapEnabled: true,
  zoom: 1,
  inlineStyle: false,
  exportFileName: "espresso",
  canvas: createDefaultCanvasConfig(),
  canvasUserPresets: [],
};

export class Store {
  constructor(eventBus) {
    this.eventBus = eventBus;
    const persisted = this.#load();
    this.state = {
      ...defaultState,
      canvas: createDefaultCanvasConfig(),
      ...persisted,
      canvas: persisted.canvas ? persisted.canvas : createDefaultCanvasConfig(),
      canvasUserPresets: Array.isArray(persisted.canvasUserPresets) ? persisted.canvasUserPresets : [],
    };
    this.subscribers = new Set();
  }

  getState() {
    return this.state;
  }

  set(partial, options = { silent: false }) {
    this.state = { ...this.state, ...partial };
    this.#persist();
    if (!options.silent) {
      this.subscribers.forEach((subscriber) => subscriber(this.state));
      this.eventBus.emit("state:changed", this.state);
    }
  }

  subscribe(handler) {
    this.subscribers.add(handler);
    return () => this.subscribers.delete(handler);
  }

  saveDocument(markup, viewBox) {
    localStorage.setItem(DOC_STORAGE_KEY, JSON.stringify({ markup, viewBox }));
  }

  loadDocument() {
    try {
      const raw = localStorage.getItem(DOC_STORAGE_KEY);
      if (!raw) {
        return null;
      }
      return JSON.parse(raw);
    } catch (error) {
      console.warn("Unable to read persisted document", error);
      return null;
    }
  }

  #persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
  }

  #load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return {};
      }
      return JSON.parse(raw);
    } catch (error) {
      console.warn("Unable to read persisted state", error);
      return {};
    }
  }
}

export function getDefaultState() {
  return { ...defaultState, canvas: createDefaultCanvasConfig(), canvasUserPresets: [] };
}

export function getDefaultCanvasConfig() {
  return createDefaultCanvasConfig();
}
