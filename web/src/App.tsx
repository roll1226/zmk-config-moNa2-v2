import { useState, useCallback, useEffect, useRef } from "react";
import {
  connectViaUSB,
  connectViaBluetooth,
  type RpcConnection,
} from "./rpc/connection";
import { useKeymap } from "./hooks/useKeymap";
import { useBehaviors } from "./hooks/useBehaviors";
import { ConnectButton } from "./components/ConnectButton";
import { LayerTabs } from "./components/LayerTabs";
import { KeyboardLayout } from "./components/KeyboardLayout";
import { BindingEditor } from "./components/BindingEditor";
import { KeyPickerPanel } from "./components/KeyPickerPanel";
import { KeymapExportModal } from "./components/KeymapExportModal";
import { ComboEditorPanel } from "./components/ComboEditorPanel";
import { EncoderEditorPanel } from "./components/EncoderEditorPanel";
import type { KeyBinding, KeymapLayer } from "./hooks/useKeymap";
import type { KeymapExtras } from "./utils/keymapExport";
import { parseKeymapExtras } from "./utils/keymapExport";
import type { Combo } from "./types/combo";
import { parseCombosBlock } from "./utils/comboParser";

const HID_PAGE_KEYBOARD = 7;

const SERIAL_AVAILABLE =
  typeof navigator !== "undefined" && "serial" in navigator;
const BLUETOOTH_AVAILABLE =
  typeof navigator !== "undefined" &&
  "bluetooth" in navigator &&
  typeof (navigator as unknown as { bluetooth?: unknown }).bluetooth !== "undefined";

type MainTab = "keymap" | "combos" | "encoders";

const STORAGE_KEY_COMBOS = "mona2_combos";
const STORAGE_KEY_SENSOR = "mona2_sensor_bindings";

const DEFAULT_LAYER_NAMES = ["default", "lower", "raise", "adjust"];

export default function App() {
  const [conn, setConn] = useState<RpcConnection | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [connectedVia, setConnectedVia] = useState<"usb" | "bluetooth" | null>(null);
  const [activeLayer, setActiveLayer] = useState(0);
  const [selectedKey, setSelectedKey] = useState<number | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [mainTab, setMainTab] = useState<MainTab>("combos");

  const [keymapExtras, setKeymapExtras] = useState<KeymapExtras | null>(null);
  const [combos, setCombos] = useState<Combo[]>([]);
  const [sensorBindings, setSensorBindings] = useState<string[]>([]);
  const [loadedFileName, setLoadedFileName] = useState<string | null>(null);

  const standaloneFileInputRef = useRef<HTMLInputElement>(null);

  const { layers, loading, error, unsaved, updateBinding, swapBindings, save, discard } =
    useKeymap(conn);
  const { behaviors, loading: behaviorsLoading, error: behaviorsError } = useBehaviors(conn);

  // localStorage restore on mount
  useEffect(() => {
    const savedCombos = localStorage.getItem(STORAGE_KEY_COMBOS);
    const savedSensor = localStorage.getItem(STORAGE_KEY_SENSOR);
    if (savedCombos) {
      try { setCombos(JSON.parse(savedCombos) as Combo[]); } catch { /* ignore */ }
    }
    if (savedSensor) {
      try { setSensorBindings(JSON.parse(savedSensor) as string[]); } catch { /* ignore */ }
    }
  }, []);

  // localStorage persist on change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_COMBOS, JSON.stringify(combos));
  }, [combos]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SENSOR, JSON.stringify(sensorBindings));
  }, [sensorBindings]);

  const handleConnect = useCallback(
    async (method: "usb" | "bluetooth") => {
      setConnecting(true);
      setConnectError(null);
      try {
        const c =
          method === "bluetooth"
            ? await connectViaBluetooth()
            : await connectViaUSB();
        setConn(c);
        setConnectedVia(method);
        setMainTab("keymap");
      } catch (e) {
        setConnectError(String(e));
      } finally {
        setConnecting(false);
      }
    },
    []
  );

  const applyExtras = useCallback((extras: KeymapExtras, fileName?: string) => {
    setKeymapExtras(extras);
    const parsed = parseCombosBlock(extras.combos);
    setCombos(parsed);
    setSensorBindings(extras.sensorBindings);
    if (fileName) setLoadedFileName(fileName);
  }, []);

  const handleExtrasLoaded = useCallback((extras: KeymapExtras) => {
    applyExtras(extras);
  }, [applyExtras]);

  const handleStandaloneFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result;
      if (typeof text !== "string") return;
      try {
        const parsed = parseKeymapExtras(text);
        applyExtras(parsed, file.name);
      } catch (err) {
        alert(`パースに失敗しました: ${String(err)}`);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleApplyBinding = useCallback(
    async (binding: KeyBinding) => {
      if (selectedKey === null) return;
      const layerId = layers[activeLayer]?.id ?? activeLayer;
      const ok = await updateBinding(layerId, selectedKey, binding);
      if (ok) setSelectedKey(null);
    },
    [selectedKey, activeLayer, layers, updateBinding]
  );

  const handleSwap = useCallback(
    (fromIndex: number, toIndex: number) => {
      const layerId = layers[activeLayer]?.id ?? activeLayer;
      void swapBindings(layerId, fromIndex, toIndex);
    },
    [activeLayer, layers, swapBindings]
  );

  const handleAssignFromPicker = useCallback(
    (keyIndex: number, rawCode: number, mods: number) => {
      const kpEntry = [...behaviors.entries()].find(([, b]) => b.displayName === "Key Press");
      if (!kpEntry) return;
      const [kpId] = kpEntry;
      const layerId = layers[activeLayer]?.id ?? activeLayer;
      const param1 = ((mods & 0xFF) << 24) | (HID_PAGE_KEYBOARD << 16) | (rawCode & 0xFFFF);
      void updateBinding(layerId, keyIndex, { behaviorId: kpId, param1, param2: 0 });
    },
    [behaviors, layers, activeLayer, updateBinding]
  );

  const currentLayer = layers[activeLayer];

  // Layer data: prefer RPC, fall back to file, then defaults
  const effectiveLayerNames =
    conn && layers.length > 0
      ? layers.map((l: KeymapLayer) => l.name)
      : keymapExtras?.layerNames?.length
      ? keymapExtras.layerNames
      : DEFAULT_LAYER_NAMES;
  const effectiveLayerCount = effectiveLayerNames.length;

  // Show tabs when either connected (with data) or file loaded
  const connectedReady = !!(conn && !loading && layers.length > 0);
  const showMainTabs = connectedReady || keymapExtras !== null;

  // Show export when either connected (with layers) or file loaded
  const canExport = (conn && layers.length > 0) || keymapExtras !== null;

  if (!SERIAL_AVAILABLE && !BLUETOOTH_AVAILABLE) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-5xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold mb-2">
            Chrome または Edge が必要です
          </h1>
          <p className="text-gray-400">
            このアプリは WebSerial / Web Bluetooth API を使用します。
            Chrome 89+ または Edge 89+ でアクセスしてください。
            Firefox / Safari は非対応です。
          </p>
        </div>
      </div>
    );
  }

  const connectedLabel =
    connectedVia === "bluetooth" ? "Bluetooth 接続中" : "USB 接続中";
  const connectedColor =
    connectedVia === "bluetooth" ? "text-purple-400" : "text-green-400";
  const connectedDotColor =
    connectedVia === "bluetooth" ? "bg-purple-400" : "bg-green-400";

  const TAB_ITEMS: { id: MainTab; label: string }[] = (
    [
      connectedReady ? { id: "keymap" as MainTab, label: "キーマップ" } : null,
      { id: "combos" as MainTab, label: `コンボ${combos.length > 0 ? ` (${combos.length})` : ""}` },
      {
        id: "encoders" as MainTab,
        label: `エンコーダー${sensorBindings.filter(Boolean).length > 0 ? ` (${sensorBindings.filter(Boolean).length})` : ""}`,
      },
    ] as ({ id: MainTab; label: string } | null)[]
  ).filter((t): t is { id: MainTab; label: string } => t !== null);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="border-b border-gray-700 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">moNa2 Keymap Editor</h1>
          <p className="text-xs text-gray-400 mt-0.5">ZMK Studio RPC</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Standalone file load */}
          {!conn && (
            <>
              {loadedFileName ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-green-400 font-mono truncate max-w-[160px]">
                    {loadedFileName}
                  </span>
                  <button
                    onClick={() => standaloneFileInputRef.current?.click()}
                    className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 border border-gray-500 rounded transition-colors"
                  >
                    再読み込み
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => standaloneFileInputRef.current?.click()}
                  className="px-3 py-1.5 bg-blue-700 hover:bg-blue-600 text-sm font-semibold rounded transition-colors"
                >
                  .keymap を読み込む
                </button>
              )}
            </>
          )}

          {conn ? (
            <>
              <span
                className={`text-sm flex items-center gap-1.5 ${connectedColor}`}
              >
                <span
                  className={`w-2 h-2 rounded-full inline-block ${connectedDotColor}`}
                />
                {connectedLabel}
              </span>
              {canExport && (
                <button
                  onClick={() => setShowExport(true)}
                  className="px-4 py-1.5 bg-gray-700 hover:bg-gray-600 border border-gray-500 text-sm font-semibold rounded transition-colors"
                  title="現在のキーマップを .keymap ファイルとしてエクスポート"
                >
                  エクスポート
                </button>
              )}
              {unsaved && (
                <>
                  <button
                    onClick={() => void save()}
                    className="px-4 py-1.5 bg-green-600 hover:bg-green-700 text-sm font-semibold rounded transition-colors"
                  >
                    保存
                  </button>
                  <button
                    onClick={() => void discard()}
                    className="px-4 py-1.5 bg-gray-600 hover:bg-gray-500 text-sm font-semibold rounded transition-colors"
                  >
                    破棄
                  </button>
                </>
              )}
            </>
          ) : (
            <ConnectButton
              onConnectUSB={() => void handleConnect("usb")}
              onConnectBluetooth={() => void handleConnect("bluetooth")}
              connecting={connecting}
              serialAvailable={SERIAL_AVAILABLE}
              bluetoothAvailable={BLUETOOTH_AVAILABLE}
            />
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="px-6 py-6">
        {/* Landing: no connection and no file loaded */}
        {!conn && !keymapExtras && (
          <div className="text-center py-10 text-gray-400">
            <div className="text-6xl mb-4">⌨️</div>
            <p className="text-lg mb-4">接続するか、.keymap ファイルを読み込んでください</p>

            <div className="flex flex-col sm:flex-row gap-6 justify-center items-stretch max-w-xl mx-auto">
              {/* Standalone path */}
              <div className="flex-1 border border-gray-700 rounded-lg p-5 bg-gray-800/40 text-left space-y-2">
                <p className="text-sm font-semibold text-white">スタンドアロンモード</p>
                <p className="text-xs text-gray-400">
                  キーボード未接続でもコンボ・エンコーダーを編集できます。
                  既存の <code className="bg-gray-700 px-1 rounded">mona2.keymap</code> を読み込んで開始してください。
                </p>
                <button
                  onClick={() => standaloneFileInputRef.current?.click()}
                  className="mt-2 w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-sm font-semibold rounded transition-colors"
                >
                  .keymap ファイルを読み込む
                </button>
              </div>

              {/* Connect path */}
              <div className="flex-1 border border-gray-700 rounded-lg p-5 bg-gray-800/40 text-left space-y-2">
                <p className="text-sm font-semibold text-white">キーボードに接続</p>
                <p className="text-xs text-gray-400">
                  USB または Bluetooth でキーボードに接続すると、キーマップ編集も使用できます。
                </p>
                <div className="mt-2 flex justify-center">
                  <ConnectButton
                    onConnectUSB={() => void handleConnect("usb")}
                    onConnectBluetooth={() => void handleConnect("bluetooth")}
                    connecting={connecting}
                    serialAvailable={SERIAL_AVAILABLE}
                    bluetoothAvailable={BLUETOOTH_AVAILABLE}
                  />
                </div>
              </div>
            </div>

            {connectError && (
              <p className="mt-4 text-red-400 text-sm">{connectError}</p>
            )}
          </div>
        )}

        {/* Standalone: file loaded, not connected — show export button */}
        {!conn && keymapExtras && (
          <div className="mb-4 flex items-center justify-between px-4 py-2.5 bg-blue-900/30 border border-blue-700/50 rounded-lg">
            <span className="text-xs text-blue-300">
              スタンドアロンモード — コンボ・エンコーダーの編集内容は自動保存されます
            </span>
            <button
              onClick={() => setShowExport(true)}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-sm font-semibold rounded transition-colors"
            >
              .keymap をエクスポート
            </button>
          </div>
        )}

        {conn && (loading || behaviorsLoading) && (
          <div className="text-center py-16 text-gray-400">
            <p>{loading ? "キーマップを読み込み中..." : "ビヘイビアを読み込み中..."}</p>
          </div>
        )}

        {conn && !loading && !behaviorsLoading && (error || behaviorsError) && (
          <div className="text-center py-8 text-red-400 space-y-1">
            {error && <p>{error}</p>}
            {behaviorsError && <p>ビヘイビアエラー: {behaviorsError}</p>}
          </div>
        )}

        {/* 診断パネル (接続時のみ) */}
        {conn && !loading && !behaviorsLoading && (
          <div className="mb-3 px-3 py-2 bg-gray-800 border border-gray-600 rounded text-xs text-gray-400 font-mono">
            layers: {layers.length} | bindings[0]: {layers[0]?.bindings?.length ?? "-"} | behaviors: {behaviors.size}
            {layers.length === 0 && !error && " ← キーマップが空です"}
            {behaviors.size === 0 && !behaviorsError && " ← ビヘイビア未取得"}
          </div>
        )}

        {/* Main tab UI */}
        {showMainTabs && (
          <>
            {connectedReady && unsaved && (
              <div className="mb-4 px-4 py-2 bg-yellow-900/40 border border-yellow-700 rounded text-yellow-300 text-sm">
                未保存の変更があります。「保存」をクリックすると Flash に書き込まれます。
              </div>
            )}

            {/* Main tab switcher */}
            <div className="mb-5 flex gap-1 border-b border-gray-700">
              {TAB_ITEMS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setMainTab(tab.id);
                    setSelectedKey(null);
                  }}
                  className={`px-4 py-2 text-sm font-medium rounded-t transition-colors ${
                    mainTab === tab.id
                      ? "bg-gray-800 border border-b-gray-800 border-gray-700 text-white"
                      : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/50"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab: キーマップ (接続時のみ有効) */}
            {mainTab === "keymap" && connectedReady && (
              <>
                <div className="mb-5">
                  <LayerTabs
                    layerCount={layers.length}
                    activeLayer={activeLayer}
                    layerNames={layers.map((l: KeymapLayer) => l.name)}
                    onChange={setActiveLayer}
                  />
                </div>

                <div className="overflow-x-auto">
                  <KeyboardLayout
                    bindings={currentLayer?.bindings ?? []}
                    behaviors={behaviors}
                    selectedKey={selectedKey}
                    onKeyClick={(i: number) =>
                      setSelectedKey((prev: number | null) =>
                        prev === i ? null : i
                      )
                    }
                    onSwap={handleSwap}
                    onAssignFromPicker={handleAssignFromPicker}
                  />
                </div>

                <KeyPickerPanel />

                {selectedKey === null && (
                  <p className="mt-2 text-xs text-gray-500">
                    キーパレットからドラッグ、またはキーをクリックして詳細編集
                  </p>
                )}
              </>
            )}

            {/* Tab: コンボ */}
            {mainTab === "combos" && (
              <ComboEditorPanel
                combos={combos}
                onChange={setCombos}
                layerCount={effectiveLayerCount}
              />
            )}

            {/* Tab: エンコーダー */}
            {mainTab === "encoders" && (
              <EncoderEditorPanel
                sensorBindings={sensorBindings}
                layerNames={effectiveLayerNames}
                onChange={setSensorBindings}
              />
            )}
          </>
        )}
      </main>

      {showExport && (
        <KeymapExportModal
          layers={layers}
          behaviors={behaviors}
          extras={keymapExtras}
          combos={combos}
          sensorBindings={sensorBindings}
          onExtrasLoaded={handleExtrasLoaded}
          onClose={() => setShowExport(false)}
        />
      )}

      {selectedKey !== null && conn && mainTab === "keymap" && (
        <BindingEditor
          keyIndex={selectedKey}
          binding={currentLayer?.bindings[selectedKey]}
          behaviors={behaviors}
          onApply={(b) => void handleApplyBinding(b)}
          onClose={() => setSelectedKey(null)}
        />
      )}

      {/* Hidden file input for standalone loading */}
      <input
        ref={standaloneFileInputRef}
        type="file"
        accept=".keymap,.conf,.txt"
        className="hidden"
        onChange={handleStandaloneFileChange}
      />
    </div>
  );
}
