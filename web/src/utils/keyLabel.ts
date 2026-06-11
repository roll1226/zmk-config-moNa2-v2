import type { KeyBinding } from "../hooks/useKeymap";
import type { BehaviorDetails } from "../hooks/useBehaviors";

// Raw HID keycode → display label (keyboard/keypad usage page)
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
  70: "PrtSc", 71: "ScrLk", 72: "Pause",
  73: "Ins", 74: "Home", 75: "PgUp",
  76: "Del", 77: "End", 78: "PgDn",
  79: "→", 80: "←", 81: "↓", 82: "↑",
  224: "L⌃", 225: "L⇧", 226: "L⌥", 227: "L⌘",
  228: "R⌃", 229: "R⇧", 230: "R⌥", 231: "R⌘",
};

export { HID_LABELS };

// ZMK encodes HID params as (usage_page << 16) | usage_id
// Extract the raw HID code (lower 16 bits) for lookup
function hidLabel(zmkUsage: number): string {
  const code = zmkUsage & 0xFFFF;
  return HID_LABELS[code] ?? `0x${code.toString(16)}`;
}

export function getKeyLabel(
  binding: KeyBinding,
  behaviors: Map<number, BehaviorDetails>
): string {
  const behavior = behaviors.get(binding.behaviorId);
  const name = behavior?.displayName ?? "";

  if (!name || name === "None") return "";
  if (name === "Transparent") return "▽";

  if (name === "Key Press") {
    return hidLabel(binding.param1);
  }
  if (name === "Layer-Tap" || name === "Layer Tap") {
    return `L${binding.param1}/${hidLabel(binding.param2)}`;
  }
  if (name === "Momentary Layer") return `MO(${binding.param1})`;
  if (name === "Toggle Layer") return `TG(${binding.param1})`;
  if (name === "To Layer") return `TO(${binding.param1})`;
  if (name === "Mod-Tap" || name === "Mod Tap") {
    return `${hidLabel(binding.param1)}/${hidLabel(binding.param2)}`;
  }
  if (name === "Bluetooth") return "BT";
  if (name === "Mouse Key Press" || name === "Mouse Button") return `MB${binding.param1}`;
  if (name === "Reset") return "RST";
  if (name === "Bootloader") return "BOOT";
  if (name === "Sticky Key") return `SK`;
  if (name === "Sticky Layer") return `SL(${binding.param1})`;
  if (name === "Studio Unlock") return "🔓";
  if (name === "Caps Word") return "CAPS";
  if (name === "Key Repeat") return "RPT";
  if (name === "Grave/Escape") return "GRV";
  if (name === "External Power") return "PWR";
  if (name === "Output Selection") return "OUT";

  return name.length > 6 ? name.slice(0, 5) + "…" : name;
}
