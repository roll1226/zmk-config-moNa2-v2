import type { KeyBinding, KeymapLayer } from "../hooks/useKeymap";
import type { BehaviorDetails } from "../hooks/useBehaviors";
import type { Combo } from "../types/combo";
import { generateCombosBlock } from "./comboParser";

// HID keyboard page (0x07) code → ZMK key name
const KBD_KEY_NAMES: Record<number, string> = {
  4: "A", 5: "B", 6: "C", 7: "D", 8: "E", 9: "F", 10: "G",
  11: "H", 12: "I", 13: "J", 14: "K", 15: "L", 16: "M", 17: "N",
  18: "O", 19: "P", 20: "Q", 21: "R", 22: "S", 23: "T", 24: "U",
  25: "V", 26: "W", 27: "X", 28: "Y", 29: "Z",
  30: "NUMBER_1", 31: "NUMBER_2", 32: "NUMBER_3", 33: "NUMBER_4", 34: "NUMBER_5",
  35: "NUMBER_6", 36: "NUMBER_7", 37: "NUMBER_8", 38: "NUMBER_9", 39: "NUMBER_0",
  40: "ENTER", 41: "ESCAPE", 42: "BACKSPACE", 43: "TAB", 44: "SPACE",
  45: "MINUS", 46: "EQUAL", 47: "LEFT_BRACKET", 48: "RIGHT_BRACKET",
  49: "BACKSLASH", 51: "SEMICOLON", 52: "SQT", 53: "GRAVE",
  54: "COMMA", 55: "PERIOD", 56: "SLASH",
  57: "CAPS",
  58: "F1", 59: "F2", 60: "F3", 61: "F4", 62: "F5", 63: "F6",
  64: "F7", 65: "F8", 66: "F9", 67: "F10", 68: "F11", 69: "F12",
  70: "PRINTSCREEN", 71: "SCROLLLOCK", 72: "PAUSE_BREAK",
  73: "INSERT", 74: "HOME", 75: "PAGE_UP",
  76: "DELETE", 77: "END", 78: "PAGE_DOWN",
  79: "RIGHT_ARROW", 80: "LEFT_ARROW", 81: "DOWN_ARROW", 82: "UP_ARROW",
  83: "KP_NUM", 84: "KP_SLASH", 85: "KP_ASTERISK", 86: "KP_MINUS",
  87: "KP_PLUS", 88: "KP_ENTER",
  89: "KP_N1", 90: "KP_N2", 91: "KP_N3", 92: "KP_N4", 93: "KP_N5",
  94: "KP_N6", 95: "KP_N7", 96: "KP_N8", 97: "KP_N9", 98: "KP_N0",
  99: "KP_DOT",
  224: "LCTRL", 225: "LSHFT", 226: "LALT", 227: "LGUI",
  228: "RCTRL", 229: "RSHFT", 230: "RALT", 231: "RGUI",
};

// HID consumer page (0x0C) usage → ZMK key name
const CONSUMER_KEY_NAMES: Record<number, string> = {
  0xE2: "C_MUTE",
  0xE9: "C_VOL_UP",
  0xEA: "C_VOL_DN",
  0x6F: "C_BRI_UP",
  0x70: "C_BRI_DN",
  0xCD: "C_PP",
  0xB5: "C_NEXT",
  0xB6: "C_PREV",
  0xB7: "C_STOP",
  0xB3: "C_FF",
  0xB4: "C_RW",
  0x183: "C_AL_CALC",
  0x94: "C_AL_MY_COMPUTER",
  0x19E: "C_AL_TERMINAL",
};

// Modifier bit → ZMK modifier wrapper function
const MOD_WRAPPERS: [number, string][] = [
  [0x01, "LC"], [0x02, "LS"], [0x04, "LA"], [0x08, "LG"],
  [0x10, "RC"], [0x20, "RS"], [0x40, "RA"], [0x80, "RG"],
];

/** Converts a ZMK usage param to a DTS key reference string. */
function zmkKeyRef(zmkUsage: number): string {
  const rawCode = zmkUsage & 0xFFFF;
  const page = (zmkUsage >> 16) & 0xFF;
  const modFlags = (zmkUsage >>> 24) & 0xFF;

  let baseName: string;
  if (page === 7) {
    baseName = KBD_KEY_NAMES[rawCode] ?? `/* kbd 0x${rawCode.toString(16)} */`;
  } else if (page === 0x0C) {
    baseName = CONSUMER_KEY_NAMES[rawCode] ?? `/* consumer 0x${rawCode.toString(16)} */`;
  } else {
    baseName = `/* usage 0x${zmkUsage.toString(16)} */`;
  }

  if (modFlags === 0) return baseName;

  // Wrap with modifier macros: LC(LS(KEY)) for bit0+bit1
  const mods = MOD_WRAPPERS.filter(([bit]) => modFlags & bit).map(([, fn]) => fn);
  return mods.reduceRight((inner, fn) => `${fn}(${inner})`, baseName);
}

/** Converts a KeyBinding to a ZMK DTS binding string like `&kp A`. */
function bindingToZmkStr(
  binding: KeyBinding,
  behaviors: Map<number, BehaviorDetails>
): string {
  const name = behaviors.get(binding.behaviorId)?.displayName ?? "";

  if (!name || name === "None") return "&none";
  if (name === "Transparent") return "&trans";
  if (name === "Key Press") return `&kp ${zmkKeyRef(binding.param1)}`;
  if (name === "Momentary Layer") return `&mo ${binding.param1}`;
  if (name === "Toggle Layer") return `&tog ${binding.param1}`;
  if (name === "To Layer") return `&to ${binding.param1}`;
  if (name === "Layer-Tap" || name === "Layer Tap")
    return `&lt ${binding.param1} ${zmkKeyRef(binding.param2)}`;
  if (name === "Mod-Tap" || name === "Mod Tap")
    return `&mt ${zmkKeyRef(binding.param1)} ${zmkKeyRef(binding.param2)}`;
  if (name === "Sticky Key") return `&sk ${zmkKeyRef(binding.param1)}`;
  if (name === "Sticky Layer") return `&sl ${binding.param1}`;
  if (name === "Bootloader") return "&bootloader";
  if (name === "Reset") return "&sys_reset";
  if (name === "Caps Word") return "&caps_word";
  if (name === "Key Repeat") return "&key_repeat";
  if (name === "Grave/Escape") return "&gresc";
  if (name === "Studio Unlock") return "&studio_unlock";
  if (name === "Mouse Key Press" || name === "Mouse Button") {
    const mb = ["MB1", "MB2", "MB3", "MB4", "MB5"][binding.param1 - 1]
      ?? `BUTTON${binding.param1}`;
    return `&mkp ${mb}`;
  }
  if (name === "Bluetooth") {
    const cmd = binding.param1;
    if (cmd === 0) return "&bt BT_CLR";
    if (cmd === 1) return "&bt BT_NXT";
    if (cmd === 2) return "&bt BT_PRV";
    if (cmd === 3) return `&bt BT_SEL ${binding.param2}`;
    if (cmd === 4) return "&bt BT_CLR_ALL";
    if (cmd === 5) return `&bt BT_DISC ${binding.param2}`;
    return `&bt /* cmd=${cmd} */`;
  }
  if (name === "External Power") return `&ext_power EP_TOG`;
  if (name === "Output Selection") {
    const out = binding.param1 === 0 ? "OUT_USB" : binding.param1 === 1 ? "OUT_BLE" : "OUT_TOG";
    return `&out ${out}`;
  }

  const shortName = name.replace(/\s+/g, "_").toLowerCase();
  return `/* &${shortName} ${binding.param1} ${binding.param2} */`;
}

function sanitizeLayerName(name: string, index: number): string {
  if (!name) return index === 0 ? "default_layer" : `layer_${index}`;
  const s = name.trim().replace(/[^A-Za-z0-9_]/g, "_");
  return /^[A-Za-z_]/.test(s) ? s : `layer_${s}`;
}

// ─────────────────────────────────────────────
// DTS parser — extracts re-usable parts from an existing keymap file
// ─────────────────────────────────────────────

export interface KeymapExtras {
  /** #include lines (as-is from original file) */
  includes: string;
  /** #define lines (as-is from original file) */
  defines: string;
  /** Top-level &name { ... }; configs like &mt, &lt */
  topBehaviorConfigs: string;
  /** combos { ... }; block from / { } (empty string if absent) */
  combos: string;
  /** macros { ... }; block from / { } (empty string if absent) */
  macros: string;
  /** behaviors { ... }; block from / { } (empty string if absent) */
  customBehaviors: string;
  /** sensor-bindings per layer index; empty string means no sensor-bindings */
  sensorBindings: string[];
  /** layer node names from the keymap block (for standalone mode) */
  layerNames: string[];
  /** full "keymap { ... };" block text for standalone export */
  rawKeymapBlock: string;
}

/**
 * Advance past a matching closing brace, skipping comments/strings.
 * `openPos` must point to the opening `{`.
 * Returns the index just after the `}`.
 */
function matchingBraceEnd(text: string, openPos: number): number {
  let depth = 1;
  let i = openPos + 1;
  while (i < text.length && depth > 0) {
    const ch = text[i];
    if (ch === '/' && text[i + 1] === '/') {
      // line comment
      const nl = text.indexOf('\n', i + 2);
      i = nl === -1 ? text.length : nl + 1;
    } else if (ch === '/' && text[i + 1] === '*') {
      // block comment
      const end = text.indexOf('*/', i + 2);
      i = end === -1 ? text.length : end + 2;
    } else if (ch === '"') {
      // string literal
      i++;
      while (i < text.length && text[i] !== '"') {
        if (text[i] === '\\') i++;
        i++;
      }
      i++;
    } else {
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      i++;
    }
  }
  return i;
}

/**
 * Extract the FULL block text for the first occurrence of a named DTS node
 * inside `text`, starting from `fromPos`.
 * Handles both `name {` and `label: name {` forms.
 * Returns null if not found.
 */
function extractNamedBlock(text: string, name: string, fromPos = 0): string | null {
  // Pattern: newline (or string start) + optional indent + optional "label:" + name + "{"
  // Use (?:^|\n) instead of lookbehind for broader JS engine compatibility
  const re = new RegExp(`(?:^|\\n)([ \\t]*)(?:[\\w_]+\\s*:\\s*)?${name}\\s*\\{`, 'g');
  re.lastIndex = fromPos;
  const m = re.exec(text);
  if (!m) return null;

  // Skip the leading '\n' so nodeStart points to the indented line
  const nodeStart = m.index === 0 ? 0 : m.index + 1;
  const openBrace = text.indexOf('{', m.index);
  const closePos = matchingBraceEnd(text, openBrace);

  let end = closePos;
  const after = text.slice(closePos).match(/^[ \t]*;/);
  if (after) end = closePos + after[0].length;

  return text.slice(nodeStart, end).trim();
}

/**
 * Extract all top-level `&name { ... };` behavior config blocks
 * (e.g. `&mt { ... };`, `&lt { ... };`) that appear BEFORE `/ {`.
 */
function extractTopBehaviorConfigs(text: string): string {
  const rootStart = text.search(/(?:^|\n)\s*\/\s*\{/);
  const scope = rootStart === -1 ? text : text.slice(0, rootStart);

  const blocks: string[] = [];
  const re = /(?:^|\n)([ \t]*)&[\w]+\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(scope)) !== null) {
    const openBrace = scope.indexOf('{', m.index);
    const closePos = matchingBraceEnd(scope, openBrace);
    let end = closePos;
    const after = scope.slice(closePos).match(/^[ \t]*;/);
    if (after) end = closePos + after[0].length;
    blocks.push(scope.slice(m.index + (m[1] ? 1 : 0), end).trim());
  }
  return blocks.join('\n\n');
}

/**
 * For each layer inside the `keymap { }` DTS block, extract the layer name
 * and `sensor-bindings = <...>;` line (or empty string if absent).
 * Layers are identified by containing a `bindings = <` property.
 */
function extractLayerData(keymapBlockText: string): {
  layerNames: string[];
  sensorBindings: string[];
} {
  const layerNames: string[] = [];
  const sensorBindings: string[] = [];
  let pos = 0;

  while (pos < keymapBlockText.length) {
    const bracePos = keymapBlockText.indexOf('{', pos);
    if (bracePos === -1) break;

    const before = keymapBlockText.slice(pos, bracePos).trimEnd();
    if (!/\w$/.test(before) || /=\s*$/.test(before)) {
      pos = bracePos + 1;
      continue;
    }

    const closePos = matchingBraceEnd(keymapBlockText, bracePos);
    const blockContent = keymapBlockText.slice(bracePos + 1, closePos - 1);

    if (/\bbindings\s*=\s*</.test(blockContent)) {
      const nameMatch = before.match(/(\w+)\s*$/);
      layerNames.push(nameMatch ? nameMatch[1] : `layer_${layerNames.length}`);
      const sbMatch = blockContent.match(/[ \t]*sensor-bindings\s*=\s*<[^>]+>\s*;/);
      sensorBindings.push(sbMatch ? sbMatch[0].trim() : "");
    }

    pos = closePos;
  }

  return { layerNames, sensorBindings };
}

/**
 * Replace or add/remove `sensor-bindings` lines in a raw keymap block string.
 * `overrides[i]` is the new sensor-bindings line (e.g. "sensor-bindings = <&scroll_up_down>;")
 * or empty string to remove the line for layer i.
 */
function replaceSensorBindingsInKeymapBlock(
  rawBlock: string,
  overrides: string[]
): string {
  const subs: { start: number; end: number; replacement: string }[] = [];
  let layerIdx = 0;
  let pos = 0;

  while (pos < rawBlock.length) {
    const bracePos = rawBlock.indexOf('{', pos);
    if (bracePos === -1) break;

    const before = rawBlock.slice(pos, bracePos).trimEnd();
    if (!/\w$/.test(before) || /=\s*$/.test(before)) {
      pos = bracePos + 1;
      continue;
    }

    const closePos = matchingBraceEnd(rawBlock, bracePos);
    const blockContent = rawBlock.slice(bracePos + 1, closePos - 1);

    if (/\bbindings\s*=\s*</.test(blockContent)) {
      const override = overrides[layerIdx] ?? '';
      const sbRe = /\n[ \t]*sensor-bindings\s*=[^\n]*;/;
      const sbMatch = sbRe.exec(blockContent);

      if (sbMatch) {
        const sbAbsStart = bracePos + 1 + sbMatch.index;
        const sbAbsEnd = sbAbsStart + sbMatch[0].length;
        if (override) {
          const indentM = sbMatch[0].match(/^(\n[ \t]*)/);
          const ind = indentM ? indentM[1] : '\n            ';
          subs.push({ start: sbAbsStart, end: sbAbsEnd, replacement: `${ind}${override}` });
        } else {
          subs.push({ start: sbAbsStart, end: sbAbsEnd, replacement: '' });
        }
      } else if (override) {
        const closeLineStart = rawBlock.lastIndexOf('\n', closePos - 2) + 1;
        const closingIndent = rawBlock.slice(closeLineStart, closePos - 1).match(/^([ \t]*)/)?.[1] ?? '        ';
        subs.push({
          start: closePos - 1,
          end: closePos - 1,
          replacement: `\n${closingIndent}    ${override}\n${closingIndent}`,
        });
      }
      layerIdx++;
    }
    pos = closePos;
  }

  subs.sort((a, b) => b.start - a.start);
  let result = rawBlock;
  for (const sub of subs) {
    result = result.slice(0, sub.start) + sub.replacement + result.slice(sub.end);
  }
  return result;
}

/**
 * Parse an existing mona2.keymap file and extract re-usable sections.
 * The returned extras can be passed to `generateKeymapFile` so the output
 * includes combos, macros, sensor-bindings, etc. from the original file.
 */
export function parseKeymapExtras(fileContent: string): KeymapExtras {
  // #include lines
  const includes = (fileContent.match(/^#include\s+.+$/gm) ?? []).join('\n');

  // #define lines
  const defines = (fileContent.match(/^#define\s+\S.*$/gm) ?? []).join('\n');

  // Top-level &name { }; configs
  const topBehaviorConfigs = extractTopBehaviorConfigs(fileContent);

  // Root / { } block
  const rootMatch = fileContent.match(/(?:^|\n)\s*\/\s*\{/);
  let combos = '', macros = '', customBehaviors = '';
  let sensorBindings: string[] = [];

  let layerNames: string[] = [];
  let rawKeymapBlock = '';

  if (rootMatch?.index !== undefined) {
    const rootBrace = fileContent.indexOf('{', rootMatch.index + rootMatch[0].length - 1);
    const rootEnd = matchingBraceEnd(fileContent, rootBrace);
    const rootInner = fileContent.slice(rootBrace + 1, rootEnd - 1);

    combos = extractNamedBlock(rootInner, 'combos') ?? '';
    macros = extractNamedBlock(rootInner, 'macros') ?? '';
    customBehaviors = extractNamedBlock(rootInner, 'behaviors') ?? '';

    const keymapBlock = extractNamedBlock(rootInner, 'keymap');
    if (keymapBlock) {
      rawKeymapBlock = keymapBlock;
      const keymapBrace = keymapBlock.indexOf('{');
      const keymapEnd = matchingBraceEnd(keymapBlock, keymapBrace);
      const keymapInner = keymapBlock.slice(keymapBrace + 1, keymapEnd - 1);
      const layerData = extractLayerData(keymapInner);
      sensorBindings = layerData.sensorBindings;
      layerNames = layerData.layerNames;
    }
  }

  return { includes, defines, topBehaviorConfigs, combos, macros, customBehaviors, sensorBindings, layerNames, rawKeymapBlock };
}

// ─────────────────────────────────────────────
// Generator
// ─────────────────────────────────────────────

/**
 * Generates a complete mona2.keymap DTS file.
 *
 * When `extras` is provided (parsed from an existing keymap), the output
 * includes the original combos, macros, behaviors, and sensor-bindings
 * automatically. Without extras, placeholder comments are emitted.
 *
 * moNa2 key order (42 keys):
 *   Row 1 (0-9):   L:0-4  R:5-9
 *   Row 2 (10-20): L:10-14  C:15  R:16-20
 *   Row 3 (21-32): L:21-25  C:26-27  R:28-32
 *   Row 4 (33-41): L:33-38  R:39-41
 */
export function generateKeymapFile(
  layers: KeymapLayer[],
  behaviors: Map<number, BehaviorDetails>,
  extras?: KeymapExtras,
  overrideCombos?: Combo[],
  overrideSensorBindings?: string[]
): string {
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);

  // ── Includes ──────────────────────────────────────────────────────────
  const includeLines = extras?.includes ?? [
    `#include <input/processors.dtsi>`,
    `#include <dt-bindings/zmk/input_transform.h>`,
    `#include <zephyr/dt-bindings/input/input-event-codes.h>`,
    `#include <behaviors.dtsi>`,
    `#include <dt-bindings/zmk/bt.h>`,
    `#include <dt-bindings/zmk/keys.h>`,
    `#include <dt-bindings/zmk/pointing.h>`,
  ].join('\n');

  // ── #define lines ─────────────────────────────────────────────────────
  const defineLines = extras?.defines ?? '#define ZMK_POINTING_DEFAULT_SCRL_VAL 100';

  // ── Top-level behavior configs (&mt, &lt, …) ─────────────────────────
  const topConfigs = extras?.topBehaviorConfigs ??
`&mt {
    flavor = "balanced";
    quick-tap-ms = <0>;
};

&lt {
    quick-tap-ms = <300>;
    flavor = "balanced";
};`;

  // ── Custom blocks (combos / macros / behaviors) ────────────────────────
  const rootInnerParts: string[] = [];

  // Combos: structured overrideCombos takes precedence over raw extras.combos
  let resolvedCombosText = '';
  if (overrideCombos !== undefined) {
    resolvedCombosText = generateCombosBlock(overrideCombos);
  } else {
    resolvedCombosText = extras?.combos ?? '';
  }

  const macrosText = extras?.macros ?? '';
  const customBehaviorsText = extras?.customBehaviors ?? '';

  if (resolvedCombosText) {
    rootInnerParts.push(indent(resolvedCombosText, 4));
  } else if (!extras && !overrideCombos) {
    // No original file loaded and no structured combos — emit placeholder
    rootInnerParts.push(
      `    /*\n` +
      `     * combos { compatible = "zmk,combos"; ... };\n` +
      `     * Add combos here.\n` +
      `     */`
    );
  }

  if (macrosText) rootInnerParts.push(indent(macrosText, 4));
  if (customBehaviorsText) rootInnerParts.push(indent(customBehaviorsText, 4));

  // sensor-bindings source: structured override takes precedence over extras
  const resolvedSensorBindings = overrideSensorBindings ?? extras?.sensorBindings ?? [];

  // ── Layer nodes ────────────────────────────────────────────────────────
  if (layers.length === 0 && extras?.rawKeymapBlock) {
    // Standalone mode: preserve original keymap block, update sensor-bindings
    const updatedBlock = overrideSensorBindings
      ? replaceSensorBindingsInKeymapBlock(extras.rawKeymapBlock, overrideSensorBindings)
      : extras.rawKeymapBlock;
    rootInnerParts.push(`    ${updatedBlock}`);
  } else {
    const layerNodes = layers.map((layer, idx) => {
      const nodeName = sanitizeLayerName(layer.name ?? "", idx);
      const bs = layer.bindings.map((b: KeyBinding) => bindingToZmkStr(b, behaviors));

      const r1 = formatRow([...bs.slice(0, 5), "    ", ...bs.slice(5, 10)]);
      const r2 = formatRow([...bs.slice(10, 15), "  ", bs[15] ?? "&none", "  ", ...bs.slice(16, 21)]);
      const r3 = formatRow([...bs.slice(21, 26), "  ", bs[26] ?? "&none", "  ", bs[27] ?? "&none", "  ", ...bs.slice(28, 33)]);
      const r4 = formatRow([...bs.slice(33, 39), "    ", ...bs.slice(39, 42)]);

      let sensorLine: string;
      if (overrideSensorBindings !== undefined || extras) {
        const sb = resolvedSensorBindings[idx] ?? '';
        sensorLine = sb ? `\n            ${sb}` : '';
      } else {
        sensorLine = `\n            /* sensor-bindings = <&scroll_up_down>; */`;
      }

      return [
        `        ${nodeName} {`,
        `            bindings = <`,
        r1,
        r2,
        r3,
        r4,
        `            >;`,
        sensorLine ? sensorLine : '',
        `        };`,
      ].filter(l => l !== '').join('\n');
    });

    rootInnerParts.push(
      `    keymap {\n        compatible = "zmk,keymap";\n\n` +
      layerNodes.join('\n\n') +
      `\n    };`
    );
  }

  // ── Assemble ──────────────────────────────────────────────────────────
  const hasOverrides = overrideCombos !== undefined || overrideSensorBindings !== undefined;
  const header = (extras || hasOverrides)
    ? `// Auto-generated by moNa2 Keymap Editor — ${now}\n// (sensor-bindings / combos / macros preserved from original file)`
    : `// Auto-generated by moNa2 Keymap Editor — ${now}\n//\n// Tip: click "既存ファイルから読み込む" to auto-include sensor-bindings & combos.`;

  return [
    header,
    '',
    includeLines,
    '',
    defineLines,
    '',
    topConfigs,
    '',
    `/ {`,
    rootInnerParts.join('\n\n'),
    `};`,
  ].join('\n');
}

function formatRow(parts: string[]): string {
  return "            " + parts.join("  ");
}

/** Re-indent a multi-line block by `spaces` spaces on each non-empty line. */
function indent(text: string, spaces: number): string {
  const pad = ' '.repeat(spaces);
  return text
    .split('\n')
    .map(l => (l.trim() ? pad + l : l))
    .join('\n');
}
