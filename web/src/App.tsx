import { useState, useCallback } from "react";
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
import type { KeyBinding, KeymapLayer } from "./hooks/useKeymap";

const SERIAL_AVAILABLE =
  typeof navigator !== "undefined" && "serial" in navigator;
const BLUETOOTH_AVAILABLE =
  typeof navigator !== "undefined" &&
  "bluetooth" in navigator &&
  typeof (navigator as unknown as { bluetooth?: unknown }).bluetooth !== "undefined";

export default function App() {
  const [conn, setConn] = useState<RpcConnection | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [connectedVia, setConnectedVia] = useState<"usb" | "bluetooth" | null>(null);
  const [activeLayer, setActiveLayer] = useState(0);
  const [selectedKey, setSelectedKey] = useState<number | null>(null);

  const { layers, loading, error, unsaved, updateBinding, save, discard } =
    useKeymap(conn);
  const { behaviors, loading: behaviorsLoading, error: behaviorsError } = useBehaviors(conn);

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
      } catch (e) {
        setConnectError(String(e));
      } finally {
        setConnecting(false);
      }
    },
    []
  );

  const handleApplyBinding = useCallback(
    async (binding: KeyBinding) => {
      if (selectedKey === null) return;
      const layerId = layers[activeLayer]?.id ?? activeLayer;
      const ok = await updateBinding(layerId, selectedKey, binding);
      if (ok) setSelectedKey(null);
    },
    [selectedKey, activeLayer, layers, updateBinding]
  );

  const currentLayer = layers[activeLayer];

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

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="border-b border-gray-700 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">moNa2 Keymap Editor</h1>
          <p className="text-xs text-gray-400 mt-0.5">ZMK Studio RPC</p>
        </div>
        <div className="flex items-center gap-3">
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
        {!conn && (
          <div className="text-center py-16 text-gray-400">
            <div className="text-6xl mb-4">⌨️</div>
            <p className="text-lg mb-2">接続方法を選択してください</p>
            <p className="text-sm mb-1">
              <span className="text-blue-400">USB で接続</span>
              {" — "}mona2_r に USB ケーブルを繋いでから選択（推奨）
            </p>
            <p className="text-sm text-gray-500">
              <span className="text-purple-400/70">Bluetooth で接続</span>
              {" — "}macOS + Chrome では HID 接続済みデバイスへの GATT 接続が制限されるため動作しない場合があります
            </p>
            {connectError && (
              <p className="mt-4 text-red-400 text-sm">{connectError}</p>
            )}
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

        {/* 診断パネル: 接続後にデータが正しく取れているか確認 */}
        {conn && !loading && !behaviorsLoading && (
          <div className="mb-3 px-3 py-2 bg-gray-800 border border-gray-600 rounded text-xs text-gray-400 font-mono">
            layers: {layers.length} | bindings[0]: {layers[0]?.bindings?.length ?? "-"} | behaviors: {behaviors.size}
            {layers.length === 0 && !error && " ← キーマップが空です"}
            {behaviors.size === 0 && !behaviorsError && " ← ビヘイビア未取得"}
          </div>
        )}

        {conn && !loading && layers.length > 0 && (
          <>
            {unsaved && (
              <div className="mb-4 px-4 py-2 bg-yellow-900/40 border border-yellow-700 rounded text-yellow-300 text-sm">
                未保存の変更があります。「保存」をクリックすると Flash に書き込まれます。
              </div>
            )}

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
              />
            </div>

            {selectedKey === null && (
              <p className="mt-4 text-sm text-gray-500">
                キーをクリックしてバインディングを編集できます
              </p>
            )}
          </>
        )}
      </main>

      {selectedKey !== null && conn && (
        <BindingEditor
          keyIndex={selectedKey}
          binding={currentLayer?.bindings[selectedKey]}
          behaviors={behaviors}
          onApply={(b) => void handleApplyBinding(b)}
          onClose={() => setSelectedKey(null)}
        />
      )}
    </div>
  );
}
