import { useEffect, useRef, useState } from "react";
import type { KeymapLayer } from "../hooks/useKeymap";
import type { BehaviorDetails } from "../hooks/useBehaviors";
import {
  generateKeymapFile,
  parseKeymapExtras,
  type KeymapExtras,
} from "../utils/keymapExport";

interface KeymapExportModalProps {
  layers: KeymapLayer[];
  behaviors: Map<number, BehaviorDetails>;
  onClose: () => void;
}

export function KeymapExportModal({
  layers,
  behaviors,
  onClose,
}: KeymapExportModalProps) {
  const [extras, setExtras] = useState<KeymapExtras | null>(null);
  const [loadedFileName, setLoadedFileName] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const content = generateKeymapFile(layers, behaviors, extras ?? undefined);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleLoadOriginal = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result;
      if (typeof text !== "string") return;
      try {
        const parsed = parseKeymapExtras(text);
        setExtras(parsed);
        setLoadedFileName(file.name);
        setParseError(null);
      } catch (err) {
        setParseError(`パースに失敗しました: ${String(err)}`);
      }
    };
    reader.readAsText(file);
    // Reset so the same file can be re-loaded
    e.target.value = "";
  };

  const handleClearOriginal = () => {
    setExtras(null);
    setLoadedFileName(null);
    setParseError(null);
  };

  const handleCopy = () => {
    void navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mona2.keymap";
    a.click();
    URL.revokeObjectURL(url);
  };

  const statsSummary = extras
    ? [
        extras.combos ? "combos ✓" : "",
        extras.macros ? "macros ✓" : "",
        extras.customBehaviors ? "behaviors ✓" : "",
        extras.sensorBindings.filter(Boolean).length > 0
          ? `sensor-bindings ${extras.sensorBindings.filter(Boolean).length} layers ✓`
          : "",
      ]
        .filter(Boolean)
        .join(" / ")
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-gray-900 border border-gray-600 rounded-xl w-[90vw] max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <div>
            <h2 className="text-lg font-bold text-white">キーマップエクスポート</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              このファイルで{" "}
              <code className="bg-gray-800 px-1 rounded">config/mona2.keymap</code>{" "}
              を置き換えてリビルド
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl leading-none px-2 py-1"
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>

        {/* Original file loader */}
        <div className="px-5 py-3 border-b border-gray-700 bg-gray-800/50">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs text-gray-400 shrink-0">
              sensor-bindings / combos を自動取り込み:
            </span>
            {loadedFileName ? (
              <>
                <span className="text-xs text-green-400 font-mono">
                  {loadedFileName}
                </span>
                {statsSummary && (
                  <span className="text-xs text-green-300 opacity-70">
                    ({statsSummary})
                  </span>
                )}
                <button
                  onClick={handleLoadOriginal}
                  className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 border border-gray-500 rounded transition-colors"
                >
                  再読み込み
                </button>
                <button
                  onClick={handleClearOriginal}
                  className="px-3 py-1 text-xs bg-red-900/50 hover:bg-red-800/70 border border-red-700 rounded text-red-300 transition-colors"
                >
                  クリア
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleLoadOriginal}
                  className="px-3 py-1.5 text-xs font-semibold bg-blue-700 hover:bg-blue-600 rounded transition-colors"
                >
                  既存の mona2.keymap を読み込む
                </button>
                <span className="text-xs text-gray-500">
                  読み込むと combos・sensor-bindings・macros が自動でマージされます
                </span>
              </>
            )}
          </div>
          {parseError && (
            <p className="mt-2 text-xs text-red-400">{parseError}</p>
          )}
        </div>

        {/* Instructions */}
        <div className="px-5 py-2 bg-yellow-900/20 border-b border-yellow-800/40 text-xs text-yellow-300">
          <span>
            手順: ① 上で既存ファイルを読み込む → ② ダウンロードまたはコピー →{" "}
            ③{" "}
            <code className="bg-black/30 px-1 rounded">config/mona2.keymap</code>{" "}
            を置き換え → ④ push してリビルド
          </span>
        </div>

        {/* Generated content */}
        <textarea
          ref={textareaRef}
          readOnly
          value={content}
          className="flex-1 min-h-0 p-4 bg-gray-950 text-gray-200 font-mono text-xs resize-none outline-none overflow-auto"
          spellCheck={false}
          onClick={() => textareaRef.current?.select()}
        />

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-700">
          <span className="text-xs text-gray-500">
            {layers.length} レイヤー /{" "}
            {layers.reduce((s, l) => s + l.bindings.length, 0)} バインディング
            {extras && " / 既存ファイルから取り込み済み"}
          </span>
          <div className="flex gap-3">
            <button
              onClick={handleDownload}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-sm font-semibold rounded transition-colors"
            >
              ダウンロード (.keymap)
            </button>
            <button
              onClick={handleCopy}
              className={`px-4 py-1.5 text-sm font-semibold rounded transition-colors ${
                copied
                  ? "bg-green-700 text-white"
                  : "bg-gray-600 hover:bg-gray-500 text-white"
              }`}
            >
              {copied ? "コピーしました!" : "クリップボードにコピー"}
            </button>
          </div>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".keymap,.conf,.txt"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
