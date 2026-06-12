import { useState } from "react";
import type { Combo } from "../types/combo";
import { MONA2_KEYS, UNIT_PX } from "../layout/mona2-layout";

// Default labels for each key position (based on default layer)
const KEY_LABELS: Record<number, string> = {
  0: "Q", 1: "W", 2: "E", 3: "R", 4: "T",
  5: "Y", 6: "U", 7: "I", 8: "O", 9: "P",
  10: "A", 11: "S", 12: "D", 13: "F", 14: "G",
  15: "—", 16: "H", 17: "J", 18: "K", 19: "L", 20: ";",
  21: "Z", 22: "X", 23: "C", 24: "V", 25: "B", 26: "⌃",
  27: "—", 28: "N", 29: "M", 30: ",", 31: ".", 32: "/",
  33: "⇧", 34: "RC", 35: "LC", 36: "⌘", 37: "L1", 38: "SPC",
  39: "↵", 40: "L2", 41: "⌥",
};
const NON_SELECTABLE = new Set([15, 27]);

const SCALE = 0.5;
const MINI_UNIT = Math.round(UNIT_PX * SCALE);
const MINI_KEY = MINI_UNIT - 2;

interface KeyPositionPickerProps {
  selected: number[];
  onChange: (positions: number[]) => void;
}

function KeyPositionPicker({ selected, onChange }: KeyPositionPickerProps) {
  const toggle = (idx: number) => {
    if (NON_SELECTABLE.has(idx)) return;
    onChange(
      selected.includes(idx) ? selected.filter((p) => p !== idx) : [...selected, idx]
    );
  };

  const boardW = (12 + 1) * MINI_UNIT;
  const boardH = (4 + 1) * MINI_UNIT;

  return (
    <div>
      <div className="relative" style={{ width: boardW, height: boardH }}>
        {MONA2_KEYS.map((kp, i) => {
          const isSelected = selected.includes(i);
          const isNone = NON_SELECTABLE.has(i);
          return (
            <button
              key={i}
              type="button"
              onClick={() => toggle(i)}
              disabled={isNone}
              title={isNone ? undefined : `pos ${i}: ${KEY_LABELS[i] ?? "?"}`}
              style={{
                position: "absolute",
                left: kp.x * MINI_UNIT,
                top: kp.y * MINI_UNIT,
                width: MINI_KEY,
                height: MINI_KEY,
                fontSize: 9,
                lineHeight: 1,
              }}
              className={[
                "flex items-center justify-center rounded border text-center transition-colors",
                isNone
                  ? "border-gray-800 bg-gray-900 text-gray-700 cursor-default"
                  : isSelected
                  ? "border-blue-400 bg-blue-600 text-white font-bold cursor-pointer"
                  : "border-gray-600 bg-gray-700 hover:bg-gray-600 text-gray-300 cursor-pointer",
              ].join(" ")}
            >
              {isNone ? "" : (KEY_LABELS[i] ?? i)}
            </button>
          );
        })}
      </div>
      <p className="mt-1 text-xs text-gray-500">
        選択中: {selected.length === 0 ? "なし" : selected.map((p) => `${p}(${KEY_LABELS[p] ?? p})`).join(", ")}
      </p>
    </div>
  );
}

const EMPTY_FORM: Omit<Combo, "id"> = {
  name: "",
  binding: "",
  keyPositions: [],
  timeoutMs: 200,
  layers: undefined,
  requirePriorIdleMs: undefined,
};

interface ComboFormProps {
  initial: Omit<Combo, "id">;
  layerCount: number;
  onSave: (c: Omit<Combo, "id">) => void;
  onCancel: () => void;
}

function ComboForm({ initial, layerCount, onSave, onCancel }: ComboFormProps) {
  const [form, setForm] = useState<Omit<Combo, "id">>(initial);
  const [layerText, setLayerText] = useState(
    initial.layers !== undefined ? initial.layers.join(" ") : ""
  );
  const [idleText, setIdleText] = useState(
    initial.requirePriorIdleMs !== undefined ? String(initial.requirePriorIdleMs) : ""
  );

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSave = () => {
    if (!form.name.trim()) return alert("名前を入力してください");
    if (!form.binding.trim()) return alert("バインディングを入力してください");
    if (form.keyPositions.length < 2) return alert("キー位置を2つ以上選択してください");

    const parsedLayers = layerText.trim()
      ? layerText.trim().split(/\s+/).map(Number).filter((n) => !isNaN(n))
      : undefined;
    const parsedIdle = idleText.trim() ? parseInt(idleText) : undefined;

    onSave({
      ...form,
      layers: parsedLayers,
      requirePriorIdleMs: isNaN(parsedIdle ?? NaN) ? undefined : parsedIdle,
    });
  };

  const allLayerIndices = Array.from({ length: layerCount }, (_, i) => i);

  return (
    <div className="space-y-3 p-4 bg-gray-800 border border-gray-600 rounded-lg">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">名前 *</label>
          <input
            className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-white focus:outline-none focus:border-blue-500"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="myCombo"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">バインディング *</label>
          <input
            className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-white font-mono focus:outline-none focus:border-blue-500"
            value={form.binding}
            onChange={(e) => set("binding", e.target.value)}
            placeholder="&kp SINGLE_QUOTE"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">タイムアウト (ms) *</label>
          <input
            type="number"
            min={1}
            max={5000}
            className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-white focus:outline-none focus:border-blue-500"
            value={form.timeoutMs}
            onChange={(e) => set("timeoutMs", parseInt(e.target.value) || 200)}
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">require-prior-idle-ms (任意)</label>
          <input
            type="number"
            min={0}
            className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-white focus:outline-none focus:border-blue-500"
            value={idleText}
            onChange={(e) => setIdleText(e.target.value)}
            placeholder="500"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1">
          有効レイヤー (任意 — 空白 = 全レイヤー)
        </label>
        <div className="flex gap-2 flex-wrap mb-1">
          {allLayerIndices.map((idx) => {
            const nums = layerText.trim() ? layerText.trim().split(/\s+/).map(Number) : [];
            const active = nums.includes(idx);
            return (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  const next = active ? nums.filter((n) => n !== idx) : [...nums, idx].sort((a,b)=>a-b);
                  setLayerText(next.join(" "));
                }}
                className={`px-2 py-0.5 text-xs rounded border transition-colors ${
                  active
                    ? "bg-blue-600 border-blue-400 text-white"
                    : "bg-gray-700 border-gray-500 text-gray-300 hover:bg-gray-600"
                }`}
              >
                {idx}
              </button>
            );
          })}
        </div>
        <input
          className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-white font-mono focus:outline-none focus:border-blue-500"
          value={layerText}
          onChange={(e) => setLayerText(e.target.value)}
          placeholder="0 1 2"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-2">キー位置 * (2つ以上クリックして選択)</label>
        <KeyPositionPicker
          selected={form.keyPositions}
          onChange={(p) => set("keyPositions", p)}
        />
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={handleSave}
          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-sm font-semibold rounded transition-colors"
        >
          保存
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-1.5 bg-gray-600 hover:bg-gray-500 text-sm rounded transition-colors"
        >
          キャンセル
        </button>
      </div>
    </div>
  );
}

interface ComboEditorPanelProps {
  combos: Combo[];
  onChange: (combos: Combo[]) => void;
  layerCount: number;
}

export function ComboEditorPanel({ combos, onChange, layerCount }: ComboEditorPanelProps) {
  const [editing, setEditing] = useState<string | "new" | null>(null);

  const handleSave = (id: string | "new", data: Omit<Combo, "id">) => {
    if (id === "new") {
      onChange([...combos, { id: Math.random().toString(36).slice(2), ...data }]);
    } else {
      onChange(combos.map((c) => (c.id === id ? { ...c, ...data } : c)));
    }
    setEditing(null);
  };

  const handleDelete = (id: string) => {
    if (!confirm("このコンボを削除しますか？")) return;
    onChange(combos.filter((c) => c.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white">コンボ</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            複数キーを同時押しで発動するバインディングを設定します
          </p>
        </div>
        {editing === null && (
          <button
            onClick={() => setEditing("new")}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-sm font-semibold rounded transition-colors"
          >
            + 追加
          </button>
        )}
      </div>

      {editing === "new" && (
        <ComboForm
          initial={{ ...EMPTY_FORM }}
          layerCount={layerCount}
          onSave={(data) => handleSave("new", data)}
          onCancel={() => setEditing(null)}
        />
      )}

      {combos.length === 0 && editing !== "new" && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-sm">コンボが登録されていません</p>
          <p className="text-xs mt-1">
            「+ 追加」で新しいコンボを作成するか、ヘッダーの「.keymap を読み込む」で既存ファイルを読み込んでください
          </p>
        </div>
      )}

      <div className="space-y-2">
        {combos.map((combo) => (
          <div key={combo.id}>
            {editing === combo.id ? (
              <ComboForm
                initial={{
                  name: combo.name,
                  binding: combo.binding,
                  keyPositions: combo.keyPositions,
                  timeoutMs: combo.timeoutMs,
                  layers: combo.layers,
                  requirePriorIdleMs: combo.requirePriorIdleMs,
                }}
                layerCount={layerCount}
                onSave={(data) => handleSave(combo.id, data)}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <div className="flex items-start gap-3 px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg hover:border-gray-600 transition-colors">
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono font-semibold text-white">{combo.name}</span>
                    <span className="text-xs font-mono text-blue-300 bg-blue-900/40 px-1.5 rounded">
                      {combo.binding}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 font-mono">
                    pos: [{combo.keyPositions.map((p) => `${p}(${KEY_LABELS[p] ?? p})`).join(", ")}]
                    {" "}&nbsp;·&nbsp;{combo.timeoutMs}ms
                    {combo.layers !== undefined && (
                      <> &nbsp;·&nbsp; layers: [{combo.layers.join(", ")}]</>
                    )}
                    {combo.requirePriorIdleMs !== undefined && (
                      <> &nbsp;·&nbsp; idle: {combo.requirePriorIdleMs}ms</>
                    )}
                  </div>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    onClick={() => setEditing(combo.id)}
                    className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded transition-colors"
                  >
                    編集
                  </button>
                  <button
                    onClick={() => handleDelete(combo.id)}
                    className="px-2 py-1 text-xs bg-red-900/50 hover:bg-red-800/70 border border-red-700 text-red-300 rounded transition-colors"
                  >
                    削除
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
