import type { KeyBinding } from "../hooks/useKeymap";
import type { BehaviorDetails } from "../hooks/useBehaviors";


// HID usage → display label (common keys)
const HID_LABELS: Record<number, string> = {
  4: "A", 5: "B", 6: "C", 7: "D", 8: "E", 9: "F", 10: "G", 11: "H",
  12: "I", 13: "J", 14: "K", 15: "L", 16: "M", 17: "N", 18: "O", 19: "P",
  20: "Q", 21: "R", 22: "S", 23: "T", 24: "U", 25: "V", 26: "W", 27: "X",
  28: "Y", 29: "Z",
  30: "1", 31: "2", 32: "3", 33: "4", 34: "5",
  35: "6", 36: "7", 37: "8", 38: "9", 39: "0",
  40: "↵", 41: "ESC", 42: "⌫", 43: "⇥", 44: "SPC",
  45: "-", 46: "=", 47: "[", 48: "]", 49: "\\",
  51: ";", 52: "'", 53: "`", 54: ",", 55: ".", 56: "/",
  57: "CAPS",
  58: "F1", 59: "F2", 60: "F3", 61: "F4", 62: "F5", 63: "F6",
  64: "F7", 65: "F8", 66: "F9", 67: "F10", 68: "F11", 69: "F12",
  79: "→", 80: "←", 81: "↓", 82: "↑",
  224: "L⌃", 225: "L⇧", 226: "L⌥", 227: "L⌘",
  228: "R⌃", 229: "R⇧", 230: "R⌥", 231: "R⌘",
};

export function getKeyLabel(
  binding: KeyBinding,
  behaviors: Map<number, BehaviorDetails>
): string {
  const behavior = behaviors.get(binding.behaviorId);
  const name = behavior?.displayName ?? "";

  if (!name || name === "None") return "";
  if (name === "Transparent") return "▽";

  if (name === "Key Press") {
    return HID_LABELS[binding.param1] ?? `0x${binding.param1.toString(16)}`;
  }
  if (name === "Layer Tap") {
    const key = HID_LABELS[binding.param2] ?? `0x${binding.param2.toString(16)}`;
    return `L${binding.param1}/${key}`;
  }
  if (name === "Momentary Layer" || name === "Toggle Layer") {
    const prefix = name === "Toggle Layer" ? "TG" : "MO";
    return `${prefix}(${binding.param1})`;
  }
  if (name === "Mod Tap") {
    const key = HID_LABELS[binding.param2] ?? `0x${binding.param2.toString(16)}`;
    return `MT/${key}`;
  }
  if (name === "Bluetooth") return "BT";
  if (name === "Mouse Button") return `MB${binding.param1}`;
  if (name === "Reset") return "RST";
  if (name === "Bootloader") return "BOOT";

  // Abbreviate long names
  return name.length > 6 ? name.slice(0, 5) + "…" : name;
}
