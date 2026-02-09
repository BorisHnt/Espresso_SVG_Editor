function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function setupImporters({ eventBus, viewport, fileInput }) {
  let pendingImagePoint = { x: 120, y: 120 };

  const importFile = async (file) => {
    if (!file) {
      return;
    }

    if (file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg")) {
      const svgCode = await readFileAsText(file);
      eventBus.emit("scene:load-code", { code: svgCode, recordHistory: true });
      return;
    }

    if (file.type.startsWith("image/")) {
      const dataUrl = await readFileAsDataUrl(file);
      eventBus.emit("image:insert", {
        dataUrl,
        x: pendingImagePoint.x,
        y: pendingImagePoint.y,
      });
    }
  };

  document.getElementById("importBtn").addEventListener("click", () => {
    fileInput.value = "";
    fileInput.click();
  });

  fileInput.addEventListener("change", async (event) => {
    await importFile(event.target.files?.[0]);
  });

  viewport.addEventListener("dragover", (event) => {
    event.preventDefault();
  });

  viewport.addEventListener("drop", async (event) => {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    await importFile(file);
  });

  window.addEventListener("paste", async (event) => {
    const items = Array.from(event.clipboardData?.items || []);
    const imageItem = items.find((item) => item.type.startsWith("image/"));
    if (!imageItem) {
      return;
    }
    const file = imageItem.getAsFile();
    await importFile(file);
  });

  eventBus.on("image:request", ({ point }) => {
    pendingImagePoint = point;
    fileInput.value = "";
    fileInput.click();
  });
}
