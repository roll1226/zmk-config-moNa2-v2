import keymapSource from "../../../boards/shields/mona2/mona2.keymap?raw";
import mona2LayoutSource from "../../../config/mona2.json";
import type { KeyboardLayout, Mona2Data } from "../types";
import { parseCombos, parseLayers, parseMacros } from "./parseKeymap";

interface Mona2JsonLayout {
  id: string;
  name: string;
  layouts: {
    default_layout: {
      layout: Array<{ row: number; col: number; x: number; y: number }>;
    };
  };
}

const source = mona2LayoutSource as Mona2JsonLayout;

const layout: KeyboardLayout = {
  id: source.id,
  name: source.name,
  keys: source.layouts.default_layout.layout,
};

export const loadMona2Data = (): Mona2Data => ({
  layout,
  layers: parseLayers(keymapSource),
  combos: parseCombos(keymapSource),
  macros: parseMacros(keymapSource),
});
