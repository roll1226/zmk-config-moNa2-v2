import type { Combo } from "../types/combo";

function matchingBraceEnd(text: string, openPos: number): number {
  let depth = 1;
  let i = openPos + 1;
  while (i < text.length && depth > 0) {
    const ch = text[i];
    if (ch === "/" && text[i + 1] === "/") {
      const nl = text.indexOf("\n", i + 2);
      i = nl === -1 ? text.length : nl + 1;
    } else if (ch === "/" && text[i + 1] === "*") {
      const end = text.indexOf("*/", i + 2);
      i = end === -1 ? text.length : end + 2;
    } else {
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
      i++;
    }
  }
  return i;
}

/** Parse the full "combos { ... };" DTS block into Combo[]. */
export function parseCombosBlock(combosBlockText: string): Combo[] {
  if (!combosBlockText) return [];
  const openBrace = combosBlockText.indexOf("{");
  if (openBrace === -1) return [];
  const closePos = matchingBraceEnd(combosBlockText, openBrace);
  const innerText = combosBlockText.slice(openBrace + 1, closePos - 1);

  const combos: Combo[] = [];
  // Node names in ZMK keymap can include letters, digits, _, +, -
  const nodeRe = /(?:^|\n)[ \t]*([\w+\-]+)\s*\{/g;
  let match: RegExpExecArray | null;

  while ((match = nodeRe.exec(innerText)) !== null) {
    const nodeName = match[1];
    if (nodeName === "compatible") continue;

    const openBraceIdx = innerText.indexOf("{", match.index + match[0].length - 1);
    const closeBraceIdx = matchingBraceEnd(innerText, openBraceIdx);
    const nodeContent = innerText.slice(openBraceIdx + 1, closeBraceIdx - 1);

    const bindingM = nodeContent.match(/\bbindings\s*=\s*<([^>]+)>/);
    const posM = nodeContent.match(/\bkey-positions\s*=\s*<([^>]+)>/);
    const timeoutM = nodeContent.match(/\btimeout-ms\s*=\s*<(\d+)>/);
    const layersM = nodeContent.match(/\blayers\s*=\s*<([^>]+)>/);
    const idleM = nodeContent.match(/\brequire-prior-idle-ms\s*=\s*<(\d+)>/);

    if (!bindingM || !posM || !timeoutM) {
      nodeRe.lastIndex = closeBraceIdx;
      continue;
    }

    combos.push({
      id: Math.random().toString(36).slice(2),
      name: nodeName,
      binding: bindingM[1].trim(),
      keyPositions: posM[1].trim().split(/\s+/).map(Number).filter((n) => !isNaN(n)),
      timeoutMs: parseInt(timeoutM[1]),
      layers: layersM
        ? layersM[1].trim().split(/\s+/).map(Number).filter((n) => !isNaN(n))
        : undefined,
      requirePriorIdleMs: idleM ? parseInt(idleM[1]) : undefined,
    });

    nodeRe.lastIndex = closeBraceIdx;
  }

  return combos;
}

/** Serialize Combo[] to the "combos { ... };" DTS block. */
export function generateCombosBlock(combos: Combo[]): string {
  if (combos.length === 0) return "";

  const nodes = combos.map((c) => {
    const lines = [
      `        ${c.name} {`,
      `            bindings = <${c.binding}>;`,
      `            key-positions = <${c.keyPositions.join(" ")}>;`,
      `            timeout-ms = <${c.timeoutMs}>;`,
    ];
    if (c.layers !== undefined && c.layers.length > 0)
      lines.push(`            layers = <${c.layers.join(" ")}>;`);
    if (c.requirePriorIdleMs !== undefined)
      lines.push(`            require-prior-idle-ms = <${c.requirePriorIdleMs}>;`);
    lines.push(`        };`);
    return lines.join("\n");
  });

  return [
    `    combos {`,
    `        compatible = "zmk,combos";`,
    ``,
    nodes.join("\n\n"),
    `    };`,
  ].join("\n");
}
