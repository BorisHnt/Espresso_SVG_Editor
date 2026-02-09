export function escapeHtml(input = "") {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function legacyFormatXml(xml) {
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

function encodeXmlText(input = "") {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function encodeXmlAttr(input = "") {
  return encodeXmlText(input).replaceAll('"', "&quot;");
}

function sortAttributes(attributes) {
  const priority = new Map([
    ["xmlns", 0],
    ["width", 1],
    ["height", 2],
    ["viewBox", 3],
    ["fill", 4],
    ["stroke", 5],
    ["stroke-width", 6],
    ["stroke-linecap", 7],
    ["stroke-linejoin", 8],
  ]);

  return [...attributes].sort((a, b) => {
    const rankA = priority.has(a.name) ? priority.get(a.name) : 100;
    const rankB = priority.has(b.name) ? priority.get(b.name) : 100;
    if (rankA !== rankB) {
      return rankA - rankB;
    }
    return a.name.localeCompare(b.name);
  });
}

function renderXmlNode(node, level = 0) {
  const indent = "  ".repeat(level);

  if (node.nodeType === 3) {
    const text = node.textContent || "";
    if (!text.trim()) {
      return "";
    }
    return `${indent}${encodeXmlText(text.trim())}`;
  }

  if (node.nodeType === 8) {
    return `${indent}<!--${encodeXmlText(node.textContent || "")}-->`;
  }

  if (node.nodeType !== 1) {
    return "";
  }

  const tag = node.tagName;
  const attributes = sortAttributes(Array.from(node.attributes));
  const attrParts = attributes.map((attribute) => `${attribute.name}="${encodeXmlAttr(attribute.value)}"`);
  const children = Array.from(node.childNodes)
    .map((child) => renderXmlNode(child, level + 1))
    .filter(Boolean);

  let openTag = `${indent}<${tag}`;
  if (attrParts.length === 1) {
    openTag += ` ${attrParts[0]}`;
  } else if (attrParts.length > 1) {
    openTag += `\n${attrParts.map((attr) => `${"  ".repeat(level + 1)}${attr}`).join("\n")}\n${indent}`;
  }

  if (!children.length) {
    return `${openTag} />`;
  }

  const lines = [`${openTag}>`, ...children, `${indent}</${tag}>`];
  return lines.join("\n");
}

export function formatXml(xml) {
  if (typeof DOMParser === "undefined") {
    return legacyFormatXml(xml);
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "image/svg+xml");
  if (doc.querySelector("parsererror")) {
    return legacyFormatXml(xml);
  }

  return renderXmlNode(doc.documentElement, 0);
}

export function minifyXml(xml) {
  return xml
    .replace(/>\s+</g, "><")
    .replace(/\s{2,}/g, " ")
    .replace(/\n/g, "")
    .trim();
}
