import { useState } from "react";
import { HID_LABELS } from "../utils/keyLabel";

export const PICKER_DRAG_TYPE = "application/x-zmk-picker";

const MOD_DEFS = [
  { bit: 0x01, label: "L⌃", title: "Left Ctrl" },
  { bit: 0x02, label: "L⇧", title: "Left Shift" },
  { bit: 0x04, label: "L⌥", title: "Left Alt" },
  { bit: 0x08, label: "L⌘", title: "Left GUI" },
  { bit: 0x10, label: "R⌃", title: "Right Ctrl" },
  { bit: 0x20, label: "R⇧", title: "Right Shift" },
  { bit: 0x40, label: "R⌥", title: "Right Alt" },
  { bit: 0x80, label: "R⌘", title: "Right GUI" },
] as const;

// Key groups: only HID keyboard page (page 7) codes
const KEY_GROUPS: { label: string; keys: number[] }[] = [
  {
    label: "文字",
    keys: [4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29],
  },
  {
    label: "数字・記号",
    keys: [30,31,32,33,34,35,36,37,38,39,45,46,47,48,49,51,52,53,54,55,56],
  },
  {
    label: "特殊",
    keys: [40,41,42,43,44,57], // Enter Esc Backspace Tab Space CapsLock
  },
  {
    label: "F キー",
    keys: [58,59,60,61,62,63,64,65,66,67,68,69],
  },
  {
    label: "矢印・ナビ",
    keys: [79,80,81,82,74,77,75,78,73,76,70,71,72],
  },
  {
    label: "修飾キー (単独)",
    keys: [224,225,226,227,228,229,230,231],
  },
];

interface KeyPickerPanelProps {
  disabled?: boolean;
}

export function KeyPickerPanel({ disabled }: KeyPickerPanelProps) {
  const [activeMods, setActiveMods] = useState(0);

  const toggleMod = (bit: number) => setActiveMods((prev) => prev ^ bit);
  const clearMods = () => setActiveMods(0);

  const activeModLabels = MOD_DEFS
    .filter(({ bit }) => activeMods & bit)
    .map(({ label }) => label)
    .join("+");

  return (
    <div className={`mt-4 p-4 bg-gray-800 border border-gray-700 rounded-lg ${disabled ? "opacity-40 pointer-events-none" : ""}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-300">キーパレット</h3>
        <p className="text-xs text-gray-500">キーをドラッグ → キーボードに割り当て</p>
      </div>

      {/* Modifier toggles */}
      <div className="flex items-center gap-2 mb-3 pb-3 border-b border-gray-700">
        <span className="text-xs text-gray-400 shrink-0">修飾キー:</span>
        <div className="flex flex-wrap gap-1.5">
          {MOD_DEFS.map(({ bit, label, title }) => (
            <button
              key={bit}
              title={title}
              onClick={() => toggleMod(bit)}
              className={`px-2.5 py-0.5 rounded text-xs font-mono border transition-colors select-none ${
                activeMods & bit
                  ? "bg-blue-700 border-blue-400 text-white"
                  : "bg-gray-700 border-gray-600 text-gray-400 hover:border-gray-400 hover:text-gray-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {activeMods !== 0 && (
          <button
            onClick={clearMods}
            className="text-xs text-red-400 hover:text-red-300 shrink-0"
          >
            クリア
          </button>
        )}
      </div>

      {/* Key groups */}
      <div className="space-y-3">
        {KEY_GROUPS.map(({ label, keys }) => (
          <div key={label}>
            <div className="text-[11px] text-gray-500 mb-1.5 font-medium">{label}</div>
            <div className="flex flex-wrap gap-1">
              {keys.map((rawCode) => {
                const keyLabel = HID_LABELS[rawCode as keyof typeof HID_LABELS];
                if (!keyLabel) return null;
                const withMods = activeMods !== 0;
                const title = withMods ? `${activeModLabels}+${keyLabel}` : keyLabel;
                return (
                  <div
                    key={rawCode}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "copy";
                      e.dataTransfer.setData(
                        PICKER_DRAG_TYPE,
                        JSON.stringify({ rawCode, mods: activeMods })
                      );
                    }}
                    title={title}
                    className={`px-2 py-1 min-w-[28px] text-center rounded border text-xs font-mono
                      cursor-grab active:cursor-grabbing select-none transition-colors ${
                      withMods
                        ? "bg-blue-900/60 border-blue-700 text-blue-200 hover:bg-blue-800/80 hover:border-blue-500"
                        : "bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600 hover:border-gray-400"
                    }`}
                  >
                    {keyLabel}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
