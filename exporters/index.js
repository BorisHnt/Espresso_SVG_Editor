import { optimizeMarkup } from "../optimizer/optimizer.js";

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function svgToDataUrl(markup) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
}

async function svgMarkupToRaster(markup, mimeType = "image/png", quality = 0.92) {
  const image = new Image();
  image.decoding = "async";
  image.src = svgToDataUrl(markup);

  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
  });

  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth || 1200;
  canvas.height = image.naturalHeight || 800;
  const context = canvas.getContext("2d");

  if (mimeType === "image/jpeg") {
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  context.drawImage(image, 0, 0);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, mimeType, quality));
  return blob;
}

function sanitizeBaseName(value) {
  const raw = String(value || "")
    .trim()
    .replace(/\.[a-z0-9]+$/i, "");
  const cleaned = raw
    .replace(/[<>:"/\\|?*\u0000-\u001F]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "");
  return cleaned || "espresso";
}

export function setupExporters({ eventBus, getMarkup, getExportFileName }) {
  const resolveName = (extension) => `${sanitizeBaseName(getExportFileName?.())}.${extension}`;

  document.getElementById("exportSvgBtn").addEventListener("click", async () => {
    const raw = getMarkup();
    const optimized = await optimizeMarkup(raw);
    downloadBlob(new Blob([optimized], { type: "image/svg+xml" }), resolveName("svg"));
  });

  document.getElementById("exportPngBtn").addEventListener("click", async () => {
    const blob = await svgMarkupToRaster(getMarkup(), "image/png");
    downloadBlob(blob, resolveName("png"));
  });

  document.getElementById("exportJpgBtn").addEventListener("click", async () => {
    const blob = await svgMarkupToRaster(getMarkup(), "image/jpeg");
    downloadBlob(blob, resolveName("jpg"));
  });

  eventBus.on("export:svg-optimized", async ({ markup, filename = "optimized.svg" }) => {
    const optimized = await optimizeMarkup(markup);
    downloadBlob(new Blob([optimized], { type: "image/svg+xml" }), filename);
  });
}
