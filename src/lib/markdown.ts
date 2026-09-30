/** Models write math as \( \) or \[ \]; remark-math expects $ and $$. */
export const normalizeMath = (text: string) =>
  text.replace(/\\\[([\s\S]+?)\\\]/g, (_, m) => `$$${m}$$`).replace(/\\\(([\s\S]+?)\\\)/g, (_, m) => `$${m.trim()}$`);

/** Turns [1], [2, 3] and [1][2] citation markers into links the renderer shows as clickable chips. */
export const prepareMarkdown = (text: string) =>
  normalizeMath(text).replace(/\[(\d+(?:\s*[,;]\s*\d+)*)\]/g, (_, group: string) =>
    group
      .split(/[,;]/)
      .map((n) => `[${n.trim()}](#cite-${n.trim()})`)
      .join(''),
  );
