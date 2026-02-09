function optimizeSvgMarkup(markup) {
  return markup
    .replace(/<!--([\s\S]*?)-->/g, "")
    .replace(/>\s+</g, "><")
    .replace(/\s{2,}/g, " ")
    .replace(/\n/g, "")
    .trim();
}

self.onmessage = (event) => {
  const { id, markup } = event.data;
  const optimized = optimizeSvgMarkup(markup);
  self.postMessage({ id, optimized });
};
