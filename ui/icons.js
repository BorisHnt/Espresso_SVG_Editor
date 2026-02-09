/**
 * Tabler icon mapping for ESPRESSO SVG.
 * Tool/action -> icon id is centralized here to keep visual consistency.
 */
export const TOOL_ICON_MAP = {
  select: "pointer",
  rect: "rectangle",
  roundRect: "square-rounded",
  circle: "circle",
  ellipse: "oval",
  line: "line",
  polyline: "line-dashed",
  polygon: "polygon",
  path: "vector-bezier",
  text: "text-size",
  image: "photo",
  group: "stack-2",
  clipPath: "scissors",
  mask: "mask",
  symbol: "circle-letter-s",
  gradient: "gradienter",
  filter: "filter",
};

export const ACTION_ICON_MAP = {
  themeLatte: "sun",
  themeRistretto: "moon",
  undo: "arrow-back-up",
  redo: "arrow-forward-up",
  import: "file-import",
  resetCanvas: "trash",
  exportSvg: "file-type-svg",
  exportPng: "file-type-png",
  exportJpg: "file-type-jpg",
  canvasSettings: "settings-2",
  grid: "grid-3x3",
  snap: "magnet",
  ruler: "ruler-2",
  guides: "line-dashed",
  checker: "template",
  quickLogo: "artboard",
  zoomIn: "zoom-in",
  zoomOut: "zoom-out",
  zoomFit: "zoom-reset",
  delete: "trash",
  pretty: "template",
  minify: "arrows-minimize",
  inlineStyle: "braces",
  defs: "code",
  codeCollapse: "layout-sidebar-right-collapse",
  codeExpand: "layout-sidebar-right-expand",
  fullscreen: "maximize",
  fullscreenExit: "minimize",
  hide: "eye-off",
  show: "eye",
  lock: "lock",
  unlock: "lock-open",
  up: "chevron-up",
  down: "chevron-down",
  save: "device-floppy",
  close: "x",
  plus: "plus",
  minus: "minus",
  artboard: "artboard",
  aspectRatio: "aspect-ratio",
};

export function tablerIcon(iconName, label = "", className = "") {
  return `<svg class="ti-icon ${className}" viewBox="0 0 24 24" aria-hidden="true"><use href="./assets/tabler-sprite.svg#ti-${iconName}"></use></svg>${label ? `<span class="btn-label">${label}</span>` : ""}`;
}

export function decorateButton(button, iconName, label = "", options = {}) {
  if (!button) {
    return;
  }
  const { iconOnly = false } = options;
  button.innerHTML = tablerIcon(iconName, iconOnly ? "" : label);
  if (label) {
    button.setAttribute("aria-label", label);
    button.title = button.title || label;
  }
  button.classList.add("has-icon");
  if (iconOnly) {
    button.classList.add("icon-only");
  }
}

export function decorateToolButton(button) {
  const tool = button.dataset.tool;
  const iconName = TOOL_ICON_MAP[tool] || "pointer";
  const label = button.dataset.label || tool;
  decorateButton(button, iconName, label);
}
