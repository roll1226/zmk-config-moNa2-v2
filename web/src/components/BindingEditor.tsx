import React, { useState } from "react";
import type { KeyBinding } from "../hooks/useKeymap";
import type { BehaviorDetails } from "../hooks/useBehaviors";
import type { BehaviorParameterValueDescription } from "@zmkfirmware/zmk-studio-ts-client/behaviors";
import { HID_LABELS } from "../utils/keyLabel";

interface BindingEditorProps {
  keyIndex: number;
  binding: KeyBinding | undefined;
  behaviors: Map<number, BehaviorDetails>;
  onApply: (binding: KeyBinding) => void;
  onClose: () => void;
}

type ParamKind = "key" | "layer" | "none";

const HID_PAGE_KEYBOARD = 7;

// ZMK modifier flag bit positions (bits 24-31 of binding param)
// Matches the HID modifier byte bit order.
const MODS = [
  { bit: 0x01, label: "L⌃", title: "Left Ctrl" },
  { bit: 0x02, label: "L⇧", title: "Left Shift" },
  { bit: 0x04, label: "L⌥", title: "Left Alt" },
  { bit: 0x08, label: "L⌘", title: "Left GUI" },
  { bit: 0x10, label: "R⌃", title: "Right Ctrl" },
  { bit: 0x20, label: "R⇧", title: "Right Shift" },
  { bit: 0x40, label: "R⌥", title: "Right Alt" },
  { bit: 0x80, label: "R⌘", title: "Right GUI" },
] as const;

function getParamKind(descs: BehaviorParameterValueDescription[]): ParamKind {
  for (const d of descs) {
    if (d.hidUsage !== undefined) return "key";
    if (d.layerId !== undefined) return "layer";
  }
  return "none";
}

function encodeHid(rawCode: number): number {
  return (HID_PAGE_KEYBOARD << 16) | rawCode;
}
function decodeHid(zmkUsage: number): number {
  return zmkUsage & 0xFFFF;  // bits 0-15 = HID usage ID (page bits are 16-23)
}
function getMods(zmkUsage: number): number {
  return (zmkUsage >>> 24) & 0xFF;  // bits 24-31 = modifier flags
}
function setMods(zmkUsage: number, modFlags: number): number {
  return ((modFlags & 0xFF) * 0x1000000) | (zmkUsage & 0x00FFFFFF);
}

// Build dropdown entries: values are full ZMK usage (no modifiers, keyboard page)
const hidEntries = Object.keys(HID_LABELS)
  .map((k) => {
    const rawCode = Number(k);
    return { zmkCode: encodeHid(rawCode), label: HID_LABELS[rawCode as keyof typeof HID_LABELS] ?? String(rawCode) };
  })
  .sort((a, b) => a.zmkCode - b.zmkCode);

const DEFAULT_KEY_ZMK = encodeHid(4); // 'A'

// Modifier checkboxes shown below any HID key selector
function ModifierRow({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const modBits = getMods(value);
  return (
    <div className="mt-1.5">
      <p className="text-gray-500 text-xs mb-1">修飾キー (同時押し)</p>
      <div className="flex flex-wrap gap-1.5">
        {MODS.map(({ bit, label, title }) => (
          <label
            key={bit}
            title={title}
            className={`flex items-center gap-1 px-2 py-1 rounded cursor-pointer text-xs select-none border transition-colors ${
              modBits & bit
                ? "bg-blue-700 border-blue-500 text-white"
                : "bg-gray-700 border-gray-600 text-gray-400 hover:border-gray-400"
            }`}
          >
            <input
              type="checkbox"
              className="hidden"
              checked={!!(modBits & bit)}
              onChange={() => onChange(setMods(value, modBits ^ bit))}
            />
            {label}
          </label>
        ))}
      </div>
    </div>
  );
}

export function BindingEditor({
  keyIndex,
  binding,
  behaviors,
  onApply,
  onClose,
}: BindingEditorProps) {
  const initialBehavior = behaviors.get(binding?.behaviorId ?? 0);
  const initialParamSet = initialBehavior?.metadata?.[0];
  const initialP1Kind = getParamKind(initialParamSet?.param1 ?? []);
  const initialP2Kind = getParamKind(initialParamSet?.param2 ?? []);

  const [behaviorId, setBehaviorId] = useState(binding?.behaviorId ?? 0);
  const [param1, setParam1] = useState(() =>
    initialP1Kind === "key" ? (binding?.param1 ?? DEFAULT_KEY_ZMK) : (binding?.param1 ?? 0)
  );
  const [param2, setParam2] = useState(() =>
    initialP2Kind === "key" ? (binding?.param2 ?? DEFAULT_KEY_ZMK) : (binding?.param2 ?? 0)
  );

  const sortedBehaviors = [...behaviors.values()].sort((a, b) =>
    a.displayName.localeCompare(b.displayName)
  );

  const selectedBehavior = behaviors.get(behaviorId);
  const paramSet = selectedBehavior?.metadata?.[0];
  const p1Descs: BehaviorParameterValueDescription[] = paramSet?.param1 ?? [];
  const p2Descs: BehaviorParameterValueDescription[] = paramSet?.param2 ?? [];
  const param1Kind = getParamKind(p1Descs);
  const param2Kind = getParamKind(p2Descs);

  const param1Label = p1Descs[0]?.name || (param1Kind === "layer" ? "レイヤー番号" : "キー");
  const param2Label = p2Descs[0]?.name || (param2Kind === "layer" ? "レイヤー番号" : "タップキー");

  const handleBehaviorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = Number(e.target.value);
    const newBehavior = behaviors.get(newId);
    const newParamSet = newBehavior?.metadata?.[0];
    const newP1Kind = getParamKind(newParamSet?.param1 ?? []);
    const newP2Kind = getParamKind(newParamSet?.param2 ?? []);
    setBehaviorId(newId);
    setParam1(newP1Kind === "key" ? DEFAULT_KEY_ZMK : 0);
    setParam2(newP2Kind === "key" ? DEFAULT_KEY_ZMK : 0);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl p-6 w-[26rem] max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-white font-bold text-lg">キー {keyIndex} の編集</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none">✕</button>
        </div>

        {/* Behavior picker */}
        <div className="mb-4">
          <label className="block text-gray-300 text-sm mb-1">ビヘイビア</label>
          <select
            value={behaviorId}
            onChange={handleBehaviorChange}
            className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm"
          >
            {sortedBehaviors.map((b) => (
              <option key={b.id} value={b.id}>{b.displayName}</option>
            ))}
          </select>
        </div>

        {/* Param 1 */}
        {param1Kind !== "none" && (
          <div className="mb-4">
            <label className="block text-gray-300 text-sm mb-1">{param1Label}</label>
            {param1Kind === "layer" ? (
              <input
                type="number" min={0} max={6} value={param1}
                onChange={(e) => setParam1(Number(e.target.value))}
                className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm"
              />
            ) : (
              <>
                <select
                  value={param1 & 0x00FFFFFF}  // strip modifier bits for matching
                  onChange={(e) => {
                    const base = Number(e.target.value);
                    setParam1(setMods(base, getMods(param1)));
                  }}
                  className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm"
                >
                  {hidEntries.map(({ zmkCode, label }) => (
                    <option key={zmkCode} value={zmkCode}>
                      {label} (0x{decodeHid(zmkCode).toString(16).padStart(2, "0")})
                    </option>
                  ))}
                </select>
                <ModifierRow value={param1} onChange={setParam1} />
              </>
            )}
          </div>
        )}

        {/* Param 2 */}
        {param2Kind !== "none" && (
          <div className="mb-4">
            <label className="block text-gray-300 text-sm mb-1">{param2Label}</label>
            {param2Kind === "layer" ? (
              <input
                type="number" min={0} max={6} value={param2}
                onChange={(e) => setParam2(Number(e.target.value))}
                className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm"
              />
            ) : (
              <>
                <select
                  value={param2 & 0x00FFFFFF}
                  onChange={(e) => {
                    const base = Number(e.target.value);
                    setParam2(setMods(base, getMods(param2)));
                  }}
                  className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm"
                >
                  {hidEntries.map(({ zmkCode, label }) => (
                    <option key={zmkCode} value={zmkCode}>
                      {label} (0x{decodeHid(zmkCode).toString(16).padStart(2, "0")})
                    </option>
                  ))}
                </select>
                <ModifierRow value={param2} onChange={setParam2} />
              </>
            )}
          </div>
        )}

        <div className="flex gap-2 mt-4">
          <button
            onClick={() => onApply({ behaviorId, param1, param2 })}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded transition-colors"
          >
            適用
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 rounded transition-colors"
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
}
