import React, { useState } from "react";
import type { KeyBinding } from "../hooks/useKeymap";
import type { BehaviorDetails } from "../hooks/useBehaviors";
import { HID_LABELS } from "../utils/hidLabels";

interface BindingEditorProps {
  keyIndex: number;
  binding: KeyBinding | undefined;
  behaviors: Map<number, BehaviorDetails>;
  onApply: (binding: KeyBinding) => void;
  onClose: () => void;
}

export function BindingEditor({
  keyIndex,
  binding,
  behaviors,
  onApply,
  onClose,
}: BindingEditorProps) {
  const [behaviorId, setBehaviorId] = useState(binding?.behaviorId ?? 0);
  const [param1, setParam1] = useState(binding?.param1 ?? 0);
  const [param2, setParam2] = useState(binding?.param2 ?? 0);

  const sortedBehaviors = [...behaviors.values()].sort((a, b) =>
    a.displayName.localeCompare(b.displayName)
  );

  const selectedBehavior = behaviors.get(behaviorId);
  const isKp =
    selectedBehavior?.displayName === "Key Press";
  const isLayerBased =
    selectedBehavior?.displayName === "Momentary Layer" ||
    selectedBehavior?.displayName === "Toggle Layer" ||
    selectedBehavior?.displayName === "Layer Tap";
  const hasParam2 =
    selectedBehavior?.displayName === "Layer Tap" ||
    selectedBehavior?.displayName === "Mod Tap";

  const hidEntries = Object.keys(HID_LABELS).map((k) => ({
    code: Number(k),
    label: HID_LABELS[Number(k) as keyof typeof HID_LABELS] ?? k,
  }));

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
              setBehaviorId(Number(e.target.value));
              setParam1(0);
              setParam2(0);
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

        {/* Param 1: HID key or layer number */}
        {(isKp || isLayerBased) && (
          <div className="mb-4">
            <label className="block text-gray-300 text-sm mb-1">
              {isLayerBased ? "レイヤー番号" : "キー"}
            </label>
            {isLayerBased ? (
              <input
                type="number"
                min={0}
                max={6}
                value={param1}
                onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setParam1(Number(e.target.value))}
                className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm"
              />
            ) : (
              <select
                value={param1}
                onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setParam1(Number(e.target.value))}
                className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm"
              >
                {hidEntries.map(({ code, label }) => (
                  <option key={code} value={code}>
                    {label} (0x{code.toString(16).padStart(2, "0")})
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Param 2: HID key for layer-tap / mod-tap */}
        {hasParam2 && (
          <div className="mb-4">
            <label className="block text-gray-300 text-sm mb-1">
              タップキー
            </label>
            <select
              value={param2}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setParam2(Number(e.target.value))}
              className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm"
            >
              {hidEntries.map(({ code, label }) => (
                <option key={code} value={code}>
                  {label} (0x{code.toString(16).padStart(2, "0")})
                </option>
              ))}
            </select>
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
