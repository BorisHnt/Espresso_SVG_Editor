import { escapeHtml, formatXml } from "../utils/xml.js";

function debounce(callback, delay = 220) {
  let timer = null;
  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => callback(...args), delay);
  };
}

function tokenizeLine(line) {
  let html = escapeHtml(line);
  html = html.replace(/(&lt;!--.*?--&gt;)/g, '<span class="code-comment">$1</span>');
  html = html.replace(/(&lt;\/?)([a-zA-Z0-9:_-]+)/g, '$1<span class="code-tag">$2</span>');
  html = html.replace(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)(=)/g, '<span class="code-attr">$1</span>$2');
  html = html.replace(/(&quot;.*?&quot;)/g, '<span class="code-string">$1</span>');
  return html;
}

export class CodeEditorPanel {
  constructor({ textarea, highlight, status, defsViewer, eventBus, store, optimizeMarkup }) {
    this.textarea = textarea;
    this.highlight = highlight;
    this.status = status;
    this.defsViewer = defsViewer;
    this.eventBus = eventBus;
    this.store = store;
    this.optimizeMarkup = optimizeMarkup;

    this.activeId = null;
    this.suspendSceneEcho = false;
    this.isFocused = false;
    this.localDirty = false;
    this.pendingExternalMarkup = null;
    this.lastDispatchedCode = "";
    this.lastSyncedMarkup = "";

    this.applyDebounced = debounce(() => this.applyCode({ recordHistory: false }), 120);

    this.bind();
  }

  bind() {
    this.textarea.addEventListener("focus", () => {
      this.isFocused = true;
    });

    this.textarea.addEventListener("blur", () => {
      this.isFocused = false;

      if (this.localDirty) {
        this.applyCode({ recordHistory: true, force: true });
        return;
      }

      if (this.pendingExternalMarkup && this.pendingExternalMarkup !== this.textarea.value) {
        this.textarea.value = this.pendingExternalMarkup;
        this.pendingExternalMarkup = null;
        this.lastSyncedMarkup = this.textarea.value;
        this.renderHighlight();
      }
    });

    this.textarea.addEventListener("input", () => {
      this.localDirty = true;
      this.renderHighlight();
      this.applyDebounced();
    });

    this.textarea.addEventListener("scroll", () => {
      this.highlight.scrollTop = this.textarea.scrollTop;
      this.highlight.scrollLeft = this.textarea.scrollLeft;
    });

    this.textarea.addEventListener("keydown", (event) => {
      if (event.key === "Tab") {
        event.preventDefault();
        const start = this.textarea.selectionStart;
        const end = this.textarea.selectionEnd;
        this.textarea.setRangeText("  ", start, end, "end");
        this.localDirty = true;
        this.renderHighlight();
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "enter") {
        event.preventDefault();
        this.applyCode({ recordHistory: true, force: true });
      }
    });

    this.textarea.addEventListener("click", () => this.selectByCursor());
    this.textarea.addEventListener("keyup", () => this.selectByCursor());

    this.eventBus.on("scene:changed", ({ source, markup, selectedId }) => {
      this.activeId = selectedId;

      if (source === "code" && this.suspendSceneEcho) {
        this.lastSyncedMarkup = markup;
        this.localDirty = false;
        this.pendingExternalMarkup = null;
        this.suspendSceneEcho = false;
        this.setStatus(`ok (${source})`, false);
        this.renderHighlight();
        return;
      }

      if (this.isFocused) {
        this.pendingExternalMarkup = markup;
        this.suspendSceneEcho = false;
        this.setStatus("edit local actif", false);
        return;
      }

      this.textarea.value = markup;
      this.lastSyncedMarkup = markup;
      this.localDirty = false;
      this.pendingExternalMarkup = null;
      this.renderHighlight();
      this.suspendSceneEcho = false;
      this.setStatus(`ok (${source})`, false);
    });

    this.eventBus.on("selection:changed", ({ id }) => {
      this.activeId = id;
      this.renderHighlight();
    });

    this.eventBus.on("code:error", (errorMessage) => {
      this.suspendSceneEcho = false;
      this.setStatus(errorMessage, true);
    });

    this.eventBus.on("defs:changed", (defs) => {
      this.defsViewer.innerHTML = defs.length
        ? defs.map((entry) => `&lt;${entry.tag} id="${entry.id}"/&gt;`).join("<br />")
        : "No defs";
    });

    document.getElementById("prettyBtn").addEventListener("click", () => {
      this.textarea.value = formatXml(this.textarea.value);
      this.localDirty = true;
      this.renderHighlight();
      this.applyCode({ recordHistory: true, force: true });
    });

    document.getElementById("minifyBtn").addEventListener("click", async () => {
      this.setStatus("optimizing...", false);
      const minified = await this.optimizeMarkup(this.textarea.value);
      this.textarea.value = minified;
      this.localDirty = true;
      this.renderHighlight();
      this.applyCode({ recordHistory: true, force: true });
    });

    document.getElementById("inlineStyleBtn").addEventListener("click", () => {
      const next = !this.store.getState().inlineStyle;
      this.store.set({ inlineStyle: next });
      this.eventBus.emit("scene:refresh");
      this.setStatus(`inline styles ${next ? "on" : "off"}`, false);
    });

    document.getElementById("defsViewerBtn").addEventListener("click", () => {
      this.defsViewer.classList.toggle("hidden");
    });

    document.getElementById("codeCollapseBtn").addEventListener("click", () => {
      const next = !this.store.getState().codeCollapsed;
      this.store.set({ codeCollapsed: next });
      this.eventBus.emit("layout:changed", this.store.getState());
    });

    document.getElementById("codeFullscreenBtn").addEventListener("click", () => {
      const next = !this.store.getState().codeFullscreen;
      this.store.set({ codeFullscreen: next });
      this.eventBus.emit("layout:changed", this.store.getState());
    });

    this.store.subscribe(() => {
      this.renderHighlight();
    });
  }

  selectByCursor() {
    const cursor = this.textarea.selectionStart;
    const text = this.textarea.value;
    const head = text.slice(0, cursor);
    const lineIndex = head.split("\n").length - 1;
    const line = text.split("\n")[lineIndex] || "";
    const idMatch = line.match(/id\s*=\s*["']([^"']+)["']/);
    if (idMatch?.[1]) {
      this.eventBus.emit("selection:by-id", { id: idMatch[1] });
    }
  }

  applyCode({ recordHistory = false, force = false } = {}) {
    const code = this.textarea.value;
    if (!force && code === this.lastDispatchedCode) {
      return;
    }

    this.lastDispatchedCode = code;
    this.suspendSceneEcho = true;
    this.setStatus("parsing...", false);
    this.eventBus.emit("scene:load-code", {
      code,
      recordHistory,
    });
  }

  setStatus(message, isError) {
    this.status.textContent = message;
    this.status.classList.toggle("error", isError);
  }

  renderHighlight() {
    const lines = this.textarea.value.split("\n");
    const highlighted = lines
      .map((line) => {
        const tokenized = tokenizeLine(line);
        const isActiveLine =
          this.activeId &&
          (line.includes(`id="${this.activeId}"`) || line.includes(`id='${this.activeId}'`));
        return isActiveLine ? `<span class="code-line-active">${tokenized || " "}</span>` : tokenized;
      })
      .join("\n");

    this.highlight.innerHTML = highlighted;
  }
}
