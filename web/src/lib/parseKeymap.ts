import type { ParsedCombo, ParsedLayer, ParsedMacro } from "../types";

const normalizeWhitespace = (value: string) =>
  value.replace(/\s+/g, " ").trim();

// Count braces to find the full extent of a named block, handling nesting.
const extractBlock = (source: string, blockName: string): string => {
  const startMatch = source.match(new RegExp(`${blockName}\\s*\\{`));
  if (!startMatch || startMatch.index === undefined) {
    return "";
  }

  const startIndex = startMatch.index + startMatch[0].length;
  let depth = 1;
  let index = startIndex;

  while (index < source.length && depth > 0) {
    if (source[index] === "{") {
      depth++;
    } else if (source[index] === "}") {
      depth--;
    }

    index++;
  }

  return source.slice(startIndex, index - 1);
};

const extractBindingLines = (bindingsBlock: string) => {
  return bindingsBlock
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => line.match(/&[^&]+/g) ?? [])
    .map(normalizeWhitespace);
};

export const parseLayers = (source: string): ParsedLayer[] => {
  const keymapBlock = extractBlock(source, "keymap");
  const layerPattern =
    /(\w+)\s*\{[\s\S]*?bindings\s*=\s*<([\s\S]*?)>;[\s\S]*?sensor-bindings\s*=\s*<([^>]+)>;[\s\S]*?\};/g;
  const layers: ParsedLayer[] = [];

  for (const match of keymapBlock.matchAll(layerPattern)) {
    layers.push({
      id: match[1],
      bindings: extractBindingLines(match[2]),
      sensorBindings: normalizeWhitespace(match[3]),
    });
  }

  return layers;
};

export const parseCombos = (source: string): ParsedCombo[] => {
  const combosBlock = extractBlock(source, "combos");
  const comboPattern =
    /(\w+)\s*\{[\s\S]*?bindings\s*=\s*<([^>]+)>;[\s\S]*?key-positions\s*=\s*<([^>]+)>;[\s\S]*?\};/g;
  const combos: ParsedCombo[] = [];

  for (const match of combosBlock.matchAll(comboPattern)) {
    combos.push({
      id: match[1],
      binding: normalizeWhitespace(match[2]),
      keyPositions: normalizeWhitespace(match[3])
        .split(" ")
        .map((value) => Number.parseInt(value, 10))
        .filter((value) => Number.isFinite(value)),
    });
  }

  return combos;
};

export const parseMacros = (source: string): ParsedMacro[] => {
  const macrosBlock = extractBlock(source, "macros");
  const macroPattern =
    /(\w+)\s*:\s*\w+\s*\{[\s\S]*?bindings\s*=\s*<([^>]+)>;[\s\S]*?\};/g;
  const macros: ParsedMacro[] = [];

  for (const match of macrosBlock.matchAll(macroPattern)) {
    macros.push({
      id: match[1],
      bindings: extractBindingLines(match[2]),
    });
  }

  return macros;
};
