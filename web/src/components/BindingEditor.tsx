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

// ZMK keyboard/keypad HID usage page
const HID_PAGE_KEYBOARD = 7;

function getParamKind(descs: BehaviorParameterValueDescription[]): ParamKind {
  for (const d of descs) {
    if (d.hidUsage !== undefined) return "key";
    if (d.layerId !== undefined) return "layer";
  }
  return "none";
}

// ZMK encodes HID params as (usage_page << 16) | raw_code.
// These helpers convert between raw HID codes and ZMK usage values.
function encodeHid(rawCode: number): number {
  return (HID_PAGE_KEYBOARD << 16) | rawCode;
}
function decodeHid(zmkUsage: number): number {
  return zmkUsage & 0xFFFF;
}

// Build dropdown entries as full ZMK usage values so the <select> value
// matches what is stored in bindings and what is sent to firmware.
const hidEntries = Object.keys(HID_LABELS)
  .map((k) => {
    const rawCode = Number(k);
    return {
      zmkCode: encodeHid(rawCode),
      label: HID_LABELS[rawCode as keyof typeof HID_LABELS] ?? String(rawCode),
    };
  })
  .sort((a, b) => a.zmkCode - b.zmkCode);

const DEFAULT_KEY_ZMK = encodeHid(4); // 'A' as default when resetting a key param

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
  // For key params, the binding stores full ZMK usage (page<<16|code).
  // Keep them as-is — the hidEntries select uses zmkCode as values.
  const [param1, setParam1] = useState(() =>
    initialP1Kind === "key"
      ? (binding?.param1 ?? DEFAULT_KEY_ZMK)
      : (binding?.param1 ?? 0)
  );
  const [param2, setParam2] = useState(() =>
    initialP2Kind === "key"
      ? (binding?.param2 ?? DEFAULT_KEY_ZMK)
      : (binding?.param2 ?? 0)
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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl p-6 w-96 shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-white font-bold text-lg">
            キー {keyIndex} の編集
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Behavior picker */}
        <div className="mb-4">
          <label className="block text-gray-300 text-sm mb-1">ビヘイビア</label>
          <select
            value={behaviorId}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
              const newId = Number(e.target.value);
              const newBehavior = behaviors.get(newId);
              const newParamSet = newBehavior?.metadata?.[0];
              const newP1Kind = getParamKind(newParamSet?.param1 ?? []);
              const newP2Kind = getParamKind(newParamSet?.param2 ?? []);
              setBehaviorId(newId);
              setParam1(newP1Kind === "key" ? DEFAULT_KEY_ZMK : 0);
              setParam2(newP2Kind === "key" ? DEFAULT_KEY_ZMK : 0);
            }}
            className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm"
          >
            {sortedBehaviors.map((b) => (
              <option key={b.id} value={b.id}>
                {b.displayName}
              </option>
            ))}
          </select>
        </div>

        {/* Param 1 */}
        {param1Kind !== "none" && (
          <div className="mb-4">
            <label className="block text-gray-300 text-sm mb-1">{param1Label}</label>
            {param1Kind === "layer" ? (
              <input
                type="number"
                min={0}
                max={6}
                value={param1}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setParam1(Number(e.target.value))}
                className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm"
              />
            ) : (
              <select
                value={param1}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setParam1(Number(e.target.value))}
                className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm"
              >
                {hidEntries.map(({ zmkCode, label }) => (
                  <option key={zmkCode} value={zmkCode}>
                    {label} (0x{decodeHid(zmkCode).toString(16).padStart(2, "0")})
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Param 2 */}
        {param2Kind !== "none" && (
          <div className="mb-4">
            <label className="block text-gray-300 text-sm mb-1">{param2Label}</label>
            {param2Kind === "layer" ? (
              <input
                type="number"
                min={0}
                max={6}
                value={param2}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setParam2(Number(e.target.value))}
                className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm"
              />
            ) : (
              <select
                value={param2}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setParam2(Number(e.target.value))}
                className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm"
              >
                {hidEntries.map(({ zmkCode, label }) => (
                  <option key={zmkCode} value={zmkCode}>
                    {label} (0x{decodeHid(zmkCode).toString(16).padStart(2, "0")})
                  </option>
                ))}
              </select>
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
