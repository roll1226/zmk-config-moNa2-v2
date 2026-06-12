import { useState } from "react";

interface Preset {
  label: string;
  value: string;
}

const PRESETS: Preset[] = [
  { label: "なし", value: "" },
  { label: "スクロール ↑↓ (scroll_up_down)", value: "sensor-bindings = <&scroll_up_down>;" },
  { label: "スクロール ←→ (scroll_right_left)", value: "sensor-bindings = <&scroll_right_left>;" },
  { label: "音量 ↑↓ (C_VOL)", value: "sensor-bindings = <&inc_dec_kp C_VOL_DN C_VOL_UP>;" },
  { label: "輝度 ↑↓ (C_BRI)", value: "sensor-bindings = <&inc_dec_kp C_BRI_DN C_BRI_UP>;" },
];
const CUSTOM_SENTINEL = "__custom__";

function presetKey(value: string): string {
  const p = PRESETS.find((p) => p.value === value);
  return p ? p.value : CUSTOM_SENTINEL;
}

interface LayerRowProps {
  layerIndex: number;
  layerName: string;
  value: string;
  onChange: (value: string) => void;
}

function LayerRow({ layerIndex, layerName, value, onChange }: LayerRowProps) {
  const [customText, setCustomText] = useState(
    presetKey(value) === CUSTOM_SENTINEL ? value : ""
  );
  const selected = presetKey(value);

  const handleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value;
    if (v === CUSTOM_SENTINEL) {
      onChange(customText);
    } else {
      onChange(v);
    }
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomText(e.target.value);
    onChange(e.target.value);
  };

  return (
    <div className="flex items-start gap-3 px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg">
      <div className="flex items-center gap-2 shrink-0 w-24">
        <span className="text-xs text-gray-400">L{layerIndex}</span>
        <span className="text-sm font-semibold text-white truncate">{layerName}</span>
      </div>
      <div className="flex-1 space-y-1.5">
        <select
          value={selected}
          onChange={handleSelect}
          className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-white focus:outline-none focus:border-blue-500"
        >
          {PRESETS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
          {selected === CUSTOM_SENTINEL && (
            <option value={CUSTOM_SENTINEL}>カスタム</option>
          )}
          {selected !== CUSTOM_SENTINEL && (
            <option value={CUSTOM_SENTINEL}>カスタム...</option>
          )}
        </select>
        {selected === CUSTOM_SENTINEL && (
          <input
            className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-white font-mono focus:outline-none focus:border-blue-500"
            value={customText}
            onChange={handleCustomChange}
            placeholder='sensor-bindings = <&inc_dec_kp A B>;'
          />
        )}
        {value && (
          <p className="text-xs text-gray-500 font-mono break-all">{value}</p>
        )}
      </div>
    </div>
  );
}

interface EncoderEditorPanelProps {
  sensorBindings: string[];
  layerNames: string[];
  onChange: (sensorBindings: string[]) => void;
}

export function EncoderEditorPanel({
  sensorBindings,
  layerNames,
  onChange,
}: EncoderEditorPanelProps) {
  const handleChange = (idx: number, value: string) => {
    const next = [...sensorBindings];
    while (next.length <= idx) next.push("");
    next[idx] = value;
    onChange(next);
  };

  if (layerNames.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 text-sm">
        .keymap ファイルを読み込むか、キーボードを接続してください
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-bold text-white">エンコーダー</h2>
        <p className="text-xs text-gray-400 mt-0.5">
          ロータリーエンコーダーのレイヤー別バインディングを設定します
        </p>
      </div>

      <div className="space-y-2">
        {layerNames.map((name, idx) => (
          <LayerRow
            key={idx}
            layerIndex={idx}
            layerName={name}
            value={sensorBindings[idx] ?? ""}
            onChange={(v) => handleChange(idx, v)}
          />
        ))}
      </div>
    </div>
  );
}
