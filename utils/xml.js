export function escapeHtml(input = "") {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function formatXml(xml) {
  const normalized = xml.replace(/>\s*</g, "><").trim();
  const tokens = normalized.replace(/></g, ">\n<").split("\n");
  let indent = 0;
  const lines = [];

  tokens.forEach((token) => {
    const trimmed = token.trim();
    if (/^<\//.test(trimmed)) {
      indent = Math.max(indent - 1, 0);
    }

    lines.push(`${"  ".repeat(indent)}${trimmed}`);

    if (/^<[^!?/][^>]*[^/]?>$/.test(trimmed) && !/<\/[^>]+>$/.test(trimmed)) {
      indent += 1;
    }
  });

  return lines.join("\n");
}

export function minifyXml(xml) {
  return xml
    .replace(/>\s+</g, "><")
    .replace(/\s{2,}/g, " ")
    .replace(/\n/g, "")
    .trim();
}
